import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileBarChart, ChevronRight, ChevronLeft, Check, Download, Eye, Loader2 } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, ImageRun } from "docx";
import { saveAs } from "file-saver";

// Wizard steps
const STEPS = [
  { id: 1, labelKey: "Projetos", descKey: "Selecionar projeto(s)" },
  { id: 2, labelKey: "Período", descKey: "Definir semanas do relatório" },
  { id: 3, labelKey: "Medidas", descKey: "Compilar e selecionar evidências" },
  { id: 4, labelKey: "Pré-visualização", descKey: "Rever e gerar Word" },
];

export default function RDCD() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { projects } = useProject();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "pm";

  const [step, setStep] = useState(1);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [startWeek, setStartWeek] = useState("");
  const [endWeek, setEndWeek] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [includePlans, setIncludePlans] = useState(true);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const [measureSelections, setMeasureSelections] = useState<Record<number, { status: string; selectedWeeks: string[]; notes: string }>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch submissions for selected projects and period
  const { data: allSubmissions, isLoading: loadingSubs } = trpc.submissions.listAll.useQuery(undefined, { enabled: step >= 3 });
  const { data: sections } = trpc.sections.list.useQuery(undefined, { enabled: step >= 3 });
  const { data: measures } = trpc.measures.list.useQuery(undefined, { enabled: step >= 3 });
  const { data: plans } = trpc.monitoringPlans.list.useQuery(undefined, { enabled: step >= 2 && includePlans });

  // Filter submissions by selected projects and period
  const filteredSubmissions = useMemo(() => {
    if (!allSubmissions || !startWeek || !endWeek) return [];
    return allSubmissions.filter((s: any) => {
      if (selectedProjects.length > 0 && !selectedProjects.includes(s.projectId)) return false;
      const weekKey = `${s.weekYear}-W${String(s.weekNumber).padStart(2, "0")}`;
      return weekKey >= startWeek && weekKey <= endWeek && s.status === "approved";
    });
  }, [allSubmissions, selectedProjects, startWeek, endWeek]);

  // Fetch actual measure responses for filtered submissions
  const submissionIds = useMemo(() => filteredSubmissions.map((s: any) => s.id), [filteredSubmissions]);
  const { data: allResponses, isLoading: loadingResponses } = trpc.responses.getBySubmissions.useQuery(
    { submissionIds },
    { enabled: submissionIds.length > 0 && step >= 3 }
  );

  // Compile measures with real response data
  const compiledMeasures = useMemo(() => {
    if (!measures || !filteredSubmissions.length || !allResponses) return [];
    
    // Build a map: measureId -> array of responses with status
    const responseMap: Record<number, Array<{ submissionId: number; status: string; observations: string | null; week: number; year: number; companyId: number }>> = {};
    
    for (const resp of allResponses as any[]) {
      if (!responseMap[resp.measureId]) responseMap[resp.measureId] = [];
      // Find the submission to get week/year/company
      const sub = filteredSubmissions.find((s: any) => s.id === resp.submissionId);
      if (sub) {
        responseMap[resp.measureId].push({
          submissionId: resp.submissionId,
          status: resp.status,
          observations: resp.observations,
          week: (sub as any).weekNumber,
          year: (sub as any).weekYear,
          companyId: (sub as any).companyId,
        });
      }
    }

    return measures.map((m: any) => {
      const responses = responseMap[m.id] || [];
      const statuses = responses.map(r => r.status).filter(Boolean);
      
      // Determine dominant status
      const allNA = statuses.length > 0 && statuses.every(s => s === "NA");
      const hasNC = statuses.some(s => s === "NC");
      const allConform = statuses.length > 0 && statuses.every(s => s === "C" || s === "I");
      let autoStatus = "pending";
      if (statuses.length === 0) autoStatus = "no_data";
      else if (allNA) autoStatus = "na";
      else if (hasNC) autoStatus = "nc";
      else if (allConform) autoStatus = "conform";
      else autoStatus = "partial";
      
      return {
        ...m,
        responses,
        autoStatus,
        totalResponses: responses.length,
        conformCount: statuses.filter(s => s === "C" || s === "I").length,
        ncCount: statuses.filter(s => s === "NC").length,
        naCount: statuses.filter(s => s === "NA").length,
        latestObservation: responses.find(r => r.observations)?.observations || "",
      };
    });
  }, [measures, filteredSubmissions, allResponses]);

  // Group compiled measures by section
  const measuresBySection = useMemo(() => {
    if (!sections || !compiledMeasures.length) return [];
    return sections.map((sec: any) => ({
      ...sec,
      measures: compiledMeasures.filter(m => m.sectionId === sec.id),
    })).filter(s => s.measures.length > 0);
  }, [sections, compiledMeasures]);

  // Available projects (exclude operation-only)
  const availableProjects = projects.filter(p => p.code !== "SIN01");

  // Year options
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  function toggleProject(id: number) {
    setSelectedProjects(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  function selectAllProjects() {
    setSelectedProjects(availableProjects.map(p => p.id));
  }

  // Week date formatter
  function getWeekDates(year: number, week: number) {
    const jan4 = new Date(year, 0, 4);
    const dow = jan4.getDay() || 7;
    const mon = new Date(jan4);
    mon.setDate(jan4.getDate() - dow + 1 + (week - 1) * 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmt = (d: Date) => `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}`;
    return { mon, sun, label: `S${week} — ${fmt(mon)} a ${fmt(sun)}` };
  }

  async function generateWord() {
    setIsGenerating(true);
    try {
      const projNames = selectedProjects.length > 0
        ? projects.filter(p => selectedProjects.includes(p.id)).map(p => `${p.code} — ${p.name}`).join(", ")
        : "Todos os projetos";

      // Build measure rows for the table - only measures with data
      const measuresWithData = compiledMeasures.filter(m => m.totalResponses > 0);
      const measureRows = measuresWithData.map(m => {
        const sel = measureSelections[m.id];
        const status = sel?.status || m.autoStatus;
        const statusText = status === "na" ? "N.A." : status === "conform" ? "Cumprido" : status === "nc" ? "Não Conforme" : status === "partial" ? "Parcialmente Cumprido" : "Em curso";
        const notes = sel?.notes || m.latestObservation || "";
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.number || `${m.id}`, size: 20 })] })], width: { size: 8, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (m.description || "").substring(0, 200), size: 18 })] })], width: { size: 32, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: notes.substring(0, 300), size: 18 })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Fichas S${startWeek.split("-W")[1]} a S${endWeek.split("-W")[1]}`, size: 18 })] })], width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: statusText, bold: true, size: 20, color: status === "conform" ? "008000" : status === "nc" ? "FF0000" : "000000" })] })], width: { size: 15, type: WidthType.PERCENTAGE } }),
          ],
        });
      });

      // Build selected plans content
      const selectedPlans = (plans || []).filter((p: any) => selectedPlanIds.includes(p.id));

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: "RDCD — Relatório de Demonstração de Cumprimento da DCAPE", heading: HeadingLevel.TITLE }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "Projeto: ", bold: true }), new TextRun({ text: projNames })] }),
            new Paragraph({ children: [new TextRun({ text: "Período: ", bold: true }), new TextRun({ text: `Semana ${startWeek.split("-W")[1]} a Semana ${endWeek.split("-W")[1]} de ${selectedYear}` })] }),
            new Paragraph({ children: [new TextRun({ text: "Data de emissão: ", bold: true }), new TextRun({ text: new Date().toLocaleDateString("pt-PT") })] }),
            new Paragraph({ children: [new TextRun({ text: "Fichas analisadas: ", bold: true }), new TextRun({ text: `${filteredSubmissions.length} fichas aprovadas` })] }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "1. Introdução", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "O presente relatório visa demonstrar o cumprimento das condições ambientais definidas na DCAPE, para o período indicado. Este documento compila as evidências recolhidas nas fichas de controlo semanais submetidas pelas entidades executantes e verificadas pela RAA." }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "2. Descrição sumária do projeto", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "[A preencher — descrição do projeto e componentes]" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "3. Ponto de situação do desenvolvimento do projeto", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "[A preencher — atividades realizadas no período]" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "4. Demonstração do cumprimento das condições ambientais", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: `Total de medidas analisadas: ${measuresWithData.length}. Fichas aprovadas no período: ${filteredSubmissions.length}.` }),
            new Paragraph({ text: `Resumo: ${compiledMeasures.filter(m => m.autoStatus === "conform").length} conformes, ${compiledMeasures.filter(m => m.autoStatus === "nc").length} não conformes, ${compiledMeasures.filter(m => m.autoStatus === "na").length} N/A.` }),
            new Paragraph({ text: "" }),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "N.º", bold: true, size: 20 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Descrição da Medida", bold: true, size: 20 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Modo de Implementação / Observações", bold: true, size: 20 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Evidências", bold: true, size: 20 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Estado", bold: true, size: 20 })] })] }),
                  ],
                }),
                ...measureRows,
              ],
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "5. Resposta a anteriores pareceres", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "[A preencher / Não aplicável]" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "6. Monitorização", heading: HeadingLevel.HEADING_1 }),
            ...(includePlans && selectedPlans.length > 0 ? [
              new Paragraph({ text: `Planos de monitorização incluídos: ${selectedPlans.length}` }),
              ...selectedPlans.map((p: any) => new Paragraph({ text: `• ${p.name} — Periodicidade: ${p.periodicity || "—"} — Estado: ${p.submissionStatus === "delivered" ? "Entregue" : p.submissionStatus === "submitted" ? "Submetido" : "Pendente"}` })),
            ] : [new Paragraph({ text: "[Não incluído neste relatório]" })]),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "7. Auditorias de Pós-Avaliação", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "[A preencher / Não aplicável]" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "8. Reclamações associadas ao projeto", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "[Sem reclamações no período em análise]" }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const filename = `RDCD_${projNames.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_S${startWeek.split("-W")[1]}-S${endWeek.split("-W")[1]}_${selectedYear}.docx`;
      saveAs(blob, filename);
      toast.success(t("RDCD gerado com sucesso!"));
    } catch (err: any) {
      toast.error(t("Erro ao gerar RDCD") + ": " + err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  if (!isAdminOrDono) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-muted-foreground">{t("Acesso restrito a Admin e Dono de Obra.")}</p>
        </div>
      </AppLayout>
    );
  }

  const statusColors: Record<string, string> = {
    conform: "bg-green-100 text-green-800 border-green-200",
    nc: "bg-red-100 text-red-800 border-red-200",
    na: "bg-muted text-foreground border-border",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    partial: "bg-blue-100 text-blue-800 border-blue-200",
    no_data: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const statusLabels: Record<string, string> = {
    conform: "Cumprido",
    nc: "Não Conforme",
    na: "N.A.",
    pending: "Em curso",
    partial: "Parcial",
    no_data: "Sem dados",
  };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBarChart className="w-6 h-6" />{t("RDCD — Relatório de Demonstração de Cumprimento")}</h1>
          <p className="text-muted-foreground text-sm">{t("Compilar fichas semanais e gerar o relatório semestral para a APA")}</p>
        </div>

        {/* Wizard Steps */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${step === s.id ? "bg-primary text-primary-foreground" : step > s.id ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
                {step > s.id ? <Check className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold">{s.id}</span>}
                <span className="font-medium">{t(s.labelKey)}</span>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1: Project Selection */}
        {step === 1 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">{t("Selecionar Projeto(s)")}</h2>
              <p className="text-sm text-muted-foreground mb-4">{t("Escolha os projetos a incluir neste RDCD. Pode selecionar um, vários ou todos.")}</p>
              <div className="flex gap-2 mb-4">
                <Button size="sm" variant="outline" onClick={selectAllProjects}>{t("Selecionar Todos")}</Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedProjects([])}>{t("Limpar")}</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableProjects.map(p => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedProjects.includes(p.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                    onClick={() => toggleProject(p.id)}
                  >
                    <Checkbox checked={selectedProjects.includes(p.id)} />
                    <div>
                      <p className="font-medium text-sm">{p.code}</p>
                      <p className="text-xs text-muted-foreground">{p.name}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={() => { if (selectedProjects.length === 0) { toast.error(t("Selecione pelo menos um projeto")); return; } setStep(2); }}>
                  {t("Seguinte")} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Period Definition */}
        {step === 2 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">{t("Definir Período")}</h2>
              <p className="text-sm text-muted-foreground mb-4">{t("Indique o intervalo de semanas a incluir no RDCD (tipicamente ~26 semanas / 6 meses).")}</p>
              
              {/* Year selector */}
              <div className="mb-4">
                <label className="text-sm font-medium">{t("Ano")}</label>
                <div className="flex gap-2 mt-1">
                  {yearOptions.map(y => (
                    <Button key={y} size="sm" variant={selectedYear === y ? "default" : "outline"} onClick={() => { setSelectedYear(y); setStartWeek(""); setEndWeek(""); }}>
                      {y}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium">{t("Semana de início")}</label>
                  <select className="w-full h-9 border rounded-md px-3 text-sm mt-1 bg-background" value={startWeek} onChange={e => setStartWeek(e.target.value)}>
                    <option value="">{t("Selecionar semana")}...</option>
                    {Array.from({length: 53}, (_, i) => i + 1).map(w => {
                      const { label } = getWeekDates(selectedYear, w);
                      return <option key={w} value={`${selectedYear}-W${w.toString().padStart(2,"0")}`}>{label}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">{t("Semana de fim")}</label>
                  <select className="w-full h-9 border rounded-md px-3 text-sm mt-1 bg-background" value={endWeek} onChange={e => setEndWeek(e.target.value)}>
                    <option value="">{t("Selecionar semana")}...</option>
                    {Array.from({length: 53}, (_, i) => i + 1).map(w => {
                      const { label } = getWeekDates(selectedYear, w);
                      return <option key={w} value={`${selectedYear}-W${w.toString().padStart(2,"0")}`}>{label}</option>;
                    })}
                  </select>
                </div>
              </div>
              {startWeek && endWeek && (
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="text-sm">
                    <span className="font-medium">{t("Período selecionado:")}</span> {t("Semana")} {startWeek.split("-W")[1]} {t("a")} {t("Semana")} {endWeek.split("-W")[1]} {t("de")} {selectedYear}
                    {(() => {
                      const w1 = parseInt(startWeek.split("-W")[1]);
                      const w2 = parseInt(endWeek.split("-W")[1]);
                      const totalWeeks = w2 - w1 + 1;
                      return <span className="ml-2 text-muted-foreground">({totalWeeks} {t("semanas")})</span>;
                    })()}
                  </p>
                </div>
              )}
              {/* Plans section */}
              <div className="border rounded-lg p-4 mb-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={includePlans} onCheckedChange={(v) => setIncludePlans(!!v)} id="include-plans" />
                  <label htmlFor="include-plans" className="text-sm font-medium cursor-pointer">{t("Incluir Planos de Monitorização no RDCD")}</label>
                </div>
                {includePlans && plans && plans.length > 0 && (
                  <div className="ml-6 space-y-1.5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">{t("Selecione os planos a incluir:")}</p>
                      <button className="text-[10px] text-blue-600 hover:underline" onClick={() => setSelectedPlanIds(selectedPlanIds.length === plans.length ? [] : plans.map((p: any) => p.id))}>
                        {selectedPlanIds.length === plans.length ? t("Desselecionar todos") : t("Selecionar todos")}
                      </button>
                    </div>
                    {plans.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={selectedPlanIds.includes(p.id)}
                          onCheckedChange={(v) => setSelectedPlanIds(v ? [...selectedPlanIds, p.id] : selectedPlanIds.filter(id => id !== p.id))}
                        />
                        <span className={`w-2 h-2 rounded-full ${p.submissionStatus === "delivered" ? "bg-green-500" : p.submissionStatus === "submitted" ? "bg-blue-500" : "bg-amber-500"}`} />
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">— {p.periodicity || "—"}</span>
                        <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${p.submissionStatus === "delivered" ? "bg-green-100 text-green-700" : p.submissionStatus === "submitted" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                          {p.submissionStatus === "delivered" ? t("Entregue") : p.submissionStatus === "submitted" ? t("Submetido") : t("Pendente")}
                        </span>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      {selectedPlanIds.length} {t("de")} {plans.length} {t("planos selecionados para o RDCD.")}
                    </p>
                  </div>
                )}
                {includePlans && (!plans || plans.length === 0) && (
                  <p className="ml-6 text-xs text-muted-foreground">{t("Nenhum plano encontrado. Crie planos na tab Planos.")}</p>
                )}
              </div>
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t("Anterior")}
                </Button>
                <Button onClick={() => { if (!startWeek || !endWeek) { toast.error(t("Defina o período")); return; } setStep(3); }}>
                  {t("Seguinte")} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Measure Compilation */}
        {step === 3 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">{t("Compilação de Medidas")}</h2>
              {(loadingSubs || loadingResponses) ? (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm text-muted-foreground">{t("A carregar dados das fichas semanais...")}</span>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("O sistema analisou")} {filteredSubmissions.length} {t("fichas aprovadas no período.")} {t("Reveja o estado de cada medida.")}
                  </p>
                  {/* Summary */}
                  <div className="grid grid-cols-5 gap-3 mb-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{compiledMeasures.filter(m => m.autoStatus === "conform").length}</p>
                      <p className="text-xs text-green-600">{t("Conforme")}</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-red-700">{compiledMeasures.filter(m => m.autoStatus === "nc").length}</p>
                      <p className="text-xs text-red-600">{t("Não Conforme")}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-blue-700">{compiledMeasures.filter(m => m.autoStatus === "partial").length}</p>
                      <p className="text-xs text-blue-600">{t("Parcial")}</p>
                    </div>
                    <div className="bg-muted border border-border rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{compiledMeasures.filter(m => m.autoStatus === "na").length}</p>
                      <p className="text-xs text-muted-foreground">{t("N/A")}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-500">{compiledMeasures.filter(m => m.autoStatus === "no_data").length}</p>
                      <p className="text-xs text-gray-500">{t("Sem dados")}</p>
                    </div>
                  </div>
                  {/* Measures grouped by section */}
                  <div className="max-h-[500px] overflow-y-auto space-y-4">
                    {measuresBySection.map(sec => (
                      <div key={sec.id}>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 sticky top-0 bg-background py-1 border-b">
                          {sec.name}
                        </h3>
                        <div className="space-y-1.5">
                          {sec.measures.filter((m: any) => m.totalResponses > 0).map((m: any) => (
                            <div key={m.id} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{t("Medida")} {m.number}: {(m.description || "").substring(0, 100)}{(m.description || "").length > 100 ? "..." : ""}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {m.totalResponses} {t("respostas")} · {m.conformCount} {t("conformes")} · {m.ncCount} NC · {m.naCount} NA
                                    {m.latestObservation && <span className="ml-2 italic">— {m.latestObservation.substring(0, 60)}...</span>}
                                  </p>
                                </div>
                                <Badge className={`ml-2 text-[10px] ${statusColors[m.autoStatus] || ""}`}>
                                  {statusLabels[m.autoStatus] || m.autoStatus}
                                </Badge>
                              </div>
                              {(m.autoStatus === "conform" || m.autoStatus === "partial") && m.responses.length > 0 && (
                                <div className="mt-2 pl-3 border-l-2 border-green-200">
                                  <p className="text-xs text-muted-foreground mb-1">{t("Selecione semanas a incluir como evidência:")}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {m.responses.slice(0, 10).map((r: any, i: number) => {
                                      const weekKey = `${r.year}-W${r.week}`;
                                      const sel = measureSelections[m.id];
                                      const isSelected = sel?.selectedWeeks?.includes(weekKey);
                                      return (
                                        <button
                                          key={i}
                                          className={`px-2 py-0.5 rounded text-[10px] border ${isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:border-primary"}`}
                                          onClick={() => {
                                            const current = measureSelections[m.id] || { status: m.autoStatus, selectedWeeks: [], notes: "" };
                                            const weeks = current.selectedWeeks.includes(weekKey)
                                              ? current.selectedWeeks.filter((w: string) => w !== weekKey)
                                              : [...current.selectedWeeks, weekKey];
                                            setMeasureSelections(prev => ({ ...prev, [m.id]: { ...current, selectedWeeks: weeks } }));
                                          }}
                                        >
                                          S{r.week} [{r.status}] {r.observations ? "📝" : ""}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {sec.measures.filter((m: any) => m.totalResponses > 0).length === 0 && (
                            <p className="text-xs text-muted-foreground italic pl-2">{t("Sem dados nesta secção para o período selecionado.")}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredSubmissions.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">{t("Nenhuma ficha aprovada encontrada no período selecionado. Verifique os projetos e semanas escolhidos.")}</p>
                    )}
                  </div>
                </>
              )}
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t("Anterior")}
                </Button>
                <Button onClick={() => setStep(4)}>{t("Pré-visualizar")}<Eye className="w-4 h-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Preview & Generate */}
        {step === 4 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">{t("Pré-visualização do RDCD")}</h2>
              <p className="text-sm text-muted-foreground mb-4">{t("Reveja o resumo antes de gerar o documento Word.")}</p>
              
              <div className="border rounded-lg p-4 space-y-4 bg-muted/20 mb-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">{t("Projetos")}</p>
                  <p className="text-sm">{projects.filter(p => selectedProjects.includes(p.id)).map(p => `${p.code} — ${p.name}`).join(", ")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">{t("Período")}</p>
                  <p className="text-sm">{t("Semana")} {startWeek.split("-W")[1]} {t("a")} {t("Semana")} {endWeek.split("-W")[1]} {t("de")} {selectedYear}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">{t("Fichas analisadas")}</p>
                  <p className="text-sm">{filteredSubmissions.length} {t("fichas aprovadas")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">{t("Medidas no relatório")}</p>
                  <p className="text-sm">
                    {compiledMeasures.filter(m => m.totalResponses > 0).length} {t("medidas")} ·
                    <span className="text-green-600 ml-1">{compiledMeasures.filter(m => m.autoStatus === "conform").length} {t("conformes")}</span> ·
                    <span className="text-red-600 ml-1">{compiledMeasures.filter(m => m.autoStatus === "nc").length} NC</span> ·
                    <span className="text-blue-600 ml-1">{compiledMeasures.filter(m => m.autoStatus === "partial").length} {t("parciais")}</span> ·
                    <span className="text-muted-foreground ml-1">{compiledMeasures.filter(m => m.autoStatus === "na").length} N/A</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">{t("Planos de Monitorização")}</p>
                  <p className="text-sm">{includePlans ? `${t("Incluídos")} (${selectedPlanIds.length} ${t("de")} ${plans?.length || 0} ${t("planos")})` : t("Não incluídos")}</p>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t("Anterior")}
                </Button>
                <Button onClick={generateWord} disabled={isGenerating} className="gap-2">
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isGenerating ? t("A gerar...") : t("Gerar RDCD (.docx)")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
