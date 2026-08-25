import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { daysUntilDeadline, isPlanReminderDay, PLAN_REMINDER_DAYS } from "./plan-reminders";

const root = join(process.cwd());
const schemaSource = readFileSync(join(root, "drizzle/schema.ts"), "utf8");
const migrationSource = ["0023_tired_wallflower.sql", "0024_hesitant_ken_ellis.sql"]
  .map(file => readFileSync(join(root, "drizzle", file), "utf8"))
  .join("\n");
const routerSource = readFileSync(join(root, "server/routers.ts"), "utf8");
const dbSource = readFileSync(join(root, "server/db.ts"), "utf8");
const remindersSource = readFileSync(join(root, "server/scheduled-reminders.ts"), "utf8");
const uiSource = readFileSync(join(root, "client/src/pages/Planos.tsx"), "utf8");

describe("Planos — alertas 30/15/7 dias", () => {
  const now = new Date("2026-08-25T23:45:00+01:00");

  it.each(PLAN_REMINDER_DAYS)("activa exactamente o alerta a %i dias", days => {
    const deadline = new Date(Date.UTC(2026, 7, 25 + days, 1, 0, 0)).getTime();
    expect(daysUntilDeadline(deadline, now)).toBe(days);
    expect(isPlanReminderDay(days)).toBe(true);
  });

  it("não envia em dias fora da regra", () => {
    expect(isPlanReminderDay(29)).toBe(false);
    expect(isPlanReminderDay(14)).toBe(false);
    expect(isPlanReminderDay(6)).toBe(false);
  });

  it("calcula por dia UTC e não pela hora de execução", () => {
    const deadline = Date.parse("2026-09-01T00:05:00Z");
    const early = Date.parse("2026-08-25T00:01:00Z");
    const late = Date.parse("2026-08-25T23:59:00Z");
    expect(daysUntilDeadline(deadline, early)).toBe(7);
    expect(daysUntilDeadline(deadline, late)).toBe(7);
  });

  it("reserva o alerta antes do email e liberta a reserva quando o envio falha", () => {
    expect(remindersSource).toContain("claimCalendarReminder");
    expect(remindersSource).toContain("releaseCalendarReminderClaim");
    expect(schemaSource).toContain("calendar_reminder_logs_unique");
  });

  it("notifica responsável interno e suporte externo sem exigir conta ao suporte", () => {
    expect(remindersSource).toContain('event.sourceType === "monitoring_plan"');
    expect(remindersSource).toContain("plan?.supportEmail");
    expect(remindersSource).toContain("userId: null");
    expect(remindersSource).toContain("!recipients.some");
    expect(remindersSource).toContain("plan.supportEmail!.toLowerCase()");
  });
});

describe("Planos — modelo de dados e migração", () => {
  it("mantém o acompanhamento no único registo universal de cada plano", () => {
    expect(dbSource).toContain("export async function getMonitoringPlanOverview()");
    expect(dbSource).not.toContain("results.flat()");
    expect(schemaSource).toContain("ownerId");
    expect(schemaSource).toContain("supportEmail");
    expect(schemaSource).toContain("nextReportingDate");
  });

  it("mantém updates imutáveis com autor, texto e data", () => {
    expect(schemaSource).toContain("monitoringPlanUpdates");
    expect(schemaSource).toContain("updateText");
    expect(schemaSource).toContain("createdByName");
    expect(routerSource).not.toMatch(/monitoringPlanUpdates\)\.set/);
  });

  it("guarda apenas referências de anexos no storage externo", () => {
    expect(schemaSource).toContain("monitoringPlanAttachments");
    expect(schemaSource).toContain("fileKey");
    expect(schemaSource).toContain("url: text(\"url\")");
    expect(schemaSource).not.toMatch(/monitoring_plan_attachments[\s\S]{0,1000}(blob|binary)/i);
  });

  it("aplica apenas operações aditivas e não destrutivas", () => {
    expect(migrationSource).not.toMatch(/\b(DROP|TRUNCATE|RENAME)\b/i);
    expect(migrationSource).toContain("CREATE TABLE `monitoring_plan_assignments`");
    expect(migrationSource).toContain("ALTER TABLE `monitoring_plans` ADD `planNumber`");
  });

  it("preserva histórico, anexos, responsáveis e prazos ao consolidar os planos", () => {
    expect(migrationSource).toContain("SET updates.`planId` = assignment.`planId`");
    expect(migrationSource).toContain("SET attachments.`planId` = assignment.`planId`");
    expect(migrationSource).toContain("plan.`ownerId` = COALESCE(plan.`ownerId`, assignment.`ownerId`)");
    expect(migrationSource).toContain("plan.`nextReportingDate` = COALESCE(plan.`nextReportingDate`, assignment.`nextReportingDate`)");
    expect(migrationSource).toContain("WHERE `sourceType` = 'monitoring_plan_assignment'");
    expect(migrationSource).toContain("CONCAT('monitoring_plan:', plan.`id`)");
    expect(migrationSource).not.toMatch(/DELETE\s+FROM\s+`monitoring_plan_(updates|attachments|assignments)`/i);
  });

  it("numera os planos existentes e os novos", () => {
    expect(migrationSource).toContain("CONCAT('P-', LPAD(`id`, 2, '0'))");
    expect(dbSource).toContain("String(id).padStart(2, \"0\")");
    expect(schemaSource).toContain("monitoring_plans_plan_number_uq");
  });
});

