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
import { Settings, Download, Send, Droplets, Fuel, Zap, AlertTriangle, Plus, Pencil, Trash2, CheckCircle, XCircle, Target, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { toast } from "sonner";

export default function KPI() {
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
  const [activeTab, setActiveTab] = useState("overview");
  const [showSettings, setShowSettings] = useState(false);
  const [formWeek, setFormWeek] = useState(String(getISOWeek(new Date())));
  const [formYear, setFormYear] = useState(String(new Date().getFullYear()));
  const [formValues, setFormValues] = useState<Record<number, string>>({});
  const [editingMetric, setEditingMetric] = useState<any>(null);
  const [dashFilter, setDashFilter] = useState<"week" | "month" | "semester" | "year">("month");
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [editingTarget, setEditingTarget] = useState<any>(null);

  const projectId = activeProject?.id || 0;
  const metricsQuery = trpc.kpi.metrics.useQuery();
  const matrixQuery = trpc.kpi.matrix.useQuery({ projectId }, { enabled: projectId > 0 });
  const allValuesQuery = trpc.kpi.allValues.useQuery({ projectId }, { enabled: projectId > 0 });
  const targetsQuery = trpc.kpi.targets.useQuery({ projectId, year: targetYear }, { enabled: projectId > 0 });
  const companiesQuery = trpc.companies.list.useQuery();
  const submitMutation = trpc.kpi.submit.useMutation({ onSuccess: () => { toast.success("KPIs submetidos!"); matrixQuery.refetch(); allValuesQuery.refetch(); setFormValues({}); } });
  const upsertMetricMutation = trpc.kpi.upsertMetric.useMutation({ onSuccess: () => { metricsQuery.refetch(); setEditingMetric(null); toast.success("Métrica guardada."); } });
  const deleteMetricMutation = trpc.kpi.deleteMetric.useMutation({ onSuccess: () => { metricsQuery.refetch(); toast.success("Métrica removida."); } });
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

  // Week period display
  const weekPeriod = useMemo(() => {
    const w = Number(formWeek); const y = Number(formYear);
    const jan4 = new Date(y, 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    const start = new Date(startOfWeek1);
    start.setDate(start.getDate() + (w - 1) * 7);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("pt-PT")} a ${end.toLocaleDateString("pt-PT")}`;
  }, [formWeek, formYear]);

  // Totals
  const totals = useMemo(() => {
    const result: Record<number, number> = {};
    for (const v of allValues) { result[v.metricId] = (result[v.metricId] || 0) + (parseFloat(v.value) || 0); }
    for (const m of calculatedMetrics) {
      if (m.formulaType === "fuel_to_co2" && m.formulaSourceMetricId) {
        result[m.id] = (result[m.formulaSourceMetricId] || 0) * (parseFloat(m.density) || 0) * (parseFloat(m.pci) || 0) * (parseFloat(m.emissionFactor) || 0) / 1000;
      } else if (m.formulaType === "sum_co2") {
        let sum = 0;
        for (const cm of calculatedMetrics) { if (cm.formulaType === "fuel_to_co2") sum += (result[cm.id] || 0); }
        result[m.id] = sum;
      }
    }
    return result;
  }, [allValues, calculatedMetrics]);

  // Dashboard chart data
  const chartData = useMemo(() => {
    const byWeek = new Map<string, Record<string, number>>();
    for (const v of allValues) {
      const key = `S${v.weekNumber}`;
      if (!byWeek.has(key)) byWeek.set(key, { week: v.weekNumber, year: v.weekYear });
      const entry = byWeek.get(key)!;
      const metric = metrics.find((m: any) => m.id === v.metricId);
      if (metric) { entry[metric.category] = (entry[metric.category] || 0) + (parseFloat(v.value) || 0); }
    }
    return Array.from(byWeek.entries()).map(([key, data]) => ({ name: key, ...data })).sort((a, b) => ((a as any).year - (b as any).year) || ((a as any).week - (b as any).week));
  }, [allValues, metrics]);

  // Matrix
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
  const incidentsMetric = findMetric("incidents", "Incidentes Ambientais");
  const waterMetric = findMetric("water", "Água de Construção");
  const dieselMetric = findMetric("emissions", "Consumo Total");
  const hvoMetric = findMetric("emissions", "HVO");
  const electricityMetric = findMetric("energy", "Eletricidade");

  const handleSubmit = () => {
    if (!user?.companyId || !projectId) { toast.error("Selecione um projeto e verifique a sua empresa."); return; }
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
    toast.success("Exportado!");
  };

  if (isAllProjects) return <AppLayout><div className="p-6 text-center text-muted-foreground">Selecione um projeto individual para ver os KPI's.</div></AppLayout>;

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
          <SummaryCard icon={<AlertTriangle className="w-4 h-4 text-red-500" />} label="Incidentes Ambientais" value={String(incidentsMetric ? (totals[incidentsMetric.id] || 0) : 0)} color="red" />
          <SummaryCard icon={<Droplets className="w-4 h-4 text-blue-500" />} label="Água Construção" value={`${waterMetric ? formatNumber(totals[waterMetric.id] || 0) : "0"} L`} color="blue" />
          <SummaryCard icon={<Fuel className="w-4 h-4 text-amber-500" />} label="Combustível" value={`${dieselMetric ? formatNumber(totals[dieselMetric.id] || 0) : "0"} KgCO2e`} color="amber" />
          <SummaryCard icon={<Fuel className="w-4 h-4 text-green-500" />} label="HVO" value={`${hvoMetric ? formatNumber(totals[hvoMetric.id] || 0) : "0"} KgCO2e`} color="green" />
          <SummaryCard icon={<Zap className="w-4 h-4 text-purple-500" />} label="Eletricidade" value={`${electricityMetric ? formatNumber(totals[electricityMetric.id] || 0) : "0"} kWh`} color="purple" />
        </div>

        {/* Settings Panel */}
        {showSettings && user?.role === "admin" && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Settings className="w-4 h-4" /> Definições de Métricas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-1 max-h-48 overflow-y-auto">
                {metrics.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2 p-1.5 rounded border bg-white text-xs">
                    <span className="flex-1 truncate">{m.name}</span>
                    <Badge variant="outline" className="text-[9px]">{m.unit}</Badge>
                    <Badge variant={m.inputType === "manual" ? "default" : "secondary"} className="text-[9px]">{m.inputType === "manual" ? "Manual" : "Calc"}</Badge>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setEditingMetric(m)}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-500" onClick={() => { if (confirm("Remover?")) deleteMetricMutation.mutate({ id: m.id }); }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditingMetric({ name: "", unit: "", category: "other", inputType: "manual" })}><Plus className="w-3 h-3 mr-1" /> Nova Métrica</Button>
              {editingMetric && (
                <div className="p-3 border rounded bg-white space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Nome (PT)" value={editingMetric.name} onChange={e => setEditingMetric({ ...editingMetric, name: e.target.value })} className="text-sm" />
                    <Input placeholder="Unidade" value={editingMetric.unit} onChange={e => setEditingMetric({ ...editingMetric, unit: e.target.value })} className="text-sm" />
                    <Select value={editingMetric.category} onValueChange={v => setEditingMetric({ ...editingMetric, category: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="workforce">Mão de Obra</SelectItem><SelectItem value="transport">Transporte</SelectItem><SelectItem value="fuel">Combustível</SelectItem><SelectItem value="energy">Energia</SelectItem><SelectItem value="water">Água</SelectItem><SelectItem value="emissions">Emissões</SelectItem><SelectItem value="incidents">Incidentes</SelectItem><SelectItem value="other">Outros</SelectItem></SelectContent></Select>
                    <Select value={editingMetric.inputType} onValueChange={v => setEditingMetric({ ...editingMetric, inputType: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="calculated">Calculado</SelectItem></SelectContent></Select>
                  </div>
                  {editingMetric.inputType === "calculated" && (
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="PCI" value={editingMetric.pci || ""} onChange={e => setEditingMetric({ ...editingMetric, pci: e.target.value })} className="text-sm" />
                      <Input placeholder="FE (KgCO2e/tep)" value={editingMetric.emissionFactor || ""} onChange={e => setEditingMetric({ ...editingMetric, emissionFactor: e.target.value })} className="text-sm" />
                      <Input placeholder="Densidade" value={editingMetric.density || ""} onChange={e => setEditingMetric({ ...editingMetric, density: e.target.value })} className="text-sm" />
                    </div>
                  )}
                  <div className="flex gap-2"><Button size="sm" onClick={() => upsertMetricMutation.mutate(editingMetric)}>Guardar</Button><Button size="sm" variant="outline" onClick={() => setEditingMetric(null)}>Cancelar</Button></div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Matriz</TabsTrigger>
            <TabsTrigger value="submit">Submeter Dados</TabsTrigger>
            {isAdminOrDO && <TabsTrigger value="dashboard"><BarChart3 className="w-3 h-3 mr-1" /> Dashboard</TabsTrigger>}
            {user?.role === "admin" && <TabsTrigger value="metas"><Target className="w-3 h-3 mr-1" /> Metas</TabsTrigger>}
          </TabsList>

          {/* Matrix */}
          <TabsContent value="overview">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Matriz de Submissão — EE × Semana</CardTitle></CardHeader>
              <CardContent>
                {matrixWeeks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Sem submissões de KPI neste projeto.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b"><th className="text-left p-2 font-medium">Empresa</th>{matrixWeeks.map(w => <th key={`${w.weekYear}-${w.weekNumber}`} className="p-2 text-center font-medium">S{w.weekNumber}</th>)}</tr></thead>
                      <tbody>{matrixCompanies.map(([compId, compName]) => (
                        <tr key={compId} className="border-b hover:bg-muted/30">
                          <td className="p-2 font-medium">{compName}</td>
                          {matrixWeeks.map(w => { const sub = matrixData.find((s: any) => s.companyId === compId && s.weekNumber === w.weekNumber && s.weekYear === w.weekYear); return <td key={`${w.weekYear}-${w.weekNumber}`} className="p-2 text-center">{sub ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-300 mx-auto" />}</td>; })}
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Submit */}
          <TabsContent value="submit">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Submeter KPIs Semanais</CardTitle>
                <div className="flex flex-wrap gap-4 items-end mt-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Semana</label>
                    <Select value={formWeek} onValueChange={setFormWeek}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 53 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Semana {i + 1}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Ano</label>
                    <Select value={formYear} onValueChange={setFormYear}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>{[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-2 px-3 py-1.5 bg-muted/50 rounded text-xs text-muted-foreground">Período: <strong>{weekPeriod}</strong></div>
              </CardHeader>
              <CardContent className="space-y-4">
                {["workforce", "transport", "fuel", "energy", "water", "incidents", "other"].map(cat => {
                  const catMetrics = manualMetrics.filter((m: any) => m.category === cat);
                  if (catMetrics.length === 0) return null;
                  const catLabel: Record<string, string> = { workforce: "Mão de Obra", transport: "Transporte", fuel: "Combustível", energy: "Energia", water: "Água", incidents: "Incidentes", other: "Outros" };
                  return (
                    <div key={cat}>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">{catLabel[cat]}</h3>
                      <div className="rounded border overflow-hidden">
                        {catMetrics.map((m: any, idx: number) => (
                          <div key={m.id} className={`flex items-center gap-3 px-3 py-2 ${idx % 2 === 0 ? "bg-white" : "bg-muted/30"} hover:bg-primary/5 transition-colors focus-within:bg-primary/10 focus-within:ring-1 focus-within:ring-primary/20`}>
                            <label className="text-sm flex-1 min-w-0">{m.name} <span className="text-muted-foreground text-xs">({m.unit})</span></label>
                            <Input type="number" step="any" placeholder="0" value={formValues[m.id] || ""} onChange={e => setFormValues({ ...formValues, [m.id]: e.target.value })} className="w-28 text-right text-sm h-8" />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {calculatedMetrics.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">Valores Calculados (automático)</h3>
                    <div className="rounded border overflow-hidden">
                      {calculatedMetrics.map((m: any, idx: number) => {
                        let cv = 0;
                        if (m.formulaType === "fuel_to_co2" && m.formulaSourceMetricId) { cv = (parseFloat(formValues[m.formulaSourceMetricId] || "0")) * (parseFloat(m.density) || 0) * (parseFloat(m.pci) || 0) * (parseFloat(m.emissionFactor) || 0) / 1000; }
                        else if (m.formulaType === "sum_co2") { for (const cm of calculatedMetrics) { if (cm.formulaType === "fuel_to_co2" && cm.formulaSourceMetricId) cv += (parseFloat(formValues[cm.formulaSourceMetricId] || "0")) * (parseFloat(cm.density) || 0) * (parseFloat(cm.pci) || 0) * (parseFloat(cm.emissionFactor) || 0) / 1000; } }
                        return (
                          <div key={m.id} className={`flex items-center gap-3 px-3 py-2 ${idx % 2 === 0 ? "bg-emerald-50/50" : "bg-emerald-50/30"}`}>
                            <label className="text-sm flex-1 min-w-0 text-muted-foreground">{m.name}</label>
                            <span className="text-sm font-mono w-28 text-right font-medium">{cv.toFixed(1)} {m.unit}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <Button onClick={handleSubmit} disabled={submitMutation.isPending} className="w-full"><Send className="w-4 h-4 mr-2" /> {submitMutation.isPending ? "A submeter..." : "Submeter KPIs"}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dashboard (Admin/DO) */}
          {isAdminOrDO && (
            <TabsContent value="dashboard" className="space-y-4">
              <div className="flex gap-2 items-center">
                <span className="text-sm text-muted-foreground">Filtrar:</span>
                {(["week", "month", "semester", "year"] as const).map(f => (
                  <Button key={f} size="sm" variant={dashFilter === f ? "default" : "outline"} onClick={() => setDashFilter(f)} className="text-xs">{f === "week" ? "Semana" : f === "month" ? "Mês" : f === "semester" ? "Semestre" : "Ano"}</Button>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Consumo de Combustível (KgCO2e)</CardTitle></CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="fuel" fill="#f59e0b" name="Combustível (L)" /></BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Consumo de Água (L)</CardTitle></CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="water" fill="#3b82f6" name="Água (L)" /></BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Mão de Obra</CardTitle></CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="workforce" stroke="#8b5cf6" name="Trabalhadores" /></LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Incidentes Ambientais</CardTitle></CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="incidents" fill="#ef4444" name="Incidentes" /></BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Metas (Admin) */}
          {user?.role === "admin" && (
            <TabsContent value="metas" className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Ano:</span>
                <Select value={String(targetYear)} onValueChange={v => setTargetYear(Number(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{[2024, 2025, 2026, 2027, 2028].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                <Button size="sm" onClick={() => setEditingTarget({ metricId: metrics[0]?.id || 1, projectId, targetType: "monthly", targetValue: "", targetDirection: "max", year: targetYear })}><Plus className="w-3 h-3 mr-1" /> Nova Meta</Button>
              </div>
              {editingTarget && (
                <Card className="border-emerald-200 bg-emerald-50/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Select value={String(editingTarget.metricId)} onValueChange={v => setEditingTarget({ ...editingTarget, metricId: Number(v) })}><SelectTrigger className="text-sm"><SelectValue placeholder="Métrica" /></SelectTrigger><SelectContent>{metrics.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent></Select>
                      <Input placeholder="Valor meta" value={editingTarget.targetValue} onChange={e => setEditingTarget({ ...editingTarget, targetValue: e.target.value })} className="text-sm" />
                      <Select value={editingTarget.targetDirection} onValueChange={v => setEditingTarget({ ...editingTarget, targetDirection: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="max">Máximo (não exceder)</SelectItem><SelectItem value="min">Mínimo (atingir)</SelectItem></SelectContent></Select>
                      <Select value={editingTarget.targetType} onValueChange={v => setEditingTarget({ ...editingTarget, targetType: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent></Select>
                    </div>
                    <div className="flex gap-2"><Button size="sm" onClick={() => upsertTargetMutation.mutate(editingTarget)}>Guardar</Button><Button size="sm" variant="outline" onClick={() => setEditingTarget(null)}>Cancelar</Button></div>
                  </CardContent>
                </Card>
              )}
              <div className="grid gap-3">
                {targets.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Sem metas definidas para {targetYear}.</p> : targets.map((t: any) => {
                  const metric = metrics.find((m: any) => m.id === t.metricId);
                  const current = totals[t.metricId] || 0;
                  const target = parseFloat(t.targetValue) || 0;
                  const progress = target > 0 ? (current / target) * 100 : 0;
                  const isGood = t.targetDirection === "max" ? current <= target : current >= target;
                  return (
                    <Card key={t.id} className={`border-l-4 ${isGood ? "border-l-green-500" : "border-l-red-500"}`}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{metric?.name || `Métrica #${t.metricId}`}</p>
                          <p className="text-xs text-muted-foreground">{t.targetType === "monthly" ? "Meta Mensal" : "Meta Anual"} • {t.targetDirection === "max" ? "Não exceder" : "Atingir"} {t.targetValue} {metric?.unit}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${isGood ? "text-green-600" : "text-red-600"}`}>{formatNumber(current)}</p>
                          <p className="text-[10px] text-muted-foreground">de {t.targetValue} {metric?.unit}</p>
                        </div>
                        <div className="w-20">
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full ${isGood ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                          </div>
                          <p className="text-[10px] text-center mt-0.5">{progress.toFixed(0)}%</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => { if (confirm("Eliminar meta?")) deleteTargetMutation.mutate({ id: t.id }); }}><Trash2 className="w-3 h-3" /></Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Card className={`border-${color}-100`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
        <p className={`text-xl font-bold text-${color}-600`}>{value}</p>
        <p className="text-[10px] text-muted-foreground">acumulado</p>
      </CardContent>
    </Card>
  );
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
