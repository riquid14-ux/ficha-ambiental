import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowUpRight, Building2, Droplet, FileText, Gauge, MapPin, Server, Settings2, Sparkles, UserRound, Zap } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

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
const CARD_ACCENT_CLASSES: Record<string, string> = { teal: "border-teal-300/30 bg-teal-300/10 text-teal-100", blue: "border-sky-300/30 bg-sky-300/10 text-sky-100", violet: "border-violet-300/30 bg-violet-300/10 text-violet-100", amber: "border-amber-300/30 bg-amber-300/10 text-amber-100", slate: "border-slate-300/30 bg-slate-300/10 text-slate-100" };

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
  if (points.length < 2) return <p className="text-xs text-slate-500">Sem série suficiente no período.</p>;
  const min = Math.min(...points); const max = Math.max(...points); const range = max - min || 1;
  const path = points.map((value, index) => `${index ? "L" : "M"}${(index / (points.length - 1)) * 100},${100 - ((value - min) / range) * 82 - 9}`).join(" ");
  return <svg viewBox="0 0 100 100" className="h-20 w-full overflow-visible" role="img" aria-label="Tendência da métrica selecionada"><path d={path} fill="none" stroke="#14b8a6" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" /></svg>;
}

export function InfrastructureDashboard({ projectId, points, futureArea, mapLabels, latest, readings, invoices, canConfigure, onOpenSettings, onLayoutSaved }: { projectId: number; points: InfrastructurePoint[]; futureArea?: ReadonlyArray<MapCoordinate>; mapLabels?: MapLabels; latest: Record<string, any>; readings: any[]; invoices: any[]; canConfigure: boolean; onOpenSettings: () => void; onLayoutSaved: () => void }) {
  const [selected, setSelected] = useState<InfrastructurePoint | null>(null);
  const [droneImageUrl, setDroneImageUrl] = useState(() => `/api/operacao/media/nest-drone?projectId=${projectId}`);
  const [adjusting, setAdjusting] = useState(false);
  const [draftMarkers, setDraftMarkers] = useState<Array<{ id: number; xPercent: number; yPercent: number }>>([]);
  const [draftFutureArea, setDraftFutureArea] = useState<MapCoordinate[]>([]);
  const [draftLabels, setDraftLabels] = useState<MapLabels>(DEFAULT_MAP_LABELS);
  const [dragTarget, setDragTarget] = useState<{ kind: "marker"; id: number } | { kind: "future"; index: number } | { kind: "label"; label: keyof MapLabels } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const usingReference = points.length === 0;
  const resolvedFutureArea = futureArea?.length ? futureArea : DEFAULT_FUTURE_AREA;
  const resolvedLabels = mapLabels || DEFAULT_MAP_LABELS;
  const visiblePoints = (usingReference ? REFERENCE_POINTS : points).slice().sort((a, b) => a.sortOrder - b.sortOrder);
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

  const layoutMutation = trpc.operation.updateInfrastructureMapLayout.useMutation({
    onSuccess: () => { toast.success("Posições guardadas e auditadas."); setAdjusting(false); setDragTarget(null); onLayoutSaved(); },
    onError: error => toast.error(error.message),
  });
  useEffect(() => {
    if (adjusting) return;
    setDraftMarkers(points.filter(point => !point.isFuture && typeof point.id === "number").map(point => ({ id: Number(point.id), xPercent: point.xPercent, yPercent: point.yPercent })));
    setDraftFutureArea([...resolvedFutureArea]);
    setDraftLabels({ futureArea: { ...resolvedLabels.futureArea }, guidance: { ...resolvedLabels.guidance } });
  }, [adjusting, points, futureArea, mapLabels]);
  const beginAdjustment = () => {
    if (usingReference) { toast.error("Aplique primeiro a marcação de referência na Administração."); return; }
    setDraftMarkers(points.filter(point => !point.isFuture && typeof point.id === "number").map(point => ({ id: Number(point.id), xPercent: point.xPercent, yPercent: point.yPercent })));
    setDraftFutureArea([...resolvedFutureArea]);
    setDraftLabels({ futureArea: { ...resolvedLabels.futureArea }, guidance: { ...resolvedLabels.guidance } });
    setSelected(null); setAdjusting(true);
  };
  const pointerCoordinate = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { xPercent: clampPercent(((event.clientX - rect.left) / rect.width) * 100), yPercent: clampPercent(((event.clientY - rect.top) / rect.height) * 100) };
  };
  const updateDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragTarget) return;
    const coordinate = pointerCoordinate(event); if (!coordinate) return;
    if (dragTarget.kind === "marker") setDraftMarkers(current => current.map(marker => marker.id === dragTarget.id ? { ...marker, ...coordinate } : marker));
    else if (dragTarget.kind === "future") setDraftFutureArea(current => current.map((point, index) => index === dragTarget.index ? coordinate : point));
    else setDraftLabels(current => ({ ...current, [dragTarget.label]: coordinate }));
  };
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, target: NonNullable<typeof dragTarget>) => {
    if (!adjusting) return;
    event.preventDefault(); event.stopPropagation(); stageRef.current?.setPointerCapture(event.pointerId); setDragTarget(target);
  };
  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragTarget) return;
    if (stageRef.current?.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId);
    setDragTarget(null);
  };
  const saveAdjustment = () => layoutMutation.mutate({ projectId, markers: draftMarkers, futureArea: draftFutureArea, labels: draftLabels });

  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3"><span className="rounded-2xl bg-slate-950 p-3 text-white shadow-lg"><MapPin className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">Infraestrutura do NEST</p><Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">Dashboard estático</Badge>{usingReference && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Modelo de referência</Badge>}</div><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Clique num ponto para ligar o local à informação técnica, métricas, gráficos e documentação configurados pela Administração.</p></div></div>
      {canConfigure && <div className="flex flex-wrap gap-2">{adjusting ? <><Button variant="outline" className="border-slate-300" onClick={() => { setAdjusting(false); setDragTarget(null); }} disabled={layoutMutation.isPending}>Cancelar ajuste</Button><Button className="bg-teal-700 hover:bg-teal-800" onClick={saveAdjustment} disabled={layoutMutation.isPending || !draftMarkers.length}>{layoutMutation.isPending ? "A guardar..." : "Guardar posições"}</Button></> : <><Button variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" onClick={beginAdjustment}>Ajustar no mapa</Button><Button variant="outline" className="border-slate-300" onClick={onOpenSettings}><Settings2 className="mr-2 size-4" />Definir infraestrutura</Button></>}</div>}
    </div>
    <div ref={stageRef} onPointerMove={updateDragging} onPointerUp={finishDrag} onPointerCancel={finishDrag} style={{ aspectRatio: "3 / 1", minHeight: 0 }} className={`relative overflow-hidden bg-slate-950 ${adjusting ? "touch-none select-none" : ""}`}>
        <img src={droneImageUrl} alt="Vista aérea de drone do NEST e infraestruturas envolventes" className="absolute inset-0 size-full object-cover object-center opacity-95" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/10" />
        <div style={{ clipPath: futureAreaClip(adjusting ? draftFutureArea : [...resolvedFutureArea]) }} className="absolute inset-0 border border-fuchsia-950/80 bg-fuchsia-800/52 shadow-[inset_0_0_60px_rgba(112,26,117,0.3)]">
          <div className="absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0.2)_0_1px,transparent_1px_11px)]" />
        </div>
        {adjusting && draftFutureArea.map((point, index) => <button key={`future-handle-${index}`} type="button" aria-label={`Arrastar vértice ${index + 1} da área futura`} onPointerDown={event => startDrag(event, { kind: "future", index })} style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }} className="absolute z-30 size-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-fuchsia-500 shadow-[0_0_0_4px_rgba(255,255,255,0.38)] active:cursor-grabbing" />)}
        {adjusting ? <button type="button" aria-label="Arrastar etiqueta de edifícios futuros" onPointerDown={event => startDrag(event, { kind: "label", label: "futureArea" })} style={{ left: `${draftLabels.futureArea.xPercent}%`, top: `${draftLabels.futureArea.yPercent}%` }} className="absolute z-30 -translate-x-1/2 -translate-y-1/2 cursor-grab whitespace-nowrap rounded-full border border-fuchsia-100/80 bg-slate-950/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100 shadow-lg active:cursor-grabbing">Edifícios futuros · planeamento</button> : <span style={{ left: `${resolvedLabels.futureArea.xPercent}%`, top: `${resolvedLabels.futureArea.yPercent}%` }} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-fuchsia-100/80 bg-slate-950/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100 shadow-lg">Edifícios futuros · planeamento</span>}
        {visiblePoints.filter(point => !point.isFuture).map(point => {
          const Icon = SYSTEM_ICONS[point.systemType] || MapPin;
          const draft = draftMarkers.find(marker => marker.id === Number(point.id));
          return <button key={point.id} type="button" aria-label={adjusting ? `Arrastar ${point.title}` : `Abrir informação de ${point.title}`} onClick={() => !adjusting && setSelected(point)} onPointerDown={event => adjusting && typeof point.id === "number" ? startDrag(event, { kind: "marker", id: point.id }) : undefined} style={{ left: `${draft?.xPercent ?? point.xPercent}%`, top: `${draft?.yPercent ?? point.yPercent}%` }} className={`group absolute z-20 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-yellow-50 bg-yellow-300 text-slate-950 shadow-[0_0_0_5px_rgba(255,255,255,0.24)] transition hover:scale-110 hover:bg-yellow-200 focus:outline-none focus:ring-4 focus:ring-yellow-200 ${adjusting ? "cursor-grab active:cursor-grabbing" : ""}`}><Icon className="size-3.5" /><span className="pointer-events-none absolute left-1/2 top-full mt-2 w-max max-w-48 -translate-x-1/2 rounded-md bg-slate-950/90 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus:opacity-100">{point.title}</span></button>;
        })}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2"><span className="rounded-full bg-slate-950/80 px-3 py-1.5 text-xs text-white backdrop-blur">{visiblePoints.filter(point => !point.isFuture).length} marcadores a configurar</span><span className="rounded-full bg-violet-900/80 px-3 py-1.5 text-xs text-violet-100 backdrop-blur">Edifícios futuros · planeamento</span></div>
        {adjusting ? <button type="button" aria-label="Arrastar instrução do mapa" onPointerDown={event => startDrag(event, { kind: "label", label: "guidance" })} style={{ left: `${draftLabels.guidance.xPercent}%`, top: `${draftLabels.guidance.yPercent}%` }} className="absolute z-30 -translate-x-1/2 -translate-y-1/2 cursor-grab whitespace-nowrap rounded-full border border-white/30 bg-slate-950/78 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur active:cursor-grabbing">Clique num marcador para abrir o respetivo contexto técnico.</button> : <div style={{ left: `${resolvedLabels.guidance.xPercent}%`, top: `${resolvedLabels.guidance.yPercent}%` }} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/30 bg-slate-950/78 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">Clique num marcador para abrir o respetivo contexto técnico.</div>}
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>{selected && <DialogContent className={`max-h-[90vh] ${CARD_LAYOUT_CLASSES[selected.cardLayout || "standard"]} overflow-y-auto p-0`}><div className="bg-slate-950 p-6 text-white"><div className="flex items-start gap-3"><span className={`rounded-2xl p-3 ${selected.isFuture ? "bg-violet-500/25 text-violet-100" : "bg-teal-400/15 text-teal-100"}`}><SelectedIcon className="size-5" /></span><div className="min-w-0"><DialogHeader><DialogTitle className="text-xl text-white">{selected.title}</DialogTitle><DialogDescription className="text-slate-300">{selected.subtitle || TYPE_LABELS[selected.systemType] || "Infraestrutura"}</DialogDescription></DialogHeader></div></div><div className="mt-4 flex flex-wrap gap-2"><Badge className={selected.isFuture ? "border-violet-300/30 bg-violet-400/15 text-violet-100" : CARD_ACCENT_CLASSES[selected.cardAccent || "teal"]}>{STATUS_LABELS[selected.status] || selected.status}</Badge>{usingReference && <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100">Ponto a validar</Badge>}</div></div>{(selected.cardImageKey || selected.cardImageUrl) && <img src={selected.cardImageKey ? `/api/operacao/media/infrastructure-card?projectId=${projectId}&pointId=${selected.id}` : selected.cardImageUrl || ""} alt={`Imagem técnica de ${selected.title}`} className="max-h-80 w-full object-cover" />}<div className="space-y-5 p-6"><p className="text-sm leading-6 text-slate-700">{selected.description || "Sem descrição configurada."}</p><div className="grid gap-3 sm:grid-cols-2">{selected.metricCodes.length ? selected.metricCodes.map(code => { const metric = metricValue(latest, code); return <Card key={code} className="border-slate-200"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{METRIC_LABELS[code] || code}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{metric ? displayNumber(metric.value) : "—"}<span className="ml-1 text-xs font-medium text-slate-500">{metric?.unit || ""}</span></p><p className="mt-1 text-xs text-slate-500">{metric ? "Última leitura válida" : "Sem dado no período"}</p></CardContent></Card>; }) : <Card className="border-violet-200 bg-violet-50 sm:col-span-2"><CardContent className="p-4 text-sm text-violet-900">Este ponto não tem métricas operacionais associadas. Configure-as apenas quando existir informação aprovada.</CardContent></Card>}</div>{selected.technicalData?.length ? <Card className="border-slate-200"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dados técnicos configurados</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{selected.technicalData.map((item, index) => <div key={`${item.label}-${index}`} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-1 font-semibold text-slate-900">{item.value}<span className="ml-1 text-xs font-medium text-slate-500">{item.unit}</span></p></div>)}</div></CardContent></Card> : null}{selected.chartData?.rows?.length && selected.chartData.series.length ? <Card className="border-slate-200"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">Gráfico associado</p><p className="text-xs text-slate-500">{selected.chartFileName ? `Fonte: ${selected.chartFileName}` : "Fonte Excel configurada"}</p></div><Activity className="size-5 text-teal-600" /></div><div className="mt-4 h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={selected.chartData.rows}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend />{selected.chartData.series.map((series, index) => <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={["#0f766e", "#7c3aed", "#0284c7"][index]} strokeWidth={2.5} dot={false} />)}</LineChart></ResponsiveContainer></div></CardContent></Card> : null}{selected.chartMetricCode && <Card className="border-slate-200"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-900">Tendência da métrica associada</p><p className="text-xs text-slate-500">{METRIC_LABELS[selected.chartMetricCode] || selected.chartMetricCode} · últimos valores válidos</p></div><Activity className="size-5 text-teal-600" /></div><div className="mt-3"><MiniTrend points={selectedSeries} /></div></CardContent></Card>}{selected.invoiceTypes?.length ? <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Ligação a faturas</p><p className="mt-1 text-sm font-semibold text-amber-950">{selectedInvoices.length} fatura(s) ligada(s) · {displayNumber(selectedInvoiceCost)} EUR</p><p className="mt-1 text-xs text-amber-900">{selected.invoiceTypes.map(type => INVOICE_LABELS[type] || type).join(" · ")} · valores provenientes do centro de reconciliação.</p></CardContent></Card> : null}{selected.technicalNote && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nota técnica</p><p className="mt-2 text-sm leading-6 text-slate-700">{selected.technicalNote}</p></div>}{selected.documentUrl && <a href={selected.documentUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-800 transition hover:bg-teal-100"><span className="flex items-center gap-2"><FileText className="size-4" />{selected.documentTitle || "Abrir documento associado"}</span><ArrowUpRight className="size-4" /></a>}</div></DialogContent>}</Dialog>
  </section>;
}
