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
