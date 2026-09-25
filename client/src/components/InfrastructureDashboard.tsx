import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { Activity, ArrowUpRight, Building2, Droplet, FileText, Gauge, MapPin, Server, Settings2, Sparkles, UserRound, Zap } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type InfrastructurePoint = {
  id: number | string;
  title: string;
  subtitle?: string | null;
  systemType: string;
  status: string;
  xPercent: number;
  yPercent: number;
  description?: string | null;
  metricCodes: string[];
  chartMetricCode?: string | null;
  documentTitle?: string | null;
  documentUrl?: string | null;
  technicalNote?: string | null;
  technicalData?: Array<{ label: string; value: string; unit: string }>;
  invoiceTypes?: string[];
  chartData?: { label: string; series: Array<{ key: string; label: string }>; rows: Array<Record<string, string | number>> } | null;
  chartFileName?: string | null;
  cardLayout?: "compact" | "standard" | "wide";
  cardAccent?: "teal" | "blue" | "violet" | "amber" | "slate";
  cardImageKey?: string | null;
  cardImageUrl?: string | null;
  isFuture: boolean;
  sortOrder: number;
};
type MapCoordinate = { xPercent: number; yPercent: number };
type MapLabels = { futureArea: MapCoordinate; guidance: MapCoordinate };

const DEFAULT_FUTURE_AREA: MapCoordinate[] = [{ xPercent: 7, yPercent: 83 }, { xPercent: 52, yPercent: 65 }, { xPercent: 62, yPercent: 54 }, { xPercent: 71, yPercent: 66 }, { xPercent: 76, yPercent: 83 }, { xPercent: 68, yPercent: 100 }, { xPercent: 21, yPercent: 100 }];
const DEFAULT_MAP_LABELS: MapLabels = { futureArea: { xPercent: 12, yPercent: 86 }, guidance: { xPercent: 50, yPercent: 12 } };
const REFERENCE_POINTS: InfrastructurePoint[] = [
  ...[[41, 37], [46, 30], [50, 41], [69, 55], [72, 51], [72, 55], [75, 54], [78, 55], [80, 55], [80, 60], [82, 55], [87, 56], [88, 60], [97, 34]].map(([xPercent, yPercent], index) => ({ id: `reference-marker-${index + 1}`, title: `Ponto de infraestrutura ${String(index + 1).padStart(2, "0")}`, subtitle: "A identificar", systemType: "infraestrutura", status: "a_validar", xPercent, yPercent, description: "Marcador amarelo de referência. Configure o título, dados, gráfico, documentos e nota técnica na Administração.", metricCodes: [], chartMetricCode: null, technicalNote: "Posição inicial baseada na marcação aprovada; confirme a infraestrutura em campo.", isFuture: false, sortOrder: (index + 1) * 10 })),
  { id: "reference-future", title: "Edifícios futuros", subtitle: "Planeamento", systemType: "futuro", status: "planeamento", xPercent: 15, yPercent: 75, description: "Área reservada para edifícios futuros. Não representa um alerta, risco ou não conformidade.", metricCodes: [], chartMetricCode: null, technicalNote: "Defina o âmbito quando existir informação aprovada.", isFuture: true, sortOrder: 150 },
];

const TYPE_LABELS: Record<string, string> = { energia: "Energia", hall_ti: "Sala de servidores", arrefecimento: "Arrefecimento", agua_mar: "Água", pessoa: "Operação humana", infraestrutura: "Infraestrutura", futuro: "Planeamento" };
const STATUS_LABELS: Record<string, string> = { operacional: "Operacional", planeamento: "Planeamento futuro", manutencao: "Manutenção", a_validar: "A validar" };
const METRIC_LABELS: Record<string, string> = { pue: "PUE", wue: "WUE", wue_calculated_daily: "WUE", cooling_cop: "COP", seawater_flow_lps: "Caudal", seawater_intake_temp_c: "Captação", seawater_return_temp_c: "Descarga", seawater_delta_t_k: "ΔT", site_power_kw: "Potência do site", site_energy_kwh_daily: "Energia do site", it_power_kw: "Carga TI", it_energy_kwh_daily: "Energia TI" };
const SYSTEM_ICONS: Record<string, typeof Zap> = { energia: Zap, hall_ti: Server, arrefecimento: Activity, agua_mar: Droplet, pessoa: UserRound, infraestrutura: Gauge, futuro: Sparkles };
const INVOICE_LABELS: Record<string, string> = { electricidade: "Eletricidade", agua_potavel: "Água potável", agua_industrial: "Água industrial", hvo: "HVO", gasoleo: "Gasóleo", outro: "Outro" };
const CARD_LAYOUT_CLASSES: Record<string, string> = { compact: "max-w-xl", standard: "max-w-3xl", wide: "max-w-5xl" };
// Mantém as opções históricas configuradas sem introduzir uma paleta paralela.
const CARD_ACCENT_CLASSES: Record<string, string> = { teal: "border-primary/35 bg-primary/10 text-[#e9fff1]", blue: "border-white/25 bg-card/10 text-white", violet: "border-white/25 bg-card/10 text-white", amber: "border-white/25 bg-card/10 text-white", slate: "border-white/25 bg-card/10 text-white" };

