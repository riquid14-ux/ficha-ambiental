import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { useState, useMemo } from "react";
import { Settings, Download, Send, Droplets, Fuel, Zap, AlertTriangle, Plus, Pencil, Trash2, CheckCircle, XCircle, Target, BarChart3, Users, Car, Leaf, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { toast } from "sonner";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
const CAT_LABELS: Record<string, string> = { workforce: "Mão de Obra", transport: "Transporte", fuel: "Combustível", energy: "Energia", water: "Água", emissions: "Emissões", incidents: "Incidentes", other: "Outros" };
const CAT_ICONS: Record<string, string> = { workforce: "👷", transport: "🚗", fuel: "⛽", energy: "⚡", water: "💧", incidents: "⚠️", other: "📋" };

export default function KPI() {
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
  const [activeTab, setActiveTab] = useState("overview");
  const [showSettings, setShowSettings] = useState(false);
  const [formWeek, setFormWeek] = useState(String(getISOWeek(new Date())));
  const [formYear, setFormYear] = useState(String(new Date().getFullYear()));
  const [formValues, setFormValues] = useState<Record<number, string>>({});
  const [formStep, setFormStep] = useState(0);
  const [editingMetric, setEditingMetric] = useState<any>(null);
  const [dashFilter, setDashFilter] = useState<"week" | "month" | "semester" | "year" | "project">("month");
  const [dashPage, setDashPage] = useState(0);
  
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [editingTarget, setEditingTarget] = useState<any>(null);

  const projectId = activeProject?.id || 0;
  const metricsQuery = trpc.kpi.metrics.useQuery();
  const matrixQuery = trpc.kpi.matrix.useQuery({ projectId }, { enabled: projectId > 0 });
  const allValuesQuery = trpc.kpi.allValues.useQuery({ projectId }, { enabled: projectId > 0 });
  const targetsQuery = trpc.kpi.targets.useQuery({ projectId, year: targetYear }, { enabled: projectId > 0 });
  const companiesQuery = trpc.companies.list.useQuery();
  const submitMutation = trpc.kpi.submit.useMutation({ onSuccess: () => { toast.success("KPIs submetidos com sucesso!"); matrixQuery.refetch(); allValuesQuery.refetch(); setFormValues({}); setFormStep(0); } });
  const upsertMetricMutation = trpc.kpi.upsertMetric.useMutation({ onSuccess: () => { metricsQuery.refetch(); setEditingMetric(null); toast.success("Métrica guardada."); } });
  const deleteMetricMutation = trpc.kpi.deleteMetric.useMutation({ onSuccess: () => { metricsQuery.refetch(); toast.success("Métrica removida."); } });
  const incidentsQuery = trpc.kpi.listIncidents.useQuery({ projectId: activeProject?.id });
  const createIncidentMut = trpc.kpi.createIncident.useMutation({ onSuccess: () => incidentsQuery.refetch() });
  const deleteIncidentMut = trpc.kpi.deleteIncident.useMutation({ onSuccess: () => incidentsQuery.refetch() });
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ name: "", date: "", status: "aberto", severity: "baixo", link: "" });
  const upsertTargetMutation = trpc.kpi.upsertTarget.useMutation({ onSuccess: () => { targetsQuery.refetch(); setEditingTarget(null); toast.success("Meta guardada."); } });
  const deleteTargetMutation = trpc.kpi.deleteTarget.useMutation({ onSuccess: () => { targetsQuery.refetch(); toast.success("Meta removida."); } });

  const metrics = (metricsQuery.data || []) as any[];
  const manualMetrics = metrics.filter((m: any) => m.inputType === "manual");
  const calculatedMetrics = metrics.filter((m: any) => m.inputType === "calculated");
  const allValues = (allValuesQuery.data || []) as any[];
  const matrixData = (matrixQuery.data || []) as any[];
  const targets = (targetsQuery.data || []) as any[];
  const companies = (companiesQuery.data || []) as any[];
  const isAdminOrDO = user?.role === "admin" || user?.role === "dono_obra";

  // Categories for step-by-step form
  const categories = useMemo(() => {
    const cats: string[] = [];
    for (const m of manualMetrics) { if (!cats.includes(m.category)) cats.push(m.category); }
    return cats;
  }, [manualMetrics]);

  const weekPeriod = useMemo(() => {
    const w = Number(formWeek); const y = Number(formYear);
    const jan4 = new Date(y, 0, 4);
    const s1 = new Date(jan4); s1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    const start = new Date(s1); start.setDate(s1.getDate() + (w - 1) * 7);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("pt-PT")} a ${end.toLocaleDateString("pt-PT")}`;
  }, [formWeek, formYear]);

  const totals = useMemo(() => {
    const r: Record<number, number> = {};
    for (const v of allValues) { r[v.metricId] = (r[v.metricId] || 0) + (parseFloat(v.value) || 0); }
    for (const m of calculatedMetrics) {
      if (m.formulaType === "fuel_to_co2" && m.formulaSourceMetricId) r[m.id] = (r[m.formulaSourceMetricId] || 0) * (parseFloat(m.density) || 0) * (parseFloat(m.pci) || 0) * (parseFloat(m.emissionFactor) || 0) / 1000;
      else if (m.formulaType === "sum_co2") { let s = 0; for (const cm of calculatedMetrics) { if (cm.formulaType === "fuel_to_co2") s += (r[cm.id] || 0); } r[m.id] = s; }
    }
    return r;
  }, [allValues, calculatedMetrics]);

  const chartData = useMemo(() => {
    const byWeek = new Map<string, any>();
    for (const v of allValues) {
      const key = `S${v.weekNumber}`;
      if (!byWeek.has(key)) byWeek.set(key, { name: key, week: v.weekNumber, year: v.weekYear });
      const entry = byWeek.get(key)!;
      const metric = metrics.find((m: any) => m.id === v.metricId);
      if (metric) {
        entry[metric.category] = (entry[metric.category] || 0) + (parseFloat(v.value) || 0);
        entry[`m_${v.metricId}`] = (entry[`m_${v.metricId}`] || 0) + (parseFloat(v.value) || 0);
      }
    }
    return Array.from(byWeek.values()).sort((a: any, b: any) => (a.year - b.year) || (a.week - b.week));
  }, [allValues, metrics]);

  const matrixWeeks = useMemo(() => {
    const weeks = new Map<string, { weekNumber: number; weekYear: number }>();
    for (const s of matrixData) { const key = `${s.weekYear}-${s.weekNumber}`; if (!weeks.has(key)) weeks.set(key, { weekNumber: s.weekNumber, weekYear: s.weekYear }); }
    return Array.from(weeks.values()).sort((a, b) => a.weekYear - b.weekYear || a.weekNumber - b.weekNumber).slice(-12);
  }, [matrixData]);

  const matrixCompanies = useMemo(() => {
    const comps = new Map<number, string>();
    for (const s of matrixData) { if (!comps.has(s.companyId)) comps.set(s.companyId, s.shortName || s.companyName); }
    for (const c of companies) { if ((c.companyType === "ee" || c.companyType === "rap") && !comps.has(c.id)) comps.set(c.id, c.shortName); }
    return Array.from(comps.entries());
  }, [matrixData, companies]);

  const findMetric = (cat: string, name: string) => metrics.find((m: any) => m.category === cat && m.name.toLowerCase().includes(name.toLowerCase()));

  const handleSubmit = () => {
    if (!user?.companyId || !projectId) { toast.error("Verifique a sua empresa e projeto."); return; }
    const values = Object.entries(formValues).filter(([, v]) => v.trim() !== "").map(([metricId, value]) => ({ metricId: Number(metricId), value }));
    if (values.length === 0) { toast.error("Preencha pelo menos um campo."); return; }
    submitMutation.mutate({ projectId, companyId: user.companyId, weekNumber: Number(formWeek), weekYear: Number(formYear), values });
  };

  const handleExportExcel = () => {
    let csv = "Métrica,Unidade,Total\n";
    for (const m of metrics) { csv += `"${m.name}",${m.unit},${(totals[m.id] || 0).toFixed(2)}\n`; }
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `KPIs_${activeProject?.code}_${formYear}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (isAllProjects) return <AppLayout><div className="p-6 text-center text-muted-foreground">Selecione um projeto individual para ver os KPI's.</div></AppLayout>;

  // Current category for step form
  const currentCat = categories[formStep] || categories[0];
  const currentCatMetrics = manualMetrics.filter((m: any) => m.category === currentCat);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">KPI's</h1>
            <p className="text-sm text-muted-foreground">Indicadores de sustentabilidade — {activeProject?.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="w-4 h-4 mr-1" /> Exportar</Button>
            {user?.role === "admin" && <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}><Settings className="w-4 h-4 mr-1" /> Definições</Button>}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-l-4 border-l-red-500"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Incidentes Ambientais</p><p className="text-xl font-bold text-red-600">{totals[findMetric("incidents", "Incidentes Ambientais")?.id || 0] || 0}</p></CardContent></Card>
          <Card className="border-l-4 border-l-blue-500"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Água Construção</p><p className="text-xl font-bold text-blue-600">{formatNumber(totals[findMetric("water", "Água de Construção")?.id || 0] || 0)} L</p></CardContent></Card>
          <Card className="border-l-4 border-l-amber-500"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Combustível Total</p><p className="text-xl font-bold text-amber-600">{formatNumber(totals[findMetric("emissions", "Consumo Total")?.id || 0] || 0)} KgCO2e</p></CardContent></Card>
          <Card className="border-l-4 border-l-green-500"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">HVO</p><p className="text-xl font-bold text-green-600">{formatNumber(totals[findMetric("emissions", "HVO")?.id || 0] || 0)} KgCO2e</p></CardContent></Card>
          <Card className="border-l-4 border-l-purple-500"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Eletricidade</p><p className="text-xl font-bold text-purple-600">{formatNumber(totals[findMetric("energy", "Eletricidade")?.id || 0] || 0)} kWh</p></CardContent></Card>
        </div>

        {/* Settings */}
        {showSettings && user?.role === "admin" && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm"><Settings className="w-4 h-4 inline mr-1" />Definições</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-1 max-h-40 overflow-y-auto text-xs">
                {metrics.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2 p-1 rounded border bg-white">
                    <span className="flex-1 truncate">{m.name}</span><Badge variant="outline" className="text-[9px]">{m.unit}</Badge>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setEditingMetric(m)}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-500" onClick={() => { if (confirm("Remover?")) deleteMetricMutation.mutate({ id: m.id }); }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditingMetric({ name: "", unit: "", category: "other", inputType: "manual" })}><Plus className="w-3 h-3 mr-1" /> Nova Métrica</Button>
              {editingMetric && (
                <div className="p-3 border rounded bg-white space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Nome" value={editingMetric.name} onChange={e => setEditingMetric({ ...editingMetric, name: e.target.value })} className="text-sm" />
                    <Input placeholder="Unidade" value={editingMetric.unit} onChange={e => setEditingMetric({ ...editingMetric, unit: e.target.value })} className="text-sm" />
                    <Select value={editingMetric.category} onValueChange={v => setEditingMetric({ ...editingMetric, category: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
                    <Select value={editingMetric.inputType} onValueChange={v => setEditingMetric({ ...editingMetric, inputType: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="calculated">Calculado</SelectItem></SelectContent></Select>
                  </div>
                  {editingMetric.inputType === "calculated" && <div className="grid grid-cols-3 gap-2"><Input placeholder="PCI" value={editingMetric.pci || ""} onChange={e => setEditingMetric({ ...editingMetric, pci: e.target.value })} className="text-sm" /><Input placeholder="FE" value={editingMetric.emissionFactor || ""} onChange={e => setEditingMetric({ ...editingMetric, emissionFactor: e.target.value })} className="text-sm" /><Input placeholder="Densidade" value={editingMetric.density || ""} onChange={e => setEditingMetric({ ...editingMetric, density: e.target.value })} className="text-sm" /></div>}
                  <div className="flex gap-2"><Button size="sm" onClick={() => upsertMetricMutation.mutate(editingMetric)}>Guardar</Button><Button size="sm" variant="outline" onClick={() => setEditingMetric(null)}>Cancelar</Button></div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Matriz</TabsTrigger>
            <TabsTrigger value="submit">Submeter</TabsTrigger>
            {isAdminOrDO && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
            {user?.role === "admin" && <TabsTrigger value="metas">Metas</TabsTrigger>}
          </TabsList>

          {/* Matrix */}
          <TabsContent value="overview">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Matriz de Submissão</CardTitle></CardHeader><CardContent>
              {matrixWeeks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Sem submissões.</p> : (
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b"><th className="text-left p-2">Empresa</th>{matrixWeeks.map(w => <th key={`${w.weekYear}-${w.weekNumber}`} className="p-2 text-center">S{w.weekNumber}</th>)}</tr></thead><tbody>{matrixCompanies.map(([id, name]) => (
                  <tr key={id} className="border-b hover:bg-muted/30"><td className="p-2 font-medium">{name}</td>{matrixWeeks.map(w => { const s = matrixData.find((x: any) => x.companyId === id && x.weekNumber === w.weekNumber && x.weekYear === w.weekYear); return <td key={`${w.weekYear}-${w.weekNumber}`} className="p-2 text-center">{s ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-300 mx-auto" />}</td>; })}</tr>
                ))}</tbody></table></div>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* Submit - Card-based step form */}
          <TabsContent value="submit">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap gap-4 items-end">
                  <div><label className="text-xs text-muted-foreground block mb-1">Semana</label><Select value={formWeek} onValueChange={setFormWeek}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 53 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Semana {i + 1}</SelectItem>)}</SelectContent></Select></div>
                  <div><label className="text-xs text-muted-foreground block mb-1">Ano</label><Select value={formYear} onValueChange={setFormYear}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 bg-muted/50 px-3 py-1.5 rounded">Período: <strong>{weekPeriod}</strong></p>
              </CardHeader>
              <CardContent>
                {/* Step navigation */}
                <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                  {categories.map((cat, idx) => (
                    <Button key={cat} size="sm" variant={formStep === idx ? "default" : "outline"} onClick={() => setFormStep(idx)} className="text-xs whitespace-nowrap">
                      {CAT_ICONS[cat]} {CAT_LABELS[cat] || cat}
                    </Button>
                  ))}
                </div>

                {/* Current category cards */}
                <div className="grid gap-3 md:grid-cols-2">
                  {currentCatMetrics.map((m: any) => (
                    <Card key={m.id} className={`transition-all ${formValues[m.id] ? "border-primary/40 bg-primary/5" : "hover:border-primary/20"}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">{m.name}</p>
                          <Badge variant="outline" className="text-[10px]">{m.unit}</Badge>
                        </div>
                        <Input type="number" step="any" placeholder={`Valor em ${m.unit}`} value={formValues[m.id] || ""} onChange={e => setFormValues({ ...formValues, [m.id]: e.target.value })} className="text-lg h-10 font-mono" />
                        {m.target && m.target !== "N/A" && <p className="text-[10px] text-muted-foreground mt-1">Meta: {m.target}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Calculated values preview */}
                {formStep === categories.length - 1 && calculatedMetrics.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">Valores Calculados Automaticamente</p>
                    {calculatedMetrics.map((m: any) => {
                      let cv = 0;
                      if (m.formulaType === "fuel_to_co2" && m.formulaSourceMetricId) cv = (parseFloat(formValues[m.formulaSourceMetricId] || "0")) * (parseFloat(m.density) || 0) * (parseFloat(m.pci) || 0) * (parseFloat(m.emissionFactor) || 0) / 1000;
                      else if (m.formulaType === "sum_co2") { for (const cm of calculatedMetrics) { if (cm.formulaType === "fuel_to_co2" && cm.formulaSourceMetricId) cv += (parseFloat(formValues[cm.formulaSourceMetricId] || "0")) * (parseFloat(cm.density) || 0) * (parseFloat(cm.pci) || 0) * (parseFloat(cm.emissionFactor) || 0) / 1000; } }
                      return <div key={m.id} className="flex justify-between text-sm py-1"><span>{m.name}</span><strong>{cv.toFixed(1)} {m.unit}</strong></div>;
                    })}
                  </div>
                )}

                {/* Navigation + Submit */}
                <div className="flex justify-between mt-4">
                  <Button variant="outline" disabled={formStep === 0} onClick={() => setFormStep(formStep - 1)}>← Anterior</Button>
                  {formStep < categories.length - 1 ? (
                    <Button onClick={() => setFormStep(formStep + 1)}>Seguinte →</Button>
                  ) : (
                    <Button onClick={handleSubmit} disabled={submitMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700"><Send className="w-4 h-4 mr-2" />{submitMutation.isPending ? "A submeter..." : "Submeter KPIs"}</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dashboard (16 charts) */}
          {isAdminOrDO && (
            <TabsContent value="dashboard" className="space-y-4">
              <div className="flex gap-2 items-center mb-2">
                <span className="text-sm text-muted-foreground">Período:</span>
                {(["week", "month", "semester", "year", "project"] as const).map(f => (
                  <Button key={f} size="sm" variant={dashFilter === f ? "default" : "outline"} onClick={() => setDashFilter(f)} className="text-xs h-7">{f === "week" ? "Semana" : f === "month" ? "Mês" : f === "semester" ? "Semestre" : f === "year" ? "Ano" : "Projeto"}</Button>
                ))}
              </div>
              <div className="flex gap-1 mb-3 flex-wrap">

                  {["Energia & CO2", "Água", "Trabalhadores", "Incidentes"].map((p, i) => (
                    <Button key={p} size="sm" variant={dashPage === i ? "default" : "outline"} onClick={() => setDashPage(i)} className="text-xs h-7">{p}</Button>
                  ))}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                {dashPage === 0 && <>
                <ChartCard title="Consumo Combustível (L)"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="fuel" fill="#f59e0b" /></BarChart></ChartCard>
                <ChartCard title="Eletricidade (kWh)"><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Area type="monotone" dataKey="energy" fill="#a855f7" stroke="#7c3aed" fillOpacity={0.3} /></AreaChart></ChartCard>
                <ChartCard title="Repartição Emissões CO2"><PieChart><Pie data={[{ name: "Diesel", value: totals[findMetric("emissions", "Diesel")?.id || 0] || 0 }, { name: "HVO", value: totals[findMetric("emissions", "HVO")?.id || 0] || 0 }]} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip /></PieChart></ChartCard>
                <ChartCard title="CO2 Acumulado"><AreaChart data={chartData.reduce((acc: any[], d: any, i: number) => { const prev = acc[i - 1]?.cumFuel || 0; acc.push({ ...d, cumFuel: prev + (d.fuel || 0) }); return acc; }, [])}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Area type="monotone" dataKey="cumFuel" fill="#f59e0b" stroke="#d97706" fillOpacity={0.2} /></AreaChart></ChartCard>
                </>}
                {dashPage === 1 && <>
                <ChartCard title="Consumo Água (L)"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="water" fill="#3b82f6" /></BarChart></ChartCard>
                <ChartCard title="Água Acumulada"><AreaChart data={chartData.reduce((acc: any[], d: any, i: number) => { const prev = acc[i - 1]?.cumWater || 0; acc.push({ ...d, cumWater: prev + (d.water || 0) }); return acc; }, [])}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Area type="monotone" dataKey="cumWater" fill="#3b82f6" stroke="#2563eb" fillOpacity={0.2} /></AreaChart></ChartCard>
                <ChartCard title="Repartição por Tipo de Água"><PieChart><Pie data={metrics.filter((m: any) => m.category === "water" && m.inputType === "manual" && (totals[m.id] || 0) > 0).map((m: any) => ({ name: m.name.replace("Água ", "").replace("de ", ""), value: totals[m.id] || 0 }))} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}>{COLORS.map((c, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ChartCard>
                <Card className="flex flex-col justify-center items-center p-4 bg-gradient-to-br from-blue-50 to-sky-50"><Droplets className="w-8 h-8 text-blue-500 mb-2" /><p className="text-2xl font-bold text-blue-700">{formatNumber(Object.entries(totals).filter(([id]) => metrics.find((m: any) => m.id === Number(id) && m.category === "water")).reduce((s, [, v]) => s + v, 0))} L</p><p className="text-xs text-muted-foreground">Total Água Consumida</p></Card>
                </>}
                {dashPage === 2 && <>
                <ChartCard title="Trabalhadores em Obra"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Line type="monotone" dataKey="workforce" stroke="#8b5cf6" strokeWidth={2} /></LineChart></ChartCard>
                <ChartCard title="Trabalhadores vs Horas"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="workforce" stroke="#8b5cf6" name="Trabalhadores" /><Line type="monotone" dataKey={`m_${findMetric("workforce", "horas")?.id || 0}`} stroke="#06b6d4" name="Horas" /></LineChart></ChartCard>
                <ChartCard title="Transporte"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="transport" fill="#06b6d4" /></BarChart></ChartCard>
                <Card className="flex flex-col justify-center items-center p-4 bg-gradient-to-br from-violet-50 to-purple-50"><Users className="w-8 h-8 text-purple-500 mb-2" /><p className="text-2xl font-bold text-purple-700">{(() => { const tec = totals[findMetric('workforce', 'Técnicos')?.id || 0] || 0; const total = totals[findMetric('workforce', 'Trabalhadores em obra')?.id || 0] || 1; return tec + ' / ' + total; })()}</p><p className="text-xs text-muted-foreground">Técnicos Ambiente / Total Trabalhadores</p><p className="text-[10px] text-emerald-600 font-medium mt-1">Rácio: {(() => { const tec = totals[findMetric('workforce', 'Técnicos')?.id || 0] || 0; const total = totals[findMetric('workforce', 'Trabalhadores em obra')?.id || 0] || 1; return ((tec / Math.max(total, 1)) * 100).toFixed(1); })()}%</p></Card>
                </>}
                {dashPage === 3 && <>
                <div className="grid grid-cols-2 gap-3">
                  <ChartCard title="Incidentes Ambientais"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="incidents" fill="#ef4444" /></BarChart></ChartCard>
                  <Card className="flex flex-col justify-center items-center p-4 bg-gradient-to-br from-red-50 to-orange-50"><AlertTriangle className="w-8 h-8 text-red-500 mb-2" /><p className="text-2xl font-bold text-red-700">{totals[findMetric("incidents", "Incidentes Ambientais")?.id || 0] || 0}</p><p className="text-xs text-muted-foreground">Total Incidentes</p></Card>
                  <Card className="flex flex-col justify-center items-center p-4 bg-gradient-to-br from-amber-50 to-yellow-50"><Activity className="w-8 h-8 text-amber-500 mb-2" /><p className="text-2xl font-bold text-amber-700">{totals[findMetric("incidents", "derrames")?.id || 0] || 0}</p><p className="text-xs text-muted-foreground">Derrames</p></Card>
                  <Card className="flex flex-col justify-center items-center p-4 bg-gradient-to-br from-emerald-50 to-green-50"><Activity className="w-8 h-8 text-emerald-500 mb-2" /><p className="text-2xl font-bold text-emerald-700">{chartData.filter(d => Object.values(d).some(v => typeof v === "number" && v > 0)).length}</p><p className="text-xs text-muted-foreground">Semanas com Dados</p></Card>
                </div>
                <Card className="mt-3"><CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold">Registo de Incidentes</p>
                    {isAdminOrDO && <Button size="sm" variant="outline" onClick={() => setShowIncidentForm(!showIncidentForm)}>+ Adicionar</Button>}
                  </div>
                  {showIncidentForm && isAdminOrDO && (
                    <div className="grid grid-cols-5 gap-2 mb-3 p-3 bg-muted/30 rounded-lg">
                      <Input placeholder="Nome do incidente" value={incidentForm.name} onChange={e => setIncidentForm({...incidentForm, name: e.target.value})} />
                      <Input type="date" value={incidentForm.date} onChange={e => setIncidentForm({...incidentForm, date: e.target.value})} />
                      <select className="border rounded px-2 py-1 text-sm" value={incidentForm.status} onChange={e => setIncidentForm({...incidentForm, status: e.target.value})}>
                        <option value="aberto">Aberto</option><option value="em_investigacao">Em Investigação</option><option value="resolvido">Resolvido</option><option value="encerrado">Encerrado</option>
                      </select>
                      <select className="border rounded px-2 py-1 text-sm" value={incidentForm.severity} onChange={e => setIncidentForm({...incidentForm, severity: e.target.value})}>
                        <option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option><option value="critico">Crítico</option>
                      </select>
                      <div className="flex gap-1">
                        <Input placeholder="Link (opcional)" value={incidentForm.link} onChange={e => setIncidentForm({...incidentForm, link: e.target.value})} className="flex-1" />
                        <Button size="sm" onClick={() => { if (incidentForm.name && incidentForm.date && activeProject) { createIncidentMut.mutate({ projectId: activeProject.id, ...incidentForm, link: incidentForm.link || undefined }); setIncidentForm({ name: "", date: "", status: "aberto", severity: "baixo", link: "" }); setShowIncidentForm(false); } }}>✓</Button>
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b"><th className="text-left p-2">Incidente</th><th className="p-2">Data</th><th className="p-2">Status</th><th className="p-2">Grau</th><th className="p-2">Link</th>{isAdminOrDO && <th className="p-2"></th>}</tr></thead>
                      <tbody>
                        {(incidentsQuery.data || []).map((inc: any) => (
                          <tr key={inc.id} className="border-b hover:bg-muted/20">
                            <td className="p-2 font-medium">{inc.name}</td>
                            <td className="p-2 text-center">{inc.date}</td>
                            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${inc.status === "resolvido" || inc.status === "encerrado" ? "bg-green-100 text-green-700" : inc.status === "em_investigacao" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{inc.status}</span></td>
                            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${inc.severity === "critico" ? "bg-red-200 text-red-800" : inc.severity === "alto" ? "bg-orange-100 text-orange-700" : inc.severity === "medio" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{inc.severity}</span></td>
                            <td className="p-2 text-center">{inc.link ? <a href={inc.link} target="_blank" rel="noopener" className="text-blue-600 underline">Ver</a> : "—"}</td>
                            {isAdminOrDO && <td className="p-2"><Button size="sm" variant="ghost" className="text-red-500 h-6 w-6 p-0" onClick={() => deleteIncidentMut.mutate({ id: inc.id })}>×</Button></td>}
                          </tr>
                        ))}
                        {(!incidentsQuery.data || incidentsQuery.data.length === 0) && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sem incidentes registados</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </CardContent></Card>
                </>}
              </div>
            </TabsContent>
          )}

          {/* Metas */}
          {user?.role === "admin" && (
            <TabsContent value="metas" className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Ano:</span>
                <Select value={String(targetYear)} onValueChange={v => setTargetYear(Number(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{[2024, 2025, 2026, 2027, 2028].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                <Button size="sm" onClick={() => setEditingTarget({ metricId: metrics[0]?.id || 1, projectId, targetType: "monthly", targetValue: "", targetDirection: "max", year: targetYear })}><Plus className="w-3 h-3 mr-1" /> Nova Meta</Button>
              </div>
              {editingTarget && (
                <Card className="border-emerald-200 bg-emerald-50/30"><CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Select value={String(editingTarget.metricId)} onValueChange={v => setEditingTarget({ ...editingTarget, metricId: Number(v) })}><SelectTrigger className="text-sm"><SelectValue placeholder="Métrica" /></SelectTrigger><SelectContent>{metrics.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent></Select>
                    <Input placeholder="Valor" value={editingTarget.targetValue} onChange={e => setEditingTarget({ ...editingTarget, targetValue: e.target.value })} className="text-sm" />
                    <Select value={editingTarget.targetDirection} onValueChange={v => setEditingTarget({ ...editingTarget, targetDirection: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="max">Não exceder</SelectItem><SelectItem value="min">Atingir</SelectItem></SelectContent></Select>
                    <Select value={editingTarget.targetType} onValueChange={v => setEditingTarget({ ...editingTarget, targetType: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent></Select>
                  </div>
                  <div className="flex gap-2"><Button size="sm" onClick={() => upsertTargetMutation.mutate(editingTarget)}>Guardar</Button><Button size="sm" variant="outline" onClick={() => setEditingTarget(null)}>Cancelar</Button></div>
                </CardContent></Card>
              )}
              {targets.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Sem metas para {targetYear}.</p> : targets.map((t: any) => {
                const metric = metrics.find((m: any) => m.id === t.metricId);
                const current = totals[t.metricId] || 0;
                const target = parseFloat(t.targetValue) || 0;
                const progress = target > 0 ? (current / target) * 100 : 0;
                const isGood = t.targetDirection === "max" ? current <= target : current >= target;
                return (
                  <Card key={t.id} className={`border-l-4 ${isGood ? "border-l-green-500" : "border-l-red-500"}`}><CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1"><p className="text-sm font-medium">{metric?.name || "—"}</p><p className="text-xs text-muted-foreground">{t.targetType === "monthly" ? "Mensal" : "Anual"} • {t.targetDirection === "max" ? "Não exceder" : "Atingir"} {t.targetValue} {metric?.unit}</p></div>
                    <div className="text-right"><p className={`text-lg font-bold ${isGood ? "text-green-600" : "text-red-600"}`}>{formatNumber(current)}</p><p className="text-[10px] text-muted-foreground">de {t.targetValue}</p></div>
                    <div className="w-16"><div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full ${isGood ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${Math.min(progress, 100)}%` }} /></div><p className="text-[10px] text-center">{progress.toFixed(0)}%</p></div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => { if (confirm("Eliminar?")) deleteTargetMutation.mutate({ id: t.id }); }}><Trash2 className="w-3 h-3" /></Button>
                  </CardContent></Card>
                );
              })}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ChartCard({ title, children, h = "h-48" }: { title: string; children: React.ReactNode; h?: string }) {
  return <Card><CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-muted-foreground">{title}</CardTitle></CardHeader><CardContent className={`${h} px-2 pb-2`}><ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer></CardContent></Card>;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return n.toFixed(0);
}
