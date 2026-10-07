import {
  cleanWeeklyControlDescription,
  localizeWeeklyControlSectionName,
} from "@/lib/weekly-control-presentation";

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

export type RdcdLanguage = "pt" | "en";

const RDCD_SECTION_TRANSLATIONS: Record<string, string> = {
  "MEDIDAS DA DCAPE A CONSIDERAR NA FASE DE PREPARAÇÃO PRÉVIA À EXECUÇÃO DA OBRA":
    "DCAPE measures to be considered in the pre-construction preparation phase",
  "Medidas a Considerar na Fase Prévia ao início dos trabalhos da Obra":
    "Measures to be considered before construction works start",
  "MEDIDAS DA DCAPE A CONSIDERAR NA FASE DE EXECUÇÃO DA OBRA":
    "DCAPE measures to be considered during the construction phase",
  "Medidas a Considerar na Fase de Execução da Obra":
    "Measures to be considered during the construction phase",
  "Desarborização, desmatação, limpeza e decapagem dos solos":
    "Tree clearing, vegetation clearance, site cleaning and topsoil stripping",
  "Escavação e movimentação de terras": "Excavation and earthworks",
  "Construção e reabilitação de acessos": "Construction and rehabilitation of access routes",
  "Circulação de veículos e funcionamento de maquinaria":
    "Vehicle circulation and machinery operation",
  "Proteção de Linhas de água, resíduos e águas residuais":
    "Protection of watercourses, waste and wastewater",
  "Acompanhamento arqueológico": "Archaeological monitoring",
  "MEDIDAS DA DCAPE PARA A FASE FINAL DA CONSTRUÇÃO":
    "DCAPE measures for the final construction phase",
  "Medidas para a fase final da construção":
    "Measures for the final construction phase",
  "MEDIDAS DA DCAPE PARA A FASE DE DESATIVAÇÃO":
    "DCAPE measures for the decommissioning phase",
  "Medidas para a fase final de desativação":
    "Measures for the final decommissioning phase",
  "Elementos a apresentar previamente ao licenciamento":
    "Information to be submitted before licensing",
  "Pronúncias e elementos em sede de licenciamento":
    "Opinions and submissions for licensing",
  "Medidas para a fase de exploração": "Measures for the operational phase",
  "Elementos a apresentar previamente ao início da construção":
    "Information to be submitted before construction starts",
};

const RDCD_STATUS_TRANSLATIONS: Record<string, string> = {
  Cumprido: "Completed",
  "Não Conforme": "Non-compliant",
  "N.A.": "N/A",
  "Em curso": "In progress",
  Parcial: "Partial",
  "Sem dados": "No data",
  Implementada: "Implemented",
  Conforme: "Compliant",
  Reportado: "Reported",
};

export function localizeRdcdSectionName(name: string, language: RdcdLanguage) {
  return language === "en" ? RDCD_SECTION_TRANSLATIONS[name] || name : name;
}

export function localizeRdcdStatus(value: string, language: RdcdLanguage) {
  return language === "en" ? RDCD_STATUS_TRANSLATIONS[value] || value : value;
}

const formatDate = (
  value?: string | Date | null,
  language: RdcdLanguage = "pt"
) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(language === "en" ? "en-GB" : "pt-PT");
};

const shortPeriod = (
  submission: RdcdSubmission,
  language: RdcdLanguage = "pt"
) => {
  const start = formatDate(submission.weekStartDate, language);
  const end = formatDate(submission.weekEndDate, language);
  return start !== "—" && end !== "—"
    ? `${start} – ${end}`
    : `${language === "en" ? "Week" : "Semana"} ${submission.weekNumber}/${submission.weekYear}`;
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
  language: RdcdLanguage = "pt"
) {
  const measureById = new Map(measures.map(item => [item.id, item]));
  const sectionById = new Map(sections.map(item => [item.id, item.name]));
  const orderedSubmissions = submissions
    .slice()
    .sort((a, b) => a.weekYear - b.weekYear || a.weekNumber - b.weekNumber);
  const byWeek = new Map<string, RdcdSubmission[]>();
  for (const submission of orderedSubmissions) {
    const key = `${submission.weekYear}-W${String(submission.weekNumber).padStart(2, "0")}`;
    const current = byWeek.get(key) || [];
    current.push(submission);
    byWeek.set(key, current);
  }

  // O corpo do RDCD não replica uma linha por GC. A ficha de cada GC mantém-se
  // como fonte aprovada e auditável; o quadro de contexto apresenta uma síntese
  // única por semana para evitar uma emissão extensa e ilegível.
  return Array.from(byWeek.values()).map(weekSubmissions => {
    const sourceIds = new Set(weekSubmissions.map(item => item.id));
    const weekResponses = responses.filter(item => sourceIds.has(item.submissionId));
    const counts = responseCounts(weekResponses);
    const phases = Array.from(
      new Set(
        weekResponses
          .map(item =>
            sectionById.get(measureById.get(item.measureId)?.sectionId || -1)
          )
          .filter(Boolean)
      )
    );
    const observations = [
      ...weekSubmissions.map(item => item.reviewNotes),
      ...weekResponses.map(item => item.observations),
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" · ")
      .slice(0, 320);
    const firstSubmission = weekSubmissions[0];
    const formCount = weekSubmissions.length;
    return {
      submissionId: firstSubmission.id,
      submissionIds: Array.from(sourceIds),
      reference:
        language === "en"
          ? `${formCount} approved weekly form${formCount === 1 ? "" : "s"}`
          : `${formCount} ficha${formCount === 1 ? "" : "s"} aprovada${formCount === 1 ? "" : "s"}`,
      week: firstSubmission.weekNumber,
      period: shortPeriod(firstSubmission, language),
      // O quadro semanal deve identificar a fase declarada no relatório, não
      // enumerar todas as secções técnicas (incluindo N.A.), que pertencem ao
      // detalhe consolidado do ponto 5.
      phases:
        reportPhase?.trim() || (phases.length > 0 ? phases.join(", ") : "—"),
      ...counts,
      observations:
        observations ||
        (language === "en"
          ? "No relevant observations."
          : "Sem observações relevantes."),
    };
  });
}

export function buildRdcdPhaseRows(
  responses: RdcdResponse[],
  measures: RdcdMeasure[],
  sections: RdcdSection[],
  language: RdcdLanguage = "pt"
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
    return {
      // This table summarises the approved weekly construction controls. It
      // must not render the DCAPE lifecycle headings used by Timeline/Fases.
      section: localizeWeeklyControlSectionName(section.name, language),
      totalMeasures: sectionMeasures.length,
      ...counts,
    };
  }).filter(row => row.totalMeasures > 0);
}

export function buildRdcdNonConformityRows(
  responses: RdcdResponse[],
  measures: RdcdMeasure[],
  submissions: RdcdSubmission[],
  language: RdcdLanguage = "pt"
) {
  const measureById = new Map(measures.map(item => [item.id, item]));
  const submissionById = new Map(submissions.map(item => [item.id, item]));
  return responses.filter(response => response.status === "NC" || Boolean(response.observations)).map(response => {
    const measure = measureById.get(response.measureId);
    const submission = submissionById.get(response.submissionId);
    return {
      number: measure?.number || String(response.measureId),
      description: cleanWeeklyControlDescription(measure?.description) || "Medida sem descrição disponível.",
      reference: submission ? `S${submission.weekNumber}/${submission.weekYear} · ID ${submission.id}` : "—",
      finding:
        response.status === "NC"
          ? localizeRdcdStatus("Não Conforme", language)
          : language === "en"
            ? "Relevant observation"
            : "Observação relevante",
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
