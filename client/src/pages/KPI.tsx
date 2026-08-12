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
import { Settings, Download, Send, Droplets, Fuel, Zap, AlertTriangle, Users, Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

// Conversion: Litres → KgCO2e = Volume(L) × Density(kg/L) × PCI(tep/t) × FE(KgCO2e/tep)
function fuelToCO2(litres: number, pci: number, fe: number, density: number): number {
  return litres * density * pci * fe / 1000; // divide by 1000 to get from tep/t to tep/kg
}

export default function KPI() {
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
  const [activeTab, setActiveTab] = useState("overview");
  const [filterType, setFilterType] = useState<"week" | "month" | "all">("all");
  const [filterWeek, setFilterWeek] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  // Form state
  const [formWeek, setFormWeek] = useState(String(getISOWeek(new Date())));
  const [formYear, setFormYear] = useState(String(new Date().getFullYear()));
  const [formValues, setFormValues] = useState<Record<number, string>>({});
  // Settings state
  const [editingMetric, setEditingMetric] = useState<any>(null);

  const projectId = activeProject?.id || 0;
  const metricsQuery = trpc.kpi.metrics.useQuery();
  const matrixQuery = trpc.kpi.matrix.useQuery({ projectId }, { enabled: projectId > 0 });
  const allValuesQuery = trpc.kpi.allValues.useQuery({ projectId }, { enabled: projectId > 0 });
  const companiesQuery = trpc.companies.list.useQuery();
  const submitMutation = trpc.kpi.submit.useMutation({ onSuccess: () => { toast.success("KPIs submetidos com sucesso!"); matrixQuery.refetch(); allValuesQuery.refetch(); } });
  const upsertMetricMutation = trpc.kpi.upsertMetric.useMutation({ onSuccess: () => { metricsQuery.refetch(); setEditingMetric(null); toast.success("Métrica guardada."); } });
  const deleteMetricMutation = trpc.kpi.deleteMetric.useMutation({ onSuccess: () => { metricsQuery.refetch(); toast.success("Métrica removida."); } });

  const metrics = (metricsQuery.data || []) as any[];
  const manualMetrics = metrics.filter((m: any) => m.inputType === "manual");
  const calculatedMetrics = metrics.filter((m: any) => m.inputType === "calculated");
  const allValues = (allValuesQuery.data || []) as any[];
  const matrixData = (matrixQuery.data || []) as any[];
  const companies = (companiesQuery.data || []) as any[];

  // Compute totals for summary cards
  const totals = useMemo(() => {
    const result: Record<number, number> = {};
    for (const v of allValues) {
      const val = parseFloat(v.value) || 0;
      result[v.metricId] = (result[v.metricId] || 0) + val;
    }
    // Calculate derived metrics
    for (const m of calculatedMetrics) {
      if (m.formulaType === "fuel_to_co2" && m.formulaSourceMetricId) {
        const sourceTotal = result[m.formulaSourceMetricId] || 0;
        const pci = parseFloat(m.pci) || 0;
        const fe = parseFloat(m.emissionFactor) || 0;
        const density = parseFloat(m.density) || 0;
        result[m.id] = sourceTotal * density * pci * fe / 1000;
      } else if (m.formulaType === "sum_co2") {
        // Sum all fuel_to_co2 calculated metrics
        let sum = 0;
        for (const cm of calculatedMetrics) {
          if (cm.formulaType === "fuel_to_co2" && result[cm.id]) sum += result[cm.id];
        }
        result[m.id] = sum;
      }
    }
    return result;
  }, [allValues, calculatedMetrics]);

  // Matrix: companies × weeks
  const matrixWeeks = useMemo(() => {
    const weeks = new Map<string, { weekNumber: number; weekYear: number }>();
    for (const s of matrixData) {
      const key = `${s.weekYear}-${s.weekNumber}`;
      if (!weeks.has(key)) weeks.set(key, { weekNumber: s.weekNumber, weekYear: s.weekYear });
    }
    return Array.from(weeks.values()).sort((a, b) => a.weekYear - b.weekYear || a.weekNumber - b.weekNumber);
  }, [matrixData]);

  const matrixCompanies = useMemo(() => {
    const comps = new Map<number, string>();
    for (const s of matrixData) {
      if (!comps.has(s.companyId)) comps.set(s.companyId, s.shortName || s.companyName);
    }
    // Also add EE companies from the project that haven't submitted
    for (const c of companies) {
      if ((c.companyType === "ee" || c.companyType === "rap") && !comps.has(c.id)) {
        comps.set(c.id, c.shortName);
      }
    }
    return Array.from(comps.entries());
  }, [matrixData, companies]);

  // Find metric by category for cards
  const findMetric = (category: string, nameContains: string) => metrics.find((m: any) => m.category === category && m.name.toLowerCase().includes(nameContains.toLowerCase()));
  const incidentsMetric = findMetric("incidents", "Incidentes Ambientais");
  const waterMetric = findMetric("water", "Água de Construção");
  const dieselMetric = findMetric("emissions", "Consumo Total");
  const hvoMetric = findMetric("emissions", "HVO");
  const electricityMetric = findMetric("energy", "Eletricidade");

  const handleSubmit = () => {
    if (!user?.companyId || !projectId) { toast.error("Selecione um projeto e verifique a sua empresa."); return; }
    const values = Object.entries(formValues).filter(([, v]) => v.trim() !== "").map(([metricId, value]) => ({ metricId: Number(metricId), value }));
    submitMutation.mutate({ projectId, companyId: user.companyId, weekNumber: Number(formWeek), weekYear: Number(formYear), values });
  };

  const handleExportExcel = () => {
    // Generate CSV export
    let csv = "Métrica,Unidade,Total\n";
    for (const m of metrics) {
      const val = totals[m.id] || 0;
      csv += `"${m.name}",${m.unit},${val.toFixed(2)}\n`;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `KPIs_${activeProject?.code || "todos"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Excel exportado com sucesso!");
  };

  if (isAllProjects) {
    return <AppLayout><div className="p-6 text-center text-muted-foreground">Selecione um projeto individual para ver os KPI's.</div></AppLayout>;
  }

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
          <Card className="border-red-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-xs text-muted-foreground">Incidentes Ambientais</span></div>
              <p className="text-2xl font-bold text-red-600">{incidentsMetric ? (totals[incidentsMetric.id] || 0) : 0}</p>
              <p className="text-[10px] text-muted-foreground">acumulado</p>
            </CardContent>
          </Card>
          <Card className="border-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Droplets className="w-4 h-4 text-blue-500" /><span className="text-xs text-muted-foreground">Água Construção</span></div>
              <p className="text-2xl font-bold text-blue-600">{waterMetric ? formatNumber(totals[waterMetric.id] || 0) : "0"} L</p>
              <p className="text-[10px] text-muted-foreground">acumulado</p>
            </CardContent>
          </Card>
          <Card className="border-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Fuel className="w-4 h-4 text-amber-500" /><span className="text-xs text-muted-foreground">Combustível</span></div>
              <p className="text-2xl font-bold text-amber-600">{dieselMetric ? formatNumber(totals[dieselMetric.id] || 0) : "0"} KgCO2e</p>
              <p className="text-[10px] text-muted-foreground">acumulado</p>
            </CardContent>
          </Card>
          <Card className="border-green-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Fuel className="w-4 h-4 text-green-500" /><span className="text-xs text-muted-foreground">HVO</span></div>
              <p className="text-2xl font-bold text-green-600">{hvoMetric ? formatNumber(totals[hvoMetric.id] || 0) : "0"} KgCO2e</p>
              <p className="text-[10px] text-muted-foreground">acumulado</p>
            </CardContent>
          </Card>
          <Card className="border-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Zap className="w-4 h-4 text-purple-500" /><span className="text-xs text-muted-foreground">Eletricidade</span></div>
              <p className="text-2xl font-bold text-purple-600">{electricityMetric ? formatNumber(totals[electricityMetric.id] || 0) : "0"} kWh</p>
              <p className="text-[10px] text-muted-foreground">acumulado</p>
            </CardContent>
          </Card>
        </div>

        {/* Settings Panel (admin only) */}
        {showSettings && user?.role === "admin" && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Settings className="w-4 h-4" /> Definições de Métricas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {metrics.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2 p-2 rounded border bg-white text-sm">
                    <span className="flex-1 truncate">{m.name}</span>
                    <Badge variant="outline" className="text-[10px]">{m.unit}</Badge>
                    <Badge variant={m.inputType === "manual" ? "default" : "secondary"} className="text-[10px]">{m.inputType === "manual" ? "Manual" : "Calculado"}</Badge>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingMetric(m)}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => { if (confirm("Remover esta métrica?")) deleteMetricMutation.mutate({ id: m.id }); }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditingMetric({ name: "", unit: "", category: "other", inputType: "manual" })}><Plus className="w-3 h-3 mr-1" /> Adicionar Métrica</Button>
              {editingMetric && (
                <div className="p-3 border rounded bg-white space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Nome (PT)" value={editingMetric.name} onChange={e => setEditingMetric({ ...editingMetric, name: e.target.value })} />
                    <Input placeholder="Nome (EN)" value={editingMetric.nameEn || ""} onChange={e => setEditingMetric({ ...editingMetric, nameEn: e.target.value })} />
                    <Input placeholder="Unidade (L, kWh, N.º...)" value={editingMetric.unit} onChange={e => setEditingMetric({ ...editingMetric, unit: e.target.value })} />
                    <Select value={editingMetric.category} onValueChange={v => setEditingMetric({ ...editingMetric, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="workforce">Mão de Obra</SelectItem>
                        <SelectItem value="transport">Transporte</SelectItem>
                        <SelectItem value="fuel">Combustível</SelectItem>
                        <SelectItem value="energy">Energia</SelectItem>
                        <SelectItem value="water">Água</SelectItem>
                        <SelectItem value="emissions">Emissões</SelectItem>
                        <SelectItem value="incidents">Incidentes</SelectItem>
                        <SelectItem value="other">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={editingMetric.inputType} onValueChange={v => setEditingMetric({ ...editingMetric, inputType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="calculated">Calculado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Ordem" type="number" value={editingMetric.sortOrder || ""} onChange={e => setEditingMetric({ ...editingMetric, sortOrder: Number(e.target.value) })} />
                  </div>
                  {editingMetric.inputType === "calculated" && (
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="PCI (tep/t)" value={editingMetric.pci || ""} onChange={e => setEditingMetric({ ...editingMetric, pci: e.target.value })} />
                      <Input placeholder="FE (KgCO2e/tep)" value={editingMetric.emissionFactor || ""} onChange={e => setEditingMetric({ ...editingMetric, emissionFactor: e.target.value })} />
                      <Input placeholder="Densidade (Kg/L)" value={editingMetric.density || ""} onChange={e => setEditingMetric({ ...editingMetric, density: e.target.value })} />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => upsertMetricMutation.mutate(editingMetric)}>Guardar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingMetric(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Matriz</TabsTrigger>
            <TabsTrigger value="submit">Submeter Dados</TabsTrigger>
          </TabsList>

          {/* Matrix Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Matriz de Submissão — EE × Semana</CardTitle></CardHeader>
              <CardContent>
                {matrixWeeks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem submissões de KPI neste projeto.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">Empresa</th>
                          {matrixWeeks.map(w => <th key={`${w.weekYear}-${w.weekNumber}`} className="p-2 text-center font-medium">S{w.weekNumber}<br/><span className="text-[10px] text-muted-foreground">{w.weekYear}</span></th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {matrixCompanies.map(([compId, compName]) => (
                          <tr key={compId} className="border-b hover:bg-muted/30">
                            <td className="p-2 font-medium">{compName}</td>
                            {matrixWeeks.map(w => {
                              const sub = matrixData.find((s: any) => s.companyId === compId && s.weekNumber === w.weekNumber && s.weekYear === w.weekYear);
                              return (
                                <td key={`${w.weekYear}-${w.weekNumber}`} className="p-2 text-center">
                                  {sub ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-300 mx-auto" />}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Submit Tab */}
          <TabsContent value="submit" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Send className="w-4 h-4" /> Submeter KPIs Semanais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3 items-end">
                  <div>
                    <label className="text-xs text-muted-foreground">Semana</label>
                    <Input type="number" min={1} max={53} value={formWeek} onChange={e => setFormWeek(e.target.value)} className="w-20" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Ano</label>
                    <Input type="number" min={2024} max={2035} value={formYear} onChange={e => setFormYear(e.target.value)} className="w-24" />
                  </div>
                </div>

                {/* Group by category */}
                {["workforce", "transport", "fuel", "energy", "water", "incidents", "other"].map(cat => {
                  const catMetrics = manualMetrics.filter((m: any) => m.category === cat);
                  if (catMetrics.length === 0) return null;
                  const catLabel: Record<string, string> = { workforce: "Mão de Obra", transport: "Transporte", fuel: "Combustível", energy: "Energia", water: "Água", incidents: "Incidentes", other: "Outros" };
                  return (
                    <div key={cat} className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">{catLabel[cat]}</h3>
                      <div className="grid gap-2">
                        {catMetrics.map((m: any) => (
                          <div key={m.id} className="flex items-center gap-3">
                            <label className="text-sm flex-1 min-w-0 truncate" title={m.name}>{m.name} <span className="text-muted-foreground">({m.unit})</span></label>
                            <Input type="number" step="any" placeholder="0" value={formValues[m.id] || ""} onChange={e => setFormValues({ ...formValues, [m.id]: e.target.value })} className="w-32" />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Show calculated metrics (read-only) */}
                {calculatedMetrics.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">Valores Calculados (automático)</h3>
                    <div className="grid gap-2">
                      {calculatedMetrics.map((m: any) => {
                        let calcValue = 0;
                        if (m.formulaType === "fuel_to_co2" && m.formulaSourceMetricId) {
                          const sourceVal = parseFloat(formValues[m.formulaSourceMetricId] || "0");
                          const pci = parseFloat(m.pci) || 0;
                          const fe = parseFloat(m.emissionFactor) || 0;
                          const density = parseFloat(m.density) || 0;
                          calcValue = sourceVal * density * pci * fe / 1000;
                        } else if (m.formulaType === "sum_co2") {
                          for (const cm of calculatedMetrics) {
                            if (cm.formulaType === "fuel_to_co2" && cm.formulaSourceMetricId) {
                              const sv = parseFloat(formValues[cm.formulaSourceMetricId] || "0");
                              const p = parseFloat(cm.pci) || 0;
                              const f = parseFloat(cm.emissionFactor) || 0;
                              const d = parseFloat(cm.density) || 0;
                              calcValue += sv * d * p * f / 1000;
                            }
                          }
                        }
                        return (
                          <div key={m.id} className="flex items-center gap-3">
                            <label className="text-sm flex-1 min-w-0 truncate text-muted-foreground">{m.name}</label>
                            <span className="text-sm font-mono w-32 text-right">{calcValue.toFixed(2)} {m.unit}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button onClick={handleSubmit} disabled={submitMutation.isPending} className="w-full">
                  <Send className="w-4 h-4 mr-2" /> {submitMutation.isPending ? "A submeter..." : "Submeter KPIs"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
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
