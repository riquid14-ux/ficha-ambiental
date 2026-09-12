import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, partnerAllowedProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sql, eq } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { storageGet, storagePut } from "./storage";
import bcrypt from "bcryptjs";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import { sendFichaSubmittedNotification, sendFichaReviewedNotification, sendInvitationEmail } from "./email";
import { sanitizeFile } from "./file-sanitizer";
import { canReadDocumentLibrary } from "./document-library";
import ExcelJS from "exceljs";

// Security: Allowed MIME types for file uploads
const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
]);
const MAX_FILE_SIZE_B64 = 15 * 1024 * 1024; // ~10MB file = ~13.3MB base64

// Security: Log file upload for audit trail
async function logFileUpload(userId: number, filename: string, mimeType: string, safe: boolean, threats: string[], context: string) {
  try {
    const database = await db.getDb();
    if (!database) return;
    await database.insert(schema.auditLog).values({
      userId,
      action: safe ? "file_upload" : "file_upload_blocked",
      entity: "file",
      newValue: JSON.stringify({
        filename,
        mimeType,
        context,
        safe,
        threats: threats.length > 0 ? threats : undefined,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("[Audit] Failed to log file upload:", e);
  }
}

// Helper: check if user has elevated permissions (admin or dono_obra)
function isAdminOrDono(role: string) {
  return role === "admin" || role === "dono_obra";
}

export function shouldArchiveWasteEgar(egarId?: string | null) {
  return !egarId?.startsWith("QA-TEMP-");
}

export async function archiveWasteEgarIfRequired(egarId: string | null | undefined, archive: () => Promise<void>) {
  if (!shouldArchiveWasteEgar(egarId)) return false;
  await archive();
  return true;
}

export function isWithinWasteEgarDeletionWindow(createdAt: string | Date | number, now = Date.now()) {
  const createdAtMs = new Date(createdAt).getTime();
  return Number.isFinite(createdAtMs) && now - createdAtMs <= 48 * 60 * 60 * 1000;
}

function assertAdminOnly(user: { role: string }) {
  if (user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerir empresas, utilizadores, funções e convites." });
}

async function assertProjectAccess(user: any, projectId: number) {
  const project = await db.getProjectById(projectId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projecto não encontrado." });
  if (isAdminOrDono(user.role)) return project;

  const userProjects = await db.getUserProjects(user.id);
  if (user.role === "pm") {
    if (!userProjects.some((item: any) => item.projectId === projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "Este projecto não está atribuído ao PM." });
    return project;
  }
  const companyProjects = user.companyId ? await db.getProjectsForCompany(user.companyId) : [];
  const allowedProjectIds = new Set([
    ...userProjects.map((item: any) => item.projectId),
    ...companyProjects.map((item: any) => item.projectId),
  ]);
  if (!allowedProjectIds.has(projectId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso ao projecto seleccionado." });
  }
  return project;
}

type ProjectModule = "dashboard" | "calendar" | "timeline" | "ficha" | "residuos" | "kpi" | "operacao";
type PmAccessModule = ProjectModule | "planos" | "documentacao";
const DEFAULT_PROJECT_MODULES: ProjectModule[] = ["dashboard", "calendar", "timeline", "ficha", "residuos", "kpi", "operacao"];
const DEFAULT_PM_ACCESS_MODULES: PmAccessModule[] = ["dashboard", "planos", "calendar", "timeline", "ficha", "residuos", "kpi", "operacao", "documentacao"];

function getEnabledProjectModules(project: any): ProjectModule[] {
  if (typeof project?.enabledModules !== "string") return DEFAULT_PROJECT_MODULES;
  try {
    const parsed = JSON.parse(project.enabledModules);
    if (Array.isArray(parsed) && parsed.every(module => DEFAULT_PROJECT_MODULES.includes(module))) {
      return parsed as ProjectModule[];
    }
  } catch {
    // Configurações antigas ou inválidas mantêm os módulos completos por compatibilidade.
  }
  return DEFAULT_PROJECT_MODULES;
}

async function assertProjectModuleAccess(user: any, projectId: number, module: ProjectModule) {
  const project = await assertProjectAccess(user, projectId);
  if (!getEnabledProjectModules(project).includes(module)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Este módulo não está activo no projecto seleccionado." });
  }
  await assertPmModuleAccess(user, projectId, module);
  return project;
}

function parsePmAccessModules(value: unknown): PmAccessModule[] {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_PM_ACCESS_MODULES;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every(module => DEFAULT_PM_ACCESS_MODULES.includes(module))) return parsed as PmAccessModule[];
  } catch {
    // Mantém o acesso total dos PM existentes até o administrador guardar uma configuração válida.
  }
  return DEFAULT_PM_ACCESS_MODULES;
}

async function assertPmModuleAccess(user: any, projectId: number, module: PmAccessModule) {
  if (user.role !== "pm") return;
  const assignment = (await db.getUserProjects(user.id)).find((item: any) => item.projectId === projectId);
  if (!assignment || !parsePmAccessModules(assignment.accessModules).includes(module)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Este módulo não está autorizado para o PM no projecto seleccionado." });
  }
}

async function assertProjectFeatureAccess(user: any, projectId: number, module: PmAccessModule) {
  const project = await assertProjectAccess(user, projectId);
  await assertPmModuleAccess(user, projectId, module);
  return project;
}

async function getAccessibleProjectIds(user: any) {
  if (isAdminOrDono(user.role)) {
    return (await db.getAllProjects()).map(project => project.id);
  }
  const userProjects = await db.getUserProjects(user.id);
  if (user.role === "pm") return userProjects.map((item: any) => item.projectId);
  const companyProjects = user.companyId ? await db.getProjectsForCompany(user.companyId) : [];
  return Array.from(new Set([
    ...userProjects.map((item: any) => item.projectId),
    ...companyProjects.map((item: any) => item.projectId),
  ]));
}

type PartnerModule = "kpi" | "waste";

async function getActivePartnerProfile(user: any, module?: PartnerModule) {
  if (user.role !== "ee_partner") return null;
  const profile = await db.getPartnerAccessProfile(user.id);
  if (!profile?.active) {
    throw new TRPCError({ code: "FORBIDDEN", message: "O acesso deste parceiro não está activo." });
  }
  if (module === "kpi" && !profile.allowKpi) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso ao módulo KPI." });
  }
  if (module === "waste" && !profile.allowWaste) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso ao módulo Resíduos." });
  }
  return profile;
}

async function assertPartnerProjectModuleAccess(user: any, projectId: number, module: PartnerModule) {
  if (user.role !== "ee_partner") {
    await assertProjectModuleAccess(user, projectId, module === "waste" ? "residuos" : "kpi");
    return null;
  }
  const profile = await getActivePartnerProfile(user, module);
  const allowedProjectIds = await db.getPartnerAllowedProjectIds(user.id, profile!.parentCompanyId);
  if (!allowedProjectIds.includes(projectId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Este projecto não pertence ao âmbito autorizado da EE principal." });
  }
  return profile;
}

function canUpdatePlanProgress(user: any, assignment: any) {
  return isAdminOrDono(user.role) || user.role === "raa" || assignment.ownerId === user.id;
}

function getUserDisplayName(user: any) {
  return user.fullName || user.name || user.email || `Utilizador ${user.id}`;
}

const OPERATION_PROJECT_CODE = "SIN01";
const OPERATION_WRITE_ROLES = new Set(["admin", "dono_obra", "pm"]);

async function assertOperationAccess(user: any, projectId: number, write = false) {
  const project = await assertProjectFeatureAccess(user, projectId, "operacao");
  if (project.code !== OPERATION_PROJECT_CODE) {
    throw new TRPCError({ code: "FORBIDDEN", message: "A Operação está disponível apenas para o SIN01/NEST." });
  }
  if (write && !OPERATION_WRITE_ROLES.has(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para alterar dados de Operação." });
  }
  return project;
}

function parseOperationNumber(value: unknown): number | null {
  if (value && typeof value === "object" && "result" in value) return parseOperationNumber((value as { result: unknown }).result);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? cleaned.replace(/,/g, "")
    : cleaned.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function summarizeOperationQuality(readings: Array<{ dataQuality: string }>) {
  const total = readings.length;
  const valid = readings.filter(row => row.dataQuality === "valid").length;
  const warnings = readings.filter(row => row.dataQuality === "warning").length;
  const invalid = readings.filter(row => row.dataQuality === "invalid").length;
  return { total, valid, warnings, invalid, coveragePercent: total ? (valid / total) * 100 : null };
}

type OperationSettingsValues = Record<string, string | number | null | undefined>;
function operationSettingNumber(settings: OperationSettingsValues | null | undefined, key: string) {
  const value = settings?.[key];
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const parsed = typeof value === "number" ? value : Number(String(value ?? ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function calculateOperationEnvironmentalMetrics(readings: Array<{ metricCode: string; value: number; dataQuality: string }>, settings: OperationSettingsValues | null | undefined) {
  const usable = readings.filter(reading => reading.dataQuality !== "invalid" && Number.isFinite(reading.value));
  const configurationMode = settings?.configurationMode === "illustrative" ? "illustrative" : "approved";
  const sum = (code: string) => usable.filter(reading => reading.metricCode === code).reduce((total, reading) => total + reading.value, 0);
  const latest = new Map<string, number>();
  for (const reading of usable) latest.set(reading.metricCode, reading.value);
  const electricityKwh = sum("site_energy_kwh_daily");
  const itEnergyKwh = sum("it_energy_kwh_daily");
  const electricityFactor = operationSettingNumber(settings, "electricityCarbonFactorKgKwh");
  const electricityCarbonKg = electricityFactor === null ? null : electricityKwh * electricityFactor;
  const cueKgKwh = electricityCarbonKg !== null && itEnergyKwh > 0 ? electricityCarbonKg / itEnergyKwh : null;
  const thresholdChecks = [
    { id: "pue", label: "PUE", value: latest.get("pue") ?? null, limit: operationSettingNumber(settings, "maxPue"), direction: "max" as const, unit: "rácio" },
    { id: "seawater_return_temp", label: "Temperatura de descarga", value: latest.get("seawater_return_temp_c") ?? null, limit: operationSettingNumber(settings, "maxSeawaterReturnTempC"), direction: "max" as const, unit: "°C" },
    { id: "seawater_flow_min", label: "Caudal mínimo de captação", value: latest.get("seawater_flow_lps") ?? null, limit: operationSettingNumber(settings, "minSeawaterFlowLps"), direction: "min" as const, unit: "L/s" },
    { id: "seawater_flow_max", label: "Caudal máximo de captação", value: latest.get("seawater_flow_lps") ?? null, limit: operationSettingNumber(settings, "maxSeawaterFlowLps"), direction: "max" as const, unit: "L/s" },
    { id: "seawater_delta_t", label: "ΔT água do mar", value: latest.get("seawater_delta_t_k") ?? null, limit: operationSettingNumber(settings, "maxSeawaterDeltaTK"), direction: "max" as const, unit: "K" },
  ].map(check => ({ ...check, status: check.limit === null ? "por_configurar" : check.value === null ? "sem_leitura" : configurationMode === "illustrative" ? "demonstracao" : (check.direction === "max" ? check.value <= check.limit : check.value >= check.limit) ? "conforme" : "desvio" }));
  return {
    electricityKwh,
    itEnergyKwh,
    electricityCarbonKg,
    cueKgKwh,
    configurationMode,
    carbonStatus: electricityFactor === null ? "factor_pendente" : configurationMode === "illustrative" ? "demonstracao" : itEnergyKwh > 0 ? "calculado" : "sem_energia_ti",
    thresholdChecks,
  };
}

type OperationForecastReading = { metricCode: string; value: number; measuredAt: number; dataQuality: string };

function buildDailyAverageSeries(readings: OperationForecastReading[], metricCode: string) {
  const valuesByDay = new Map<string, number[]>();
  for (const reading of readings) {
    if (reading.metricCode !== metricCode || reading.dataQuality === "invalid" || !Number.isFinite(reading.value)) continue;
    const date = new Date(reading.measuredAt).toISOString().slice(0, 10);
    const values = valuesByDay.get(date) || [];
    values.push(Number(reading.value));
    valuesByDay.set(date, values);
  }
  return Array.from(valuesByDay.entries())
    .map(([date, values]) => ({ date, value: values.reduce((total, value) => total + value, 0) / values.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildOperationTrendForecast(readings: OperationForecastReading[], settings: OperationSettingsValues | null | undefined) {
  const minimumDays = 7;
  const horizonDays = Math.min(730, Math.max(7, Math.trunc(operationSettingNumber(settings, "forecastHorizonDays") || 30)));
  const buildMetricForecast = (metricCode: string, label: string, unit: string, multiplier = 1) => {
    const history = buildDailyAverageSeries(readings, metricCode).map(point => ({ ...point, value: point.value * multiplier }));
    if (history.length < minimumDays) return { metricCode, label, unit, status: "histórico_insuficiente" as const, observations: history.length, history, forecast: [] as Array<{ date: string; value: number }> };
    const n = history.length;
    const meanX = (n - 1) / 2;
    const meanY = history.reduce((total, point) => total + point.value, 0) / n;
    const denominator = history.reduce((total, _, index) => total + (index - meanX) ** 2, 0);
    const slope = denominator ? history.reduce((total, point, index) => total + (index - meanX) * (point.value - meanY), 0) / denominator : 0;
    const intercept = meanY - slope * meanX;
    const lastDate = new Date(`${history[history.length - 1].date}T00:00:00Z`);
    const forecast = Array.from({ length: horizonDays }, (_, index) => {
      const date = new Date(lastDate.getTime() + (index + 1) * 86_400_000).toISOString().slice(0, 10);
      return { date, value: Math.max(0, intercept + slope * (n + index)) };
    });
    return { metricCode, label, unit, status: "disponível" as const, observations: history.length, history, forecast, method: "tendência_linear" as const };
  };
  const electricityPrice = operationSettingNumber(settings, "electricityPriceEurKwh");
  return {
    minimumDays,
    horizonDays,
    configurationMode: settings?.configurationMode === "illustrative" ? "illustrative" : "approved",
    pue: buildMetricForecast("pue", "PUE", "rácio"),
    wue: buildMetricForecast("wue_calculated_daily", "WUE", "L/kWh TI"),
    cost: electricityPrice === null
      ? { metricCode: "site_energy_kwh_daily", label: "Custo de energia", unit: "€", status: "preço_pendente" as const, observations: 0, history: [], forecast: [] as Array<{ date: string; value: number }> }
      : buildMetricForecast("site_energy_kwh_daily", "Custo de energia", "€", electricityPrice),
  };
}

export function buildCalculatedWueReadings(readings: Array<{ metricCode: string; metricLabel?: string; category?: string; unit?: string; value: number; measuredAt: number; granularity: string; source?: string; dataQuality: string }>) {
  const dailyWater = new Map<number, number>();
  const dailyItEnergy = new Map<number, number>();
  for (const reading of readings) {
    if (reading.dataQuality === "invalid" || !Number.isFinite(reading.value)) continue;
    if (reading.metricCode === "water_consumption_m3_daily" && reading.granularity === "diario") dailyWater.set(Number(reading.measuredAt), Number(reading.value));
    if (reading.metricCode === "it_energy_kwh_daily" && reading.granularity === "diario") dailyItEnergy.set(Number(reading.measuredAt), Number(reading.value));
  }
  return Array.from(dailyWater.entries()).flatMap(([measuredAt, waterM3]) => {
    const itEnergy = dailyItEnergy.get(measuredAt);
    if (!Number.isFinite(itEnergy) || !itEnergy || waterM3 < 0) return [];
    return [{ metricCode: "wue_calculated_daily", metricLabel: "WUE calculado", category: "agua", unit: "L/kWh TI", value: (waterM3 * 1000) / itEnergy, measuredAt, granularity: "diario", source: "calculated", dataQuality: "valid", qualityNote: "Calculado a partir de consumo diário de água registado e energia TI medida." }];
  });
}

type OperationReconciliationInvoice = {
  invoiceType: string;
  quantity: number | string;
  unit: string;
  periodStart: string;
  periodEnd: string;
};

export function buildOperationReconciliationEntry(invoice: OperationReconciliationInvoice, measured: number | null) {
  const billed = Number(invoice.quantity);
  const variance = measured !== null && billed > 0 ? (measured - billed) / billed : null;
  return {
    invoiceType: invoice.invoiceType,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    billed,
    unit: invoice.unit,
    measured,
    variance,
    status: measured === null ? "incompleta" : Math.abs(variance || 0) <= 0.05 ? "conforme" : "desvio",
  };
}

function parseReportDate(value: unknown) {
  if (value && typeof value === "object" && "result" in value) return parseReportDate((value as { result: unknown }).result);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const text = String(value ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const isoDate = new Date(text);
    if (!Number.isNaN(isoDate.getTime())) return new Date(Date.UTC(isoDate.getUTCFullYear(), isoDate.getUTCMonth(), isoDate.getUTCDate()));
  }
  const match = text.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  const months: Record<string, number> = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
  if (!match || months[match[2].toLowerCase()] === undefined) return null;
  return new Date(Date.UTC(Number(match[3]), months[match[2].toLowerCase()], Number(match[1])));
}

function parseReportTimestamp(value: unknown) {
  if (value && typeof value === "object" && "result" in value) return parseReportTimestamp((value as { result: unknown }).result);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime());
  const text = String(value ?? "").trim();
  const numeric = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (numeric) return new Date(Date.UTC(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]), Number(numeric[4]), Number(numeric[5]), Number(numeric[6] || 0)));
  const date = parseReportDate(text);
  if (!date) return null;
  const time = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), Number(time?.[1] || 0), Number(time?.[2] || 0), Number(time?.[3] || 0)));
}

function dateKeyFromTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getWorksheetRowText(row: ExcelJS.Row) {
  return Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text).join(" ");
}

type OperationReadingInput = {
  metricCode: string;
  metricLabel: string;
  category: "energia" | "agua" | "arrefecimento" | "carbono" | "conformidade" | "custo";
  unit: string;
  value: number;
  measuredAt: number;
  granularity: "quinze_minutos" | "diario" | "mensal" | "anual";
  source: "bms_report" | "invoice" | "manual" | "calculated";
  dataQuality: "valid" | "warning" | "invalid";
  qualityNote?: string;
};

export function extractOperationalReadings(workbook: ExcelJS.Workbook) {
  const daily = workbook.getWorksheet("Daily Report (v2)") || workbook.worksheets.find(sheet => /daily\s+report/i.test(sheet.name));
  if (!daily) throw new TRPCError({ code: "BAD_REQUEST", message: "O ficheiro não contém a folha 'Daily Report' necessária." });
  const dateCell = daily.getRow(4).getCell(3).value;
  const date = parseReportDate(dateCell) || parseReportDate(getWorksheetRowText(daily.getRow(4)));
  if (!date) throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível identificar a data do relatório operacional." });
  const measuredAt = date.getTime();
  const readings: OperationReadingInput[] = [];
  const add = (metricCode: string, metricLabel: string, category: OperationReadingInput["category"], unit: string, value: number | null, source: OperationReadingInput["source"] = "bms_report", dataQuality: OperationReadingInput["dataQuality"] = "valid", qualityNote?: string, granularity: OperationReadingInput["granularity"] = "diario", at = measuredAt) => {
    if (value === null || !Number.isFinite(value)) return;
    readings.push({ metricCode, metricLabel, category, unit, value, measuredAt: at, source, dataQuality, qualityNote, granularity });
  };
  const findRow = (needle: string) => {
    for (let index = 1; index <= daily.rowCount; index += 1) {
      if (getWorksheetRowText(daily.getRow(index)).toLowerCase().includes(needle.toLowerCase())) return daily.getRow(index);
    }
    return undefined;
  };
  const headerRow = (() => {
    for (let index = 1; index <= daily.rowCount; index += 1) {
      const text = getWorksheetRowText(daily.getRow(index)).toLowerCase();
      if (text.includes("site") && text.includes("it") && text.includes("esw")) return daily.getRow(index);
    }
    return undefined;
  })();
  const columnFor = (label: string) => {
    if (!headerRow) return -1;
    for (let index = 1; index <= headerRow.cellCount; index += 1) if (headerRow.getCell(index).text.trim().toLowerCase() === label.toLowerCase()) return index;
    return -1;
  };
  const averagePower = findRow("Average Power");
  const dailyEnergy = findRow("Total Daily Consumption");
  const powerAt = (label: string) => {
    const column = columnFor(label);
    return column > 0 && averagePower ? parseOperationNumber(averagePower.getCell(column).value) : null;
  };
  const energyAt = (label: string) => {
    const column = columnFor(label);
    return column > 0 && dailyEnergy ? parseOperationNumber(dailyEnergy.getCell(column).value) : null;
  };
  const sitePower = powerAt("Site"); const itPower = powerAt("IT"); const eswPower = powerAt("ESW");
  const siteEnergy = energyAt("Site"); const itEnergy = energyAt("IT"); const eswEnergy = energyAt("ESW");
  add("site_power_avg_kw", "Potência média do site", "energia", "kW", sitePower);
  add("it_power_avg_kw", "Carga TI média", "energia", "kW", itPower);
  add("esw_power_avg_kw", "Potência média do sistema de água do mar", "arrefecimento", "kW", eswPower);
  add("site_energy_kwh_daily", "Energia diária do site", "energia", "kWh", siteEnergy);
  add("it_energy_kwh_daily", "Energia TI diária", "energia", "kWh", itEnergy);
  add("esw_energy_kwh_daily", "Energia diária do sistema de água do mar", "arrefecimento", "kWh", eswEnergy);
  add("pue", "PUE", "energia", "rácio", siteEnergy !== null && itEnergy !== null && itEnergy > 0 ? siteEnergy / itEnergy : null, "calculated", itEnergy && itEnergy > 0 ? "valid" : "invalid", itEnergy && itEnergy > 0 ? undefined : "Sem carga TI válida para calcular PUE.");
  const reportedWue = findRow("Total Daily Consumption")?.getCell(13).value;
  const reportedWueNumber = parseOperationNumber(reportedWue);
  add("wue_reportado", "WUE reportado na origem", "agua", "L/kWh TI", reportedWueNumber, "bms_report", reportedWueNumber !== null && reportedWueNumber >= 0 ? "warning" : "invalid", reportedWueNumber !== null && reportedWueNumber < 0 ? "Valor negativo na origem; excluído de indicadores e exportações." : "WUE importado sem validação de balanço de água.");

  const seawater = workbook.getWorksheet("Seawater_strings (v2)") || workbook.worksheets.find(sheet => /seawater/i.test(sheet.name));
  if (seawater) {
    let averageRow: ExcelJS.Row | undefined;
    let labelsRow: ExcelJS.Row | undefined;
    for (let index = 1; index <= Math.min(seawater.rowCount, 20); index += 1) {
      const row = seawater.getRow(index);
      const rowText = getWorksheetRowText(row);
      if (/seawater\s+flow/i.test(rowText)) labelsRow = row;
      if (/^\s*(avrg|average)\b/i.test(rowText)) averageRow = row;
    }
    const averageByLabel = (label: string) => {
      if (!labelsRow || !averageRow) return null;
      for (let index = 1; index <= labelsRow.cellCount; index += 1) {
        if (labelsRow.getCell(index).text.trim().toLowerCase() === label.toLowerCase()) return parseOperationNumber(averageRow.getCell(index).value);
      }
      return null;
    };
    const seawaterTemp = averageByLabel("Seawater Temperature (ºC)");
    const outdoorTemp = averageByLabel("Air Temperature");
    const pcwSupply = averageByLabel("PCW Supply Temperature");
    const pcwReturn = averageByLabel("PCW Return Temperature");
    const seawaterReturn = averageByLabel("Seawater Return Temperature");
    const windSpeed = averageByLabel("Wind Speed (Km/h)");
    const seawaterFlow = averageByLabel("Seawater Flow (L/s)");
    add("seawater_intake_temp_c", "Temperatura média da água do mar na captação", "arrefecimento", "°C", seawaterTemp);
    add("outdoor_temp_avg_c", "Temperatura exterior média", "arrefecimento", "°C", outdoorTemp);
    add("pcw_supply_temp_c", "Temperatura média de fornecimento PCW", "arrefecimento", "°C", pcwSupply);
    add("pcw_return_temp_c", "Temperatura média de retorno PCW", "arrefecimento", "°C", pcwReturn);
    add("seawater_return_temp_c", "Temperatura média de descarga ao mar", "conformidade", "°C", seawaterReturn);
    add("seawater_flow_lps", "Caudal médio de captação", "arrefecimento", "L/s", seawaterFlow);
    add("seawater_delta_t_k", "ΔT água do mar", "arrefecimento", "K", seawaterReturn !== null && seawaterTemp !== null ? seawaterReturn - seawaterTemp : null, "calculated");
    add("pcw_delta_t_k", "ΔT circuito PCW", "arrefecimento", "K", pcwReturn !== null && pcwSupply !== null ? pcwReturn - pcwSupply : null, "calculated");
    add("heat_exchanger_approach_k", "Approach do permutador de titânio", "arrefecimento", "K", pcwSupply !== null && seawaterTemp !== null ? pcwSupply - seawaterTemp : null, "calculated");
    let thermalLoad: number | null = null;
    for (let index = 1; index <= seawater.rowCount; index += 1) {
      if (/thermal\s+load/i.test(getWorksheetRowText(seawater.getRow(index)))) {
        for (let next = index; next <= Math.min(seawater.rowCount, index + 4); next += 1) {
          const candidates = Array.from({ length: seawater.getRow(next).cellCount }, (_, cell) => parseOperationNumber(seawater.getRow(next).getCell(cell + 1).value)).filter((value): value is number => value !== null);
          if (candidates.length) { thermalLoad = candidates[candidates.length - 1]; break; }
        }
      }
      if (thermalLoad !== null) break;
    }
    add("seawater_thermal_load_kw", "Carga térmica rejeitada ao mar", "arrefecimento", "kW térmicos", thermalLoad);
    add("seawater_pumping_cop", "COP de bombagem do circuito de mar", "arrefecimento", "kWh térmico/kWh elétrico", thermalLoad !== null && eswPower !== null && eswPower > 0 ? thermalLoad / eswPower : null, "calculated", eswPower && eswPower > 0 ? "valid" : "invalid", eswPower && eswPower > 0 ? undefined : "Sem potência ESW válida para calcular COP.");
  }
  const auxiliary = workbook.getWorksheet("AUX") || workbook.worksheets.find(sheet => /^aux$/i.test(sheet.name));
  if (auxiliary) {
    const header = auxiliary.getRow(1);
    const column = (names: string[], last = false) => {
      const matches: number[] = [];
      for (let index = 1; index <= header.cellCount; index += 1) if (names.includes(header.getCell(index).text.trim().toLowerCase())) matches.push(index);
      return matches.length ? matches[last ? matches.length - 1 : 0] : -1;
    };
    const timestampColumn = column(["time", "time stamp", "timestamp"]);
    const wueColumn = column(["wue"], true);
    if (timestampColumn > 0 && wueColumn > 0) {
      for (let rowIndex = 2; rowIndex <= Math.min(auxiliary.rowCount, 4000); rowIndex += 1) {
        const row = auxiliary.getRow(rowIndex);
        const timestamp = parseReportTimestamp(row.getCell(timestampColumn).value) || parseReportTimestamp(row.getCell(timestampColumn).text);
        const value = parseOperationNumber(row.getCell(wueColumn).value);
        if (!timestamp || value === null) continue;
        const invalid = value < 0;
        add("wue_15m", "WUE de quinze minutos", "agua", "L/kWh TI", value, "bms_report", invalid ? "invalid" : "valid", invalid ? "WUE negativo na origem; excluído das correlações." : undefined, "quinze_minutos", timestamp.getTime());
      }
    }
  }
  const organizer = workbook.getWorksheet("EBO_Data organizer") || workbook.worksheets.find(sheet => /ebo.*organizer/i.test(sheet.name));
  if (organizer) {
    const header = organizer.getRow(1);
    const column = (names: string[]) => {
      for (let index = 1; index <= header.cellCount; index += 1) if (names.includes(header.getCell(index).text.trim().toLowerCase())) return index;
      return -1;
    };
    const timestampColumn = column(["time stamp", "timestamp"]);
    const rawMetrics = [
      { code: "outdoor_temp_15m_c", label: "Temperatura exterior", category: "arrefecimento" as const, unit: "°C", headers: ["temp exterior"] },
      { code: "seawater_intake_15m_c", label: "Temperatura da água do mar na captação", category: "arrefecimento" as const, unit: "°C", headers: ["sw_tmp"] },
      { code: "seawater_flow_15m_lps", label: "Caudal de água do mar", category: "arrefecimento" as const, unit: "L/s", headers: ["sw_flow"] },
      { code: "cooling_cycles_15m", label: "Ciclos de arrefecimento", category: "arrefecimento" as const, unit: "ciclos", headers: ["total_fc"] },
      { code: "wue_15m", label: "WUE de quinze minutos", category: "agua" as const, unit: "L/kWh TI", headers: ["wue"] },
      { code: "pcw_supply_15m_c", label: "Fornecimento PCW", category: "arrefecimento" as const, unit: "°C", headers: ["pcw_sp1"] },
      { code: "pcw_return_15m_c", label: "Retorno PCW", category: "arrefecimento" as const, unit: "°C", headers: ["pcw_ret1"] },
    ];
    if (timestampColumn > 0) {
      for (let rowIndex = 2; rowIndex <= Math.min(organizer.rowCount, 4000); rowIndex += 1) {
        const row = organizer.getRow(rowIndex); const timeText = row.getCell(timestampColumn).text;
        const match = timeText.match(/(\d{1,2}):(\d{2})/); if (!match) continue;
        const at = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), Number(match[1]), Number(match[2]));
        for (const metric of rawMetrics) {
          const metricColumn = column(metric.headers); const value = metricColumn > 0 ? parseOperationNumber(row.getCell(metricColumn).value) : null;
          const isInvalidWue = metric.code === "wue_15m" && value !== null && value < 0;
          add(metric.code, metric.label, metric.category, metric.unit, value, "bms_report", isInvalidWue ? "invalid" : "valid", isInvalidWue ? "WUE negativo na origem; excluído das correlações." : undefined, "quinze_minutos", at);
        }
        const dataHallColumns = ["artic", "warhol", "blue"].map(name => column([name])).filter(index => index > 0);
        const itPower = dataHallColumns.reduce((total, index) => total + (parseOperationNumber(row.getCell(index).value) || 0), 0);
        const siteColumn = column(["site"]);
        const sitePowerMw = siteColumn > 0 ? parseOperationNumber(row.getCell(siteColumn).value) : null;
        const sitePowerKw = sitePowerMw === null ? null : sitePowerMw * 1000;
        add("it_power_15m_kw", "Carga TI", "energia", "kW", itPower > 0 ? itPower : null, "calculated", itPower > 0 ? "valid" : "invalid", itPower > 0 ? "Soma Artic, Warhol e Blue." : "Sem carga TI válida.", "quinze_minutos", at);
        add("site_power_15m_kw", "Potência do site", "energia", "kW", sitePowerKw, "bms_report", sitePowerKw !== null ? "valid" : "invalid", sitePowerKw !== null ? "Origem em MW convertida para kW." : "Sem potência do site válida.", "quinze_minutos", at);
        add("pue_15m", "PUE de quinze minutos", "energia", "rácio", sitePowerKw !== null && itPower > 0 ? sitePowerKw / itPower : null, "calculated", sitePowerKw !== null && itPower > 0 ? "valid" : "invalid", sitePowerKw !== null && itPower > 0 ? "Potência do site (MW convertidos para kW) / soma Artic, Warhol e Blue." : "Sem potência válida para calcular PUE.", "quinze_minutos", at);
      }
    }
  }
  if (!readings.length) throw new TRPCError({ code: "BAD_REQUEST", message: "O relatório não contém leituras operacionais reconhecíveis." });
  const invalid = readings.filter(reading => reading.dataQuality === "invalid").length;
  return { measuredDate: dateKeyFromTimestamp(measuredAt), readings, qualityStatus: invalid ? "warning" as const : "valid" as const, qualityNotes: invalid ? `${invalid} leitura(s) importada(s) como inválida(s) e excluída(s) dos indicadores.` : null };
}

export function buildOperationScenario(assumptions: {
  tiEnergyKwh: number; baselinePue: number; baselineWaterM3: number; baselineMaintenanceEur: number; electricityPriceEurKwh: number; waterPriceEurM3: number; carbonFactorKgKwh: number; targetPue: number; targetWueLkwh: number; maintenanceEur: number; systemMix: Record<string, number>;
}) {
  const baselineSiteEnergyKwh = assumptions.tiEnergyKwh * assumptions.baselinePue;
  const projectedSiteEnergyKwh = assumptions.tiEnergyKwh * assumptions.targetPue;
  const projectedWaterM3 = assumptions.tiEnergyKwh * assumptions.targetWueLkwh / 1000;
  const baselineCarbonKg = baselineSiteEnergyKwh * assumptions.carbonFactorKgKwh;
  const projectedCarbonKg = projectedSiteEnergyKwh * assumptions.carbonFactorKgKwh;
  const baselineCostEur = baselineSiteEnergyKwh * assumptions.electricityPriceEurKwh + assumptions.baselineWaterM3 * assumptions.waterPriceEurM3 + assumptions.baselineMaintenanceEur;
  const projectedCostEur = projectedSiteEnergyKwh * assumptions.electricityPriceEurKwh + projectedWaterM3 * assumptions.waterPriceEurM3 + assumptions.maintenanceEur;
  return { baselineSiteEnergyKwh, projectedSiteEnergyKwh, energyDeltaKwh: projectedSiteEnergyKwh - baselineSiteEnergyKwh, projectedWaterM3, waterDeltaM3: projectedWaterM3 - assumptions.baselineWaterM3, baselineCarbonKg, projectedCarbonKg, carbonDeltaKg: projectedCarbonKg - baselineCarbonKg, baselineCostEur, projectedCostEur, costDeltaEur: projectedCostEur - baselineCostEur, pueDelta: assumptions.targetPue - assumptions.baselinePue, systemMix: assumptions.systemMix, formulaVersion: "operacao-v1" };
}

type OperationInvoiceType = "eletricidade" | "agua_potavel" | "agua_industrial" | "hvo" | "gasoleo" | "outro";
type OperationInvoiceImport = { invoiceType: OperationInvoiceType; supplier: string | null; invoiceNumber: string | null; periodStart: string; periodEnd: string; quantity: number; unit: string; totalCost: number | null; notes: string | null; rowNumber: number };

function normalizeInvoiceHeader(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-PT").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeInvoiceType(value: unknown): OperationInvoiceType | null {
  const normalized = normalizeInvoiceHeader(value).replace(/ /g, "_");
  const aliases: Record<string, OperationInvoiceType> = {
    eletricidade: "eletricidade", electricity: "eletricidade", energia: "eletricidade",
    agua_potavel: "agua_potavel", agua: "agua_potavel", potable_water: "agua_potavel",
    agua_industrial: "agua_industrial", industrial_water: "agua_industrial",
    hvo: "hvo", gasoleo: "gasoleo", diesel: "gasoleo", outro: "outro",
  };
  return aliases[normalized] || null;
}

export function parseOperationInvoicesWorkbook(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet("Faturas Operação") || workbook.worksheets.find(candidate => /faturas?|invoices?/i.test(candidate.name));
  if (!sheet) throw new TRPCError({ code: "BAD_REQUEST", message: "O ficheiro não contém a folha 'Faturas Operação'." });
  if (sheet.rowCount > 2001) throw new TRPCError({ code: "BAD_REQUEST", message: "A importação de faturas está limitada a 2 000 linhas." });
  const headerPositions = new Map<string, number>();
  const headerAliases: Record<string, string[]> = {
    invoiceType: ["tipo", "tipo de fatura", "tipo fatura"],
    supplier: ["fornecedor"],
    invoiceNumber: ["n da fatura", "numero da fatura", "fatura", "invoice number"],
    periodStart: ["inicio", "inicio do periodo", "periodo inicio"],
    periodEnd: ["fim", "fim do periodo", "periodo fim"],
    quantity: ["quantidade", "consumo"],
    unit: ["unidade"],
    totalCost: ["custo total eur", "custo total", "valor eur", "valor"],
    notes: ["notas", "observacoes"],
  };
  const headers = sheet.getRow(1);
  for (let column = 1; column <= headers.cellCount; column += 1) {
    const header = normalizeInvoiceHeader(headers.getCell(column).text || headers.getCell(column).value);
    for (const [field, aliases] of Object.entries(headerAliases)) if (aliases.includes(header)) headerPositions.set(field, column);
  }
  for (const required of ["invoiceType", "periodStart", "periodEnd", "quantity", "unit"]) {
    if (!headerPositions.has(required)) throw new TRPCError({ code: "BAD_REQUEST", message: `Falta a coluna obrigatória '${required === "invoiceType" ? "Tipo" : required === "periodStart" ? "Início" : required === "periodEnd" ? "Fim" : required === "quantity" ? "Quantidade" : "Unidade"}'.` });
  }
  const cellValue = (row: ExcelJS.Row, field: string) => headerPositions.has(field) ? row.getCell(headerPositions.get(field)!).value : null;
  const rows: OperationInvoiceImport[] = [];
  const errors: string[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const typeCell = cellValue(row, "invoiceType");
    const quantityCell = cellValue(row, "quantity");
    if (!String(typeCell ?? "").trim() && parseOperationNumber(quantityCell) === null) continue;
    const invoiceType = normalizeInvoiceType(typeCell);
    const start = parseReportDate(cellValue(row, "periodStart"));
    const end = parseReportDate(cellValue(row, "periodEnd"));
    const quantity = parseOperationNumber(quantityCell);
    const unit = String(cellValue(row, "unit") ?? "").trim();
    const totalCostValue = headerPositions.has("totalCost") ? parseOperationNumber(cellValue(row, "totalCost")) : null;
    if (!invoiceType || !start || !end || quantity === null || quantity < 0 || !unit) {
      errors.push(`Linha ${rowNumber}: indique Tipo, Início, Fim, Quantidade não negativa e Unidade válidos.`);
      continue;
    }
    const periodStart = dateKeyFromTimestamp(start.getTime());
    const periodEnd = dateKeyFromTimestamp(end.getTime());
    if (periodEnd < periodStart) { errors.push(`Linha ${rowNumber}: o fim do período é anterior ao início.`); continue; }
    rows.push({ invoiceType, supplier: String(cellValue(row, "supplier") ?? "").trim().slice(0, 255) || null, invoiceNumber: String(cellValue(row, "invoiceNumber") ?? "").trim().slice(0, 120) || null, periodStart, periodEnd, quantity, unit: unit.slice(0, 50), totalCost: totalCostValue === null || totalCostValue < 0 ? null : totalCostValue, notes: String(cellValue(row, "notes") ?? "").trim().slice(0, 5000) || null, rowNumber });
  }
  if (errors.length) throw new TRPCError({ code: "BAD_REQUEST", message: `${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` Mais ${errors.length - 5} linha(s) com erro.` : ""}` });
  if (!rows.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Não foram encontradas faturas válidas para importar." });
  return rows;
}

function getSafePdfFilename(value: string) {
  const filename = value.trim();
  if (!filename.toLowerCase().endsWith(".pdf") || /[\\/\r\n\0]/.test(filename) || filename.length > 255) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Indique um nome de ficheiro PDF válido." });
  }
  return filename;
}

// Helper: check if user can submit forms (ee or rap)
function canSubmitForms(role: string) {
  return role === "ee" || role === "rap" || role === "admin" || role === "dono_obra";
}

type KpiWriteMode = "draft" | "submit" | "correct" | "import_draft" | "import_submit";
type KpiValueInput = { metricId: number; value: string };

async function resolveKpiContribution(user: any, database: any, projectId: number, requestedCompanyId: number) {
  if (!Number.isSafeInteger(requestedCompanyId) || requestedCompanyId < 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione uma empresa válida para os KPI." });
  const assigned = await database.execute(sql`SELECT pc.companyId FROM project_companies pc JOIN companies c ON c.id = pc.companyId WHERE pc.projectId = ${projectId} AND pc.companyId = ${requestedCompanyId} AND c.companyType IN ('ee', 'ee_partner') LIMIT 1`);
  if (!(assigned as any)[0]?.length) throw new TRPCError({ code: "FORBIDDEN", message: "A empresa não está atribuída ao projeto seleccionado." });
  if (user.role === "ee_partner") {
    if (!user.companyId || requestedCompanyId !== user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Uma EEP só pode gerir os seus próprios KPI." });
    const profile = await getActivePartnerProfile(user, "kpi");
    return { companyId: user.companyId, parentCompanyId: profile!.parentCompanyId, sourceType: "ee_partner" as const };
  }
  if (user.role === "ee") {
    if (!user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "EE sem empresa associada." });
    if (requestedCompanyId === user.companyId) return { companyId: user.companyId, parentCompanyId: user.companyId, sourceType: "ee" as const };
    const partners = await database.execute(sql`SELECT companyId FROM partner_company_profiles WHERE companyId = ${requestedCompanyId} AND parentCompanyId = ${user.companyId} AND active = 1 LIMIT 1`);
    if (!(partners as any)[0]?.length) throw new TRPCError({ code: "FORBIDDEN", message: "A EE só pode corrigir contributos KPI das suas EEP." });
    return { companyId: requestedCompanyId, parentCompanyId: user.companyId, sourceType: "ee_partner" as const };
  }
  if (!isAdminOrDono(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para gerir KPI." });
  const partner = await database.execute(sql`SELECT parentCompanyId FROM partner_company_profiles WHERE companyId = ${requestedCompanyId} AND active = 1 LIMIT 1`);
  return { companyId: requestedCompanyId, parentCompanyId: (partner as any)[0]?.[0]?.parentCompanyId || requestedCompanyId, sourceType: (partner as any)[0]?.[0] ? "ee_partner" as const : "ee" as const };
}

async function writeKpiSubmission(params: { user: any; database: any; projectId: number; weekNumber: number; weekYear: number; contribution: { companyId: number; parentCompanyId: number | null; sourceType: "ee" | "ee_partner" }; values: KpiValueInput[]; mode: KpiWriteMode; completeWeekSnapshot?: boolean; }) {
  const { user, database, projectId, weekNumber, weekYear, contribution, mode } = params;
  const suppliedMetricIds = params.values.map(row => Number(row.metricId));
  if (suppliedMetricIds.some(metricId => !Number.isInteger(metricId) || metricId < 1) || new Set(suppliedMetricIds).size !== suppliedMetricIds.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cada métrica KPI só pode ser indicada uma vez." });
  }
  const valuesByMetric = new Map<number, string>();
  for (const row of params.values) { const value = String(row.value ?? "").trim(); if (value) valuesByMetric.set(Number(row.metricId), value); }
  if (valuesByMetric.size === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Preencha pelo menos um valor KPI." });
  if (suppliedMetricIds.length > 100) throw new TRPCError({ code: "BAD_REQUEST", message: "O limite é de 100 métricas por submissão." });
  const metricsResult = await database.execute(sql`SELECT id FROM kpi_metrics WHERE active = 1 AND inputType = 'manual'`);
  const activeMetricIds: number[] = ((metricsResult as any)[0] || []).map((metric: any) => Number(metric.id));
  const activeMetricSet = new Set(activeMetricIds);
  if (suppliedMetricIds.some(metricId => !activeMetricSet.has(metricId))) throw new TRPCError({ code: "BAD_REQUEST", message: "O ficheiro inclui uma métrica KPI inactiva ou inexistente." });
  if (params.completeWeekSnapshot && (suppliedMetricIds.length !== activeMetricIds.length || activeMetricIds.some(metricId => !suppliedMetricIds.includes(metricId)))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O registo manual deve incluir todos os KPI activos da semana." });
  }
  const actorName = getUserDisplayName(user);
  const action = mode === "draft" || mode === "import_draft" ? "draft_saved" : mode === "correct" ? "corrected" : mode === "import_submit" ? "imported" : "submitted";
  const finalStatus = mode === "draft" || mode === "import_draft" ? "draft" : contribution.sourceType === "ee_partner" ? "partial" : "submitted";
  const result = await database.transaction(async (tx: any) => {
    const existingRows = await tx.execute(sql`SELECT id, userId, parentCompanyId, sourceType, status FROM kpi_submissions WHERE projectId = ${projectId} AND companyId = ${contribution.companyId} AND weekNumber = ${weekNumber} AND weekYear = ${weekYear} LIMIT 1`);
    const existing = (existingRows as any)[0]?.[0] as any;
    let submissionId: number;
    let previousValues: any[] = [];
    if (existing) {
      const isOriginalAuthor = Number(existing.userId) === Number(user.id);
      const isParentEe = user.role === "ee" && Number(existing.parentCompanyId) === Number(user.companyId) && existing.sourceType === "ee_partner";
      if (!isOriginalAuthor && !isParentEe && !isAdminOrDono(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Só o autor pode editar este KPI; a EE pode corrigir contributos das suas EEP." });
      if ((mode === "draft" || mode === "import_draft") && existing.status !== "draft") throw new TRPCError({ code: "CONFLICT", message: "Esta semana já foi submetida. Use a correção auditável para alterar os valores." });
      if (mode === "correct" && existing.status === "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Este registo ainda é um rascunho; guarde-o ou submeta-o normalmente." });
      submissionId = Number(existing.id);
      const previousRows = await tx.execute(sql`SELECT metricId, value FROM kpi_values WHERE submissionId = ${submissionId}`);
      previousValues = (previousRows as any)[0] || [];
      await tx.execute(sql`DELETE FROM kpi_values WHERE submissionId = ${submissionId}`);
      const preserveAuthor = mode === "correct" && !isOriginalAuthor;
      await tx.execute(sql`UPDATE kpi_submissions SET userId = ${preserveAuthor ? existing.userId : user.id}, parentCompanyId = ${contribution.parentCompanyId}, sourceType = ${contribution.sourceType}, status = ${finalStatus}, updatedAt = NOW() WHERE id = ${submissionId}`);
    } else {
      const inserted = await tx.execute(sql`INSERT INTO kpi_submissions (projectId, companyId, parentCompanyId, sourceType, userId, weekNumber, weekYear, status) VALUES (${projectId}, ${contribution.companyId}, ${contribution.parentCompanyId}, ${contribution.sourceType}, ${user.id}, ${weekNumber}, ${weekYear}, ${finalStatus})`);
      submissionId = Number((inserted as any)[0].insertId);
    }
    for (const [metricId, value] of Array.from(valuesByMetric.entries())) await tx.execute(sql`INSERT INTO kpi_values (submissionId, metricId, value) VALUES (${submissionId}, ${metricId}, ${value})`);
    const currentValues = Array.from(valuesByMetric.entries()).map(([metricId, value]) => ({ metricId, value }));
    const summary = action === "corrected" ? `${actorName} corrigiu os KPI da semana ${weekNumber}/${weekYear}.` : action === "draft_saved" ? `${actorName} guardou um retrato completo dos KPI da semana ${weekNumber}/${weekYear}.` : action === "imported" ? `${actorName} importou KPI da semana ${weekNumber}/${weekYear}.` : `${actorName} submeteu KPI da semana ${weekNumber}/${weekYear}.`;
    await tx.execute(sql`INSERT INTO kpi_submission_changes (submissionId, action, actorId, actorName, summary, changedValues) VALUES (${submissionId}, ${action}, ${user.id}, ${actorName}, ${summary}, ${JSON.stringify({ previous: previousValues, current: currentValues, completeWeekSnapshot: !!params.completeWeekSnapshot })})`);
    return { submissionId, currentValueCount: currentValues.length };
  });
  await db.insertAuditLog(user.id, actorName, `kpi_submission_${action}`, "kpi_submissions", result.submissionId, null, JSON.stringify({ projectId, companyId: contribution.companyId, weekNumber, weekYear, values: result.currentValueCount, completeWeekSnapshot: !!params.completeWeekSnapshot }));
  return { submissionId: result.submissionId, status: finalStatus, sourceType: contribution.sourceType, action };
}

async function archiveKpiSubmissionWhenFinal(projectId: number, contribution: { companyId: number; parentCompanyId: number | null; sourceType: "ee" | "ee_partner" }, weekNumber: number, weekYear: number, submissionId: number, values: KpiValueInput[], userId: number) {
  try {
    const { archiveDocument } = await import("./archive-provider");
    const [project, company] = await Promise.all([db.getProjectById(projectId), db.getCompanyById(contribution.companyId)]);
    await archiveDocument("kpi", project?.code || "UNKNOWN", weekYear, { submissionId, projectId, companyId: contribution.companyId, parentCompanyId: contribution.parentCompanyId, sourceType: contribution.sourceType, weekNumber, weekYear, values, userId }, { weekNumber, weekYear, companyId: contribution.companyId, companyName: company?.name || null });
  } catch (error) { console.warn("KPI archive failed (non-fatal):", error); }
}

// Helper: check if user can review forms (raa, admin, dono_obra)
function canReview(role: string) {
  return role === "raa" || role === "admin" || role === "dono_obra";
}

type ImportDestination = "review" | "historical";

const importedResponseSchema = z.object({
  measureId: z.number().int().positive(),
  status: z.enum(["I", "C", "NC", "NA"]),
  observations: z.string().max(10000).nullable().optional(),
});

const importedImageSchema = z.object({
  fileKey: z.string().min(1).max(500),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  page: z.number().int().min(0).optional(),
});

function getImportedDocumentMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  throw new TRPCError({ code: "BAD_REQUEST", message: "Apenas ficheiros PDF ou Word (.docx) são permitidos." });
}

function getIsoWeekDateRange(weekNumber: number, year: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (weekNumber - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const format = (date: Date) => `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
  return { start: format(monday), end: format(sunday) };
}

async function assertImportPermission(user: any, projectId: number, companyId: number, destination: ImportDestination) {
  if (destination === "review" && !canSubmitForms(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para submeter fichas para revisão." });
  }
  if (destination === "historical" && user.role !== "admin" && user.role !== "raa") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores e RAA podem registar fichas como histórico aprovado." });
  }

  const project = await db.getProjectById(projectId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projecto não encontrado." });

  if (user.role !== "admin" && user.role !== "dono_obra") {
    if (project.code === "SIN01") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso a este projecto." });
    }
    const userProjects = await db.getUserProjects(user.id);
    const companyProjects = user.companyId ? await db.getProjectsForCompany(user.companyId) : [];
    const allowedProjectIds = new Set([
      ...userProjects.map((item: any) => item.projectId),
      ...companyProjects.map((item: any) => item.projectId),
    ]);
    if (!allowedProjectIds.has(projectId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso ao projecto seleccionado." });
    }
  }

  if ((user.role === "ee" || user.role === "rap") && user.companyId !== companyId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Só pode importar fichas da sua empresa." });
  }

  const projectCompanies = await db.getProjectCompanies(projectId);
  if (!projectCompanies.some((item: any) => item.companyId === companyId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A empresa seleccionada não está associada a este projecto." });
  }

  return project;
}

export const appRouter = router({
  system: systemRouter,

  phaseEvidence: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number(), measureId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        await assertProjectModuleAccess(ctx.user, input.projectId, "timeline");
        return await db.getPhaseEvidence(input.projectId, input.measureId);
      }),

    addComment: protectedProcedure
      .input(z.object({ projectId: z.number(), measureId: z.number(), content: z.string().min(1), referenceYear: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão" });
        }
        const result = await db.addPhaseEvidence({
          measureId: input.measureId,
          projectId: input.projectId,
          type: "comment",
          content: input.content,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || "Utilizador",
          referenceYear: input.referenceYear ?? null,
        });
        return result;
      }),

    uploadFile: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        measureId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        data: z.string(), // base64
        isPhoto: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão" });
        }
        // Security: validate file type and size
        if (!ALLOWED_FILE_TYPES.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de ficheiro não permitido" });
        if (input.data.length > MAX_FILE_SIZE_B64) throw new TRPCError({ code: "BAD_REQUEST", message: "Ficheiro demasiado grande (máx. 10MB)" });
        const buffer = Buffer.from(input.data, "base64");
        // Security: sanitize file content
        const sanitizeResult = await sanitizeFile(buffer, input.mimeType, input.filename);
        await logFileUpload(ctx.user.id, input.filename, input.mimeType, sanitizeResult.safe, sanitizeResult.threats, "phase-evidence");
        if (!sanitizeResult.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult.threats[0]}` });
        }
        const ext = input.filename.split(".").pop() || "bin";
        const timestamp = Date.now();
        const fileKey = `phase-evidence/${input.projectId}/${input.measureId}/${timestamp}.${ext}`;
        const { key, url } = await storagePut(fileKey, buffer, input.mimeType);

        const result = await db.addPhaseEvidence({
          measureId: input.measureId,
          projectId: input.projectId,
          type: input.isPhoto ? "photo" : "file",
          content: url,
          fileKey: key,
          filename: input.filename,
          mimeType: input.mimeType,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || "Utilizador",
        });
        return { id: result.id, url, filename: input.filename };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deletePhaseEvidence(input.id);
        return { success: true };
      }),
  }),

  appSettings: router({
    get: protectedProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) return null;
        const rows = await database.execute(sql`SELECT value FROM app_settings WHERE \`key\` = ${input.key}`);
        return (rows as any)?.[0]?.[0]?.value || null;
      }),
    getAll: protectedProcedure
      .query(async () => {
        const database = await db.getDb();
        if (!database) return {};
        const rows = await database.execute(sql`SELECT \`key\`, value FROM app_settings`);
        const result: Record<string, string> = {};
        for (const r of (rows as any)?.[0] || []) {
          result[r.key] = r.value;
        }
        return result;
      }),
    update: protectedProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await database.execute(sql`INSERT INTO app_settings (\`key\`, value) VALUES (${input.key}, ${input.value}) ON DUPLICATE KEY UPDATE value = ${input.value}`);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ key: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Delete the key and its associated _position and _page keys
        await database.execute(sql`DELETE FROM app_settings WHERE \`key\` IN (${input.key}, ${input.key + "_position"}, ${input.key + "_page"})`);
        return { success: true };
      }),
  }),

  auth: router({
    me: publicProcedure.query((opts) => {
      const u = opts.ctx.user;
      if (!u) return null;
      const { passwordHash, totpSecret, ...safe } = u as any;
      return { ...safe, passwordHash: !!passwordHash, totpEnabled: !!(u as any).totpEnabled };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // ─── Login with email + password ────────────────────────────────────────
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();
        const existingUsers = await db.getAllUsers();
        const user = existingUsers.find((u) => u.email?.toLowerCase().trim() === email);
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou palavra-passe incorretos." });
        }
        if ((user as any).accountStatus === "pending") {
          throw new TRPCError({ code: "FORBIDDEN", message: "A sua conta está pendente de aprovação. Contacte apoioamb@startcampus.pt" });
        }
        if ((user as any).accountStatus === "rejected") {
          throw new TRPCError({ code: "FORBIDDEN", message: "O seu pedido de acesso foi rejeitado. Contacte apoioamb@startcampus.pt" });
        }
        // Verify password
        const passwordHash = (user as any).passwordHash;
        if (!passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Conta sem palavra-passe definida. Contacte o administrador." });
        }
        const passwordValid = await bcrypt.compare(input.password, passwordHash);
        if (!passwordValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou palavra-passe incorretos." });
        }
        // Check if 2FA is enabled
        if ((user as any).totpEnabled) {
          return { success: true, requires2FA: true, userId: user.id, mustChangePassword: !!(user as any).mustChangePassword };
        }
        // Create session
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || email });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { success: true, requires2FA: false, userId: user.id, mustChangePassword: !!(user as any).mustChangePassword };
      }),

    // ─── Forgot Password ─────────────────────────────────────────────────
    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [user] = await database.select().from(schema.users).where(eq(schema.users.email, input.email.toLowerCase().trim())).limit(1);
        if (!user) return { success: true, message: "Se o email existir no sistema, o administrador será notificado. Contacte apoioamb@startcampus.pt" };
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const expiry = Date.now() + 3600000;
        await database.update(schema.users).set({ passwordResetToken: token, passwordResetExpiry: expiry }).where(eq(schema.users.id, user.id));
        // Password reset token generated
        return { success: true, message: "Pedido de recuperação registado. Contacte apoioamb@startcampus.pt para receber as instruções de reset." };
      }),
    // ─── Reset Password with Token ──────────────────────────────────────
    resetPasswordWithToken: publicProcedure
      .input(z.object({ email: z.string().email(), token: z.string(), newPassword: z.string().min(8) }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [user] = await database.select().from(schema.users).where(eq(schema.users.email, input.email.toLowerCase().trim())).limit(1);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador não encontrado" });
        const u = user as any;
        if (!u.passwordResetToken || u.passwordResetToken !== input.token) throw new TRPCError({ code: "BAD_REQUEST", message: "Token inválido" });
        if (u.passwordResetExpiry && Date.now() > u.passwordResetExpiry) throw new TRPCError({ code: "BAD_REQUEST", message: "Token expirado" });
        const hash = await bcrypt.hash(input.newPassword, 10);
        await database.update(schema.users).set({ passwordHash: hash, mustChangePassword: 0, passwordResetToken: null, passwordResetExpiry: null }).where(eq(schema.users.id, user.id));
        return { success: true };
      }),
    // ─── Verify 2FA code ────────────────────────────────────────────────────
    verify2FA: publicProcedure
      .input(z.object({ userId: z.number(), code: z.string().length(6) }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(input.userId);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        const totpSecret = (user as any).totpSecret;
        if (!totpSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "2FA não configurado." });
        const totp = new TOTP({ secret: Secret.fromBase32(totpSecret), algorithm: "SHA1", digits: 6, period: 30 });
        const valid = totp.validate({ token: input.code, window: 1 }) !== null;
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido. Tente novamente." });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || user.email || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { success: true, mustChangePassword: !!(user as any).mustChangePassword };
      }),

    // ─── Register (creates pending account) ─────────────────────────────────
    register: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(1), companyName: z.string().optional() }))
      .mutation(async ({ input }) => {
        const email = input.email.toLowerCase().trim();
        const existingUsers = await db.getAllUsers();
        if (existingUsers.find((u) => u.email?.toLowerCase().trim() === email)) {
          return { success: true, message: "Conta criada com sucesso. Aguarde aprovação do administrador." };
        }
        const openId = `email_${email.replace(/[^a-z0-9]/g, "_")}`;
        const passwordHash = await bcrypt.hash(input.password, 10);
        const displayName = input.companyName ? `${input.name} (${input.companyName})` : input.name;
        await db.upsertUser({ openId, name: displayName, email, loginMethod: "email", role: "user" });
        const registeredUser = await db.getUserByOpenId(openId);
        const invitationAccepted = !!registeredUser?.companyId && registeredUser.role !== "user";
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET passwordHash = ${passwordHash}, mustChangePassword = 0, accountStatus = ${invitationAccepted ? "active" : "pending"} WHERE openId = ${openId}`);
        }
        return { success: true, message: invitationAccepted ? "Convite aceite. Já pode iniciar sessão." : "Conta criada com sucesso. Aguarde aprovação do administrador." };
      }),

    // ─── Change password ────────────────────────────────────────────────────
    changePassword: partnerAllowedProcedure
      .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        const passwordHash = (user as any).passwordHash;
        if (passwordHash) {
          const valid = await bcrypt.compare(input.currentPassword, passwordHash);
          if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Palavra-passe actual incorreta." });
        }
        const newHash = await bcrypt.hash(input.newPassword, 10);
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET passwordHash = ${newHash}, mustChangePassword = 0 WHERE id = ${ctx.user.id}`);
        }
        return { success: true };
      }),

    // ─── Setup 2FA ──────────────────────────────────────────────────────────
    setup2FA: partnerAllowedProcedure.mutation(async ({ ctx }) => {
      const secret = new Secret({ size: 20 });
      const totp = new TOTP({ issuer: "Controlo Ambiental", label: ctx.user.email || ctx.user.name || "user", secret, algorithm: "SHA1", digits: 6, period: 30 });
      const uri = totp.toString();
      const qrCode = await QRCode.toDataURL(uri);
      // Save secret temporarily (not enabled yet)
      const database = await db.getDb();
      if (database) {
        await database.execute(sql`UPDATE users SET totpSecret = ${secret.base32} WHERE id = ${ctx.user.id}`);
      }
      return { qrCode, secret: secret.base32, uri };
    }),

    // ─── Confirm 2FA setup ──────────────────────────────────────────────────
    confirm2FA: partnerAllowedProcedure
      .input(z.object({ code: z.string().length(6) }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        const totpSecret = (user as any).totpSecret;
        if (!totpSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "Configure primeiro o 2FA." });
        const totp = new TOTP({ secret: Secret.fromBase32(totpSecret), algorithm: "SHA1", digits: 6, period: 30 });
        const valid = totp.validate({ token: input.code, window: 1 }) !== null;
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido." });
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET totpEnabled = 1 WHERE id = ${ctx.user.id}`);
        }
        return { success: true };
      }),

    // ─── Disable 2FA ────────────────────────────────────────────────────────
    disable2FA: partnerAllowedProcedure.mutation(async ({ ctx }) => {
      const database = await db.getDb();
      if (database) {
        await database.execute(sql`UPDATE users SET totpEnabled = 0, totpSecret = NULL WHERE id = ${ctx.user.id}`);
      }
      return { success: true };
    }),

    // ─── Admin: reset user password ─────────────────────────────────────────
    adminResetPassword: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const tempPassword = Math.random().toString(36).slice(-8);
        const hash = await bcrypt.hash(tempPassword, 10);
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET passwordHash = ${hash}, mustChangePassword = 1 WHERE id = ${input.userId}`);
        }
        return { success: true, tempPassword };
      }),
    // ─── Admin: delete non-admin user ───────────────────────────────────────
    deleteUser: protectedProcedure
      .input(z.object({ userId: z.number(), confirmName: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const allUsers = await db.getAllUsers();
        const targetUser = allUsers.find(u => u.id === input.userId);
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador nao encontrado" });
        if (targetUser.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Nao e possivel eliminar um administrador" });
        if ((targetUser.name || "").toLowerCase().trim() !== input.confirmName.toLowerCase().trim()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nome nao corresponde" });
        }
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`DELETE FROM users WHERE id = ${input.userId}`);
        }
        return { success: true };
      }),

    // ─── Admin: approve/reject pending accounts ─────────────────────────────
    approveAccount: protectedProcedure
      .input(z.object({ userId: z.number(), approve: z.boolean(), role: z.string().optional(), companyId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const status = input.approve ? "active" : "rejected";
        const database = await db.getDb();
        if (database) {
          const role = input.role || "user";
          const companyId = input.companyId || null;
          await database.execute(sql`UPDATE users SET accountStatus = ${status}, role = ${role}, companyId = ${companyId} WHERE id = ${input.userId}`);
        }
        return { success: true };
      }),

    // ─── List pending accounts (for admin) ──────────────────────────────────
    pendingAccounts: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") return [];
      const database = await db.getDb();
      if (!database) return [];
      const rows = await database.execute(sql`SELECT id, name, email, createdAt FROM users WHERE accountStatus = 'pending'`);
      return (rows as any)?.[0] || [];
    }),

  }),

  // ─── Companies ───────────────────────────────────────────────────────────
  companies: router({
    list: protectedProcedure.query(async () => {
      const [companies, partnerProfiles] = await Promise.all([db.getAllCompanies(), db.getPartnerCompanyProfiles()]);
      return companies.map(company => {
        const profile = partnerProfiles.find(item => item.companyId === company.id);
        const parent = profile ? companies.find(item => item.id === profile.parentCompanyId) : null;
        return { ...company, parentCompanyId: profile?.parentCompanyId ?? null, parentCompanyName: parent?.shortName ?? parent?.name ?? null, allowKpi: !!profile?.allowKpi, allowWaste: !!profile?.allowWaste };
      });
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCompanyById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        name: z.string().trim().min(2), shortName: z.string().trim().min(2),
        companyType: z.enum(["ee", "ee_partner", "rap", "dono_obra", "raa", "pm", "observador"]).default("ee"),
        projectIds: z.array(z.number().int().positive()).min(1, "Seleccione pelo menos um projecto."),
        parentCompanyId: z.number().int().positive().optional(), allowKpi: z.boolean().default(false), allowWaste: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        assertAdminOnly(ctx.user);
        if (input.companyType === "ee_partner") {
          if (!input.parentCompanyId || (!input.allowKpi && !input.allowWaste)) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma EEP exige EE principal e acesso a KPI e/ou Resíduos." });
          const parent = await db.getCompanyById(input.parentCompanyId);
          const allowed = await db.getProjectsForCompany(input.parentCompanyId);
          const allowedIds = new Set(allowed.map(item => item.projectId));
          if (parent?.companyType !== "ee" || input.projectIds.some(id => !allowedIds.has(id))) throw new TRPCError({ code: "FORBIDDEN", message: "A EEP só pode receber projectos da EE principal seleccionada." });
        }
        const created = await db.createCompany({ name: input.name, shortName: input.shortName, companyType: input.companyType });
        await db.setCompanyProjects(created.id, input.projectIds);
        if (input.companyType === "ee_partner") await db.upsertPartnerCompanyProfile({ companyId: created.id, parentCompanyId: input.parentCompanyId!, allowKpi: input.allowKpi, allowWaste: input.allowWaste, active: true, configuredBy: ctx.user.id });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "company_created", "companies", created.id, null, JSON.stringify(input));
        return created;
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), shortName: z.string().optional(), active: z.number().optional(), companyType: z.enum(["ee", "ee_partner", "rap", "dono_obra", "raa", "pm", "observador"]).optional() }))
      .mutation(async ({ input, ctx }) => {
        assertAdminOnly(ctx.user);
        const { id, ...data } = input;
        const existing = await db.getCompanyById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
        if (data.companyType && data.companyType !== existing.companyType) throw new TRPCError({ code: "BAD_REQUEST", message: "O tipo de empresa não pode ser alterado. Crie a empresa com o tipo correcto." });
        await db.updateCompany(id, data);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "company_updated", "companies", id, JSON.stringify(existing), JSON.stringify(data));
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        assertAdminOnly(ctx.user);
        const database = await db.getDb();
        if (database) {
          const counts = await database.execute(sql`SELECT
            (SELECT COUNT(*) FROM weekly_submissions WHERE companyId = ${input.id} AND status <> 'deleted') AS weeklyCount,
            (SELECT COUNT(*) FROM waste_egars WHERE companyId = ${input.id}) AS wasteCount,
            (SELECT COUNT(*) FROM kpi_submissions WHERE companyId = ${input.id}) AS kpiCount,
            (SELECT COUNT(*) FROM partner_company_profiles WHERE parentCompanyId = ${input.id} AND active = 1) AS childCount`);
          const row = ((counts as any)?.[0]?.[0] ?? {}) as Record<string, number>;
          if (Number(row.weeklyCount) + Number(row.wasteCount) + Number(row.kpiCount) > 0) throw new TRPCError({ code: "CONFLICT", message: "A empresa tem dados históricos. Desactive-a em vez de a eliminar." });
          if (Number(row.childCount) > 0) throw new TRPCError({ code: "CONFLICT", message: "A empresa tem EEP associadas. Reatribua ou desactive essas EEP antes de eliminar." });
          await database.transaction(async tx => {
            await tx.execute(sql`DELETE FROM project_users WHERE userId IN (SELECT id FROM users WHERE companyId = ${input.id})`);
            await tx.execute(sql`DELETE FROM partner_access_profiles WHERE userId IN (SELECT id FROM users WHERE companyId = ${input.id})`);
            await tx.execute(sql`UPDATE users SET companyId = NULL, role = 'user' WHERE companyId = ${input.id}`);
            await tx.execute(sql`DELETE FROM invitations WHERE companyId = ${input.id}`);
            await tx.execute(sql`DELETE FROM partner_company_profiles WHERE companyId = ${input.id}`);
            await tx.execute(sql`DELETE FROM project_companies WHERE companyId = ${input.id}`);
            await tx.execute(sql`DELETE FROM companies WHERE id = ${input.id}`);
          });
          await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "company_deleted", "companies", input.id, null, null);
        }
        return { success: true };
      }),
  }),

  // ─── Users Management (Admin / Dono de Obra) ──────────────────────────────
  users: router({
    list: adminProcedure.query(async ({ ctx }) => {
      assertAdminOnly(ctx.user);
      return db.getAllUsers();
    }),
    assignCompany: adminProcedure
      .input(z.object({ userId: z.number(), companyId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        assertAdminOnly(ctx.user);
        const userBefore = await db.getUserById(input.userId);
        if (!userBefore) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador não encontrado." });
        const assignedCompany = input.companyId ? await db.getCompanyById(input.companyId) : null;
        if (input.companyId && !assignedCompany) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
        await db.updateUserCompany(input.userId, input.companyId);
        // Auto-assign role based on company type
        if (input.companyId) {
          // Never demote an admin when assigning company
          const targetUser = await db.getUserById(input.userId);
          if (targetUser?.role !== "admin" && assignedCompany) {
            const roleMap: Record<string, string> = {
              ee: "ee",
              ee_partner: "ee_partner",
              rap: "rap",
              dono_obra: "dono_obra",
              raa: "raa",
              pm: "pm",
              observador: "observador",
            };
            const newRole = (roleMap[assignedCompany.companyType] || "user") as "user" | "admin" | "ee" | "ee_partner" | "raa" | "rap" | "dono_obra" | "observador" | "pm";
            await db.updateUserRole(input.userId, newRole);
          }
        }
        const userAfter = await db.getUserById(input.userId);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "user_company_assigned", "users", input.userId, JSON.stringify({ companyId: userBefore.companyId ?? null, role: userBefore.role }), JSON.stringify({ companyId: userAfter?.companyId ?? null, role: userAfter?.role ?? null }));
        return { success: true };
      }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "ee", "ee_partner", "raa", "rap", "dono_obra", "observador", "pm"]) }))
      .mutation(async ({ input, ctx }) => {
        assertAdminOnly(ctx.user);
        // Only admin can promote to admin or dono_obra
        if ((input.role === "admin" || input.role === "dono_obra") && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem atribuir o papel de Admin ou Dono de Obra." });
        }
        // Prevent demoting an admin unless the requester is also an admin
        const targetUser = await db.getUserById(input.userId);
        if (targetUser?.role === "admin" && input.role !== "admin") {
          // Only admins can manage other admin roles
          throw new TRPCError({ code: "FORBIDDEN", message: "Não é possível remover o papel de Admin a outro administrador." });
        }
        // Prevent dono_obra from changing another dono_obra
        if (targetUser?.role === "dono_obra" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem alterar o papel de um Dono de Obra." });
        }
        await db.updateUserRole(input.userId, input.role);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "user_role_updated", "users", input.userId, JSON.stringify({ role: targetUser?.role ?? null }), JSON.stringify({ role: input.role }));
        return { success: true };
      }),
  }),

  // ─── EE Partner configuration ─────────────────────────────────────────────
  partners: router({
    myAccess: partnerAllowedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "ee_partner") return null;
      const profile = await getActivePartnerProfile(ctx.user);
      const [parentCompany, partnerCompany] = await Promise.all([
        db.getCompanyById(profile!.parentCompanyId),
        ctx.user.companyId ? db.getCompanyById(ctx.user.companyId) : Promise.resolve(undefined),
      ]);
      return {
        parentCompanyId: profile!.parentCompanyId,
        parentCompanyName: parentCompany?.shortName ?? parentCompany?.name ?? null,
        companyId: ctx.user.companyId,
        companyName: partnerCompany?.shortName ?? partnerCompany?.name ?? null,
        allowKpi: !!profile!.allowKpi,
        allowWaste: !!profile!.allowWaste,
        active: !!profile!.active,
      };
    }),
    list: adminProcedure.query(async () => {
      const [allUsers, allCompanies, profiles, assignments, allProjects] = await Promise.all([
        db.getAllUsers(),
        db.getAllCompanies(),
        db.getPartnerAccessProfiles(),
        db.getAllUserProjectAssignments(),
        db.getAllProjects(),
      ]);
      return allUsers.filter(user => user.role === "ee_partner").map(user => {
        const profile = profiles.find(item => item.userId === user.id);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          companyId: user.companyId,
          companyName: allCompanies.find(company => company.id === user.companyId)?.shortName ?? null,
          parentCompanyId: profile?.parentCompanyId ?? null,
          parentCompanyName: allCompanies.find(company => company.id === profile?.parentCompanyId)?.shortName ?? null,
          allowKpi: !!profile?.allowKpi,
          allowWaste: !!profile?.allowWaste,
          active: profile?.active ?? false,
          projectIds: assignments.filter(item => item.userId === user.id).map(item => item.projectId),
          projects: assignments.filter(item => item.userId === user.id).map(item => allProjects.find(project => project.id === item.projectId)).filter(Boolean),
        };
      });
    }),
    configure: adminProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        parentCompanyId: z.number().int().positive(),
        allowKpi: z.boolean(),
        allowWaste: z.boolean(),
        active: z.boolean().default(true),
        projectIds: z.array(z.number().int().positive()),
      }))
      .mutation(async ({ ctx, input }) => {
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser || targetUser.role !== "ee_partner") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione um utilizador com o papel EEP — Entidade Executante Parceira." });
        }
        if (!targetUser.companyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O parceiro deve estar associado à sua empresa subcontratada." });
        }
        const [partnerCompany, parentCompany, parentAssignments] = await Promise.all([
          db.getCompanyById(targetUser.companyId),
          db.getCompanyById(input.parentCompanyId),
          db.getProjectsForCompany(input.parentCompanyId),
        ]);
        if (partnerCompany?.companyType !== "ee_partner") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A empresa do utilizador deve ser do tipo EEP — Entidade Executante Parceira." });
        }
        if (parentCompany?.companyType !== "ee") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A empresa principal deve ser uma EE." });
        }
        const parentProjectIds = new Set(parentAssignments.map(item => item.projectId));
        if (input.projectIds.some(projectId => !parentProjectIds.has(projectId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Um parceiro não pode receber projectos fora do âmbito da EE principal." });
        }
        await db.upsertPartnerAccessProfile({
          userId: input.userId,
          parentCompanyId: input.parentCompanyId,
          allowKpi: input.allowKpi,
          allowWaste: input.allowWaste,
          active: input.active,
          configuredBy: ctx.user.id,
        });
        await db.setUserProjects(input.userId, input.projectIds);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "partner_access_configured", "users", input.userId, null, JSON.stringify(input));
        return { success: true };
      }),
  }),

  eepRequests: router({
    mine: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas uma EE pode submeter pedidos EEP." });
      return db.getEepRequests({ parentCompanyId: ctx.user.companyId });
    }),
    create: protectedProcedure.input(z.object({
      companyName: z.string().trim().min(2).max(255), shortName: z.string().trim().min(2).max(50),
      allowKpi: z.boolean(), allowWaste: z.boolean(), projectIds: z.array(z.number().int().positive()).min(1),
      users: z.array(z.object({ fullName: z.string().trim().min(2).max(255), email: z.string().email() })).min(1).max(20),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas uma EE pode submeter pedidos EEP." });
      if (!input.allowKpi && !input.allowWaste) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione acesso a KPI e/ou Resíduos." });
      const company = await db.getCompanyById(ctx.user.companyId);
      const allowed = await db.getProjectsForCompany(ctx.user.companyId);
      const allowedIds = new Set(allowed.map(item => item.projectId));
      if (company?.companyType !== "ee" || input.projectIds.some(id => !allowedIds.has(id))) throw new TRPCError({ code: "FORBIDDEN", message: "Só pode pedir EEP para projectos da sua EE." });
      const emails = input.users.map(user => user.email.toLowerCase().trim());
      if (new Set(emails).size !== emails.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Não repita o mesmo email no pedido." });
      const allUsers = await db.getAllUsers(); const allInvites = await db.getAllInvitations(); const allCompanies = await db.getAllCompanies();
      if (allCompanies.some(item => item.shortName.toLowerCase() === input.shortName.toLowerCase())) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma empresa com esta sigla." });
      if (emails.some(email => allUsers.some(user => user.email?.toLowerCase() === email) || allInvites.some(invite => invite.email.toLowerCase() === email && invite.status === "pending"))) throw new TRPCError({ code: "CONFLICT", message: "Um dos emails já tem conta ou convite pendente." });
      const requestId = await db.createEepRequest({ requestedByUserId: ctx.user.id, parentCompanyId: ctx.user.companyId, companyName: input.companyName, shortName: input.shortName, allowKpi: input.allowKpi, allowWaste: input.allowWaste, projectIdsJson: JSON.stringify(input.projectIds) }, input.users.map((user, index) => ({ fullName: user.fullName, email: emails[index] })));
      await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "eep_request_created", "eep_requests", requestId, null, JSON.stringify({ ...input, users: input.users.map(user => ({ ...user, email: user.email.toLowerCase().trim() })) }));
      return { success: true, requestId };
    }),
    list: adminProcedure.query(async () => db.getEepRequests()),
    approve: adminProcedure.input(z.object({ id: z.number().int().positive(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const request = await db.getEepRequestById(input.id); if (!request || request.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Pedido inexistente ou já decidido." });
      const users = await db.getEepRequestUsers(input.id); const allInvites = await db.getAllInvitations(); const allUsers = await db.getAllUsers(); const allCompanies = await db.getAllCompanies();
      if (allCompanies.some(item => item.shortName.toLowerCase() === request.shortName.toLowerCase())) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma empresa com esta sigla." });
      if (users.some(item => allUsers.some(user => user.email?.toLowerCase() === item.email) || allInvites.some(invite => invite.email.toLowerCase() === item.email && invite.status === "pending"))) throw new TRPCError({ code: "CONFLICT", message: "Um dos emails já tem conta ou convite pendente." });
      const result = await db.approveEepRequest(input.id, ctx.user.id, input.notes ?? null); if (!result) throw new TRPCError({ code: "CONFLICT", message: "O pedido já foi decidido." });
      await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "eep_request_approved", "eep_requests", input.id, null, JSON.stringify({ companyId: result.companyId }));
      return { success: true, companyId: result.companyId };
    }),
    reject: adminProcedure.input(z.object({ id: z.number().int().positive(), notes: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
      if (!await db.rejectEepRequest(input.id, ctx.user.id, input.notes)) throw new TRPCError({ code: "CONFLICT", message: "O pedido já foi decidido." });
      await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "eep_request_rejected", "eep_requests", input.id, null, input.notes);
      return { success: true };
    }),
  }),

  // ─── Invitations ────────────────────────────────────────────────────────────
  invitations: router({
    list: adminProcedure.query(async ({ ctx }) => {
      assertAdminOnly(ctx.user);
      const allInvitations = await db.getAllInvitations();
      const allCompanies = await db.getAllCompanies();
      return allInvitations.map((inv) => ({
        ...inv,
        companyName: allCompanies.find((c) => c.id === inv.companyId)?.shortName || "—",
      }));
    }),
    create: adminProcedure
      .input(z.object({
        email: z.string().email(),
        companyId: z.number(),
        role: z.enum(["user", "admin", "ee", "ee_partner", "raa", "rap", "dono_obra", "observador", "pm"]),
      }))
      .mutation(async ({ ctx, input }) => {
        assertAdminOnly(ctx.user);
        // Check if there's already a pending invitation for this email
        const normalizedEmail = input.email.toLowerCase().trim();
        const existing = await db.getPendingInvitationByEmail(normalizedEmail);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe um convite pendente para este email." });
        }
        const created = await db.createInvitation({
          email: normalizedEmail,
          companyId: input.companyId,
          role: input.role,
          invitedBy: ctx.user.id,
        });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "invitation_created", "invitations", (created as any)?.[0]?.insertId ?? null, null, JSON.stringify({ email: normalizedEmail, companyId: input.companyId, role: input.role }));
        // Send invitation email (async, don't block)
        try {
          const company = await db.getCompanyById(input.companyId);
          const roleLabels: Record<string, string> = {
            user: "Utilizador", admin: "Administrador", ee: "Entidade Executante", ee_partner: "EEP — Entidade Executante Parceira",
            raa: "RAA", rap: "RAP", dono_obra: "Dono de Obra", observador: "Observador",
          };
          sendInvitationEmail(
            normalizedEmail, null,
            company?.shortName || company?.name || "—",
            roleLabels[input.role] || input.role,
            ctx.user.name || ctx.user.email || "Admin"
          ).catch(() => {});
        } catch {}
        return { success: true, emailSent: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        assertAdminOnly(ctx.user);
        await db.deleteInvitation(input.id);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "invitation_deleted", "invitations", input.id, null, null);
        return { success: true };
      }),
  }),

  // ─── Sections & Measures ───────────────────────────────────────────────────
  sections: router({
    list: protectedProcedure.query(async () => {
      return db.getAllSections();
    }),
  }),

  measures: router({
    list: protectedProcedure.query(async () => {
      return db.getAllMeasures();
    }),
    bySection: protectedProcedure
      .input(z.object({ sectionId: z.number() }))
      .query(async ({ input }) => {
        return db.getMeasuresBySection(input.sectionId);
      }),
    create: protectedProcedure
      .input(z.object({
        number: z.string().min(1),
        description: z.string().min(1),
        responsible: z.string().default("DO"),
        sectionId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
       if (!isAdminOrDono(ctx.user.role)) {
         throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra" });
       }
       const id = await db.createMeasure(input);
       return { id };
     }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        number: z.string().optional(),
        description: z.string().optional(),
        responsible: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin pode editar medidas" });
        }
        await db.updateMeasure(input.id, { number: input.number, description: input.description, responsible: input.responsible });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin pode eliminar medidas" });
        }
        await db.deleteMeasure(input.id);
        return { success: true };
      }),
  }),

  // ─── Weekly Submissions ────────────────────────────────────────────────────
  submissions: router({
    // Create or get existing submission for a week
    createOrGet: protectedProcedure
      .input(z.object({ weekNumber: z.number(), weekYear: z.number(), weekStartDate: z.string(), weekEndDate: z.string(), projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!canSubmitForms(user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para criar fichas." });
        }
        if (!input.projectId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um projeto específico para criar uma ficha." });
        }
        await assertProjectModuleAccess(user, input.projectId, "ficha");
        if (!user.companyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Utilizador não está associado a nenhuma empresa." });
        }

        // Limit to 5 open drafts
        const drafts = await db.getDraftCountForCompany(user.companyId);
        if (drafts >= 5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Limite de 5 fichas em rascunho atingido. Submeta ou elimine fichas existentes." });
        }

        // Check if already exists
        const existing = await db.getSubmissionForWeek(user.companyId, input.weekNumber, input.weekYear, input.projectId);
        if (existing) return existing;

        // Create new
        const { id } = await db.createWeeklySubmission({
          companyId: user.companyId,
          projectId: input.projectId ?? null,
          weekNumber: input.weekNumber,
          weekYear: input.weekYear,
          weekStartDate: input.weekStartDate,
          weekEndDate: input.weekEndDate,
          createdBy: user.id,
        });

        // Pre-fill from previous week
        const latest = await db.getLatestSubmissionForCompany(user.companyId);
        if (latest) {
          const prevResponses = await db.getResponsesBySubmission(latest.id);
          if (prevResponses.length > 0) {
            await db.bulkUpsertResponses(
              id,
              prevResponses.map((r) => ({
                measureId: r.measureId,
                status: r.status,
                observations: r.observations ?? null,
              }))
            );
          }
        }

        return db.getSubmissionById(id);
      }),

    // Get submission by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (sub.projectId) await assertProjectModuleAccess(ctx.user, sub.projectId, "ficha");

        // RAA can see all, EE/RAP can only see own company
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return sub;
      }),

    // List submissions for current user's company
    mySubmissions: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return [];
      return db.getSubmissionsByCompany(ctx.user.companyId);
    }),

    // Admin/Dono/RAA: list all submissions
    listAll: protectedProcedure
      .input(z.object({ companyId: z.number().optional(), year: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (input?.companyId) {
          return db.getSubmissionsByCompany(input.companyId);
        }
        if (input?.year) {
          return db.getAllSubmissionsByYear(input.year);
        }
        return db.getAllSubmissions();
      }),

    // Submit (finalize) - EE/RAP can submit
    submit: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (sub.projectId) await assertProjectModuleAccess(ctx.user, sub.projectId, "ficha");
        // Only the creator or admin can submit
        if (!isAdminOrDono(ctx.user.role) && sub.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o criador ou admin pode submeter esta ficha." });
        }
        // Auto-fill NA for measures not relevant to this company type
        const company = await db.getCompanyById(sub.companyId);
        if (company && !isAdminOrDono(ctx.user.role)) {
          // Determine filter type based on user role or company type
          let filterType: string;
          if (ctx.user.role === "rap") {
            filterType = "RAP";
          } else {
            // Use company type for EE
            filterType = company.companyType.toUpperCase() === "RAP" ? "RAP" : "EE";
          }
          const allMeasures = await db.getAllMeasures();
          const nonRelevant = allMeasures.filter((m) => !m.responsible.toUpperCase().includes(filterType));
          if (nonRelevant.length > 0) {
            await db.bulkUpsertResponses(
              input.id,
              nonRelevant.map((m) => ({ measureId: m.id, status: "NA" as const, observations: null }))
            );
          }
        }
        await db.submitWeeklySubmission(input.id, ctx.user.id);
        // Send email notification to RAA users (async, don't block)
        try {
          const project = sub.projectId ? await db.getProjectById(sub.projectId) : null;
          const companyForNotif = sub.companyId ? await db.getCompanyById(sub.companyId) : null;
          // Use configured notification recipients for this project, fallback to all RAA/admin/DO
          let raaEmails: string[] = [];
          if (sub.projectId) {
            const recipients = await db.getNotificationRecipients(sub.projectId, "submission");
            raaEmails = recipients.filter((r: any) => r.userEmail).map((r: any) => r.userEmail!);
          }
          // Only send if there are configured recipients (no fallback = no spam)
          if (raaEmails.length > 0) {
            sendFichaSubmittedNotification(
              input.id, sub.weekNumber, sub.weekYear,
              companyForNotif?.shortName || "—", project?.code || "—", raaEmails
            ).catch(() => {});
          }
        } catch {}
        return { success: true };
      }),

    // Resubmit after rejection - EE/RAP can resubmit
    resubmit: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (sub.projectId) await assertProjectModuleAccess(ctx.user, sub.projectId, "ficha");
        if (sub.status !== "rejected") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Só fichas rejeitadas podem ser re-submetidas." });
        }
        // Only the creator or admin can resubmit
        if (!isAdminOrDono(ctx.user.role) && sub.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o criador ou admin pode resubmeter esta ficha." });
        }
        await db.resubmitSubmission(input.id, ctx.user.id);
        return { success: true };
      }),

    // Delete submission - only creator or admin can delete, only draft/rejected
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (sub.projectId) await assertProjectModuleAccess(ctx.user, sub.projectId, "ficha");
        // Non-admin users can only delete draft or rejected fichas
        if (!isAdminOrDono(ctx.user.role) && sub.status !== "draft" && sub.status !== "rejected") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Apenas fichas em rascunho ou rejeitadas podem ser eliminadas." });
        }
        // Only creator or admin can delete
        if (!isAdminOrDono(ctx.user.role) && sub.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o criador ou admin pode eliminar esta ficha." });
        }
        // Log the deletion before deleting
        const company = sub.companyId ? await db.getCompanyById(sub.companyId) : null;
        await db.createDeletionLog({
          submissionId: input.id,
          projectId: sub.projectId || null,
          weekNumber: sub.weekNumber,
          weekYear: sub.weekYear,
          companyId: sub.companyId,
          companyName: company?.shortName || null,
          createdBy: sub.createdBy || null,
          deletedBy: ctx.user.id,
          deletedByName: ctx.user.name || null,
          deletedByEmail: ctx.user.email || null,
        });
        await db.softDeleteWeeklySubmission(input.id, ctx.user.id);
        // Send email notification to the submitter
        try {
          if (sub.createdBy) {
            const creator = await db.getUserById(sub.createdBy);
            if (creator?.email) {
              const { sendFichaDeletedNotification } = await import("./email");
              await sendFichaDeletedNotification(
                creator.email,
                company?.shortName || "?",
                sub.weekNumber,
                sub.weekYear,
                ctx.user.name || ctx.user.email || "Admin",
                new Date().toLocaleString("pt-PT")
              );
            }
          }
        } catch (e) { console.error("Email notification failed:", e); }
        return { success: true };
      }),

    // Recover a soft-deleted submission - only creator or admin, within 21 days
    recover: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) {
          // Submission was permanently deleted before soft-delete was implemented
          // Mark the log as irrecoverable
          await db.markDeletionLogRecovered(input.id);
          throw new TRPCError({ code: "NOT_FOUND", message: "Esta ficha foi eliminada permanentemente e não pode ser recuperada." });
        }
        if (sub.status !== "deleted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ficha não está eliminada." });
        }
        // Check 21-day recovery window
        const deletedAt = sub.deletedAt;
        if (!deletedAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Data de eliminação não encontrada." });
        }
        const daysSinceDeletion = (Date.now() - deletedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceDeletion > 21) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O prazo de 21 dias para recuperação expirou." });
        }
        // Only creator or admin can recover
        if (!isAdminOrDono(ctx.user.role) && sub.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o criador ou admin pode recuperar esta ficha." });
        }
        await db.recoverWeeklySubmission(input.id);
        // Mark the deletion log as recovered
        await db.markDeletionLogRecovered(input.id);
        return { success: true };
      }),

    // Review (approve/reject) - RAA/Admin/Dono can review
    review: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        notes: z.string().nullable(),
        measureReviews: z.array(z.object({
          measureId: z.number(),
          verdict: z.enum(["ok", "nok"]),
          comment: z.string().nullable(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!canReview(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para rever fichas." });
        }
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // FLOW-04 FIX: Separation of duties — submitter cannot approve own ficha
        if (sub.createdBy === ctx.user.id || sub.submittedBy === ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Não pode aprovar uma ficha que criou ou submeteu. Separação de funções obrigatória." });
        }
        if (sub.status !== "submitted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Só fichas submetidas podem ser revistas." });
        }
        // Save per-measure reviews if provided
        if (input.measureReviews && input.measureReviews.length > 0) {
          await db.bulkUpsertMeasureReviews(input.id, ctx.user.id, input.measureReviews);
        }
        await db.reviewSubmission(input.id, ctx.user.id, input.status, input.notes);
        // Audit log
        db.insertAuditLog(ctx.user.id, ctx.user.name || ctx.user.email || null, `ficha_${input.status}`, "weekly_submissions", input.id, null, JSON.stringify({ weekNumber: sub.weekNumber, weekYear: sub.weekYear, notes: input.notes })).catch(() => {});
        // Send email notification to submitter (async, don't block)
        try {
          if (input.status === "approved" || input.status === "rejected") {
            const projectForNotif = sub.projectId ? await db.getProjectById(sub.projectId) : null;
            const submitterForNotif = sub.submittedBy ? await db.getUserById(sub.submittedBy) : null;
            if (submitterForNotif?.email) {
              sendFichaReviewedNotification(
                input.id, sub.weekNumber, sub.weekYear,
                projectForNotif?.code || "—",
                input.status as "approved" | "rejected",
                input.notes, submitterForNotif.email
              ).catch(() => {});
            }
          }
        } catch {}
        // FLOW-02 FIX: When a ficha is APPROVED, update phase measure statuses
        // Each measure with status "C" (Conforme) or "I" (Implementado) marks that measure as "concluido"
        if (input.status === "approved" && sub.projectId) {
          const responses = await db.getResponsesBySubmission(input.id);
          for (const resp of responses) {
            if (resp.status === "C" || resp.status === "I") {
              await db.upsertPhaseMeasureStatus({
                measureId: resp.measureId,
                projectId: sub.projectId,
                status: "concluido",
                notes: `Aprovado via ficha #${input.id} (S${sub.weekNumber}/${sub.weekYear})`,
                updatedBy: ctx.user.id,
              });
            }
          }

          // ─── ARCHIVE: Send approved ficha to external storage ─────────
          try {
            const { archiveDocument } = await import("./archive-provider");
            const project = await db.getProjectById(sub.projectId);
            const company = sub.companyId ? await db.getCompanyById(sub.companyId) : null;
            const evidence = await db.getImagesBySubmission(input.id);
            const comments = await db.getCommentsBySubmission(input.id);

            await archiveDocument("ficha", project?.code || "UNKNOWN", sub.weekYear || new Date().getFullYear(), {
              submission: { ...sub, status: "approved", reviewedBy: ctx.user.id, reviewedAt: Date.now(), reviewNotes: input.notes },
              responses,
              evidenceUrls: evidence.map((e: any) => e.url),
              reviewComments: comments,
              companyName: company?.name || null,
              projectName: project?.name || null,
            }, {
              weekNumber: sub.weekNumber,
              weekYear: sub.weekYear,
              companyId: sub.companyId,
              companyName: company?.name || null,
              submissionId: input.id,
              status: "approved",
            });
          } catch (archiveErr) {
            // Archive failure is non-fatal — data stays in DB as fallback
            console.warn("Archive to external storage failed (non-fatal):", archiveErr);
          }
        }
        return { success: true };
      }),
    // ─── Import external PDF/Word with preview ───────────────────────────
    analyzeImport: protectedProcedure
      .input(z.object({
        projectId: z.number().int().positive(),
        companyId: z.number().int().positive(),
        weekNumber: z.number().int().min(1).max(53),
        year: z.number().int().min(2020).max(2100),
        destination: z.enum(["review", "historical"]),
        fileBase64: z.string().min(1).max(MAX_FILE_SIZE_B64),
        filename: z.string().min(1).max(255),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertImportPermission(ctx.user, input.projectId, input.companyId, input.destination);

        const existing = await db.getSubmissionForWeek(input.companyId, input.weekNumber, input.year, input.projectId);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe uma ficha para a Semana ${input.weekNumber}/${input.year} desta empresa neste projecto.`,
          });
        }

        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível." });

        const mimeType = getImportedDocumentMimeType(input.filename);
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > 10 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ficheiro demasiado grande (máximo 10 MB)." });
        }

        const sanitizeResult = await sanitizeFile(buffer, mimeType, input.filename);
        await logFileUpload(ctx.user.id, input.filename, mimeType, sanitizeResult.safe, sanitizeResult.threats, "ficha-import-preview");
        if (!sanitizeResult.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult.threats[0]}` });
        }

        const { callLLM } = await import("./llm-provider");
        const { extractDocumentText, extractImagesFromPdf, extractImagesFromDocx } = await import("./image-extractor");
        let documentText = "";
        try {
          documentText = await extractDocumentText(buffer, input.filename);
        } catch (error) {
          console.warn("Document text extraction failed:", error);
        }
        if (documentText.trim().length < 20) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível extrair texto suficiente do documento. Confirme se o ficheiro contém texto pesquisável." });
        }

        let extractedImages: Awaited<ReturnType<typeof extractImagesFromPdf>> = [];
        try {
          extractedImages = input.filename.toLowerCase().endsWith(".docx")
            ? await extractImagesFromDocx(buffer)
            : await extractImagesFromPdf(buffer);
        } catch (error) {
          console.warn("Image extraction failed (non-fatal):", error);
        }

        const allMeasures = await database.select().from(schema.measures);
        const measureList = allMeasures
          .map((measure: any) => `ID:${measure.id} | ${measure.number || ""} | ${measure.description}`)
          .join("\n");
        const llmResponse = await callLLM([
          {
            role: "system",
            content: "Analisa fichas portuguesas de controlo ambiental. Devolve exclusivamente JSON válido. Para cada medida identificada, indica measureId, status (I, C, NC ou NA) e observations. Não inventes respostas que não estejam no documento.",
          },
          {
            role: "user",
            content: `MEDIDAS DISPONÍVEIS:\n${measureList}\n\nTEXTO EXTRAÍDO DA FICHA:\n${documentText.slice(0, 90000)}\n\nDevolve {"responses":[{"measureId":1,"status":"C","observations":"texto ou null"}]}.`,
          },
        ], 16384);

        let rawResponses: any[] = [];
        try {
          const content = llmResponse.content || "{}";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
          rawResponses = Array.isArray(parsed.responses) ? parsed.responses : [];
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível interpretar a análise do documento. Tente novamente." });
        }

        const measureMap = new Map(allMeasures.map((measure: any) => [measure.id, measure]));
        const uniqueResponses = new Map<number, any>();
        for (const response of rawResponses) {
          const measureId = Number(response.measureId);
          const status = String(response.status || "").toUpperCase();
          if (!measureMap.has(measureId) || !["I", "C", "NC", "NA"].includes(status)) continue;
          const measure: any = measureMap.get(measureId);
          uniqueResponses.set(measureId, {
            measureId,
            measureCode: measure?.number || `M${measureId}`,
            measureDescription: measure?.description || "",
            status,
            observations: typeof response.observations === "string" ? response.observations.slice(0, 10000) : null,
          });
        }
        const responses = Array.from(uniqueResponses.values());
        if (responses.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não foram encontradas respostas associáveis às medidas da plataforma." });
        }

        const previewPrefix = `pdf-imports/previews/${ctx.user.id}/${Date.now()}`;
        const { key: fileKey, url: fileUrl } = await storagePut(`${previewPrefix}/${input.filename}`, buffer, mimeType);
        const imagesToUpload = extractedImages.slice(0, 80);
        const images: Array<{ fileKey: string; url: string; filename: string; mimeType: string; page: number }> = [];
        for (let index = 0; index < imagesToUpload.length; index += 8) {
          const batch = imagesToUpload.slice(index, index + 8);
          const uploaded = await Promise.all(batch.map(async (image, batchIndex) => {
            const key = `${previewPrefix}/evidence/${index + batchIndex}_${image.filename}`;
            const stored = await storagePut(key, image.buffer, image.mimeType);
            return { fileKey: stored.key, url: stored.url, filename: image.filename, mimeType: image.mimeType, page: image.page };
          }));
          images.push(...uploaded);
        }

        const counts = responses.reduce((acc: Record<string, number>, response: any) => {
          acc[response.status] = (acc[response.status] || 0) + 1;
          return acc;
        }, { I: 0, C: 0, NC: 0, NA: 0 });

        return {
          fileKey,
          fileUrl,
          filename: input.filename,
          mimeType,
          responses,
          images,
          counts,
          matchedMeasures: responses.length,
          totalMeasures: allMeasures.length,
          extractedPhotos: images.length,
          provider: llmResponse.provider,
          warnings: extractedImages.length > 80 ? ["Foram extraídas mais de 80 imagens; apenas as primeiras 80 serão associadas."] : [],
        };
      }),

    commitImport: protectedProcedure
      .input(z.object({
        projectId: z.number().int().positive(),
        companyId: z.number().int().positive(),
        weekNumber: z.number().int().min(1).max(53),
        year: z.number().int().min(2020).max(2100),
        destination: z.enum(["review", "historical"]),
        fileKey: z.string().min(1).max(500),
        filename: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(100),
        responses: z.array(importedResponseSchema).min(1).max(500),
        images: z.array(importedImageSchema).max(80),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await assertImportPermission(ctx.user, input.projectId, input.companyId, input.destination);
        const expectedPrefix = `pdf-imports/previews/${ctx.user.id}/`;
        if (!input.fileKey.startsWith(expectedPrefix) || input.images.some(image => !image.fileKey.startsWith(expectedPrefix))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Referência de ficheiro inválida." });
        }
        if (getImportedDocumentMimeType(input.filename) !== input.mimeType) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O tipo do ficheiro não corresponde ao nome indicado." });
        }

        const existing = await db.getSubmissionForWeek(input.companyId, input.weekNumber, input.year, input.projectId);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe uma ficha para a Semana ${input.weekNumber}/${input.year} desta empresa neste projecto.`,
          });
        }

        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível." });
        const allMeasures = await database.select({ id: schema.measures.id }).from(schema.measures);
        const validMeasureIds = new Set(allMeasures.map(item => item.id));
        const validResponses = input.responses.filter(response => validMeasureIds.has(response.measureId));
        if (validResponses.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A pré-visualização não contém medidas válidas." });
        }

        const company = await db.getCompanyById(input.companyId);
        if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
        const dates = getIsoWeekDateRange(input.weekNumber, input.year);
        const storedFile = await storageGet(input.fileKey);
        const resolvedImages = await Promise.all(input.images.map(async image => ({ ...image, url: (await storageGet(image.fileKey)).url })));

        const submissionId = await database.transaction(async tx => {
          const isHistorical = input.destination === "historical";
          const now = Date.now();
          const [submissionResult] = await tx.insert(schema.weeklySubmissions).values({
            projectId: input.projectId,
            companyId: input.companyId,
            weekNumber: input.weekNumber,
            weekYear: input.year,
            weekStartDate: dates.start,
            weekEndDate: dates.end,
            status: isHistorical ? "approved" : "submitted",
            createdBy: ctx.user.id,
            submittedBy: ctx.user.id,
            submittedAt: now,
            reviewedBy: isHistorical ? ctx.user.id : null,
            reviewedAt: isHistorical ? now : null,
            reviewNotes: isHistorical ? "Ficha histórica aprovada importada de PDF/Word" : "Ficha externa importada e submetida para revisão",
          }).$returningId();

          const responseIds: number[] = [];
          for (const response of validResponses) {
            const [responseResult] = await tx.insert(schema.measureResponses).values({
              submissionId: submissionResult.id,
              measureId: response.measureId,
              status: response.status,
              observations: response.observations || null,
            }).$returningId();
            responseIds.push(responseResult.id);
          }

          if (responseIds.length > 0) {
            for (let index = 0; index < resolvedImages.length; index++) {
              const responseIndex = Math.min(Math.floor((index / Math.max(resolvedImages.length, 1)) * responseIds.length), responseIds.length - 1);
              const image = resolvedImages[index];
              await tx.insert(schema.evidenceImages).values({
                responseId: responseIds[responseIndex],
                fileKey: image.fileKey,
                url: image.url,
                filename: image.filename,
                mimeType: image.mimeType,
              });
            }
          }

          await tx.insert(schema.historicalPdfs).values({
            companyId: input.companyId,
            projectId: input.projectId,
            weekNumber: input.weekNumber,
            weekYear: input.year,
            fileKey: input.fileKey,
            url: storedFile.url,
            filename: input.filename,
            uploadedBy: ctx.user.id,
          });

          await tx.insert(schema.auditLog).values({
            userId: ctx.user.id,
            userName: ctx.user.name || ctx.user.email || "Utilizador",
            action: isHistorical ? "historical_ficha_imported" : "external_ficha_submitted",
            entity: "weekly_submission",
            entityId: submissionResult.id,
            newValue: JSON.stringify({
              projectId: input.projectId,
              companyId: input.companyId,
              weekNumber: input.weekNumber,
              weekYear: input.year,
              source: "pdf_word_import",
              destination: input.destination,
              matchedMeasures: validResponses.length,
              extractedPhotos: resolvedImages.length,
            }),
          });

          return submissionResult.id;
        });

        if (input.destination === "review") {
          try {
            const recipients = await db.getNotificationRecipients(input.projectId, "submission");
            const emails = recipients.filter((recipient: any) => recipient.userEmail).map((recipient: any) => recipient.userEmail as string);
            if (emails.length > 0) {
              sendFichaSubmittedNotification(
                submissionId,
                input.weekNumber,
                input.year,
                company.shortName,
                project.code,
                emails,
              ).catch(() => {});
            }
          } catch (error) {
            console.warn("Imported ficha notification failed (non-fatal):", error);
          }
        } else {
          try {
            const { archiveDocument } = await import("./archive-provider");
            await archiveDocument("ficha", project.code, input.year, {
              submission: {
                id: submissionId,
                projectId: input.projectId,
                companyId: input.companyId,
                weekNumber: input.weekNumber,
                weekYear: input.year,
                status: "approved",
                sourceFileUrl: storedFile.url,
              },
              responses: validResponses,
              evidenceUrls: resolvedImages.map(image => image.url),
            }, {
              submissionId,
              weekNumber: input.weekNumber,
              companyId: input.companyId,
              companyName: company.shortName,
              status: "approved",
              source: "historical_import",
            });
          } catch (error) {
            console.warn("Historical import archive failed (non-fatal):", error);
          }
        }

        return {
          success: true,
          submissionId,
          status: input.destination === "historical" ? "approved" as const : "submitted" as const,
          matchedMeasures: validResponses.length,
          extractedPhotos: resolvedImages.length,
        };
      }),

    // Legacy direct import kept for old clients; restricted to administrators.
    importPdf: adminProcedure
      .input(z.object({
        projectId: z.number(),
        weekNumber: z.number(),
        year: z.number(),
        pdfBase64: z.string(), // base64 encoded PDF data
        pdfFilename: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { callLLM } = await import("./llm-provider");
        const { extractImagesFromPdf, extractImagesFromDocx } = await import("./image-extractor");

        // Upload PDF to storage first
        const buffer = Buffer.from(input.pdfBase64, "base64");
        const mimeType = input.pdfFilename.toLowerCase().endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf";
        // Security: sanitize imported document
        const sanitizeResult = await sanitizeFile(buffer, mimeType, input.pdfFilename);
        await logFileUpload(ctx.user.id, input.pdfFilename, mimeType, sanitizeResult.safe, sanitizeResult.threats, "pdf-import");
        if (!sanitizeResult.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult.threats[0]}` });
        }
        const fileKey = `pdf-imports/${input.projectId}/${Date.now()}_${input.pdfFilename}`;
        const { url: pdfStorageUrl } = await storagePut(fileKey, buffer, mimeType);

        // Extract images from the document in parallel with LLM processing
        let extractedImages: Awaited<ReturnType<typeof extractImagesFromPdf>> = [];
        try {
          if (input.pdfFilename.toLowerCase().endsWith(".docx")) {
            extractedImages = await extractImagesFromDocx(buffer);
          } else {
            extractedImages = await extractImagesFromPdf(buffer);
          }
        } catch (e) {
          console.warn("Image extraction failed (non-fatal):", e);
        }

        // Get all measures for this project
        const allMeasures = await database.select().from(schema.measures);
        const measureList = allMeasures.map((m: any) => `ID:${m.id} - ${m.code || ''} ${m.description}`).join('\n');
        
        // Use LLM to extract responses from the PDF
        const llmResponse = await callLLM([
          { role: "system", content: "You are an environmental compliance document parser. Extract measure responses from a Portuguese environmental control sheet (Ficha de Controlo Ambiental). For each measure found in the PDF, return the measure ID, status (I=Implementado, C=Conforme, NC=Não Conforme, NA=Não Aplicável), and any observations text. Return JSON only." },
          { role: "user", content: `Here are the measures in our system:\n${measureList}\n\nI have uploaded a PDF environmental control sheet. The PDF content has been uploaded to: ${pdfStorageUrl}\nMatch each response to the correct measure ID. Return a JSON object with a "responses" array of objects with: measureId (number), status (string: I/C/NC/NA), observations (string or null).` }
        ], 16384);

        let extractedResponses: any[] = [];
        try {
          const content = llmResponse.content || "{}";
          // Try to extract JSON from the response (may be wrapped in markdown code blocks)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
          extractedResponses = parsed.responses || [];
        } catch (e) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível processar o PDF. Tente novamente." });
        }

        // Create a new submission for this historical ficha
        const [result] = await database!.insert(schema.weeklySubmissions).values({
          projectId: input.projectId,
          companyId: (ctx.user as any).companyId || null,
          weekNumber: input.weekNumber,
          weekYear: input.year,
          weekStartDate: "01.01." + input.year,
          weekEndDate: "07.01." + input.year,
          status: "approved", // Historical fichas are already approved
          createdBy: ctx.user.id,
          submittedBy: ctx.user.id,
          submittedAt: Date.now(),
          reviewedBy: ctx.user.id,
          reviewedAt: Date.now(),
          reviewNotes: "Importado via PDF histórico",
        }).$returningId();
        
        const submissionId = result.id;
        
        // Save each extracted response
        const responseIds: { measureId: number; responseId: number }[] = [];
        for (const resp of extractedResponses) {
          if (resp.measureId && resp.status) {
            const [resResult] = await database!.insert(schema.measureResponses).values({
              submissionId,
              measureId: resp.measureId,
              status: resp.status,
              observations: resp.observations || null,
            }).$returningId();
            responseIds.push({ measureId: resp.measureId, responseId: resResult.id });
          }
        }
        
        // Upload extracted images as evidence photos
        let photoCount = 0;
        if (extractedImages.length > 0 && responseIds.length > 0) {
          // Strategy: distribute images across measure responses
          // If LLM returned page info per measure, use that; otherwise distribute evenly
          for (let i = 0; i < extractedImages.length; i++) {
            const img = extractedImages[i];
            // Associate image with the closest measure response (by index distribution)
            const responseIndex = Math.min(
              Math.floor((i / extractedImages.length) * responseIds.length),
              responseIds.length - 1
            );
            const targetResponse = responseIds[responseIndex];

            try {
              const imgFileKey = `evidence/${submissionId}/${Date.now()}_${img.filename}`;
              const { url: imgUrl } = await storagePut(imgFileKey, img.buffer, img.mimeType);
              await database!.insert(schema.evidenceImages).values({
                responseId: targetResponse.responseId,
                fileKey: imgFileKey,
                url: imgUrl,
                filename: img.filename,
                mimeType: img.mimeType,
              });
              photoCount++;
            } catch (e) {
              console.warn(`Failed to upload image ${img.filename}:`, e);
            }
          }
        }

        return {
          success: true,
          submissionId,
          matchedMeasures: extractedResponses.length,
          totalMeasures: allMeasures.length,
          extractedPhotos: photoCount,
        };
      }),
  }),

  // ─── Review Comments ──────────────────────────────────────────────────────
  reviewComments: router({
    getBySubmission: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // RAA, admin, dono, and the company itself can see comments
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getCommentsBySubmission(input.submissionId);
      }),
    getMeasureReviews: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // RAA, admin, dono, the company itself, and observador can see measure reviews
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getMeasureReviewsBySubmission(input.submissionId);
      }),
    add: protectedProcedure
      .input(z.object({ submissionId: z.number(), measureId: z.number().nullable(), comment: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!canReview(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para comentar." });
        }
        return db.addReviewComment({
          submissionId: input.submissionId,
          measureId: input.measureId,
          userId: ctx.user.id,
          comment: input.comment,
        });
      }),
  }),

  // ─── Measure Responses ─────────────────────────────────────────────────────
  responses: router({
    getBySubmission: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // RAA can view all responses
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getResponsesBySubmission(input.submissionId);
      }),

    // Get responses for multiple submissions at once (for RDCD report)
    getBySubmissions: protectedProcedure
      .input(z.object({ submissionIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "pm") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin, DO ou PM podem gerar RDCD" });
        }
        if (input.submissionIds.length === 0) return [];
        const database = await db.getDb();
        if (!database) return [];
        const results = await database.execute(sql`SELECT mr.submissionId, mr.measureId, mr.status, mr.observations FROM measure_responses mr WHERE mr.submissionId IN (${sql.join(input.submissionIds.map(id => sql`${id}`), sql`, `)})`);
        return (results as any)[0] || [];
      }),

    save: protectedProcedure
      .input(
        z.object({
          submissionId: z.number(),
          responses: z.array(
            z.object({
              measureId: z.number(),
              status: z.enum(["I", "C", "NC", "NA"]).nullable(),
              observations: z.string().nullable(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // Can only edit if draft or rejected
        if (sub.status !== "draft" && sub.status !== "rejected" && !isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ficha não pode ser editada neste estado." });
        }
        if (!isAdminOrDono(ctx.user.role) && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.bulkUpsertResponses(input.submissionId, input.responses);
        return { success: true };
      }),
  }),

  // ─── Evidence Images ───────────────────────────────────────────────────────
  evidence: router({
    getBySubmission: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getImagesBySubmission(input.submissionId);
      }),

    // Get evidence images for multiple submissions at once (for RDCD report)
    getBySubmissions: protectedProcedure
      .input(z.object({ submissionIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "pm") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin, DO ou PM" });
        }
        if (input.submissionIds.length === 0) return [];
        const database = await db.getDb();
        if (!database) return [];
        const responsesResult = await database.execute(sql`SELECT id, submissionId, measureId FROM measure_responses WHERE submissionId IN (${sql.join(input.submissionIds.map(id => sql`${id}`), sql`, `)})`);
        const responses = (responsesResult as any)[0] || [];
        if (responses.length === 0) return [];
        const responseIds = responses.map((r: any) => r.id);
        const imagesResult = await database.execute(sql`SELECT ei.id, ei.responseId, ei.url, ei.filename, ei.mimeType FROM evidence_images ei WHERE ei.responseId IN (${sql.join(responseIds.map((id: number) => sql`${id}`), sql`, `)})`);
        const images = (imagesResult as any)[0] || [];
        return images.map((img: any) => {
          const resp = responses.find((r: any) => r.id === img.responseId);
          return { ...img, measureId: resp?.measureId, submissionId: resp?.submissionId };
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const image = await db.getImageById(input.id);
        if (!image) throw new TRPCError({ code: "NOT_FOUND" });
        const response = await db.getResponseById(image.responseId);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const sub = await db.getSubmissionById(response.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminOrDono(ctx.user.role) && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteEvidenceImage(input.id);
        return { success: true };
      }),
  }),

  // ─── Historical PDFs ──────────────────────────────────────────────────────
  historical: router({
    list: protectedProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (isAdminOrDono(ctx.user.role) || ctx.user.role === "raa" || ctx.user.role === "observador") {
          return db.getHistoricalPdfs(input?.companyId);
        }
        if (!ctx.user.companyId) return [];
        return db.getHistoricalPdfs(ctx.user.companyId);
      }),
    upload: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        weekNumber: z.number(),
        weekYear: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        data: z.string(), // base64
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && !canSubmitForms(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // EE/RAP can only upload for their own company
        if (!isAdminOrDono(ctx.user.role) && ctx.user.companyId !== input.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Security: validate file type and size
        if (!ALLOWED_FILE_TYPES.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de ficheiro não permitido" });
        if (input.data.length > MAX_FILE_SIZE_B64) throw new TRPCError({ code: "BAD_REQUEST", message: "Ficheiro demasiado grande (máx. 10MB)" });
        const buffer = Buffer.from(input.data, "base64");
        // Security: sanitize historical document
        const sanitizeResult = await sanitizeFile(buffer, input.mimeType, `historical_S${input.weekNumber}_${input.weekYear}.pdf`);
        await logFileUpload(ctx.user.id, `historical_S${input.weekNumber}_${input.weekYear}`, input.mimeType, sanitizeResult.safe, sanitizeResult.threats, "historical-pdf");
        if (!sanitizeResult.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult.threats[0]}` });
        }
        const company = await db.getCompanyById(input.companyId);
        const companyName = company?.shortName || `EE${input.companyId}`;
        const fileKey = `historical/${input.companyId}/FichaS${String(input.weekNumber).padStart(2, "0")}_${input.weekYear}_${companyName}.pdf`;
        const { key, url } = await storagePut(fileKey, buffer, input.mimeType);

        return db.addHistoricalPdf({
          companyId: input.companyId,
          weekNumber: input.weekNumber,
          weekYear: input.weekYear,
          fileKey: key,
          url,
          filename: input.filename,
          uploadedBy: ctx.user.id,
        });
      }),
  }),

  // ─── Biblioteca Documental ────────────────────────────────────────────────
  documentLibrary: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      if (!canReadDocumentLibrary(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem autorização para consultar a biblioteca documental." });
      }
      const isAdmin = ctx.user.role === "admin";
      const projectId = input?.projectId;
      if (!isAdmin && !projectId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione um projeto individual para consultar a documentação." });
      }
      if (projectId) await assertProjectFeatureAccess(ctx.user, projectId, "documentacao");
      const documents = await db.listDocumentLibrary(isAdmin && !projectId, projectId);
      return documents.map(({ fileKey, projectIds, ...document }) => isAdmin ? { ...document, projectIds } : document);
    }),
    create: adminProcedure
      .input(z.object({
        topic: z.enum(["obrigacoes_ambientais", "certificacoes", "recomendacoes"]),
        subtopic: z.string().trim().max(100).nullable().optional(),
        title: z.string().trim().min(3).max(255),
        language: z.string().trim().min(2).max(50),
        description: z.string().trim().max(2_000).nullable().optional(),
        status: z.enum(["draft", "published"]).default("draft"),
        isProjectCentral: z.boolean().default(false),
        isMandatoryRead: z.boolean().default(false),
        centralOrder: z.number().int().min(0).max(999).default(0),
        appliesToAllProjects: z.boolean().default(false),
        projectIds: z.array(z.number().int().positive()).max(50).default([]),
        filename: z.string().trim().min(1).max(255),
        mimeType: z.literal("application/pdf"),
        data: z.string().min(16).max(MAX_FILE_SIZE_B64),
      }))
      .mutation(async ({ ctx, input }) => {
        assertAdminOnly(ctx.user);
        if (input.topic !== "certificacoes" && input.subtopic) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Os subtópicos são permitidos apenas em Certificações." });
        }
        if (input.isMandatoryRead && !input.isProjectCentral) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A leitura obrigatória requer destaque na Central de Documentos." });
        }
        const projectIds = Array.from(new Set(input.projectIds));
        if (!input.appliesToAllProjects && projectIds.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione pelo menos um projeto ou aplique o documento a todos os projetos." });
        }
        const validProjectIds = new Set((await db.getAllProjects()).filter(project => project.code !== "main").map(project => project.id));
        if (projectIds.some(projectId => !validProjectIds.has(projectId))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Um ou mais projetos selecionados não são válidos." });
        }
        const filename = getSafePdfFilename(input.filename);
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data) || input.data.length % 4 !== 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O conteúdo do PDF é inválido." });
        }
        const buffer = Buffer.from(input.data, "base64");
        const hasPdfHeader = buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"));
        const hasPdfEndMarker = buffer.subarray(Math.max(0, buffer.length - 1024)).includes(Buffer.from("%%EOF"));
        if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024 || !hasPdfHeader || !hasPdfEndMarker) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Carregue um PDF válido até 10 MB." });
        }
        const sanitizeResult = await sanitizeFile(buffer, input.mimeType, filename);
        await logFileUpload(ctx.user.id, filename, input.mimeType, sanitizeResult.safe, sanitizeResult.threats, "document-library");
        if (!sanitizeResult.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult.threats[0]}` });
        }
        const { key } = await storagePut(`document-library/${input.topic}/${filename}`, buffer, input.mimeType);
        const created = await db.createDocumentLibraryItem({
          topic: input.topic,
          subtopic: input.subtopic || null,
          title: input.title,
          language: input.language,
          description: input.description || null,
          appliesToAllProjects: input.appliesToAllProjects ? 1 : 0,
          fileKey: key,
          filename,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          status: input.status,
          isProjectCentral: input.isProjectCentral ? 1 : 0,
          isMandatoryRead: input.isMandatoryRead ? 1 : 0,
          centralOrder: input.centralOrder,
          createdBy: ctx.user.id,
          createdByName: getUserDisplayName(ctx.user),
        });
        if (created?.id && !input.appliesToAllProjects) {
          await db.replaceDocumentLibraryProjects(created.id, projectIds);
        }
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "document_library_created", "document_library", created?.id ?? null, null, JSON.stringify({
          topic: input.topic, subtopic: input.subtopic || null, title: input.title, language: input.language, status: input.status,
          isProjectCentral: input.isProjectCentral, isMandatoryRead: input.isMandatoryRead, centralOrder: input.centralOrder,
          appliesToAllProjects: input.appliesToAllProjects, projectCount: input.appliesToAllProjects ? "todos" : projectIds.length,
        }));
        return created;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        topic: z.enum(["obrigacoes_ambientais", "certificacoes", "recomendacoes"]).optional(),
        subtopic: z.string().trim().max(100).nullable().optional(),
        title: z.string().trim().min(3).max(255).optional(),
        language: z.string().trim().min(2).max(50).optional(),
        description: z.string().trim().max(2_000).nullable().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        isProjectCentral: z.boolean().optional(),
        isMandatoryRead: z.boolean().optional(),
        centralOrder: z.number().int().min(0).max(999).optional(),
        appliesToAllProjects: z.boolean().optional(),
        projectIds: z.array(z.number().int().positive()).max(50).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        assertAdminOnly(ctx.user);
        const { id, isProjectCentral: centralInput, isMandatoryRead: mandatoryInput, appliesToAllProjects: allProjectsInput, projectIds: projectIdsInput, ...data } = input;
        const existing = await db.getDocumentLibraryItemById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Documento não encontrado." });
        const effectiveTopic = data.topic ?? existing.topic;
        const effectiveSubtopic = data.subtopic === undefined ? existing.subtopic : data.subtopic;
        if (effectiveTopic !== "certificacoes" && effectiveSubtopic) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Os subtópicos são permitidos apenas em Certificações." });
        }
        const isProjectCentral = centralInput ?? existing.isProjectCentral === 1;
        const isMandatoryRead = mandatoryInput ?? existing.isMandatoryRead === 1;
        if (isMandatoryRead && !isProjectCentral) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A leitura obrigatória requer destaque na Central de Documentos." });
        }
        const appliesToAllProjects = allProjectsInput ?? existing.appliesToAllProjects === 1;
        const projectIds = projectIdsInput === undefined ? await db.getDocumentLibraryProjectIds(id) : Array.from(new Set(projectIdsInput));
        if (!appliesToAllProjects && projectIds.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione pelo menos um projeto ou aplique o documento a todos os projetos." });
        }
        const validProjectIds = new Set((await db.getAllProjects()).filter(project => project.code !== "main").map(project => project.id));
        if (projectIds.some(projectId => !validProjectIds.has(projectId))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Um ou mais projetos selecionados não são válidos." });
        }
        const updateData = {
          ...data,
          ...(centralInput === undefined ? {} : { isProjectCentral: centralInput ? 1 : 0 }),
          ...(mandatoryInput === undefined ? {} : { isMandatoryRead: mandatoryInput ? 1 : 0 }),
          ...(allProjectsInput === undefined ? {} : { appliesToAllProjects: allProjectsInput ? 1 : 0 }),
          ...(centralInput === false ? { isMandatoryRead: 0, centralOrder: 0 } : {}),
        };
        const updated = await db.updateDocumentLibraryItem(id, updateData);
        if (projectIdsInput !== undefined || appliesToAllProjects) {
          await db.replaceDocumentLibraryProjects(id, appliesToAllProjects ? [] : projectIds);
        }
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "document_library_updated", "document_library", id, JSON.stringify({ title: existing.title, appliesToAllProjects: existing.appliesToAllProjects }), JSON.stringify({ ...updateData, projectCount: appliesToAllProjects ? "todos" : projectIds.length }));
        return updated;
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        assertAdminOnly(ctx.user);
        const existing = await db.getDocumentLibraryItemById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Documento não encontrado." });
        await db.deleteDocumentLibraryItem(input.id);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "document_library_deleted", "document_library", input.id, JSON.stringify({ title: existing.title }), null);
        return { success: true };
      }),
  }),

  // ─── Dashboard Analytics ───────────────────────────────────────────────────
  analytics: router({
    overview: protectedProcedure
      .input(
        z.object({
          companyId: z.number().optional(),
          weekYear: z.number().optional(),
          weekNumber: z.number().optional(),
          sectionId: z.number().optional(),
          projectId: z.number().optional(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        // EE/RAP can only see own company
        const filters = { ...input };
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.companyId) {
          filters.companyId = ctx.user.companyId;
        }
        return db.getAnalytics(filters);
      }),
  }),

  // ─── Profile ───────────────────────────────────────────────────────────────
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserByOpenId(ctx.user.openId);
      if (!user) return null;
      return {
        id: user.id,
        name: user.name,
        fullName: (user as any).fullName ?? null,
        jobTitle: (user as any).jobTitle ?? null,
        email: user.email,
        role: user.role,
      };
    }),
    update: protectedProcedure
      .input(z.object({
        fullName: z.string().max(255).optional(),
        jobTitle: z.string().max(255).optional(),
        displayName: z.string().max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        await db.updateUserProfile(user.id, {
          fullName: input.fullName ?? null,
          jobTitle: input.jobTitle ?? null,
          name: input.displayName ?? null,
        });
        return { success: true };
      }),
  }),

  // ─── Projects ─────────────────────────────────────────────────────────────
  projects: router({
    list: partnerAllowedProcedure.query(async ({ ctx }) => {
      const allProjects = await db.getAllProjects();
      const role = ctx.user.role;
      // Admin e Dono de Obra mantêm a visão global.
      if (role === "admin" || role === "dono_obra") {
        return allProjects;
      }
      if (role === "pm") {
        const assignments = await db.getUserProjects(ctx.user.id);
        const assigned = new Map(assignments.map(item => [item.projectId, item.accessModules]));
        return allProjects.filter(project => assigned.has(project.id)).map(project => ({ ...project, pmAccessModules: assigned.get(project.id) ?? null }));
      }
      if (role === "ee_partner") {
        const profile = await getActivePartnerProfile(ctx.user);
        const allowedIds = new Set(await db.getPartnerAllowedProjectIds(ctx.user.id, profile!.parentCompanyId));
        return allProjects.filter(project => allowedIds.has(project.id) && project.code !== "SIN01");
      }
      // EE/RAP/RAA/observador: only see assigned projects, NEVER SIN01
      const userProjectAssocs = await db.getUserProjects(ctx.user.id);
      const userProjectIds = new Set(userProjectAssocs.map(up => up.projectId));
      // Also check company-level project assignments
      if (ctx.user.companyId) {
        const companyProjectAssocs = await db.getProjectsForCompany(ctx.user.companyId);
        for (const cp of companyProjectAssocs) {
          userProjectIds.add(cp.projectId);
        }
      }
      // If no assignments, return empty (user sees nothing until admin assigns)
      if (userProjectIds.size === 0) {
        return [];
      }
      // Filter to assigned projects and exclude SIN01 for non-admin roles
      return allProjects.filter(p => userProjectIds.has(p.id) && p.code !== "SIN01");
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return assertProjectAccess(ctx.user, input.id);
      }),
    create: adminProcedure
      .input(z.object({
        code: z.string().min(1).max(50),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        enabledModules: z.array(z.string().min(1).max(40)).min(1).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { enabledModules, ...projectData } = input;
        const created = await db.createProject({
          ...projectData,
          enabledModules: JSON.stringify(enabledModules || ["dashboard", "calendar", "map", "timeline", "ficha", "residuos", "kpi"]),
        });
        const projectId = (created as any)?.[0]?.insertId ?? (created as any)?.insertId ?? null;
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "project_created", "projects", projectId, null, JSON.stringify({
          code: input.code,
          name: input.name,
          enabledModules: enabledModules || ["dashboard", "calendar", "map", "timeline", "ficha", "residuos", "kpi"],
        }));
        return created;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().min(1).max(50).optional(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        active: z.number().optional(),
        enabledModules: z.array(z.string().min(1).max(40)).min(1).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, enabledModules, ...data } = input;
        await db.updateProject(id, {
          ...data,
          ...(enabledModules ? { enabledModules: JSON.stringify(enabledModules) } : {}),
        });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "project_updated", "projects", id, null, JSON.stringify({
          ...data,
          ...(enabledModules ? { enabledModules } : {}),
        }));
        return { success: true };
      }),
    // Company associations
    getCompanies: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "pm") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para listar empresas do projecto." });
        }
        await assertProjectAccess(ctx.user, input.projectId);
        return db.getCompaniesForProject(input.projectId);
      }),
    addCompany: adminProcedure
      .input(z.object({ projectId: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        await db.addCompanyToProject(input.projectId, input.companyId);
        return { success: true };
      }),
    removeCompany: adminProcedure
      .input(z.object({ projectId: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeCompanyFromProject(input.projectId, input.companyId);
        return { success: true };
      }),
    // User associations
    getUsers: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "pm") throw new TRPCError({ code: "FORBIDDEN" });
        await assertProjectAccess(ctx.user, input.projectId);
        return db.getProjectUsers(input.projectId);
      }),
    // Get all user-project assignments (for admin panel)
    allUserAssignments: adminProcedure.query(async () => {
      return db.getAllUserProjectAssignments();
    }),
    // Get all company-project assignments (for admin panel)
    allCompanyAssignments: adminProcedure.query(async () => {
      return db.getAllCompanyProjectAssignments();
    }),
    // Set user projects (replace all assignments for a user)
    setUserProjects: adminProcedure
      .input(z.object({ userId: z.number(), projectIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await db.setUserProjects(input.userId, input.projectIds);
        return { success: true };
      }),
    setPmAccessModules: adminProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        accessByProject: z.array(z.object({
          projectId: z.number().int().positive(),
          modules: z.array(z.enum(["dashboard", "planos", "calendar", "timeline", "ficha", "residuos", "kpi", "documentacao"])).min(1),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(input.userId);
        if (!user || user.role !== "pm") throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione um utilizador com o papel PM." });
        const assignedProjects = new Set((await db.getUserProjects(user.id)).map(assignment => assignment.projectId));
        if (input.accessByProject.some(item => !assignedProjects.has(item.projectId))) throw new TRPCError({ code: "FORBIDDEN", message: "O PM só pode receber permissões nos projectos que lhe estão atribuídos." });
        await db.setUserProjectAccessModules(user.id, input.accessByProject.map(item => ({ projectId: item.projectId, accessModules: JSON.stringify(Array.from(new Set(item.modules))) })));
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "pm_project_access_configured", "project_users", user.id, null, JSON.stringify({ userId: user.id, accessByProject: input.accessByProject }));
        return { success: true };
      }),
    // Set company projects (replace all assignments for a company)
    setCompanyProjects: adminProcedure
      .input(z.object({ companyId: z.number(), projectIds: z.array(z.number().int().positive()).min(1, "Seleccione pelo menos um projecto.") }))
      .mutation(async ({ input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
        if (company.companyType === "ee_partner") {
          const profile = await db.getPartnerCompanyProfile(input.companyId);
          if (!profile) throw new TRPCError({ code: "CONFLICT", message: "Configure primeiro a EE principal desta EEP." });
          const parentProjects = await db.getProjectsForCompany(profile.parentCompanyId);
          const allowedIds = new Set(parentProjects.map(item => item.projectId));
          if (input.projectIds.some(projectId => !allowedIds.has(projectId))) throw new TRPCError({ code: "FORBIDDEN", message: "A EEP só pode receber projectos da sua EE principal." });
        }
        await db.setCompanyProjects(input.companyId, input.projectIds);
        return { success: true };
      }),
    addUser: adminProcedure
      .input(z.object({ projectId: z.number(), userId: z.number() }))
      .mutation(async ({ input }) => {
        await db.addUserToProject(input.projectId, input.userId);
        return { success: true };
      }),
    removeUser: adminProcedure
      .input(z.object({ projectId: z.number(), userId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeUserFromProject(input.projectId, input.userId);
        return { success: true };
      }),
  }),

  // ─── Deletion Logs ──────────────────────────────────────────────────────────
  deletionLogs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Only admin and dono_obra can see deletion logs
      if (ctx.user.role !== "admin" && ctx.user.role !== "dono_obra") {
        return [];
      }
      return db.getDeletionLogs();
    }),
  }),

  // ─── Matrix (Acompanhamento) ──────────────────────────────────────────────
  matrix: router({
    getData: protectedProcedure
      .input(z.object({ projectId: z.number().optional(), year: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        // All authenticated users can view the matrix
        return db.getMatrixData(input?.projectId, input?.year);
      }),
  }),

  // ─── Evidence Files (ficheiros por medida) ────────────────────────────────
  files: router({
    upload: protectedProcedure
      .input(z.object({
        submissionId: z.number(),
        measureId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        data: z.string(), // base64
        fileSize: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminOrDono(ctx.user.role) && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Decode base64
        // Security: validate file type and size
        if (!ALLOWED_FILE_TYPES.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de ficheiro não permitido" });
        if (input.data.length > MAX_FILE_SIZE_B64) throw new TRPCError({ code: "BAD_REQUEST", message: "Ficheiro demasiado grande (máx. 10MB)" });
        const buffer = Buffer.from(input.data, "base64");
        // Security: sanitize evidence file
        const sanitizeResult2 = await sanitizeFile(buffer, input.mimeType, input.filename);
        await logFileUpload(ctx.user.id, input.filename, input.mimeType, sanitizeResult2.safe, sanitizeResult2.threats, "evidence-upload");
        if (!sanitizeResult2.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult2.threats[0]}` });
        }
        const timestamp = new Date().toISOString().slice(0, 10);
        const ext = input.filename.split(".").pop() || "bin";
        const fileKey = `files/${input.submissionId}/Medida${input.measureId}_${timestamp}.${ext}`;
        const contentType = input.mimeType || "application/octet-stream";

        const { storagePut } = await import("./storage");
        const { key, url } = await storagePut(fileKey, buffer, contentType);

        // Ensure measure response exists
        const { id: responseId } = await db.upsertMeasureResponse({
          submissionId: input.submissionId,
          measureId: input.measureId,
          status: null,
          observations: null,
        });

        const result = await db.addEvidenceFile({
          responseId,
          fileKey: key,
          url,
          filename: input.filename,
          mimeType: contentType,
          fileSize: input.fileSize || buffer.length,
        });

        return { id: result.id, url, fileKey: key, filename: input.filename };
      }),

    getBySubmission: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getFilesBySubmission(input.submissionId);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const file = await db.getFileById(input.id);
        if (!file) throw new TRPCError({ code: "NOT_FOUND" });
        const response = await db.getResponseById(file.responseId);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const sub = await db.getSubmissionById(response.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminOrDono(ctx.user.role) && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteEvidenceFile(input.id);
        return { success: true };
      }),
  }),

  // ─── Workflow por Projeto ─────────────────────────────────────────────────
  workflow: router({
    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        return { projectId: project.id, workflowDescription: project.workflowDescription || "" };
      }),

    update: protectedProcedure
      .input(z.object({ projectId: z.number(), workflowDescription: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem editar o workflow" });
        }
        await db.updateProjectWorkflow(input.projectId, input.workflowDescription);
        return { success: true };
      }),
  }),

  // ─── Overdue Detection (3 semanas sem ficha) ──────────────────────────────
  overdue: router({
    check: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        // Only show overdue to admin, dono_obra, raa (and EE/RAP for their own company)
        // Calculate current week
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
        const currentWeek = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
        const currentYear = now.getFullYear();

        // Get all active EE/RAP companies (optionally filtered by project)
        const matrixData = await db.getMatrixData(input?.projectId);
        const { submissions, companies } = matrixData;

        // For each company, find the latest submission week
        const overdueCompanies: Array<{
          companyId: number;
          companyName: string;
          companyType: string;
          weeksBehind: number;
          lastWeekKey: string | null;
        }> = [];

        for (const company of companies) {
          const companySubs = submissions.filter(s => s.companyId === company.id && s.status !== "draft");
          let lastWeekNum = 0;
          let lastWeekYear = 0;
          let lastWeekKey: string | null = null;

          for (const sub of companySubs) {
            if (sub.weekYear > lastWeekYear || (sub.weekYear === lastWeekYear && sub.weekNumber > lastWeekNum)) {
              lastWeekNum = sub.weekNumber;
              lastWeekYear = sub.weekYear;
              lastWeekKey = sub.weekKey;
            }
          }

          // Calculate weeks behind
          let weeksBehind = 0;
          if (lastWeekYear === 0) {
            // Never submitted - only flag if there are ANY submissions in this project
            // (meaning the project is active and others have submitted)
            const anyProjectSubs = submissions.filter(s => s.status !== "draft");
            if (anyProjectSubs.length === 0) {
              continue; // Project has no submissions at all, skip
            }
            // Find the earliest submission in the project to determine project start
            let earliestWeekNum = 99;
            let earliestWeekYear = 9999;
            for (const s of anyProjectSubs) {
              if (s.weekYear < earliestWeekYear || (s.weekYear === earliestWeekYear && s.weekNumber < earliestWeekNum)) {
                earliestWeekNum = s.weekNumber;
                earliestWeekYear = s.weekYear;
              }
            }
            const totalWeeksNow = currentYear * 52 + currentWeek;
            const totalWeeksEarliest = earliestWeekYear * 52 + earliestWeekNum;
            weeksBehind = totalWeeksNow - totalWeeksEarliest;
          } else {
            // Calculate difference in weeks
            const totalWeeksNow = currentYear * 52 + currentWeek;
            const totalWeeksLast = lastWeekYear * 52 + lastWeekNum;
            weeksBehind = totalWeeksNow - totalWeeksLast;
          }

          if (weeksBehind >= 3) {
            // For EE/RAP users, only show their own company
            if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa") {
              if (ctx.user.companyId !== company.id) continue;
            }
            overdueCompanies.push({
              companyId: company.id,
              companyName: company.shortName,
              companyType: company.companyType,
              weeksBehind,
              lastWeekKey,
            });
          }
        }

        return { overdueCompanies, currentWeek, currentYear };
      }),
  }),

  // ─── Monitoring Plans (Planos de Monitorização) ─────────────────────────────
  monitoringPlans: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "pm" && !input?.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione um projeto individual para consultar os planos." });
        if (input?.projectId) await assertProjectFeatureAccess(ctx.user, input.projectId, "planos");
        return db.getMonitoringPlanOverview();
      }),

    responsibleCandidates: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ ctx }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem consultar responsáveis internos." });
        }
        const allUsers = await db.getAllUsers();
        return allUsers
          .filter(candidate => candidate.accountStatus === "active" && candidate.email)
          .map(candidate => ({ id: candidate.id, name: getUserDisplayName(candidate), email: candidate.email!, role: candidate.role }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt"));
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        planNumber: z.string().trim().min(1).max(50).optional(),
        name: z.string().min(1),
        category: z.enum(["programa_monitorizacao", "plano_projeto"]),
        periodicity: z.string().optional(),
        phase: z.string().default("construcao"),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem criar planos" });
        }
        const id = await db.createMonitoringPlan({
          projectId: null,
          planNumber: input.planNumber ?? null,
          name: input.name,
          category: input.category,
          periodicity: input.periodicity ?? null,
          phase: input.phase,
          notes: input.notes ?? null,
          active: 1,
          lastReportingDate: null,
          nextReportingDate: null,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        planNumber: z.string().trim().min(1).max(50).optional(),
        name: z.string().optional(),
        periodicity: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem editar planos" });
        }
        const { id, ...data } = input;
        await db.updateMonitoringPlan(id, data as any);
        return { success: true };
      }),

    configure: protectedProcedure
      .input(z.object({
        planId: z.number(),
        ownerId: z.number().nullable().optional(),
        supportName: z.string().trim().max(255).nullable().optional(),
        supportCompany: z.string().trim().max(255).nullable().optional(),
        supportEmail: z.string().trim().email().max(320).nullable().optional(),
        supportPhone: z.string().trim().max(80).nullable().optional(),
        nextReportingDate: z.number().nullable().optional(),
        lastReportingDate: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem configurar responsáveis e prazos." });
        }
        const plan = await db.getMonitoringPlanById(input.planId);
        if (!plan || !plan.active) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });

        let ownerName: string | null | undefined = undefined;
        if (input.ownerId !== undefined) {
          if (input.ownerId === null) {
            ownerName = null;
          } else {
            const owner = await db.getUserById(input.ownerId);
            if (!owner || owner.accountStatus !== "active" || !owner.email) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável seleccionado não está activo ou não tem email." });
            }
            ownerName = getUserDisplayName(owner);
          }
        }

        const changes: any = {};
        if (input.ownerId !== undefined) {
          changes.ownerId = input.ownerId;
          changes.ownerName = ownerName;
        }
        if (input.nextReportingDate !== undefined) changes.nextReportingDate = input.nextReportingDate;
        if (input.lastReportingDate !== undefined) changes.lastReportingDate = input.lastReportingDate;
        if (input.supportName !== undefined) changes.supportName = input.supportName;
        if (input.supportCompany !== undefined) changes.supportCompany = input.supportCompany;
        if (input.supportEmail !== undefined) changes.supportEmail = input.supportEmail;
        if (input.supportPhone !== undefined) changes.supportPhone = input.supportPhone;
        await db.updateMonitoringPlan(plan.id, changes);
        await db.syncMonitoringPlanCalendarEvent(plan.id);

        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "monitoring_plan_configured",
          entity: "monitoring_plan",
          entityId: plan.id,
          newValue: JSON.stringify(changes),
        });
        return { success: true, planId: plan.id };
      }),

    addUpdate: protectedProcedure
      .input(z.object({
        planId: z.number(),
        projectId: z.number().int().positive().optional(),
        status: z.enum(["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]),
        updateText: z.string().trim().min(3).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = await db.getMonitoringPlanById(input.planId);
        if (!plan || !plan.active) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
        if (ctx.user.role === "pm") {
          if (!input.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione um projeto individual para actualizar um plano." });
          await assertProjectFeatureAccess(ctx.user, input.projectId, "planos");
        }
        if (!canUpdatePlanProgress(ctx.user, plan)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o responsável, a RAA, Admin ou Dono de Obra podem actualizar este plano." });
        }
        const updateId = await db.addMonitoringPlanUpdate({
          assignmentId: null,
          planId: plan.id,
          status: input.status,
          updateText: input.updateText,
          createdBy: ctx.user.id,
          createdByName: getUserDisplayName(ctx.user),
        });
        await db.updateMonitoringPlan(plan.id, { trackingStatus: input.status });
        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "monitoring_plan_status_update",
          entity: "monitoring_plan",
          entityId: plan.id,
          newValue: JSON.stringify({ updateId, status: input.status }),
        });
        return { success: true, updateId };
      }),

    history: protectedProcedure
      .input(z.object({ planId: z.number(), projectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "pm") {
          if (!input.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione um projeto individual para consultar o histórico do plano." });
          await assertProjectFeatureAccess(ctx.user, input.projectId, "planos");
        }
        return {
          updates: await db.getMonitoringPlanUpdates(input.planId),
          attachments: await db.getMonitoringPlanAttachments(input.planId),
        };
      }),

    uploadAttachment: protectedProcedure
      .input(z.object({
        planId: z.number(),
        projectId: z.number().optional(),
        filename: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(100),
        fileBase64: z.string().min(1).max(MAX_FILE_SIZE_B64),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = await db.getMonitoringPlanById(input.planId);
        if (!plan || !plan.active) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
        if (ctx.user.role === "pm") {
          if (!input.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione um projeto individual para anexar a um plano." });
          await assertProjectFeatureAccess(ctx.user, input.projectId, "planos");
        }
        if (!canUpdatePlanProgress(ctx.user, plan)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para anexar ficheiros a este plano." });
        }
        if (!ALLOWED_FILE_TYPES.has(input.mimeType)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de ficheiro não permitido." });
        }
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > 10 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ficheiro demasiado grande (máx. 10MB)." });
        }
        const sanitized = await sanitizeFile(buffer, input.mimeType, input.filename);
        await logFileUpload(ctx.user.id, input.filename, input.mimeType, sanitized.safe, sanitized.threats, "monitoring-plan");
        if (!sanitized.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitized.threats[0]}` });
        }
        const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
        const fileKey = `monitoring-plans/${plan.id}/${Date.now()}-${safeFilename}`;
        const stored = await storagePut(fileKey, buffer, input.mimeType);
        const attachmentId = await db.addMonitoringPlanAttachment({
          assignmentId: null,
          planId: plan.id,
          updateId: null,
          type: input.mimeType.startsWith("image/") ? "photo" : "file",
          fileKey: stored.key,
          url: stored.url,
          filename: input.filename,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          uploadedBy: ctx.user.id,
          uploadedByName: getUserDisplayName(ctx.user),
        });
        return { success: true, attachmentId, url: stored.url };
      }),

    confirmDelivery: protectedProcedure
      .input(z.object({ planId: z.number(), projectId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const plan = await db.getMonitoringPlanById(input.planId);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role === "pm") {
          if (!input.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione um projeto individual para confirmar uma entrega." });
          await assertProjectFeatureAccess(ctx.user, input.projectId, "planos");
        }
        if (!canUpdatePlanProgress(ctx.user, plan)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para confirmar esta entrega." });
        }

        const now = Date.now();
        let nextDate: number | null = null;
        const periodicity = (plan.periodicity || "").toLowerCase();
        if (periodicity.includes("anual") || periodicity.includes("annual")) {
          nextDate = now + 365 * 24 * 60 * 60 * 1000; // +1 year
        } else if (periodicity.includes("semestral")) {
          nextDate = now + 182 * 24 * 60 * 60 * 1000; // +6 months
        } else if (periodicity.includes("trimestral")) {
          nextDate = now + 91 * 24 * 60 * 60 * 1000; // +3 months
        } else if (periodicity.includes("trienal") || periodicity.includes("3 anos") || periodicity.includes("3 em 3")) {
          nextDate = now + 3 * 365 * 24 * 60 * 60 * 1000; // +3 years
        } else {
          // Default: +1 year
          nextDate = now + 365 * 24 * 60 * 60 * 1000;
        }

        await db.updateMonitoringPlan(plan.id, {
          submissionStatus: "delivered",
          confirmedDeliveryAt: now,
          lastReportingDate: now,
          nextReportingDate: nextDate,
        });
        await db.syncMonitoringPlanCalendarEvent(plan.id);
        return { success: true, nextReportingDate: nextDate };
      }),
  }),

  // ─── Project Phases ─────────────────────────────────────────────────────────
  projectPhases: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertProjectModuleAccess(ctx.user, input.projectId, "timeline");
        return await db.getProjectPhases(input.projectId);
      }),

    listAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem consultar fases de todos os projectos." });
        }
        return await db.getAllProjectPhases();
      }),
    responsibleCandidates: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem consultar responsáveis internos." });
        }
        await assertProjectModuleAccess(ctx.user, input.projectId, "timeline");
        const allUsers = await db.getAllUsers();
        const candidates: Array<{ id: number; name: string; email: string; role: string }> = [];
        for (const candidate of allUsers) {
          if (candidate.accountStatus !== "active" || !candidate.email) continue;
          try {
            await assertProjectAccess(candidate, input.projectId);
            candidates.push({ id: candidate.id, name: getUserDisplayName(candidate), email: candidate.email, role: candidate.role });
          } catch {
            // Não expor utilizadores sem acesso ao projecto.
          }
        }
        return candidates.sort((a, b) => a.name.localeCompare(b.name, "pt"));
      }),
    configureTracking: protectedProcedure
      .input(z.object({
        phaseId: z.number(),
        ownerId: z.number().nullable().optional(),
        supportName: z.string().trim().max(255).nullable().optional(),
        supportCompany: z.string().trim().max(255).nullable().optional(),
        supportEmail: z.string().trim().email().max(320).nullable().optional(),
        supportPhone: z.string().trim().max(80).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem configurar responsáveis das fases." });
        }
        const phase = await db.getProjectPhaseById(input.phaseId);
        if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada." });
        await assertProjectAccess(ctx.user, phase.projectId);

        let ownerName: string | null | undefined;
        if (input.ownerId !== undefined) {
          if (input.ownerId === null) ownerName = null;
          else {
            const owner = await db.getUserById(input.ownerId);
            if (!owner || owner.accountStatus !== "active" || !owner.email) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável seleccionado não está activo ou não tem email." });
            }
            await assertProjectAccess(owner, phase.projectId);
            ownerName = getUserDisplayName(owner);
          }
        }

        const changes: any = {};
        if (input.ownerId !== undefined) { changes.ownerId = input.ownerId; changes.ownerName = ownerName; }
        if (input.supportName !== undefined) changes.supportName = input.supportName;
        if (input.supportCompany !== undefined) changes.supportCompany = input.supportCompany;
        if (input.supportEmail !== undefined) changes.supportEmail = input.supportEmail;
        if (input.supportPhone !== undefined) changes.supportPhone = input.supportPhone;
        await db.updateProjectPhaseTracking(phase.id, changes);

        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "project_phase_configured",
          entity: "project_phase",
          entityId: phase.id,
          newValue: JSON.stringify(changes),
        });
        return { success: true };
      }),
    addStatusUpdate: protectedProcedure
      .input(z.object({
        phaseId: z.number(),
        status: z.enum(["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]),
        updateText: z.string().trim().min(3).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        const phase = await db.getProjectPhaseById(input.phaseId);
        if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada." });
        await assertProjectModuleAccess(ctx.user, phase.projectId, "timeline");
        if (!canUpdatePlanProgress(ctx.user, phase)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o responsável, a RAA, Admin ou Dono de Obra podem actualizar esta fase." });
        }
        const updateId = await db.addProjectPhaseUpdate({
          phaseId: phase.id,
          status: input.status,
          updateText: input.updateText,
          createdBy: ctx.user.id,
          createdByName: getUserDisplayName(ctx.user),
        });
        await db.updateProjectPhaseTracking(phase.id, { trackingStatus: input.status });
        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "project_phase_status_update",
          entity: "project_phase",
          entityId: phase.id,
          newValue: JSON.stringify({ updateId, status: input.status }),
        });
        return { success: true, updateId };
      }),
    updateHistory: protectedProcedure
      .input(z.object({ phaseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const phase = await db.getProjectPhaseById(input.phaseId);
        if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada." });
        await assertProjectModuleAccess(ctx.user, phase.projectId, "timeline");
        return db.getProjectPhaseUpdates(phase.id);
      }),
    updateSettings: protectedProcedure
      .input(z.object({ id: z.number(), startDate: z.string().optional(), endDate: z.string().optional(), hidden: z.number().optional(), progress: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { id, ...data } = input;
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await database.execute(sql`UPDATE project_phases SET startDate = ${data.startDate || null}, endDate = ${data.endDate || null}, hidden = COALESCE(${data.hidden ?? null}, hidden), progress = COALESCE(${data.progress ?? null}, progress) WHERE id = ${id}`);
        return { success: true };
      }),
  }),

  phaseMeasures: router({
    getAllProjectsProgress: protectedProcedure
      .query(async () => {
        // Get all projects
        const allProjects = await db.getAllProjects();
        // Get all phase measure statuses for all projects
        const results: any[] = [];
        const allSections = await db.getAllSections();
        const allMeasures = await db.getAllMeasures();

        const ppDb = await db.getDb(); const allProjectPhases = ppDb ? await ppDb.select().from(schema.projectPhases) : [];
        for (const proj of allProjects) {
          const statuses = await db.getPhaseMeasureStatuses(proj.id);
          const projPhases = allProjectPhases.filter((pp: any) => pp.projectId === proj.id);
          const statusMap = new Map<number, string>();
          statuses.forEach((s: any) => statusMap.set(s.measureId, s.trackingStatus));

          const phases: any[] = [];
          const PHASE_KEYS = ["Prévias Licenciamento", "Em Sede de Licenciamento", "Pré-Construção", "Preparação Prévia", "Execução da Obra", "Fase Final", "Fase Final Construção", "Exploração", "Desativação (Pós-Exploração)"];

          for (const phaseKey of PHASE_KEYS) {
            const phaseSections = allSections.filter((s: any) => s.phase === phaseKey);
            const sectionIds = new Set(phaseSections.map((s: any) => s.id));
            const phaseMeasures = allMeasures.filter((m: any) => sectionIds.has(m.sectionId));
            const total = phaseMeasures.length;
            if (total === 0) continue;
            const concluido = phaseMeasures.filter((m: any) => statusMap.get(m.id) === "concluido").length;
            const ppMatch = projPhases.find((pp: any) => pp.phaseKey === phaseKey || pp.phaseName === phaseKey);
            phases.push({ key: phaseKey, total, concluido, progress: Math.round((concluido / total) * 100), endDate: ppMatch?.endDate || null });
          }
          results.push({ projectId: proj.id, code: proj.code, phases });
        }
        return results;
      }),

    getStatuses: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertProjectModuleAccess(ctx.user, input.projectId, "timeline");
        return await db.getPhaseMeasureStatuses(input.projectId);
      }),

    responsibleCandidates: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem consultar responsáveis internos das medidas." });
        }
        await assertProjectModuleAccess(ctx.user, input.projectId, "timeline");
        const allUsers = await db.getAllUsers();
        const candidates: Array<{ id: number; name: string; email: string; role: string }> = [];
        for (const candidate of allUsers) {
          if (candidate.accountStatus !== "active" || !candidate.email) continue;
          try {
            await assertProjectAccess(candidate, input.projectId);
            candidates.push({ id: candidate.id, name: getUserDisplayName(candidate), email: candidate.email, role: candidate.role });
          } catch {
            // Não expor utilizadores sem acesso ao projecto da medida.
          }
        }
        return candidates.sort((a, b) => a.name.localeCompare(b.name, "pt"));
      }),

    configureTracking: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        measureId: z.number(),
        ownerId: z.number().nullable().optional(),
        supportName: z.string().trim().max(255).nullable().optional(),
        supportCompany: z.string().trim().max(255).nullable().optional(),
        supportEmail: z.string().trim().email().max(320).nullable().optional(),
        supportPhone: z.string().trim().max(80).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem configurar responsáveis das medidas." });
        }
        await assertProjectAccess(ctx.user, input.projectId);
        const measure = await db.getMeasureById(input.measureId);
        if (!measure) throw new TRPCError({ code: "NOT_FOUND", message: "Medida não encontrada." });

        let ownerName: string | null | undefined;
        if (input.ownerId !== undefined) {
          if (input.ownerId === null) ownerName = null;
          else {
            const owner = await db.getUserById(input.ownerId);
            if (!owner || owner.accountStatus !== "active" || !owner.email) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável seleccionado não está activo ou não tem email." });
            }
            await assertProjectAccess(owner, input.projectId);
            ownerName = getUserDisplayName(owner);
          }
        }

        await db.configurePhaseMeasureTracking({
          projectId: input.projectId,
          measureId: input.measureId,
          ownerId: input.ownerId,
          ownerName,
          supportName: input.supportName,
          supportCompany: input.supportCompany,
          supportEmail: input.supportEmail,
          supportPhone: input.supportPhone,
          updatedBy: ctx.user.id,
        });
        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "phase_measure_tracking_configured",
          entity: "phase_measure_status",
          entityId: input.measureId,
          newValue: JSON.stringify({ projectId: input.projectId, ownerId: input.ownerId, ownerName, supportName: input.supportName, supportCompany: input.supportCompany, supportEmail: input.supportEmail, supportPhone: input.supportPhone }),
        });
        return { success: true };
      }),

    addStatusUpdate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        measureId: z.number(),
        status: z.enum(["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]),
        updateText: z.string().trim().min(3).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectModuleAccess(ctx.user, input.projectId, "timeline");
        const measure = await db.getMeasureById(input.measureId);
        if (!measure) throw new TRPCError({ code: "NOT_FOUND", message: "Medida não encontrada." });
        const tracking = await db.getPhaseMeasureStatus(input.projectId, input.measureId);
        if (!(isAdminOrDono(ctx.user.role) || ctx.user.role === "raa" || tracking?.ownerId === ctx.user.id)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o responsável, a RAA, Admin ou Dono de Obra podem actualizar esta medida." });
        }
        const updateId = await db.addPhaseMeasureUpdate({
          projectId: input.projectId,
          measureId: input.measureId,
          status: input.status,
          updateText: input.updateText,
          createdBy: ctx.user.id,
          createdByName: getUserDisplayName(ctx.user),
        });
        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "phase_measure_status_update",
          entity: "phase_measure_status",
          entityId: input.measureId,
          newValue: JSON.stringify({ projectId: input.projectId, status: input.status, updateId }),
        });
        return { success: true, updateId };
      }),

    updateHistory: protectedProcedure
      .input(z.object({ projectId: z.number(), measureId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertProjectModuleAccess(ctx.user, input.projectId, "timeline");
        const measure = await db.getMeasureById(input.measureId);
        if (!measure) throw new TRPCError({ code: "NOT_FOUND", message: "Medida não encontrada." });
        return await db.getPhaseMeasureUpdates(input.projectId, input.measureId);
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        measureId: z.number(),
        projectId: z.number(),
        status: z.enum(["pendente", "em_curso", "concluido"]),
        notes: z.string().nullable().default(null),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(ctx.user, input.projectId);
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra" });
        }
        await db.upsertPhaseMeasureStatus({
          measureId: input.measureId,
          projectId: input.projectId,
          status: input.status,
          notes: input.notes,
          updatedBy: ctx.user.id,
        });
        return { success: true };
      }),

    setDeliveryDate: protectedProcedure
      .input(z.object({
        measureId: z.number(),
        projectId: z.number(),
        firstDeliveryDate: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(ctx.user, input.projectId);
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Set first delivery date and calculate next (+1 year)
        const nextDate = input.firstDeliveryDate + 365 * 24 * 60 * 60 * 1000;
        await db.upsertPhaseMeasureStatus({
          measureId: input.measureId,
          projectId: input.projectId,
          status: "pendente",
          notes: null,
          updatedBy: ctx.user.id,
          firstDeliveryDate: input.firstDeliveryDate,
          nextDeliveryDate: nextDate,
        } as any);
        return { success: true, nextDeliveryDate: nextDate };
      }),

    confirmAnnualDelivery: protectedProcedure
      .input(z.object({
        measureId: z.number(),
        projectId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(ctx.user, input.projectId);
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Mark as delivered, set next delivery date to +1 year from now
        const now = Date.now();
        const nextDate = now + 365 * 24 * 60 * 60 * 1000;
        await db.upsertPhaseMeasureStatus({
          measureId: input.measureId,
          projectId: input.projectId,
          status: "concluido",
          notes: null,
          updatedBy: ctx.user.id,
          lastDeliveryDate: now,
          nextDeliveryDate: nextDate,
        } as any);
      return { success: true, nextDeliveryDate: nextDate };
      }),
  }),

  // ─── Calendar Events ─────────────────────────────────────────────────────────
  calendarEvents: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "pm" && !input?.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione um projeto individual para consultar o calendário." });
        if (input?.projectId) await assertProjectModuleAccess(ctx.user, input.projectId, "calendar");
        return await db.getCalendarEvents(input?.projectId);
      }),

    listAll: protectedProcedure
      .query(async () => {
        return await db.getCalendarEvents(undefined, true);
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        periodicity: z.string().optional(),
        firstDate: z.number(),
        nextDate: z.number().optional(),
        category: z.string().optional(),
        entityToDeliver: z.string().optional(),
        entityLink: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra" });
        }
        const id = await db.createCalendarEvent({
          projectId: input.projectId ?? null,
          name: input.name,
          description: input.description ?? null,
          periodicity: input.periodicity ?? null,
          firstDate: input.firstDate,
          nextDate: input.nextDate ?? input.firstDate,
          category: input.category ?? null,
          entityToDeliver: input.entityToDeliver ?? null,
          entityLink: input.entityLink ?? null,
          createdBy: ctx.user.id,
          active: 1,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        periodicity: z.string().optional(),
        firstDate: z.number().optional(),
        nextDate: z.number().optional(),
        category: z.string().optional(),
        entityToDeliver: z.string().optional(),
        entityLink: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const current = await db.getCalendarEventById(input.id);
        if (current?.sourceType === "monitoring_plan_assignment") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este prazo é gerido no módulo Planos. Actualize-o nessa página." });
        }
        const { id, ...data } = input;
        await db.updateCalendarEvent(id, data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const current = await db.getCalendarEventById(input.id);
        if (current?.sourceType === "monitoring_plan_assignment") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este prazo é gerido no módulo Planos e não pode ser eliminado no calendário global." });
        }
        await db.deleteCalendarEvent(input.id);
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "reported", "confirmed"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const sourceEvent = await db.getCalendarEventById(input.id);
        if (sourceEvent?.sourceType === "monitoring_plan_assignment") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O estado deste prazo deve ser actualizado no módulo Planos." });
        }
        const updateData: any = { status: input.status };
        // When marked as reported OR confirmed, auto-advance date to next period
        if (input.status === "reported" || input.status === "confirmed") {
          const events = await db.getCalendarEvents();
          const evt = events.find(e => e.id === input.id);
          if (evt && input.status === "reported") {
            // Calculate next date from the CURRENT nextDate (not today)
            // e.g., if nextDate was March 2026 and periodicity is annual, next = March 2027
            const baseDate = evt.nextDate || Date.now();
            let nextDate = baseDate + 365 * 24 * 60 * 60 * 1000; // default +1 year
            const periodicity = (evt.periodicity || "").toLowerCase();
            if (periodicity.includes("semestral")) nextDate = baseDate + 182 * 24 * 60 * 60 * 1000;
            else if (periodicity.includes("trimestral")) nextDate = baseDate + 91 * 24 * 60 * 60 * 1000;
            else if (periodicity.includes("mensal")) nextDate = baseDate + 30 * 24 * 60 * 60 * 1000;
            updateData.lastDeliveredDate = Date.now();
            updateData.nextDate = nextDate;
            updateData.status = "pending"; // Reset to pending for next cycle with new date
          }
        }
        await db.updateCalendarEvent(input.id, updateData);
        return { success: true };
      }),

    assignOwner: protectedProcedure
      .input(z.object({
        id: z.number(),
        ownerId: z.number(),
        ownerName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const current = await db.getCalendarEventById(input.id);
        if (current?.sourceType === "monitoring_plan_assignment") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável deste prazo deve ser definido no módulo Planos." });
        }
        await db.updateCalendarEvent(input.id, { ownerId: input.ownerId, ownerName: input.ownerName });
        return { success: true };
      }),
  }),

  wasteEgars: router({
    subprojects: partnerAllowedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "waste");
        return db.getWasteSubprojects(input.projectId);
      }),
    createSubproject: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), name: z.string().trim().min(1).max(255), code: z.string().trim().max(80).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "ee") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin, Dono de Obra ou a EE podem criar subprojectos." });
        }
        await assertProjectAccess(ctx.user, input.projectId);
        if (ctx.user.role === "ee") {
          const companyProjects = ctx.user.companyId ? await db.getProjectsForCompany(ctx.user.companyId) : [];
          if (!companyProjects.some(item => item.projectId === input.projectId)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "A sua EE não está associada a este projecto." });
          }
        }
        return db.createWasteSubproject({ projectId: input.projectId, name: input.name, code: input.code || null, active: true, createdBy: ctx.user.id });
      }),
    archiveSubproject: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        await db.archiveWasteSubproject(input.id);
        return { success: true };
      }),
    list: partnerAllowedProcedure
      .input(z.object({ projectId: z.number(), year: z.number().optional(), subProjectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const profile = await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "waste");
        if (ctx.user.role === "ee_partner") {
          if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Parceiro sem empresa associada." });
          return db.getWasteEgars(input.projectId, input.year, { subProjectId: input.subProjectId, companyId: ctx.user.companyId });
        }
        if (ctx.user.role === "ee" && ctx.user.companyId) {
          return db.getWasteEgars(input.projectId, input.year, { subProjectId: input.subProjectId, networkCompanyId: ctx.user.companyId });
        }
        return db.getWasteEgars(input.projectId, input.year, { subProjectId: input.subProjectId });
      }),
    create: partnerAllowedProcedure
      .input(z.object({
        projectId: z.number(),
        subProjectId: z.number().int().positive().optional(),
        companyId: z.number().int().positive().optional(),
        date: z.number(),
        egarId: z.string().optional(),
        egarLink: z.string().optional(),
        operator: z.string().optional(),
        lerCode: z.string().min(1),
        designation: z.string().min(1),
        quantity: z.string().min(1),
        correctedQuantity: z.string().optional(),
        destination: z.enum(["recycled", "incinerated", "landfill"]).optional(),
        month: z.number(),
        year: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "ee" && ctx.user.role !== "ee_partner") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para registar Resíduos." });
        }
        const profile = await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "waste");
        if (input.subProjectId) {
          const subProject = await db.getWasteSubprojectById(input.subProjectId);
          if (!subProject || subProject.projectId !== input.projectId || !subProject.active) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Subprojecto inválido para o projecto seleccionado." });
          }
        }
        let contributorCompanyId = input.companyId ?? ctx.user.companyId ?? null;
        let parentCompanyId: number | null = contributorCompanyId;
        if (ctx.user.role === "ee_partner") {
          contributorCompanyId = ctx.user.companyId;
          parentCompanyId = profile!.parentCompanyId;
        } else if (ctx.user.role === "ee") {
          contributorCompanyId = ctx.user.companyId;
          parentCompanyId = ctx.user.companyId;
        }
        const result = await db.createWasteEgar({
          ...input,
          subProjectId: input.subProjectId ?? null,
          companyId: contributorCompanyId,
          parentCompanyId,
          egarId: input.egarId ?? null,
          egarLink: input.egarLink ?? null,
          operator: input.operator ?? null,
          correctedQuantity: input.correctedQuantity || null,
          destination: input.destination ?? "recycled",
          createdBy: ctx.user.id,
        });
        // Registos QA existem apenas para validação transitória e não podem sair do
        // âmbito transacional da aplicação. Os restantes resíduos são arquivados.
        const archivedExternally = await archiveWasteEgarIfRequired(input.egarId, async () => {
          try {
            const { archiveDocument } = await import("./archive-provider");
            const project = await db.getProjectById(input.projectId);
            await archiveDocument("residuo", project?.code || "UNKNOWN", input.year, {
              ...input, id: result.id, createdBy: ctx.user.id,
            }, { month: input.month, year: input.year, lerCode: input.lerCode });
          } catch (e) { console.warn("Waste archive failed (non-fatal):", e); }
        });
        if (!shouldArchiveWasteEgar(input.egarId)) console.info("[Waste] QA e-GAR mantida fora do arquivo externo", { projectId: input.projectId, egarId: input.egarId });
        return { ...result, archiveStatus: archivedExternally ? "arquivado" : "excluido_qa" };
      }),
    delete: partnerAllowedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const record = await db.getWasteEgarById(input.id);
        if (!record) throw new TRPCError({ code: "NOT_FOUND" });
        await assertPartnerProjectModuleAccess(ctx.user, record.projectId, "waste");
        const ownsRecord = record.createdBy === ctx.user.id || (!!ctx.user.companyId && record.companyId === ctx.user.companyId);
        if (!isAdminOrDono(ctx.user.role) && !ownsRecord) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Só pode eliminar registos da sua entidade." });
        }
        if (!isAdminOrDono(ctx.user.role)) {
          if (!isWithinWasteEgarDeletionWindow(record.createdAt)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "A e-GAR só pode ser eliminada pelo autor ou pela sua entidade nas primeiras 48 horas. A Administração pode eliminá-la posteriormente." });
          }
        }
        await db.deleteWasteEgar(input.id);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "waste_egar_delete", "waste_egars", input.id, JSON.stringify({ projectId: record.projectId, egarId: record.egarId, lerCode: record.lerCode, createdAt: record.createdAt }), null);
        return { success: true };
      }),
    wasteMap: partnerAllowedProcedure
      .input(z.object({ projectId: z.number().int().positive(), year: z.number().int().min(2020).max(2100), companyIds: z.array(z.number().int().positive()).max(100).optional() }))
      .query(async ({ ctx, input }) => {
        const profile = await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "waste");
        const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        let scopeSql = sql``;
        if (ctx.user.role === "ee_partner") {
          scopeSql = sql` AND e.companyId = ${ctx.user.companyId}`;
        } else if (ctx.user.role === "ee") {
          scopeSql = sql` AND (e.companyId = ${ctx.user.companyId} OR e.parentCompanyId = ${ctx.user.companyId})`;
        } else if (input.companyIds?.length) {
          scopeSql = sql` AND e.companyId IN (${sql.join(input.companyIds.map(id => sql`${id}`), sql`, `)})`;
        }
        const rows = await database.execute(sql`
          SELECT e.lerCode, e.designation, e.month, e.year, e.companyId, COALESCE(c.shortName, c.name, 'Sem entidade') AS companyName,
                 SUM(CAST(COALESCE(e.correctedQuantity, e.quantity) AS DECIMAL(20,6))) AS quantity
          FROM waste_egars e
          LEFT JOIN companies c ON c.id = e.companyId
          WHERE e.projectId = ${input.projectId} AND e.year = ${input.year}${scopeSql}
          GROUP BY e.lerCode, e.designation, e.month, e.year, e.companyId, c.shortName, c.name
          ORDER BY e.lerCode ASC, e.month ASC, companyName ASC
        `);
        return ((rows as any)[0] || []).map((row: any) => ({ ...row, month: Number(row.month), year: Number(row.year), companyId: row.companyId === null ? null : Number(row.companyId), quantity: Number(row.quantity) }));
      }),
  }),

  partnerDashboard: router({
    entities: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard exclusivo da EE." });
      await assertProjectAccess(ctx.user, input.projectId);
      const assigned = await db.getProjectsForCompany(ctx.user.companyId);
      if (!assigned.some(item => item.projectId === input.projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "A sua EE não está associada a este projecto." });
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await database.execute(sql`
        SELECT c.id, c.name, c.shortName, 'ee' AS entityType, 1 AS allowKpi, 1 AS allowWaste
        FROM companies c WHERE c.id = ${ctx.user.companyId} AND c.active = 1
        UNION ALL
        SELECT c.id, c.name, c.shortName, 'eep' AS entityType, p.allowKpi, p.allowWaste
        FROM partner_company_profiles p
        JOIN companies c ON c.id = p.companyId AND c.active = 1
        JOIN project_companies pc ON pc.companyId = c.id AND pc.projectId = ${input.projectId}
        WHERE p.parentCompanyId = ${ctx.user.companyId} AND p.active = 1
        ORDER BY entityType ASC, shortName ASC`);
      return (rows as any)[0] || [];
    }),
    kpiMatrix: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), year: z.number().int().min(2020).max(2100), startWeek: z.number().int().min(1).max(53).default(1), endWeek: z.number().int().min(1).max(53).default(53) })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard exclusivo da EE." });
      await assertProjectAccess(ctx.user, input.projectId);
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await database.execute(sql`
        SELECT ks.id, ks.companyId, c.shortName, ks.weekNumber, ks.weekYear, ks.status, ks.updatedAt
        FROM kpi_submissions ks JOIN companies c ON c.id = ks.companyId
        WHERE ks.projectId = ${input.projectId} AND ks.weekYear = ${input.year}
          AND ks.weekNumber BETWEEN ${input.startWeek} AND ${input.endWeek}
          AND (ks.companyId = ${ctx.user.companyId} OR ks.parentCompanyId = ${ctx.user.companyId})
        ORDER BY ks.weekNumber ASC, c.shortName ASC`);
      return (rows as any)[0] || [];
    }),
    kpiSeries: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), year: z.number().int().min(2020).max(2100), companyId: z.number().int().positive().nullable().default(null) })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard exclusivo da EE." });
      await assertProjectAccess(ctx.user, input.projectId);
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.companyId) {
        const allowed = await database.execute(sql`SELECT c.id FROM companies c LEFT JOIN partner_company_profiles p ON p.companyId = c.id WHERE c.id = ${input.companyId} AND (c.id = ${ctx.user.companyId} OR (p.parentCompanyId = ${ctx.user.companyId} AND p.active = 1)) LIMIT 1`);
        if (!(allowed as any)[0]?.length) throw new TRPCError({ code: "FORBIDDEN", message: "Entidade fora da rede da sua EE." });
      }
      let companyScope = sql` AND (ks.companyId = ${ctx.user.companyId} OR ks.parentCompanyId = ${ctx.user.companyId})`;
      if (input.companyId) companyScope = sql` AND ks.companyId = ${input.companyId}`;
      const [metrics, values] = await Promise.all([
        database.execute(sql`SELECT id, name, unit, target, category, sortOrder FROM kpi_metrics WHERE active = 1 ORDER BY sortOrder ASC, id ASC`),
        database.execute(sql`SELECT kv.metricId, kv.value, ks.companyId, c.shortName, ks.weekNumber, ks.weekYear FROM kpi_values kv JOIN kpi_submissions ks ON ks.id = kv.submissionId JOIN companies c ON c.id = ks.companyId WHERE ks.projectId = ${input.projectId} AND ks.weekYear = ${input.year}${companyScope} ORDER BY kv.metricId, ks.weekNumber, c.shortName`),
      ]);
      return { metrics: (metrics as any)[0] || [], values: (values as any)[0] || [] };
    }),
    wasteMap: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), year: z.number().int().min(2020).max(2100), companyId: z.number().int().positive().nullable().default(null) })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard exclusivo da EE." });
      await assertProjectAccess(ctx.user, input.projectId);
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.companyId) {
        const allowed = await database.execute(sql`SELECT c.id FROM companies c LEFT JOIN partner_company_profiles p ON p.companyId = c.id WHERE c.id = ${input.companyId} AND (c.id = ${ctx.user.companyId} OR (p.parentCompanyId = ${ctx.user.companyId} AND p.active = 1)) LIMIT 1`);
        if (!(allowed as any)[0]?.length) throw new TRPCError({ code: "FORBIDDEN", message: "Entidade fora da rede da sua EE." });
      }
      let companyScope = sql` AND (we.companyId = ${ctx.user.companyId} OR we.parentCompanyId = ${ctx.user.companyId})`;
      if (input.companyId) companyScope = sql` AND we.companyId = ${input.companyId}`;
      const rows = await database.execute(sql`SELECT we.id, we.companyId, c.shortName, we.subProjectId, sp.name AS subProjectName, sp.code AS subProjectCode, we.lerCode, we.designation, we.quantity, we.correctedQuantity, we.destination, we.month, we.year FROM waste_egars we JOIN companies c ON c.id = we.companyId LEFT JOIN waste_subprojects sp ON sp.id = we.subProjectId WHERE we.projectId = ${input.projectId} AND we.year = ${input.year}${companyScope} ORDER BY we.month ASC, c.shortName ASC`);
      return (rows as any)[0] || [];
    }),
  }),

  feedback: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "dono_obra") return [];
      const database = await db.getDb(); if (!database) return []; const result = await database.execute(sql`SELECT * FROM user_feedback ORDER BY createdAt DESC`);
      return (result as any)[0] as any[];
    }),
    create: protectedProcedure.input(z.object({ content: z.string().min(1), category: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const database2 = await db.getDb(); if (!database2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); await database2.execute(sql`INSERT INTO user_feedback (userId, userName, userEmail, content, category) VALUES (${ctx.user.id}, ${ctx.user.name}, ${ctx.user.email}, ${input.content}, ${input.category || "melhoria"})`);
      return { success: true };
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.number(), status: z.string(), adminNotes: z.string().optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const database3 = await db.getDb(); if (!database3) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); await database3.execute(sql`UPDATE user_feedback SET status = ${input.status}, adminNotes = ${input.adminNotes || null} WHERE id = ${input.id}`);
      return { success: true };
    }),
  }),

  // ─── KPI's de Sustentabilidade ──────────────────────────────────────────
  kpi: router({
    metrics: partnerAllowedProcedure.query(async ({ ctx }) => {
      await getActivePartnerProfile(ctx.user, "kpi");
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await database.execute(sql`SELECT * FROM kpi_metrics WHERE active = 1 ORDER BY sortOrder ASC`);
      return (rows as any)[0] || [];
    }),
    editableCompanies: partnerAllowedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (ctx.user.role === "ee_partner") return ctx.user.companyId ? (await database.execute(sql`SELECT c.id, c.name, c.shortName, 'ee_partner' AS sourceType FROM companies c WHERE c.id = ${ctx.user.companyId} AND c.active = 1 LIMIT 1`) as any)[0] || [] : [];
      if (ctx.user.role === "ee" && ctx.user.companyId) {
        const rows = await database.execute(sql`SELECT c.id, c.name, c.shortName, CASE WHEN c.id = ${ctx.user.companyId} THEN 'ee' ELSE 'ee_partner' END AS sourceType FROM companies c JOIN project_companies pc ON pc.companyId = c.id AND pc.projectId = ${input.projectId} LEFT JOIN partner_company_profiles p ON p.companyId = c.id AND p.active = 1 WHERE c.active = 1 AND (c.id = ${ctx.user.companyId} OR p.parentCompanyId = ${ctx.user.companyId}) ORDER BY sourceType ASC, c.shortName ASC`);
        return (rows as any)[0] || [];
      }
      if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await database.execute(sql`SELECT c.id, c.name, c.shortName, CASE WHEN p.companyId IS NULL THEN 'ee' ELSE 'ee_partner' END AS sourceType FROM companies c JOIN project_companies pc ON pc.companyId = c.id AND pc.projectId = ${input.projectId} LEFT JOIN partner_company_profiles p ON p.companyId = c.id AND p.active = 1 WHERE c.active = 1 AND c.companyType IN ('ee', 'ee_partner') ORDER BY c.shortName ASC`);
      return (rows as any)[0] || [];
    }),
    matrix: partnerAllowedProcedure.input(z.object({ projectId: z.number() })).query(async ({ ctx, input }) => {
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let scope = sql``;
      if (ctx.user.role === "ee_partner") scope = sql` AND ks.companyId = ${ctx.user.companyId}`;
      else if (ctx.user.role === "ee" && ctx.user.companyId) scope = sql` AND (ks.companyId = ${ctx.user.companyId} OR ks.parentCompanyId = ${ctx.user.companyId})`;
      const rows = await database.execute(sql`SELECT ks.id, ks.companyId, ks.parentCompanyId, ks.sourceType, ks.userId, ks.weekNumber, ks.weekYear, ks.status, ks.createdAt, c.name as companyName, c.shortName, u.name as contributorName FROM kpi_submissions ks JOIN companies c ON c.id = ks.companyId LEFT JOIN users u ON u.id = ks.userId WHERE ks.projectId = ${input.projectId}${scope} ORDER BY ks.weekYear DESC, ks.weekNumber DESC, c.shortName ASC`);
      return (rows as any)[0] || [];
    }),
    values: partnerAllowedProcedure.input(z.object({ submissionId: z.number() })).query(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const headers = await database.execute(sql`SELECT projectId, companyId, parentCompanyId FROM kpi_submissions WHERE id = ${input.submissionId} LIMIT 1`);
      const header = (headers as any)[0]?.[0];
      if (!header) throw new TRPCError({ code: "NOT_FOUND" });
      await assertPartnerProjectModuleAccess(ctx.user, Number(header.projectId), "kpi");
      if (ctx.user.role === "ee_partner" && Number(header.companyId) !== Number(ctx.user.companyId)) throw new TRPCError({ code: "FORBIDDEN" });
      if (ctx.user.role === "ee" && Number(header.companyId) !== Number(ctx.user.companyId) && Number(header.parentCompanyId) !== Number(ctx.user.companyId)) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await database.execute(sql`SELECT * FROM kpi_values WHERE submissionId = ${input.submissionId}`);
      return (rows as any)[0] || [];
    }),
    draft: partnerAllowedProcedure.input(z.object({ projectId: z.number().int().positive(), companyId: z.number().int().positive().optional(), weekNumber: z.number().int().min(1).max(53), weekYear: z.number().int().min(2020).max(2100) })).query(async ({ ctx, input }) => {
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const contribution = await resolveKpiContribution(ctx.user, database, input.projectId, input.companyId || ctx.user.companyId || 0);
      const rows = await database.execute(sql`SELECT id, companyId, parentCompanyId, sourceType, userId, weekNumber, weekYear, status, createdAt, updatedAt FROM kpi_submissions WHERE projectId = ${input.projectId} AND companyId = ${contribution.companyId} AND weekNumber = ${input.weekNumber} AND weekYear = ${input.weekYear} LIMIT 1`);
      const submission = (rows as any)[0]?.[0];
      if (!submission) return null;
      const [values, changes] = await Promise.all([
        database.execute(sql`SELECT metricId, value FROM kpi_values WHERE submissionId = ${submission.id} ORDER BY metricId ASC`),
        database.execute(sql`SELECT action, actorId, actorName, summary, createdAt FROM kpi_submission_changes WHERE submissionId = ${submission.id} ORDER BY createdAt DESC LIMIT 20`),
      ]);
      return { ...submission, values: (values as any)[0] || [], changes: (changes as any)[0] || [] };
    }),
    allValues: partnerAllowedProcedure.input(z.object({ projectId: z.number(), weekYear: z.number().optional(), weekNumber: z.number().optional(), startWeek: z.number().int().min(1).max(53).optional(), endWeek: z.number().int().min(1).max(53).optional() })).query(async ({ ctx, input }) => {
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      if (input.startWeek && input.endWeek && input.startWeek > input.endWeek) throw new TRPCError({ code: "BAD_REQUEST", message: "A semana inicial não pode ser posterior à semana final." });
      if ((input.startWeek || input.endWeek) && !input.weekYear) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione o ano do período KPI." });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let q = sql`SELECT kv.metricId, kv.value, ks.weekNumber, ks.weekYear, ks.companyId, ks.parentCompanyId, ks.sourceType, c.shortName as companyName FROM kpi_values kv JOIN kpi_submissions ks ON ks.id = kv.submissionId JOIN companies c ON c.id = ks.companyId WHERE ks.projectId = ${input.projectId} AND ks.status <> 'draft'`;
      if (ctx.user.role === "ee_partner") q = sql`${q} AND ks.companyId = ${ctx.user.companyId}`;
      else if (ctx.user.role === "ee" && ctx.user.companyId) q = sql`${q} AND (ks.companyId = ${ctx.user.companyId} OR ks.parentCompanyId = ${ctx.user.companyId})`;
      if (input.weekYear) q = sql`${q} AND ks.weekYear = ${input.weekYear}`;
      if (input.weekNumber) q = sql`${q} AND ks.weekNumber = ${input.weekNumber}`;
      if (input.startWeek) q = sql`${q} AND ks.weekNumber >= ${input.startWeek}`;
      if (input.endWeek) q = sql`${q} AND ks.weekNumber <= ${input.endWeek}`;
      const rows = await database.execute(q);
      return (rows as any)[0] || [];
    }),
    saveDraft: partnerAllowedProcedure.input(z.object({ projectId: z.number().int().positive(), companyId: z.number().int().positive(), weekNumber: z.number().int().min(1).max(53), weekYear: z.number().int().min(2020).max(2100), values: z.array(z.object({ metricId: z.number().int().positive(), value: z.string().max(255) })).max(100), completeWeekSnapshot: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "ee" && ctx.user.role !== "ee_partner") throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para guardar rascunhos KPI." });
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const contribution = await resolveKpiContribution(ctx.user, database, input.projectId, input.companyId);
      return writeKpiSubmission({ user: ctx.user, database, projectId: input.projectId, weekNumber: input.weekNumber, weekYear: input.weekYear, contribution, values: input.values, mode: "draft", completeWeekSnapshot: input.completeWeekSnapshot });
    }),
    submit: partnerAllowedProcedure.input(z.object({ projectId: z.number().int().positive(), companyId: z.number().int().positive(), weekNumber: z.number().int().min(1).max(53), weekYear: z.number().int().min(2020).max(2100), values: z.array(z.object({ metricId: z.number().int().positive(), value: z.string().max(255) })).max(100), completeWeekSnapshot: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "ee" && ctx.user.role !== "ee_partner") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas a EE, as EEP autorizadas ou a administração podem submeter KPI." });
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const contribution = await resolveKpiContribution(ctx.user, database, input.projectId, input.companyId);
      const result = await writeKpiSubmission({ user: ctx.user, database, projectId: input.projectId, weekNumber: input.weekNumber, weekYear: input.weekYear, contribution, values: input.values, mode: "submit", completeWeekSnapshot: input.completeWeekSnapshot });
      await archiveKpiSubmissionWhenFinal(input.projectId, contribution, input.weekNumber, input.weekYear, result.submissionId, input.values, ctx.user.id);
      return { success: true, ...result };
    }),
    correct: partnerAllowedProcedure.input(z.object({ projectId: z.number().int().positive(), companyId: z.number().int().positive(), weekNumber: z.number().int().min(1).max(53), weekYear: z.number().int().min(2020).max(2100), values: z.array(z.object({ metricId: z.number().int().positive(), value: z.string().max(255) })).max(100), completeWeekSnapshot: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const contribution = await resolveKpiContribution(ctx.user, database, input.projectId, input.companyId);
      const result = await writeKpiSubmission({ user: ctx.user, database, projectId: input.projectId, weekNumber: input.weekNumber, weekYear: input.weekYear, contribution, values: input.values, mode: "correct", completeWeekSnapshot: input.completeWeekSnapshot });
      await archiveKpiSubmissionWhenFinal(input.projectId, contribution, input.weekNumber, input.weekYear, result.submissionId, input.values, ctx.user.id);
      return result;
    }),
    importExcel: partnerAllowedProcedure.input(z.object({ projectId: z.number().int().positive(), companyId: z.number().int().positive(), weekYear: z.number().int().min(2020).max(2100), mode: z.enum(["draft", "submit"]).default("draft"), filename: z.string().min(1).max(255), data: z.string().min(20).max(15 * 1024 * 1024) })).mutation(async ({ ctx, input }) => {
      if (!/\.xlsx$/i.test(input.filename)) throw new TRPCError({ code: "BAD_REQUEST", message: "Importe apenas ficheiros Excel (.xlsx) gerados pelo modelo KPI." });
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const contribution = await resolveKpiContribution(ctx.user, database, input.projectId, input.companyId);
      let workbook: ExcelJS.Workbook;
      try { workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(input.data, "base64") as any); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "O ficheiro Excel não é válido." }); }
      const worksheet = workbook.getWorksheet("Importar KPI") || workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount > 5001) throw new TRPCError({ code: "BAD_REQUEST", message: "O ficheiro Excel está vazio ou excede 5 000 linhas." });
      const grouped = new Map<string, { weekNumber: number; weekYear: number; values: KpiValueInput[] }>();
      const addValue = (weekYear: number, weekNumber: number, metricId: number, valueRaw: unknown, rowNumber: number) => {
        const value = String(valueRaw ?? "").trim();
        if (!value) return;
        if (!Number.isInteger(weekYear) || weekYear < 2020 || weekYear > 2100 || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53 || !Number.isInteger(metricId) || metricId < 1 || value.length > 255) throw new TRPCError({ code: "BAD_REQUEST", message: `Linha ${rowNumber}: confirme o ID da métrica e o valor da semana.` });
        const key = `${weekYear}-${weekNumber}`; const group = grouped.get(key) || { weekNumber, weekYear, values: [] }; group.values.push({ metricId, value }); grouped.set(key, group);
      };
      let headerRowNumber = 0;
      let headerValues: string[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (headerRowNumber || rowNumber > 10) return;
        const values = (row.values as any[]).slice(1).map(value => String(value ?? "").trim());
        if (values.some(value => value.toLowerCase() === "id da métrica")) { headerRowNumber = rowNumber; headerValues = values; }
      });
      const metricIdColumn = headerValues.findIndex(value => value.toLowerCase() === "id da métrica") + 1;
      const weekColumns = headerValues.map((header, index) => {
        const match = /^semana\s*(\d{1,2})$/i.exec(header) || /^s(\d{1,2})$/i.exec(header);
        return match ? { column: index + 1, weekNumber: Number(match[1]) } : null;
      }).filter((value): value is { column: number; weekNumber: number } => value !== null);
      if (headerRowNumber && metricIdColumn && weekColumns.length > 0) {
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowNumber) return;
          const metricId = Number(row.getCell(metricIdColumn).value);
          const hasValue = weekColumns.some(({ column }) => { const value = row.getCell(column).value; return value !== undefined && value !== null && String(value).trim() !== ""; });
          if (!hasValue) return;
          if (!Number.isInteger(metricId) || metricId < 1) throw new TRPCError({ code: "BAD_REQUEST", message: `Linha ${rowNumber}: confirme o ID da métrica.` });
          for (const { column, weekNumber } of weekColumns) addValue(input.weekYear, weekNumber, metricId, row.getCell(column).value, rowNumber);
        });
      } else {
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const [, yearRaw, weekRaw, metricIdRaw, _metricName, _unit, valueRaw] = row.values as any[];
          if ([yearRaw, weekRaw, metricIdRaw, valueRaw].every(value => value === undefined || value === null || value === "")) return;
          addValue(Number(yearRaw), Number(weekRaw), Number(metricIdRaw), valueRaw, rowNumber);
        });
      }
      if (!grouped.size) throw new TRPCError({ code: "BAD_REQUEST", message: "O Excel não contém valores KPI para importar." });
      if (grouped.size > 53) throw new TRPCError({ code: "BAD_REQUEST", message: "O limite de importação é 53 semanas de cada vez." });
      const results = [];
      for (const group of Array.from(grouped.values())) {
        const result = await writeKpiSubmission({ user: ctx.user, database, projectId: input.projectId, weekNumber: group.weekNumber, weekYear: group.weekYear, contribution, values: group.values, mode: input.mode === "draft" ? "import_draft" : "import_submit" });
        if (input.mode === "submit") await archiveKpiSubmissionWhenFinal(input.projectId, contribution, group.weekNumber, group.weekYear, result.submissionId, group.values, ctx.user.id);
        results.push(result);
      }
      return { success: true, importedWeeks: results.length, mode: input.mode, results };
    }),
    upsertMetric: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(3).max(120), nameEn: z.string().trim().max(120).optional(), unit: z.string().trim().min(1).max(24), target: z.string().trim().max(80).optional(), category: z.enum(["workforce", "transport", "fuel", "generators", "energy", "water", "emissions", "air_noise", "incidents", "other"]), inputType: z.enum(["manual", "calculated"]).default("manual"), formulaType: z.enum(["fuel_to_co2", "sum_co2"]).optional(), formulaSourceMetricId: z.number().int().positive().optional(), pci: z.string().trim().max(40).optional(), emissionFactor: z.string().trim().max(40).optional(), density: z.string().trim().max(40).optional(), sortOrder: z.number().int().min(0).max(999).optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.inputType === "calculated" && !input.formulaType) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione a fórmula para a métrica calculada." });
      if (input.formulaType === "fuel_to_co2" && !input.formulaSourceMetricId) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione a métrica de origem para o cálculo." });
      const duplicateQuery = input.id
        ? sql`SELECT id FROM kpi_metrics WHERE LOWER(name) = LOWER(${input.name}) AND active = 1 AND id <> ${input.id} LIMIT 1`
        : sql`SELECT id FROM kpi_metrics WHERE LOWER(name) = LOWER(${input.name}) AND active = 1 LIMIT 1`;
      const duplicates = await database.execute(duplicateQuery);
      if ((duplicates as any)[0]?.length) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma métrica KPI activa com este nome." });
      const calculated = input.inputType === "calculated";
      if (input.id) {
        await database.execute(sql`UPDATE kpi_metrics SET name=${input.name}, nameEn=${input.nameEn||null}, unit=${input.unit}, target=${input.target||null}, category=${input.category}, inputType=${input.inputType}, formulaType=${calculated ? input.formulaType || null : null}, formulaSourceMetricId=${calculated ? input.formulaSourceMetricId || null : null}, pci=${calculated ? input.pci || null : null}, emissionFactor=${calculated ? input.emissionFactor || null : null}, density=${calculated ? input.density || null : null}, sortOrder=${input.sortOrder||0} WHERE id=${input.id}`);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "kpi_metric_updated", "kpi_metrics", input.id, null, JSON.stringify({ name: input.name, category: input.category, inputType: input.inputType }));
        return { success: true, id: input.id };
      } else {
        const result = await database.execute(sql`INSERT INTO kpi_metrics (name, nameEn, unit, target, category, inputType, formulaType, formulaSourceMetricId, pci, emissionFactor, density, sortOrder) VALUES (${input.name}, ${input.nameEn||null}, ${input.unit}, ${input.target||null}, ${input.category}, ${input.inputType}, ${calculated ? input.formulaType || null : null}, ${calculated ? input.formulaSourceMetricId || null : null}, ${calculated ? input.pci || null : null}, ${calculated ? input.emissionFactor || null : null}, ${calculated ? input.density || null : null}, ${input.sortOrder||0})`);
        const id = (result as any)[0].insertId;
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "kpi_metric_created", "kpi_metrics", id, null, JSON.stringify({ name: input.name, category: input.category, inputType: input.inputType }));
        return { success: true, id };
      }
    }),
    deleteMetric: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await database.execute(sql`UPDATE kpi_metrics SET active = 0 WHERE id = ${input.id}`);
      await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "kpi_metric_archived", "kpi_metrics", input.id, null, null);
      return { success: true };
    }),
    // KPI Targets (Metas)
    targets: partnerAllowedProcedure.input(z.object({ projectId: z.number(), year: z.number().optional() })).query(async ({ ctx, input }) => {
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let q = sql`SELECT * FROM kpi_targets WHERE projectId = ${input.projectId}`;
      if (input.year) q = sql`${q} AND year = ${input.year}`;
      const rows = await database.execute(q);
      return (rows as any)[0] || [];
    }),
    upsertTarget: protectedProcedure.input(z.object({ id: z.number().optional(), metricId: z.number(), projectId: z.number(), targetType: z.string(), targetValue: z.string(), targetDirection: z.string(), year: z.number(), month: z.number().optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.id) {
        await database.execute(sql`UPDATE kpi_targets SET targetValue=${input.targetValue}, targetDirection=${input.targetDirection}, targetType=${input.targetType}, month=${input.month||null} WHERE id=${input.id}`);
        return { success: true, id: input.id };
      } else {
        const result = await database.execute(sql`INSERT INTO kpi_targets (metricId, projectId, targetType, targetValue, targetDirection, year, month, createdBy) VALUES (${input.metricId}, ${input.projectId}, ${input.targetType}, ${input.targetValue}, ${input.targetDirection}, ${input.year}, ${input.month||null}, ${ctx.user.id})`);
        return { success: true, id: (result as any)[0].insertId };
      }
    }),
    deleteTarget: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await database.execute(sql`DELETE FROM kpi_targets WHERE id = ${input.id}`);
      return { success: true };
    }),
    // KPI Incidents
    listIncidents: partnerAllowedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "ee_partner" && !input.projectId) throw new TRPCError({ code: "FORBIDDEN" });
        if (input.projectId) await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        let query = database.select().from(schema.kpiIncidents);
        if (input.projectId) {
          query = query.where(eq(schema.kpiIncidents.projectId, input.projectId)) as any;
        }
        return await query;
      }),
    createIncident: protectedProcedure
      .input(z.object({ projectId: z.number(), name: z.string(), date: z.string(), status: z.string(), severity: z.string(), link: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await database.insert(schema.kpiIncidents).values({ ...input, createdBy: ctx.user.email });
        return { success: true };
      }),
    deleteIncident: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await database.delete(schema.kpiIncidents).where(eq(schema.kpiIncidents.id, input.id));
        return { success: true };
      }),
  }),

  // ─── Operação do edifício — SIN01 / NEST ─────────────────────────────────
  operation: router({
    overview: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
      .query(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId);
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível." });
        const start = input.startDate ? Date.parse(`${input.startDate}T00:00:00Z`) : 0;
        const end = input.endDate ? Date.parse(`${input.endDate}T23:59:59Z`) : Date.now() + 86_400_000;
        const result = await database.execute(sql`
          SELECT metricCode, metricLabel, category, unit, value, measuredAt, granularity, source, dataQuality, qualityNote
          FROM operation_readings
          WHERE projectId = ${input.projectId} AND measuredAt >= ${start} AND measuredAt <= ${end}
          ORDER BY measuredAt ASC, metricCode ASC
          LIMIT 12000
        `);
        const rawReadings = ((result as any)[0] || []).map((row: any) => ({ ...row, measuredAt: Number(row.measuredAt), value: Number(row.value) }));
        const readings = [...rawReadings, ...buildCalculatedWueReadings(rawReadings)];
        const usable = readings.filter((row: any) => row.dataQuality !== "invalid");
        const latest = new Map<string, any>();
        for (const reading of usable) latest.set(reading.metricCode, reading);
        const quality = summarizeOperationQuality(readings);
        const invoiceSummaryResult = await database.execute(sql`
          SELECT COUNT(*) AS invoiceCount, COALESCE(SUM(CAST(totalCost AS DECIMAL(20,6))), 0) AS totalCostEur
          FROM operation_invoices
          WHERE projectId = ${input.projectId} AND periodEnd >= ${input.startDate || "0000-01-01"} AND periodStart <= ${input.endDate || "9999-12-31"}
        `);
        const invoiceSummary = (invoiceSummaryResult as any)[0]?.[0] || {};
        const settingsResult = await database.execute(sql`SELECT configurationMode, electricityCarbonFactorKgKwh, waterPotableCarbonFactorKgM3, waterIndustrialCarbonFactorKgM3, maxPue, maxSeawaterReturnTempC, minSeawaterFlowLps, maxSeawaterFlowLps, maxSeawaterDeltaTK, electricityPriceEurKwh, waterPriceEurM3, annualMaintenanceBudgetEur, targetPue, targetWueLkwh, forecastHorizonDays, coolingStrategyBaseline, updatedAt FROM operation_settings WHERE projectId = ${input.projectId} LIMIT 1`);
        const settings = (settingsResult as any)[0]?.[0] || null;
        const environmental = calculateOperationEnvironmentalMetrics(readings, settings);
        const forecast = buildOperationTrendForecast(readings, settings);
        return { readings, latest: Object.fromEntries(latest), quality, settings, environmental, forecast, financial: { invoiceCount: Number(invoiceSummary.invoiceCount || 0), totalCostEur: Number(invoiceSummary.totalCostEur || 0), carbonStatus: environmental.carbonStatus } };
      }),
    settings: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId);
        const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await database.execute(sql`SELECT configurationMode, electricityCarbonFactorKgKwh, waterPotableCarbonFactorKgM3, waterIndustrialCarbonFactorKgM3, maxPue, maxSeawaterReturnTempC, minSeawaterFlowLps, maxSeawaterFlowLps, maxSeawaterDeltaTK, electricityPriceEurKwh, waterPriceEurM3, annualMaintenanceBudgetEur, targetPue, targetWueLkwh, forecastHorizonDays, coolingStrategyBaseline, updatedAt FROM operation_settings WHERE projectId = ${input.projectId} LIMIT 1`);
        return (result as any)[0]?.[0] || null;
      }),
    updateSettings: protectedProcedure
      .input(z.object({
        projectId: z.number().int().positive(),
        configurationMode: z.enum(["illustrative", "approved"]),
        electricityCarbonFactorKgKwh: z.number().finite().min(0).max(10).nullable(),
        waterPotableCarbonFactorKgM3: z.number().finite().min(0).max(100).nullable(),
        waterIndustrialCarbonFactorKgM3: z.number().finite().min(0).max(100).nullable(),
        maxPue: z.number().finite().positive().max(10).nullable(),
        maxSeawaterReturnTempC: z.number().finite().min(-20).max(100).nullable(),
        minSeawaterFlowLps: z.number().finite().min(0).max(100000).nullable(),
        maxSeawaterFlowLps: z.number().finite().min(0).max(100000).nullable(),
        maxSeawaterDeltaTK: z.number().finite().min(0).max(100).nullable(),
        electricityPriceEurKwh: z.number().finite().min(0).max(100).nullable(),
        waterPriceEurM3: z.number().finite().min(0).max(10000).nullable(),
        annualMaintenanceBudgetEur: z.number().finite().min(0).max(100_000_000).nullable(),
        targetPue: z.number().finite().positive().max(10).nullable(),
        targetWueLkwh: z.number().finite().min(0).max(10000).nullable(),
        forecastHorizonDays: z.number().int().min(7).max(730).nullable(),
        coolingStrategyBaseline: z.enum(["agua_mar", "chiller", "hibrido_adiabatico", "torres_evaporativas", "outro"]).nullable(),
      }).superRefine((value, issue) => {
        if (value.minSeawaterFlowLps !== null && value.maxSeawaterFlowLps !== null && value.minSeawaterFlowLps > value.maxSeawaterFlowLps) issue.addIssue({ code: "custom", message: "O caudal mínimo não pode exceder o máximo.", path: ["minSeawaterFlowLps"] });
      }))
      .mutation(async ({ ctx, input }) => {
        assertAdminOnly(ctx.user);
        await assertOperationAccess(ctx.user, input.projectId);
        const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const previousResult = await database.execute(sql`SELECT configurationMode, electricityCarbonFactorKgKwh, waterPotableCarbonFactorKgM3, waterIndustrialCarbonFactorKgM3, maxPue, maxSeawaterReturnTempC, minSeawaterFlowLps, maxSeawaterFlowLps, maxSeawaterDeltaTK, electricityPriceEurKwh, waterPriceEurM3, annualMaintenanceBudgetEur, targetPue, targetWueLkwh, forecastHorizonDays, coolingStrategyBaseline FROM operation_settings WHERE projectId = ${input.projectId} LIMIT 1`);
        const previous = (previousResult as any)[0]?.[0] || null;
        await database.execute(sql`
          INSERT INTO operation_settings (projectId, configurationMode, electricityCarbonFactorKgKwh, waterPotableCarbonFactorKgM3, waterIndustrialCarbonFactorKgM3, maxPue, maxSeawaterReturnTempC, minSeawaterFlowLps, maxSeawaterFlowLps, maxSeawaterDeltaTK, electricityPriceEurKwh, waterPriceEurM3, annualMaintenanceBudgetEur, targetPue, targetWueLkwh, forecastHorizonDays, coolingStrategyBaseline, updatedBy)
          VALUES (${input.projectId}, ${input.configurationMode}, ${input.electricityCarbonFactorKgKwh === null ? null : String(input.electricityCarbonFactorKgKwh)}, ${input.waterPotableCarbonFactorKgM3 === null ? null : String(input.waterPotableCarbonFactorKgM3)}, ${input.waterIndustrialCarbonFactorKgM3 === null ? null : String(input.waterIndustrialCarbonFactorKgM3)}, ${input.maxPue === null ? null : String(input.maxPue)}, ${input.maxSeawaterReturnTempC === null ? null : String(input.maxSeawaterReturnTempC)}, ${input.minSeawaterFlowLps === null ? null : String(input.minSeawaterFlowLps)}, ${input.maxSeawaterFlowLps === null ? null : String(input.maxSeawaterFlowLps)}, ${input.maxSeawaterDeltaTK === null ? null : String(input.maxSeawaterDeltaTK)}, ${input.electricityPriceEurKwh === null ? null : String(input.electricityPriceEurKwh)}, ${input.waterPriceEurM3 === null ? null : String(input.waterPriceEurM3)}, ${input.annualMaintenanceBudgetEur === null ? null : String(input.annualMaintenanceBudgetEur)}, ${input.targetPue === null ? null : String(input.targetPue)}, ${input.targetWueLkwh === null ? null : String(input.targetWueLkwh)}, ${input.forecastHorizonDays}, ${input.coolingStrategyBaseline}, ${ctx.user.id})
          ON DUPLICATE KEY UPDATE configurationMode = VALUES(configurationMode), electricityCarbonFactorKgKwh = VALUES(electricityCarbonFactorKgKwh), waterPotableCarbonFactorKgM3 = VALUES(waterPotableCarbonFactorKgM3), waterIndustrialCarbonFactorKgM3 = VALUES(waterIndustrialCarbonFactorKgM3), maxPue = VALUES(maxPue), maxSeawaterReturnTempC = VALUES(maxSeawaterReturnTempC), minSeawaterFlowLps = VALUES(minSeawaterFlowLps), maxSeawaterFlowLps = VALUES(maxSeawaterFlowLps), maxSeawaterDeltaTK = VALUES(maxSeawaterDeltaTK), electricityPriceEurKwh = VALUES(electricityPriceEurKwh), waterPriceEurM3 = VALUES(waterPriceEurM3), annualMaintenanceBudgetEur = VALUES(annualMaintenanceBudgetEur), targetPue = VALUES(targetPue), targetWueLkwh = VALUES(targetWueLkwh), forecastHorizonDays = VALUES(forecastHorizonDays), coolingStrategyBaseline = VALUES(coolingStrategyBaseline), updatedBy = VALUES(updatedBy)
        `);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "operation_settings_update", "operation_settings", input.projectId, previous ? JSON.stringify(previous) : null, JSON.stringify({ ...input, projectId: undefined }));
        return { success: true };
      }),
    imports: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId);
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await database.execute(sql`SELECT id, sourceFilename, sourceType, measuredDate, rowsImported, qualityStatus, qualityNotes, importedAt FROM operation_import_batches WHERE projectId = ${input.projectId} ORDER BY importedAt DESC LIMIT 50`);
        return (result as any)[0] || [];
      }),
    createWaterReading: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), waterM3: z.number().finite().min(0).max(1_000_000), note: z.string().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId, true);
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível." });
        const measuredAt = Date.parse(`${input.date}T00:00:00Z`);
        await database.execute(sql`
          INSERT INTO operation_readings (projectId, batchId, metricCode, metricLabel, category, unit, value, measuredAt, granularity, source, dataQuality, qualityNote)
          VALUES (${input.projectId}, NULL, 'water_consumption_m3_daily', 'Consumo diário de água', 'agua', 'm³', ${String(input.waterM3)}, ${measuredAt}, 'diario', 'manual', 'valid', ${input.note || 'Leitura manual auditável de consumo diário de água.'})
          ON DUPLICATE KEY UPDATE value = VALUES(value), dataQuality = VALUES(dataQuality), qualityNote = VALUES(qualityNote)
        `);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "operation_water_reading_upsert", "operation_reading", input.projectId, null, JSON.stringify({ date: input.date, waterM3: input.waterM3, source: "manual" }));
        return { success: true, measuredAt };
      }),
    importDailyReport: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), filename: z.string().min(1).max(255), mimeType: z.literal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), data: z.string().min(8) }))
      .mutation(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId, true);
        if (!input.filename.toLowerCase().endsWith(".xlsx") || /[\\/\r\n\0]/.test(input.filename)) throw new TRPCError({ code: "BAD_REQUEST", message: "Indique um relatório Excel (.xlsx) com um nome de ficheiro válido." });
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data) || input.data.length % 4 !== 0) throw new TRPCError({ code: "BAD_REQUEST", message: "O conteúdo do relatório operacional é inválido." });
        const buffer = Buffer.from(input.data, "base64");
        if (buffer.length === 0 || buffer.length > 15 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "O relatório operacional deve ter no máximo 15 MB." });
        const sanitization = await sanitizeFile(buffer, input.mimeType, input.filename);
        await logFileUpload(ctx.user.id, input.filename, input.mimeType, sanitization.safe, sanitization.threats, "operation-daily-report");
        if (!sanitization.safe) throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitization.threats[0] || "ameaça não identificada"}.` });
        const workbook = new ExcelJS.Workbook();
        try { await workbook.xlsx.load(buffer as any); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "O ficheiro Excel não é válido." }); }
        const extracted = extractOperationalReadings(workbook);
        const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
        const stored = await storagePut(`operation/${input.projectId}/reports/${Date.now()}-${safeFilename}`, buffer, input.mimeType);
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await database.transaction(async (tx: any) => {
          const [batch] = await tx.insert(schema.operationImportBatches).values({ projectId: input.projectId, sourceFilename: input.filename, sourceFileKey: stored.key, sourceFileUrl: stored.url, sourceType: "daily_report", measuredDate: extracted.measuredDate, rowsImported: extracted.readings.length, qualityStatus: extracted.qualityStatus, qualityNotes: extracted.qualityNotes, importedBy: ctx.user.id }).$returningId();
          for (const reading of extracted.readings) {
            await tx.execute(sql`
              INSERT INTO operation_readings (projectId, batchId, metricCode, metricLabel, category, unit, value, measuredAt, granularity, source, dataQuality, qualityNote)
              VALUES (${input.projectId}, ${batch.id}, ${reading.metricCode}, ${reading.metricLabel}, ${reading.category}, ${reading.unit}, ${String(reading.value)}, ${reading.measuredAt}, ${reading.granularity}, ${reading.source}, ${reading.dataQuality}, ${reading.qualityNote || null})
              ON DUPLICATE KEY UPDATE batchId = VALUES(batchId), metricLabel = VALUES(metricLabel), category = VALUES(category), unit = VALUES(unit), value = VALUES(value), dataQuality = VALUES(dataQuality), qualityNote = VALUES(qualityNote)
            `);
          }
          return batch;
        });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "operation_report_import", "operation_import_batches", result.id, null, JSON.stringify({ projectId: input.projectId, filename: input.filename, measuredDate: extracted.measuredDate, rowsImported: extracted.readings.length, qualityStatus: extracted.qualityStatus }));
        return { batchId: result.id, measuredDate: extracted.measuredDate, rowsImported: extracted.readings.length, qualityStatus: extracted.qualityStatus, qualityNotes: extracted.qualityNotes };
      }),
    importInvoicesExcel: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), filename: z.string().min(1).max(255), mimeType: z.literal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), data: z.string().min(8) }))
      .mutation(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId, true);
        if (!input.filename.toLowerCase().endsWith(".xlsx") || /[\\/\r\n\0]/.test(input.filename)) throw new TRPCError({ code: "BAD_REQUEST", message: "Indique um ficheiro Excel (.xlsx) de faturas com nome válido." });
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data) || input.data.length % 4 !== 0) throw new TRPCError({ code: "BAD_REQUEST", message: "O conteúdo do ficheiro de faturas é inválido." });
        const buffer = Buffer.from(input.data, "base64");
        if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "O ficheiro de faturas deve ter no máximo 10 MB." });
        const sanitization = await sanitizeFile(buffer, input.mimeType, input.filename);
        await logFileUpload(ctx.user.id, input.filename, input.mimeType, sanitization.safe, sanitization.threats, "operation-invoices-import");
        if (!sanitization.safe) throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitization.threats[0] || "ameaça não identificada"}.` });
        const workbook = new ExcelJS.Workbook();
        try { await workbook.xlsx.load(buffer as any); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "O ficheiro Excel de faturas não é válido." }); }
        const invoices = parseOperationInvoicesWorkbook(workbook);
        const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
        const stored = await storagePut(`operation/${input.projectId}/invoices-import/${Date.now()}-${safeFilename}`, buffer, input.mimeType);
        const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await database.transaction(async (tx: any) => {
          let created = 0; let skipped = 0;
          for (const invoice of invoices) {
            const existing = await tx.execute(sql`SELECT id FROM operation_invoices WHERE projectId = ${input.projectId} AND invoiceType = ${invoice.invoiceType} AND periodStart = ${invoice.periodStart} AND periodEnd = ${invoice.periodEnd} AND quantity = ${String(invoice.quantity)} AND unit = ${invoice.unit} AND COALESCE(invoiceNumber, '') = ${invoice.invoiceNumber || ""} LIMIT 1`);
            if ((existing as any)[0]?.length) { skipped += 1; continue; }
            await tx.insert(schema.operationInvoices).values({ projectId: input.projectId, invoiceType: invoice.invoiceType, supplier: invoice.supplier, invoiceNumber: invoice.invoiceNumber, periodStart: invoice.periodStart, periodEnd: invoice.periodEnd, quantity: String(invoice.quantity), unit: invoice.unit, totalCost: invoice.totalCost === null ? null : String(invoice.totalCost), currency: "EUR", fileKey: stored.key, fileUrl: stored.url, filename: input.filename, mimeType: input.mimeType, notes: invoice.notes, createdBy: ctx.user.id });
            created += 1;
          }
          return { created, skipped };
        });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "operation_invoices_import", "operation_invoices", null, null, JSON.stringify({ projectId: input.projectId, filename: input.filename, rowsRead: invoices.length, ...result }));
        return { rowsRead: invoices.length, ...result };
      }),
    invoices: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
      .query(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId);
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const start = input.startDate || "0000-01-01"; const end = input.endDate || "9999-12-31";
        const result = await database.execute(sql`SELECT id, invoiceType, supplier, invoiceNumber, periodStart, periodEnd, quantity, unit, totalCost, currency, filename, mimeType, reconciliationStatus, notes, createdAt FROM operation_invoices WHERE projectId = ${input.projectId} AND periodEnd >= ${start} AND periodStart <= ${end} ORDER BY periodEnd DESC, id DESC`);
        return ((result as any)[0] || []).map((row: any) => ({ ...row, quantity: Number(row.quantity), totalCost: row.totalCost === null ? null : Number(row.totalCost) }));
      }),
    createInvoice: protectedProcedure
      .input(z.object({
        projectId: z.number().int().positive(), invoiceType: z.enum(["electricidade", "agua_potavel", "agua_industrial", "hvo", "gasoleo", "outro"]), supplier: z.string().max(255).optional(), invoiceNumber: z.string().max(120).optional(), periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), quantity: z.number().finite().min(0), unit: z.string().min(1).max(50), totalCost: z.number().finite().min(0).optional(), currency: z.string().min(3).max(8).default("EUR"), notes: z.string().max(5000).optional(), filename: z.string().max(255).optional(), mimeType: z.string().max(100).optional(), data: z.string().optional(),
      }).superRefine((value, issue) => {
        if ((value.filename || value.mimeType || value.data) && !(value.filename && value.mimeType && value.data)) issue.addIssue({ code: "custom", message: "O comprovativo de fatura deve incluir nome, tipo e conteúdo.", path: ["data"] });
        if (value.periodEnd < value.periodStart) issue.addIssue({ code: "custom", message: "O fim do período não pode ser anterior ao início.", path: ["periodEnd"] });
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId, true);
        let file: { key: string; url: string; filename: string; mimeType: string } | null = null;
        if (input.data && input.filename && input.mimeType) {
          const allowed = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"]);
          if (!allowed.has(input.mimeType) || /[\\/\r\n\0]/.test(input.filename)) throw new TRPCError({ code: "BAD_REQUEST", message: "O comprovativo deve ser PDF, Excel ou CSV com nome válido." });
          if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data) || input.data.length % 4 !== 0) throw new TRPCError({ code: "BAD_REQUEST", message: "O comprovativo de fatura é inválido." });
          const buffer = Buffer.from(input.data, "base64");
          if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "O comprovativo deve ter no máximo 10 MB." });
          const sanitization = await sanitizeFile(buffer, input.mimeType, input.filename);
          await logFileUpload(ctx.user.id, input.filename, input.mimeType, sanitization.safe, sanitization.threats, "operation-invoice");
          if (!sanitization.safe) throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitization.threats[0] || "ameaça não identificada"}.` });
          const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
          const stored = await storagePut(`operation/${input.projectId}/invoices/${Date.now()}-${safeFilename}`, buffer, input.mimeType);
          file = { ...stored, filename: input.filename, mimeType: input.mimeType };
        }
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [created] = await database.insert(schema.operationInvoices).values({ projectId: input.projectId, invoiceType: input.invoiceType, supplier: input.supplier?.trim() || null, invoiceNumber: input.invoiceNumber?.trim() || null, periodStart: input.periodStart, periodEnd: input.periodEnd, quantity: String(input.quantity), unit: input.unit.trim(), totalCost: input.totalCost === undefined ? null : String(input.totalCost), currency: input.currency.trim().toUpperCase(), fileKey: file?.key || null, fileUrl: file?.url || null, filename: file?.filename || null, mimeType: file?.mimeType || null, notes: input.notes?.trim() || null, createdBy: ctx.user.id }).$returningId();
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "operation_invoice_create", "operation_invoices", created.id, null, JSON.stringify({ projectId: input.projectId, invoiceType: input.invoiceType, periodStart: input.periodStart, periodEnd: input.periodEnd, quantity: input.quantity, unit: input.unit, totalCost: input.totalCost }));
        return { id: created.id };
      }),
    invoiceDownload: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), invoiceId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId);
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await database.execute(sql`SELECT fileKey, filename FROM operation_invoices WHERE id = ${input.invoiceId} AND projectId = ${input.projectId} LIMIT 1`);
        const invoice = (result as any)[0]?.[0];
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Fatura não encontrada." });
        if (!invoice.fileKey) throw new TRPCError({ code: "NOT_FOUND", message: "Esta fatura não tem comprovativo guardado." });
        return { ...(await storageGet(invoice.fileKey)), filename: invoice.filename };
      }),
    reconciliation: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
      .query(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId);
        const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const start = input.startDate || "0000-01-01"; const end = input.endDate || "9999-12-31";
        const invoicesResult = await database.execute(sql`SELECT invoiceType, quantity, unit, periodStart, periodEnd FROM operation_invoices WHERE projectId = ${input.projectId} AND periodEnd >= ${start} AND periodStart <= ${end}`);
        const invoices = (invoicesResult as any)[0] || [];
        const metricByInvoice: Record<string, string> = { eletricidade: "site_energy_kwh_daily", agua_potavel: "water_potable_m3_daily", agua_industrial: "water_industrial_m3_daily", hvo: "hvo_l_daily", gasoleo: "diesel_l_daily" };
        const entries = [];
        for (const invoice of invoices) {
          const code = metricByInvoice[invoice.invoiceType];
          const from = Date.parse(`${invoice.periodStart}T00:00:00Z`); const until = Date.parse(`${invoice.periodEnd}T23:59:59Z`);
          const measuredResult = code ? await database.execute(sql`SELECT COUNT(*) AS samples, SUM(CAST(value AS DECIMAL(20,6))) AS measured FROM operation_readings WHERE projectId = ${input.projectId} AND metricCode = ${code} AND measuredAt >= ${from} AND measuredAt <= ${until} AND dataQuality != 'invalid'`) : null;
          const aggregate = measuredResult ? (measuredResult as any)[0]?.[0] : null;
          const measured = aggregate && Number(aggregate.samples || 0) > 0 ? Number(aggregate.measured) : null;
          entries.push(buildOperationReconciliationEntry(invoice, measured));
        }
        return entries;
      }),
    scenarios: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId);
        const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await database.execute(sql`SELECT id, name, coolingStrategy, assumptionsJson, resultJson, baselineStart, baselineEnd, createdBy, createdAt, updatedAt FROM operation_scenarios WHERE projectId = ${input.projectId} ORDER BY updatedAt DESC, id DESC`);
        return ((result as any)[0] || []).map((row: any) => ({ ...row, assumptions: JSON.parse(row.assumptionsJson), results: JSON.parse(row.resultJson) }));
      }),
    createScenario: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), name: z.string().trim().min(3).max(255), coolingStrategy: z.enum(["agua_mar", "chiller", "hibrido_adiabatico", "torres_evaporativas", "outro"]), baselineStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), baselineEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), assumptions: z.object({ tiEnergyKwh: z.number().positive(), baselinePue: z.number().positive(), baselineWaterM3: z.number().min(0), baselineMaintenanceEur: z.number().min(0), electricityPriceEurKwh: z.number().min(0), waterPriceEurM3: z.number().min(0), carbonFactorKgKwh: z.number().min(0), targetPue: z.number().positive(), targetWueLkwh: z.number().min(0), maintenanceEur: z.number().min(0), systemMix: z.record(z.string(), z.number().min(0).max(100)) }).superRefine((value, issue) => { if (Object.values(value.systemMix).reduce((sum, item) => sum + item, 0) > 100.001) issue.addIssue({ code: "custom", message: "A mistura de sistemas não pode ultrapassar 100%." }); }) }))
      .mutation(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId, true);
        if (input.baselineStart && input.baselineEnd && input.baselineEnd < input.baselineStart) throw new TRPCError({ code: "BAD_REQUEST", message: "O período-base do cenário é inválido." });
        const results = buildOperationScenario(input.assumptions);
        const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [created] = await database.insert(schema.operationScenarios).values({ projectId: input.projectId, name: input.name, coolingStrategy: input.coolingStrategy, assumptionsJson: JSON.stringify(input.assumptions), resultJson: JSON.stringify(results), baselineStart: input.baselineStart || null, baselineEnd: input.baselineEnd || null, createdBy: ctx.user.id }).$returningId();
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "operation_scenario_create", "operation_scenarios", created.id, null, JSON.stringify({ projectId: input.projectId, name: input.name, coolingStrategy: input.coolingStrategy, formulaVersion: results.formulaVersion }));
        return { id: created.id, results };
      }),
    deleteScenario: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await assertOperationAccess(ctx.user, input.projectId, true);
        const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await database.execute(sql`SELECT createdBy FROM operation_scenarios WHERE id = ${input.id} AND projectId = ${input.projectId} LIMIT 1`);
        const scenario = (result as any)[0]?.[0];
        if (!scenario) throw new TRPCError({ code: "NOT_FOUND", message: "Cenário não encontrado." });
        if (!isAdminOrDono(ctx.user.role) && Number(scenario.createdBy) !== Number(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "Só o autor ou a Administração pode remover o cenário." });
        await database.execute(sql`DELETE FROM operation_scenarios WHERE id = ${input.id} AND projectId = ${input.projectId}`);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "operation_scenario_delete", "operation_scenarios", input.id, null, JSON.stringify({ projectId: input.projectId }));
        return { success: true };
      }),
  }),

  // Audit log
  audit: {
    list: protectedProcedure.input(z.object({
      limit: z.number().optional().default(100),
      userId: z.number().optional(),
      action: z.string().optional(),
    })).query(async ({ ctx, input }) => {
      if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [sql`1=1`];
      if (input.userId) conditions.push(sql`userId = ${input.userId}`);
      if (input.action) conditions.push(sql`action = ${input.action}`);
      const rows = await database.execute(
        sql`SELECT * FROM audit_log WHERE ${sql.join(conditions, sql` AND `)} ORDER BY createdAt DESC LIMIT ${input.limit}`
      );
      return (rows as unknown) as any[];
    }),
  },

  // ─── Company Active Periods ──────────────────────────────────────────────
  companyPeriods: router({
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.getProjectCompaniesWithPeriods(input.projectId);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        startWeek: z.number().int().min(1).max(53).nullable(),
        startYear: z.number().int().min(2020).max(2100).nullable(),
        endWeek: z.number().int().min(1).max(53).nullable(),
        endYear: z.number().int().min(2020).max(2100).nullable(),
        bufferWeeks: z.number().int().min(0).max(12).default(4),
      }).superRefine((period, validation) => {
        if ((period.startWeek === null) !== (period.startYear === null)) validation.addIssue({ code: "custom", message: "Indique a semana e o ano de início.", path: ["startWeek"] });
        if ((period.endWeek === null) !== (period.endYear === null)) validation.addIssue({ code: "custom", message: "Indique a semana e o ano de fim.", path: ["endWeek"] });
        if (period.startWeek !== null && period.startYear !== null && period.endWeek !== null && period.endYear !== null) {
          const start = period.startYear * 53 + period.startWeek;
          const end = period.endYear * 53 + period.endWeek;
          if (end < start) validation.addIssue({ code: "custom", message: "O fim dos trabalhos não pode ser anterior ao início.", path: ["endWeek"] });
        }
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const updated = await db.updateCompanyPeriod(input.id, input.startWeek, input.startYear, input.endWeek, input.endYear, input.bufferWeeks);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "A associação entre empresa e projecto já não existe." });
        await db.insertAuditLog(ctx.user.id, ctx.user.name || ctx.user.email, "company_period_update", "project_companies", input.id, null, JSON.stringify({ startWeek: input.startWeek, startYear: input.startYear, endWeek: input.endWeek, endYear: input.endYear, bufferWeeks: input.bufferWeeks }));
        return { success: true };
      }),
  }),

  // ─── Weeks Without Work ──────────────────────────────────────────────────
  weeksWithoutWork: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getWeeksWithoutWork(input.projectId);
      }),
    add: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        weekNumber: z.number(),
        weekYear: z.number(),
        reason: z.string().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await db.addWeekWithoutWork(input.projectId, input.weekNumber, input.weekYear, input.reason, ctx.user.id);
        await db.insertAuditLog(ctx.user.id, ctx.user.name || ctx.user.email, "week_without_work_add", "weeks_without_work", null, null, JSON.stringify({ projectId: input.projectId, weekNumber: input.weekNumber, weekYear: input.weekYear, reason: input.reason }));
        return { success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await db.removeWeekWithoutWork(input.id);
        await db.insertAuditLog(ctx.user.id, ctx.user.name || ctx.user.email, "week_without_work_remove", "weeks_without_work", input.id, null, null);
        return { success: true };
      }),
  }),

  // Notification recipients per project
  notificationRecipients: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        return db.listNotificationRecipientsByProject(input.projectId);
      }),
    add: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        userId: z.number(),
        notificationType: z.enum(["submission", "approval", "rejection", "all"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        await db.addNotificationRecipient(input.projectId, input.userId, input.notificationType);
        return { success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        await db.removeNotificationRecipient(input.id);
        return { success: true };
      }),
  }),

  // In-app notification counts
  notifications: router({
    pending: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      const role = user.role || "user";
      const items: { type: string; count: number; label: string; path: string }[] = [];

      // Get all submissions
      const allSubs = await db.getAllSubmissions();

      if (role === "raa") {
        // Fichas waiting for review (submitted status)
        const toReview = allSubs.filter((s: any) => s.status === "submitted" || s.status === "under_review");
        // Filter by RAA's assigned projects
        const userProjects = await db.getUserProjects(user.id);
        const projectIds = userProjects.map((p: any) => p.projectId);
        const count = toReview.filter((s: any) => projectIds.includes(s.projectId)).length;
        if (count > 0) {
          items.push({ type: "review", count, label: `${count} ficha${count > 1 ? "s" : ""} para revisão`, path: "/ficha" });
        }
      }

      if (role === "ee" || role === "rap") {
        // Rejected fichas that need correction
        const rejected = allSubs.filter((s: any) =>
          s.status === "rejected" &&
          (s.createdBy === user.id || s.submittedBy === user.id)
        );
        if (rejected.length > 0) {
          items.push({ type: "rejected", count: rejected.length, label: `${rejected.length} ficha${rejected.length > 1 ? "s" : ""} rejeitada${rejected.length > 1 ? "s" : ""}`, path: "/ficha" });
        }
        // Draft fichas
        const drafts = allSubs.filter((s: any) =>
          s.status === "draft" &&
          s.createdBy === user.id
        );
        if (drafts.length > 0) {
          items.push({ type: "draft", count: drafts.length, label: `${drafts.length} rascunho${drafts.length > 1 ? "s" : ""}`, path: "/ficha" });
        }
      }

      if (role === "admin") {
        // Users pending approval
        const allUsers = await db.getAllUsers();
        const pendingUsers = allUsers.filter((u: any) => u.accountStatus === "pending");
        if (pendingUsers.length > 0) {
          items.push({ type: "users", count: pendingUsers.length, label: `${pendingUsers.length} utilizador${pendingUsers.length > 1 ? "es" : ""} pendente${pendingUsers.length > 1 ? "s" : ""}`, path: "/admin" });
        }
      }

      const totalCount = items.reduce((sum, i) => sum + i.count, 0);
      return { items, totalCount };
    }),
  }),
});

export type AppRouter = typeof appRouter;
