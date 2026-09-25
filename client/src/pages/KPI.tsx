import AppLayout from "@/components/AppLayout";
import { StandPageHeader } from "@/components/stand/StandPageHeader";
import { StandMetricCard } from "@/components/stand/StandMetricCard";
import { StandStatusBadge } from "@/components/stand/StandStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { useState, useMemo, useEffect, useRef } from "react";
import { Settings, Download, Send, Droplets, Fuel, Zap, AlertTriangle, Plus, Pencil, Trash2, CheckCircle, XCircle, Target, BarChart3, Users, Car, Leaf, TrendingUp, TrendingDown, Activity, Save, Upload, FileSpreadsheet, History } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { describeKpiValue, splitWaterMetrics } from "@/lib/kpi-context";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
const CAT_LABELS: Record<string, string> = { workforce: "Mão de Obra", transport: "Transporte", fuel: "Combustível", generators: "Geradores", energy: "Energia", water: "Água", emissions: "Emissões", air_noise: "Qualidade do Ar e Ruído", incidents: "Incidentes", other: "Outros" };
const CAT_ICONS: Record<string, string> = { workforce: "👷", transport: "🚗", fuel: "⛽", generators: "🔌", energy: "⚡", water: "💧", emissions: "🌿", air_noise: "🔊", incidents: "⚠️", other: "📋" };

