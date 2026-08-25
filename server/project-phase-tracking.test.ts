import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const root = resolve(import.meta.dirname, "..");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const migrationSource = readFileSync(resolve(root, "drizzle/0025_youthful_captain_universe.sql"), "utf8");
const dbSource = readFileSync(resolve(root, "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const reminderSource = readFileSync(resolve(root, "server/scheduled-reminders.ts"), "utf8");
const panelSource = readFileSync(resolve(root, "client/src/components/PhaseTrackingPanel.tsx"), "utf8");
const timelineSource = readFileSync(resolve(root, "client/src/pages/Timeline.tsx"), "utf8");
const phasesSource = readFileSync(resolve(root, "client/src/pages/PhaseMeasures.tsx"), "utf8");

describe("Acompanhamento das fases — modelo e rastreabilidade", () => {
  it("adiciona responsável interno e suporte externo sem conta obrigatória", () => {
    for (const field of ["ownerId", "ownerName", "supportName", "supportCompany", "supportEmail", "supportPhone"]) {
      expect(schemaSource).toContain(field);
    }
    expect(schemaSource).toContain('mysqlTable("project_phase_updates"');
    expect(schemaSource).toContain('updateText: text("updateText").notNull()');
    expect(schemaSource).toContain('createdByName: varchar("createdByName"');
  });

  it("preserva updates como registos append-only com autor e data", () => {
    expect(dbSource).toContain("addProjectPhaseUpdate");
    expect(dbSource).toContain("getProjectPhaseUpdates");
    expect(dbSource).not.toMatch(/update\(projectPhaseUpdates\)/);
    expect(dbSource).not.toMatch(/delete\(projectPhaseUpdates\)/);
  });

  it("mantém uma fase única por projecto e chave", () => {
    expect(schemaSource).toContain("project_phases_project_key_uq");
    expect(migrationSource).toContain("UNIQUE(`projectId`,`phaseKey`)");
  });

  it("cria apenas as fases operacionais em falta de SIN01", () => {
    expect(migrationSource).toContain("'Exploração'");
    expect(migrationSource).toContain("'Desativação (Pós-Exploração)'");
    expect(migrationSource).toContain("p.code = 'SIN01'");
  });

  it("é aditiva e preserva estados, datas, progresso e medidas existentes", () => {
    for (const field of ["startDate", "endDate", "progress", "hidden"]) {
      expect(schemaSource).toContain(`${field}:`);
    }
    expect(migrationSource).toContain("ALTER TABLE `project_phases` ADD");
    expect(migrationSource).toContain("AND NOT EXISTS");
    expect(migrationSource).not.toMatch(/\b(DROP|TRUNCATE|RENAME|DELETE)\b/i);
    expect(migrationSource).not.toMatch(/UPDATE\s+`project_phases`\s+SET/i);
  });
});

describe("Acompanhamento das fases — permissões", () => {
  it("limita configuração de responsáveis a Admin e Dono de Obra", () => {
    expect(routerSource).toContain("configureTracking: protectedProcedure");
    expect(routerSource).toContain("Apenas Admin ou Dono de Obra podem configurar responsáveis das fases");
  });

  it("permite updates ao responsável, RAA, Admin e Dono de Obra", () => {
    expect(routerSource).toContain("addStatusUpdate: protectedProcedure");
    expect(routerSource).toContain("canUpdatePlanProgress(ctx.user, phase)");
    expect(routerSource).toContain("Apenas o responsável, a RAA, Admin ou Dono de Obra podem actualizar esta fase");
  });

  it("valida acesso ao projecto em todas as operações", () => {
    const phaseRouter = routerSource.slice(routerSource.indexOf("projectPhases: router"), routerSource.indexOf("phaseMeasures: router"));
    expect((phaseRouter.match(/assertProjectAccess/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it("reserva a leitura multi-projecto listAll a Admin e Dono de Obra", () => {
    const listAllBlock = routerSource.slice(routerSource.indexOf("listAll: protectedProcedure", routerSource.indexOf("projectPhases: router")), routerSource.indexOf("responsibleCandidates: protectedProcedure", routerSource.indexOf("projectPhases: router")));
    expect(listAllBlock).toContain("isAdminOrDono(ctx.user.role)");
    expect(listAllBlock).toContain("Apenas Admin ou Dono de Obra podem consultar fases de todos os projectos");
  });

  it("rejeita efectivamente listAll para RAA e outros perfis não administrativos", async () => {
    const ctx = {
      user: {
        id: 99,
        openId: "raa-isolamento",
        email: "raa@example.com",
        name: "RAA Isolamento",
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

    await expect(appRouter.createCaller(ctx).projectPhases.listAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("não expõe candidatos internos sem acesso ao projecto", () => {
    expect(routerSource).toContain("Não expor utilizadores sem acesso ao projecto");
    expect(routerSource).toContain('candidate.accountStatus !== "active"');
  });
});

describe("Acompanhamento das fases — experiência", () => {
  it("usa o mesmo componente em SIN01 Fases e na Timeline dos restantes projectos", () => {
    expect(phasesSource).not.toContain("<PhaseTrackingPanel");
    expect(timelineSource).not.toContain("<PhaseTrackingPanel");
    expect(phasesSource).toContain("<MeasureTrackingPanel");
    expect(timelineSource).toContain("<PhaseMeasures embedded");
  });

  it("mostra responsável, suporte, último update, autor e histórico", () => {
    for (const label of ["Responsável interno", "Suporte", "Último status update", "Histórico", "createdByName"]) {
      expect(panelSource).toContain(label);
    }
  });

  it("não cria calendário nem alertas para fases", () => {
    expect(migrationSource).not.toContain("calendar_events");
    expect(panelSource).not.toContain("calendarEvents");
    expect(panelSource).not.toContain("nextReportingDate");
    expect(reminderSource).not.toContain("projectPhaseUpdates");
    expect(reminderSource).not.toContain("project_phase_updates");
    expect(panelSource).toContain("não cria eventos de calendário nem alertas automáticos");
  });
});
