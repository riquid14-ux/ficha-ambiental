import { describe, expect, it } from "vitest";
import { describeKpiValue } from "../client/src/lib/kpi-context";

describe("Catálogo KPI ambiental — descrição contextual", () => {
  it("orienta os novos indicadores de operação de forma específica e contextual", () => {
    expect(describeKpiValue({ name: "Horas de funcionamento" }, "SIN02", "GC1", "12", "2026"))
      .toContain("soma das horas de funcionamento dos geradores");
    expect(describeKpiValue({ name: "Nível de ruído" }, "SIN02", "GC1", "12", "2026"))
      .toContain("ponto de monitorização");
    expect(describeKpiValue({ name: "Água reutilizada" }, "SIN02", "GC1", "12", "2026"))
      .toContain("volume de água reutilizada");
  });
});
