export type DcapePhaseKey =
  | "pre_licenciamento"
  | "licenciamento"
  | "pre_construcao"
  | "construcao"
  | "final_construcao"
  | "exploracao"
  | "desativacao";

export type DcapePhaseDefinition = {
  key: DcapePhaseKey;
  order: number;
  name: string;
  shortName: string;
  nameEn: string;
  shortNameEn: string;
  measureRange: [number, number] | null;
  elementRange: [number, number] | null;
  appliesToNest: boolean;
  aliases: readonly string[];
};

/**
 * Fonte única da cronologia DCAPE (AIA/RECAPE 3633, 11-11-2024).
 * `aliases` existe apenas para migração e leitura de dados legados; qualquer
 * nova escrita deve usar exclusivamente a chave e o nome canónico desta lista.
 */
export const DCAPE_PHASES: readonly DcapePhaseDefinition[] = [
  {
    key: "pre_licenciamento",
    order: 1,
    name: "Previamente ao licenciamento",
    shortName: "Pré-licenciamento",
    nameEn: "Before licensing",
    shortNameEn: "Pre-licensing",
    elementRange: [1, 3],
    measureRange: null,
    appliesToNest: false,
    aliases: ["Prévias Licenciamento", "Pré-Licenciamento", "Previamente ao Licenciamento", "previas_licenciamento"],
  },
  {
    key: "licenciamento",
    order: 2,
    name: "Em sede de licenciamento",
    shortName: "Licenciamento",
    nameEn: "At licensing stage",
    shortNameEn: "Licensing",
    elementRange: [4, 5],
    measureRange: null,
    appliesToNest: false,
    aliases: ["Em Sede de Licenciamento", "Licenciamento", "sede_licenciamento"],
  },
  {
    key: "pre_construcao",
    order: 3,
    name: "Previamente ao início da fase de construção",
    shortName: "Pré-construção",
    nameEn: "Before the construction phase begins",
    shortNameEn: "Pre-construction",
    elementRange: [6, 23],
    measureRange: [1, 16],
    appliesToNest: false,
    aliases: ["Pré-Construção", "Preparação Prévia", "Preparação Prévia à Construção", "pre_construcao", "preparacao_previa"],
  },
  {
    key: "construcao",
    order: 4,
    name: "Fase de construção",
    shortName: "Construção",
    nameEn: "Construction phase",
    shortNameEn: "Construction",
    elementRange: [24, 25],
    measureRange: [17, 86],
    appliesToNest: false,
    aliases: ["Execução da Obra", "Construção", "execucao_obra", "construcao"],
  },
  {
    key: "final_construcao",
    order: 5,
    name: "Fase final da construção",
    shortName: "Final da construção",
    nameEn: "Final construction phase",
    shortNameEn: "Construction close-out",
    elementRange: null,
    measureRange: [87, 91],
    appliesToNest: false,
    aliases: ["Fase Final", "Fase Final Construção", "Fase Final de Construção", "fase_final", "fase_final_construcao", "final_construcao"],
  },
  {
    key: "exploracao",
    order: 6,
    name: "Fase de exploração",
    shortName: "Exploração",
    nameEn: "Operational phase",
    shortNameEn: "Operations",
    elementRange: null,
    measureRange: [92, 110],
    appliesToNest: true,
    aliases: ["Exploração", "Operação", "Exploração / Operação", "exploracao", "operacao"],
  },
  {
    key: "desativacao",
    order: 7,
    name: "Fase de desativação",
    shortName: "Desativação",
    nameEn: "Decommissioning phase",
    shortNameEn: "Decommissioning",
    elementRange: null,
    measureRange: [111, 111],
    appliesToNest: true,
    aliases: ["Desativação", "Desativação (Pós-Exploração)", "desativacao"],
  },
] as const;

export const DCAPE_MONITORING_PROGRAMMES = [
  { number: 1, name: "Recursos hídricos", nameEn: "Water resources", archaeology: false },
  { number: 2, name: "Avifauna nas linhas de 400 kV", nameEn: "Birdlife on the 400 kV lines", archaeology: false },
  { number: 3, name: "Recriação dos habitats", nameEn: "Habitat restoration", archaeology: false },
  { number: 4, name: "Meio marinho (STARTSW)", nameEn: "Marine environment (STARTSW)", archaeology: false },
  { number: 5, name: "Ambiente sonoro", nameEn: "Noise environment", archaeology: false },
  { number: 6, name: "Campos eletromagnéticos", nameEn: "Electromagnetic fields", archaeology: false },
  { number: 7, name: "Arqueologia subaquática", nameEn: "Underwater archaeology", archaeology: true },
] as const;

