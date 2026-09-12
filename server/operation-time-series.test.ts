import { describe, expect, it } from "vitest";
import { aggregateOperationReadings } from "../client/src/lib/operation-time-series";

const at = (value: string) => new Date(value).getTime();

describe("Operação — agrupamento temporal", () => {
  const readings = [
    { metricCode: "site_energy_kwh_daily", value: 100, measuredAt: at("2026-09-01T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
    { metricCode: "site_energy_kwh_daily", value: 200, measuredAt: at("2026-09-08T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
    { metricCode: "pue", value: 1.2, measuredAt: at("2026-09-01T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
    { metricCode: "pue", value: 1.4, measuredAt: at("2026-09-08T00:00:00Z"), granularity: "diario", dataQuality: "valid" },
    { metricCode: "site_energy_kwh_daily", value: 50, measuredAt: at("2026-09-01T10:00:00Z"), granularity: "horario", dataQuality: "valid" },
    { metricCode: "site_energy_kwh_daily", value: 30, measuredAt: at("2026-09-01T11:00:00Z"), granularity: "horario", dataQuality: "valid" },
  ];

  it("usa apenas leituras horárias no agrupamento por hora", () => {
    const hourly = aggregateOperationReadings(readings, "hora");
    expect(hourly).toHaveLength(2);
    expect(hourly.map(row => row.siteEnergy)).toEqual([50, 30]);
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
});
