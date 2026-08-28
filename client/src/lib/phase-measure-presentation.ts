export type PhaseMeasureGroup<TMeasure = unknown> = {
  section: unknown;
  measures: TMeasure[];
};

/**
 * Uma fase pode conter uma secção estrutural sem medidas antes das secções
 * efectivamente aplicáveis. A interface não deve apresentar esse cabeçalho
 * vazio como se toda a fase não tivesse medidas.
 */
export function groupsWithMeasures<TMeasure>(groups: PhaseMeasureGroup<TMeasure>[]) {
  return groups.filter(group => group.measures.length > 0);
}
