export const PLAN_REMINDER_DAYS = [30, 15, 7] as const;

function toUtcDay(value: number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysUntilDeadline(deadline: number, now: number | Date = Date.now()) {
  return Math.round((toUtcDay(deadline) - toUtcDay(now)) / 86_400_000);
}

export function isPlanReminderDay(daysLeft: number) {
  return PLAN_REMINDER_DAYS.includes(daysLeft as (typeof PLAN_REMINDER_DAYS)[number]);
}
