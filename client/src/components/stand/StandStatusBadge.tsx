import type { LucideIcon } from "lucide-react";
import React from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, Info, XCircle } from "lucide-react";

export type StandStatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const styles: Record<StandStatusTone, string> = {
  success: "border-emerald-600/20 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  danger: "border-rose-600/25 bg-rose-600/10 text-rose-800 dark:text-rose-200",
  info: "border-sky-600/20 bg-sky-600/10 text-sky-800 dark:text-sky-200",
  neutral: "border-border bg-muted text-muted-foreground",
};

const icons: Record<StandStatusTone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  neutral: CircleDashed,
};

export function StandStatusBadge({ label, tone = "neutral", icon }: { label: string; tone?: StandStatusTone; icon?: LucideIcon }) {
  const Icon = icon || icons[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}><Icon className="h-3.5 w-3.5" />{label}</span>;
}

export function StandDeadlineBadge({ overdue, label }: { overdue: boolean; label: string }) {
  return <StandStatusBadge label={label} tone={overdue ? "danger" : "info"} icon={Clock3} />;
}

export default StandStatusBadge;
