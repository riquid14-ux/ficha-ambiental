import { describe, expect, it } from "vitest";
import { describeKpiValue } from "../client/src/lib/kpi-context";

describe("Catálogo KPI ambiental — descrição contextual", () => {
  it("identifica o valor concreto, projecto, empresa e semana sem instruções genéricas", () => {
    expect(describeKpiValue({ name: "Trabalhadores em obra" }, "SIN02", "GC1", "12", "2026"))
      .toBe("Número de trabalhadores em obra no projecto SIN02, da empresa GC1, na semana 12/2026.");
    expect(describeKpiValue({ name: "Horas de funcionamento" }, "SIN02", "GC1", "12", "2026"))
      .toBe("Total de horas de funcionamento dos geradores no projecto SIN02, da empresa GC1, na semana 12/2026.");
    expect(describeKpiValue({ name: "Nível de ruído" }, "SIN02", "GC1", "12", "2026"))
      .toBe("Nível de ruído medido no ponto de monitorização definido no projecto SIN02, da empresa GC1, na semana 12/2026.");
    expect(describeKpiValue({ name: "Água reutilizada" }, "SIN02", "GC1", "12", "2026"))
      .toBe("Volume de água reutilizada em operações de obra no projecto SIN02, da empresa GC1, na semana 12/2026.");
    expect(describeKpiValue({ name: "Derrames no abastecimento" }, "SIN02", "GC1", "12", "2026"))
      .toContain("Número de derrames durante o abastecimento");
    expect(describeKpiValue({ name: "Trabalhadores em obra" }, undefined, undefined, undefined, undefined))
      .toBe("Número de trabalhadores em obra no projecto seleccionado, da empresa seleccionada, na semana seleccionada.");
    expect(describeKpiValue({ name: "Trabalhadores em obra" }, "SIN02", "GC1", "12", "2026"))
      .not.toContain("Registe");
  });
});
