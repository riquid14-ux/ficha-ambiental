import type { ReactNode } from "react";

type TooltipEntry = {
  name?: string;
  value?: string | number | null;
  color?: string;
  dataKey?: string;
};

function formatValue(value: unknown, locale = "pt-PT") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  }
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

/**
 * Tooltip semanticamente neutro para Recharts. Mantém nome, valor e cor legíveis
 * em ambos os temas e evita que o utilizador dependa de etiquetas minúsculas no eixo.
 */
export function ReadableChartTooltip({
  active,
  payload,
  label,
  locale = "pt-PT",
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  locale?: string;
}) {
  const entries = (payload || []).filter(entry => entry.value !== null && entry.value !== undefined && entry.value !== "");
  if (!active || entries.length === 0) return null;

  return (
    <div className="min-w-44 rounded-xl border border-border/80 bg-popover/95 px-3 py-2.5 text-popover-foreground shadow-xl backdrop-blur-sm">
      {label !== undefined && <p className="mb-2 border-b border-border/70 pb-2 text-xs font-semibold text-foreground">{label}</p>}
      <div className="space-y-1.5">
        {entries.map((entry, index) => (
          <div key={`${entry.dataKey || entry.name || "value"}-${index}`} className="flex items-center justify-between gap-5 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color || "var(--primary)" }} />
              <span className="truncate">{entry.name || entry.dataKey}</span>
            </span>
            <strong className="shrink-0 font-mono tabular-nums text-foreground">{formatValue(entry.value, locale)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartEmptyState({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-52 items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 text-center text-sm leading-6 text-muted-foreground">{children}</div>;
}

export const readableAxisTick = { fill: "var(--muted-foreground)", fontSize: 12 };
export const readableGridStroke = "var(--border)";
