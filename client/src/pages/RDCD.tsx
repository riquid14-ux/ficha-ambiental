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
import { FileBarChart, ChevronRight, ChevronLeft, Check, Download, Eye } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";

// Wizard steps
const STEPS = [
  { id: 1, label: "Projetos", desc: "Selecionar projeto(s)" },
  { id: 2, label: "Período", desc: "Definir semanas do relatório" },
  { id: 3, label: "Medidas", desc: "Compilar e selecionar evidências" },
  { id: 4, label: "Pré-visualização", desc: "Rever e gerar Word" },
];

export default function RDCD() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { projects } = useProject();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";

  const [step, setStep] = useState(1);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [startWeek, setStartWeek] = useState("");
  const [endWeek, setEndWeek] = useState("");
  const [includePlans, setIncludePlans] = useState(true);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const [measureSelections, setMeasureSelections] = useState<Record<number, { status: string; selectedWeeks: string[]; notes: string }>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch submissions for selected projects and period
  const { data: allSubmissions } = trpc.submissions.listAll.useQuery(undefined, { enabled: step >= 3 });
  const { data: sections } = trpc.sections.list.useQuery(undefined, { enabled: step >= 3 });
  const { data: measures } = trpc.measures.list.useQuery(undefined, { enabled: step >= 3 });
  const { data: plans } = trpc.monitoringPlans.list.useQuery(undefined, { enabled: step >= 3 && includePlans });

  // Filter submissions by selected projects and period
  const filteredSubmissions = useMemo(() => {
    if (!allSubmissions || !startWeek || !endWeek) return [];
    return allSubmissions.filter((s: any) => {
      if (selectedProjects.length > 0 && !selectedProjects.includes(s.projectId)) return false;
      const weekKey = `${s.weekYear}-W${String(s.weekNumber).padStart(2, "0")}`;
      return weekKey >= startWeek && weekKey <= endWeek && s.status === "approved";
    });
  }, [allSubmissions, selectedProjects, startWeek, endWeek]);

  // Compile measures: for each measure, determine dominant status across all submissions in period
  const compiledMeasures = useMemo(() => {
    if (!measures || !filteredSubmissions.length) return [];
    return measures.map((m: any) => {
      // Find all responses for this measure across filtered submissions
      const responses: any[] = filteredSubmissions.map((sub: any) => ({
        submissionId: sub.id,
        week: sub.weekNumber,
        year: sub.weekYear,
        companyId: sub.companyId,
      }));
      // Determine dominant status
      const statuses = responses.map(r => r.status).filter(Boolean);
      const allNA = statuses.length > 0 && statuses.every(s => s === "na");
      const hasNC = statuses.some(s => s === "nc");
      const allConform = statuses.length > 0 && statuses.every(s => s === "c" || s === "i");
      let autoStatus = "pending";
      if (allNA) autoStatus = "na";
      else if (hasNC) autoStatus = "nc";
      else if (allConform) autoStatus = "conform";
      
      return {
        ...m,
        responses,
        autoStatus,
        totalResponses: responses.length,
        conformCount: statuses.filter(s => s === "c" || s === "i").length,
        ncCount: statuses.filter(s => s === "nc").length,
        naCount: statuses.filter(s => s === "na").length,
      };
    });
  }, [measures, filteredSubmissions]);

  // Available projects (exclude operation-only)
  const availableProjects = projects.filter(p => p.code !== "SIN01");

  function toggleProject(id: number) {
    setSelectedProjects(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  function selectAllProjects() {
    setSelectedProjects(availableProjects.map(p => p.id));
  }

  async function generateWord() {
    setIsGenerating(true);
    try {
      const projNames = selectedProjects.length > 0
        ? projects.filter(p => selectedProjects.includes(p.id)).map(p => `${p.code} — ${p.name}`).join(", ")
        : "Todos os projetos";

      // Build measure rows for the table
      const measureRows = compiledMeasures
        .filter(m => m.totalResponses > 0 || measureSelections[m.id])
        .map(m => {
          const sel = measureSelections[m.id];
          const status = sel?.status || m.autoStatus;
          const statusText = status === "na" ? "N.A." : status === "conform" ? "Cumprido" : status === "nc" ? "Não Conforme" : "Em curso";
          const notes = sel?.notes || (m.responses.length > 0 ? m.responses[0].observation || "" : "");
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Medida ${m.id}`, size: 20 })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.text || "", size: 20 })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: notes, size: 20 })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Ver fichas S${startWeek} a S${endWeek}`, size: 20 })] })], width: { size: 15, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: statusText, bold: true, size: 20 })] })], width: { size: 15, type: WidthType.PERCENTAGE } }),
            ],
          });
        });

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: "RDCD — Relatório de Demonstração de Cumprimento da DCAPE", heading: HeadingLevel.TITLE }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "Projeto: ", bold: true }), new TextRun({ text: projNames })] }),
            new Paragraph({ children: [new TextRun({ text: "Período: ", bold: true }), new TextRun({ text: `${startWeek} a ${endWeek}` })] }),
            new Paragraph({ children: [new TextRun({ text: "Data de emissão: ", bold: true }), new TextRun({ text: new Date().toLocaleDateString("pt-PT") })] }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "1. Introdução", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "O presente relatório visa demonstrar o cumprimento das condições ambientais definidas na DCAPE, para o período indicado." }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "2. Descrição sumária do projeto", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "[A preencher — descrição do projeto e componentes]" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "3. Ponto de situação do desenvolvimento do projeto", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "[A preencher — atividades realizadas no período]" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "4. Demonstração do cumprimento das condições ambientais", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: `Total de medidas analisadas: ${compiledMeasures.filter(m => m.totalResponses > 0).length}. Período: ${startWeek} a ${endWeek}.` }),
            new Paragraph({ text: "" }),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "N.º Medida", bold: true, size: 20 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Descrição", bold: true, size: 20 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Modo de implementação", bold: true, size: 20 })] })] }),
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
            ...(includePlans && plans ? [
              new Paragraph({ text: `Planos de monitorização em curso: ${plans.length}` }),
              ...plans.map((p: any) => new Paragraph({ text: `• ${p.name} — Periodicidade: ${p.periodicity || "—"} — Último reporting: ${p.lastReportingDate ? new Date(p.lastReportingDate).toLocaleDateString("pt-PT") : "—"} — Estado: ${p.submissionStatus === "delivered" ? "Entregue" : p.submissionStatus === "submitted" ? "Submetido" : "Pendente"}` })),
              new Paragraph({ text: "" }),
              new Paragraph({ children: [new TextRun({ text: "Planos a entregar em anexo ao presente RDCD:", bold: true })] }),
              ...plans.filter((p: any) => p.submissionStatus === "submitted" || p.submissionStatus === "delivered").map((p: any) => new Paragraph({ text: `  — ${p.name} (${p.submissionStatus === "delivered" ? "entregue à entidade competente" : "submetido na plataforma"})` })),
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
      const filename = `RDCD_${projNames.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${startWeek}_${endWeek}.docx`;
      saveAs(blob, filename);
      toast.success("RDCD gerado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar RDCD: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  if (!isAdminOrDono) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Acesso restrito a Admin e Dono de Obra.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBarChart className="w-6 h-6" />
            RDCD — Relatório de Demonstração de Cumprimento
          </h1>
          <p className="text-muted-foreground text-sm">
            Compilar fichas semanais e gerar o relatório semestral para a APA
          </p>
        </div>

        {/* Wizard Steps */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${step === s.id ? "bg-primary text-primary-foreground" : step > s.id ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
                {step > s.id ? <Check className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold">{s.id}</span>}
                <span className="font-medium">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1: Project Selection */}
        {step === 1 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">Selecionar Projeto(s)</h2>
              <p className="text-sm text-muted-foreground mb-4">Escolha os projetos a incluir neste RDCD. Pode selecionar um, vários ou todos.</p>
              <div className="flex gap-2 mb-4">
                <Button size="sm" variant="outline" onClick={selectAllProjects}>Selecionar Todos</Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedProjects([])}>{t("Limpar")}< /Button>
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
                <Button onClick={() => { if (selectedProjects.length === 0) { toast.error("Selecione pelo menos um projeto"); return; } setStep(2); }}>
                  Seguinte <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Period Definition */}
        {step === 2 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">{t("Definir Período")}< /h2>
              <p className="text-sm text-muted-foreground mb-4">Indique o intervalo de semanas a incluir no RDCD (tipicamente ~26 semanas / 6 meses).</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium">Semana de início</label>
                  <input type="week" className="w-full h-9 border rounded-md px-3 text-sm mt-1" value={startWeek} onChange={e => setStartWeek(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Semana de fim</label>
                  <input type="week" className="w-full h-9 border rounded-md px-3 text-sm mt-1" value={endWeek} onChange={e => setEndWeek(e.target.value)} />
                </div>
              </div>
              {startWeek && endWeek && (
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="text-sm">
                    <span className="font-medium">Período selecionado:</span> {startWeek} a {endWeek}
                    {(() => {
                      const [y1, w1] = startWeek.split("-W").map(Number);
                      const [y2, w2] = endWeek.split("-W").map(Number);
                      const totalWeeks = (y2 - y1) * 52 + (w2 - w1) + 1;
                      return <span className="ml-2 text-muted-foreground">({totalWeeks} semanas)</span>;
                    })()}
                  </p>
                </div>
              )}
              {/* Plans section */}
              <div className="border rounded-lg p-4 mb-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={includePlans} onCheckedChange={(v) => setIncludePlans(!!v)} id="include-plans" />
                  <label htmlFor="include-plans" className="text-sm font-medium cursor-pointer">Incluir Planos de Monitorização no RDCD</label>
                </div>
                {includePlans && plans && plans.length > 0 && (
                  <div className="ml-6 space-y-1.5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Selecione os planos a incluir:</p>
                      <button className="text-[10px] text-blue-600 hover:underline" onClick={() => setSelectedPlanIds(selectedPlanIds.length === plans.length ? [] : plans.map((p: any) => p.id))}>
                        {selectedPlanIds.length === plans.length ? "Desselecionar todos" : "Selecionar todos"}
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
                          {p.submissionStatus === "delivered" ? "Entregue" : p.submissionStatus === "submitted" ? "Submetido" : "Pendente"}
                        </span>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      {selectedPlanIds.length} de {plans.length} planos selecionados para o RDCD.
                    </p>
                  </div>
                )}
                {includePlans && (!plans || plans.length === 0) && (
                  <p className="ml-6 text-xs text-muted-foreground">Nenhum plano encontrado. Crie planos na tab "Planos".</p>
                )}
              </div>
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <Button onClick={() => { if (!startWeek || !endWeek) { toast.error("Defina o período"); return; } setStep(3); }}>
                  Seguinte <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Measure Compilation */}
        {step === 3 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">{t("Compilação de Medidas")}< /h2>
              <p className="text-sm text-muted-foreground mb-4">
                O sistema analisou {filteredSubmissions.length} fichas aprovadas no período. Reveja o estado de cada medida e selecione as evidências a incluir.
              </p>
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-green-700">{compiledMeasures.filter(m => m.autoStatus === "conform").length}</p>
                  <p className="text-xs text-green-600">{t("Conforme")}< /p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-red-700">{compiledMeasures.filter(m => m.autoStatus === "nc").length}</p>
                  <p className="text-xs text-red-600">{t("Não Conforme")}< /p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-gray-700">{compiledMeasures.filter(m => m.autoStatus === "na").length}</p>
                  <p className="text-xs text-gray-600">N/A</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-amber-700">{compiledMeasures.filter(m => m.autoStatus === "pending").length}</p>
                  <p className="text-xs text-amber-600">Sem dados</p>
                </div>
              </div>
              {/* Measures list */}
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {compiledMeasures.filter(m => m.totalResponses > 0).map(m => {
                  const sel = measureSelections[m.id];
                  const statusColors: Record<string, string> = {
                    conform: "bg-green-100 text-green-800 border-green-200",
                    nc: "bg-red-100 text-red-800 border-red-200",
                    na: "bg-gray-100 text-gray-800 border-gray-200",
                    pending: "bg-amber-100 text-amber-800 border-amber-200",
                  };
                  const statusLabels: Record<string, string> = {
                    conform: "Cumprido",
                    nc: "Não Conforme",
                    na: "N.A.",
                    pending: "Em curso",
                  };
                  return (
                    <div key={m.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">Medida {m.id}: {m.text?.substring(0, 80)}...</p>
                          <p className="text-xs text-muted-foreground">{m.totalResponses} respostas · {m.conformCount} conformes · {m.ncCount} NC · {m.naCount} NA</p>
                        </div>
                        <Badge className={`ml-2 text-[10px] ${statusColors[m.autoStatus] || ""}`}>
                          {statusLabels[m.autoStatus] || m.autoStatus}
                        </Badge>
                      </div>
                      {m.autoStatus === "conform" && m.responses.length > 0 && (
                        <div className="mt-2 pl-3 border-l-2 border-green-200">
                          <p className="text-xs text-muted-foreground mb-1">Selecione semanas a incluir como evidência:</p>
                          <div className="flex flex-wrap gap-1">
                            {m.responses.slice(0, 10).map((r: any, i: number) => {
                              const weekKey = `${r.year}-W${r.week}`;
                              const isSelected = sel?.selectedWeeks?.includes(weekKey);
                              return (
                                <button
                                  key={i}
                                  className={`px-2 py-0.5 rounded text-[10px] border ${isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:border-primary"}`}
                                  onClick={() => {
                                    const current = measureSelections[m.id] || { status: m.autoStatus, selectedWeeks: [], notes: "" };
                                    const weeks = current.selectedWeeks.includes(weekKey)
                                      ? current.selectedWeeks.filter(w => w !== weekKey)
                                      : [...current.selectedWeeks, weekKey];
                                    setMeasureSelections(prev => ({ ...prev, [m.id]: { ...current, selectedWeeks: weeks } }));
                                  }}
                                >
                                  S{r.week}/{r.year} {r.observation ? "📝" : ""} {r.companyName ? `(${r.companyName})` : ""}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {compiledMeasures.filter(m => m.totalResponses > 0).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ficha aprovada encontrada no período selecionado. Verifique os projetos e semanas escolhidos.</p>
                )}
              </div>
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <Button onClick={() => setStep(4)}>
                  Pré-visualizar <Eye className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Preview & Generate */}
        {step === 4 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">Pré-visualização do RDCD</h2>
              <p className="text-sm text-muted-foreground mb-4">Reveja o resumo antes de gerar o documento Word.</p>
              
              <div className="border rounded-lg p-4 space-y-4 bg-muted/20 mb-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">Projetos</p>
                  <p className="text-sm">{projects.filter(p => selectedProjects.includes(p.id)).map(p => p.code).join(", ")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">Período</p>
                  <p className="text-sm">{startWeek} a {endWeek}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">{t("Fichas analisadas")}< /p>
                  <p className="text-sm">{filteredSubmissions.length} fichas aprovadas</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">{t("Medidas no relatório")}< /p>
                  <p className="text-sm">
                    {compiledMeasures.filter(m => m.totalResponses > 0).length} medidas ·
                    <span className="text-green-600 ml-1">{compiledMeasures.filter(m => m.autoStatus === "conform").length} conformes</span> ·
                    <span className="text-red-600 ml-1">{compiledMeasures.filter(m => m.autoStatus === "nc").length} NC</span> ·
                    <span className="text-gray-600 ml-1">{compiledMeasures.filter(m => m.autoStatus === "na").length} N/A</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">{t("Planos de Monitorização")}< /p>
                  <p className="text-sm">{includePlans ? `Incluídos (${selectedPlanIds.length} de ${plans?.length || 0} planos)` : "Não incluídos"}</p>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <Button onClick={generateWord} disabled={isGenerating} className="gap-2">
                  <Download className="w-4 h-4" />
                  {isGenerating ? "A gerar..." : "Gerar RDCD (.docx)"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
