import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useBrandImage } from "@/hooks/useBrandImage";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StandPageHeader } from "@/components/stand/StandPageHeader";
import { StandStatusBadge } from "@/components/stand/StandStatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileBarChart, ChevronRight, ChevronLeft, Check, Download, Eye, Loader2, Save, FileText, Database } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, ImageRun } from "docx";
import { saveAs } from "file-saver";
import { buildRdcdNonConformityRows, buildRdcdPhaseRows, buildRdcdWeeklyRows, RDCD_BRAND_PROFILES, SIN02_RDCD_METADATA, type RdcdBrandProfileId } from "@/lib/rdcd-template";

// Wizard steps
const STEPS = [
  { id: 1, labelKey: "Projeto", descKey: "Selecionar projeto" },
  { id: 2, labelKey: "Período", descKey: "Definir semanas do relatório" },
  { id: 3, labelKey: "Fichas", descKey: "Compilar medidas e evidências" },
  { id: 4, labelKey: "Conteúdo", descKey: "Completar capítulos do relatório" },
  { id: 5, labelKey: "Revisão", descKey: "Rever e gerar Word" },
];

type RdcdContent = {
  introduction: string;
  projectStatus: string;
  correctiveActions: string;
  openIssues: string;
  worksProgramme: string;
  publicContacts: string;
  conclusions: string;
};

type MeasureSelection = { selectedWeeks: string[]; selectedImageUrls: string[]; notes: string };

const EMPTY_CONTENT: RdcdContent = {
  introduction: "",
  projectStatus: "",
  correctiveActions: "",
  openIssues: "",
  worksProgramme: "",
  publicContacts: "",
  conclusions: "",
};

function getIsoWeekDate(year: number, week: number, endOfWeek: boolean) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7 + (endOfWeek ? 6 : 0));
  if (endOfWeek) monday.setUTCHours(23, 59, 59, 999);
  return monday;
}

function rdcdCell(value: string, bold = false) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: value || "—", size: 18, bold })] })],
  });
}

