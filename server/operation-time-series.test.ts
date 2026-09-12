import { describe, expect, it } from "vitest";
import { aggregateOperationReadings, pairOperationReadings } from "../client/src/lib/operation-time-series";

const at = (value: string) => new Date(value).getTime();

describe("Operação — agrupamento temporal", () => {
  const readings = [
    { metricCode: "site_energy_kwh_daily", value: 100, measuredAt: at("2026-09-01T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
    { metricCode: "site_energy_kwh_daily", value: 200, measuredAt: at("2026-09-08T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
    { metricCode: "pue", value: 1.2, measuredAt: at("2026-09-01T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
    { metricCode: "pue", value: 1.4, measuredAt: at("2026-09-08T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
    { metricCode: "site_power_15m_kw", value: 50, measuredAt: at("2026-09-01T10:00:00Z"), granularity: "quinze_minutos", dataQuality: "valid" },
    { metricCode: "site_power_15m_kw", value: 70, measuredAt: at("2026-09-01T10:15:00Z"), granularity: "quinze_minutos", dataQuality: "valid" },
    { metricCode: "site_power_15m_kw", value: 30, measuredAt: at("2026-09-01T11:00:00Z"), granularity: "quinze_minutos", dataQuality: "valid" },
    { metricCode: "pue_15m", value: 1.2, measuredAt: at("2026-09-01T10:00:00Z"), granularity: "quinze_minutos", dataQuality: "valid" },
    { metricCode: "pue_15m", value: 1.4, measuredAt: at("2026-09-01T10:15:00Z"), granularity: "quinze_minutos", dataQuality: "valid" },
  ];

  it("usa apenas leituras de quinze minutos no agrupamento por hora", () => {
    const hourly = aggregateOperationReadings(readings, "hora");
    expect(hourly).toHaveLength(2);
    expect(hourly.map(row => row.sitePower)).toEqual([60, 30]);
    expect(hourly[0].pue).toBeCloseTo(1.3, 8);
    expect(hourly[0]).not.toHaveProperty("siteEnergy");
  });

  it("agrega leituras diárias por dia, semana, mês e ano sem misturar a série horária", () => {
    expect(aggregateOperationReadings(readings, "dia")).toHaveLength(2);
    expect(aggregateOperationReadings(readings, "semana")).toHaveLength(2);
    const monthly = aggregateOperationReadings(readings, "mes");
    expect(monthly).toHaveLength(1);
    expect(monthly[0].siteEnergy).toBe(300);
    expect(monthly[0].pue).toBeCloseTo(1.3, 8);
    const yearly = aggregateOperationReadings(readings, "ano");
    expect(yearly).toHaveLength(1);
    expect(yearly[0].siteEnergy).toBe(300);
  });

  it("emparelha apenas séries válidas com o mesmo instante e granularidade", () => {
    const pairs = pairOperationReadings([
      { metricCode: "cooling_cycles_15m", value: 2, measuredAt: at("2026-09-01T10:00:00Z"), granularity: "quinze_minutos", dataQuality: "valid" },
      { metricCode: "wue_15m", value: 1.1, measuredAt: at("2026-09-01T10:00:00Z"), granularity: "quinze_minutos", dataQuality: "valid" },
      { metricCode: "cooling_cycles_15m", value: 3, measuredAt: at("2026-09-01T10:15:00Z"), granularity: "quinze_minutos", dataQuality: "valid" },
      { metricCode: "wue_15m", value: -0.2, measuredAt: at("2026-09-01T10:15:00Z"), granularity: "quinze_minutos", dataQuality: "invalid" },
      { metricCode: "wue_15m", value: 1.4, measuredAt: at("2026-09-01T11:00:00Z"), granularity: "diario", dataQuality: "valid" },
    ], "cooling_cycles_15m", "wue_15m", "quinze_minutos");
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ x: 2, y: 1.1 });
  });

  it("produz pares COP–caudal apenas para leituras diárias do mesmo período", () => {
    const pairs = pairOperationReadings([
      { metricCode: "seawater_flow_lps", value: 110, measuredAt: at("2026-09-10T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
      { metricCode: "seawater_pumping_cop", value: 21, measuredAt: at("2026-09-10T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
      { metricCode: "seawater_flow_lps", value: 115, measuredAt: at("2026-09-11T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
      { metricCode: "seawater_pumping_cop", value: 22, measuredAt: at("2026-09-11T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
      { metricCode: "seawater_flow_lps", value: 120, measuredAt: at("2026-09-12T00:00:00Z"), granularity: "diario", dataQuality: "invalid" },
      { metricCode: "seawater_pumping_cop", value: 23, measuredAt: at("2026-09-12T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
    ], "seawater_flow_lps", "seawater_pumping_cop", "diario");
    expect(pairs).toEqual([expect.objectContaining({ x: 110, y: 21 }), expect.objectContaining({ x: 115, y: 22 })]);
  });
});
