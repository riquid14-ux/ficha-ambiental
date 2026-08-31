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
  const name = metric.name.toLocaleLowerCase("pt-PT");
  const guidance = name.includes("nível de ruído")
    ? "Registe a leitura representativa do ponto de monitorização definido para o período."
    : name.includes("queixas de vizinhança")
      ? "Registe apenas queixas ambientais formalmente comunicadas e documentadas."
      : name.includes("derrame")
        ? "Registe cada ocorrência comunicada no período, incluindo derrames durante abastecimento."
        : name.includes("manutenções aos geradores")
          ? "Registe as manutenções preventivas ou correctivas concluídas no período."
          : name.includes("horas de funcionamento")
            ? "Registe a soma das horas de funcionamento dos geradores afectos à obra."
            : name.includes("geradores em funcionamento")
              ? "Registe o número de geradores que estiveram em funcionamento no período."
              : name.includes("água reutilizada")
                ? "Registe o volume de água reutilizada em operações de obra no período."
                : `Registe o valor semanal de ${metric.name}.`;
  return `${guidance}${period}${scope ? ` Contexto: ${scope}.` : ""}`;
}

export function splitWaterMetrics<T extends KpiMetricContext>(metrics: T[]) {
  const waterMetrics = metrics
    .filter(metric => metric.category === "water")
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) || a.id - b.id);
  const affluent = waterMetrics.filter(metric => {
    const name = metric.name.toLocaleLowerCase("pt-PT");
    return name.includes("águas residuais") || name.includes("limpezas da fossa");
  });
  return {
    operational: waterMetrics.filter(metric => !affluent.includes(metric)),
    affluent,
  };
}
