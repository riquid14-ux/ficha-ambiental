import { describe, expect, it } from "vitest";
import { describeKpiValue } from "../client/src/lib/kpi-context";

describe("Catálogo KPI ambiental — descrição contextual", () => {
  it("reproduz a instrução operacional do catálogo com projecto, empresa e semana", () => {
    expect(describeKpiValue({ name: "Trabalhadores em projeto" }, "SIN02", "GC1", "12", "2026"))
      .toBe("Número total de trabalhadores no projeto, no projecto SIN02, da empresa GC1, na semana 12/2026.");
    expect(describeKpiValue({ name: "Horas de funcionamento" }, "SIN02", "GC1", "12", "2026"))
      .toBe("Total de horas em que os geradores estiveram ligados, no projecto SIN02, da empresa GC1, na semana 12/2026.");
    expect(describeKpiValue({ name: "Nível de ruído" }, "SIN02", "GC1", "12", "2026"))
      .toBe("Ruído medido nos pontos de monitorização definidos, no projecto SIN02, da empresa GC1, na semana 12/2026.");
    expect(describeKpiValue({ name: "Água reutilizada" }, "SIN02", "GC1", "12", "2026"))
      .toBe("Água reaproveitada no projeto, por exemplo de escavação para controlo de poeiras, no projecto SIN02, da empresa GC1, na semana 12/2026.");
    expect(describeKpiValue({ name: "Derrames no abastecimento" }, "SIN02", "GC1", "12", "2026"))
      .toContain("Número de derrames de gasóleo ou óleo junto aos geradores");
    expect(describeKpiValue({ name: "Trabalhadores em projeto" }, undefined, undefined, undefined, undefined))
      .toBe("Número total de trabalhadores no projeto, no projecto seleccionado, da empresa seleccionada, na semana seleccionada.");
    expect(describeKpiValue({ name: "Trabalhadores em projeto" }, "SIN02", "GC1", "12", "2026"))
      .not.toContain("Registe");
  });
});