describe("Planos — permissões, calendário e segurança", () => {
  it("limita updates ao responsável, RAA, Admin ou Dono de Obra", () => {
    expect(routerSource).toContain("assignment.ownerId === user.id");
    expect(routerSource).toContain('user.role === "raa"');
    expect(routerSource).toContain("canUpdatePlanProgress");
  });

  it("limita configuração de responsáveis e prazos a Admin/Dono de Obra", () => {
    expect(routerSource).toContain("Apenas Admin ou Dono de Obra podem configurar responsáveis e prazos");
  });

  it("sincroniza um único evento global por plano", () => {
    expect(schemaSource).toContain("calendar_events_source_key_uq");
    expect(dbSource).toContain('sourceType: "monitoring_plan"');
    expect(dbSource).toContain("sourceKey = `monitoring_plan:${plan.id}`");
    expect(dbSource).toContain("syncMonitoringPlanCalendarEvent");
    expect(routerSource).toContain("Este prazo é gerido no módulo Planos");
  });

  it("sanitiza, limita e arquiva anexos fora da base de dados", () => {
    expect(routerSource).toContain("sanitizeFile(buffer, input.mimeType, input.filename)");
    expect(routerSource).toContain("buffer.length > 10 * 1024 * 1024");
    expect(routerSource).toContain("storagePut(fileKey, buffer, input.mimeType)");
  });

  it("regista configurações e updates no audit trail", () => {
    expect(routerSource).toContain('action: "monitoring_plan_configured"');
    expect(routerSource).toContain('action: "monitoring_plan_status_update"');
  });
});

describe("Planos — experiência e exportação", () => {
  it("inclui calendário exclusivo sincronizado no topo", () => {
    expect(uiSource).toContain("Calendário exclusivo dos planos");
    expect(uiSource).toContain("Sincronizado automaticamente com o calendário global");
  });

  it("permite pesquisar e filtrar exactamente os planos universais", () => {
    expect(uiSource).toContain("Pesquisar por número, plano, responsável ou update");
    expect(uiSource).toContain("Todos os estados");
    expect(uiSource).toContain("filteredPlans.map");
    expect(uiSource).not.toContain("trackingProjectCode");
  });

  it("mostra último update, autor e data", () => {
    expect(uiSource).toContain("Último status update");
    expect(uiSource).toContain("latestUpdate.createdByName");
    expect(uiSource).toContain("formatDateTime(plan.latestUpdate.createdAt)");
  });

  it("exporta Word com número, responsável, entrega e último update", () => {
    expect(uiSource).toContain("Actualização dos Planos de Monitorização");
    expect(uiSource).toContain('"N.º", "Plano", "Estado", "Responsável interno", "Suporte externo", "Próxima entrega", "Último update"');
    expect(uiSource).toContain("Packer.toBlob(wordDocument)");
  });
});
