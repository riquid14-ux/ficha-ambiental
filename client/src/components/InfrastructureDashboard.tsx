import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, ArrowUpRight, Building2, FileText, Gauge, MapPin, Settings2, Sparkles, Waves, Zap } from "lucide-react";
import React, { useMemo, useState } from "react";

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
  isFuture: boolean;
  sortOrder: number;
};

const DRONE_IMAGE_URL = "/manus-storage/nest-infraestrutura-drone_cd01f7fb.webp";
const REFERENCE_POINTS: InfrastructurePoint[] = [
  { id: "reference-intake", title: "Captação de água do mar", subtitle: "Ponto de captação", systemType: "agua_mar", status: "a_validar", xPercent: 27, yPercent: 31, description: "Ponto de referência para a infraestrutura de captação. Ajuste a posição e a informação técnica nas Definições de Operação.", metricCodes: ["seawater_flow_lps", "seawater_intake_temp_c"], chartMetricCode: "seawater_flow_lps", technicalNote: "Modelo visual inicial baseado no conceito fornecido.", isFuture: false, sortOrder: 10 },
  { id: "reference-circuit", title: "Circuito de água do mar", subtitle: "Arrefecimento", systemType: "arrefecimento", status: "a_validar", xPercent: 34, yPercent: 39, description: "Circuito térmico de referência para captação, ΔT e retorno.", metricCodes: ["seawater_delta_t_k", "seawater_return_temp_c"], chartMetricCode: "seawater_delta_t_k", technicalNote: "Associe os códigos BMS aprovados na Administração.", isFuture: false, sortOrder: 20 },
  { id: "reference-grid", title: "Subestação e rede", subtitle: "Energia", systemType: "energia", status: "a_validar", xPercent: 59, yPercent: 65, description: "Entrada de energia e infraestrutura elétrica de suporte.", metricCodes: ["site_power_kw", "site_energy_kwh_daily"], chartMetricCode: "site_power_kw", technicalNote: "Ponto de enquadramento configurável.", isFuture: false, sortOrder: 30 },
  { id: "reference-it", title: "Hall TI", subtitle: "Carga computacional", systemType: "hall_ti", status: "a_validar", xPercent: 69, yPercent: 58, description: "Zona de carga TI, eficiência e disponibilidade operacional.", metricCodes: ["it_power_kw", "it_energy_kwh_daily", "pue"], chartMetricCode: "pue", technicalNote: "Use métricas medidas para acompanhar a carga e a eficiência.", isFuture: false, sortOrder: 40 },
  { id: "reference-nest", title: "Edifício NEST", subtitle: "Operação integrada", systemType: "infraestrutura", status: "operacional", xPercent: 76, yPercent: 53, description: "Síntese operacional de energia, água, eficiência e custo do edifício.", metricCodes: ["pue", "wue", "cooling_cop"], chartMetricCode: "pue", technicalNote: "Os cartões podem ser ajustados pelo Administrador.", isFuture: false, sortOrder: 50 },
  { id: "reference-future", title: "Expansão futura", subtitle: "Planeamento", systemType: "futuro", status: "planeamento", xPercent: 43, yPercent: 76, description: "Área de planeamento futuro. Não representa um alerta ou não conformidade.", metricCodes: [], chartMetricCode: null, technicalNote: "Defina o âmbito quando existir informação aprovada.", isFuture: true, sortOrder: 60 },
];

const TYPE_LABELS: Record<string, string> = { energia: "Energia", hall_ti: "Hall TI", arrefecimento: "Arrefecimento", agua_mar: "Água do mar", infraestrutura: "Infraestrutura", futuro: "Planeamento" };
const STATUS_LABELS: Record<string, string> = { operacional: "Operacional", planeamento: "Planeamento futuro", manutencao: "Manutenção", a_validar: "A validar" };
const METRIC_LABELS: Record<string, string> = { pue: "PUE", wue: "WUE", wue_calculated_daily: "WUE", cooling_cop: "COP", seawater_flow_lps: "Caudal", seawater_intake_temp_c: "Captação", seawater_return_temp_c: "Descarga", seawater_delta_t_k: "ΔT", site_power_kw: "Potência do site", site_energy_kwh_daily: "Energia do site", it_power_kw: "Carga TI", it_energy_kwh_daily: "Energia TI" };
const SYSTEM_ICONS: Record<string, typeof Zap> = { energia: Zap, hall_ti: Building2, arrefecimento: Activity, agua_mar: Waves, infraestrutura: Gauge, futuro: Sparkles };

