import { describe, expect, it } from "vitest";
import { splitWaterMetrics } from "../client/src/lib/kpi-context";

describe("Águas Afluentes", () => {
  it("mantém os quatro indicadores afluentes separados sem deslocar Água reutilizada", () => {
    const groups = splitWaterMetrics([
      { id: 17, name: "Água de Construção", category: "water", sortOrder: 17 },
      { id: 23, name: "Águas Residuais", category: "water", sortOrder: 23 },
      { id: 24, name: "Águas residuais WCs Químicos Portáteis", category: "water", sortOrder: 24 },
      { id: 25, name: "Águas residuais WCs Químicos Contentores", category: "water", sortOrder: 25 },
      { id: 26, name: "Limpezas da Fossa", category: "water", sortOrder: 26 },
      { id: 44, name: "Água reutilizada", category: "water", sortOrder: 44 },
    ]);

    expect(groups.affluent.map(metric => metric.name)).toEqual([
      "Águas Residuais",
      "Águas residuais WCs Químicos Portáteis",
      "Águas residuais WCs Químicos Contentores",
      "Limpezas da Fossa",
    ]);
    expect(groups.operational.map(metric => metric.name)).toContain("Água reutilizada");
  });
});
