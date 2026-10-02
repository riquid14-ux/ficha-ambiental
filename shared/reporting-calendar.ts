/**
 * Adds calendar months in UTC and preserves the date where possible. If the
 * destination month has fewer days, uses its last calendar day (e.g. 31 Jan
 * + 3 months = 30 Apr). Timestamps are normalized to 12:00 UTC to avoid
 * daylight-saving conversion drift in date-only reporting fields.
 */
export function addCivilMonths(timestamp: number, months: number) {
  const source = new Date(timestamp);
  const targetYear = source.getUTCFullYear();
  const targetMonth = source.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return Date.UTC(
    targetYear,
    targetMonth,
    Math.min(source.getUTCDate(), lastDay),
    12,
    0,
    0,
  );
}

/** Maps the human-readable calendar periodicity to its civil-month interval. */
export function reportingPeriodMonths(periodicity?: string | null) {
  const value = (periodicity || "anual").trim().toLocaleLowerCase("pt-PT");
  if (value.includes("mensal")) return 1;
  if (value.includes("trimestral")) return 3;
  if (value.includes("semestral")) return 6;
  return 12;
}

/**
 * Expands a recurring event into the occurrences that fall within a calendar
 * year. The anchor date remains the original event's first date, so moving the
 * visible year never drifts due dates by a day or month.
 */
export function reportingOccurrencesForYear(anchorAt: number, periodicity: string | null | undefined, year: number) {
  const interval = reportingPeriodMonths(periodicity);
  const occurrences: number[] = [];
  const firstOfYear = Date.UTC(year, 0, 1, 12, 0, 0);
  const firstOfNextYear = Date.UTC(year + 1, 0, 1, 12, 0, 0);
  let occurrence = anchorAt;
  let guard = 0;

  while (occurrence < firstOfYear && guard < 600) {
    occurrence = addCivilMonths(occurrence, interval);
    guard += 1;
  }
  while (occurrence < firstOfNextYear && guard < 700) {
    if (occurrence >= firstOfYear) occurrences.push(occurrence);
    occurrence = addCivilMonths(occurrence, interval);
    guard += 1;
  }
  return occurrences;
}
