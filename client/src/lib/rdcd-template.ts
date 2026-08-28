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