function rdcdTable(headers: string[], rows: string[][]) {
  return new Table({
    rows: [
      new TableRow({ children: headers.map(header => rdcdCell(header, true)) }),
      ...rows.map(row => new TableRow({ children: row.map(value => rdcdCell(value)) })),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

export default function RDCD() {
  const { t } = useLanguage();
  const rdcdImage = useBrandImage("rdcd");
  const { user } = useAuth();
  const { projects, activeProject } = useProject();
  const utils = trpc.useUtils();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";

  const [step, setStep] = useState(1);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [startWeek, setStartWeek] = useState("");
  const [endWeek, setEndWeek] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [includePlans, setIncludePlans] = useState(true);
  const [includeWaste, setIncludeWaste] = useState(true);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const [measureSelections, setMeasureSelections] = useState<Record<number, MeasureSelection>>({});
  const [content, setContent] = useState<RdcdContent>(EMPTY_CONTENT);
  const [brandProfile, setBrandProfile] = useState<RdcdBrandProfileId>("startcampus_gleeds_quadrante");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [reportNumber, setReportNumber] = useState("");
  const [reportPhase, setReportPhase] = useState("Execução da obra");
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [revision, setRevision] = useState("00");
  const [projectWasChosen, setProjectWasChosen] = useState(false);
  // Em Todos os Projectos, o contexto pode ainda estar a actualizar a selecção global.
  // A consulta própria preserva a lista autorizada para o wizard não ficar vazio.
  const { data: authorisedProjects = [] } = trpc.projects.list.useQuery(undefined, { enabled: !!user && isAdminOrDono });

  // Fetch submissions for selected projects and period
  const { data: allSubmissions, isLoading: loadingSubs } = trpc.submissions.listAll.useQuery(undefined, { enabled: step >= 3 });
  const catalogueProjectId = selectedProjects[0] ?? 0;
  const { data: savedDrafts = [] } = trpc.rdcd.list.useQuery({ projectId: catalogueProjectId }, { enabled: catalogueProjectId > 0 });
  const { data: sections } = trpc.sections.list.useQuery({ projectId: catalogueProjectId }, { enabled: step >= 3 && catalogueProjectId > 0 });
  const { data: measures } = trpc.measures.list.useQuery({ projectId: catalogueProjectId }, { enabled: step >= 3 && catalogueProjectId > 0 });
  const { data: plans } = trpc.monitoringPlans.list.useQuery(undefined, { enabled: step >= 2 && includePlans });

  const periodBounds = useMemo(() => {
    if (!startWeek || !endWeek) return null;
    const start = Number(startWeek.split("-W")[1]);
    const end = Number(endWeek.split("-W")[1]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    const startDate = getIsoWeekDate(selectedYear, start, false);
    const endDate = getIsoWeekDate(selectedYear, end, true);
    return { startAt: startDate.getTime(), endAt: endDate.getTime() };
  }, [startWeek, endWeek, selectedYear]);
  const { data: wasteRows = [] } = trpc.rdcd.wasteRows.useQuery(
    { projectId: catalogueProjectId, startAt: periodBounds?.startAt || 1, endAt: periodBounds?.endAt || 1 },
    { enabled: includeWaste && catalogueProjectId > 0 && !!periodBounds },
  );
  const saveDraftMutation = trpc.rdcd.save.useMutation();

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
  // Fetch evidence images for filtered submissions
  const { data: allEvidence } = trpc.evidence.getBySubmissions.useQuery(
    { submissionIds },
    { enabled: submissionIds.length > 0 && step >= 3 }
  );
  // Build evidence map: measureId -> array of image URLs
  const evidenceByMeasure = useMemo(() => {
    if (!allEvidence) return {} as Record<number, Array<{ url: string; filename: string; submissionId: number; mimeType?: string | null }>>;
    const map: Record<number, Array<{ url: string; filename: string; submissionId: number; mimeType?: string | null }>> = {};
    for (const img of allEvidence as any[]) {
      if (!map[img.measureId]) map[img.measureId] = [];
      map[img.measureId].push({ url: img.url, filename: img.filename || "evidência", submissionId: img.submissionId, mimeType: img.mimeType });
    }
    return map;
  }, [allEvidence]);

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

  // O modelo oficial é produzido projecto a projecto; SIN01 permanece fora deste workflow de construção.
  const projectChoices = projects.length > 0 ? projects : authorisedProjects;
  const availableProjects = projectChoices.filter(p => p.code !== "SIN01");
  const selectedProject = projectChoices.find(project => project.id === selectedProjects[0]) || null;
  const usesSin02Template = selectedProject?.code === "SIN02";

  useEffect(() => {
    if (!projectWasChosen && activeProject && activeProject.code !== "SIN01") {
      setSelectedProjects(current => current.length === 1 && current[0] === activeProject.id ? current : [activeProject.id]);
    }
  }, [activeProject?.id, activeProject?.code, projectWasChosen]);

  // Year options
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  function toggleProject(id: number) {
    setProjectWasChosen(true);
    setSelectedProjects(prev => prev.includes(id) ? [] : [id]);
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

  function serialiseSelections() {
    return Object.fromEntries(Object.entries(measureSelections).map(([measureId, selection]) => [measureId, {
      selectedWeeks: Array.from(new Set(selection.selectedWeeks)),
      selectedImageUrls: Array.from(new Set(selection.selectedImageUrls)),
      notes: selection.notes.trim(),
    }]));
  }

  async function saveDraft() {
    if (!selectedProject || !startWeek || !endWeek) {
      toast.error(t("Selecione um projeto e um período antes de guardar o rascunho."));
      return;
    }
    const start = Number(startWeek.split("-W")[1]);
    const end = Number(endWeek.split("-W")[1]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      toast.error(t("O período do RDCD é inválido."));
      return;
    }
    setIsSavingDraft(true);
    try {
      const result = await saveDraftMutation.mutateAsync({
        id: draftId || undefined,
        projectId: selectedProject.id,
        reportNumber,
        reportYear: selectedYear,
        startWeek: start,
        endWeek: end,
        reportPhase,
        revision: revision.trim() || "00",
        brandProfile,
        preparedBy,
        reviewedBy,
        includePlans,
        includeWaste,
        planIds: selectedPlanIds,
        content,
        selections: serialiseSelections(),
      });
      setDraftId(result.id);
      await utils.rdcd.list.invalidate({ projectId: selectedProject.id });
      toast.success(result.created ? t("Rascunho RDCD criado") : t("Rascunho RDCD atualizado"));
    } catch (error: any) {
      toast.error(error?.message || t("Não foi possível guardar o rascunho RDCD."));
    } finally {
      setIsSavingDraft(false);
    }
  }

  function loadDraft(draft: any) {
    setDraftId(draft.id);
    setSelectedProjects([draft.projectId]);
    setProjectWasChosen(true);
    setSelectedYear(Number(draft.reportYear));
    setStartWeek(`${draft.reportYear}-W${String(draft.startWeek).padStart(2, "0")}`);
    setEndWeek(`${draft.reportYear}-W${String(draft.endWeek).padStart(2, "0")}`);
    setReportNumber(draft.reportNumber || "");
    setReportPhase(draft.reportPhase || "Execução da obra");
    setRevision(draft.revision || "00");
    setPreparedBy(draft.preparedBy || "");
    setReviewedBy(draft.reviewedBy || "");
    setBrandProfile(Object.prototype.hasOwnProperty.call(RDCD_BRAND_PROFILES, draft.brandProfile) ? draft.brandProfile : "startcampus_gleeds_quadrante");
    setIncludePlans(Boolean(draft.includePlans));
    setIncludeWaste(Boolean(draft.includeWaste));
    setSelectedPlanIds(Array.isArray(draft.planIds) ? draft.planIds.map(Number).filter(Number.isFinite) : []);
    setContent({ ...EMPTY_CONTENT, ...(draft.content || {}) });
    const restored: Record<number, MeasureSelection> = {};
    for (const [measureId, selection] of Object.entries(draft.selections || {})) {
      const item: any = selection;
      restored[Number(measureId)] = {
        selectedWeeks: Array.isArray(item.selectedWeeks) ? item.selectedWeeks.filter((value: unknown) => typeof value === "string") : [],
        selectedImageUrls: Array.isArray(item.selectedImageUrls) ? item.selectedImageUrls.filter((value: unknown) => typeof value === "string") : [],
        notes: typeof item.notes === "string" ? item.notes : "",
      };
    }
    setMeasureSelections(restored);
    setStep(3);
    toast.success(t("Rascunho RDCD carregado"));
  }

  async function generateWord() {
    setIsGenerating(true);
    try {
      if (!selectedProject || !startWeek || !endWeek || !periodBounds) {
        toast.error(t("Selecione um projeto e um período válidos antes de gerar o RDCD."));
        return;
      }
      const projNames = `${selectedProject.code} — ${selectedProject.name}`;
      const weeklyRows = buildRdcdWeeklyRows(filteredSubmissions as any[], (allResponses || []) as any[], measures || [], sections || [], reportPhase);
      const phaseRows = buildRdcdPhaseRows((allResponses || []) as any[], measures || [], sections || []);
      const nonConformityRows = buildRdcdNonConformityRows((allResponses || []) as any[], measures || [], filteredSubmissions as any[]);
      const periodLabel = `Semana ${startWeek.split("-W")[1]} a Semana ${endWeek.split("-W")[1]} de ${selectedYear}`;
      const totals = weeklyRows.reduce((acc, row) => ({ i: acc.i + row.i, c: acc.c + row.c, nc: acc.nc + row.nc, na: acc.na + row.na }), { i: 0, c: 0, nc: 0, na: 0 });
      const metadata = usesSin02Template ? SIN02_RDCD_METADATA : null;
      const resolvedReportNumber = reportNumber.trim() || `RDCD-${selectedProject.code}-[n.º]`;
      const selectedPlans = (plans || []).filter((plan: any) => selectedPlanIds.includes(plan.id));
      const profile = RDCD_BRAND_PROFILES[brandProfile];
      const submissionById = new Map(filteredSubmissions.map((submission: any) => [submission.id, submission]));
      const selectedMeasures = compiledMeasures.map((measure: any) => {
        const selection = measureSelections[measure.id];
        if (!selection) return null;
        const selectedWeeks = new Set(selection.selectedWeeks);
        const responses = measure.responses.filter((response: any) => selectedWeeks.has(`${response.year}-W${String(response.week).padStart(2, "0")}`));
        const images = (evidenceByMeasure[measure.id] || []).filter(image => selection.selectedImageUrls.includes(image.url));
        if (responses.length === 0 && images.length === 0 && !selection.notes.trim()) return null;
        return { measure, selection, responses, images };
      }).filter(Boolean) as Array<{ measure: any; selection: MeasureSelection; responses: any[]; images: Array<{ url: string; filename: string; mimeType?: string | null }> }>;

      const assets = new Map<string, { data: ArrayBuffer; type: "png" | "jpg" }>();
      const assetRequests = [
        ...profile.logos.map(logo => ({ url: logo.url, type: logo.type })),
        ...selectedMeasures.flatMap(item => item.images.map(image => ({
          url: image.url,
          type: image.mimeType === "image/png" || image.url.toLowerCase().endsWith(".png") ? "png" as const : "jpg" as const,
        }))),
      ].filter((item, index, values) => values.findIndex(value => value.url === item.url) === index);
      if (assetRequests.length > 0) {
        toast.info(`${t("A descarregar")} ${assetRequests.length} ${t("imagem(ns) selecionada(s)...")}`);
        for (let index = 0; index < assetRequests.length; index += 8) {
          const batch = assetRequests.slice(index, index + 8);
          const results = await Promise.allSettled(batch.map(async (asset) => {
            const response = await fetch(asset.url);
            if (!response.ok) return null;
            return { ...asset, data: await response.arrayBuffer() };
          }));
          for (const result of results) {
            if (result.status === "fulfilled" && result.value) assets.set(result.value.url, { data: result.value.data, type: result.value.type });
          }
        }
      }

      const technicalRows = [
        ["Designação do relatório", "RDCD – Relatório de Demonstração do Cumprimento da DCAPE"],
        ["Projeto", metadata?.projectName || projNames],
        ["Proponente", metadata?.proponent || "[A confirmar pelo responsável do relatório]"],
        ["N.º do TUA", metadata?.tua || "[A preencher]"],
        ["Código APA", metadata?.apaCode || "[A preencher]"],
        ["Processo de AIA / RECAPE", metadata?.aiaRecape || "[A preencher]"],
        ["DIA", metadata?.dia || "[A preencher]"],
        ["DCAPE", metadata?.dcape || "[A preencher]"],
        ["Entidade licenciadora", metadata?.licensingEntity || "[A preencher]"],
        ["Fase da obra reportada", reportPhase],
        ["N.º do relatório", resolvedReportNumber],
        ["Período de reporte", periodLabel],
        ["Fichas aprovadas incluídas", weeklyRows.length > 0 ? weeklyRows.map(row => `S${row.week} (${row.period})`).join("; ") : "Sem fichas aprovadas no período"],
        ["Elaborado por", preparedBy.trim() || "[Nome / função — Equipa Ambiental Start Campus]"],
        ["Revisto / aprovado por", reviewedBy.trim() || "[Nome / função]"],
        ["Data de elaboração", new Date().toLocaleDateString("pt-PT")],
        ["Revisão", revision.trim() || "00"],
        ["Perfil institucional", profile.label],
      ];
      const textOr = (entered: string, fallback: string) => entered.trim() || fallback;
      const selectedPhotoAnnex: any[] = [];
      for (const item of selectedMeasures) {
        if (item.images.length === 0) continue;
        selectedPhotoAnnex.push(
          new Paragraph({ text: `Medida ${item.measure.number || item.measure.id} — ${(item.measure.description || "").slice(0, 160)}`, heading: HeadingLevel.HEADING_2 }),
        );
        for (const image of item.images) {
          const asset = assets.get(image.url);
          if (!asset) {
            selectedPhotoAnnex.push(new Paragraph({ text: `[Fotografia não incorporada: ${image.filename}]` }));
            continue;
          }
          selectedPhotoAnnex.push(
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: asset.data, transformation: { width: 450, height: 320 }, type: asset.type })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: image.filename, size: 16, italics: true, color: "666666" })] }),
          );
        }
      }
      const coverLogos = profile.logos.flatMap((logo, index) => {
        const asset = assets.get(logo.url);
        if (!asset) return [new TextRun({ text: index ? `   ${logo.name}` : logo.name, bold: true, color: "0A3638" })];
        return [new ImageRun({ data: asset.data, transformation: { width: logo.width, height: logo.height }, type: asset.type }), new TextRun({ text: "   " })];
      });

      const document = new Document({
        sections: [{
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: coverLogos }),
            new Paragraph({ text: "" }),
            new Paragraph({ alignment: AlignmentType.CENTER, text: "RDCD", heading: HeadingLevel.TITLE }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Relatório de Demonstração do Cumprimento da DCAPE", size: 28, bold: true, color: "0A3638" })] }),
            new Paragraph({ text: "" }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: metadata?.projectName || projNames, size: 24, bold: true })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: periodLabel, size: 22 })] }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Ficha Técnica do Relatório", heading: HeadingLevel.HEADING_1 }),
            rdcdTable(["Campo", "Informação"], technicalRows),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "1. Introdução", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: textOr(content.introduction, `O presente Relatório de Demonstração do Cumprimento da DCAPE é elaborado para ${metadata?.projectName || projNames}, no período ${periodLabel}. Consolida ${weeklyRows.length} ficha(s) de controlo semanal aprovada(s). A emissão e assinatura permanecem sujeitas a revisão humana.`) }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "2. Enquadramento do Projeto no TUA", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: metadata ? `${metadata.projectName} encontra-se enquadrado no TUA n.º ${metadata.tua}, com código APA ${metadata.apaCode}. A confirmação final de números de processo, datas e vigência deve ser feita face ao TUA em vigor na data de emissão.` : "[A completar pelo responsável com os elementos do TUA, AIA/RECAPE, DIA, DCAPE e entidade licenciadora.]" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "3. Ponto de Situação do Desenvolvimento da Obra", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: textOr(content.projectStatus, "Descreva as atividades, frentes de obra e alterações relevantes ocorridas no período de reporte.") }),
            rdcdTable(["Sem.", "Período", "Ficha aprovada", "I", "C", "NC", "NA"], weeklyRows.length > 0 ? weeklyRows.map(row => [String(row.week), row.period, row.reference, String(row.i), String(row.c), String(row.nc), String(row.na)]) : [["—", "—", "Sem fichas aprovadas no período", "0", "0", "0", "0"]]),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "4. Resumo do Estado das Medidas da DCAPE", heading: HeadingLevel.HEADING_1 }),
            rdcdTable(["Fase / grupo DCAPE", "N.º de medidas", "I", "C", "NC", "NA"], phaseRows.map(row => [row.section, String(row.totalMeasures), String(row.i), String(row.c), String(row.nc), String(row.na)])),
            new Paragraph({ text: "Medidas com registo de Não Conformidade ou observações relevantes", heading: HeadingLevel.HEADING_2 }),
            rdcdTable(["N.º", "Medida / grupo", "Semana / ficha", "Registo", "Seguimento"], nonConformityRows.length > 0 ? nonConformityRows.map(row => [String(row.number), row.description.slice(0, 180), row.reference, `${row.finding}: ${row.observation}`, "A confirmar no ponto 6"]) : [["—", "Sem não conformidades ou observações relevantes registadas.", "—", "—", "—"]]),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "5. Compilação das Fichas Semanais", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "Inclui exclusivamente as semanas, notas e evidências selecionadas pelo responsável na aplicação. A seleção não altera as fichas de origem nem substitui a validação técnica." }),
            rdcdTable(["Medida", "Semanas selecionadas", "Estados", "Atualização / nota editorial"], selectedMeasures.length > 0 ? selectedMeasures.map(item => [
              `${item.measure.number || item.measure.id} — ${(item.measure.description || "").slice(0, 140)}`,
              item.responses.length > 0 ? item.responses.map(response => `S${response.week}/${response.year}`).join(", ") : "Sem semanas selecionadas",
              item.responses.length > 0 ? item.responses.map(response => response.status || "—").join(", ") : "—",
              item.selection.notes.trim() || "—",
            ]) : [["—", "Nenhuma medida/semana foi selecionada para compilar.", "—", "—"]]),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "6. Ações Corretivas e Seguimento", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: textOr(content.correctiveActions, nonConformityRows.length > 0 ? "As ações corretivas associadas às não conformidades devem ser confirmadas e completadas pelo responsável técnico antes da emissão." : "Não foram identificadas não conformidades no conjunto de fichas aprovado selecionado.") }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "7. Relatórios de Monitorização", heading: HeadingLevel.HEADING_1 }),
            rdcdTable(["Tipo de monitorização", "Periodicidade", "Situação / resultado", "Referência de anexo"], includePlans && selectedPlans.length > 0 ? selectedPlans.map((plan: any) => [plan.name, plan.periodicity || "—", plan.submissionStatus === "delivered" ? "Entregue" : plan.submissionStatus === "submitted" ? "Submetido" : "Pendente", plan.submittedFileUrl ? "Registo no repositório documental" : "A completar"]) : [["Sem planos selecionados", "—", "Não incluído neste relatório", "—"]]),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "8. Questões em Aberto Relativas a Períodos Anteriores", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: textOr(content.openIssues, "Sem questões anteriores registadas neste rascunho. Confirmar com o responsável técnico antes de emissão.") }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "9. Programa de Trabalhos", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: textOr(content.worksProgramme, "Indicar o programa de trabalhos aplicável ao período e anexar a versão controlada no repositório documental.") }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "10. Reclamações e Contactos com o Público", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: textOr(content.publicContacts, "Sem contactos ou reclamações registados neste rascunho. Confirmar antes da emissão.") }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "11. Conclusões", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: textOr(content.conclusions, `No período ${periodLabel}, foram consolidadas ${weeklyRows.length} ficha(s) aprovada(s), com ${totals.i} registo(s) Implementada(s), ${totals.c} Conforme(s), ${totals.nc} Não Conforme(s) e ${totals.na} Não Aplicável(eis). O conteúdo deve ser revisto e aprovado pelo responsável técnico antes da emissão.`) }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Anexo I — Referência às Fichas de Controlo de Medidas", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: weeklyRows.length > 0 ? `Fichas aprovadas do período, mantidas no repositório documental: ${weeklyRows.map(row => row.reference).join(", ")}.` : "Sem fichas aprovadas selecionadas." }),
            ...(selectedPhotoAnnex.length > 0 ? [
              new Paragraph({ text: "" }),
              new Paragraph({ text: "Anexo II — Registo Fotográfico Selecionado", heading: HeadingLevel.HEADING_1 }),
              new Paragraph({ text: "Fotografias selecionadas por medida e semana no rascunho RDCD. As imagens originais permanecem associadas às fichas de controlo de origem." }),
              ...selectedPhotoAnnex,
            ] : []),
            ...(includeWaste ? [
              new Paragraph({ text: "" }),
              new Paragraph({ text: "Anexo III — Registo de Resíduos e-GAR do Período", heading: HeadingLevel.HEADING_1 }),
              new Paragraph({ text: "Tabela gerada a partir dos e-GARs registados na plataforma no período. A quantidade corrigida, quando existente, prevalece sobre a quantidade inicial." }),
              rdcdTable(["ID e-GAR", "Data de recolha", "Código LER", "Tipo de resíduo", "Quantidade (t)", "Destino", "Empresa"], wasteRows.length > 0 ? wasteRows.map((row: any) => [row.egarId, new Date(Number(row.date)).toLocaleDateString("pt-PT"), row.lerCode, row.designation, String(row.quantity), row.destination, row.companyName]) : [["—", "—", "—", "Sem e-GARs registados no período selecionado.", "—", "—", "—"]]),
            ] : []),
          ],
        }],
      });

      const blob = await Packer.toBlob(document);
      const filename = `RDCD_${projNames.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_S${startWeek.split("-W")[1]}-S${endWeek.split("-W")[1]}_${selectedYear}.docx`;
      saveAs(blob, filename);
      toast.success(t("RDCD gerado com sucesso!"));
    } catch (error: any) {
      toast.error(`${t("Erro ao gerar RDCD")}: ${error?.message || t("Erro inesperado")}`);
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
    conform: "bg-primary text-primary-foreground border-primary",
    nc: "bg-destructive/10 text-destructive border-destructive/25",
    na: "bg-muted text-foreground border-border",
    pending: "bg-muted text-muted-foreground border-border",
    partial: "bg-primary/10 text-primary border-primary/20",
    no_data: "bg-muted/40 text-muted-foreground border-border",
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
      <div className="mx-auto max-w-6xl space-y-5 pb-8">
        <StandPageHeader tone="governance" eyebrow="COMPLIANCE REPORTING" title={t("RDCD — Relatório de Demonstração de Cumprimento")} description={t("Organize o período, selecione evidências e complete os capítulos antes da validação técnica.")} context={selectedProject?.code || t("Por configurar")} image={rdcdImage.url} imagePosition={rdcdImage.position} imageMode={rdcdImage.mode} actions={<StandStatusBadge label={step === 5 ? t("Pronto para revisão") : `${t("Passo")} ${step} ${t("de")} ${STEPS.length}`} tone={step === 5 ? "success" : "info"} />}>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>1 relatório = 1 projeto</span><span>•</span><span>{t("Dados aprovados e rastreáveis")}</span><span>•</span><span>{t("Geração Word sob controlo humano")}</span></div>
        </StandPageHeader>

        {/* Wizard Steps */}
        <div className="stand-surface flex overflow-x-auto p-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex min-w-fit items-center">
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${step === s.id ? "bg-primary text-primary-foreground shadow-sm" : step > s.id ? "bg-primary/10 text-primary dark:text-primary" : "text-muted-foreground"}`}>
                {step > s.id ? <Check className="h-4 w-4" /> : <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${step === s.id ? "border-primary-foreground/50" : "border-current/30"}`}>{s.id}</span>}
                <span className="font-semibold">{t(s.labelKey)}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-1 h-px w-5 ${step > s.id ? "bg-primary/50" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Project Selection */}
        {step === 1 && (
          <Card className="stand-surface">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">{t("Selecionar Projeto")}</h2>
              <p className="text-sm text-muted-foreground mb-4">{t("Cada RDCD é emitido por projeto. Selecione o projeto a incluir no relatório.")}</p>
              <div className="flex gap-2 mb-4">
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
          <Card className="stand-surface">
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
                      <button className="text-[10px] text-primary hover:underline" onClick={() => setSelectedPlanIds(selectedPlanIds.length === plans.length ? [] : plans.map((p: any) => p.id))}>
                        {selectedPlanIds.length === plans.length ? t("Desselecionar todos") : t("Selecionar todos")}
                      </button>
                    </div>
                    {plans.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={selectedPlanIds.includes(p.id)}
                          onCheckedChange={(v) => setSelectedPlanIds(v ? [...selectedPlanIds, p.id] : selectedPlanIds.filter(id => id !== p.id))}
                        />
                        <span className={`w-2 h-2 rounded-full ${p.submissionStatus === "delivered" ? "bg-primary" : p.submissionStatus === "submitted" ? "bg-secondary" : "bg-muted-foreground/45"}`} />
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">— {p.periodicity || "—"}</span>
                        <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${p.submissionStatus === "delivered" ? "bg-primary text-primary-foreground" : p.submissionStatus === "submitted" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
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
              <div className="mb-4 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox checked={includeWaste} onCheckedChange={(value) => setIncludeWaste(Boolean(value))} id="include-waste" />
                  <div>
                    <label htmlFor="include-waste" className="cursor-pointer text-sm font-medium">{t("Incluir anexo de resíduos e-GAR")}</label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("A tabela será gerada apenas com os e-GARs registados no projeto e no período escolhido: ID, data de recolha, código LER, tipo de resíduo, quantidade e destino.")}</p>
                  </div>
                </div>
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
          <Card className="stand-surface">
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
                    <div className="bg-primary border border-primary rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-primary-foreground">{compiledMeasures.filter(m => m.autoStatus === "conform").length}</p>
                      <p className="text-xs text-primary-foreground/85">{t("Conforme")}</p>
                    </div>
                    <div className="bg-destructive/10 border border-destructive/25 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-destructive">{compiledMeasures.filter(m => m.autoStatus === "nc").length}</p>
                      <p className="text-xs text-destructive">{t("Não Conforme")}</p>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-primary">{compiledMeasures.filter(m => m.autoStatus === "partial").length}</p>
                      <p className="text-xs text-primary">{t("Parcial")}</p>
                    </div>
                    <div className="bg-muted border border-border rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{compiledMeasures.filter(m => m.autoStatus === "na").length}</p>
                      <p className="text-xs text-muted-foreground">{t("N/A")}</p>
                    </div>
                    <div className="bg-muted/40 border border-border rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-muted-foreground">{compiledMeasures.filter(m => m.autoStatus === "no_data").length}</p>
                      <p className="text-xs text-muted-foreground">{t("Sem dados")}</p>
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
                              {m.responses.length > 0 && (
                                <div className="mt-2 pl-3 border-l-2 border-primary">
                                  <p className="text-xs text-muted-foreground mb-1">{t("Selecione as semanas a compilar neste ponto do RDCD:")}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {m.responses.slice(0, 10).map((r: any, i: number) => {
                                      const weekKey = `${r.year}-W${String(r.week).padStart(2, "0")}`;
                                      const sel = measureSelections[m.id];
                                      const isSelected = sel?.selectedWeeks?.includes(weekKey);
                                      return (
                                        <button
                                          key={i}
                                          className={`px-2 py-0.5 rounded text-[10px] border ${isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:border-primary"}`}
                                          onClick={() => {
                                            const current = measureSelections[m.id] || { selectedWeeks: [], selectedImageUrls: [], notes: "" };
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
                                  {(() => {
                                    const selection = measureSelections[m.id] || { selectedWeeks: [], selectedImageUrls: [], notes: "" };
                                    const selectedSubmissionIds = new Set(m.responses.filter((response: any) => selection.selectedWeeks.includes(`${response.year}-W${String(response.week).padStart(2, "0")}`)).map((response: any) => response.submissionId));
                                    const images = (evidenceByMeasure[m.id] || []).filter(image => selectedSubmissionIds.has(image.submissionId));
                                    return <>
                                      {images.length > 0 && <div className="mt-3"><p className="mb-1.5 text-xs text-muted-foreground">{t("Fotografias disponíveis nas semanas selecionadas (clique para incluir):")}</p><div className="flex flex-wrap gap-2">{images.map((image) => {
                                        const selected = selection.selectedImageUrls.includes(image.url);
                                        return <button type="button" key={image.url} onClick={() => setMeasureSelections(current => {
                                          const item = current[m.id] || { selectedWeeks: [], selectedImageUrls: [], notes: "" };
                                          const selectedImageUrls = item.selectedImageUrls.includes(image.url) ? item.selectedImageUrls.filter(url => url !== image.url) : [...item.selectedImageUrls, image.url];
                                          return { ...current, [m.id]: { ...item, selectedImageUrls } };
                                        })} className={`overflow-hidden rounded-lg border text-left transition-colors ${selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/60"}`}><img src={image.url} alt={image.filename} className="h-16 w-20 object-cover" /><span className="block max-w-20 truncate px-1 py-0.5 text-[9px] text-muted-foreground">{image.filename}</span></button>;
                                      })}</div></div>}
                                      <Textarea value={selection.notes} onChange={(event) => setMeasureSelections(current => ({ ...current, [m.id]: { ...selection, notes: event.target.value } }))} className="mt-3 min-h-16 bg-card text-xs" placeholder={t("Nota editorial opcional para esta medida no RDCD")} />
                                    </>;
                                  })()}
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
                <Button onClick={() => setStep(4)}>{t("Completar capítulos")}<ChevronRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Editorial content and report identity */}
        {step === 4 && (
          <Card className="stand-surface">
            <CardContent className="p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-lg font-semibold">{t("Conteúdo e identidade do RDCD")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Complete os capítulos narrativos. Estes campos ficam em rascunho auditável e nunca alteram fichas, e-GARs ou anexos de origem.")}</p></div>
                {draftId && <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">{t("Rascunho")} #{draftId}</Badge>}
              </div>
              <section className="mb-5 overflow-hidden rounded-2xl border border-primary/18 bg-primary/[0.035]">
                <div className="border-b border-primary/12 px-4 py-3 sm:px-5"><p className="stand-kicker text-primary">{t("CONTROLO DE EMISSÃO")}</p><p className="mt-1 text-sm font-semibold text-foreground">{t("Ficha técnica e perfis institucionais")}</p></div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                  <div><Label>{t("N.º do relatório")}</Label><Input value={reportNumber} onChange={event => setReportNumber(event.target.value)} placeholder={`RDCD-${selectedProject?.code || "PROJ"}-001`} className="mt-1 bg-card" /></div>
                  <div><Label>{t("Fase da obra reportada")}</Label><Select value={reportPhase} onValueChange={setReportPhase}><SelectTrigger className="mt-1 bg-card"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Preparação prévia">{t("Preparação prévia")}</SelectItem><SelectItem value="Execução da obra">{t("Execução da obra")}</SelectItem><SelectItem value="Fase final">{t("Fase final")}</SelectItem><SelectItem value="Desativação">{t("Desativação")}</SelectItem></SelectContent></Select></div>
                  <div><Label>{t("Elaborado por")}</Label><Input value={preparedBy} onChange={event => setPreparedBy(event.target.value)} placeholder={t("Nome / função — Equipa Ambiental Start Campus")} className="mt-1 bg-card" /></div>
                  <div><Label>{t("Revisto / aprovado por")}</Label><Input value={reviewedBy} onChange={event => setReviewedBy(event.target.value)} placeholder={t("Nome / função")} className="mt-1 bg-card" /></div>
                  <div><Label>{t("Revisão")}</Label><Input value={revision} onChange={event => setRevision(event.target.value)} placeholder="00" className="mt-1 max-w-32 bg-card" /></div>
                  <div><Label>{t("Identidades do relatório")}</Label><Select value={brandProfile} onValueChange={(value) => setBrandProfile(value as RdcdBrandProfileId)}><SelectTrigger className="mt-1 bg-card"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(RDCD_BRAND_PROFILES).map(([id, profile]) => <SelectItem key={id} value={id}>{profile.label}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">{RDCD_BRAND_PROFILES[brandProfile].description}</p></div>
                </div>
              </section>
              {usesSin02Template && <p className="mb-5 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-foreground">{t("O modelo SIN02 pré-preenche dados institucionais do template. Confirme sempre TUA, licenças e vigência antes da emissão.")}</p>}
              <div className="grid gap-4 lg:grid-cols-2">
                {([
                  ["introduction", "1. Introdução", "Contextualize o período, objetivo do relatório e fontes consultadas."],
                  ["projectStatus", "3. Ponto de Situação do Desenvolvimento da Obra", "Registe atividades, frentes de obra e alterações relevantes."],
                  ["correctiveActions", "6. Ações Corretivas e Seguimento", "Indique medidas corretivas, responsáveis e situação atual."],
                  ["openIssues", "8. Questões em Aberto de Períodos Anteriores", "Identifique pendências e o respetivo seguimento."],
                  ["worksProgramme", "9. Programa de Trabalhos", "Descreva os trabalhos previstos ou a referência controlada no repositório."],
                  ["publicContacts", "10. Reclamações e Contactos com o Público", "Registe contactos, reclamações ou confirme a inexistência."],
                  ["conclusions", "11. Conclusões", "Apresente a conclusão técnica, condicionada a revisão e aprovação humana."],
                ] as Array<[keyof RdcdContent, string, string]>).map(([key, label, placeholder]) => <div key={key} className="rounded-xl border border-border/80 bg-card p-4"><Label className="text-sm font-semibold">{t(label)}</Label><Textarea value={content[key]} onChange={(event) => setContent(current => ({ ...current, [key]: event.target.value }))} placeholder={t(placeholder)} className="mt-2 min-h-28 bg-background" /></div>)}
              </div>
              <section className="mt-5 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2"><Database className="size-4 text-primary" /><h3 className="text-sm font-semibold">{t("Anexo e-GAR do período")}</h3></div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{includeWaste ? t("O anexo usará os registos atuais e-GAR para este projeto e período. Dados ausentes não são estimados.") : t("O anexo de resíduos está desativado neste rascunho.")}</p>
                {includeWaste && <p className="mt-2 text-sm font-medium text-foreground">{wasteRows.length} {t("e-GAR(s) encontrados no período")}</p>}
              </section>
              {savedDrafts.length > 0 && <section className="mt-5 rounded-xl border border-dashed border-border p-4"><div className="flex items-center gap-2"><FileText className="size-4 text-primary" /><h3 className="text-sm font-semibold">{t("Rascunhos deste projeto")}</h3></div><div className="mt-3 flex flex-wrap gap-2">{savedDrafts.slice(0, 8).map((draft: any) => <Button key={draft.id} size="sm" variant={draft.id === draftId ? "default" : "outline"} onClick={() => loadDraft(draft)}>{draft.reportNumber || `RDCD #${draft.id}`} · S{draft.startWeek}–S{draft.endWeek}/{draft.reportYear}</Button>)}</div></section>}
              <div className="mt-6 flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={() => setStep(3)}><ChevronLeft className="mr-1 size-4" />{t("Anterior")}</Button><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void saveDraft()} disabled={isSavingDraft}><Save className="mr-1.5 size-4" />{isSavingDraft ? t("A guardar...") : t("Guardar rascunho")}</Button><Button onClick={() => setStep(5)}>{t("Rever emissão")}<Eye className="ml-1 size-4" /></Button></div></div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: review and generation */}
        {step === 5 && (
          <Card className="stand-surface">
            <CardContent className="p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{t("Pré-visualização do RDCD")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Revise a seleção e guarde o rascunho antes de gerar o Word. A geração não aprova, assina nem arquiva o relatório.")}</p></div><Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">{RDCD_BRAND_PROFILES[brandProfile].label}</Badge></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Projeto")}</p><p className="mt-1 text-sm font-semibold">{selectedProject ? `${selectedProject.code} — ${selectedProject.name}` : "—"}</p></div>
                <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Período")}</p><p className="mt-1 text-sm font-semibold">S{startWeek.split("-W")[1]}–S{endWeek.split("-W")[1]}/{selectedYear}</p></div>
                <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Fichas aprovadas")}</p><p className="mt-1 text-sm font-semibold">{filteredSubmissions.length}</p></div>
                <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{t("e-GARs no anexo")}</p><p className="mt-1 text-sm font-semibold">{includeWaste ? wasteRows.length : t("Não incluído")}</p></div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3"><div className="rounded-xl border border-border bg-muted/20 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Medidas / semanas selecionadas")}</p><p className="mt-1 text-2xl font-semibold">{Object.values(measureSelections).filter(item => item.selectedWeeks.length > 0).length} <span className="text-sm font-normal text-muted-foreground">/ {Object.values(measureSelections).reduce((count, item) => count + item.selectedWeeks.length, 0)} {t("semanas")}</span></p></div><div className="rounded-xl border border-border bg-muted/20 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Fotografias selecionadas")}</p><p className="mt-1 text-2xl font-semibold">{Object.values(measureSelections).reduce((count, item) => count + item.selectedImageUrls.length, 0)}</p></div><div className="rounded-xl border border-border bg-muted/20 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Planos selecionados")}</p><p className="mt-1 text-2xl font-semibold">{includePlans ? selectedPlanIds.length : 0}</p></div></div>
              <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-foreground"><p className="flex items-center gap-2 font-semibold"><Check className="size-4 text-amber-700 dark:text-amber-300" />{t("Controlo humano obrigatório")}</p><p className="mt-1 text-muted-foreground">{t("Antes de emissão externa, confirme o TUA, anexos, evidências, quantidades e-GAR, conclusões, responsável e aprovação. Este Word é um dossiê de trabalho, não uma aprovação automática.")}</p></div>
              <div className="mt-6 flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={() => setStep(4)}><ChevronLeft className="mr-1 size-4" />{t("Anterior")}</Button><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void saveDraft()} disabled={isSavingDraft}><Save className="mr-1.5 size-4" />{isSavingDraft ? t("A guardar...") : t("Guardar rascunho")}</Button><Button onClick={generateWord} disabled={isGenerating} className="gap-2">{isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{isGenerating ? t("A gerar...") : t("Gerar RDCD (.docx)")}</Button></div></div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
