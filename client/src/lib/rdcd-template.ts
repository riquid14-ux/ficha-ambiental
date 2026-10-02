export type RdcdSubmission = {
  id: number;
  weekNumber: number;
  weekYear: number;
  weekStartDate?: string | Date | null;
  weekEndDate?: string | Date | null;
  reviewNotes?: string | null;
};

export type RdcdResponse = {
  submissionId: number;
  measureId: number;
  status: string | null;
  observations?: string | null;
};

export type RdcdMeasure = {
  id: number;
  number?: string | number | null;
  sectionId?: number | null;
  description?: string | null;
};

export type RdcdSection = { id: number; name: string };

const formatDate = (value?: string | Date | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-PT");
};

const shortPeriod = (submission: RdcdSubmission) => {
  const start = formatDate(submission.weekStartDate);
  const end = formatDate(submission.weekEndDate);
  return start !== "—" && end !== "—" ? `${start} – ${end}` : `Semana ${submission.weekNumber}/${submission.weekYear}`;
};

const responseCounts = (responses: RdcdResponse[]) => ({
  i: responses.filter(item => item.status === "I").length,
  c: responses.filter(item => item.status === "C").length,
  nc: responses.filter(item => item.status === "NC").length,
  na: responses.filter(item => item.status === "NA").length,
});

export function buildRdcdWeeklyRows(
  submissions: RdcdSubmission[],
  responses: RdcdResponse[],
  measures: RdcdMeasure[],
  sections: RdcdSection[],
  reportPhase?: string,
) {
  const measureById = new Map(measures.map(item => [item.id, item]));
  const sectionById = new Map(sections.map(item => [item.id, item.name]));
  return submissions
    .slice()
    .sort((a, b) => a.weekYear - b.weekYear || a.weekNumber - b.weekNumber)
    .map(submission => {
      const submissionResponses = responses.filter(item => item.submissionId === submission.id);
      const counts = responseCounts(submissionResponses);
      const phases = Array.from(new Set(submissionResponses.map(item => sectionById.get(measureById.get(item.measureId)?.sectionId || -1)).filter(Boolean)));
      const observations = [submission.reviewNotes, ...submissionResponses.map(item => item.observations).filter(Boolean)]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 320);
      return {
        submissionId: submission.id,
        reference: `ID ${submission.id}`,
        week: submission.weekNumber,
        period: shortPeriod(submission),
        // O quadro semanal deve identificar a fase declarada no relatório, não
        // enumerar todas as secções técnicas (incluindo N.A.), que pertencem ao
        // detalhe consolidado do ponto 5.
        phases: reportPhase?.trim() || (phases.length > 0 ? phases.join(", ") : "—"),
        ...counts,
        observations: observations || "Sem observações relevantes.",
      };
    });
}

export function buildRdcdPhaseRows(
  responses: RdcdResponse[],
  measures: RdcdMeasure[],
  sections: RdcdSection[],
) {
  const responsesByMeasure = new Map<number, RdcdResponse[]>();
  for (const response of responses) {
    const current = responsesByMeasure.get(response.measureId) || [];
    responsesByMeasure.set(response.measureId, [...current, response]);
  }
  return sections.map(section => {
    const sectionMeasures = measures.filter(measure => measure.sectionId === section.id);
    const sectionResponses = sectionMeasures.flatMap(measure => responsesByMeasure.get(measure.id) || []);
    const counts = responseCounts(sectionResponses);
    return { section: section.name, totalMeasures: sectionMeasures.length, ...counts };
  }).filter(row => row.totalMeasures > 0);
}

export function buildRdcdNonConformityRows(
  responses: RdcdResponse[],
  measures: RdcdMeasure[],
  submissions: RdcdSubmission[],
) {
  const measureById = new Map(measures.map(item => [item.id, item]));
  const submissionById = new Map(submissions.map(item => [item.id, item]));
  return responses.filter(response => response.status === "NC" || Boolean(response.observations)).map(response => {
    const measure = measureById.get(response.measureId);
    const submission = submissionById.get(response.submissionId);
    return {
      number: measure?.number || String(response.measureId),
      description: measure?.description || "Medida sem descrição disponível.",
      reference: submission ? `S${submission.weekNumber}/${submission.weekYear} · ID ${submission.id}` : "—",
      finding: response.status === "NC" ? "Não Conforme" : "Observação relevante",
      observation: response.observations || "Sem comentário registado.",
    };
  });
}

export const SIN02_RDCD_METADATA = {
  projectName: "Data Center Sines 4.0 (SIN02)",
  proponent: "START – Sines TransAtlantic Renewable & Technology Campus, S.A. (NIPC 515949841)",
  tua: "TUA20220608001156",
  apaCode: "APA08400603",
  aiaRecape: "N.º 3633",
  dia: "10/08/2023 — favorável condicionada",
  dcape: "11/11/2024",
  licensingEntity: "Direção-Geral de Energia e Geologia (DGEG)",
} as const;

