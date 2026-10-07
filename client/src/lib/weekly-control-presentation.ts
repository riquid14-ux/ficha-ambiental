import { localizeDcapeDescription } from "@/lib/dcape-descriptions-en";

export type WeeklyControlLanguage = "pt" | "en";

/**
 * A Ficha Semanal usa linhas do seu modelo Word e o seu próprio workflow
 * (EE/RAP/DO preenchem; RAA/Admin/DO revêm). Algumas bases legadas tinham
 * acrescentado um prefixo técnico "Medida DCAPE -" às descrições. Esse
 * prefixo não pertence à ficha, à revisão, ao histórico nem à curadoria RDCD.
 */
export function cleanWeeklyControlDescription(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/^\s*Medida\s+DCAPE\s*-\s*/i, "")
    .replace(/^\s*DCAPE\s+measure\s*-\s*/i, "")
    .trim();
}

/**
 * Mantém a tradução EN que já foi verificada para o texto regulamentar, mas
 * apresenta-o como linha de controlo semanal, sem a rotulagem do catálogo
 * regulatório de ciclo de vida.
 */
export function localizeWeeklyControlDescription(
  value: string | null | undefined,
  language: WeeklyControlLanguage,
) {
  const clean = cleanWeeklyControlDescription(value);
  if (language !== "en") return clean;

  const translated = localizeDcapeDescription(`Medida DCAPE - ${clean}`, "en");
  return cleanWeeklyControlDescription(translated);
}

const WEEKLY_SECTION_LABELS: Record<string, { pt: string; en: string }> = {
  "MEDIDAS DA DCAPE A CONSIDERAR NA FASE DE PREPARAÇÃO PRÉVIA À EXECUÇÃO DA OBRA": {
    pt: "Controlo semanal — preparação da obra",
    en: "Weekly control — work preparation",
  },
  "Medidas a Considerar na Fase Prévia ao início dos trabalhos da Obra": {
    pt: "Preparação antes do início dos trabalhos",
    en: "Preparation before works start",
  },
  "MEDIDAS DA DCAPE A CONSIDERAR NA FASE DE EXECUÇÃO DA OBRA": {
    pt: "Controlo semanal — execução da obra",
    en: "Weekly control — construction execution",
  },
  "Medidas a Considerar na Fase de Execução da Obra": {
    pt: "Execução da obra",
    en: "Construction execution",
  },
  "Desarborização, desmatação, limpeza e decapagem dos solos": {
    pt: "Desarborização, desmatação, limpeza e decapagem dos solos",
    en: "Tree clearing, vegetation clearance, site cleaning and topsoil stripping",
  },
  "Escavação e movimentação de terras": {
    pt: "Escavação e movimentação de terras",
    en: "Excavation and earthworks",
  },
  "Construção e reabilitação de acessos": {
    pt: "Construção e reabilitação de acessos",
    en: "Construction and rehabilitation of access routes",
  },
  "Circulação de veículos e funcionamento de maquinaria": {
    pt: "Circulação de veículos e funcionamento de maquinaria",
    en: "Vehicle circulation and machinery operation",
  },
  "Proteção de Linhas de água, resíduos e águas residuais": {
    pt: "Proteção de linhas de água, resíduos e águas residuais",
    en: "Protection of watercourses, waste and wastewater",
  },
  "Acompanhamento arqueológico": {
    pt: "Acompanhamento arqueológico",
    en: "Archaeological monitoring",
  },
  "MEDIDAS DA DCAPE PARA A FASE FINAL DA CONSTRUÇÃO": {
    pt: "Controlo semanal — fecho da construção",
    en: "Weekly control — construction close-out",
  },
  "Medidas para a fase final da construção": {
    pt: "Fecho da construção",
    en: "Construction close-out",
  },
  "MEDIDAS DA DCAPE PARA A FASE DE DESATIVAÇÃO": {
    pt: "Controlo semanal — itens previstos no modelo de obra",
    en: "Weekly control — items included in the construction model",
  },
  "Medidas para a fase final de desativação": {
    pt: "Itens previstos no modelo de obra",
    en: "Items included in the construction model",
  },
};

export function localizeWeeklyControlSectionName(
  value: string | null | undefined,
  language: WeeklyControlLanguage,
) {
  const original = String(value ?? "").trim();
  const label = WEEKLY_SECTION_LABELS[original];
  return label ? label[language] : original.replace(/\bDCAPE\b\s*[—-]?\s*/gi, "").trim();
}
