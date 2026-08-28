export type KpiMetricContext = {
  id: number;
  name: string;
  category: string;
  sortOrder?: number | string | null;
};

export function describeKpiValue(metric: Pick<KpiMetricContext, "name">, projectCode?: string, companyName?: string, week?: string, year?: string) {
  const scope = [projectCode ? `projecto ${projectCode}` : null, companyName ? `empresa ${companyName}` : null]
    .filter(Boolean)
    .join(" · ");
  const period = week && year ? ` para a semana ${week}/${year}` : "";
  return `Registe o valor semanal de ${metric.name}${period}${scope ? ` no ${scope}` : ""}.`;
}

export function splitWaterMetrics<T extends KpiMetricContext>(metrics: T[]) {
  const waterMetrics = metrics
    .filter(metric => metric.category === "water")
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) || a.id - b.id);
  const affluentCount = Math.min(4, waterMetrics.length);
  return {
    operational: waterMetrics.slice(0, waterMetrics.length - affluentCount),
    affluent: waterMetrics.slice(-affluentCount),
  };
}
