import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_INFRASTRUCTURE_FUTURE_AREA, extractInfrastructureChart, INFRASTRUCTURE_REFERENCE_POINTS, parseInfrastructureFutureArea, parseInfrastructurePoint } from "./routers";

describe("Infraestrutura estática da Operação", () => {
  it("inclui os marcadores amarelos configuráveis e a área separada de edifícios futuros", () => {
    const markers = INFRASTRUCTURE_REFERENCE_POINTS.filter(point => !point.isFuture);
    expect(markers.length).toBeGreaterThanOrEqual(14);
    expect(markers.every(point => point.status === "a_validar")).toBe(true);
    expect(INFRASTRUCTURE_REFERENCE_POINTS.some(point => point.isFuture && point.status === "planeamento" && point.title === "Edifícios futuros")).toBe(true);
    expect(markers[0]).toMatchObject({ xPercent: 41, yPercent: 37, systemType: "agua_mar" });
    expect(markers.at(-1)).toMatchObject({ xPercent: 97, yPercent: 34, systemType: "agua_mar" });
  });

  it("atribui a simbologia funcional pedida sem alterar a numeração dos marcadores", () => {
    const types = new Map(INFRASTRUCTURE_REFERENCE_POINTS.filter(point => !point.isFuture).map(point => [point.sortOrder / 10, point.systemType]));
    expect([1, 2, 3, 8, 14].map(point => types.get(point))).toEqual(["agua_mar", "agua_mar", "agua_mar", "agua_mar", "agua_mar"]);
    expect([6, 9].map(point => types.get(point))).toEqual(["pessoa", "pessoa"]);
    expect(types.get(4)).toBe("energia");
    expect([5, 7, 11].map(point => types.get(point))).toEqual(["arrefecimento", "arrefecimento", "arrefecimento"]);
    expect([10, 12, 13].map(point => types.get(point))).toEqual(["hall_ti", "hall_ti", "hall_ti"]);
  });

  it("mantém uma superfície com rácio fixo para que fotografia, marcadores e geometria se redimensionem juntos", () => {
    const dashboard = readFileSync(path.resolve(process.cwd(), "client/src/components/InfrastructureDashboard.tsx"), "utf8");
    expect(dashboard).toContain("aspect-[3/1]");
    expect(dashboard).toContain("object-cover object-center");
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
