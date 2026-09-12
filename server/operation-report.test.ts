import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildOperationScenario, extractOperationalReadings, parseOperationInvoicesWorkbook, summarizeOperationQuality } from "./routers";

const formula = (result: number | string) => ({ formula: "TEST", result });

function createDailyReportWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const daily = workbook.addWorksheet("Daily Report (v2)");
  daily.getCell("C4").value = formula("2026-09-11T00:00:00.000Z");
  daily.getRow(6).values = [null, "", "Site", "Warhol", "Artic", "Blue", "IT", "Non-IT", "ESW", "ICT", "", "", "PUE"];
  daily.getRow(9).values = ["Average Power", "", formula(14580.46), formula(2167), formula(9788), formula(63), formula(12019.11), formula(2561), formula(115.64)];
  daily.getRow(12).values = ["Total Daily Consumption", "", formula(349931.06), formula(52009), formula(234934), formula(1514), formula(288458.68), formula(61472), formula(2775.25), "", "", "", formula(-286.54)];
  const seawater = workbook.addWorksheet("Seawater_strings (v2)");
  seawater.getRow(6).values = [null, "Seawater Temperature (ºC)", "Seawater Temperature (ºC)", "Air Temperature", "Air Temperature", "PCW Supply Temperature", "PCW Supply Temperature", "PCW Supply Temperature", "PCW Return Temperature", "PCW Return Temperature", "PCW Return Temperature", "Seawater Return Temperature", "Seawater Return Temperature", "Seawater Return Temperature", "Wind Speed (Km/h)", "Wind Speed (Km/h)", "Wind Speed (Km/h)", "Seawater Flow (L/s)", "Seawater Flow (L/s)", "Seawater Flow (L/s)"];
  seawater.getRow(9).values = ["Avrg", formula(16.12), formula(16.12), formula(21.58), formula(21.58), formula(18.72), formula(18.72), formula(18.72), formula(26.81), formula(26.81), formula(26.81), formula(22.02), formula(22.02), formula(22.02), formula(11.16), formula(11.16), formula(11.16), formula(111.52), formula(111.52), formula(111.52)];
  seawater.getCell("R12").value = "Seawater Avg. Thermal Load";
  seawater.getCell("R14").value = formula(2623.21);
  return workbook;
}

describe("Operação — importação e cenários", () => {
  it("lê datas e valores resultados de fórmulas, preservando a WUE inválida apenas para auditoria", () => {
    const extracted = extractOperationalReadings(createDailyReportWorkbook());
    const byCode = new Map(extracted.readings.map(reading => [reading.metricCode, reading]));
    expect(extracted.measuredDate).toBe("2026-09-11");
    expect(byCode.get("seawater_flow_lps")?.value).toBeCloseTo(111.52, 2);
    expect(byCode.get("seawater_intake_temp_c")?.value).toBeCloseTo(16.12, 2);
    expect(byCode.get("seawater_pumping_cop")?.value).toBeCloseTo(22.68, 2);
    expect(byCode.get("wue_reportado")).toMatchObject({ value: -286.54, dataQuality: "invalid" });
    expect(extracted.qualityStatus).toBe("warning");
  });

  it("mantém os cenários separados e calcula energia, água, carbono e custo a partir dos pressupostos", () => {
    const scenario = buildOperationScenario({ tiEnergyKwh: 1000, baselinePue: 1.2, baselineWaterM3: 20, baselineMaintenanceEur: 50, electricityPriceEurKwh: 0.2, waterPriceEurM3: 2, carbonFactorKgKwh: 0.4, targetPue: 1.1, targetWueLkwh: 10, maintenanceEur: 40, systemMix: { agua_mar: 60, chiller: 40 } });
    expect(scenario).toMatchObject({ formulaVersion: "operacao-v1", energyDeltaKwh: -100, waterDeltaM3: -10, carbonDeltaKg: -40, systemMix: { agua_mar: 60, chiller: 40 } });
    expect(scenario.costDeltaEur).toBeCloseTo(-50, 5);
  });

  it("importa faturas de uma folha estruturada e recusa períodos incoerentes", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Faturas Operação");
    sheet.addRow(["Tipo", "Fornecedor", "N.º da fatura", "Início", "Fim", "Quantidade", "Unidade", "Custo total (EUR)", "Notas"]);
    sheet.addRow(["Eletricidade", "Fornecedor de teste", "FT-001", "2026-09-01", "2026-09-30", 1250, "kWh", 250.5, "Leitura faturada"]);
    expect(parseOperationInvoicesWorkbook(workbook)).toEqual([expect.objectContaining({ invoiceType: "eletricidade", periodStart: "2026-09-01", periodEnd: "2026-09-30", quantity: 1250, unit: "kWh", totalCost: 250.5 })]);
    sheet.addRow(["Água potável", "Fornecedor de teste", "FT-002", "2026-10-02", "2026-10-01", 12, "m³", 20, ""]);
    expect(() => parseOperationInvoicesWorkbook(workbook)).toThrow("fim do período é anterior");
  });

  it("expõe a cobertura de dados sem integrar leituras inválidas na percentagem válida", () => {
    expect(summarizeOperationQuality([{ dataQuality: "valid" }, { dataQuality: "warning" }, { dataQuality: "invalid" }, { dataQuality: "valid" }])).toEqual({ total: 4, valid: 2, warnings: 1, invalid: 1, coveragePercent: 50 });
  });
});
