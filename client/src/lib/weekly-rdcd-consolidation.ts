export type WeeklyRdcdResponse = {
  submissionId: number;
  week: number;
  year: number;
  status?: string | null;
  observations?: string | null;
};

export type WeeklyRdcdSummary = {
  key: string;
  week: number;
  year: number;
  statuses: string[];
  observations: string[];
  sourceSubmissionIds: number[];
};

const STATUS_ORDER = ["I", "C", "NC", "NA"];

export function getWeeklyRdcdKey(year: number, week: number) {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * A curadoria do RDCD é medida a medida. Quando várias fichas aprovadas
 * (por exemplo, de GCs distintos) respondem à mesma medida na mesma semana,
 * a origem mantém-se rastreável, mas a composição mostra uma só linha semanal.
 */
export function summarizeWeeklyRdcdResponses(
  responses: WeeklyRdcdResponse[]
): WeeklyRdcdSummary[] {
  const byWeek = new Map<
    string,
    {
      week: number;
      year: number;
      statuses: Set<string>;
      observations: Set<string>;
      submissionIds: Set<number>;
    }
  >();

  for (const response of responses) {
    const key = getWeeklyRdcdKey(response.year, response.week);
    const current = byWeek.get(key) || {
      week: response.week,
      year: response.year,
      statuses: new Set<string>(),
      observations: new Set<string>(),
      submissionIds: new Set<number>(),
    };
    if (response.status) current.statuses.add(response.status);
    const observation = response.observations?.trim();
    if (observation) current.observations.add(observation);
    current.submissionIds.add(response.submissionId);
    byWeek.set(key, current);
  }

  return Array.from(byWeek.entries())
    .map(([key, item]) => ({
      key,
      week: item.week,
      year: item.year,
      statuses: Array.from(item.statuses).sort((left, right) => {
        const leftOrder = STATUS_ORDER.indexOf(left);
        const rightOrder = STATUS_ORDER.indexOf(right);
        return (
          (leftOrder === -1 ? STATUS_ORDER.length : leftOrder) -
            (rightOrder === -1 ? STATUS_ORDER.length : rightOrder) ||
          left.localeCompare(right)
        );
      }),
      observations: Array.from(item.observations),
      sourceSubmissionIds: Array.from(item.submissionIds).sort((left, right) =>
        left - right
      ),
    }))
    .sort((left, right) => left.year - right.year || left.week - right.week);
}
