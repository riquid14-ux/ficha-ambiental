import type { LucideIcon } from "lucide-react";
import React from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, Info, XCircle } from "lucide-react";

export type StandStatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const styles: Record<StandStatusTone, string> = {
  success: "border-primary/20 bg-primary/10 text-primary dark:text-primary",
  warning: "border-[#6D7A70]/25 bg-[#EDEBEB]/10 text-[#646461] dark:text-[#646461]",
  danger: "border-rose-600/25 bg-rose-600/10 text-rose-800 dark:text-rose-200",
  info: "border-[#0A3638]/20 bg-[#0A3638]/10 text-[#0A3638] dark:text-[#0A3638]",
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