export const DCAPE_OTHER_PLANS = [
  { number: 1, name: "PGCEVEI", nameEn: "Invasive Alien Plant Species Management and Control Plan", archaeology: false },
  { number: 2, name: "Projeto de Integração Paisagística", nameEn: "Landscape Integration Project", archaeology: false },
  { number: 3, name: "Plano de Acessos", nameEn: "Access Plan", archaeology: false },
  { number: 4, name: "PRAI", nameEn: "Intervened Areas Recovery Plan", archaeology: false },
  { number: 5, name: "PGRFSLL", nameEn: "400 kV Line Easement Corridor Management Plan", archaeology: false },
  { number: 6, name: "Plano de percursos de transporte", nameEn: "Transport Routes Plan", archaeology: false },
  { number: 7, name: "Economia circular", nameEn: "Circular Economy Action Plan", archaeology: false },
  { number: 8, name: "Translocação, restauro e conservação de habitats (+ PCE)", nameEn: "Habitat Translocation, Restoration and Conservation (+ PCE)", archaeology: false },
  { number: 9, name: "Compensação pelo abate de sobreiros", nameEn: "Cork Oak Removal Compensation Project", archaeology: false },
  { number: 10, name: "Compensação do Património Cultural", nameEn: "Cultural Heritage Compensation Plan", archaeology: true },
  { number: 11, name: "Plano de gestão de eficiência energética", nameEn: "Energy Efficiency Management Plan", archaeology: false },
  { number: 12, name: "Compensação da pegada de carbono", nameEn: "Carbon Footprint Compensation Project", archaeology: false },
  { number: 13, name: "Plano de Valorização Social Sines 4.0", nameEn: "Sines 4.0 Social Value Plan", archaeology: false },
] as const;

export const DCAPE_CONSTRUCTION_SUBTITLES = [
  { name: "Gerais", nameEn: "General", range: [17, 21] as const },
  { name: "Desarborização, desmatação, limpeza e decapagem dos solos", nameEn: "Tree clearing, scrub clearance, cleaning and topsoil stripping", range: [22, 32] as const },
  { name: "Escavações e movimentação de terras", nameEn: "Excavation and earthworks", range: [33, 41] as const },
  { name: "Construção e reabilitação de acessos", nameEn: "Construction and rehabilitation of access routes", range: [42, 46] as const },
  { name: "Circulação de veículos e funcionamento de maquinaria", nameEn: "Vehicle circulation and machinery operation", range: [47, 61] as const },
  { name: "Proteção das linhas de água, resíduos e águas residuais", nameEn: "Protection of watercourses, waste and wastewater", range: [62, 73] as const },
  { name: "Acompanhamento arqueológico", nameEn: "Archaeological monitoring", range: [74, 86] as const },
] as const;

export function baseDcapeNumber(value: string | number | null | undefined): number | null {
  const match = String(value ?? "").trim().match(/^(\d+)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getDcapePhaseByKey(key: string | null | undefined) {
  return DCAPE_PHASES.find(phase => phase.key === key);
}

export function getDcapePhaseForNumber(value: string | number | null | undefined) {
  const number = baseDcapeNumber(value);
  if (!number) return undefined;
  return DCAPE_PHASES.find(phase => phase.measureRange && number >= phase.measureRange[0] && number <= phase.measureRange[1]);
}

/**
 * O catálogo histórico conserva os elementos "PL", "SL", "PC" e "CC" como linhas
 * auditáveis. Eles não são medidas de minimização e por isso não entram no
 * total regulatório de 111 medidas.
 */
export function getDcapePhaseForItem(value: string | number | null | undefined) {
  const token = String(value ?? "").trim().toUpperCase();
  if (/^PL-/.test(token)) return getDcapePhaseByKey("pre_licenciamento");
  if (/^SL-/.test(token)) return getDcapePhaseByKey("licenciamento");
  if (/^PC-/.test(token)) return getDcapePhaseByKey("pre_construcao");
  if (/^CC-/.test(token)) return getDcapePhaseByKey("construcao");
  return getDcapePhaseForNumber(token);
}

export function isDcapeElement(value: string | number | null | undefined) {
  return /^(PL|SL|PC|CC)-/i.test(String(value ?? "").trim());
}

/** Linhas legadas de apoio, preservadas na BD mas não apresentadas como obrigação DCAPE. */
export function isLegacySupportingItem(value: string | number | null | undefined) {
  return /^(FC|DA)-/i.test(String(value ?? "").trim());
}

export function isDcapeMeasure(value: string | number | null | undefined) {
  return !isDcapeElement(value) && !isLegacySupportingItem(value) && getDcapePhaseForNumber(value) !== undefined;
}

function normalized(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function getDcapePhaseForLegacyValue(value: string | null | undefined) {
  const needle = normalized(value);
  return DCAPE_PHASES.find(phase =>
    [phase.key, phase.name, phase.shortName, ...phase.aliases]
      .map(normalized)
      .includes(needle)
  );
}

export function isArchaeologyElement(number: number) {
  return number === 3 || (number >= 12 && number <= 20);
}

export function isArchaeologyMeasure(number: number) {
  return number === 15 || number === 16 || (number >= 74 && number <= 86) || (number >= 107 && number <= 109);
}

export function dcapePhaseLabel(phase: DcapePhaseDefinition, language: "pt" | "en" = "pt") {
  return language === "en" ? phase.nameEn : phase.name;
}
