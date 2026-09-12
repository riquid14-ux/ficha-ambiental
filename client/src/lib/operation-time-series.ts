export type OperationGrouping = "hora" | "dia" | "semana" | "mes" | "ano";

type OperationReading = { metricCode: string; value: number; measuredAt: number; granularity: string; dataQuality: string };

const AVERAGE_FIELDS: Record<string, string> = { pue: "pue", pue_15m: "pue", seawater_intake_temp_c: "seawaterTemperature", seawater_intake_15m_c: "seawaterTemperature", seawater_return_temp_c: "seawaterReturn", seawater_flow_lps: "seawaterFlow", seawater_flow_15m_lps: "seawaterFlow", seawater_pumping_cop: "cop", site_power_15m_kw: "sitePower", it_power_15m_kw: "itPower" };
const TOTAL_FIELDS: Record<string, string> = { site_energy_kwh_daily: "siteEnergy", it_energy_kwh_daily: "itEnergy", esw_energy_kwh_daily: "eswEnergy" };

function getPeriod(date: Date, grouping: OperationGrouping) {
  if (grouping === "hora") return { key: date.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit" }), at: date.getTime() };
  if (grouping === "dia") return { key: date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }), at: date.getTime() };
  if (grouping === "semana") { const start = new Date(date); start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return { key: `Semana de ${start.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}`, at: start.getTime() }; }
  if (grouping === "mes") return { key: date.toLocaleDateString("pt-PT", { month: "short", year: "numeric" }), at: new Date(date.getFullYear(), date.getMonth(), 1).getTime() };
  return { key: String(date.getFullYear()), at: new Date(date.getFullYear(), 0, 1).getTime() };
}

export function aggregateOperationReadings(readings: OperationReading[], grouping: OperationGrouping) {
  const requiredGranularity = grouping === "hora" ? "quinze_minutos" : "diario";
  const byPeriod = new Map<string, any>();
  for (const reading of readings.filter(item => item.granularity === requiredGranularity && item.dataQuality !== "invalid")) {
    const period = getPeriod(new Date(Number(reading.measuredAt)), grouping);
    const row = byPeriod.get(period.key) || { date: period.key, at: period.at };
    const totalField = TOTAL_FIELDS[reading.metricCode];
    const averageField = AVERAGE_FIELDS[reading.metricCode];
    if (totalField) row[totalField] = (row[totalField] || 0) + Number(reading.value);
    if (averageField) { const countField = `${averageField}Count`; row[averageField] = ((row[averageField] || 0) * (row[countField] || 0) + Number(reading.value)) / ((row[countField] || 0) + 1); row[countField] = (row[countField] || 0) + 1; }
    byPeriod.set(period.key, row);
  }
  return Array.from(byPeriod.values()).sort((left, right) => left.at - right.at);
}
