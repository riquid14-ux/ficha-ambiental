import { describe, expect, it } from "vitest";
import { describeKpiValue, splitWaterMetrics } from "../client/src/lib/kpi-context";

describe("contexto e capítulos KPI", () => {
  const waterMetrics = [
    { id: 17, name: "Água de Construção", category: "water", sortOrder: 20 },
    { id: 18, name: "Água de escavação", category: "water", sortOrder: 21 },
    { id: 23, name: "Águas Residuais", category: "water", sortOrder: 26 },
    { id: 24, name: "Águas residuais WCs Químicos Portáteis", category: "water", sortOrder: 27 },
    { id: 25, name: "Águas residuais WCs Químicos Contentores", category: "water", sortOrder: 28 },
    { id: 26, name: "Limpezas da Fossa", category: "water", sortOrder: 29 },
  ];

  it("separa os quatro últimos indicadores de água no capítulo Águas Afluentes", () => {
    const groups = splitWaterMetrics(waterMetrics);
    expect(groups.operational.map(metric => metric.id)).toEqual([17, 18]);
    expect(groups.affluent.map(metric => metric.id)).toEqual([23, 24, 25, 26]);
  });

  it("explica cada valor com projecto, empresa e período quando disponíveis", () => {
    expect(describeKpiValue({ name: "Trabalhadores em Obra" }, "SIN02", "GC1", "12", "2026"))
      .toContain("Número de trabalhadores em obra no projecto SIN02, da empresa GC1");
    expect(describeKpiValue({ name: "Trabalhadores em Obra" }, "SIN02", "GC1", "12", "2026"))
      .toContain("semana 12/2026");
  });
});
