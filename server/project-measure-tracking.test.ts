import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const root = resolve(import.meta.dirname, "..");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const migrationSource = readFileSync(resolve(root, "drizzle/0026_confused_speed.sql"), "utf8");
const reconciliationSource = readFileSync(resolve(root, "drizzle/0027_reconcile_measure_tracking.sql"), "utf8");
const dbSource = readFileSync(resolve(root, "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const reminderSource = readFileSync(resolve(root, "server/scheduled-reminders.ts"), "utf8");
const panelSource = readFileSync(resolve(root, "client/src/components/MeasureTrackingPanel.tsx"), "utf8");
const phasesSource = readFileSync(resolve(root, "client/src/pages/PhaseMeasures.tsx"), "utf8");
const timelineSource = readFileSync(resolve(root, "client/src/pages/Timeline.tsx"), "utf8");

describe("Acompanhamento por medida — persistência e preservação", () => {
  it("guarda responsável interno e suporte externo no registo único por projecto e medida", () => {
    for (const field of ["ownerId", "ownerName", "supportName", "supportCompany", "supportEmail", "supportPhone", "trackingStatus"]) {
      expect(schemaSource).toContain(`${field}:`);
    }
    expect(schemaSource).toContain("phase_measure_statuses_project_measure_uq");
    expect(migrationSource).toContain("UNIQUE(`projectId`,`measureId`)");
  });

  it("mantém compatibilidade com o progresso existente e sincroniza-o pelo status update", () => {
    expect(schemaSource).toContain('status: mysqlEnum("status", ["pendente", "em_curso", "concluido"])');
    expect(schemaSource).toContain('trackingStatus: mysqlEnum("trackingStatus", ["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"])');
    expect(dbSource).toContain('const progressStatus = data.status === "concluido"');
    expect(dbSource).toContain("trackingStatus: data.status, status: progressStatus");
    expect(routerSource).toContain("statusMap.set(s.measureId, s.trackingStatus)");
    expect(dbSource).toContain("configurePhaseMeasureTracking");
  });

  it("preserva estado, notas, datas e evidências já existentes", () => {
    expect(migrationSource).not.toMatch(/\b(DROP|TRUNCATE|RENAME|DELETE)\b/i);
    expect(migrationSource).not.toMatch(/UPDATE\s+`phase_measure_statuses`/i);
    for (const field of ["notes", "firstDeliveryDate", "lastDeliveryDate", "nextDeliveryDate"]) {
      expect(schemaSource).toContain(`${field}:`);
    }
    expect(schemaSource).toContain('mysqlTable("phase_evidence"');
  });

  it("reconcilia o progresso histórico sem alterar medidas com updates auditáveis", () => {
    expect(reconciliationSource).toContain("UPDATE `phase_measure_statuses`");
    expect(reconciliationSource).toContain("`s`.`status` = 'concluido' THEN 'concluido'");
    expect(reconciliationSource).toContain("`s`.`status` = 'em_curso' THEN 'em_curso'");
    expect(reconciliationSource).toContain("NOT EXISTS");
    expect(reconciliationSource).toContain("FROM `phase_measure_updates`");
    expect(reconciliationSource).not.toMatch(/\b(DROP|TRUNCATE|RENAME|DELETE)\b/i);
  });

  it("guarda updates append-only com estado, texto, autor e data", () => {
    expect(schemaSource).toContain('mysqlTable("phase_measure_updates"');
    expect(schemaSource).toContain('updateText: text("updateText").notNull()');
    expect(schemaSource).toContain('createdByName: varchar("createdByName"');
    expect(dbSource).toContain("addPhaseMeasureUpdate");
    expect(dbSource).toContain("getPhaseMeasureUpdates");
    expect(dbSource).not.toMatch(/update\(phaseMeasureUpdates\)/);
    expect(dbSource).not.toMatch(/delete\(phaseMeasureUpdates\)/);
  });

  it("junta o último update ao registo de cada medida sem queries no cliente por cartão", () => {
    expect(dbSource).toContain("latestByMeasure");
    expect(dbSource).toContain("latestUpdate: latestByMeasure.get(status.measureId)");
    expect(phasesSource).toContain("trackingByMeasure");
  });
});

describe("Acompanhamento por medida — permissões e isolamento", () => {
  it("restringe configuração de responsável e suporte a Admin e Dono de Obra", () => {
    const measureRouter = routerSource.slice(routerSource.indexOf("phaseMeasures: router"), routerSource.indexOf("calendarEvents: router"));
    expect(measureRouter).toContain("Apenas Admin ou Dono de Obra podem configurar responsáveis das medidas");
    expect(measureRouter).toContain("configureTracking: protectedProcedure");
  });

  it("rejeita efectivamente configuração por RAA", async () => {
    const ctx = {
      user: {
        id: 90,
        openId: "raa-medida",
        email: "raa@example.com",
        name: "RAA Medida",
        loginMethod: "password",
        role: "raa",
        companyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} },
      res: { clearCookie: () => undefined },
    } as unknown as TrpcContext;

    await expect(appRouter.createCaller(ctx).phaseMeasures.configureTracking({ projectId: 1, measureId: 1, ownerId: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("permite updates apenas ao responsável, RAA, Admin e Dono de Obra", () => {
    const measureRouter = routerSource.slice(routerSource.indexOf("phaseMeasures: router"), routerSource.indexOf("calendarEvents: router"));
    expect(measureRouter).toContain('ctx.user.role === "raa"');
    expect(measureRouter).toContain("tracking?.ownerId === ctx.user.id");
    expect(measureRouter).toContain("Apenas o responsável, a RAA, Admin ou Dono de Obra podem actualizar esta medida");
  });

  it("valida acesso ao projecto em leitura, configuração, histórico e mutações", () => {
    const measureRouter = routerSource.slice(routerSource.indexOf("phaseMeasures: router"), routerSource.indexOf("calendarEvents: router"));
    const accessHelper = routerSource.slice(routerSource.indexOf("async function assertProjectAccess"), routerSource.indexOf("async function getAccessibleProjectIds"));
    expect((measureRouter.match(/assertProjectModuleAccess/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((measureRouter.match(/assertProjectAccess/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(accessHelper).not.toContain('project.code === "SIN01"');
  });

  it("regista configuração e updates no audit trail", () => {
    expect(routerSource).toContain('action: "phase_measure_tracking_configured"');
    expect(routerSource).toContain('action: "phase_measure_status_update"');
  });
});

describe("Acompanhamento por medida — interface e calendário", () => {
  it("mostra o painel dentro de cada MeasureCard e não ao nível da fase", () => {
    expect(phasesSource).toContain("<MeasureTrackingPanel measure={measure} tracking={tracking} projectId={projectId}");
    expect(phasesSource).not.toContain("<PhaseTrackingPanel");
    expect(timelineSource).not.toContain("<PhaseTrackingPanel");
  });

  it("é reutilizado em SIN01 e em SIN02–SIN07/Subestação pela vista Fases da Timeline", () => {
    expect(phasesSource).toContain("OPERATION_ONLY_PROJECT_CODES");
    expect(timelineSource).toContain("<PhaseMeasures embedded");
    expect(timelineSource).toContain("Ver medidas e responsáveis");
  });

  it("mostra responsável, suporte, último update, autor, data e histórico por medida", () => {
    for (const label of ["Responsável pela medida", "Suporte", "Último status update desta medida", "Histórico da medida", "createdByName"]) {
      expect(panelSource).toContain(label);
    }
    expect(phasesSource).toContain("tracking?.ownerName");
    expect(phasesSource).toContain("tracking?.supportName");
  });

  it("consolida Reportado no status update e elimina o editor superior duplicado", () => {
    expect(panelSource).toContain('concluido: "Reportado"');
    expect(panelSource).toContain("Novo status update desta medida");
    expect(phasesSource).toContain('trackingByMeasure[m.id]?.trackingStatus || "nao_iniciado"');
    expect(phasesSource).not.toContain("Notas rápidas");
    expect(phasesSource).not.toContain("<RadioGroup");
    expect(phasesSource).not.toContain("onStatusChange");
  });

  it("não cria calendário nem alertas automáticos para medidas", () => {
    expect(migrationSource).not.toContain("calendar_events");
    expect(panelSource).not.toContain("calendarEvents");
    expect(panelSource).not.toContain("nextDeliveryDate");
    expect(reminderSource).not.toContain("phaseMeasureUpdates");
    expect(reminderSource).not.toContain("phase_measure_updates");
    expect(panelSource).toContain("não cria eventos de calendário nem alertas automáticos");
  });

  it("inicia as evidências operacionais de SIN01 em 2026", () => {
    expect(phasesSource).toContain("const SIN01_EVIDENCE_START_YEAR = 2026");
    expect(phasesSource).toContain("Math.max(SIN01_EVIDENCE_START_YEAR, new Date().getFullYear())");
    expect(phasesSource).not.toContain("new Date().getFullYear() - 1");
    expect(phasesSource).not.toContain("2023 + i");
  });
});