export default function KPI() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
  const [activeTab, setActiveTab] = useState("overview");
  const [showSettings, setShowSettings] = useState(false);
  const [formWeek, setFormWeek] = useState(String(getISOWeek(new Date())));
  const [formYear, setFormYear] = useState(String(new Date().getFullYear()));
  const [formValues, setFormValues] = useState<Record<number, string>>({});
  const [formStep, setFormStep] = useState(0);
  const [selectedContributionCompanyId, setSelectedContributionCompanyId] = useState<number | null>(null);
  const [editingSubmittedValues, setEditingSubmittedValues] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [importMode, setImportMode] = useState<"draft" | "submit">("draft");
  const importInputRef = useRef<HTMLInputElement>(null);
  const [editingMetric, setEditingMetric] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [reportStartWeek, setReportStartWeek] = useState("1");
  const [reportEndWeek, setReportEndWeek] = useState(String(getISOWeek(new Date())));
  const [dashPage, setDashPage] = useState(0);
  
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [editingTarget, setEditingTarget] = useState<any>(null);

  const projectId = activeProject?.id || 0;
  const isPartner = user?.role === "ee_partner";
  const metricsQuery = trpc.kpi.metrics.useQuery();
  const matrixQuery = trpc.kpi.matrix.useQuery({ projectId }, { enabled: projectId > 0 });
  const editableCompaniesQuery = trpc.kpi.editableCompanies.useQuery({ projectId }, { enabled: projectId > 0 });
  const editableCompanies = (editableCompaniesQuery.data || []) as any[];
  const effectiveCompanyId = selectedContributionCompanyId || user?.companyId || 0;
  const currentSubmissionQuery = trpc.kpi.draft.useQuery({ projectId, companyId: effectiveCompanyId, weekNumber: Number(formWeek), weekYear: Number(formYear) }, { enabled: projectId > 0 && effectiveCompanyId > 0 });
  const allValuesQuery = trpc.kpi.allValues.useQuery({ projectId, weekYear: selectedYear, startWeek: Number(reportStartWeek), endWeek: Number(reportEndWeek) }, { enabled: projectId > 0 && Number(reportStartWeek) <= Number(reportEndWeek) });
  const targetsQuery = trpc.kpi.targets.useQuery({ projectId, year: targetYear }, { enabled: projectId > 0 });
  const companiesQuery = trpc.companies.list.useQuery(undefined, { enabled: !isPartner });
  const partnerAccessQuery = trpc.partners.myAccess.useQuery(undefined, { enabled: isPartner });
  const refreshKpiViews = () => { matrixQuery.refetch(); allValuesQuery.refetch(); currentSubmissionQuery.refetch(); };
  const saveDraftMutation = trpc.kpi.saveDraft.useMutation({ onSuccess: () => { setDraftStatus("saved"); refreshKpiViews(); }, onError: () => setIsFormDirty(true) });
  const submitMutation = trpc.kpi.submit.useMutation({ onSuccess: () => { toast.success(isPartner ? "Contributo KPI parcial submetido à EE principal." : "KPIs submetidos com sucesso!"); setEditingSubmittedValues(false); setDraftStatus("idle"); refreshKpiViews(); } });
  const correctMutation = trpc.kpi.correct.useMutation({ onSuccess: () => { toast.success("Correção KPI registada no histórico da semana."); setEditingSubmittedValues(false); refreshKpiViews(); } });
  const importExcelMutation = trpc.kpi.importExcel.useMutation({ onSuccess: (result) => { toast.success(`${result.importedWeeks} ${result.importedWeeks === 1 ? "semana importada" : "semanas importadas"} como ${result.mode === "draft" ? "rascunho" : "submissão"}.`); refreshKpiViews(); if (importInputRef.current) importInputRef.current.value = ""; } });
  const upsertMetricMutation = trpc.kpi.upsertMetric.useMutation({ onSuccess: () => { metricsQuery.refetch(); setEditingMetric(null); toast.success(t("Métrica guardada.")); } });
  const deleteMetricMutation = trpc.kpi.deleteMetric.useMutation({ onSuccess: () => { metricsQuery.refetch(); toast.success(t("Métrica removida.")); } });
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
  const existingSubmission = currentSubmissionQuery.data as any;
  const isAdminOrDO = user?.role === "admin" || user?.role === "dono_obra";
  const selectedContribution = editableCompanies.find(company => company.id === effectiveCompanyId);
  const submittingCompanyName = useMemo(() => selectedContribution?.shortName || (isPartner ? partnerAccessQuery.data?.companyName || "empresa parceira" : companies.find(company => company.id === user?.companyId)?.shortName || undefined), [companies, isPartner, partnerAccessQuery.data?.companyName, selectedContribution?.shortName, user?.companyId]);
  const waterMetricGroups = useMemo(() => splitWaterMetrics(manualMetrics), [manualMetrics]);

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
    for (const s of matrixData) {
      if (!comps.has(s.companyId)) comps.set(s.companyId, `${s.shortName || s.companyName}${s.sourceType === "ee_partner" ? " · Parceiro" : ""}`);
    }
    if (!isPartner) for (const c of companies) { if ((c.companyType === "ee" || c.companyType === "ee_partner" || c.companyType === "rap") && !comps.has(c.id)) comps.set(c.id, c.shortName); }
    return Array.from(comps.entries());
  }, [matrixData, companies, isPartner]);

  const findMetric = (cat: string, name: string) => metrics.find((m: any) => m.category === cat && m.name.toLowerCase().includes(name.toLowerCase()));

  useEffect(() => {
    if (selectedContributionCompanyId) return;
    if (user?.companyId) { setSelectedContributionCompanyId(user.companyId); return; }
    if (editableCompanies[0]) setSelectedContributionCompanyId(editableCompanies[0].id);
  }, [editableCompanies, selectedContributionCompanyId, user?.companyId]);

  useEffect(() => {
    const submission = currentSubmissionQuery.data as any;
    if (currentSubmissionQuery.isLoading) return;
    if (!submission) { setFormValues({}); setEditingSubmittedValues(false); setDraftStatus("idle"); setIsFormDirty(false); return; }
    setFormValues(Object.fromEntries((submission.values || []).map((row: any) => [row.metricId, row.value])));
    setEditingSubmittedValues(false);
    setDraftStatus(submission.status === "draft" ? "saved" : "idle");
    setIsFormDirty(false);
  }, [currentSubmissionQuery.data, currentSubmissionQuery.isLoading, effectiveCompanyId, formWeek, formYear]);

  const getFormPayload = () => manualMetrics.map((metric: any) => ({ metricId: metric.id, value: String(formValues[metric.id] || "") }));
  const hasAnyFormValue = () => getFormPayload().some(({ value }) => value.trim() !== "");
  const saveDraft = (silent = false) => {
    if (!effectiveCompanyId || !projectId) return;
    const values = getFormPayload();
    if (!hasAnyFormValue()) return;
    setDraftStatus("saving");
    setIsFormDirty(false);
    saveDraftMutation.mutate({ projectId, companyId: effectiveCompanyId, weekNumber: Number(formWeek), weekYear: Number(formYear), values, completeWeekSnapshot: true }, { onError: error => { setDraftStatus("idle"); if (!silent) toast.error(error.message); } });
  };
  const handleSubmit = () => {
    if (!effectiveCompanyId || !projectId) { toast.error("Verifique a empresa selecionada e o projeto."); return; }
    const values = getFormPayload();
    if (!hasAnyFormValue()) { toast.error("Preencha pelo menos um campo."); return; }
    const input = { projectId, companyId: effectiveCompanyId, weekNumber: Number(formWeek), weekYear: Number(formYear), values, completeWeekSnapshot: true };
    if (currentSubmissionQuery.data && (currentSubmissionQuery.data as any).status !== "draft") correctMutation.mutate(input);
    else submitMutation.mutate(input);
  };

  useEffect(() => {
    const submission = currentSubmissionQuery.data as any;
    if (!isFormDirty || (submission && submission.status !== "draft") || Object.keys(formValues).length === 0 || saveDraftMutation.isPending) return;
    const timer = window.setTimeout(() => saveDraft(true), 1000);
    return () => window.clearTimeout(timer);
  }, [formValues]);

  const downloadKpiImportTemplate = () => {
    if (Number(reportStartWeek) > Number(reportEndWeek)) return toast.error("A semana inicial não pode ser posterior à semana final.");
    import("exceljs").then(async (ExcelJS) => {
      const workbook = new ExcelJS.Workbook(); workbook.creator = "Plataforma de Gestão Ambiental — Start Campus";
      const sheet = workbook.addWorksheet("Importar KPI");
      const weeks = Array.from({ length: Number(reportEndWeek) - Number(reportStartWeek) + 1 }, (_, index) => Number(reportStartWeek) + index);
      const headers = ["ID da métrica", "Métrica", "Unidade", ...weeks.map(week => `Semana ${week}`)];
      sheet.columns = [{ width: 15 }, { width: 42 }, { width: 14 }, ...weeks.map(() => ({ width: 15 }))];
      sheet.mergeCells(1, 1, 1, headers.length); sheet.getCell("A1").value = "MODELO DE IMPORTAÇÃO KPI"; sheet.getCell("A1").font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } }; sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
      sheet.mergeCells(2, 1, 2, headers.length); sheet.getCell("A2").value = `Projeto: ${activeProject?.code || "—"} · Ano: ${selectedYear} — preencha apenas as colunas Semana. Não altere o ID da métrica.`; sheet.getCell("A2").font = { italic: true, color: { argb: "FF475569" } };
      const rows = manualMetrics.map((metric: any) => [metric.id, metric.name, metric.unit, ...weeks.map(() => "")]);
      sheet.addTable({ name: "ImportarKPI", ref: "A4", headerRow: true, style: { theme: "TableStyleMedium4", showRowStripes: true }, columns: headers.map(name => ({ name })), rows });
      sheet.views = [{ state: "frozen", ySplit: 4 }];
      const buffer = await workbook.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `Modelo_Importacao_KPI_${activeProject?.code}_S${reportStartWeek}-S${reportEndWeek}_${selectedYear}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
    }).catch(() => toast.error("Não foi possível gerar o modelo Excel."));
  };

  const importKpiExcel = (file?: File) => {
    if (!file || !effectiveCompanyId) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 10 * 1024 * 1024) return toast.error("Importe um ficheiro .xlsx até 10 MB.");
    const reader = new FileReader();
    reader.onload = () => { const dataUrl = String(reader.result || ""); const data = dataUrl.split(",")[1]; if (!data) return toast.error("Não foi possível ler o ficheiro Excel."); importExcelMutation.mutate({ projectId, companyId: effectiveCompanyId, weekYear: selectedYear, mode: importMode, filename: file.name, data }); };
    reader.readAsDataURL(file);
  };

  const reportPeriodLabel = `S${reportStartWeek} a S${reportEndWeek} · ${selectedYear}`;
  const openNewMetric = (preset?: Partial<any>) => {
    const highestSortOrder = metrics.reduce((highest: number, metric: any) => Math.max(highest, Number(metric.sortOrder) || 0), 0);
    setEditingMetric({ name: "", unit: "N.º", target: "", category: "other", inputType: "manual", sortOrder: highestSortOrder + 1, ...preset });
  };
  const saveMetric = () => {
    const name = String(editingMetric?.name || "").trim();
    const unit = String(editingMetric?.unit || "").trim();
    if (name.length < 3 || !unit) return toast.error("Indique um nome com pelo menos 3 caracteres e a unidade da métrica.");
    upsertMetricMutation.mutate({ ...editingMetric, name, unit, target: String(editingMetric.target || "").trim() || undefined, sortOrder: Number(editingMetric.sortOrder) || 0 });
  };

  const handleExportExcel = () => {
    if (Number(reportStartWeek) > Number(reportEndWeek)) return toast.error("A semana inicial não pode ser posterior à semana final.");
    import("exceljs").then(async (ExcelJS) => {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Plataforma de Gestão Ambiental — Start Campus";
      wb.created = new Date();
      const ws = wb.addWorksheet("Resumo KPI");
      ws.columns = [{ width: 22 }, { width: 42 }, { width: 14 }, { width: 18 }, { width: 20 }];
      ws.mergeCells("A1:E1"); ws.getCell("A1").value = "RELATÓRIO DE KPI";
      ws.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } }; ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } }; ws.getCell("A1").alignment = { vertical: "middle" };
      ws.mergeCells("A2:E2"); ws.getCell("A2").value = `Projecto: ${activeProject?.code || "—"} — ${activeProject?.name || "—"}`;
      ws.mergeCells("A3:E3"); ws.getCell("A3").value = `Período: ${reportPeriodLabel} | Gerado em ${new Date().toLocaleDateString("pt-PT")}`;
      ws.getCell("A2").font = { bold: true, color: { argb: "FF065F46" } }; ws.getCell("A3").font = { italic: true, color: { argb: "FF475569" } };
      const metricRows = metrics.map((metric: any) => ({ category: CAT_LABELS[metric.category] || metric.category, name: metric.name, unit: metric.unit, total: Number((totals[metric.id] || 0).toFixed(2)), weeks: new Set(allValues.filter((value: any) => value.metricId === metric.id).map((value: any) => `${value.weekYear}-${value.weekNumber}`)).size }));
      ws.addTable({ name: "ResumoKPI", ref: "A5", headerRow: true, style: { theme: "TableStyleMedium4", showRowStripes: true }, columns: [{ name: "Categoria" }, { name: "Métrica" }, { name: "Unidade" }, { name: "Total" }, { name: "Semanas com dados" }], rows: metricRows.map(row => [row.category, row.name, row.unit, row.total, row.weeks]) });
      ws.views = [{ state: "frozen", ySplit: 5 }];
      const detail = wb.addWorksheet("Dados semanais");
      const reportWeeks = Array.from({ length: Number(reportEndWeek) - Number(reportStartWeek) + 1 }, (_, index) => Number(reportStartWeek) + index);
      const detailHeaders = ["Entidade", "Categoria", "Métrica", "Unidade", ...reportWeeks.map(week => `Semana ${week}`)];
      detail.columns = [{ width: 26 }, { width: 22 }, { width: 42 }, { width: 14 }, ...reportWeeks.map(() => ({ width: 15 }))];
      detail.mergeCells(1, 1, 1, detailHeaders.length); detail.getCell("A1").value = `DADOS SEMANAIS — ${activeProject?.code || "Projecto"} — ${reportPeriodLabel}`;
      detail.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }; detail.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
      const weeklyValues = new Map<string, Record<number, number>>();
      const detailMetadata = new Map<string, { companyName: string; metric: any }>();
      for (const value of allValues) {
        const metric = metrics.find((item: any) => item.id === value.metricId);
        const key = `${value.companyId}-${value.metricId}`;
        const values = weeklyValues.get(key) || {};
        values[value.weekNumber] = (values[value.weekNumber] || 0) + (Number(value.value) || 0);
        weeklyValues.set(key, values);
        detailMetadata.set(key, { companyName: value.companyName || "—", metric });
      }
      const detailRows = Array.from(weeklyValues.entries()).map(([key, values]) => {
        const metadata = detailMetadata.get(key)!;
        return [metadata.companyName, CAT_LABELS[metadata.metric?.category] || metadata.metric?.category || "—", metadata.metric?.name || `Métrica ${key.split("-")[1]}`, metadata.metric?.unit || "—", ...reportWeeks.map(week => values[week] ?? "")];
      }).sort((a: any[], b: any[]) => String(a[0]).localeCompare(String(b[0]), "pt") || String(a[1]).localeCompare(String(b[1]), "pt") || String(a[2]).localeCompare(String(b[2]), "pt"));
      if (detailRows.length) detail.addTable({ name: "DadosSemanaKPI", ref: "A3", headerRow: true, style: { theme: "TableStyleMedium2", showRowStripes: true }, columns: detailHeaders.map(name => ({ name })), rows: detailRows });
      else detail.getCell("A3").value = "Não existem valores KPI submetidos no período seleccionado.";
      detail.views = [{ state: "frozen", ySplit: 3 }];
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `Relatorio_KPI_${activeProject?.code}_S${reportStartWeek}-S${reportEndWeek}_${selectedYear}.xlsx`; a.click(); URL.revokeObjectURL(url);
    }).catch(() => {
      let csv = `Relatório KPI — ${activeProject?.code || "Projecto"}\nPeríodo;${reportPeriodLabel}\n\nCategoria;Métrica;Unidade;Total\n`;
      for (const m of metrics) { csv += `"${CAT_LABELS[m.category] || m.category}";"${m.name}";${m.unit};${(totals[m.id] || 0).toFixed(2)}\n`; }
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `Relatorio_KPI_${activeProject?.code}_S${reportStartWeek}-S${reportEndWeek}_${selectedYear}.csv`; a.click(); URL.revokeObjectURL(url);
    });
  };

  if (isAllProjects) return <AppLayout><div className="mx-auto max-w-xl px-4 py-10"><Card className="rounded-2xl border-border/80 bg-card shadow-sm"><CardContent className="p-6 text-center text-sm leading-6 text-muted-foreground">{t("Selecione um projeto individual para ver os KPI's.")}</CardContent></Card></div></AppLayout>;

  // Current category for step form
  const currentCat = categories[formStep] || categories[0];
  const currentCatMetrics = manualMetrics.filter((m: any) => m.category === currentCat);
  const standardWaterMetrics = currentCat === "water" ? waterMetricGroups.operational : currentCatMetrics;
  const affluentWaterMetrics = currentCat === "water" ? waterMetricGroups.affluent : [];
  const renderMetricCards = (metricList: any[]) => metricList.map((m: any) => {
    const hasValue = Boolean(formValues[m.id]);
    const isLocked = Boolean(currentSubmissionQuery.data && (currentSubmissionQuery.data as any).status !== "draft" && !editingSubmittedValues);
    const descriptionId = `kpi-metric-${m.id}-description`;
    return (
      <Card key={m.id} className={`group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 ${hasValue ? "border-primary/40 ring-1 ring-primary/10" : "border-border/80 hover:border-primary/30 hover:shadow-md"}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5 text-foreground">{m.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{CAT_LABELS[m.category] || m.category}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {hasValue && <StandStatusBadge label="Preenchido" tone="success" />}
              <Badge variant="outline" className="border-border bg-muted/40 px-2 py-1 text-xs font-semibold text-foreground">{m.unit}</Badge>
            </div>
          </div>
          <Input aria-label={`Valor para ${m.name} em ${m.unit}`} aria-describedby={descriptionId} type="number" step="any" disabled={isLocked} placeholder={`Valor em ${m.unit}`} value={formValues[m.id] || ""} onChange={e => { setFormValues({ ...formValues, [m.id]: e.target.value }); setIsFormDirty(true); }} className="h-11 rounded-xl border-border bg-background px-3 font-mono text-lg font-semibold tabular-nums shadow-inner focus-visible:ring-primary" />
          <p id={descriptionId} className="mt-3 text-xs leading-5 text-muted-foreground">{describeKpiValue(m, activeProject?.code, submittingCompanyName, formWeek, formYear)}</p>
          {m.target && m.target !== "N/A" && <p className="mt-2 text-xs font-medium text-muted-foreground">Meta indicativa: <span className="text-foreground">{m.target}</span></p>}
        </CardContent>
      </Card>
    );
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <StandPageHeader
          eyebrow="CONTROLO DE DESEMPENHO"
          title="KPI's"
          description={`Indicadores de sustentabilidade — ${activeProject?.name || "—"}`}
          context={activeProject?.code || activeProject?.name || "Projeto"}
          tone="operations"
          actions={<>
            <Button variant="secondary" size="sm" className="min-h-9 border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={handleExportExcel}><Download className="mr-1.5 h-4 w-4" /> Exportar dados</Button>
            <Button variant="secondary" size="sm" className="min-h-9 border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={downloadKpiImportTemplate}><FileSpreadsheet className="mr-1.5 h-4 w-4" /> Modelo Excel</Button>
            <Select value={importMode} onValueChange={value => setImportMode(value as "draft" | "submit")}><SelectTrigger aria-label="Modo de importação" className="h-9 w-40 border-white/15 bg-white/10 text-xs text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Importar rascunhos</SelectItem><SelectItem value="submit">Importar histórico</SelectItem></SelectContent></Select>
            <input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={event => importKpiExcel(event.target.files?.[0])} />
            <Button variant="secondary" size="sm" className="min-h-9 border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white" disabled={importExcelMutation.isPending || !effectiveCompanyId} onClick={() => importInputRef.current?.click()}><Upload className="mr-1.5 h-4 w-4" /> {importExcelMutation.isPending ? "A importar..." : "Importar Excel"}</Button>
            {user?.role === "admin" && <Button variant="secondary" size="sm" className="min-h-9 border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setShowSettings(!showSettings)}><Settings className="mr-1.5 h-4 w-4" /> {t("Definições")}</Button>}
          </>}
        />

        <section aria-labelledby="report-period-title" className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 max-w-md"><p className="stand-kicker text-primary">ÂMBITO DO RELATÓRIO</p><h2 id="report-period-title" className="mt-1 text-base font-semibold text-foreground">Período de análise e relatório</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Os dashboards e a exportação usam exactamente este intervalo.</p></div>
            <div className="flex flex-wrap items-end gap-3">
              <div><label htmlFor="kpi-report-year" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ano</label><Select value={String(selectedYear)} onValueChange={value => setSelectedYear(Number(value))}><SelectTrigger id="kpi-report-year" className="h-10 w-24 rounded-xl bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select></div>
              <div><label htmlFor="kpi-report-start-week" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Semana inicial</label><Select value={reportStartWeek} onValueChange={setReportStartWeek}><SelectTrigger id="kpi-report-start-week" className="h-10 w-32 rounded-xl bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 53 }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>Semana {index + 1}</SelectItem>)}</SelectContent></Select></div>
              <div><label htmlFor="kpi-report-end-week" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Semana final</label><Select value={reportEndWeek} onValueChange={setReportEndWeek}><SelectTrigger id="kpi-report-end-week" className="h-10 w-32 rounded-xl bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 53 }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>Semana {index + 1}</SelectItem>)}</SelectContent></Select></div>
              <StandStatusBadge label={reportPeriodLabel} tone="info" />
            </div>
          </div>
        </section>

        {isPartner && (
          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-4 dark:bg-emerald-500/10" aria-label="Contributo parcial de KPI">
            <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><Users className="h-4 w-4" /></div><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-foreground">Contributo parcial de KPI</p><StandStatusBadge label="Empresa parceira" tone="success" /></div><p className="mt-1 text-xs leading-5 text-muted-foreground">Está a submeter em nome de {partnerAccessQuery.data?.companyName || "empresa parceira"}. A EE {partnerAccessQuery.data?.parentCompanyName || "principal"} verá estes valores na matriz consolidada.</p></div></div>
          </section>
        )}

        <section aria-label="Resumo de indicadores" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="stand-kicker text-primary">LEITURA EXECUTIVA</p><h2 className="mt-1 text-base font-semibold text-foreground">Indicadores-chave do período</h2></div><p className="text-xs text-muted-foreground">{reportPeriodLabel}</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StandMetricCard label={t("Incidentes Ambientais")} value={totals[findMetric("incidents", "Incidentes Ambientais")?.id || 0] || 0} detail={reportPeriodLabel} icon={AlertTriangle} tone="danger" />
            <StandMetricCard label={t("Água Construção")} value={`${formatNumber(totals[findMetric("water", "Água de Construção")?.id || 0] || 0)} L`} detail={reportPeriodLabel} icon={Droplets} tone="info" />
            <StandMetricCard label={t("Combustível Total")} value={`${formatNumber(totals[findMetric("emissions", "Consumo Total")?.id || 0] || 0)} KgCO2e`} detail={reportPeriodLabel} icon={Fuel} tone="warning" />
            <StandMetricCard label={t("HVO")} value={`${formatNumber(totals[findMetric("emissions", "HVO")?.id || 0] || 0)} KgCO2e`} detail={reportPeriodLabel} icon={Leaf} tone="success" />
            <StandMetricCard label={t("Eletricidade")} value={`${formatNumber(totals[findMetric("energy", "Eletricidade")?.id || 0] || 0)} kWh`} detail={reportPeriodLabel} icon={Zap} tone="brand" />
          </div>
        </section>

        {/* Settings */}
        {showSettings && user?.role === "admin" && (
          <Card className="overflow-hidden rounded-2xl border-amber-500/25 bg-card shadow-sm">
            <CardHeader className="border-b border-amber-500/15 bg-amber-500/[0.055] pb-4"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-amber-950"><Settings className="h-4 w-4" /></span><CardTitle className="text-base">Configuração de métricas KPI</CardTitle></div><p className="pt-1 text-xs leading-5 text-muted-foreground">Crie métricas manuais como viaturas em obra, defina unidade, categoria, meta e posição. Todas as alterações ficam auditadas.</p></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-2 text-xs">
                {metrics.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border/70 bg-background px-2 py-1.5">
                    <span className="flex-1 truncate font-medium">{m.name}</span><Badge variant="outline" className="text-xs">{m.unit}</Badge>
                    <Button aria-label={`Editar ${m.name}`} variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingMetric(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button aria-label={`Remover ${m.name}`} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { if (confirm("Remover?")) deleteMetricMutation.mutate({ id: m.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2"><Button size="sm" className="min-h-9" onClick={() => openNewMetric()}><Plus className="mr-1.5 h-3.5 w-3.5" /> Nova métrica</Button><Button size="sm" variant="outline" className="min-h-9" onClick={() => openNewMetric({ name: "Viaturas em obra", unit: "N.º", category: "transport" })}><Car className="mr-1.5 h-3.5 w-3.5" /> Pré-preencher: Viaturas em obra</Button></div>
              {editingMetric && (
                <div className="space-y-3 rounded-xl border border-border/80 bg-background p-4 shadow-sm">
                  <div className="flex items-center justify-between"><p className="text-sm font-semibold">{editingMetric.id ? "Editar métrica" : "Nova métrica KPI"}</p><Badge variant="outline">{editingMetric.inputType === "calculated" ? "Calculada" : "Manual"}</Badge></div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <label className="space-y-1 text-xs font-medium">Nome da métrica<Input value={editingMetric.name} onChange={e => setEditingMetric({ ...editingMetric, name: e.target.value })} className="text-sm" /></label>
                    <label className="space-y-1 text-xs font-medium">Unidade<Input placeholder="Ex.: N.º, km, L, kWh" value={editingMetric.unit} onChange={e => setEditingMetric({ ...editingMetric, unit: e.target.value })} className="text-sm" /></label>
                    <label className="space-y-1 text-xs font-medium">Categoria<Select value={editingMetric.category} onValueChange={value => setEditingMetric({ ...editingMetric, category: value })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CAT_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></label>
                    <label className="space-y-1 text-xs font-medium">Tipo<Select value={editingMetric.inputType} onValueChange={value => setEditingMetric({ ...editingMetric, inputType: value, formulaType: value === "manual" ? undefined : editingMetric.formulaType })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Recolha manual</SelectItem><SelectItem value="calculated">Calculada</SelectItem></SelectContent></Select></label>
                    <label className="space-y-1 text-xs font-medium">Meta indicativa (opcional)<Input placeholder="Ex.: 10/mês" value={editingMetric.target || ""} onChange={e => setEditingMetric({ ...editingMetric, target: e.target.value })} className="text-sm" /></label>
                    <label className="space-y-1 text-xs font-medium">Ordem de apresentação<Input type="number" min="0" max="999" value={editingMetric.sortOrder ?? 0} onChange={e => setEditingMetric({ ...editingMetric, sortOrder: e.target.value })} className="text-sm" /></label>
                  </div>
                  {editingMetric.inputType === "calculated" && <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50/50 p-3 md:grid-cols-2 lg:grid-cols-4"><label className="space-y-1 text-xs font-medium">Fórmula<Select value={editingMetric.formulaType || ""} onValueChange={value => setEditingMetric({ ...editingMetric, formulaType: value })}><SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent><SelectItem value="fuel_to_co2">Combustível para CO₂</SelectItem><SelectItem value="sum_co2">Soma de CO₂</SelectItem></SelectContent></Select></label>{editingMetric.formulaType === "fuel_to_co2" && <label className="space-y-1 text-xs font-medium">Métrica de origem<Select value={editingMetric.formulaSourceMetricId ? String(editingMetric.formulaSourceMetricId) : ""} onValueChange={value => setEditingMetric({ ...editingMetric, formulaSourceMetricId: Number(value) })}><SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{manualMetrics.map((metric: any) => <SelectItem key={metric.id} value={String(metric.id)}>{metric.name}</SelectItem>)}</SelectContent></Select></label>}<label className="space-y-1 text-xs font-medium">PCI<Input value={editingMetric.pci || ""} onChange={e => setEditingMetric({ ...editingMetric, pci: e.target.value })} className="bg-background text-sm" /></label><label className="space-y-1 text-xs font-medium">Factor de emissão<Input value={editingMetric.emissionFactor || ""} onChange={e => setEditingMetric({ ...editingMetric, emissionFactor: e.target.value })} className="bg-background text-sm" /></label><label className="space-y-1 text-xs font-medium">Densidade<Input value={editingMetric.density || ""} onChange={e => setEditingMetric({ ...editingMetric, density: e.target.value })} className="bg-background text-sm" /></label></div>}
                  <div className="flex gap-2"><Button size="sm" className="min-h-9" onClick={saveMetric} disabled={upsertMetricMutation.isPending}>{upsertMetricMutation.isPending ? "A guardar..." : "Guardar métrica"}</Button><Button size="sm" variant="outline" className="min-h-9" onClick={() => setEditingMetric(null)}>Cancelar</Button></div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card p-1.5 shadow-sm">
            <TabsList className="h-auto min-w-max gap-1 bg-transparent p-0">
            <TabsTrigger value="overview" className="min-h-9 rounded-xl px-4 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">{t("Matriz")}</TabsTrigger>
            <TabsTrigger value="submit" className="min-h-9 rounded-xl px-4 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">{t("Submeter")}</TabsTrigger>
            {isAdminOrDO && <TabsTrigger value="dashboard" className="min-h-9 rounded-xl px-4 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">{t("Dashboard")}</TabsTrigger>}
            {user?.role === "admin" && <TabsTrigger value="metas" className="min-h-9 rounded-xl px-4 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">{t("Metas")}</TabsTrigger>}
            </TabsList>
          </div>

          {/* Matrix */}
          <TabsContent value="overview">
            <Card className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm"><CardHeader className="border-b border-border/70 bg-muted/20 pb-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="stand-kicker text-primary">COBERTURA DE REPORTE</p><CardTitle className="mt-1 text-base">{t("Matriz de Submissão")}</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">Acompanhe a entrega consolidada por empresa e semana de reporte.</p></div><StandStatusBadge label={`${matrixWeeks.length} semanas visíveis`} tone="info" /></div></CardHeader><CardContent className="p-0">
              {matrixQuery.isLoading ? <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Activity className="size-4 animate-spin" />A carregar submissões consolidadas...</div> : matrixQuery.isError ? <p className="py-4 text-center text-sm text-destructive">Não foi possível carregar a matriz de submissões.</p> : matrixWeeks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">{ t("Sem submissões.") }</p> : (
                <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><caption className="sr-only">{t("Matriz de Submissão")}</caption><thead className="bg-muted/35"><tr className="border-b border-border/70"><th scope="col" className="p-3 text-left font-semibold text-muted-foreground">{t("Empresa")}</th>{matrixWeeks.map(w => <th scope="col" key={`${w.weekYear}-${w.weekNumber}`} className="p-3 text-center font-semibold text-muted-foreground">S{w.weekNumber}</th>)}</tr></thead><tbody>{matrixCompanies.map(([id, name]) => (
                  <tr key={id} className="border-b border-border/60 transition-colors hover:bg-primary/[0.035]"><th scope="row" className="p-3 text-left font-semibold text-foreground">{name}</th>{matrixWeeks.map(w => { const s = matrixData.find((x: any) => x.companyId === id && x.weekNumber === w.weekNumber && x.weekYear === w.weekYear); return <td key={`${w.weekYear}-${w.weekNumber}`} className="p-3 text-center">{s ? <><CheckCircle aria-hidden className="mx-auto h-4 w-4 text-emerald-600" /><span className="sr-only">Submetido</span></> : <><XCircle aria-hidden className="mx-auto h-4 w-4 text-rose-300 dark:text-rose-500" /><span className="sr-only">Sem submissão</span></>}</td>; })}</tr>
                ))}</tbody></table></div>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* Submit - Card-based step form */}
          <TabsContent value="submit">
            <Card className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm">
              <CardHeader className="border-b border-border/70 bg-muted/20 pb-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div><p className="stand-kicker text-primary">RECOLHA SEMANAL</p><CardTitle className="mt-1 text-base">Submeter indicadores</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">Seleccione o período e a entidade antes de preencher os indicadores por categoria.</p></div>
                  <div className="flex flex-wrap items-end gap-3">
                  <div><label htmlFor="kpi-submit-week" className="mb-1.5 block text-xs font-semibold text-muted-foreground">{t("Semana")}</label><Select value={formWeek} onValueChange={setFormWeek}><SelectTrigger id="kpi-submit-week" className="h-10 w-32 rounded-xl bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 53 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Semana {i + 1}</SelectItem>)}</SelectContent></Select></div>
                  <div><label htmlFor="kpi-submit-year" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ano</label><Select value={formYear} onValueChange={setFormYear}><SelectTrigger id="kpi-submit-year" className="h-10 w-24 rounded-xl bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                  {editableCompanies.length > 1 && <div><label htmlFor="kpi-submit-company" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Contributo de</label><Select value={String(effectiveCompanyId)} onValueChange={value => setSelectedContributionCompanyId(Number(value))}><SelectTrigger id="kpi-submit-company" className="h-10 min-w-48 rounded-xl bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{editableCompanies.map(company => <SelectItem key={company.id} value={String(company.id)}>{company.shortName}{company.sourceType === "ee_partner" ? " · EEP" : " · EE"}</SelectItem>)}</SelectContent></Select></div>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5"><p className="text-xs text-muted-foreground">{t("Período:")} <strong className="font-semibold text-foreground">{weekPeriod}</strong></p><StandStatusBadge label={draftStatus === "saved" ? "Rascunho guardado" : draftStatus === "saving" ? "A guardar" : "Em edição"} tone={draftStatus === "saved" ? "success" : draftStatus === "saving" ? "warning" : "neutral"} /></div>
                {existingSubmission && <div className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><StandStatusBadge label={existingSubmission.status === "draft" ? "Rascunho retomado" : "KPI já submetido"} tone={existingSubmission.status === "draft" ? "warning" : "info"} /><span className="font-medium text-foreground">{submittingCompanyName} · S{existingSubmission.weekNumber}/{existingSubmission.weekYear}</span></div>{existingSubmission.status !== "draft" && !editingSubmittedValues && <Button size="sm" variant="outline" className="min-h-8" onClick={() => setEditingSubmittedValues(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Corrigir valores</Button>}</div>{existingSubmission.changes?.[0] && <p className="mt-2 flex items-center gap-1.5 leading-5 text-muted-foreground"><History className="h-3.5 w-3.5" />{existingSubmission.changes[0].summary}</p>}{editingSubmittedValues && <p className="mt-2 font-medium leading-5 text-foreground">Está a corrigir uma submissão. A alteração ficará anotada com o seu nome e semana.</p>}</div>}
              </CardHeader>
              <CardContent>
                {/* Step navigation */}
                <div className="flex gap-2 overflow-x-auto border-b border-border/70 pb-3">
                  {categories.map((cat, idx) => (
                    <Button key={cat} size="sm" variant={formStep === idx ? "default" : "outline"} onClick={() => setFormStep(idx)} className="min-h-9 whitespace-nowrap rounded-xl text-xs font-semibold">
                      {CAT_ICONS[cat]} {CAT_LABELS[cat] || cat}
                    </Button>
                  ))}
                </div>

                {/* Current category cards */}
                <div className="grid gap-3 md:grid-cols-2">{renderMetricCards(standardWaterMetrics)}</div>
                {affluentWaterMetrics.length > 0 && (
                  <section className="mt-6 rounded-2xl border border-sky-500/20 bg-sky-500/[0.045] p-4 dark:bg-sky-500/10">
                    <div className="mb-3 flex items-start gap-2"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white"><Droplets className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-foreground">Águas Afluentes</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Registe separadamente as águas residuais e operações associadas ao período seleccionado.</p></div></div>
                    <div className="grid gap-3 md:grid-cols-2">{renderMetricCards(affluentWaterMetrics)}</div>
                  </section>
                )}

                {/* Calculated values preview */}
                {formStep === categories.length - 1 && calculatedMetrics.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-4 dark:bg-emerald-500/10">
                    <div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white"><Activity className="h-3.5 w-3.5" /></span><p className="text-xs font-semibold text-foreground">{t("Valores Calculados Automaticamente")}</p></div>
                    {calculatedMetrics.map((m: any) => {
                      let cv = 0;
                      if (m.formulaType === "fuel_to_co2" && m.formulaSourceMetricId) cv = (parseFloat(formValues[m.formulaSourceMetricId] || "0")) * (parseFloat(m.density) || 0) * (parseFloat(m.pci) || 0) * (parseFloat(m.emissionFactor) || 0) / 1000;
                      else if (m.formulaType === "sum_co2") { for (const cm of calculatedMetrics) { if (cm.formulaType === "fuel_to_co2" && cm.formulaSourceMetricId) cv += (parseFloat(formValues[cm.formulaSourceMetricId] || "0")) * (parseFloat(cm.density) || 0) * (parseFloat(cm.pci) || 0) * (parseFloat(cm.emissionFactor) || 0) / 1000; } }
                      return <div key={m.id} className="flex items-center justify-between gap-3 border-t border-emerald-500/15 py-2 text-sm"><span className="text-muted-foreground">{m.name}</span><strong className="tabular-nums text-foreground">{cv.toFixed(1)} {m.unit}</strong></div>;
                    })}
                  </div>
                )}

                {/* Navigation + Submit */}
                <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-border/70 pt-4">
                  <Button variant="outline" className="min-h-10 rounded-xl" disabled={formStep === 0} onClick={() => setFormStep(formStep - 1)}>{t("← Anterior")}</Button>
                  <div className="flex flex-wrap gap-2">
                    {(existingSubmission?.status === "draft" || !existingSubmission) && <Button variant="outline" className="min-h-10 rounded-xl" onClick={() => saveDraft()} disabled={saveDraftMutation.isPending || !hasAnyFormValue()}><Save className="mr-2 h-4 w-4" />{draftStatus === "saving" ? "A guardar semana..." : draftStatus === "saved" ? "Semana guardada" : "Guardar todos os KPI da semana"}</Button>}
                    {formStep < categories.length - 1 ? (
                      <Button className="min-h-10 rounded-xl" onClick={() => setFormStep(formStep + 1)}>{t("Seguinte →")}</Button>
                    ) : (
                      <Button onClick={handleSubmit} disabled={submitMutation.isPending || correctMutation.isPending} className="min-h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700"><Send className="mr-2 h-4 w-4" />{submitMutation.isPending || correctMutation.isPending ? "A guardar..." : existingSubmission && existingSubmission.status !== "draft" ? "Registar correção" : isPartner ? "Submeter contributo parcial" : "Submeter KPIs"}</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dashboard (16 charts) */}
          {isAdminOrDO && (
            <TabsContent value="dashboard" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-sm"><div><p className="stand-kicker text-primary">ANÁLISE DE TENDÊNCIAS</p><p className="mt-1 text-sm font-semibold text-foreground">Dashboards do período</p></div><StandStatusBadge label={reportPeriodLabel} tone="info" /></div>
              <div className="flex flex-wrap gap-2 border-b border-border/70 pb-3">

                  {[t("Energia & CO2"), t("Água"), t("Trabalhadores"), t("Incidentes")].map((p, i) => (
                    <Button key={p} size="sm" variant={dashPage === i ? "default" : "outline"} onClick={() => setDashPage(i)} className="min-h-9 rounded-xl text-xs font-semibold">{p}</Button>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                {dashPage === 0 && <>
                <ChartCard title={t("Consumo Combustível (L)")}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="fuel" fill="#f59e0b" /></BarChart></ChartCard>
                <ChartCard title="Eletricidade (kWh)"><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Area type="monotone" dataKey="energy" fill="#a855f7" stroke="#7c3aed" fillOpacity={0.3} /></AreaChart></ChartCard>
                <ChartCard title={t("Repartição Emissões CO2")}><PieChart><Pie data={[{ name: "Diesel", value: totals[findMetric("emissions", "Diesel")?.id || 0] || 0 }, { name: "HVO", value: totals[findMetric("emissions", "HVO")?.id || 0] || 0 }]} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip /></PieChart></ChartCard>
                <ChartCard title="CO2 Acumulado"><AreaChart data={chartData.reduce((acc: any[], d: any, i: number) => { const prev = acc[i - 1]?.cumFuel || 0; acc.push({ ...d, cumFuel: prev + (d.fuel || 0) }); return acc; }, [])}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Area type="monotone" dataKey="cumFuel" fill="#f59e0b" stroke="#d97706" fillOpacity={0.2} /></AreaChart></ChartCard>
                </>}
                {dashPage === 1 && <>
                <ChartCard title={t("Consumo Água (L)")}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="water" fill="#3b82f6" /></BarChart></ChartCard>
                <ChartCard title={t("Água Acumulada")}><AreaChart data={chartData.reduce((acc: any[], d: any, i: number) => { const prev = acc[i - 1]?.cumWater || 0; acc.push({ ...d, cumWater: prev + (d.water || 0) }); return acc; }, [])}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Area type="monotone" dataKey="cumWater" fill="#3b82f6" stroke="#2563eb" fillOpacity={0.2} /></AreaChart></ChartCard>
                <ChartCard title={t("Repartição por Tipo de Água")}><PieChart><Pie data={waterMetricGroups.operational.filter((m: any) => (totals[m.id] || 0) > 0).map((m: any) => ({ name: m.name.replace("Água ", "").replace("de ", ""), value: totals[m.id] || 0 }))} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}>{COLORS.map((c, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ChartCard>
                <StandMetricCard label={t("Total Água Consumida")} value={`${formatNumber(Object.entries(totals).filter(([id]) => metrics.find((m: any) => m.id === Number(id) && m.category === "water")).reduce((s, [, v]) => s + v, 0))} L`} detail={reportPeriodLabel} icon={Droplets} tone="info" />
                {waterMetricGroups.affluent.length > 0 && <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.045] p-4 dark:bg-sky-500/10 md:col-span-2"><div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white"><Droplets className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-foreground">Águas Afluentes</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Indicadores registados separadamente do consumo de água.</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{waterMetricGroups.affluent.map((metric: any) => <div key={metric.id} className="rounded-xl border border-sky-500/15 bg-card p-3"><p className="text-xs text-muted-foreground">{metric.name}</p><p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatNumber(totals[metric.id] || 0)} <span className="text-xs font-medium text-muted-foreground">{metric.unit}</span></p></div>)}</div></div>}
                </>}
                {dashPage === 2 && <>
                <ChartCard title="Trabalhadores em Obra"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Line type="monotone" dataKey="workforce" stroke="#8b5cf6" strokeWidth={2} /></LineChart></ChartCard>
                <ChartCard title="Trabalhadores vs Horas"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="workforce" stroke="#8b5cf6" name={t("Trabalhadores")} /><Line type="monotone" dataKey={`m_${findMetric("workforce", "horas")?.id || 0}`} stroke="#06b6d4" name={t("Horas")} /></LineChart></ChartCard>
                <ChartCard title="Transporte"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="transport" fill="#06b6d4" /></BarChart></ChartCard>
                <StandMetricCard label={t("Técnicos Ambiente / Total Trabalhadores")} value={(() => { const tec = totals[findMetric('workforce', 'Técnicos')?.id || 0] || 0; const total = totals[findMetric('workforce', 'Trabalhadores em projeto')?.id || 0] || 1; return tec + ' / ' + total; })()} detail={`Rácio: ${(() => { const tec = totals[findMetric('workforce', 'Técnicos')?.id || 0] || 0; const total = totals[findMetric('workforce', 'Trabalhadores em projeto')?.id || 0] || 1; return ((tec / Math.max(total, 1)) * 100).toFixed(1); })()}%`} icon={Users} tone="brand" />
                </>}
                {dashPage === 3 && <>
                <div className="grid grid-cols-2 gap-3">
                  <ChartCard title="Incidentes Ambientais"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="incidents" fill="#ef4444" /></BarChart></ChartCard>
                  <StandMetricCard label="Total Incidentes" value={totals[findMetric("incidents", "Incidentes Ambientais")?.id || 0] || 0} detail={reportPeriodLabel} icon={AlertTriangle} tone="danger" />
                  <StandMetricCard label={t("Derrames")} value={totals[findMetric("incidents", "derrames")?.id || 0] || 0} detail={reportPeriodLabel} icon={Activity} tone="warning" />
                  <StandMetricCard label="Semanas com Dados" value={chartData.filter(d => Object.values(d).some(v => typeof v === "number" && v > 0)).length} detail={reportPeriodLabel} icon={Activity} tone="success" />
                </div>
                <Card className="mt-3 overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm"><CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div><p className="stand-kicker text-primary">OCORRÊNCIAS</p><p className="mt-1 text-sm font-semibold">{t("Registo de Incidentes")}</p></div>
                    {isAdminOrDO && <Button size="sm" variant="outline" className="min-h-9 rounded-xl" onClick={() => setShowIncidentForm(!showIncidentForm)}>{t("+ Adicionar")}</Button>}
                  </div>
                  {showIncidentForm && isAdminOrDO && (
                    <div className="mb-4 grid gap-2 rounded-xl border border-border/70 bg-muted/25 p-3 sm:grid-cols-2 xl:grid-cols-5">
                      <Input placeholder={t("Nome do incidente")} value={incidentForm.name} onChange={e => setIncidentForm({...incidentForm, name: e.target.value})} />
                      <Input type="date" value={incidentForm.date} onChange={e => setIncidentForm({...incidentForm, date: e.target.value})} />
                      <select aria-label="Estado do incidente" className="h-10 rounded-xl border border-input bg-background px-3 text-sm" value={incidentForm.status} onChange={e => setIncidentForm({...incidentForm, status: e.target.value})}>
                        <option value="aberto">{t("Aberto")}</option><option value="em_investigacao">{t("Em Investigação")}</option><option value="resolvido">{t("Resolvido")}</option><option value="encerrado">{t("Encerrado")}</option>
                      </select>
                      <select aria-label="Grau do incidente" className="h-10 rounded-xl border border-input bg-background px-3 text-sm" value={incidentForm.severity} onChange={e => setIncidentForm({...incidentForm, severity: e.target.value})}>
                        <option value="baixo">{t("Baixo")}</option><option value="medio">{t("Médio")}</option><option value="alto">{t("Alto")}</option><option value="critico">{t("Crítico")}</option>
                      </select>
                      <div className="flex gap-1">
                        <Input placeholder="Link (opcional)" value={incidentForm.link} onChange={e => setIncidentForm({...incidentForm, link: e.target.value})} className="flex-1" />
                        <Button aria-label="Guardar incidente" size="sm" className="min-h-10 rounded-xl" onClick={() => { if (incidentForm.name && incidentForm.date && activeProject) { createIncidentMut.mutate({ projectId: activeProject.id, ...incidentForm, link: incidentForm.link || undefined }); setIncidentForm({ name: "", date: "", status: "aberto", severity: "baixo", link: "" }); setShowIncidentForm(false); } }}>✓</Button>
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-xs"><caption className="sr-only">{t("Registo de Incidentes")}</caption>
                      <thead className="bg-muted/35"><tr className="border-b border-border/70"><th scope="col" className="p-3 text-left font-semibold text-muted-foreground">Incidente</th><th scope="col" className="p-3 font-semibold text-muted-foreground">{t("Data")}</th><th scope="col" className="p-3 font-semibold text-muted-foreground">Status</th><th scope="col" className="p-3 font-semibold text-muted-foreground">{t("Grau")}</th><th scope="col" className="p-3 font-semibold text-muted-foreground">Link</th>{isAdminOrDO && <th scope="col" className="p-3"><span className="sr-only">Ações</span></th>}</tr></thead>
                      <tbody>
                        {(incidentsQuery.data || []).map((inc: any) => (
                          <tr key={inc.id} className="border-b border-border/60 transition-colors hover:bg-primary/[0.035]">
                            <th scope="row" className="p-3 text-left font-semibold text-foreground">{inc.name}</th>
                            <td className="p-3 text-center text-muted-foreground">{inc.date}</td>
                            <td className="p-3 text-center"><StandStatusBadge label={inc.status} tone={inc.status === "resolvido" || inc.status === "encerrado" ? "success" : inc.status === "em_investigacao" ? "warning" : "danger"} /></td>
                            <td className="p-3 text-center"><StandStatusBadge label={inc.severity} tone={inc.severity === "critico" ? "danger" : inc.severity === "alto" || inc.severity === "medio" ? "warning" : "neutral"} /></td>
                            <td className="p-3 text-center">{inc.link ? <a href={inc.link} target="_blank" rel="noopener" className="font-medium text-primary underline-offset-4 hover:underline">{t("Ver")}</a> : "—"}</td>
                            {isAdminOrDO && <td className="p-3"><Button aria-label={`Eliminar incidente ${inc.name}`} size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => deleteIncidentMut.mutate({ id: inc.id })}><Trash2 className="h-3.5 w-3.5" /></Button></td>}
                          </tr>
                        ))}
                        {(!incidentsQuery.data || incidentsQuery.data.length === 0) && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{ t("Sem incidentes registados") }</td></tr>}
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
              <section className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                <div><p className="stand-kicker text-primary">GOVERNAÇÃO DE DESEMPENHO</p><h2 className="mt-1 text-base font-semibold text-foreground">Metas e limites</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Defina e acompanhe objetivos mensais ou anuais para cada indicador.</p></div>
                <div className="flex items-end gap-2"><div><label htmlFor="kpi-target-year" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ano</label><Select value={String(targetYear)} onValueChange={v => setTargetYear(Number(v))}><SelectTrigger id="kpi-target-year" className="h-10 w-24 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{[2024, 2025, 2026, 2027, 2028].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                <Button size="sm" className="min-h-10 rounded-xl" onClick={() => setEditingTarget({ metricId: metrics[0]?.id || 1, projectId, targetType: "monthly", targetValue: "", targetDirection: "max", year: targetYear })}><Plus className="mr-1.5 h-3.5 w-3.5" /> {t("Nova Meta")}</Button></div>
              </section>
              {editingTarget && (
                <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/[0.045] shadow-sm dark:bg-emerald-500/10"><CardContent className="space-y-3 p-4 sm:p-5">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Select value={String(editingTarget.metricId)} onValueChange={v => setEditingTarget({ ...editingTarget, metricId: Number(v) })}><SelectTrigger aria-label={t("Métrica")} className="h-10 rounded-xl text-sm"><SelectValue placeholder={t("Métrica")} /></SelectTrigger><SelectContent>{metrics.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent></Select>
                    <Input aria-label="Valor da meta" placeholder="Valor" value={editingTarget.targetValue} onChange={e => setEditingTarget({ ...editingTarget, targetValue: e.target.value })} className="h-10 rounded-xl text-sm" />
                    <Select value={editingTarget.targetDirection} onValueChange={v => setEditingTarget({ ...editingTarget, targetDirection: v })}><SelectTrigger aria-label="Direção da meta" className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="max">{t("Não exceder")}</SelectItem><SelectItem value="min">Atingir</SelectItem></SelectContent></Select>
                    <Select value={editingTarget.targetType} onValueChange={v => setEditingTarget({ ...editingTarget, targetType: v })}><SelectTrigger aria-label="Periodicidade da meta" className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">{t("Mensal")}</SelectItem><SelectItem value="annual">{t("Anual")}</SelectItem></SelectContent></Select>
                  </div>
                  <div className="flex gap-2"><Button size="sm" className="min-h-9 rounded-xl" onClick={() => upsertTargetMutation.mutate(editingTarget)}>{t("Guardar")}</Button><Button size="sm" variant="outline" className="min-h-9 rounded-xl" onClick={() => setEditingTarget(null)}>{t("Cancelar")}</Button></div>
                </CardContent></Card>
              )}
              {targets.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Sem metas para {targetYear}.</p> : targets.map((t: any) => {
                const metric = metrics.find((m: any) => m.id === t.metricId);
                const current = totals[t.metricId] || 0;
                const target = parseFloat(t.targetValue) || 0;
                const progress = target > 0 ? (current / target) * 100 : 0;
                const isGood = t.targetDirection === "max" ? current <= target : current >= target;
                return (
                  <Card key={t.id} className={`overflow-hidden rounded-2xl border shadow-sm ${isGood ? "border-emerald-500/25 bg-emerald-500/[0.025] dark:bg-emerald-500/10" : "border-rose-500/25 bg-rose-500/[0.025] dark:bg-rose-500/10"}`}><CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                    <div className="min-w-[13rem] flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-foreground">{metric?.name || "—"}</p><StandStatusBadge label={isGood ? "Dentro da meta" : "Requer atenção"} tone={isGood ? "success" : "danger"} /></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{t.targetType === "monthly" ? "Mensal" : "Anual"} • {t.targetDirection === "max" ? "Não exceder" : "Atingir"} {t.targetValue} {metric?.unit}</p></div>
                    <div className="min-w-24 text-right"><p className="text-lg font-bold tabular-nums text-foreground">{formatNumber(current)}</p><p className="text-xs text-muted-foreground">de {t.targetValue}</p></div>
                    <div className="w-28"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${isGood ? "bg-emerald-600" : "bg-rose-600"}`} style={{ width: `${Math.min(progress, 100)}%` }} /></div><p className="mt-1 text-center text-xs font-medium text-muted-foreground">{progress.toFixed(0)}%</p></div>
                    <Button aria-label={`Eliminar meta ${metric?.name || ""}`} variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => { if (confirm("Eliminar?")) deleteTargetMutation.mutate({ id: t.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
  return <Card className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm"><CardHeader className="border-b border-border/60 bg-muted/20 px-4 pb-3 pt-4"><CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle></CardHeader><CardContent className={`${h} px-3 pb-3 pt-4`}><ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer></CardContent></Card>;
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
