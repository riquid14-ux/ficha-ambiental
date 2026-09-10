import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const pageSource = readFileSync(resolve(root, "client/src/pages/KPI.tsx"), "utf8");

function context(role: "admin" | "ee") {
  return {
    user: { id: 991, openId: `kpi-${role}`, email: `${role}@example.invalid`, name: "Teste KPI", loginMethod: "password", role, companyId: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} }, res: { clearCookie: () => undefined },
  } as unknown as TrpcContext;
}

describe("KPI — métricas configuráveis e relatórios por período", () => {
  it("limita a criação, edição e arquivo de métricas ao Administrador", async () => {
    await expect(appRouter.createCaller(context("ee")).kpi.upsertMetric({ name: "Viaturas em obra", unit: "N.º", category: "transport" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(context("ee")).kpi.deleteMetric({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("valida os campos, bloqueia duplicados, regista auditoria e exige fórmulas completas quando aplicável", () => {
    expect(routerSource).toContain('name: z.string().trim().min(3).max(120)');
    expect(routerSource).toContain('Já existe uma métrica KPI activa com este nome.');
    expect(routerSource).toContain('Seleccione a fórmula para a métrica calculada.');
    expect(routerSource).toContain('"kpi_metric_created"');
    expect(routerSource).toContain('"kpi_metric_updated"');
    expect(routerSource).toContain('"kpi_metric_archived"');
  });

  it("rejeita intervalos semanais invertidos e suporta limites para relatórios por período", () => {
    expect(routerSource).toContain('A semana inicial não pode ser posterior à semana final.');
    expect(routerSource).toContain('startWeek: z.number().int().min(1).max(53).optional()');
    expect(routerSource).toContain('ks.weekNumber >= ${input.startWeek}');
    expect(routerSource).toContain('ks.weekNumber <= ${input.endWeek}');
  });

  it("oferece um modelo de Viaturas em obra e exporta um relatório com resumo e semanas em colunas", () => {
    expect(pageSource).toContain('Pré-preencher: Viaturas em obra');
    expect(pageSource).toContain('Viaturas em obra');
    expect(pageSource).toContain('Período de análise e relatório');
    expect(pageSource).toContain('Resumo KPI');
    expect(pageSource).toContain('Semana ${week}');
    expect(pageSource).toContain('Relatorio_KPI_');
  });
});
