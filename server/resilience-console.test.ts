import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkReadiness } from "./health";
import { operationalIncidentInput } from "./routers";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const consoleSource = readFileSync(resolve(process.cwd(), "client/src/components/AdminResilienceSection.tsx"), "utf8");

describe("Consola administrativa de resiliência", () => {
  const validIncident = {
    title: "Indisponibilidade da importação BMS",
    severity: "high" as const,
    status: "investigating" as const,
    affectedServices: "Importação BMS",
    impactSummary: "Importações temporariamente indisponíveis.",
    recoverySteps: "Confirmar saúde e consultar o lote afetado.",
    followUpActions: "Rever o relatório antes de voltar a importar.",
    occurredAt: Date.UTC(2026, 8, 15),
  };

  it("aceita um registo de incidente dentro dos limites e rejeita contexto inseguro ou incompleto", () => {
    expect(operationalIncidentInput.parse(validIncident)).toMatchObject(validIncident);
    expect(() => operationalIncidentInput.parse({ ...validIncident, title: "x" })).toThrow();
    expect(() => operationalIncidentInput.parse({ ...validIncident, affectedServices: "" })).toThrow();
    expect(() => operationalIncidentInput.parse({ ...validIncident, occurredAt: -1 })).toThrow();
    expect(() => operationalIncidentInput.parse({ ...validIncident, recoverySteps: "x".repeat(8_001) })).toThrow();
  });

  it("mantém saúde, incidentes e atualizações restritos a Administração, sem eliminação de histórico", () => {
    const section = routerSource.slice(routerSource.indexOf("resilience: router"), routerSource.indexOf("// ─── Operação do edifício"));
    expect(section).toContain("health: protectedProcedure");
    expect(section).toContain("listIncidents: protectedProcedure");
    expect(section).toContain("createIncident: protectedProcedure");
    expect(section).toContain("updateIncident: protectedProcedure");
    expect(section.match(/assertAdminOnly\(ctx\.user\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(section).not.toContain("deleteIncident");
  });

  it("mantém um roteiro de retoma e evita recolher segredos no feed administrativo", () => {
    expect(consoleSource).toContain("Roteiro de retoma");
    expect(consoleSource).toContain("Não guarda palavras-passe, tokens, ficheiros ou dados de sessão");
    expect(consoleSource).toContain("Assinalar resolvido");
  });

  it("continua a devolver um estado seguro sem expor o erro interno da base de dados", async () => {
    await expect(checkReadiness(async () => { throw new Error("secret database endpoint"); })).resolves.toEqual({
      status: "not_ready",
      checks: { database: "unavailable" },
    });
  });
});
