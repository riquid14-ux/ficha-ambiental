import { describe, expect, it } from "vitest";
import { INFRASTRUCTURE_REFERENCE_POINTS, parseInfrastructurePoint } from "./routers";

describe("Infraestrutura estática da Operação", () => {
  it("inclui os marcadores amarelos configuráveis e a área separada de edifícios futuros", () => {
    const markers = INFRASTRUCTURE_REFERENCE_POINTS.filter(point => !point.isFuture);
    expect(markers.length).toBeGreaterThanOrEqual(14);
    expect(markers.every(point => point.status === "a_validar" && point.systemType === "infraestrutura")).toBe(true);
    expect(INFRASTRUCTURE_REFERENCE_POINTS.some(point => point.isFuture && point.status === "planeamento" && point.title === "Edifícios futuros")).toBe(true);
  });

  it("mantém o cartão resiliente quando as métricas persistidas não forem JSON válido", () => {
    expect(parseInfrastructurePoint({ metricCodesJson: "not-json", xPercent: "42", yPercent: "60", isFuture: 0 }).metricCodes).toEqual([]);
  });

  it("aceita apenas códigos seguros de métrica no cartão configurável", () => {
    const point = parseInfrastructurePoint({ metricCodesJson: JSON.stringify(["pue", "seawater_flow_lps", "<script>"]), xPercent: "42", yPercent: "60", isFuture: 0 });
    expect(point.metricCodes).toEqual(["pue", "seawater_flow_lps"]);
  });
});
