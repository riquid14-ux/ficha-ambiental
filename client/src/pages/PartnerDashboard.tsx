import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useBrandImage } from "@/hooks/useBrandImage";
import { StandPageHeader } from "@/components/stand/StandPageHeader";
import { DATA_SERIES_COLOR, DATA_SERIES_PALETTE } from "@shared/chart-palette";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Droplets, Recycle, Users, XCircle, Zap } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const currentWeek = Math.max(1, Math.min(53, Math.ceil((((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000) + new Date(new Date().getFullYear(), 0, 1).getDay() + 1) / 7)));
const chartColors = DATA_SERIES_PALETTE;
const numberValue = (value: unknown) => { const parsed = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : null; };
const formatNumber = (value: number) => value.toLocaleString("pt-PT", { maximumFractionDigits: 2 });

type PartnerEntity = { id: number; name: string; shortName: string; entityType: "ee" | "eep"; allowKpi: number | boolean; allowWaste: number | boolean };
type MatrixRow = { companyId: number; weekNumber: number };
type KpiMetricRow = { id: number; name: string; unit: string; target: string | null; category: string; sortOrder: number };
type KpiValueRow = { metricId: number; value: string | null; companyId: number; shortName: string; weekNumber: number; weekYear: number };
type WasteRow = { correctedQuantity: string | null; quantity: string; destination: string | null; subProjectCode: string | null; subProjectName: string | null };

function KpiChartCard({ id, title, subtitle, children, className = "", height = "h-80" }: { id: string; title: string; subtitle?: string; children: ReactNode; className?: string; height?: string }) {
  return <Card data-kpi-visual={id} className={`stand-chart overflow-hidden border-border/80 bg-card shadow-sm ${className}`}><CardHeader className="border-b border-border/60 bg-muted/20 pb-3"><CardTitle className="text-base">{title}</CardTitle>{subtitle && <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>}</CardHeader><CardContent className={`${height} px-4 pb-4 pt-5 sm:px-5`}><ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer></CardContent></Card>;
}

function KpiStatCard({ id, title, value, subtitle, icon, accent = DATA_SERIES_COLOR.brand }: { id: string; title: string; value: string; subtitle: string; icon: ReactNode; accent?: string }) {
  return <Card data-kpi-visual={id} className="border-border bg-card"><CardContent className="flex h-full min-h-56 flex-col items-center justify-center p-5 text-center"><div className="mb-3" style={{ color: accent }}>{icon}</div><p className="text-2xl font-semibold" style={{ color: accent }}>{value}</p><p className="mt-1 text-sm font-medium text-foreground">{title}</p><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></CardContent></Card>;
}

function EmptyAwareTooltip(props: any) {
  return <Tooltip {...props} contentStyle={{ fontSize: 12, borderRadius: 8, background: "var(--popover)", border: "1px solid var(--border)", color: "var(--popover-foreground)" }} />;
}

export default function PartnerDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { activeProject } = useProject();
  const [year, setYear] = useState(new Date().getFullYear());
  const [startWeek, setStartWeek] = useState(Math.max(1, currentWeek - 11));
  const [endWeek, setEndWeek] = useState(currentWeek);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [comparisonMetricId, setComparisonMetricId] = useState<string>("");
  const projectId = activeProject?.id ?? 0;
  const partnerImage = useBrandImage("kpi");
  const enabled = user?.role === "ee" && projectId > 0;
  const entities = trpc.partnerDashboard.entities.useQuery({ projectId }, { enabled });
  const matrix = trpc.partnerDashboard.kpiMatrix.useQuery({ projectId, year, startWeek, endWeek }, { enabled });
  const selectedCompanyId = companyFilter === "all" ? null : Number(companyFilter);
  const kpi = trpc.partnerDashboard.kpiSeries.useQuery({ projectId, year, companyId: selectedCompanyId }, { enabled });
  const waste = trpc.partnerDashboard.wasteMap.useQuery({ projectId, year, companyId: selectedCompanyId }, { enabled });
  const entityRows = (entities.data || []) as PartnerEntity[];
  const matrixRows = (matrix.data || []) as MatrixRow[];
  const kpiMetrics = (kpi.data?.metrics || []) as KpiMetricRow[];
  const kpiValues = (kpi.data?.values || []) as KpiValueRow[];
  const wasteRows = (waste.data || []) as WasteRow[];
  const weeks = useMemo(() => Array.from({ length: Math.max(0, endWeek - startWeek + 1) }, (_, index) => startWeek + index), [startWeek, endWeek]);
  const submitted = useMemo(() => new Set(matrixRows.map(item => `${item.companyId}-${item.weekNumber}`)), [matrixRows]);

  const metricTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const item of kpiValues) {
      const value = numberValue(item.value);
      if (value !== null) totals[item.metricId] = (totals[item.metricId] || 0) + value;
    }
    return totals;
  }, [kpiValues]);

  const chartData = useMemo(() => {
    const rows = new Map<number, Record<string, number | string>>();
    for (const item of kpiValues) {
      const value = numberValue(item.value);
      const metric = kpiMetrics.find(candidate => Number(candidate.id) === Number(item.metricId));
      if (value === null || !metric) continue;
      const row = rows.get(item.weekNumber) || { name: `S${item.weekNumber}`, week: item.weekNumber };
      row[metric.category] = Number(row[metric.category] || 0) + value;
      row[`m_${metric.id}`] = Number(row[`m_${metric.id}`] || 0) + value;
      rows.set(item.weekNumber, row);
    }
    return Array.from(rows.values()).sort((a, b) => Number(a.week) - Number(b.week));
  }, [kpiMetrics, kpiValues]);

  const comparisonMetric =
    kpiMetrics.find(metric => String(metric.id) === comparisonMetricId) ||
    kpiMetrics[0];
  const companySeries = useMemo(() => {
    if (!comparisonMetric) return [];
    const rows = new Map<number, Record<string, number | string>>();
    for (const value of kpiValues) {
      if (Number(value.metricId) !== Number(comparisonMetric.id)) continue;
      const numeric = numberValue(value.value);
      if (numeric === null) continue;
      const row = rows.get(value.weekNumber) || { name: `S${value.weekNumber}`, week: value.weekNumber };
      row[`company_${value.companyId}`] = numeric;
      rows.set(value.weekNumber, row);
    }
    return Array.from(rows.values()).sort((a, b) => Number(a.week) - Number(b.week));
  }, [comparisonMetric, kpiValues]);
  const companySeriesDefinitions = useMemo(() => {
    if (!comparisonMetric) return [];
    const names = new Map<number, string>();
    for (const value of kpiValues) {
      if (Number(value.metricId) === Number(comparisonMetric.id)) {
        names.set(value.companyId, value.shortName || `Entidade ${value.companyId}`);
      }
    }
    return Array.from(names.entries()).map(([id, name], index) => ({
      id,
      name,
      key: `company_${id}`,
      color: chartColors[index % chartColors.length],
    }));
  }, [comparisonMetric, kpiValues]);

  const cumulativeData = useMemo(() => {
    let co2 = 0; let water = 0;
    return chartData.map(row => {
      co2 += Number(row.emissions || 0);
      water += Number(row.water || 0);
      return { ...row, cumulativeCo2: co2, cumulativeWater: water };
    });
  }, [chartData]);

  const findMetric = (category: string, needle: string) => kpiMetrics.find(metric => metric.category === category && metric.name.toLocaleLowerCase("pt-PT").includes(needle.toLocaleLowerCase("pt-PT")));
  const categoryTotal = (category: string) => kpiMetrics.filter(metric => metric.category === category).reduce((sum, metric) => sum + (metricTotals[metric.id] || 0), 0);
  const categoryBreakdown = (category: string) => kpiMetrics.filter(metric => metric.category === category && (metricTotals[metric.id] || 0) !== 0).map(metric => ({ name: metric.name, value: metricTotals[metric.id] || 0 }));
  const electricityMetric = findMetric("energy", "electricidade");
  const workerMetric = findMetric("workforce", "trabalhadores em projeto") || findMetric("workforce", "trabalhadores");
  const hoursMetric = findMetric("workforce", "horas");
  const technicianMetric = findMetric("workforce", "técnicos");
  const incidentMetric = findMetric("incidents", "incidentes ambientais") || findMetric("incidents", "incidentes");
  const spillMetric = findMetric("incidents", "derrames");
  const emissionBreakdown = categoryBreakdown("emissions");
  const waterBreakdown = categoryBreakdown("water");
  const totalWorkers = workerMetric ? metricTotals[workerMetric.id] || 0 : categoryTotal("workforce");
  const totalTechnicians = technicianMetric ? metricTotals[technicianMetric.id] || 0 : 0;
  const totalIncidents = incidentMetric ? metricTotals[incidentMetric.id] || 0 : categoryTotal("incidents");
  const weeksWithData = chartData.filter(row => Object.entries(row).some(([key, value]) => key !== "week" && key !== "name" && Number(value) > 0)).length;

  const wasteSummary = useMemo(() => {
    const destinations: Record<string, number> = { recycled: 0, incinerated: 0, landfill: 0 };
    const subprojects = new Map<string, number>();
    for (const item of wasteRows) {
      const quantity = numberValue(item.correctedQuantity || item.quantity) || 0;
      destinations[item.destination || "recycled"] = (destinations[item.destination || "recycled"] || 0) + quantity;
      const key = item.subProjectCode || item.subProjectName || "Sem subprojecto";
      subprojects.set(key, (subprojects.get(key) || 0) + quantity);
    }
    return { destinations, subprojects: Array.from(subprojects.entries()).sort((a, b) => b[1] - a[1]), total: Object.values(destinations).reduce((a, b) => a + b, 0) };
  }, [wasteRows]);

  if (user?.role !== "ee") return <AppLayout><div className="p-8 text-center text-muted-foreground">{t("Dashboard exclusivo das Entidades Executantes.")}</div></AppLayout>;
  if (!activeProject) return <AppLayout><div className="p-8 text-center text-muted-foreground">{t("Seleccione um projecto.")}</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <StandPageHeader eyebrow="ECOSSISTEMA EE · EEP" title={t("Dashboard Parceiros")} description={t("Comparação de submissões, desempenho e resíduos entre a entidade executante e as suas parceiras autorizadas.")} context={activeProject.code} image={partnerImage.url} imagePosition={partnerImage.position} imageMode={partnerImage.mode} />

        <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5"><div><p className="stand-kicker text-primary">{t("ÂMBITO DE LEITURA")}</p><h2 className="mt-1 text-base font-semibold text-foreground">{t("Comparação autorizada por entidade")}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Use o filtro para analisar uma entidade ou comparar a EE com todas as EEP do projeto.")}</p></div><div className="flex flex-wrap gap-3"><div><Label>{t("Ano")}</Label><Input className="mt-1 w-24" type="number" value={year} onChange={event => setYear(Number(event.target.value))} /></div><div className="min-w-52"><Label>{t("Entidade")}</Label><Select value={companyFilter} onValueChange={setCompanyFilter}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("Todos — EE + EEP")}</SelectItem>{entityRows.map(entity => <SelectItem key={entity.id} value={String(entity.id)}>{entity.entityType === "ee" ? "EE" : "EEP"} · {entity.shortName}</SelectItem>)}</SelectContent></Select></div></div></section>

        <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />{t("Matriz de submissão KPI")}</CardTitle><div className="flex items-center gap-2 text-xs"><span>{t("Semanas")}</span><Input className="h-8 w-16" type="number" min={1} max={53} value={startWeek} onChange={event => setStartWeek(Math.max(1, Math.min(Number(event.target.value), endWeek)))} /><span>{t("a")}</span><Input className="h-8 w-16" type="number" min={1} max={53} value={endWeek} onChange={event => setEndWeek(Math.min(53, Math.max(Number(event.target.value), startWeek)))} /></div></div></CardHeader><CardContent className="overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr><th className="sticky left-0 bg-background p-2 text-left">{t("Entidade")}</th>{weeks.map(week => <th key={week} className="min-w-20 p-2 text-center">S{week}</th>)}</tr></thead><tbody>{entityRows.filter(entity => Boolean(entity.allowKpi)).map(entity => <tr key={entity.id} className="border-t"><td className="sticky left-0 bg-background p-2 font-medium">{entity.shortName}</td>{weeks.map(week => { const ok = submitted.has(`${entity.id}-${week}`); return <td key={week} className="p-2 text-center"><span title={ok ? t("Submetido") : t("Não submetido")} className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${ok ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}</span></td>; })}</tr>)}</tbody></table></CardContent></Card>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="stand-kicker text-primary">{t("LEITURA COMPARATIVA")}</p><h2 className="mt-1 flex items-center gap-2 text-lg font-semibold"><BarChart3 className="h-5 w-5" />{t("Desempenho por entidade e semana")}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Cada entidade tem uma série própria e uma legenda persistente; os valores exatos aparecem no tooltip.")}</p></div><Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{companySeriesDefinitions.length} {t("entidades comparáveis")} · {kpiValues.length} {t("valores")}</Badge></div>
          <div className="grid gap-4 xl:grid-cols-2">
            <KpiChartCard id="company-comparison" title={`${t("Evolução por entidade")} — ${comparisonMetric?.name || t("Métrica por selecionar")}`} subtitle={comparisonMetric ? `${comparisonMetric.unit} · ${t("uma linha por entidade com permissão")}` : t("Sem métricas disponíveis para comparação.")} className="xl:col-span-2" height="h-[27rem]"><LineChart data={companySeries} margin={{ top: 12, right: 22, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} tickMargin={10} /><YAxis tick={{ fontSize: 12 }} width={52} /><EmptyAwareTooltip /><Legend verticalAlign="top" height={44} wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />{companySeriesDefinitions.map(series => <Line key={series.key} type="monotone" dataKey={series.key} name={series.name} stroke={series.color} strokeWidth={3} dot={{ r: 3, strokeWidth: 2, fill: "var(--card)" }} activeDot={{ r: 6 }} connectNulls />)}</LineChart></KpiChartCard>
            <div className="xl:col-span-2 -mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-3"><span className="mr-1 text-xs font-semibold text-muted-foreground">{t("Métrica comparada")}</span><Select value={comparisonMetric ? String(comparisonMetric.id) : ""} onValueChange={setComparisonMetricId}><SelectTrigger className="h-9 min-w-64 bg-background text-sm"><SelectValue placeholder={t("Selecione uma métrica")} /></SelectTrigger><SelectContent>{kpiMetrics.map(metric => <SelectItem key={metric.id} value={String(metric.id)}>{metric.name} · {metric.unit}</SelectItem>)}</SelectContent></Select><span className="text-xs text-muted-foreground">{t("O filtro de entidade mantém o mesmo controlo de acesso da EE e das EEP.")}</span></div>
            <KpiChartCard id="fuel-consumption" title={t("Consumo de combustível")} subtitle={t("Evolução semanal consolidada.")}><BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 6 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><EmptyAwareTooltip /><Bar dataKey="fuel" name={t("Combustível")} fill={DATA_SERIES_COLOR.fuel} radius={[6, 6, 0, 0]} /></BarChart></KpiChartCard>
            <KpiChartCard id="electricity" title={t("Eletricidade")} subtitle={t("Consumo semanal consolidado.")}><AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 6 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><EmptyAwareTooltip /><Area type="monotone" dataKey={electricityMetric ? `m_${electricityMetric.id}` : "energy"} name={t("Eletricidade")} fill={DATA_SERIES_COLOR.electricity} stroke={DATA_SERIES_COLOR.electricity} strokeWidth={3} fillOpacity={0.25} /></AreaChart></KpiChartCard>
            <KpiChartCard id="emissions-breakdown" title={t("Repartição de emissões CO₂")} subtitle={t("Contributo por fonte no período.")}><PieChart><Pie data={emissionBreakdown} cx="50%" cy="47%" outerRadius={92} dataKey="value" nameKey="name" labelLine={false} label={({ name, percent }) => percent > 0.06 ? `${String(name).slice(0, 15)} ${(percent * 100).toFixed(0)}%` : ""}>{emissionBreakdown.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}</Pie><EmptyAwareTooltip /><Legend verticalAlign="bottom" height={42} wrapperStyle={{ fontSize: 12 }} /></PieChart></KpiChartCard>
            <KpiChartCard id="cumulative-co2" title={t("CO₂ acumulado")} subtitle={t("Soma de emissões calculadas no período.")}><AreaChart data={cumulativeData} margin={{ top: 10, right: 12, left: 0, bottom: 6 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><EmptyAwareTooltip /><Area type="monotone" dataKey="cumulativeCo2" name={t("CO₂ acumulado")} fill={DATA_SERIES_COLOR.carbon} stroke={DATA_SERIES_COLOR.carbon} strokeWidth={3} fillOpacity={0.2} /></AreaChart></KpiChartCard>

            <KpiChartCard id="water-consumption" title="Consumo de água"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><EmptyAwareTooltip /><Bar dataKey="water" name="Água" fill={DATA_SERIES_COLOR.water} /></BarChart></KpiChartCard>
            <KpiChartCard id="cumulative-water" title="Água acumulada"><AreaChart data={cumulativeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><EmptyAwareTooltip /><Area type="monotone" dataKey="cumulativeWater" name="Água acumulada" fill={DATA_SERIES_COLOR.water} stroke={DATA_SERIES_COLOR.water} fillOpacity={0.2} /></AreaChart></KpiChartCard>
            <KpiChartCard id="water-breakdown" title="Repartição por tipo de água"><PieChart><Pie data={waterBreakdown} cx="50%" cy="50%" outerRadius={72} dataKey="value" nameKey="name" label={({ name, percent }) => percent > 0.06 ? `${String(name).slice(0, 12)} ${(percent * 100).toFixed(0)}%` : ""}>{waterBreakdown.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}</Pie><EmptyAwareTooltip /></PieChart></KpiChartCard>
            <KpiStatCard id="total-water" title="Total de água consumida" value={`${formatNumber(categoryTotal("water"))} L`} subtitle="Consolidação do filtro seleccionado" icon={<Droplets className="h-9 w-9" />} accent={DATA_SERIES_COLOR.water} />

            <KpiChartCard id="workforce" title="Trabalhadores em projeto"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><EmptyAwareTooltip /><Line type="monotone" dataKey={workerMetric ? `m_${workerMetric.id}` : "workforce"} name="Trabalhadores" stroke={DATA_SERIES_COLOR.workforce} strokeWidth={2} dot={false} /></LineChart></KpiChartCard>
            <KpiChartCard id="workforce-hours" title="Trabalhadores vs. horas"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><EmptyAwareTooltip /><Legend /><Line type="monotone" dataKey={workerMetric ? `m_${workerMetric.id}` : "workforce"} name="Trabalhadores" stroke={DATA_SERIES_COLOR.workforce} dot={false} /><Line type="monotone" dataKey={hoursMetric ? `m_${hoursMetric.id}` : "hours"} name="Horas" stroke={DATA_SERIES_COLOR.brand} dot={false} /></LineChart></KpiChartCard>
            <KpiChartCard id="transport" title="Transporte"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><EmptyAwareTooltip /><Bar dataKey="transport" name="Transporte" fill={DATA_SERIES_COLOR.transport} /></BarChart></KpiChartCard>
            <KpiStatCard id="environmental-technicians" title="Técnicos de ambiente / trabalhadores" value={`${formatNumber(totalTechnicians)} / ${formatNumber(totalWorkers)}`} subtitle={`Rácio ${totalWorkers ? ((totalTechnicians / totalWorkers) * 100).toFixed(1) : "0,0"}%`} icon={<Users className="h-9 w-9" />} accent={DATA_SERIES_COLOR.workforce} />

            <KpiChartCard id="environmental-incidents" title="Incidentes ambientais"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><EmptyAwareTooltip /><Bar dataKey="incidents" name="Incidentes" fill={DATA_SERIES_COLOR.incident} /></BarChart></KpiChartCard>
            <KpiStatCard id="total-incidents" title="Total de incidentes" value={formatNumber(totalIncidents)} subtitle="No ano e entidade seleccionados" icon={<AlertTriangle className="h-9 w-9" />} accent={DATA_SERIES_COLOR.incident} />
            <KpiStatCard id="spills" title="Derrames" value={formatNumber(spillMetric ? metricTotals[spillMetric.id] || 0 : 0)} subtitle="Registos consolidados" icon={<Activity className="h-9 w-9" />} accent={DATA_SERIES_COLOR.fuel} />
            <KpiStatCard id="weeks-with-data" title="Semanas com dados" value={String(weeksWithData)} subtitle="Semanas com pelo menos um KPI registado" icon={<Zap className="h-9 w-9" />} />
          </div>
        </section>

        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Recycle className="h-4 w-4" />Waste Map</CardTitle><p className="text-sm text-muted-foreground">Distribuição consolidada por destino e subprojecto · {wasteSummary.total.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} t</p></CardHeader><CardContent className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><div className="space-y-3">{[["Reciclagem", wasteSummary.destinations.recycled, "bg-primary"], ["Incineração", wasteSummary.destinations.incinerated, "bg-[#EDEBEB]"], ["Aterro", wasteSummary.destinations.landfill, "bg-rose-500"]].map(([label, value, color]) => { const amount = Number(value); const percentage = wasteSummary.total ? (amount / wasteSummary.total) * 100 : 0; return <div key={String(label)}><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span>{amount.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} t · {percentage.toFixed(1)}%</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className={`h-full ${color}`} style={{ width: `${percentage}%` }} /></div></div>; })}</div><div className="space-y-2"><p className="text-sm font-medium">Por subprojecto</p>{wasteSummary.subprojects.map(([name, quantity]) => <div key={name} className="flex items-center justify-between rounded border px-3 py-2 text-sm"><span>{name}</span><strong>{quantity.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} t</strong></div>)}{wasteSummary.subprojects.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sem registos de Resíduos neste filtro.</p>}</div></CardContent></Card>
      </div>
    </AppLayout>
  );
}
