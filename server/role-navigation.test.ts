import { describe, expect, it } from "vitest";
import { getVisibleNavigationPaths } from "../client/src/lib/role-navigation";

describe("navegação visível por identidade", () => {
  const project = { isAllProjects: false, isOperationOnly: false, enabledModules: null };

  it("mostra à EE apenas os cartões equivalentes ao menu autorizado", () => {
    expect(getVisibleNavigationPaths({ role: "ee", ...project })).toEqual([
      "/welcome", "/ficha", "/residuos", "/kpi", "/documentacao", "/dashboard-parceiros", "/pedidos-eep",
    ]);
  });

  it("mostra à RAA os Planos, sem anunciar calendário ou Timeline", () => {
    expect(getVisibleNavigationPaths({ role: "raa", ...project })).toEqual([
      "/welcome", "/planos", "/ficha", "/residuos", "/kpi", "/documentacao",
    ]);
  });

  it("mostra Planos à PM no projeto individual para permitir a exportação por projeto", () => {
    expect(getVisibleNavigationPaths({ role: "pm", ...project })).toContain("/planos");
  });

  it("limita a EEP aos módulos KPI e resíduos autorizados", () => {
    expect(getVisibleNavigationPaths({ role: "ee_partner", ...project, partnerAccess: { allowKpi: true, allowWaste: false } }))
      .toEqual(["/kpi"]);
  });
});
