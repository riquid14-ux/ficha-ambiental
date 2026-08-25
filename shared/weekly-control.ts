export const WEEKLY_CONTROL_MEASURE_PATTERN = /^\d+(?:\.\d+)?$/;

export function isWeeklyControlMeasureNumber(value: unknown): boolean {
  return WEEKLY_CONTROL_MEASURE_PATTERN.test(String(value ?? "").trim());
}
