import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { DEFAULT_INFRASTRUCTURE_FUTURE_AREA, extractInfrastructureChart, INFRASTRUCTURE_REFERENCE_POINTS, parseInfrastructureFutureArea, parseInfrastructurePoint } from "./routers";

describe("Infraestrutura estática da Operação", () => {
  it("inclui os marcadores amarelos configuráveis e a área separada de edifícios futuros", () => {
    const markers = INFRASTRUCTURE_REFERENCE_POINTS.filter(point => !point.isFuture);
    expect(markers.length).toBeGreaterThanOrEqual(14);
    expect(markers.every(point => point.status === "a_validar" && point.systemType === "infraestrutura")).toBe(true);
    expect(INFRASTRUCTURE_REFERENCE_POINTS.some(point => point.isFuture && point.status === "planeamento" && point.title === "Edifícios futuros")).toBe(true);
    expect(markers[0]).toMatchObject({ xPercent: 41, yPercent: 37 });
    expect(markers.at(-1)).toMatchObject({ xPercent: 97, yPercent: 34 });
  });

  it("mantém o cartão resiliente quando as métricas persistidas não forem JSON válido", () => {
    expect(parseInfrastructurePoint({ metricCodesJson: "not-json", xPercent: "42", yPercent: "60", isFuture: 0 }).metricCodes).toEqual([]);
  });

  it("aceita apenas códigos seguros de métrica no cartão configurável", () => {
    const point = parseInfrastructurePoint({ metricCodesJson: JSON.stringify(["pue", "seawater_flow_lps", "<script>"]), xPercent: "42", yPercent: "60", isFuture: 0 });
    expect(point.metricCodes).toEqual(["pue", "seawater_flow_lps"]);
  });

  it("mantém apenas dados técnicos e tipos de fatura seguros no cartão", () => {
    const point = parseInfrastructurePoint({
      metricCodesJson: "[]",
      technicalDataJson: JSON.stringify([{ label: "Capacidade máxima", value: "2 500", unit: "kVA" }, { label: "<script>", value: 7, unit: "x" }]),
      invoiceTypesJson: JSON.stringify(["electricidade", "gasoleo", "<script>"]),
      chartDataJson: "not-json",
      xPercent: "42", yPercent: "60", isFuture: 0,
    });
    expect(point.technicalData).toEqual([{ label: "Capacidade máxima", value: "2 500", unit: "kVA" }]);
    expect(point.invoiceTypes).toEqual(["electricidade", "gasoleo"]);
    expect(point.chartData).toBeNull();
  });

  it("extrai uma fonte Excel simples em séries limitadas para o gráfico do cartão", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Geradores");
    sheet.addRow(["Mês", "Nível de combustível", "Horas"]);
    sheet.addRow(["Julho", 78, 14]);
    sheet.addRow(["Agosto", 64, 18]);
    const chart = extractInfrastructureChart(workbook);
    expect(chart.label).toBe("Mês");
    expect(chart.series).toEqual([{ key: "series_2", label: "Nível de combustível" }, { key: "series_3", label: "Horas" }]);
    expect(chart.rows).toEqual([{ label: "Julho", series_2: 78, series_3: 14 }, { label: "Agosto", series_2: 64, series_3: 18 }]);
  });

  it("aceita apenas vértices inteiros válidos para a área futura ajustável", () => {
    expect(parseInfrastructureFutureArea(JSON.stringify([{ xPercent: 0, yPercent: 70 }, { xPercent: 50, yPercent: 45 }, { xPercent: 100, yPercent: 100 }]))).toEqual([{ xPercent: 0, yPercent: 70 }, { xPercent: 50, yPercent: 45 }, { xPercent: 100, yPercent: 100 }]);
    expect(parseInfrastructureFutureArea(JSON.stringify([{ xPercent: -1, yPercent: 20 }, { xPercent: 50, yPercent: 45 }, { xPercent: 100, yPercent: 100 }]))).toEqual(DEFAULT_INFRASTRUCTURE_FUTURE_AREA);
  });
});
