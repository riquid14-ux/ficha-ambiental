const PHASE_ALIASES: Record<string, string[]> = {
  "Prévias Licenciamento": ["previas_licenciamento", "Previamente ao Licenciamento"],
  "Em Sede de Licenciamento": ["sede_licenciamento", "Em Sede de Licenciamento"],
  "Pré-Construção": ["pre_construcao", "Pré-Construção"],
  "Preparação Prévia": ["preparacao_previa", "Preparação Prévia"],
  "Execução da Obra": ["execucao_obra", "construcao", "Execução da Obra", "Construção"],
  "Fase Final": ["fase_final", "Fase Final"],
  "Fase Final Construção": ["fase_final_construcao", "Fase Final Construção"],
  "Exploração": ["exploracao", "Exploração"],
  "Desativação (Pós-Exploração)": ["desativacao", "Desativação", "Desativação (Pós-Exploração)"],
};

function normalizePhase(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function findProjectPhaseRecord(records: any[], visualPhaseKey: string) {
  const accepted = [visualPhaseKey, ...(PHASE_ALIASES[visualPhaseKey] || [])].map(normalizePhase);
  return records.find(record => {
    const candidates = [normalizePhase(record.phaseKey), normalizePhase(record.phaseName)];
    return candidates.some(candidate => accepted.includes(candidate));
  });
}
