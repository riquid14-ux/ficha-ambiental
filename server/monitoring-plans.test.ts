import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { daysUntilDeadline, isPlanReminderDay, PLAN_REMINDER_DAYS } from "./plan-reminders";

const root = join(process.cwd());
const schemaSource = readFileSync(join(root, "drizzle/schema.ts"), "utf8");
const migrationSource = ["0023_tired_wallflower.sql", "0024_hesitant_ken_ellis.sql", "0065_apa_reporting_cycles.sql"]
  .map(file => readFileSync(join(root, "drizzle", file), "utf8"))
  .join("\n");
const routerSource = readFileSync(join(root, "server/routers.ts"), "utf8");
const dbSource = readFileSync(join(root, "server/db.ts"), "utf8");
const remindersSource = readFileSync(join(root, "server/scheduled-reminders.ts"), "utf8");
const uiSource = readFileSync(join(root, "client/src/pages/Planos.tsx"), "utf8");
const navigationSource = readFileSync(join(root, "client/src/lib/role-navigation.ts"), "utf8");
const layoutSource = readFileSync(join(root, "client/src/components/AppLayout.tsx"), "utf8");

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

  it("guarda receção, limite e envio efetivo à APA sem substituir a entrega do plano", () => {
    expect(schemaSource).toContain("apaReceivedAt");
    expect(schemaSource).toContain("apaSubmissionDueAt");
    expect(schemaSource).toContain("apaSubmittedAt");
    expect(schemaSource).toContain("apaReportType");
    expect(dbSource).toContain("syncMonitoringPlanApaCalendarEvent");
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

  it("limita exclusivamente aos Administradores a configuração do reporte APA", () => {
    expect(routerSource).toContain("configureApaReporting");
    expect(routerSource).toContain('ctx.user.role !== "admin"');
    expect(routerSource).toContain("três meses civis após a receção");
    expect(routerSource).toContain("addCivilMonths");
    expect(routerSource).toContain("monitoring_plan_apa_reporting_configured");
  });

  it("sincroniza um único evento global por plano", () => {
    expect(schemaSource).toContain("calendar_events_source_key_uq");
    expect(dbSource).toContain('sourceType: "monitoring_plan"');
    expect(dbSource).toContain("sourceKey = `monitoring_plan:${plan.id}`");
    expect(dbSource).toContain("syncMonitoringPlanCalendarEvent");
    expect(routerSource).toContain("Este prazo é gerido no módulo Planos");
  });

  it("sincroniza o reporte APA como evento separado e mantém os alertas do suporte", () => {
    expect(dbSource).toContain("monitoring_plan_apa:");
    expect(dbSource).toContain('sourceType: "monitoring_plan_apa"');
    expect(remindersSource).toContain('event.sourceType === "monitoring_plan_apa"');
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
  it("expõe a lista universal apenas em Todos os Projetos", () => {
    expect(uiSource).toContain("A lista é intencionalmente global");
    expect(uiSource).toContain("enabled: isAllProjects");
    expect(uiSource).toContain('setLocation(canSeeAllProjects ? "/dashboard" : "/welcome")');
    expect(navigationSource).not.toContain('STANDARD_PROJECT_MENU_ROUTES = ["/welcome", "/dashboard", "/planos"');
    expect(navigationSource).not.toContain('OPERATION_ROUTES = ["/welcome", "/dashboard", "/operacao", "/planos"');
    const projectMenuBlock = layoutSource.slice(layoutSource.indexOf("const projectMenuItems"), layoutSource.indexOf("const operationProjectMenuItems"));
    const operationMenuBlock = layoutSource.slice(layoutSource.indexOf("const operationProjectMenuItems"), layoutSource.indexOf("const allProjectsMenuItems"));
    expect(projectMenuBlock).not.toContain('path: "/planos"');
    expect(operationMenuBlock).not.toContain('path: "/planos"');
  });

  it("inclui calendário exclusivo sincronizado no topo", () => {
    expect(uiSource).toContain("Calendário exclusivo dos planos");
    expect(uiSource).toContain("Sincronizado automaticamente com o calendário global");
  });

  it("liga a timeline APA aos eventos RDCD anuais e restringe a edição a Admin", () => {
    expect(uiSource).toContain("Calendário de comunicação APA");
    expect(uiSource).toContain("Linha anual de comunicação");
    expect(uiSource).toContain("apaReportingBoard.useQuery");
    expect(uiSource).toContain("configureApaReportingCycle.useMutation");
    expect(uiSource).toContain('user?.role === "admin"');
    expect(uiSource).toContain("Receção do plano ou reporte + 3 meses civis = limite máximo APA");
    expect(uiSource).toContain("Planos a integrar nesta emissão");
  });

  it("consolida planos num ciclo APA auditável sem duplicar eventos individuais", () => {
    expect(routerSource).toContain("apaReportingBoard");
    expect(routerSource).toContain("consultar a timeline global de reporte APA");
    expect(routerSource).toContain("configureApaReportingCycle");
    expect(routerSource).toContain("calendarEventId");
    expect(routerSource).toContain("O ciclo APA tem de partir de um evento RDCD");
    expect(routerSource).toContain("syncApaReportingCycleCalendarEvent");
    expect(dbSource).toContain("apaReportingCyclePlans");
    expect(dbSource).toContain("sourceType: \"apa_reporting_cycle\"");
    expect(dbSource).toContain("if (await isPlanInApaCycle(planId))");
    expect(schemaSource).toContain("apaReportingCycles");
    expect(schemaSource).toContain("apaReportingCyclePlans");
    expect(migrationSource).toContain("CREATE TABLE `apa_reporting_cycles`");
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
    expect(uiSource).toMatch(/"N\.º",\s*"Plano",\s*"Estado",\s*"Responsável interno",\s*"Suporte",\s*"Próxima entrega",\s*"Último update"/);
    expect(uiSource).toContain("Packer.toBlob(wordDocument)");
  });
});