/**
 * A estrutura de um RDCD não pode ser copiada cegamente entre projectos.
 * SIN02 tem um modelo de obra e enquadramento institucional já confirmado;
 * SIN01/NEST usa o catálogo OPS de exploração. Os restantes projectos de obra
 * recebem o mesmo esqueleto regulamentar, mas nunca herdam TUA, APA ou outras
 * referências exclusivas do SIN02.
 */
export type RdcdProjectModel = {
  kind: "construction" | "operations";
  label: string;
  reportTitle: string;
  defaultPhase: string;
  sourceLabel: string;
  chapterFiveLabel: string;
  guidance: string;
};

export const SIN01_OPS_RDCD_MODEL: RdcdProjectModel = {
  kind: "operations",
  label: "OPS — Medidas de Operação DCAPE SIN01",
  reportTitle: "Relatório de Demonstração do Cumprimento — Operação",
  defaultPhase: "Operação do NEST",
  sourceLabel: "Medidas OPS, responsáveis, status updates e evidências da Fase de Exploração",
  chapterFiveLabel: "Estado detalhado das medidas OPS DCAPE",
  guidance: "Este relatório não usa fichas semanais de obra. Compila exclusivamente as medidas OPS do SIN01, os respetivos responsáveis, updates e evidências do período.",
};

export const SIN02_RDCD_MODEL: RdcdProjectModel = {
  kind: "construction",
  label: "RDCD SIN02 — modelo institucional de construção",
  reportTitle: "Relatório de Demonstração do Cumprimento da Decisão (DCAPE)",
  defaultPhase: "Execução da obra",
  sourceLabel: "Fichas semanais aprovadas, evidências, planos de monitorização e e-GARs",
  chapterFiveLabel: "Compilação das fichas semanais aprovadas",
  guidance: "O modelo SIN02 pré-preenche apenas o enquadramento institucional confirmado no template. A emissão mantém revisão técnica humana obrigatória.",
};

export function getRdcdProjectModel(projectCode?: string | null): RdcdProjectModel {
  if (projectCode === "SIN01") return SIN01_OPS_RDCD_MODEL;
  if (projectCode === "SIN02") return SIN02_RDCD_MODEL;
  return {
    kind: "construction",
    label: `RDCD ${projectCode || "do projeto"} — modelo de construção`,
    reportTitle: "Relatório de Demonstração do Cumprimento da Decisão (DCAPE)",
    defaultPhase: "Execução da obra",
    sourceLabel: "Fichas semanais aprovadas, evidências, planos de monitorização e e-GARs do projeto",
    chapterFiveLabel: "Compilação das fichas semanais aprovadas",
    guidance: "Este RDCD é independente do SIN02. Confirme e introduza os elementos legais e institucionais próprios do projeto antes de emitir o Word.",
  };
}

export type RdcdBrandProfileId = "startcampus_gleeds_quadrante" | "startcampus_gleeds" | "startcampus";

// Marcas extraídas do template RDCD fornecido e colocadas em storage privado.
// O perfil pode ser alterado por relatório; não altera as marcas corporativas da aplicação.
export const RDCD_BRAND_PROFILES: Record<RdcdBrandProfileId, {
  label: string;
  description: string;
  logos: Array<{ name: string; url: string; type: "png" | "jpg"; width: number; height: number }>;
}> = {
  startcampus_gleeds_quadrante: {
    label: "Start Campus · Gleeds · Quadrante",
    description: "Modelo completo do rascunho institucional recebido.",
    logos: [
      { name: "Start Campus", url: "/manus-storage/start-campus-rdcd_d271a631.png", type: "png", width: 140, height: 46 },
      { name: "Gleeds", url: "/manus-storage/gleeds-rdcd_56c50b11.png", type: "png", width: 108, height: 52 },
      { name: "Quadrante", url: "/manus-storage/quadrante-rdcd_c9e7bf7d.jpg", type: "jpg", width: 80, height: 68 },
    ],
  },
  startcampus_gleeds: {
    label: "Start Campus · Gleeds",
    description: "Preparação pela Start Campus com consultoria ambiental Gleeds.",
    logos: [
      { name: "Start Campus", url: "/manus-storage/start-campus-rdcd_d271a631.png", type: "png", width: 155, height: 50 },
      { name: "Gleeds", url: "/manus-storage/gleeds-rdcd_56c50b11.png", type: "png", width: 120, height: 58 },
    ],
  },
  startcampus: {
    label: "Start Campus",
    description: "Emissão institucional Start Campus.",
    logos: [
      { name: "Start Campus", url: "/manus-storage/start-campus-rdcd_d271a631.png", type: "png", width: 190, height: 62 },
    ],
  },
};