function metricValue(latest: Record<string, any>, code: string) {
  const item = latest?.[code];
  if (!item || item.dataQuality === "invalid" || !Number.isFinite(Number(item.value))) return null;
  return { value: Number(item.value), unit: item.unit || "" };
}

function displayNumber(value: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(value);
}
function clampPercent(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function futureAreaClip(points: MapCoordinate[]) { return `polygon(${points.map(point => `${point.xPercent}% ${point.yPercent}%`).join(", ")})`; }

function MiniTrend({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="text-xs text-muted-foreground">Sem série suficiente no período.</p>;
  const min = Math.min(...points); const max = Math.max(...points); const range = max - min || 1;
  const path = points.map((value, index) => `${index ? "L" : "M"}${(index / (points.length - 1)) * 100},${100 - ((value - min) / range) * 82 - 9}`).join(" ");
  return <svg viewBox="0 0 100 100" className="h-20 w-full overflow-visible" role="img" aria-label="Tendência da métrica selecionada"><path d={path} fill="none" stroke="#00C159" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" /></svg>;
}

export function InfrastructureDashboard({ projectId, points, futureArea, mapLabels, latest, readings, invoices, canConfigure, onOpenSettings }: { projectId: number; points: InfrastructurePoint[]; futureArea?: ReadonlyArray<MapCoordinate>; mapLabels?: MapLabels; latest: Record<string, any>; readings: any[]; invoices: any[]; canConfigure: boolean; onOpenSettings: () => void }) {
  const { language, t } = useLanguage();
  const [selected, setSelected] = useState<InfrastructurePoint | null>(null);
  const [droneImageUrl, setDroneImageUrl] = useState(() => `/api/operacao/media/nest-drone?projectId=${projectId}`);
  const usingReference = points.length === 0;
  const resolvedFutureArea = futureArea?.length ? futureArea : DEFAULT_FUTURE_AREA;
  const resolvedLabels = mapLabels || DEFAULT_MAP_LABELS;
  const visiblePoints = (usingReference ? REFERENCE_POINTS : points).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  // Os títulos livremente configurados pela Administração mantêm-se intactos.
  // Só se traduzem marcadores genéricos de arranque que não identificam um
  // equipamento real.
  const pointTitle = (point: InfrastructurePoint) => language === "en" ? point.title.replace(/^Ponto de infraestrutura (\d+)$/, "Infrastructure point $1") : point.title;
  const pointSubtitle = (point: InfrastructurePoint) => {
    if (!point.subtitle) return t("Infraestrutura");
    if (language !== "en") return point.subtitle;
    return point.subtitle === "A identificar" ? "To be identified" : point.subtitle === "Planeamento" ? "Planning" : point.subtitle;
  };
  const selectedSeries = useMemo(() => {
    if (!selected?.chartMetricCode) return [];
    return readings.filter((row: any) => row.metricCode === selected.chartMetricCode && row.dataQuality !== "invalid").slice(-24).map((row: any) => Number(row.value)).filter(Number.isFinite);
  }, [readings, selected]);
  const SelectedIcon = selected ? (SYSTEM_ICONS[selected.systemType] || MapPin) : MapPin;
  const selectedInvoices = useMemo(() => selected?.invoiceTypes?.length ? invoices.filter(invoice => selected.invoiceTypes?.includes(invoice.invoiceType)) : [], [invoices, selected]);
  const selectedInvoiceCost = useMemo(() => selectedInvoices.reduce((total, invoice) => total + (Number(invoice.totalCost) || 0), 0), [selectedInvoices]);
  useEffect(() => {
    setDroneImageUrl(`/api/operacao/media/nest-drone?projectId=${projectId}`);
  }, [projectId]);

  return <section className="stand-surface overflow-hidden">
    <div className="flex flex-col gap-4 border-b border-border bg-[#0A3638] px-5 py-5 text-white lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3"><span className="rounded-2xl bg-primary p-3 text-[#0A3638] shadow-lg"><MapPin className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{t("Gémeo digital do edifício")}</p><Badge variant="outline" className="border-white/30 bg-card/8 text-white"><span>{t("Infraestrutura do NEST")}</span><span aria-hidden="true"> · </span><span>{t("Fotografia operacional")}</span></Badge>{usingReference && <Badge variant="outline" className="border-white/30 bg-card/8 text-white">{t("Modelo de referência")}</Badge>}</div><p className="mt-1 max-w-2xl text-sm leading-6 text-white/74">{t("A fotografia aérea é a vista de engenharia. Clique num ponto para abrir a respetiva informação técnica, métricas, gráficos e documentação.")}</p></div></div>
      {canConfigure && <div className="flex flex-wrap gap-2"><Button variant="outline" className="border-white/30 bg-card/8 text-white hover:bg-card/16 hover:text-white" onClick={onOpenSettings}><Settings2 className="mr-2 size-4" />{t("Definir infraestrutura")}</Button></div>}
    </div>
    <div style={{ aspectRatio: "3 / 1", minHeight: 0 }} className="relative overflow-hidden bg-[#0A3638]">
        <img src={droneImageUrl} alt={t("Vista aérea de drone do NEST e infraestruturas envolventes")} className="absolute inset-0 size-full object-cover object-center opacity-95" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A3638]/68 via-transparent to-[#0A3638]/16" />
        <div style={{ clipPath: futureAreaClip([...resolvedFutureArea]) }} className="absolute inset-0 border border-white/65 bg-[#0A3638]/42 shadow-[inset_0_0_60px_rgba(10,54,56,0.36)]">
          <div className="absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0.2)_0_1px,transparent_1px_11px)]" />
        </div>
        <span style={{ left: `${resolvedLabels.futureArea.xPercent}%`, top: `${resolvedLabels.futureArea.yPercent}%` }} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/50 bg-[#0A3638]/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg">{t("Edifícios futuros · planeamento")}</span>
        {visiblePoints.filter(point => !point.isFuture).map(point => {
          const Icon = SYSTEM_ICONS[point.systemType] || MapPin;
          return <button key={point.id} type="button" aria-label={`${t("Abrir informação de")} ${pointTitle(point)}`} onClick={() => setSelected(point)} style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }} className="group absolute z-20 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-yellow-50 bg-yellow-300 text-foreground shadow-[0_0_0_5px_rgba(255,255,255,0.24)] transition hover:scale-110 hover:bg-yellow-200 focus:outline-none focus:ring-4 focus:ring-yellow-200"><Icon className="size-3.5" /><span className="pointer-events-none absolute left-1/2 top-full mt-2 w-max max-w-48 -translate-x-1/2 rounded-md bg-[#0A3638]/90 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus:opacity-100">{pointTitle(point)}</span></button>;
        })}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2"><span className="rounded-full border border-white/25 bg-[#0A3638]/82 px-3 py-1.5 text-xs text-white backdrop-blur">{visiblePoints.filter(point => !point.isFuture).length} {t("Marcadores a configurar")}</span><span className="rounded-full border border-white/25 bg-[#0A3638]/82 px-3 py-1.5 text-xs text-white backdrop-blur">{t("Edifícios futuros · planeamento")}</span></div>
        <div style={{ left: `${resolvedLabels.guidance.xPercent}%`, top: `${resolvedLabels.guidance.yPercent}%` }} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/30 bg-[#0A3638]/82 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">{t("Clique num marcador para abrir o respetivo contexto técnico.")}</div>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>{selected && <DialogContent className={`max-h-[90vh] ${CARD_LAYOUT_CLASSES[selected.cardLayout || "standard"]} overflow-y-auto p-0`}><div className="bg-[#0A3638] p-6 text-white"><div className="flex items-start gap-3"><span className={`rounded-2xl p-3 ${selected.isFuture ? "bg-[#F4F4FF]/25 text-[#0A3638]" : "bg-primary/15 text-primary"}`}><SelectedIcon className="size-5" /></span><div className="min-w-0"><DialogHeader><DialogTitle className="text-xl text-white">{pointTitle(selected)}</DialogTitle><DialogDescription className="text-slate-300">{pointSubtitle(selected)}</DialogDescription></DialogHeader></div></div><div className="mt-4 flex flex-wrap gap-2"><Badge className={selected.isFuture ? "border-[#0A3638]/30 bg-[#F4F4FF]/15 text-[#0A3638]" : CARD_ACCENT_CLASSES[selected.cardAccent || "teal"]}>{STATUS_LABELS[selected.status] || selected.status}</Badge>{usingReference && <Badge className="border-[#6D7A70]/30 bg-[#EDEBEB]/10 text-[#646461]">{t("Ponto a validar")}</Badge>}</div></div>{(selected.cardImageKey || selected.cardImageUrl) && <img src={selected.cardImageKey ? `/api/operacao/media/infrastructure-card?projectId=${projectId}&pointId=${selected.id}` : selected.cardImageUrl || ""} alt={`${t("Imagem técnica de")} ${pointTitle(selected)}`} className="max-h-80 w-full object-cover" />}<div className="space-y-5 p-6"><p className="text-sm leading-6 text-foreground">{selected.description || t("Sem descrição configurada.")}</p><div className="grid gap-3 sm:grid-cols-2">{selected.metricCodes.length ? selected.metricCodes.map(code => { const metric = metricValue(latest, code); return <Card key={code} className="border-border"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{METRIC_LABELS[code] || code}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{metric ? displayNumber(metric.value) : "—"}<span className="ml-1 text-xs font-medium text-muted-foreground">{metric?.unit || ""}</span></p><p className="mt-1 text-xs text-muted-foreground">{metric ? t("Última leitura válida") : t("Sem dado no período")}</p></CardContent></Card>; }) : <Card className="border-[#0A3638] bg-[#F4F4FF] sm:col-span-2"><CardContent className="p-4 text-sm text-[#0A3638]">{t("Este ponto não tem métricas operacionais associadas. Configure-as apenas quando existir informação aprovada.")}</CardContent></Card>}</div>{selected.technicalData?.length ? <Card className="border-border"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Dados técnicos configurados")}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{selected.technicalData.map((item, index) => <div key={`${item.label}-${index}`} className="rounded-xl bg-muted/40 p-3"><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-1 font-semibold text-foreground">{item.value}<span className="ml-1 text-xs font-medium text-muted-foreground">{item.unit}</span></p></div>)}</div></CardContent></Card> : null}{selected.chartData?.rows?.length && selected.chartData.series.length ? <Card className="border-border"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">{t("Gráfico associado")}</p><p className="text-xs text-muted-foreground">{selected.chartFileName ? `${t("Fonte:")} ${selected.chartFileName}` : t("Fonte Excel configurada")}</p></div><Activity className="size-5 text-primary" /></div><div className="mt-4 h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={selected.chartData.rows}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend />{selected.chartData.series.map((series, index) => <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={["#0A3638", "#0A3638", "#0A3638"][index]} strokeWidth={2.5} dot={false} />)}</LineChart></ResponsiveContainer></div></CardContent></Card> : null}{selected.chartMetricCode && <Card className="border-border"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-foreground">{t("Tendência da métrica associada")}</p><p className="text-xs text-muted-foreground">{METRIC_LABELS[selected.chartMetricCode] || selected.chartMetricCode} · {t("últimos valores válidos")}</p></div><Activity className="size-5 text-primary" /></div><div className="mt-3"><MiniTrend points={selectedSeries} /></div></CardContent></Card>}{selected.invoiceTypes?.length ? <Card className="border-[#6D7A70] bg-[#EDEBEB]"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#646461]">{t("Ligação a faturas")}</p><p className="mt-1 text-sm font-semibold text-[#646461]">{selectedInvoices.length} {t("fatura(s) ligada(s)")} · {displayNumber(selectedInvoiceCost)} EUR</p><p className="mt-1 text-xs text-[#646461]">{selected.invoiceTypes.map(type => INVOICE_LABELS[type] || type).join(" · ")} · {t("valores provenientes do centro de reconciliação.")}</p></CardContent></Card> : null}{selected.technicalNote && <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Nota técnica")}</p><p className="mt-2 text-sm leading-6 text-foreground">{selected.technicalNote}</p></div>}{selected.documentUrl && <a href={selected.documentUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-primary bg-primary p-4 text-sm font-medium text-[#0A3638] transition hover:bg-primary"><span className="flex items-center gap-2"><FileText className="size-4" />{selected.documentTitle || t("Abrir documento associado")}</span><ArrowUpRight className="size-4" /></a>}</div></DialogContent>}</Dialog>
  </section>;
}
