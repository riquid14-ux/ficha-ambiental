import { describe, expect, it } from "vitest";
import { buildOperationDigitalTwin, calculateOperationEnvironmentalMetrics } from "./routers";

const settings = {
  configurationMode: "approved",
  electricityCarbonFactorKgKwh: "0.3",
  maxPue: "1.20",
  maxSeawaterReturnTempC: "25",
  minSeawaterFlowLps: "100",
  maxSeawaterFlowLps: "130",
  maxSeawaterDeltaTK: "6",
};

const reading = (metricCode: string, value: number, measuredAt = Date.UTC(2026, 8, 28)) => ({ metricCode, value, measuredAt, dataQuality: "valid" });

describe("gémeo operacional do NEST", () => {
  it("traduz limites e leituras numa vista por sistemas sem inventar conformidade", () => {
    const readings = [
      reading("site_energy_kwh_daily", 1200),
      reading("it_energy_kwh_daily", 1000),
      reading("pue", 1.26),
      reading("it_power_avg_kw", 900),
      reading("seawater_flow_lps", 95),
      reading("seawater_return_temp_c", 24),
      reading("seawater_delta_t_k", 4),
      reading("seawater_pumping_cop", 18),
      reading("wue_reportado", 0.28),
    ];
    const environmental = calculateOperationEnvironmentalMetrics(readings, settings);
    const twin = buildOperationDigitalTwin(readings, environmental, { coveragePercent: 100, valid: readings.length, total: readings.length });

    expect(twin.mode).toBe("approved");
    expect(twin.observedAt).toBe(Date.UTC(2026, 8, 28));
    expect(twin.systems.find(system => system.id === "power_it")).toMatchObject({ status: "alert" });
    expect(twin.systems.find(system => system.id === "seawater")).toMatchObject({ status: "alert" });
    expect(twin.systems.find(system => system.id === "sustainability")?.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "cue", value: 0.36, source: "calculado" }),
    ]));
  });

  it("mantém sinais como referência quando as configurações são ilustrativas", () => {
    const readings = [reading("pue", 1.35), reading("it_power_avg_kw", 800), reading("site_energy_kwh_daily", 1000), reading("it_energy_kwh_daily", 800)];
    const environmental = calculateOperationEnvironmentalMetrics(readings, { ...settings, configurationMode: "illustrative" });
    const twin = buildOperationDigitalTwin(readings, environmental, { coveragePercent: 100, valid: 4, total: 4 });

    expect(twin.mode).toBe("reference");
    expect(twin.systems.find(system => system.id === "power_it")?.status).toBe("reference");
    expect(twin.systems.find(system => system.id === "sustainability")?.status).toBe("reference");
  });

  it("evidencia lacunas em vez de as classificar como sistema saudável", () => {
    const environmental = calculateOperationEnvironmentalMetrics([], settings);
    const twin = buildOperationDigitalTwin([], environmental, { coveragePercent: null, valid: 0, total: 0 });

    expect(twin.observedAt).toBeNull();
    expect(twin.systems.every(system => system.status === "data_gap")).toBe(true);
    expect(twin.counts).toEqual({ data_gap: 4 });
  });
});
