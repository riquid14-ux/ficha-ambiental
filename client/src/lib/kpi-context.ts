export type KpiMetricContext = {
  id: number;
  name: string;
  category: string;
  sortOrder?: number | string | null;
};

const KPI_VALUE_LABELS: Record<string, string> = {
  "trabalhadores em obra": "Número de trabalhadores em obra",
  "trabalhadores locais": "Número de trabalhadores locais em obra",
  "total horas trabalhadas": "Total de horas trabalhadas",
  "técnicos de ambiente": "Número de técnicos de ambiente afectos à obra",
  "veículos elétricos": "Número de veículos eléctricos afectos à obra",
  "veículos a combustão": "Número de veículos a combustão afectos à obra",
  "trabalhadores car sharing": "Número de trabalhadores em viatura partilhada",
  "trabalhadores transporte público": "Número de trabalhadores que utilizam transporte público",
  "trabalhadores a pé/bicicleta": "Número de trabalhadores que se deslocam a pé ou de bicicleta",
  "trabalhadores veículo próprio (sem partilha)": "Número de trabalhadores em veículo próprio sem partilha",
  "distância média deslocação": "Distância média de deslocação dos trabalhadores",
  "gasóleo (diesel)": "Consumo de gasóleo",
  "gerador": "Consumo de combustível dos geradores",
  "equipamento": "Consumo de combustível dos equipamentos",
  "gasolina": "Consumo de gasolina",
  "hvo": "Consumo de HVO",
  "eletricidade": "Consumo de electricidade",
  "consumo diesel (kgco2e)": "Emissões associadas ao consumo de diesel",
  "consumo hvo (kgco2e)": "Emissões associadas ao consumo de HVO",
  "consumo total combustível (kgco2e)": "Emissões totais associadas aos combustíveis",
  "água de construção": "Consumo de água de construção",
  "água de escavação": "Consumo de água de escavação",
  "água dos bombeiros": "Consumo de água dos bombeiros",
  "água potável": "Consumo de água potável",
  "água do garrafão": "Consumo de água engarrafada",
  "água do welfare (torneiras)": "Consumo de água das torneiras de welfare",
  "água reutilizada": "Volume de água reutilizada em operações de obra",
  "águas residuais": "Volume de águas residuais geradas",
  "águas residuais wcs químicos portáteis": "Volume de águas residuais dos WCs químicos portáteis",
  "águas residuais wcs químicos contentores": "Volume de águas residuais dos WCs químicos em contentores",
  "limpezas da fossa": "Número de limpezas da fossa",
  "toolbox ambientais": "Número de toolbox ambientais realizados",
  "sugestões trabalhadores": "Número de sugestões ambientais recebidas dos trabalhadores",
  "observações ambientais": "Número de observações ambientais registadas",
  "incidentes ambientais": "Número de incidentes ambientais registados",
  "incidentes de derrames": "Número de incidentes de derrame registados",
  "incumprimento normas ambientais": "Número de incumprimentos de normas ambientais registados",
  "outros incidentes ambientais": "Número de outros incidentes ambientais registados",
  "geradores em funcionamento": "Número de geradores em funcionamento",
  "horas de funcionamento": "Total de horas de funcionamento dos geradores",
  "manutenções aos geradores": "Número de manutenções aos geradores concluídas",
  "derrames no abastecimento": "Número de derrames durante o abastecimento",
  "nível de ruído": "Nível de ruído medido no ponto de monitorização definido",
  "queixas de vizinhança": "Número de queixas ambientais de vizinhança formalmente comunicadas",
};

export function describeKpiValue(metric: Pick<KpiMetricContext, "name">, projectCode?: string, companyName?: string, week?: string, year?: string) {
  const name = metric.name.toLocaleLowerCase("pt-PT");
  const valueLabel = KPI_VALUE_LABELS[name] ?? `Valor de ${metric.name}`;
  const project = projectCode ? `no projecto ${projectCode}` : "no projecto seleccionado";
  const company = companyName ? `da empresa ${companyName}` : "da empresa seleccionada";
  const period = week && year ? `na semana ${week}/${year}` : "na semana seleccionada";
  return `${valueLabel} ${project}, ${company}, ${period}.`;
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
