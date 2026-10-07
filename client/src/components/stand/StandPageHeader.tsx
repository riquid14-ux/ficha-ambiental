import React, { type ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { BrandImageMode } from "@/lib/brand-images";

export type StandPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  context?: string;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: "standard" | "operations" | "governance";
  /** Fotografia institucional obtida através de useBrandImage. */
  image?: string;
  imagePosition?: string;
  imageMode?: BrandImageMode;
};

const toneClasses = {
  standard: "border-border bg-card",
  operations: "ops-surface",
  governance: "border-border bg-card",
};

export function StandPageHeader({
  eyebrow,
  title,
  description,
  context,
  actions,
  children,
  tone = "standard",
  image,
  imagePosition = "center",
  imageMode = "background",
}: StandPageHeaderProps) {
  const isOperations = tone === "operations";
  const hasBackgroundImage = Boolean(image) && imageMode === "background";
  // A fotografia é o suporte visual do cabeçalho. Em claro, o texto é lido sobre
  // uma película clara; no tema escuro a película torna-se verde-profunda.
  const useLightText = isOperations && !hasBackgroundImage;

  return (
    <section
      data-photographic={hasBackgroundImage ? "true" : "false"}
      data-operations={isOperations ? "true" : "false"}
      className={`stand-page-header relative isolate overflow-hidden ${toneClasses[tone]}`}
    >
      {hasBackgroundImage && (
        <>
          <img
            src={image}
            alt=""
            className="stand-page-header-photo absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: imagePosition }}
            onError={(event) => { event.currentTarget.style.display = "none"; }}
          />
          <div className="stand-page-header-photo-overlay absolute inset-0" />
        </>
      )}
      {image && imageMode === "side" && (
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[36%] overflow-hidden lg:block">
          <img src={image} alt="" className="h-full w-full object-cover" style={{ objectPosition: imagePosition }} />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-card/20 to-card" />
        </div>
      )}
      {!isOperations && !hasBackgroundImage && <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/55" />}

      <div className="stand-page-header-content relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <p className={`stand-kicker ${useLightText ? "text-primary" : "text-primary"}`}>{eyebrow}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className={`stand-page-title ${useLightText ? "text-white" : ""}`}>{title}</h1>
            {context && (
              <Badge
                variant="outline"
                className={useLightText ? "border-white/25 bg-card/10 text-white" : "border-primary/20 bg-primary/5 text-primary"}
              >
                {context}
              </Badge>
            )}
          </div>
          {description && <p className={`mt-2 max-w-2xl text-sm leading-6 ${useLightText ? "text-white/78" : "text-muted-foreground"}`}>{description}</p>}
          {children && <div className={`mt-4 ${useLightText ? "text-white" : ""}`}>{children}</div>}
        </div>
        {actions && <div className={`flex shrink-0 flex-wrap items-center gap-2 ${useLightText ? "text-white" : ""}`}>{actions}</div>}
      </div>
      {!isOperations && !hasBackgroundImage && <Sparkles aria-hidden className="pointer-events-none absolute bottom-4 right-5 h-5 w-5 text-primary/15" />}
    </section>
  );
}

export default StandPageHeader;
