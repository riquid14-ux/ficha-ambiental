export type KpiMetricContext = {
  id: number;
  name: string;
  category: string;
  sortOrder?: number | string | null;
};

const KPI_VALUE_LABELS: Record<string, string> = {
  "trabalhadores em projeto": "Número total de trabalhadores no projeto",
  "trabalhadores locais": "Trabalhadores com residência até 60 km do projeto",
  "total horas trabalhadas": "Total de horas trabalhadas por todos os trabalhadores",
  "técnicos de ambiente": "Número de técnicos de ambiente no projeto",
  "veículos elétricos": "Número de carros elétricos usados pelos trabalhadores para vir ao projeto",
  "veículos a combustão": "Número de carros a gasóleo ou gasolina usados pelos trabalhadores para vir ao projeto",
  "trabalhadores car sharing": "Número de trabalhadores que vieram em boleia partilhada",
  "trabalhadores transporte público": "Número de trabalhadores que vieram de transporte público",
  "trabalhadores a pé/bicicleta": "Número de trabalhadores que vieram a pé ou de bicicleta",
  "trabalhadores veículo próprio (sem partilha)": "Número de trabalhadores que vieram sozinhos no próprio carro",
  "distância média de deslocação": "Distância média de casa ao projeto, apenas ida",
  "gasóleo (diesel)": "Litros de gasóleo abastecido em máquinas, equipamento e geradores",
  "gasolina": "Litros de gasolina abastecida em máquinas e ferramentas",
  "hvo": "Litros de HVO abastecido em substituição do gasóleo",
  "eletricidade": "Eletricidade consumida no estaleiro pela leitura do contador",
  "consumo diesel": "Calculado automaticamente a partir do gasóleo registado; não preencher",
  "consumo hvo": "Calculado automaticamente a partir do HVO registado; não preencher",
  "consumo total combustível": "Calculado automaticamente pela soma do diesel e HVO; não preencher",
  "água de construção": "Água usada na construção, compactação, controlo de poeiras, betão ou lavagem de equipamento",
  "água de escavação": "Água bombada das escavações e valas",
  "água dos bombeiros": "Água usada e adquirida pelos bombeiros",
  "água potável": "Água potável utilizada no projeto",
  "água do garrafão": "Água em garrafões fornecida aos trabalhadores",
  "água do welfare (torneiras)": "Água gasta nas torneiras das instalações sociais e sanitárias",
  "água reutilizada": "Água reaproveitada no projeto, por exemplo de escavação para controlo de poeiras",
  "águas residuais": "Águas residuais recolhidas e enviadas para tratamento",
  "águas residuais wcs químicos portáteis": "Águas residuais recolhidas dos WCs químicos portáteis",
  "águas residuais wcs químicos contentores": "Águas residuais recolhidas dos WCs químicos em contentores",
  "limpezas da fossa": "Número de limpezas da fossa séptica realizadas",
  "toolbox ambientais": "Número de toolbox talks ambientais dadas aos trabalhadores",
  "sugestões trabalhadores": "Número de sugestões de melhoria ambiental deixadas pelos trabalhadores",
  "observações ambientais": "Número de situações ambientais menores registadas nas inspeções de rotina",
  "incidentes ambientais": "Total de incidentes ambientais, incluindo derrames, incumprimentos e outros incidentes",
  "incidentes de derrames": "Número de derrames de combustíveis, óleos ou químicos, de qualquer dimensão",
  "incumprimento normas ambientais": "Número de incumprimentos de licenças ou normas ambientais detetados",
  "outros incidentes ambientais": "Número de incidentes ambientais não incluídos nas categorias anteriores",
  "geradores em funcionamento": "Número de geradores que estiveram a trabalhar",
  "horas de funcionamento": "Total de horas em que os geradores estiveram ligados",
  "manutenções aos geradores": "Número de manutenções ou inspeções aos geradores realizadas",
  "derrames no abastecimento": "Número de derrames de gasóleo ou óleo junto aos geradores",
  "nível de ruído": "Ruído medido nos pontos de monitorização definidos",
  "queixas de vizinhança": "Número de queixas da vizinhança por ruído, poeiras ou outros incómodos",
};

export function describeKpiValue(metric: Pick<KpiMetricContext, "name">, projectCode?: string, companyName?: string, week?: string, year?: string) {
  const name = metric.name.toLocaleLowerCase("pt-PT");
  const valueLabel = KPI_VALUE_LABELS[name] ?? `Valor de ${metric.name}`;
  const project = projectCode ? `no projecto ${projectCode}` : "no projecto seleccionado";
  const company = companyName ? `da empresa ${companyName}` : "da empresa seleccionada";
  const period = week && year ? `na semana ${week}/${year}` : "na semana seleccionada";
  return `${valueLabel}, ${project}, ${company}, ${period}.`;
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
