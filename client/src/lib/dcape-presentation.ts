import {
  DCAPE_CONSTRUCTION_SUBTITLES,
  DCAPE_PHASES,
  baseDcapeNumber,
  getDcapePhaseForItem,
  isDcapeElement,
  isDcapeMeasure,
  isLegacySupportingItem,
  type DcapePhaseKey,
} from "@shared/phases";

export type CatalogueItem = {
  id: number;
  number: string;
  description: string;
  responsible?: string | null;
  sectionId: number;
  orderIndex?: number;
};

export type LogicalDcapeItem = {
  key: string;
  number: string;
  description: string;
  responsible?: string | null;
  sectionId: number;
  sectionName?: string;
  items: CatalogueItem[];
  phaseKey: DcapePhaseKey;
  kind: "element" | "measure";
};

export function phaseKeyForCatalogueItem(item: Pick<CatalogueItem, "number">): DcapePhaseKey | undefined {
  return getDcapePhaseForItem(item.number)?.key;
}

/**
 * Agrupa subitens 11.1, 40.1 e equivalentes sob a obrigação numerada principal.
 * Assim o produto apresenta as 111 medidas regulamentares, sem apagar nem
 * esconder o detalhe técnico que suporta cada uma.
 */
export function logicalDcapeItems(
  items: CatalogueItem[],
  phaseKey: DcapePhaseKey,
  sectionNames: Record<number, string> = {},
): LogicalDcapeItem[] {
  const inPhase = items
    .filter(item => phaseKeyForCatalogueItem(item) === phaseKey)
    .filter(item => !isLegacySupportingItem(item.number));

  // Alguns catálogos de obra preservam as linhas históricas EX-1…EX-19 para
  // auditoria, além da numeração DCAPE canónica 92…110. Quando a fonte
  // canónica existe, EX é a mesma obrigação com outro identificador e não pode
  // duplicar a Timeline. SIN01 não possui 92…110, pelo que as suas 19 linhas EX
  // permanecem visíveis como o catálogo operacional efetivo.
  const hasCanonicalExploration = phaseKey === "exploracao" && inPhase.some(item => {
    const number = baseDcapeNumber(item.number);
    return number !== null && number >= 92 && number <= 110;
  });
  const visible = hasCanonicalExploration
    ? inPhase.filter(item => !/^EX-/i.test(String(item.number).trim()))
    : inPhase;

  const groups = new Map<string, CatalogueItem[]>();
  for (const item of visible) {
    const raw = String(item.number).trim();
    const key = isDcapeElement(raw) ? raw.toUpperCase() : String(baseDcapeNumber(raw) ?? raw);
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  return Array.from(groups.values())
    .map((group: CatalogueItem[]): LogicalDcapeItem => {
      const root = group.find(item => String(item.number).trim() === String(baseDcapeNumber(item.number))) || group[0];
      return {
        key: isDcapeElement(root.number) ? root.number.toUpperCase() : String(baseDcapeNumber(root.number)),
        number: root.number,
        description: root.description,
        responsible: root.responsible,
        sectionId: root.sectionId,
        sectionName: sectionNames[root.sectionId],
        items: group.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
        phaseKey,
        kind: isDcapeElement(root.number) ? "element" : "measure",
      };
    })
    .sort((a: LogicalDcapeItem, b: LogicalDcapeItem) => {
      const aNumber = isDcapeElement(a.number) ? Number.parseInt(a.number.split("-")[1] || "0", 10) : baseDcapeNumber(a.number) || 0;
      const bNumber = isDcapeElement(b.number) ? Number.parseInt(b.number.split("-")[1] || "0", 10) : baseDcapeNumber(b.number) || 0;
      return aNumber - bNumber;
    });
}

export function logicalStatus(
  item: LogicalDcapeItem,
  statuses: Record<number, { trackingStatus?: string | null; status?: string | null }> = {},
) {
  const values = item.items.map(child => statuses[child.id]?.trackingStatus || statuses[child.id]?.status || "nao_iniciado");
  if (values.length > 0 && values.every(value => value === "concluido")) return "concluido";
  if (values.some(value => value === "bloqueado")) return "bloqueado";
  if (values.some(value => value === "em_validacao")) return "em_validacao";
  if (values.some(value => value === "em_curso" || value === "pendente")) return "em_curso";
  return "nao_iniciado";
}

export function phaseLogicalSummary(
  items: CatalogueItem[],
  phaseKey: DcapePhaseKey,
  statuses: Record<number, { trackingStatus?: string | null; status?: string | null }> = {},
) {
  const logical = logicalDcapeItems(items, phaseKey);
  const measures = logical.filter(item => item.kind === "measure");
  const elements = logical.filter(item => item.kind === "element");
  // Medidas e elementos documentais (PL, SL, PC e CC) são obrigações
  // regulamentares. Incluir ambos impede que fases documentais surjam como
  // "0/0" quando têm itens efectivamente acompanhados.
  const count = (status: string) => logical.filter(item => logicalStatus(item, statuses) === status).length;
  const concluded = count("concluido");
  const inProgress = logical.filter(item => ["em_curso", "em_validacao", "bloqueado"].includes(logicalStatus(item, statuses))).length;
  return {
    elements,
    measures,
    obligations: logical,
    total: logical.length,
    measureTotal: measures.length,
    elementTotal: elements.length,
    concluded,
    inProgress,
    pending: Math.max(0, logical.length - concluded - inProgress),
  };
}

export function constructionSubtitleForItem(item: LogicalDcapeItem) {
  const number = baseDcapeNumber(item.number);
  if (!number) return undefined;
  return DCAPE_CONSTRUCTION_SUBTITLES.find(group => number >= group.range[0] && number <= group.range[1]);
}

export const DCAPE_PHASE_ORDER = DCAPE_PHASES.map(phase => phase.key);

export function isTimelinePhaseApplicable(projectCode?: string | null, phaseKey?: DcapePhaseKey) {
  if (projectCode === "SIN01") return phaseKey === "exploracao" || phaseKey === "desativacao";
  return true;
}

export { isDcapeMeasure };
