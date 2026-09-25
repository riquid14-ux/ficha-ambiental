import type { LucideIcon } from "lucide-react";
import React, { type ReactNode } from "react";

export type StandMetricTone = "brand" | "success" | "info" | "warning" | "danger" | "neutral";

const toneClass: Record<StandMetricTone, string> = {
  brand: "border-primary/20 bg-primary/[0.035] dark:bg-primary/10",
  success: "border-emerald-500/20 bg-emerald-500/[0.035] dark:bg-emerald-500/10",
  info: "border-sky-500/20 bg-sky-500/[0.035] dark:bg-sky-500/10",
  warning: "border-amber-500/20 bg-amber-500/[0.04] dark:bg-amber-500/10",
  danger: "border-rose-500/20 bg-rose-500/[0.04] dark:bg-rose-500/10",
  neutral: "border-border bg-card",
};

const iconTone: Record<StandMetricTone, string> = {
  brand: "bg-primary text-primary-foreground",
  success: "bg-emerald-600 text-white",
  info: "bg-sky-600 text-white",
  warning: "bg-amber-500 text-amber-950",
  danger: "bg-rose-600 text-white",
  neutral: "bg-muted text-muted-foreground",
};

export function StandMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  onClick,
  action,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: LucideIcon;
  tone?: StandMetricTone;
  onClick?: () => void;
  action?: ReactNode;
}) {
  const interactive = Boolean(onClick);
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="stand-kicker text-muted-foreground">{label}</span>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${iconTone[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0"><p className="stand-metric-value">{value}</p>{detail && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>}</div>
        {action}
      </div>
    </>
  );

  const classes = `stand-metric-card ${toneClass[tone]} ${interactive ? "stand-interactive" : ""}`;
  return interactive ? <button type="button" onClick={onClick} className={`${classes} text-left`}>{content}</button> : <div className={classes}>{content}</div>;
}

export default StandMetricCard;
