import React, { type ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export type StandPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  context?: string;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: "standard" | "operations" | "governance";
};

const toneClasses = {
  standard: "from-card via-card to-emerald-50/70 dark:to-emerald-950/20",
  operations: "from-slate-950 via-emerald-950 to-teal-950 text-white border-emerald-800/60",
  governance: "from-card via-card to-sky-50/70 dark:to-sky-950/20",
};

export function StandPageHeader({
  eyebrow,
  title,
  description,
  context,
  actions,
  children,
  tone = "standard",
}: StandPageHeaderProps) {
  const isOperations = tone === "operations";

  return (
    <section className={`stand-page-header relative isolate overflow-hidden border bg-gradient-to-br ${toneClasses[tone]}`}>
      <div className={`pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full blur-3xl ${isOperations ? "bg-emerald-400/20" : "bg-emerald-500/10"}`} />
      <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <p className={`stand-kicker ${isOperations ? "text-emerald-200" : "text-primary"}`}>{eyebrow}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="stand-page-title">{title}</h1>
            {context && <Badge variant="outline" className={isOperations ? "border-white/20 bg-white/10 text-emerald-50" : "border-primary/20 bg-primary/5 text-primary"}>{context}</Badge>}
          </div>
          {description && <p className={`mt-2 max-w-2xl text-sm leading-6 ${isOperations ? "text-emerald-50/75" : "text-muted-foreground"}`}>{description}</p>}
          {children && <div className="mt-4">{children}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {!isOperations && <Sparkles aria-hidden className="pointer-events-none absolute bottom-4 right-5 h-5 w-5 text-primary/15" />}
    </section>
  );
}

export default StandPageHeader;