function metricValue(latest: Record<string, any>, code: string) {
  const item = latest?.[code];
  if (!item || item.dataQuality === "invalid" || !Number.isFinite(Number(item.value))) return null;
  return { value: Number(item.value), unit: item.unit || "" };
}

function displayNumber(value: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(value);
}

function MiniTrend({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="text-xs text-slate-500">Sem série suficiente no período.</p>;
  const min = Math.min(...points); const max = Math.max(...points); const range = max - min || 1;
  const path = points.map((value, index) => `${index ? "L" : "M"}${(index / (points.length - 1)) * 100},${100 - ((value - min) / range) * 82 - 9}`).join(" ");
  return <svg viewBox="0 0 100 100" className="h-20 w-full overflow-visible" role="img" aria-label="Tendência da métrica selecionada"><path d={path} fill="none" stroke="#14b8a6" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" /></svg>;
}

export function InfrastructureDashboard({ points, latest, readings, canConfigure, onOpenSettings }: { points: InfrastructurePoint[]; latest: Record<string, any>; readings: any[]; canConfigure: boolean; onOpenSettings: () => void }) {
  const [selected, setSelected] = useState<InfrastructurePoint | null>(null);
  const usingReference = points.length === 0;
  const visiblePoints = (usingReference ? REFERENCE_POINTS : points).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedSeries = useMemo(() => {
    if (!selected?.chartMetricCode) return [];
    return readings.filter((row: any) => row.metricCode === selected.chartMetricCode && row.dataQuality !== "invalid").slice(-24).map((row: any) => Number(row.value)).filter(Number.isFinite);
  }, [readings, selected]);
  const SelectedIcon = selected ? (SYSTEM_ICONS[selected.systemType] || MapPin) : MapPin;

  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3"><span className="rounded-2xl bg-slate-950 p-3 text-white shadow-lg"><MapPin className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">Infraestrutura do NEST</p><Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">Dashboard estático</Badge>{usingReference && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Modelo de referência</Badge>}</div><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Clique num ponto para ligar o local à informação técnica, métricas, gráficos e documentação configurados pela Administração.</p></div></div>
      {canConfigure && <Button variant="outline" className="border-slate-300" onClick={onOpenSettings}><Settings2 className="mr-2 size-4" />Definir infraestrutura</Button>}
    </div>
    <div className="grid lg:grid-cols-[1.6fr_0.7fr]">
      <div className="relative min-h-[420px] overflow-hidden bg-slate-950">
        <img src={DRONE_IMAGE_URL} alt="Vista aérea de drone do NEST e infraestruturas envolventes" className="absolute inset-0 size-full object-cover opacity-95" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/10" />
        <div className="absolute bottom-[7%] left-[7%] h-[28%] w-[36%] rounded-[28%_42%_20%_25%] border border-dashed border-violet-200/90 bg-violet-500/20 backdrop-blur-[1px]">
          <span className="absolute -top-7 left-3 rounded-full border border-violet-200/70 bg-slate-950/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-violet-100">Planeamento futuro</span>
        </div>
        {visiblePoints.map(point => {
          const Icon = SYSTEM_ICONS[point.systemType] || MapPin;
          const future = point.isFuture || point.status === "planeamento";
          return <button key={point.id} type="button" aria-label={`Abrir informação de ${point.title}`} onClick={() => setSelected(point)} style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }} className={`group absolute z-10 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 shadow-[0_0_0_6px_rgba(255,255,255,0.24)] transition hover:scale-110 focus:outline-none focus:ring-4 ${future ? "border-violet-100 bg-violet-600 text-white focus:ring-violet-200" : "border-emerald-100 bg-emerald-600 text-white focus:ring-emerald-200"}`}><Icon className="size-4" /><span className="pointer-events-none absolute left-1/2 top-full mt-2 w-max max-w-40 -translate-x-1/2 rounded-md bg-slate-950/90 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus:opacity-100">{point.title}</span></button>;
        })}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2"><span className="rounded-full bg-slate-950/80 px-3 py-1.5 text-xs text-white backdrop-blur">{visiblePoints.filter(point => !point.isFuture).length} pontos de infraestrutura</span><span className="rounded-full bg-violet-900/80 px-3 py-1.5 text-xs text-violet-100 backdrop-blur">Área de futuro · planeamento</span></div>
      </div>
      <aside className="border-t border-slate-100 bg-slate-50/70 p-5 lg:border-l lg:border-t-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Leitura da infraestrutura</p><h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Do local à decisão.</h3><p className="mt-3 text-sm leading-6 text-slate-600">Cada ponto funciona como uma porta de contexto: associa a geografia visual à telemetria, aos documentos e aos indicadores usados pelo cockpit.</p><div className="mt-6 space-y-3">{visiblePoints.map(point => <button key={point.id} type="button" onClick={() => setSelected(point)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-teal-300 hover:shadow-sm"><span className={`grid size-9 place-items-center rounded-xl ${point.isFuture ? "bg-violet-100 text-violet-700" : "bg-teal-50 text-teal-700"}`}>{React.createElement(SYSTEM_ICONS[point.systemType] || MapPin, { className: "size-4" })}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{point.title}</span><span className="block truncate text-xs text-slate-500">{point.subtitle || TYPE_LABELS[point.systemType] || "Infraestrutura"}</span></span><ArrowUpRight className="size-4 text-slate-400" /></button>)}</div></aside>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>{selected && <DialogContent className="max-w-2xl overflow-hidden p-0"><div className="bg-slate-950 p-6 text-white"><div className="flex items-start gap-3"><span className={`rounded-2xl p-3 ${selected.isFuture ? "bg-violet-500/25 text-violet-100" : "bg-teal-400/15 text-teal-100"}`}><SelectedIcon className="size-5" /></span><div className="min-w-0"><DialogHeader><DialogTitle className="text-xl text-white">{selected.title}</DialogTitle><DialogDescription className="text-slate-300">{selected.subtitle || TYPE_LABELS[selected.systemType] || "Infraestrutura"}</DialogDescription></DialogHeader></div></div><div className="mt-4 flex flex-wrap gap-2"><Badge className={selected.isFuture ? "border-violet-300/30 bg-violet-400/15 text-violet-100" : "border-teal-300/30 bg-teal-300/10 text-teal-100"}>{STATUS_LABELS[selected.status] || selected.status}</Badge>{usingReference && <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100">Ponto a validar</Badge>}</div></div><div className="space-y-5 p-6"><p className="text-sm leading-6 text-slate-700">{selected.description || "Sem descrição configurada."}</p><div className="grid gap-3 sm:grid-cols-2">{selected.metricCodes.length ? selected.metricCodes.map(code => { const metric = metricValue(latest, code); return <Card key={code} className="border-slate-200"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{METRIC_LABELS[code] || code}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{metric ? displayNumber(metric.value) : "—"}<span className="ml-1 text-xs font-medium text-slate-500">{metric?.unit || ""}</span></p><p className="mt-1 text-xs text-slate-500">{metric ? "Última leitura válida" : "Sem dado no período"}</p></CardContent></Card>; }) : <Card className="border-violet-200 bg-violet-50 sm:col-span-2"><CardContent className="p-4 text-sm text-violet-900">Este ponto é reservado para planeamento futuro. Configure o âmbito, dados e documentação quando existir informação aprovada.</CardContent></Card>}</div>{selected.chartMetricCode && <Card className="border-slate-200"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-900">Tendência da métrica associada</p><p className="text-xs text-slate-500">{METRIC_LABELS[selected.chartMetricCode] || selected.chartMetricCode} · últimos valores válidos</p></div><Activity className="size-5 text-teal-600" /></div><div className="mt-3"><MiniTrend points={selectedSeries} /></div></CardContent></Card>}{selected.technicalNote && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nota técnica</p><p className="mt-2 text-sm leading-6 text-slate-700">{selected.technicalNote}</p></div>}{selected.documentUrl && <a href={selected.documentUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-800 transition hover:bg-teal-100"><span className="flex items-center gap-2"><FileText className="size-4" />{selected.documentTitle || "Abrir documento associado"}</span><ArrowUpRight className="size-4" /></a>}</div></DialogContent>}</Dialog>
  </section>;
}
