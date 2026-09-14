import { describe, expect, it } from "vitest";
import { INFRASTRUCTURE_REFERENCE_POINTS, parseInfrastructurePoint } from "./routers";

describe("Infraestrutura estática da Operação", () => {
  it("inclui pontos de energia, Hall TI, água do mar e um ponto de planeamento futuro", () => {
    expect(INFRASTRUCTURE_REFERENCE_POINTS.some(point => point.systemType === "energia")).toBe(true);
    expect(INFRASTRUCTURE_REFERENCE_POINTS.some(point => point.systemType === "hall_ti")).toBe(true);
    expect(INFRASTRUCTURE_REFERENCE_POINTS.some(point => point.systemType === "agua_mar")).toBe(true);
    expect(INFRASTRUCTURE_REFERENCE_POINTS.some(point => point.isFuture && point.status === "planeamento")).toBe(true);
  });

  it("mantém o cartão resiliente quando as métricas persistidas não forem JSON válido", () => {
    expect(parseInfrastructurePoint({ metricCodesJson: "not-json", xPercent: "42", yPercent: "60", isFuture: 0 }).metricCodes).toEqual([]);
  });

  it("aceita apenas códigos seguros de métrica no cartão configurável", () => {
    const point = parseInfrastructurePoint({ metricCodesJson: JSON.stringify(["pue", "seawater_flow_lps", "<script>"]), xPercent: "42", yPercent: "60", isFuture: 0 });
    expect(point.metricCodes).toEqual(["pue", "seawater_flow_lps"]);
  });
});
