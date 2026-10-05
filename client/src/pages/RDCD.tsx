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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  FileBarChart,
  ChevronRight,
  ChevronLeft,
  Check,
  Download,
  Eye,
  Loader2,
  Save,
  FileText,
  Database,
  BookOpen,
  ClipboardList,
  Wrench,
  ListChecks,
  CalendarDays,
  MessageSquareText,
  Flag,
  FileCheck2,
  Images,
  ListTodo,
  Plus,
  Trash2,
  Link2,
  UserRound,
  TableProperties,
  ImagePlus,
  BarChart3,
  FileTextIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  Header,
  Footer,
  PageBreak,
  PageNumber,
  TableOfContents,
} from "docx";
import { saveAs } from "file-saver";
import {
  buildRdcdNonConformityRows,
  buildRdcdPhaseRows,
  buildRdcdWeeklyRows,
  getRdcdProjectModel,
  RDCD_BRAND_PROFILES,
  SIN02_RDCD_METADATA,
  type RdcdBrandProfileId,
} from "@/lib/rdcd-template";
import { localizeDcapeDescription } from "@/lib/dcape-descriptions-en";

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

type ChapterAction = {
  action: string;
  owner: string;
  dueDate: string;
  status: string;
};

type ChapterFigure = {
  id: string;
  url: string;
  type: "png" | "jpg";
  kind: "image" | "chart";
  caption: string;
};

type ChapterTable = {
  id: string;
  title: string;
  columns: string[];
  rows: string[][];
};

type ChapterBlock = {
  summary: string;
  keyPoints: string[];
  sourceReferences: string[];
  actions: ChapterAction[];
  figures: ChapterFigure[];
  tables: ChapterTable[];
};

type ChapterBlocks = Record<keyof RdcdContent, ChapterBlock>;

type MeasureSelection = {
  selectedWeeks: string[];
  selectedImageUrls: string[];
  notes: string;
};

type ReportLogo = {
  name: string;
  url: string;
  type: "png" | "jpg";
  width: number;
  height: number;
};

function defaultReportLogos(profileId: RdcdBrandProfileId): ReportLogo[] {
  return RDCD_BRAND_PROFILES[profileId].logos.map(logo => ({ ...logo }));
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Não foi possível ler o ficheiro."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

const EMPTY_CONTENT: RdcdContent = {
  introduction: "",
  projectStatus: "",
  correctiveActions: "",
  openIssues: "",
  worksProgramme: "",
  publicContacts: "",
  conclusions: "",
};

const EMPTY_CHAPTER_BLOCK: ChapterBlock = {
  summary: "",
  keyPoints: [],
  sourceReferences: [],
  actions: [],
  figures: [],
  tables: [],
};

const EMPTY_CHAPTER_BLOCKS: ChapterBlocks = Object.fromEntries(
  Object.keys(EMPTY_CONTENT).map(key => [
    key,
    {
      ...EMPTY_CHAPTER_BLOCK,
      keyPoints: [],
      sourceReferences: [],
      actions: [],
      figures: [],
      tables: [],
    },
  ])
) as unknown as ChapterBlocks;

/**
 * The regulatory model remains Portuguese in the source of truth, but the
 * report wizard must not show a Portuguese/English mixture when the product
 * language is English.  Keep this presentation layer explicit rather than
 * translating project metadata through the DOM bridge.
 */
function presentRdcdModel(
  projectCode: string | null | undefined,
  language: "pt" | "en"
) {
  const model = getRdcdProjectModel(projectCode);
  if (language !== "en") return model;

  if (projectCode === "SIN01") {
    return {
      ...model,
      label: "OPS — SIN01 DCAPE operational measures",
      reportTitle: "Compliance Demonstration Report — Operations",
      defaultPhase: "NEST operation",
      sourceLabel:
        "OPS measures, owners, status updates and evidence from the Exploration Phase",
      chapterFiveLabel: "Detailed status of DCAPE OPS measures",
      guidance:
        "This report does not use construction weekly forms. It compiles only SIN01 OPS measures, their owners, updates and period evidence.",
    };
  }

  if (projectCode === "SIN02") {
    return {
      ...model,
      label: "SIN02 RDCD — institutional construction model",
      reportTitle: "Decision Compliance Demonstration Report (DCAPE)",
      defaultPhase: "Construction execution",
      sourceLabel:
        "Approved weekly forms, evidence, monitoring plans and e-GARs",
      chapterFiveLabel: "Approved weekly forms compilation",
      guidance:
        "The SIN02 model only pre-fills the institutional context confirmed in the template. Technical human review remains mandatory before issue.",
    };
  }

  return {
    ...model,
    label: `RDCD ${projectCode || "project"} — construction model`,
    reportTitle: "Decision Compliance Demonstration Report (DCAPE)",
    defaultPhase: "Construction execution",
    sourceLabel:
      "Approved weekly forms, evidence, monitoring plans and project e-GARs",
    chapterFiveLabel: "Approved weekly forms compilation",
    guidance:
      "This RDCD is independent from SIN02. Confirm and enter the legal and institutional references for this project before issuing the Word document.",
  };
}

function createEditorialId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type EditorialSection = {
  key: keyof RdcdContent;
  label: string;
  prompt: string;
  source: string;
  icon: LucideIcon;
};

const EDITORIAL_SECTIONS: EditorialSection[] = [
  {
    key: "introduction",
    label: "1. Introdução",
    prompt:
      "Contextualize o período, objetivo do relatório e fontes consultadas.",
    source: "Redação técnica do responsável pelo relatório.",
    icon: BookOpen,
  },
  {
    key: "projectStatus",
    label: "3. Ponto de Situação do Desenvolvimento da Obra",
    prompt: "Registe atividades, frentes de obra e alterações relevantes.",
    source: "Redação técnica e evidência das fichas aprovadas.",
    icon: ClipboardList,
  },
  {
    key: "correctiveActions",
    label: "6. Ações Corretivas e Seguimento",
    prompt: "Indique medidas corretivas, responsáveis e situação atual.",
    source:
      "Não conformidades e decisões de seguimento confirmadas pela equipa.",
    icon: Wrench,
  },
  {
    key: "openIssues",
    label: "8. Questões em Aberto de Períodos Anteriores",
    prompt: "Identifique pendências e o respetivo seguimento.",
    source: "Histórico de reportes e validação do responsável técnico.",
    icon: ListChecks,
  },
  {
    key: "worksProgramme",
    label: "9. Programa de Trabalhos",
    prompt:
      "Descreva os trabalhos previstos ou a referência controlada no repositório.",
    source:
      "Programa de trabalhos em vigor ou referência documental controlada.",
    icon: CalendarDays,
  },
  {
    key: "publicContacts",
    label: "10. Reclamações e Contactos com o Público",
    prompt: "Registe contactos, reclamações ou confirme a inexistência.",
    source: "Registo de contactos do período, confirmado antes da emissão.",
    icon: MessageSquareText,
  },
  {
    key: "conclusions",
    label: "11. Conclusões",
    prompt:
      "Apresente a conclusão técnica, condicionada a revisão e aprovação humana.",
    source: "Síntese técnica sujeita a revisão e aprovação humana.",
    icon: Flag,
  },
];

function getIsoWeekDate(year: number, week: number, endOfWeek: boolean) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(
    jan4.getUTCDate() - day + 1 + (week - 1) * 7 + (endOfWeek ? 6 : 0)
  );
  if (endOfWeek) monday.setUTCHours(23, 59, 59, 999);
  return monday;
}

function rdcdCell(value: string, bold = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: value || "—", size: 18, bold })],
      }),
    ],
  });
}

function rdcdTable(headers: string[], rows: string[][]) {
  return new Table({
    rows: [
      new TableRow({ children: headers.map(header => rdcdCell(header, true)) }),
      ...rows.map(
        row => new TableRow({ children: row.map(value => rdcdCell(value)) })
      ),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

export default function RDCD() {
  const { t, language } = useLanguage();
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
  const [measureSelections, setMeasureSelections] = useState<
    Record<number, MeasureSelection>
  >({});
  const [content, setContent] = useState<RdcdContent>(EMPTY_CONTENT);
  const [chapterBlocks, setChapterBlocks] =
    useState<ChapterBlocks>(EMPTY_CHAPTER_BLOCKS);
  const [brandProfile, setBrandProfile] = useState<RdcdBrandProfileId>(
    "startcampus_gleeds_quadrante"
  );
  const [reportLogos, setReportLogos] = useState<ReportLogo[]>(() =>
    defaultReportLogos("startcampus_gleeds_quadrante")
  );
  const [draftId, setDraftId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [reportNumber, setReportNumber] = useState("");
  const [reportPhase, setReportPhase] = useState("Execução da obra");
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [revision, setRevision] = useState("00");
  const [activeEditorialSection, setActiveEditorialSection] =
    useState<keyof RdcdContent>("introduction");
  const [activeMeasurePreviewId, setActiveMeasurePreviewId] = useState<
    number | null
  >(null);
  const [projectWasChosen, setProjectWasChosen] = useState(false);
  // Em Todos os Projectos, o contexto pode ainda estar a actualizar a selecção global.
  // A consulta própria preserva a lista autorizada para o wizard não ficar vazio.
  const { data: authorisedProjects = [] } = trpc.projects.list.useQuery(
    undefined,
    { enabled: !!user && isAdminOrDono }
  );
  const selectedProjectCode =
    [...projects, ...authorisedProjects].find(
      project => project.id === selectedProjects[0]
    )?.code || null;
  const isOperationsReport = selectedProjectCode === "SIN01";

  // Fetch submissions for selected projects and period
  const { data: allSubmissions, isLoading: loadingSubs } =
    trpc.submissions.listAll.useQuery(undefined, { enabled: step >= 3 });
  const catalogueProjectId = selectedProjects[0] ?? 0;
  const { data: savedDrafts = [] } = trpc.rdcd.list.useQuery(
    { projectId: catalogueProjectId },
    { enabled: catalogueProjectId > 0 }
  );
  const { data: sections } = trpc.sections.list.useQuery(
    { projectId: catalogueProjectId },
    { enabled: step >= 3 && catalogueProjectId > 0 }
  );
  const { data: measures } = trpc.measures.list.useQuery(
    { projectId: catalogueProjectId },
    { enabled: step >= 3 && catalogueProjectId > 0 }
  );
  const { data: plans } = trpc.monitoringPlans.list.useQuery(undefined, {
    enabled: step >= 2 && includePlans,
  });
  const { data: phaseEvidence = [] } = trpc.phaseEvidence.list.useQuery(
    { projectId: catalogueProjectId },
    { enabled: step >= 3 && catalogueProjectId > 0 && isOperationsReport }
  );
  const { data: operationTransition, isLoading: loadingOperationTransition } =
    trpc.phaseMeasures.transitionReport.useQuery(
      { projectId: catalogueProjectId },
      { enabled: step >= 3 && catalogueProjectId > 0 && isOperationsReport }
    );

  const periodBounds = useMemo(() => {
    if (!startWeek || !endWeek) return null;
    const start = Number(startWeek.split("-W")[1]);
    const end = Number(endWeek.split("-W")[1]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
      return null;
    const startDate = getIsoWeekDate(selectedYear, start, false);
    const endDate = getIsoWeekDate(selectedYear, end, true);
    return { startAt: startDate.getTime(), endAt: endDate.getTime() };
  }, [startWeek, endWeek, selectedYear]);
  const { data: wasteRows = [] } = trpc.rdcd.wasteRows.useQuery(
    {
      projectId: catalogueProjectId,
      startAt: periodBounds?.startAt || 1,
      endAt: periodBounds?.endAt || 1,
    },
    { enabled: includeWaste && catalogueProjectId > 0 && !!periodBounds }
  );
  const { data: operationOverview } = trpc.operation.overview.useQuery(
    {
      projectId: catalogueProjectId,
      startDate: periodBounds
        ? new Date(periodBounds.startAt).toISOString().slice(0, 10)
        : undefined,
      endDate: periodBounds
        ? new Date(periodBounds.endAt).toISOString().slice(0, 10)
        : undefined,
      includeDetailed: false,
    },
    { enabled: isOperationsReport && catalogueProjectId > 0 && !!periodBounds }
  );
  const saveDraftMutation = trpc.rdcd.save.useMutation();
  const uploadLogoMutation = trpc.rdcd.uploadLogo.useMutation();
  const uploadFigureMutation = trpc.rdcd.uploadFigure.useMutation();

  // Filter submissions by selected projects and period
  const filteredSubmissions = useMemo(() => {
    if (!allSubmissions || !startWeek || !endWeek) return [];
    return allSubmissions.filter((s: any) => {
      if (
        selectedProjects.length > 0 &&
        !selectedProjects.includes(s.projectId)
      )
        return false;
      const weekKey = `${s.weekYear}-W${String(s.weekNumber).padStart(2, "0")}`;
      return (
        weekKey >= startWeek && weekKey <= endWeek && s.status === "approved"
      );
    });
  }, [allSubmissions, selectedProjects, startWeek, endWeek]);

  // Fetch actual measure responses for filtered submissions
  const submissionIds = useMemo(
    () => filteredSubmissions.map((s: any) => s.id),
    [filteredSubmissions]
  );
  const { data: allResponses, isLoading: loadingResponses } =
    trpc.responses.getBySubmissions.useQuery(
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
    const map: Record<
      number,
      Array<{
        url: string;
        filename: string;
        submissionId: number;
        mimeType?: string | null;
      }>
    > = {};
    if (isOperationsReport) {
      for (const evidence of phaseEvidence as any[]) {
        if (evidence.type !== "photo" || !evidence.content) continue;
        if (!map[evidence.measureId]) map[evidence.measureId] = [];
        map[evidence.measureId].push({
          url: evidence.content,
          filename: evidence.filename || "evidência operacional",
          submissionId: 0,
          mimeType: evidence.mimeType,
        });
      }
      return map;
    }
    if (!allEvidence) return map;
    for (const img of allEvidence as any[]) {
      if (!map[img.measureId]) map[img.measureId] = [];
      map[img.measureId].push({
        url: img.url,
        filename: img.filename || "evidência",
        submissionId: img.submissionId,
        mimeType: img.mimeType,
      });
    }
    return map;
  }, [allEvidence, isOperationsReport, phaseEvidence]);

  // Compile measures with real response data
  const compiledMeasures = useMemo(() => {
    if (isOperationsReport) {
      const exploration = ((operationTransition as any)?.phases || []).find(
        (phase: any) => phase.key === "exploracao"
      );
      return (exploration?.obligations || []).map((obligation: any) => ({
        ...obligation,
        id: obligation.measureId,
        responses: [],
        autoStatus:
          obligation.status === "concluido"
            ? "conform"
            : obligation.status === "bloqueado"
              ? "nc"
              : obligation.status === "em_validacao"
                ? "partial"
                : "pending",
        totalResponses: 0,
        conformCount: obligation.status === "concluido" ? 1 : 0,
        ncCount: obligation.status === "bloqueado" ? 1 : 0,
        naCount: 0,
        latestObservation: obligation.latestUpdate?.updateText || "",
      }));
    }
    if (!measures || !filteredSubmissions.length || !allResponses) return [];

    // Build a map: measureId -> array of responses with status
    const responseMap: Record<
      number,
      Array<{
        submissionId: number;
        status: string;
        observations: string | null;
        week: number;
        year: number;
        companyId: number;
      }>
    > = {};

    for (const resp of allResponses as any[]) {
      if (!responseMap[resp.measureId]) responseMap[resp.measureId] = [];
      // Find the submission to get week/year/company
      const sub = filteredSubmissions.find(
        (s: any) => s.id === resp.submissionId
      );
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

    // O capítulo 5 não é um espelho do catálogo DCAPE. Só pode apresentar
    // medidas que tenham sido efetivamente registadas numa ficha semanal
    // aprovada, dentro do período escolhido pelo responsável.
    return measures
      .filter((m: any) => (responseMap[m.id] || []).length > 0)
      .map((m: any) => {
        const responses = responseMap[m.id] || [];
        const statuses = responses.map(r => r.status).filter(Boolean);

        // Determine dominant status
        const allNA = statuses.length > 0 && statuses.every(s => s === "NA");
        const hasNC = statuses.some(s => s === "NC");
        const allConform =
          statuses.length > 0 && statuses.every(s => s === "C" || s === "I");
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
          latestObservation:
            responses.find(r => r.observations)?.observations || "",
        };
      });
  }, [
    isOperationsReport,
    operationTransition,
    measures,
    filteredSubmissions,
    allResponses,
  ]);

  // Group compiled measures by section
  const measuresBySection = useMemo(() => {
    if (isOperationsReport)
      return compiledMeasures.length > 0
        ? [
            {
              id: "ops",
              name: "OPS — Medidas de Operação DCAPE",
              measures: compiledMeasures,
            },
          ]
        : [];
    if (!sections || !compiledMeasures.length) return [];
    return sections
      .map((sec: any) => ({
        ...sec,
        measures: compiledMeasures.filter((m: any) => m.sectionId === sec.id),
      }))
      .filter(s => s.measures.length > 0);
  }, [isOperationsReport, sections, compiledMeasures]);

  const weeklyFormsForRdcd = useMemo(() => {
    if (!filteredSubmissions.length || !allResponses || !measures) return [];
    const measureById = new Map(
      (measures as any[]).map(measure => [measure.id, measure])
    );
    return filteredSubmissions
      .map((submission: any) => ({
        submission,
        responses: (allResponses as any[])
          .filter(response => response.submissionId === submission.id)
          .map(response => ({
            ...response,
            measure: measureById.get(response.measureId),
          }))
          .filter(response => response.measure),
      }))
      .filter(item => item.responses.length > 0);
  }, [filteredSubmissions, allResponses, measures]);

  const projectChoices = projects.length > 0 ? projects : authorisedProjects;
  const availableProjects = projectChoices;
  const selectedProject =
    projectChoices.find(project => project.id === selectedProjects[0]) || null;
  const reportModel = getRdcdProjectModel(selectedProject?.code);
  const presentedReportModel = presentRdcdModel(
    selectedProject?.code,
    language
  );
  const reportLogoMediaUrl = (logoUrl: string) =>
    selectedProject
      ? `/api/rdcd/media/logo?projectId=${selectedProject.id}&key=${encodeURIComponent(logoUrl.replace(/^\/manus-storage\//, ""))}`
      : logoUrl;
  const reportFigureMediaUrl = (figureUrl: string) =>
    selectedProject
      ? `/api/rdcd/media/asset?projectId=${selectedProject.id}&key=${encodeURIComponent(figureUrl.replace(/^\/manus-storage\//, ""))}`
      : figureUrl;
  const usesSin02Template = selectedProject?.code === "SIN02";

  useEffect(() => {
    if (!projectWasChosen && activeProject) {
      setSelectedProjects(current =>
        current.length === 1 && current[0] === activeProject.id
          ? current
          : [activeProject.id]
      );
    }
  }, [activeProject?.id, activeProject?.code, projectWasChosen]);

  // Year options
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  function toggleProject(id: number) {
    setProjectWasChosen(true);
    const selected = projectChoices.find(project => project.id === id);
    const wasSelected = selectedProjects.includes(id);
    setSelectedProjects(wasSelected ? [] : [id]);
    if (!wasSelected && selected)
      setReportPhase(getRdcdProjectModel(selected.code).defaultPhase);
  }

  // Week date formatter
  function getWeekDates(year: number, week: number) {
    const jan4 = new Date(year, 0, 4);
    const dow = jan4.getDay() || 7;
    const mon = new Date(jan4);
    mon.setDate(jan4.getDate() - dow + 1 + (week - 1) * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fmt = (d: Date) =>
      `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    return { mon, sun, label: `S${week} — ${fmt(mon)} a ${fmt(sun)}` };
  }

  function serialiseSelections() {
    return Object.fromEntries(
      Object.entries(measureSelections).map(([measureId, selection]) => [
        measureId,
        {
          selectedWeeks: Array.from(new Set(selection.selectedWeeks)),
          selectedImageUrls: Array.from(new Set(selection.selectedImageUrls)),
          notes: selection.notes.trim(),
        },
      ])
    );
  }

  async function replaceReportLogo(index: number, file: File) {
    if (!selectedProject) {
      toast.error(t("Selecione um projeto antes de alterar os logótipos."));
      return;
    }
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error(t("O logótipo deve ser PNG ou JPG."));
      return;
    }
    try {
      const data = await fileToBase64(file);
      const uploaded = await uploadLogoMutation.mutateAsync({
        projectId: selectedProject.id,
        filename: file.name,
        mimeType: file.type,
        data,
      });
      setReportLogos(current =>
        current.map((logo, logoIndex) =>
          logoIndex === index
            ? { ...logo, url: uploaded.url, type: uploaded.type }
            : logo
        )
      );
      toast.success(t("Logótipo atualizado para este RDCD."));
    } catch (error: any) {
      toast.error(
        error?.message || t("Não foi possível atualizar o logótipo.")
      );
    }
  }

  async function addEditorialFigure(
    file: File,
    kind: ChapterFigure["kind"] = "image"
  ) {
    if (!selectedProject) {
      toast.error(t("Selecione um projeto antes de adicionar uma figura."));
      return;
    }
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error(t("A figura deve ser PNG ou JPG."));
      return;
    }
    try {
      const data = await fileToBase64(file);
      const uploaded = await uploadFigureMutation.mutateAsync({
        projectId: selectedProject.id,
        filename: file.name,
        mimeType: file.type,
        data,
      });
      updateActiveChapterBlock(current => ({
        ...current,
        figures: [
          ...current.figures,
          {
            id: createEditorialId("figure"),
            url: uploaded.url,
            type: uploaded.type,
            kind,
            caption: file.name.replace(/\.[^.]+$/, ""),
          },
        ],
      }));
      toast.success(
        t(
          kind === "chart"
            ? "Gráfico inserido no capítulo"
            : "Imagem inserida no capítulo"
        )
      );
    } catch (error: any) {
      toast.error(error?.message || t("Não foi possível adicionar a figura."));
    }
  }

  async function copySelectedEvidenceToChapter(image: {
    url: string;
    filename: string;
  }) {
    try {
      const response = await fetch(image.url, { credentials: "same-origin" });
      if (!response.ok) throw new Error("image-fetch-failed");
      const blob = await response.blob();
      const mimeType = blob.type === "image/png" ? "image/png" : "image/jpeg";
      await addEditorialFigure(
        new File([blob], image.filename || "evidencia-rdcd.jpg", {
          type: mimeType,
        }),
        "image"
      );
    } catch {
      toast.error(
        t("Não foi possível copiar a fotografia selecionada para o capítulo.")
      );
    }
  }

  async function saveDraft() {
    if (!selectedProject || !startWeek || !endWeek) {
      toast.error(
        t("Selecione um projeto e um período antes de guardar o rascunho.")
      );
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
        content: { ...content, chapterBlocks, reportLogos },
        selections: serialiseSelections(),
      });
      setDraftId(result.id);
      await utils.rdcd.list.invalidate({ projectId: selectedProject.id });
      toast.success(
        result.created
          ? t("Rascunho RDCD criado")
          : t("Rascunho RDCD atualizado")
      );
    } catch (error: any) {
      toast.error(
        error?.message || t("Não foi possível guardar o rascunho RDCD.")
      );
    } finally {
      setIsSavingDraft(false);
    }
  }

  function loadDraft(draft: any) {
    setDraftId(draft.id);
    setSelectedProjects([draft.projectId]);
    setProjectWasChosen(true);
    setSelectedYear(Number(draft.reportYear));
    setStartWeek(
      `${draft.reportYear}-W${String(draft.startWeek).padStart(2, "0")}`
    );
    setEndWeek(
      `${draft.reportYear}-W${String(draft.endWeek).padStart(2, "0")}`
    );
    setReportNumber(draft.reportNumber || "");
    setReportPhase(draft.reportPhase || "Execução da obra");
    setRevision(draft.revision || "00");
    setPreparedBy(draft.preparedBy || "");
    setReviewedBy(draft.reviewedBy || "");
    setBrandProfile(
      Object.prototype.hasOwnProperty.call(
        RDCD_BRAND_PROFILES,
        draft.brandProfile
      )
        ? draft.brandProfile
        : "startcampus_gleeds_quadrante"
    );
    const restoredLogos = Array.isArray(draft.content?.reportLogos)
      ? draft.content.reportLogos
          .filter(
            (logo: any) =>
              logo &&
              typeof logo.name === "string" &&
              typeof logo.url === "string" &&
              (logo.type === "png" || logo.type === "jpg")
          )
          .slice(0, 4)
          .map((logo: any) => ({
            name: logo.name,
            url: logo.url,
            type: logo.type,
            width: Number.isFinite(Number(logo.width))
              ? Math.max(40, Math.min(240, Number(logo.width)))
              : 120,
            height: Number.isFinite(Number(logo.height))
              ? Math.max(24, Math.min(120, Number(logo.height)))
              : 50,
          }))
      : [];
    setReportLogos(
      restoredLogos.length > 0
        ? restoredLogos
        : defaultReportLogos(
            Object.prototype.hasOwnProperty.call(
              RDCD_BRAND_PROFILES,
              draft.brandProfile
            )
              ? draft.brandProfile
              : "startcampus_gleeds_quadrante"
          )
    );
    setIncludePlans(Boolean(draft.includePlans));
    setIncludeWaste(Boolean(draft.includeWaste));
    setSelectedPlanIds(
      Array.isArray(draft.planIds)
        ? draft.planIds.map(Number).filter(Number.isFinite)
        : []
    );
    setContent({ ...EMPTY_CONTENT, ...(draft.content || {}) });
    const restoredBlocks: ChapterBlocks = { ...EMPTY_CHAPTER_BLOCKS };
    for (const key of Object.keys(EMPTY_CONTENT) as Array<keyof RdcdContent>) {
      const raw = draft.content?.chapterBlocks?.[key];
      restoredBlocks[key] = {
        summary:
          typeof raw?.summary === "string"
            ? raw.summary
            : typeof draft.content?.[key] === "string"
              ? draft.content[key]
              : "",
        keyPoints: Array.isArray(raw?.keyPoints)
          ? raw.keyPoints
              .filter((value: unknown) => typeof value === "string")
              .slice(0, 20)
          : [],
        sourceReferences: Array.isArray(raw?.sourceReferences)
          ? raw.sourceReferences
              .filter((value: unknown) => typeof value === "string")
              .slice(0, 30)
          : [],
        actions: Array.isArray(raw?.actions)
          ? raw.actions
              .filter((value: any) => value && typeof value.action === "string")
              .slice(0, 20)
              .map((value: any) => ({
                action: value.action,
                owner: typeof value.owner === "string" ? value.owner : "",
                dueDate: typeof value.dueDate === "string" ? value.dueDate : "",
                status: typeof value.status === "string" ? value.status : "",
              }))
          : [],
        figures: Array.isArray(raw?.figures)
          ? raw.figures
              .filter(
                (value: any) =>
                  value &&
                  typeof value.id === "string" &&
                  typeof value.url === "string" &&
                  /^\/manus-storage\/rdcd-assets\/\d+\/[A-Za-z0-9._-]+$/.test(
                    value.url
                  ) &&
                  (value.type === "png" || value.type === "jpg")
              )
              .slice(0, 12)
              .map((value: any) => ({
                id: value.id,
                url: value.url,
                type: value.type,
                kind: value.kind === "chart" ? "chart" : "image",
                caption: typeof value.caption === "string" ? value.caption : "",
              }))
          : [],
        tables: Array.isArray(raw?.tables)
          ? raw.tables
              .filter(
                (value: any) =>
                  value &&
                  typeof value.id === "string" &&
                  Array.isArray(value.columns) &&
                  Array.isArray(value.rows)
              )
              .slice(0, 8)
              .map((value: any) => ({
                id: value.id,
                title: typeof value.title === "string" ? value.title : "",
                columns: value.columns
                  .filter((column: unknown) => typeof column === "string")
                  .slice(0, 6),
                rows: value.rows
                  .filter((row: unknown) => Array.isArray(row))
                  .slice(0, 20)
                  .map((row: unknown[]) =>
                    row
                      .filter((cell: unknown) => typeof cell === "string")
                      .slice(0, 6)
                  ),
              }))
              .filter((table: ChapterTable) => table.columns.length > 0)
          : [],
      };
    }
    setChapterBlocks(restoredBlocks);
    const restored: Record<number, MeasureSelection> = {};
    for (const [measureId, selection] of Object.entries(
      draft.selections || {}
    )) {
      const item: any = selection;
      restored[Number(measureId)] = {
        selectedWeeks: Array.isArray(item.selectedWeeks)
          ? item.selectedWeeks.filter(
              (value: unknown) => typeof value === "string"
            )
          : [],
        selectedImageUrls: Array.isArray(item.selectedImageUrls)
          ? item.selectedImageUrls.filter(
              (value: unknown) => typeof value === "string"
            )
          : [],
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
        toast.error(
          t("Selecione um projeto e um período válidos antes de gerar o RDCD.")
        );
        return;
      }
      const projNames = `${selectedProject.code} — ${selectedProject.name}`;
      const weeklyRows = buildRdcdWeeklyRows(
        filteredSubmissions as any[],
        (allResponses || []) as any[],
        measures || [],
        sections || [],
        reportPhase
      );
      const phaseRows = buildRdcdPhaseRows(
        (allResponses || []) as any[],
        measures || [],
        sections || []
      );
      const nonConformityRows = buildRdcdNonConformityRows(
        (allResponses || []) as any[],
        measures || [],
        filteredSubmissions as any[]
      );
      const operationRows = compiledMeasures.map((measure: any) => [
        String(measure.number),
        String(measure.description || "").slice(0, 190),
        statusLabels[measure.autoStatus] || measure.status || "—",
        measure.ownerName || "Por definir",
        measure.supportName || "Por definir",
        measure.latestUpdate?.updateText || "Sem status update registado",
      ]);
      const periodLabel = `Semana ${startWeek.split("-W")[1]} a Semana ${endWeek.split("-W")[1]} de ${selectedYear}`;
      const totals = weeklyRows.reduce(
        (acc, row) => ({
          i: acc.i + row.i,
          c: acc.c + row.c,
          nc: acc.nc + row.nc,
          na: acc.na + row.na,
        }),
        { i: 0, c: 0, nc: 0, na: 0 }
      );
      const metadata = usesSin02Template ? SIN02_RDCD_METADATA : null;
      const resolvedReportNumber =
        reportNumber.trim() || `RDCD-${selectedProject.code}-001`;
      const selectedPlans = (plans || []).filter((plan: any) =>
        selectedPlanIds.includes(plan.id)
      );
      const profile = RDCD_BRAND_PROFILES[brandProfile];
      const reportIdentityLogos =
        reportLogos.length > 0 ? reportLogos : profile.logos;
      const submissionById = new Map(
        filteredSubmissions.map((submission: any) => [
          submission.id,
          submission,
        ])
      );
      const selectedMeasures = compiledMeasures
        .map((measure: any) => {
          const selection = measureSelections[measure.id];
          if (!selection) return null;
          const selectedWeeks = new Set(selection.selectedWeeks);
          const responses = isOperationsReport
            ? []
            : measure.responses.filter((response: any) =>
                selectedWeeks.has(
                  `${response.year}-W${String(response.week).padStart(2, "0")}`
                )
              );
          const images = (evidenceByMeasure[measure.id] || []).filter(image =>
            selection.selectedImageUrls.includes(image.url)
          );
          const selectedForReport = isOperationsReport
            ? selection.selectedWeeks.length > 0
            : responses.length > 0;
          if (
            !selectedForReport &&
            images.length === 0 &&
            !selection.notes.trim()
          )
            return null;
          return { measure, selection, responses, images };
        })
        .filter(Boolean) as Array<{
        measure: any;
        selection: MeasureSelection;
        responses: any[];
        images: Array<{
          url: string;
          filename: string;
          mimeType?: string | null;
        }>;
      }>;

      const chapterDetails = (key: keyof RdcdContent) => {
        const block = chapterBlocks[key];
        if (!block) return [] as any[];
        const parts: any[] = [];
        const keyPoints = block.keyPoints
          .map(value => value.trim())
          .filter(Boolean);
        const sources = block.sourceReferences
          .map(value => value.trim())
          .filter(Boolean);
        const actions = block.actions.filter(
          item =>
            item.action.trim() ||
            item.owner.trim() ||
            item.dueDate.trim() ||
            item.status.trim()
        );
        const figures = block.figures.filter(
          figure => figure.caption.trim() || figure.url
        );
        const tables = block.tables.filter(table => table.columns.length > 0);
        if (keyPoints.length > 0) {
          parts.push(
            new Paragraph({
              text: "Pontos-chave",
              heading: HeadingLevel.HEADING_2,
            })
          );
          parts.push(
            ...keyPoints.map(point => new Paragraph({ text: `• ${point}` }))
          );
        }
        if (sources.length > 0) {
          parts.push(
            new Paragraph({
              text: "Fontes e referências",
              heading: HeadingLevel.HEADING_2,
            })
          );
          parts.push(
            rdcdTable(
              ["Referência"],
              sources.map(source => [source])
            )
          );
        }
        if (actions.length > 0) {
          parts.push(
            new Paragraph({
              text: "Ações, responsabilidades e prazos",
              heading: HeadingLevel.HEADING_2,
            })
          );
          parts.push(
            rdcdTable(
              ["Ação", "Responsável", "Prazo", "Estado"],
              actions.map(item => [
                item.action || "—",
                item.owner || "—",
                item.dueDate || "—",
                item.status || "—",
              ])
            )
          );
        }
        for (const figure of figures) {
          const asset = assets.get(reportFigureMediaUrl(figure.url));
          parts.push(
            new Paragraph({
              text: figure.kind === "chart" ? "Gráfico" : "Figura",
              heading: HeadingLevel.HEADING_2,
            })
          );
          if (asset) {
            parts.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: asset.data,
                    transformation: { width: 470, height: 300 },
                    type: asset.type,
                  }),
                ],
              })
            );
          } else {
            parts.push(
              new Paragraph({
                text: "[Figura selecionada mas não incorporada — confirmar acesso ao ficheiro antes da emissão.]",
              })
            );
          }
          parts.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: figure.caption || "Sem legenda",
                  size: 16,
                  italics: true,
                  color: "666666",
                }),
              ],
            })
          );
        }
        for (const table of tables) {
          const normalizedRows = table.rows.map(row =>
            table.columns.map((_, index) => row[index] || "—")
          );
          parts.push(
            new Paragraph({
              text: table.title || "Tabela",
              heading: HeadingLevel.HEADING_2,
            })
          );
          parts.push(
            rdcdTable(
              table.columns,
              normalizedRows.length > 0
                ? normalizedRows
                : [table.columns.map(() => "—")]
            )
          );
        }
        return parts;
      };

      const assets = new Map<
        string,
        { data: ArrayBuffer; type: "png" | "jpg" }
      >();
      const assetRequests = [
        ...reportIdentityLogos.map(logo => ({
          url: reportLogoMediaUrl(logo.url),
          type: logo.type,
        })),
        ...Object.values(chapterBlocks).flatMap(block =>
          block.figures.map(figure => ({
            url: reportFigureMediaUrl(figure.url),
            type: figure.type,
          }))
        ),
        ...selectedMeasures.flatMap(item =>
          item.images.map(image => ({
            url: image.url,
            type:
              image.mimeType === "image/png" ||
              image.url.toLowerCase().endsWith(".png")
                ? ("png" as const)
                : ("jpg" as const),
          }))
        ),
      ].filter(
        (item, index, values) =>
          values.findIndex(value => value.url === item.url) === index
      );
      if (assetRequests.length > 0) {
        toast.info(
          `${t("A descarregar")} ${assetRequests.length} ${t("imagem(ns) selecionada(s)...")}`
        );
        for (let index = 0; index < assetRequests.length; index += 8) {
          const batch = assetRequests.slice(index, index + 8);
          const results = await Promise.allSettled(
            batch.map(async asset => {
              const response = await fetch(asset.url);
              if (!response.ok) return null;
              return { ...asset, data: await response.arrayBuffer() };
            })
          );
          for (const result of results) {
            if (result.status === "fulfilled" && result.value)
              assets.set(result.value.url, {
                data: result.value.data,
                type: result.value.type,
              });
          }
        }
      }

      const technicalRows = [
        ["Modelo de relatório", reportModel.label],
        ["Designação do relatório", reportModel.reportTitle],
        ["Projeto", metadata?.projectName || projNames],
        ["Fontes de origem", reportModel.sourceLabel],
        ...(isOperationsReport
          ? [
              ["Âmbito OPS", "Medidas de operação DCAPE do SIN01/NEST"],
              [
                "Dados de desempenho",
                operationOverview?.hasDemoData
                  ? "Inclui dados demonstrativos — confirmar antes de emissão"
                  : "Dados operacionais do período, quando disponíveis",
              ],
            ]
          : [
              [
                "Proponente",
                metadata?.proponent ||
                  "[A confirmar pelo responsável do relatório]",
              ],
              [
                "N.º do TUA",
                metadata?.tua || "[A preencher para este projeto]",
              ],
              [
                "Código APA",
                metadata?.apaCode || "[A preencher para este projeto]",
              ],
              [
                "Processo de AIA / RECAPE",
                metadata?.aiaRecape || "[A preencher para este projeto]",
              ],
              ["DIA", metadata?.dia || "[A preencher para este projeto]"],
              ["DCAPE", metadata?.dcape || "[A preencher para este projeto]"],
              [
                "Entidade licenciadora",
                metadata?.licensingEntity || "[A preencher para este projeto]",
              ],
            ]),
        ["Fase da obra reportada", reportPhase],
        ["N.º do relatório", resolvedReportNumber],
        ["Período de reporte", periodLabel],
        [
          isOperationsReport
            ? "Medidas OPS incluídas"
            : "Fichas aprovadas incluídas",
          isOperationsReport
            ? `${selectedMeasures.length} de ${compiledMeasures.length} medidas selecionadas`
            : weeklyRows.length > 0
              ? weeklyRows.map(row => `S${row.week} (${row.period})`).join("; ")
              : "Sem fichas aprovadas no período",
        ],
        [
          "Elaborado por",
          preparedBy.trim() ||
            "[Nome / função — Equipa Ambiental Start Campus]",
        ],
        ["Revisto / aprovado por", reviewedBy.trim() || "[Nome / função]"],
        ["Data de elaboração", new Date().toLocaleDateString("pt-PT")],
        ["Revisão", revision.trim() || "00"],
        ["Perfil institucional", profile.label],
      ];
      const textOr = (entered: string, fallback: string) =>
        entered.trim() || fallback;
      const selectedPhotoAnnex: any[] = [];
      for (const item of selectedMeasures) {
        if (item.images.length === 0) continue;
        selectedPhotoAnnex.push(
          new Paragraph({
            text: `Medida ${item.measure.number || item.measure.id} — ${(item.measure.description || "").slice(0, 160)}`,
            heading: HeadingLevel.HEADING_2,
          })
        );
        for (const image of item.images) {
          const asset = assets.get(image.url);
          if (!asset) {
            selectedPhotoAnnex.push(
              new Paragraph({
                text: `[Fotografia não incorporada: ${image.filename}]`,
              })
            );
            continue;
          }
          selectedPhotoAnnex.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: asset.data,
                  transformation: { width: 450, height: 320 },
                  type: asset.type,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: image.filename,
                  size: 16,
                  italics: true,
                  color: "666666",
                }),
              ],
            })
          );
        }
      }
      const logoRuns = (scale = 1) =>
        reportIdentityLogos.flatMap((logo, index) => {
          const asset = assets.get(reportLogoMediaUrl(logo.url));
          if (!asset)
            return [
              new TextRun({
                text: index ? `   ${logo.name}` : logo.name,
                bold: true,
                color: "0A3638",
              }),
            ];
          return [
            new ImageRun({
              data: asset.data,
              transformation: {
                width: Math.round(logo.width * scale),
                height: Math.round(logo.height * scale),
              },
              type: asset.type,
            }),
            new TextRun({ text: "   " }),
          ];
        });
      const coverLogos = logoRuns();
      const headerLogos = logoRuns(0.52);
      const indexLines = isOperationsReport
        ? [
            "1 Introdução e âmbito da operação",
            "2 Caracterização do NEST em operação",
            "3 Ponto de situação operacional",
            "4 Demonstração do cumprimento das medidas OPS DCAPE",
            "5 Estado detalhado das medidas OPS DCAPE",
            "6 Ações corretivas e seguimento",
            "7 Sustentabilidade e desempenho operacional",
            "8 Questões em aberto de períodos anteriores",
            "9 Programa de trabalhos e manutenção",
            "10 Reclamações e contactos com o público",
            "11 Conclusões",
            "12 Anexos",
          ]
        : [
            "1 Introdução",
            "2 Breve descrição do projeto",
            "3 Ponto de situação do desenvolvimento do projeto",
            "4 Demonstração do cumprimento das condições ambientais",
            "5 Compilação das fichas semanais aprovadas",
            "6 Ações corretivas e seguimento",
            "7 Monitorização",
            "8 Questões em aberto de períodos anteriores",
            "9 Programa de trabalhos",
            "10 Reclamações e contactos com o público",
            "11 Conclusões",
            "12 Anexos",
          ];

      const document = new Document({
        sections: [
          {
            properties: { titlePage: true },
            headers: {
              first: new Header({ children: [] }),
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: headerLogos,
                  }),
                ],
              }),
            },
            footers: {
              first: new Footer({ children: [] }),
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: "Start Campus  |  info@startcampus.pt  |  RDCD  |  Página ",
                      }),
                      new TextRun({ children: [PageNumber.CURRENT] }),
                    ],
                  }),
                ],
              }),
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: coverLogos,
              }),
              new Paragraph({ text: "" }),
              new Paragraph({ text: "" }),
              new Paragraph({ text: "" }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: metadata?.projectName || projNames,
                    size: 28,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: reportModel.reportTitle.toUpperCase(),
                    size: 28,
                    bold: true,
                    color: "0A3638",
                  }),
                ],
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: reportPhase, size: 24, bold: true }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${resolvedReportNumber} — ${periodLabel}`,
                    size: 24,
                    bold: true,
                    color: "08A56A",
                  }),
                ],
              }),
              new Paragraph({ text: "" }),
              rdcdTable(
                ["REVISÃO", "DATA", "DESCRIÇÃO"],
                [
                  [
                    revision.trim() || "00",
                    new Date().toLocaleDateString("pt-PT"),
                    "Emissão para revisão técnica e aprovação humana",
                  ],
                ]
              ),
              new Paragraph({ children: [new PageBreak()] }),
              new Paragraph({
                text: "ÍNDICE GERAL",
                heading: HeadingLevel.HEADING_1,
              }),
              new TableOfContents(
                "Índice geral — atualizar no Word antes da emissão",
                { hyperlink: true, headingStyleRange: "1-3" }
              ),
              new Paragraph({ text: "Estrutura de referência do relatório" }),
              ...indexLines.map(
                (line, index) =>
                  new Paragraph({
                    text: `${line} ................................................................ ${index + 1}`,
                  })
              ),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: "ÍNDICE DE TABELAS",
                heading: HeadingLevel.HEADING_2,
              }),
              new Paragraph({
                text: isOperationsReport
                  ? "Tabela 1 — Medidas OPS DCAPE incluídas"
                  : "Tabela 1 — Fichas semanais aprovadas incluídas",
              }),
              new Paragraph({
                text: "Tabela 2 — Matriz demonstrativa do cumprimento das condições da DCAPE",
              }),
              new Paragraph({
                text: "Tabela 3 — Registo de resíduos e-GAR do período",
              }),
              new Paragraph({ children: [new PageBreak()] }),
              new Paragraph({
                text: "Ficha Técnica do Relatório",
                heading: HeadingLevel.HEADING_1,
              }),
              rdcdTable(["Campo", "Informação"], technicalRows),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: isOperationsReport
                  ? "1. Introdução e Âmbito da Operação"
                  : "1. Introdução",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: textOr(
                  content.introduction,
                  isOperationsReport
                    ? `O presente relatório operacional DCAPE é elaborado para ${projNames}, no período ${periodLabel}. Consolida o acompanhamento das medidas OPS de exploração, respetivos responsáveis, status updates e evidências. A emissão e assinatura permanecem sujeitas a revisão humana.`
                    : `O presente Relatório de Demonstração do Cumprimento da DCAPE é elaborado para ${metadata?.projectName || projNames}, no período ${periodLabel}. Consolida ${weeklyRows.length} ficha(s) de controlo semanal aprovada(s). A emissão e assinatura permanecem sujeitas a revisão humana.`
                ),
              }),
              ...chapterDetails("introduction"),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: isOperationsReport
                  ? "2. Caracterização do NEST em Operação"
                  : "2. Breve Descrição do Projeto",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: isOperationsReport
                  ? "Caracterize a infraestrutura, sistemas operacionais, âmbito de exploração e fontes de dados utilizadas no período. Esta secção deve ser validada pela equipa técnica antes da emissão."
                  : metadata
                    ? `${metadata.projectName} encontra-se enquadrado no TUA n.º ${metadata.tua}, com código APA ${metadata.apaCode}. A confirmação final de números de processo, datas e vigência deve ser feita face ao TUA em vigor na data de emissão.`
                    : "[A completar pelo responsável com os elementos próprios deste projeto: TUA, AIA/RECAPE, DIA, DCAPE e entidade licenciadora.]",
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: isOperationsReport
                  ? "3. Ponto de Situação Operacional"
                  : "3. Ponto de Situação do Desenvolvimento do Projeto",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: textOr(
                  content.projectStatus,
                  isOperationsReport
                    ? "Descreva as condições de operação, alterações relevantes, incidentes, manutenção e eventos do período de reporte."
                    : "Descreva as atividades, frentes de obra e alterações relevantes ocorridas no período de reporte."
                ),
              }),
              rdcdTable(
                isOperationsReport
                  ? ["Indicador", "Valor mais recente", "Origem"]
                  : ["Sem.", "Período", "Ficha aprovada", "I", "C", "NC", "NA"],
                isOperationsReport
                  ? ["pue", "wue", "cue", "cop"].map(code => [
                      code.toUpperCase(),
                      operationOverview?.latest?.[code]?.value?.toString() ||
                        "—",
                      operationOverview?.latest?.[code]?.source ||
                        "Sem leitura disponível",
                    ])
                  : weeklyRows.length > 0
                    ? weeklyRows.map(row => [
                        String(row.week),
                        row.period,
                        row.reference,
                        String(row.i),
                        String(row.c),
                        String(row.nc),
                        String(row.na),
                      ])
                    : [
                        [
                          "—",
                          "—",
                          "Sem fichas aprovadas no período",
                          "0",
                          "0",
                          "0",
                          "0",
                        ],
                      ]
              ),
              ...chapterDetails("projectStatus"),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: isOperationsReport
                  ? "4. Demonstração do Cumprimento das Medidas OPS DCAPE"
                  : "4. Demonstração do Cumprimento das Condições Ambientais",
                heading: HeadingLevel.HEADING_1,
              }),
              rdcdTable(
                isOperationsReport
                  ? ["Estado", "N.º de medidas"]
                  : [
                      "Fase / grupo DCAPE",
                      "N.º de medidas",
                      "I",
                      "C",
                      "NC",
                      "NA",
                    ],
                isOperationsReport
                  ? [
                      ["Reportadas", String(opsCompletedCount)],
                      ["Em acompanhamento", String(opsPendingCount)],
                      ["Total OPS", String(compiledMeasures.length)],
                    ]
                  : phaseRows.map(row => [
                      row.section,
                      String(row.totalMeasures),
                      String(row.i),
                      String(row.c),
                      String(row.nc),
                      String(row.na),
                    ])
              ),
              new Paragraph({
                text: isOperationsReport
                  ? "Medidas OPS bloqueadas ou com seguimento pendente"
                  : "Medidas com registo de Não Conformidade ou observações relevantes",
                heading: HeadingLevel.HEADING_2,
              }),
              rdcdTable(
                isOperationsReport
                  ? [
                      "N.º",
                      "Medida OPS",
                      "Estado",
                      "Responsável",
                      "Último update",
                    ]
                  : [
                      "N.º",
                      "Medida / grupo",
                      "Semana / ficha",
                      "Registo",
                      "Seguimento",
                    ],
                isOperationsReport
                  ? operationRows.filter(
                      (row: string[]) =>
                        !["Cumprido", "Reportado"].includes(row[2])
                    ).length > 0
                    ? operationRows.filter(
                        (row: string[]) =>
                          !["Cumprido", "Reportado"].includes(row[2])
                      )
                    : [
                        [
                          "—",
                          "Sem medidas OPS pendentes ou bloqueadas.",
                          "—",
                          "—",
                          "—",
                        ],
                      ]
                  : nonConformityRows.length > 0
                    ? nonConformityRows.map(row => [
                        String(row.number),
                        row.description.slice(0, 180),
                        row.reference,
                        `${row.finding}: ${row.observation}`,
                        "A confirmar no ponto 6",
                      ])
                    : [
                        [
                          "—",
                          "Sem não conformidades ou observações relevantes registadas.",
                          "—",
                          "—",
                          "—",
                        ],
                      ]
              ),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: isOperationsReport
                  ? "5. Estado Detalhado das Medidas OPS DCAPE"
                  : "5. Compilação das Fichas Semanais",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: isOperationsReport
                  ? "Inclui exclusivamente as medidas OPS, evidências e notas selecionadas pelo responsável. A seleção não altera o acompanhamento de origem nem substitui a validação técnica."
                  : "Inclui exclusivamente as semanas, notas e evidências selecionadas pelo responsável na aplicação. A seleção não altera as fichas de origem nem substitui a validação técnica.",
              }),
              rdcdTable(
                isOperationsReport
                  ? [
                      "Medida OPS",
                      "Período",
                      "Estado",
                      "Responsável",
                      "Status update / nota editorial",
                    ]
                  : [
                      "Medida",
                      "Semanas selecionadas",
                      "Estados",
                      "Atualização / nota editorial",
                    ],
                selectedMeasures.length > 0
                  ? selectedMeasures.map(item => [
                      `${item.measure.number || item.measure.id} — ${(item.measure.description || "").slice(0, 140)}`,
                      isOperationsReport
                        ? periodLabel
                        : item.responses.length > 0
                          ? item.responses
                              .map(
                                response => `S${response.week}/${response.year}`
                              )
                              .join(", ")
                          : "Sem semanas selecionadas",
                      isOperationsReport
                        ? statusLabels[item.measure.autoStatus] ||
                          item.measure.status ||
                          "—"
                        : item.responses.length > 0
                          ? item.responses
                              .map(response => response.status || "—")
                              .join(", ")
                          : "—",
                      ...(isOperationsReport
                        ? [item.measure.ownerName || "Por definir"]
                        : []),
                      item.selection.notes.trim() ||
                        item.measure.latestUpdate?.updateText ||
                        "—",
                    ])
                  : [
                      isOperationsReport
                        ? [
                            "—",
                            "Nenhuma medida OPS foi selecionada para compilar.",
                            "—",
                            "—",
                            "—",
                          ]
                        : [
                            "—",
                            "Nenhuma medida/semana foi selecionada para compilar.",
                            "—",
                            "—",
                          ],
                    ]
              ),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: "6. Ações Corretivas e Seguimento",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: textOr(
                  content.correctiveActions,
                  nonConformityRows.length > 0
                    ? "As ações corretivas associadas às não conformidades devem ser confirmadas e completadas pelo responsável técnico antes da emissão."
                    : "Não foram identificadas não conformidades no conjunto de fichas aprovado selecionado."
                ),
              }),
              ...chapterDetails("correctiveActions"),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: isOperationsReport
                  ? "7. Sustentabilidade e Desempenho Operacional"
                  : "7. Monitorização",
                heading: HeadingLevel.HEADING_1,
              }),
              rdcdTable(
                isOperationsReport
                  ? [
                      "Indicador",
                      "Valor mais recente",
                      "Qualidade / origem",
                      "Observação",
                    ]
                  : [
                      "Tipo de monitorização",
                      "Periodicidade",
                      "Situação / resultado",
                      "Referência de anexo",
                    ],
                isOperationsReport
                  ? ["pue", "wue", "cue", "cop"].map(code => [
                      code.toUpperCase(),
                      operationOverview?.latest?.[code]?.value?.toString() ||
                        "—",
                      operationOverview?.latest?.[code]?.dataQuality ||
                        "Sem leitura disponível",
                      operationOverview?.hasDemoData
                        ? "Dados demonstrativos: validar antes de emissão"
                        : "—",
                    ])
                  : includePlans && selectedPlans.length > 0
                    ? selectedPlans.map((plan: any) => [
                        plan.name,
                        plan.periodicity || "—",
                        plan.submissionStatus === "delivered"
                          ? "Entregue"
                          : plan.submissionStatus === "submitted"
                            ? "Submetido"
                            : "Pendente",
                        plan.submittedFileUrl
                          ? "Registo no repositório documental"
                          : "A completar",
                      ])
                    : [
                        [
                          "Sem planos selecionados",
                          "—",
                          "Não incluído neste relatório",
                          "—",
                        ],
                      ]
              ),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: "8. Questões em Aberto Relativas a Períodos Anteriores",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: textOr(
                  content.openIssues,
                  "Sem questões anteriores registadas neste rascunho. Confirmar com o responsável técnico antes de emissão."
                ),
              }),
              ...chapterDetails("openIssues"),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: isOperationsReport
                  ? "9. Programa de Trabalhos e Manutenção"
                  : "9. Programa de Trabalhos",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: textOr(
                  content.worksProgramme,
                  isOperationsReport
                    ? "Indicar manutenção planeada, intervenções, próximos marcos operacionais e respetivas fontes controladas."
                    : "Indicar o programa de trabalhos aplicável ao período e anexar a versão controlada no repositório documental."
                ),
              }),
              ...chapterDetails("worksProgramme"),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: "10. Reclamações e Contactos com o Público",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: textOr(
                  content.publicContacts,
                  "Sem contactos ou reclamações registados neste rascunho. Confirmar antes da emissão."
                ),
              }),
              ...chapterDetails("publicContacts"),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: "11. Conclusões",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: textOr(
                  content.conclusions,
                  isOperationsReport
                    ? `No período ${periodLabel}, foram avaliadas ${compiledMeasures.length} medidas OPS DCAPE: ${opsCompletedCount} reportadas e ${opsPendingCount} em acompanhamento. O conteúdo, indicadores e evidências devem ser revistos e aprovados pelo responsável técnico antes da emissão.`
                    : `No período ${periodLabel}, foram consolidadas ${weeklyRows.length} ficha(s) aprovada(s), com ${totals.i} registo(s) Implementada(s), ${totals.c} Conforme(s), ${totals.nc} Não Conforme(s) e ${totals.na} Não Aplicável(eis). O conteúdo deve ser revisto e aprovado pelo responsável técnico antes da emissão.`
                ),
              }),
              ...chapterDetails("conclusions"),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: isOperationsReport
                  ? "Anexo I — Matriz das Medidas OPS DCAPE"
                  : "Anexo I — Referência às Fichas de Controlo de Medidas",
                heading: HeadingLevel.HEADING_1,
              }),
              ...(isOperationsReport
                ? [
                    new Paragraph({
                      text: "Matriz completa de medidas OPS, respetivo estado, responsável, suporte e último update disponível à data de emissão.",
                    }),
                    rdcdTable(
                      [
                        "N.º",
                        "Medida OPS",
                        "Estado",
                        "Responsável",
                        "Suporte",
                        "Último update",
                      ],
                      operationRows.length > 0
                        ? operationRows
                        : [
                            [
                              "—",
                              "Sem medidas OPS disponíveis.",
                              "—",
                              "—",
                              "—",
                              "—",
                            ],
                          ]
                    ),
                  ]
                : [
                    new Paragraph({
                      text:
                        weeklyRows.length > 0
                          ? `Fichas aprovadas do período, mantidas no repositório documental: ${weeklyRows.map(row => row.reference).join(", ")}.`
                          : "Sem fichas aprovadas selecionadas.",
                    }),
                  ]),
              ...(selectedPhotoAnnex.length > 0
                ? [
                    new Paragraph({ text: "" }),
                    new Paragraph({
                      text: "Anexo II — Registo Fotográfico Selecionado",
                      heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                      text: isOperationsReport
                        ? "Fotografias selecionadas por medida OPS no rascunho. Os originais permanecem associados ao acompanhamento de fases e medidas."
                        : "Fotografias selecionadas por medida e semana no rascunho RDCD. As imagens originais permanecem associadas às fichas de controlo de origem.",
                    }),
                    ...selectedPhotoAnnex,
                  ]
                : []),
              ...(includeWaste
                ? [
                    new Paragraph({ text: "" }),
                    new Paragraph({
                      text: "Anexo III — Registo de Resíduos e-GAR do Período",
                      heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                      text: "Tabela gerada a partir dos e-GARs registados na plataforma no período. A quantidade corrigida, quando existente, prevalece sobre a quantidade inicial.",
                    }),
                    rdcdTable(
                      [
                        "ID e-GAR",
                        "Data de recolha",
                        "Código LER",
                        "Tipo de resíduo",
                        "Quantidade (t)",
                        "Destino",
                        "Empresa",
                      ],
                      wasteRows.length > 0
                        ? wasteRows.map((row: any) => [
                            row.egarId,
                            new Date(Number(row.date)).toLocaleDateString(
                              "pt-PT"
                            ),
                            row.lerCode,
                            row.designation,
                            String(row.quantity),
                            row.destination,
                            row.companyName,
                          ])
                        : [
                            [
                              "—",
                              "—",
                              "—",
                              "Sem e-GARs registados no período selecionado.",
                              "—",
                              "—",
                              "—",
                            ],
                          ]
                    ),
                  ]
                : []),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(document);
      const filename = `RDCD_${projNames.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_S${startWeek.split("-W")[1]}-S${endWeek.split("-W")[1]}_${selectedYear}.docx`;
      saveAs(blob, filename);
      toast.success(t("RDCD gerado com sucesso!"));
    } catch (error: any) {
      toast.error(
        `${t("Erro ao gerar RDCD")}: ${error?.message || t("Erro inesperado")}`
      );
    } finally {
      setIsGenerating(false);
    }
  }

  if (!isAdminOrDono) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-muted-foreground">
            {t("Acesso restrito a Admin e Dono de Obra.")}
          </p>
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
  const responseStatusLabels: Record<string, string> = {
    I: t("Implementada"),
    C: t("Conforme"),
    NC: t("Não Conforme"),
    NA: t("N/A"),
  };
  const activeEditorial =
    EDITORIAL_SECTIONS.find(
      section => section.key === activeEditorialSection
    ) || EDITORIAL_SECTIONS[0];
  const completedEditorialSections = EDITORIAL_SECTIONS.filter(
    section => content[section.key].trim().length > 0
  ).length;
  const selectedMeasureCount = Object.values(measureSelections).filter(
    selection => selection.selectedWeeks.length > 0
  ).length;
  const selectedPhotoCount = Object.values(measureSelections).reduce(
    (total, selection) => total + selection.selectedImageUrls.length,
    0
  );
  const opsCompletedCount = compiledMeasures.filter(
    (measure: any) => measure.status === "concluido"
  ).length;
  const opsPendingCount = compiledMeasures.filter(
    (measure: any) => measure.status !== "concluido"
  ).length;
  const opsEvidenceCount = Object.values(evidenceByMeasure).reduce(
    (total, evidence) => total + evidence.length,
    0
  );
  const chapterDataContext = isOperationsReport
    ? [
        {
          label: t("Modelo do relatório"),
          value: presentedReportModel.label,
          detail: t("Configuração específica do SIN01/NEST"),
        },
        {
          label: t("Medidas OPS"),
          value: `${compiledMeasures.length}`,
          detail: `${opsCompletedCount} ${t("reportadas")} · ${opsPendingCount} ${t("em acompanhamento")}`,
        },
        {
          label: t("Evidências"),
          value: `${opsEvidenceCount}`,
          detail: t("Disponíveis no acompanhamento das medidas"),
        },
        {
          label: t("Telemetria"),
          value: operationOverview?.hasDemoData
            ? t("Dados demonstrativos")
            : t("Dados do cockpit"),
          detail: t("Separada da redação editorial"),
        },
      ]
    : [
        {
          label: t("Fichas aprovadas"),
          value: `${filteredSubmissions.length}`,
          detail: t("Fonte exclusiva do capítulo 5"),
        },
        {
          label: t("Medidas com registo"),
          value: `${compiledMeasures.length}`,
          detail: t("Apenas respostas aprovadas no período"),
        },
        {
          label: t("Planos selecionados"),
          value: `${selectedPlanIds.length}`,
          detail: t("Acompanhamento de monitorização"),
        },
        {
          label: t("e-GARs"),
          value: includeWaste ? `${wasteRows.length}` : "—",
          detail: t("Anexo de resíduos opcional"),
        },
      ];
  const activeChapterBlock =
    chapterBlocks[activeEditorialSection] || EMPTY_CHAPTER_BLOCK;
  const curationPreviewMeasure =
    compiledMeasures.find(
      (measure: any) => measure.id === activeMeasurePreviewId
    ) || compiledMeasures[0];
  const curationPreviewSelection = curationPreviewMeasure
    ? measureSelections[curationPreviewMeasure.id] || {
        selectedWeeks: [],
        selectedImageUrls: [],
        notes: "",
      }
    : null;
  const curationPreviewResponses = curationPreviewMeasure
    ? isOperationsReport
      ? []
      : curationPreviewMeasure.responses.filter((response: any) =>
          curationPreviewSelection?.selectedWeeks.includes(
            `${response.year}-W${String(response.week).padStart(2, "0")}`
          )
        )
    : [];
  const curationPreviewImages = curationPreviewMeasure
    ? (evidenceByMeasure[curationPreviewMeasure.id] || []).filter(image =>
        curationPreviewSelection?.selectedImageUrls.includes(image.url)
      )
    : [];
  const selectedMeasureImageLibrary = compiledMeasures.flatMap(
    (measure: any) => {
      const selection = measureSelections[measure.id];
      if (!selection?.selectedImageUrls.length) return [];
      return (evidenceByMeasure[measure.id] || [])
        .filter(image => selection.selectedImageUrls.includes(image.url))
        .map(image => ({ ...image, measureNumber: measure.number }));
    }
  );
  const updateActiveChapterBlock = (
    update: (current: ChapterBlock) => ChapterBlock
  ) => {
    setChapterBlocks(current => ({
      ...current,
      [activeEditorialSection]: update(
        current[activeEditorialSection] || EMPTY_CHAPTER_BLOCK
      ),
    }));
  };
  const updateChapterSummary = (summary: string) => {
    updateActiveChapterBlock(current => ({ ...current, summary }));
    setContent(current => ({ ...current, [activeEditorialSection]: summary }));
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-5 pb-8">
        <StandPageHeader
          tone="governance"
          eyebrow="COMPLIANCE REPORTING"
          title={t(
            selectedProject
              ? presentedReportModel.label
              : "RDCD — Relatório de Demonstração de Cumprimento"
          )}
          description={t(
            selectedProject
              ? presentedReportModel.guidance
              : "Organize o período, selecione evidências e complete os capítulos antes da validação técnica."
          )}
          context={selectedProject?.code || t("Por configurar")}
          image={rdcdImage.url}
          imagePosition={rdcdImage.position}
          imageMode={rdcdImage.mode}
          actions={
            <StandStatusBadge
              label={
                step === 5
                  ? t("Pronto para revisão")
                  : `${t("Passo")} ${step} ${t("de")} ${STEPS.length}`
              }
              tone={step === 5 ? "success" : "info"}
            />
          }
        >
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span>1 relatório = 1 projeto</span>
            <span>•</span>
            <span>{t("Dados aprovados e rastreáveis")}</span>
            <span>•</span>
            <span>{t("Geração Word sob controlo humano")}</span>
          </div>
        </StandPageHeader>

        {/* Wizard Steps */}
        <div className="stand-surface flex overflow-x-auto p-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex min-w-fit items-center">
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${step === s.id ? "bg-primary text-primary-foreground shadow-sm" : step > s.id ? "bg-primary/10 text-primary dark:text-primary" : "text-muted-foreground"}`}
              >
                {step > s.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${step === s.id ? "border-primary-foreground/50" : "border-current/30"}`}
                  >
                    {s.id}
                  </span>
                )}
                <span className="font-semibold">{t(s.labelKey)}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-px w-5 ${step > s.id ? "bg-primary/50" : "bg-border"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Project Selection */}
        {step === 1 && (
          <Card className="stand-surface">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">
                {t("Selecionar Projeto")}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t(
                  "Cada RDCD é emitido por projeto. Selecione o projeto a incluir no relatório."
                )}
              </p>
              <div className="flex gap-2 mb-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedProjects([])}
                >
                  {t("Limpar")}
                </Button>
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
                      <p className="font-medium text-sm">
                        {p.code}{" "}
                        <span className="font-normal text-muted-foreground">
                          —{" "}
                          {getRdcdProjectModel(p.code).kind === "operations"
                            ? t("modelo OPS")
                            : t("modelo de obra")}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{p.name}</p>
                      <p className="mt-1 text-[11px] leading-4 text-primary">
                        {presentRdcdModel(p.code, language).sourceLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => {
                    if (selectedProjects.length === 0) {
                      toast.error(t("Selecione pelo menos um projeto"));
                      return;
                    }
                    setStep(2);
                  }}
                >
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
              <h2 className="text-lg font-semibold mb-1">
                {t("Definir Período")}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t(
                  isOperationsReport
                    ? "Indique o período operacional a incluir no relatório OPS. As medidas permanecem ligadas ao seu acompanhamento DCAPE, não a fichas semanais de obra."
                    : "Indique o intervalo de semanas a incluir no RDCD (tipicamente ~26 semanas / 6 meses)."
                )}
              </p>
              <div className="mb-4 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
                <p className="text-sm font-semibold text-foreground">
                  {presentedReportModel.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {presentedReportModel.guidance}
                </p>
              </div>

              {/* Year selector */}
              <div className="mb-4">
                <label className="text-sm font-medium">{t("Ano")}</label>
                <div className="flex gap-2 mt-1">
                  {yearOptions.map(y => (
                    <Button
                      key={y}
                      size="sm"
                      variant={selectedYear === y ? "default" : "outline"}
                      onClick={() => {
                        setSelectedYear(y);
                        setStartWeek("");
                        setEndWeek("");
                      }}
                    >
                      {y}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium">
                    {t("Semana de início")}
                  </label>
                  <select
                    className="w-full h-9 border rounded-md px-3 text-sm mt-1 bg-background"
                    value={startWeek}
                    onChange={e => setStartWeek(e.target.value)}
                  >
                    <option value="">{t("Selecionar semana")}...</option>
                    {Array.from({ length: 53 }, (_, i) => i + 1).map(w => {
                      const { label } = getWeekDates(selectedYear, w);
                      return (
                        <option
                          key={w}
                          value={`${selectedYear}-W${w.toString().padStart(2, "0")}`}
                        >
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {t("Semana de fim")}
                  </label>
                  <select
                    className="w-full h-9 border rounded-md px-3 text-sm mt-1 bg-background"
                    value={endWeek}
                    onChange={e => setEndWeek(e.target.value)}
                  >
                    <option value="">{t("Selecionar semana")}...</option>
                    {Array.from({ length: 53 }, (_, i) => i + 1).map(w => {
                      const { label } = getWeekDates(selectedYear, w);
                      return (
                        <option
                          key={w}
                          value={`${selectedYear}-W${w.toString().padStart(2, "0")}`}
                        >
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              {startWeek && endWeek && (
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="text-sm">
                    <span className="font-medium">
                      {t("Período selecionado:")}
                    </span>{" "}
                    {t("Semana")} {startWeek.split("-W")[1]} {t("a")}{" "}
                    {t("Semana")} {endWeek.split("-W")[1]} {t("de")}{" "}
                    {selectedYear}
                    {(() => {
                      const w1 = parseInt(startWeek.split("-W")[1]);
                      const w2 = parseInt(endWeek.split("-W")[1]);
                      const totalWeeks = w2 - w1 + 1;
                      return (
                        <span className="ml-2 text-muted-foreground">
                          ({totalWeeks} {t("semanas")})
                        </span>
                      );
                    })()}
                  </p>
                </div>
              )}
              {/* Plans section */}
              <div className="border rounded-lg p-4 mb-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={includePlans}
                    onCheckedChange={v => setIncludePlans(!!v)}
                    id="include-plans"
                  />
                  <label
                    htmlFor="include-plans"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t("Incluir Planos de Monitorização no RDCD")}
                  </label>
                </div>
                {includePlans && plans && plans.length > 0 && (
                  <div className="ml-6 space-y-1.5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">
                        {t("Selecione os planos a incluir:")}
                      </p>
                      <button
                        className="text-[10px] text-primary hover:underline"
                        onClick={() =>
                          setSelectedPlanIds(
                            selectedPlanIds.length === plans.length
                              ? []
                              : plans.map((p: any) => p.id)
                          )
                        }
                      >
                        {selectedPlanIds.length === plans.length
                          ? t("Desselecionar todos")
                          : t("Selecionar todos")}
                      </button>
                    </div>
                    {plans.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Checkbox
                          checked={selectedPlanIds.includes(p.id)}
                          onCheckedChange={v =>
                            setSelectedPlanIds(
                              v
                                ? [...selectedPlanIds, p.id]
                                : selectedPlanIds.filter(id => id !== p.id)
                            )
                          }
                        />
                        <span
                          className={`w-2 h-2 rounded-full ${p.submissionStatus === "delivered" ? "bg-primary" : p.submissionStatus === "submitted" ? "bg-secondary" : "bg-muted-foreground/45"}`}
                        />
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">
                          — {p.periodicity || "—"}
                        </span>
                        <span
                          className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${p.submissionStatus === "delivered" ? "bg-primary text-primary-foreground" : p.submissionStatus === "submitted" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}
                        >
                          {p.submissionStatus === "delivered"
                            ? t("Entregue")
                            : p.submissionStatus === "submitted"
                              ? t("Submetido")
                              : t("Pendente")}
                        </span>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      {selectedPlanIds.length} {t("de")} {plans.length}{" "}
                      {t("planos selecionados para o RDCD.")}
                    </p>
                  </div>
                )}
                {includePlans && (!plans || plans.length === 0) && (
                  <p className="ml-6 text-xs text-muted-foreground">
                    {t("Nenhum plano encontrado. Crie planos na tab Planos.")}
                  </p>
                )}
              </div>
              <div className="mb-4 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={includeWaste}
                    onCheckedChange={value => setIncludeWaste(Boolean(value))}
                    id="include-waste"
                  />
                  <div>
                    <label
                      htmlFor="include-waste"
                      className="cursor-pointer text-sm font-medium"
                    >
                      {t("Incluir anexo de resíduos e-GAR")}
                    </label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t(
                        "A tabela será gerada apenas com os e-GARs registados no projeto e no período escolhido: ID, data de recolha, código LER, tipo de resíduo, quantidade e destino."
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t("Anterior")}
                </Button>
                <Button
                  onClick={() => {
                    if (!startWeek || !endWeek) {
                      toast.error(t("Defina o período"));
                      return;
                    }
                    setStep(3);
                  }}
                >
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
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="stand-kicker text-primary">
                    {t("FONTE DO CAPÍTULO 5")}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {t(
                      isOperationsReport
                        ? "Medidas OPS — Operação DCAPE SIN01"
                        : "Fichas semanais aprovadas"
                    )}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {t(
                      isOperationsReport
                        ? "Este capítulo usa exclusivamente as medidas OPS do SIN01, os responsáveis, status updates e evidências registadas no período. Não usa fichas semanais de obra."
                        : "Este capítulo só usa respostas submetidas e aprovadas nas fichas semanais do período. Medidas sem resposta não são apresentadas nem entram no relatório."
                    )}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-primary/25 bg-primary/5 px-3 py-1.5 text-primary"
                >
                  <FileText className="mr-1.5 size-3.5" />
                  {isOperationsReport
                    ? `${compiledMeasures.length} ${t("medidas OPS no período")}`
                    : `${filteredSubmissions.length} ${t("fichas aprovadas no período")}`}
                </Badge>
              </div>
              {isOperationsReport ? (
                loadingOperationTransition ? (
                  <div className="flex items-center justify-center gap-2 py-12">
                    <Loader2 className="size-5 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      {t(
                        "A carregar medidas OPS, responsáveis e atualizações..."
                      )}
                    </span>
                  </div>
                ) : compiledMeasures.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                    <ListTodo className="mx-auto size-9 text-muted-foreground" />
                    <h3 className="mt-3 text-sm font-semibold text-foreground">
                      {t("Não existem medidas OPS disponíveis")}
                    </h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      {t(
                        "O relatório operacional só é iniciado quando o catálogo OPS do SIN01 estiver disponível no módulo Fases."
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
                        <p className="text-2xl font-semibold text-primary">
                          {compiledMeasures.length}
                        </p>
                        <p className="mt-1 text-xs font-medium text-foreground">
                          {t("Medidas OPS")}
                        </p>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                          {t("Catálogo DCAPE de exploração do SIN01.")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
                        <p className="text-2xl font-semibold text-primary">
                          {opsCompletedCount}
                        </p>
                        <p className="mt-1 text-xs font-medium text-foreground">
                          {t("Reportadas")}
                        </p>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                          {t("Estado de acompanhamento concluído.")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-destructive/25 bg-destructive/[0.06] p-4">
                        <p className="text-2xl font-semibold text-destructive">
                          {opsPendingCount}
                        </p>
                        <p className="mt-1 text-xs font-medium text-foreground">
                          {t("Em acompanhamento")}
                        </p>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                          {t("Inclui medidas não concluídas e bloqueadas.")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-2xl font-semibold text-foreground">
                          {opsEvidenceCount}
                        </p>
                        <p className="mt-1 text-xs font-medium text-foreground">
                          {t("Evidências OPS")}
                        </p>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                          {t("Fotografias disponíveis para seleção editorial.")}
                        </p>
                      </div>
                    </div>

                    <section className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.025] p-4 sm:p-5">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="stand-kicker text-primary">
                            {t("CURADORIA OPS")}
                          </p>
                          <h3 className="mt-1 text-sm font-semibold text-foreground">
                            {t(
                              "Selecione medidas, evidências e notas para o relatório operacional"
                            )}
                          </h3>
                          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                            {t(
                              "A origem é o acompanhamento DCAPE da exploração: estado, responsável, suporte e último status update. O período apenas delimita o RDCD; não transforma estas medidas em fichas semanais."
                            )}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setMeasureSelections(current =>
                              Object.fromEntries(
                                compiledMeasures.map((measure: any) => [
                                  measure.id,
                                  {
                                    ...(current[measure.id] || {
                                      selectedImageUrls: [],
                                      notes: "",
                                    }),
                                    selectedWeeks: [startWeek],
                                  },
                                ])
                              )
                            )
                          }
                        >
                          {t("Incluir todas as medidas OPS")}
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {measuresBySection.map(sec => (
                          <div
                            key={sec.id}
                            className="overflow-hidden rounded-xl border border-border bg-card"
                          >
                            <div className="border-b border-border bg-muted/20 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                                {t(sec.name)}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {sec.measures.length}{" "}
                                {t("obrigações de exploração registadas")}
                              </p>
                            </div>
                            <div className="divide-y divide-border">
                              {sec.measures.map((m: any) => {
                                const selection = measureSelections[m.id] || {
                                  selectedWeeks: [],
                                  selectedImageUrls: [],
                                  notes: "",
                                };
                                const images = evidenceByMeasure[m.id] || [];
                                const selected =
                                  selection.selectedWeeks.length > 0;
                                return (
                                  <div key={m.id} className="p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-foreground">
                                          {t("Medida")} {m.number}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                          {localizeDcapeDescription(
                                            m.description,
                                            language
                                          )}
                                        </p>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className={
                                          statusColors[m.autoStatus] || ""
                                        }
                                      >
                                        {t(
                                          statusLabels[m.autoStatus] ||
                                            m.autoStatus
                                        )}
                                      </Badge>
                                    </div>
                                    <div className="mt-3 grid gap-3 rounded-xl border border-border bg-muted/15 p-3 text-xs sm:grid-cols-3">
                                      <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          {t("Responsável")}
                                        </p>
                                        <p className="mt-1 font-medium text-foreground">
                                          {m.ownerName || t("Por definir")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          {t("Suporte")}
                                        </p>
                                        <p className="mt-1 font-medium text-foreground">
                                          {m.supportName || t("Por definir")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          {t("Último update")}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-muted-foreground">
                                          {m.latestUpdate?.updateText ||
                                            t("Ainda sem atualização")}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                          selected ? "default" : "outline"
                                        }
                                        className="h-8 text-xs"
                                        onClick={() =>
                                          setMeasureSelections(current => ({
                                            ...current,
                                            [m.id]: {
                                              ...selection,
                                              selectedWeeks: selected
                                                ? []
                                                : [startWeek],
                                            },
                                          }))
                                        }
                                      >
                                        {selected
                                          ? t("Incluída no RDCD OPS")
                                          : t("Incluir no RDCD OPS")}
                                      </Button>
                                      {m.latestUpdate?.createdAt && (
                                        <span className="text-[11px] text-muted-foreground">
                                          {new Date(
                                            m.latestUpdate.createdAt
                                          ).toLocaleDateString(
                                            language === "en"
                                              ? "en-GB"
                                              : "pt-PT"
                                          )}
                                        </span>
                                      )}
                                    </div>
                                    {images.length > 0 && (
                                      <div className="mt-4">
                                        <p className="text-xs font-medium text-foreground">
                                          {t(
                                            "Evidências fotográficas disponíveis"
                                          )}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {images.map((image: any) => {
                                            const isSelected =
                                              selection.selectedImageUrls.includes(
                                                image.url
                                              );
                                            return (
                                              <button
                                                type="button"
                                                key={image.url}
                                                onClick={() =>
                                                  setMeasureSelections(
                                                    current => {
                                                      const item = current[
                                                        m.id
                                                      ] || {
                                                        selectedWeeks: [],
                                                        selectedImageUrls: [],
                                                        notes: "",
                                                      };
                                                      const selectedImageUrls =
                                                        item.selectedImageUrls.includes(
                                                          image.url
                                                        )
                                                          ? item.selectedImageUrls.filter(
                                                              url =>
                                                                url !==
                                                                image.url
                                                            )
                                                          : [
                                                              ...item.selectedImageUrls,
                                                              image.url,
                                                            ];
                                                      return {
                                                        ...current,
                                                        [m.id]: {
                                                          ...item,
                                                          selectedImageUrls,
                                                        },
                                                      };
                                                    }
                                                  )
                                                }
                                                className={`overflow-hidden rounded-lg border text-left transition-colors ${isSelected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/60"}`}
                                              >
                                                <img
                                                  src={image.url}
                                                  alt={image.filename}
                                                  className="h-20 w-28 object-cover"
                                                />
                                                <span className="block max-w-28 truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                                                  {image.filename}
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    <Textarea
                                      value={selection.notes}
                                      onChange={event =>
                                        setMeasureSelections(current => ({
                                          ...current,
                                          [m.id]: {
                                            ...selection,
                                            notes: event.target.value,
                                          },
                                        }))
                                      }
                                      className="mt-4 min-h-20 bg-background text-xs"
                                      placeholder={t(
                                        "Nota editorial sobre o estado OPS desta medida"
                                      )}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                    {operationOverview && (
                      <div className="mt-5 rounded-2xl border border-border bg-card p-4">
                        <p className="text-sm font-semibold text-foreground">
                          {t(
                            "Indicadores de operação disponíveis para contextualização"
                          )}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {operationOverview.hasDemoData
                            ? t(
                                "Existem dados demonstrativos neste período; devem ser identificados e validados antes da emissão."
                              )
                            : t(
                                "Dados lidos do cockpit operacional no período selecionado."
                              )}
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-4">
                          {["pue", "wue", "cue", "cop"].map(code => (
                            <div
                              key={code}
                              className="rounded-lg border border-border bg-muted/20 p-3"
                            >
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {code.toUpperCase()}
                              </p>
                              <p className="mt-1 text-lg font-semibold text-foreground">
                                {operationOverview.latest?.[code]?.value ?? "—"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              ) : loadingSubs || loadingResponses ? (
                <div className="flex items-center gap-2 py-12 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    {t("A carregar dados das fichas semanais...")}
                  </span>
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                  <FileText className="mx-auto size-9 text-muted-foreground" />
                  <h3 className="mt-3 text-sm font-semibold text-foreground">
                    {t("Não existem fichas aprovadas neste período")}
                  </h3>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    {t(
                      "O RDCD não cria dados em falta. Altere o período ou volte quando as fichas semanais estiverem aprovadas."
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
                      <p className="text-2xl font-semibold text-primary">
                        {filteredSubmissions.length}
                      </p>
                      <p className="mt-1 text-xs font-medium text-foreground">
                        {t("Fichas aprovadas")}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {t("Incluídas automaticamente como fonte rastreável.")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
                      <p className="text-2xl font-semibold text-primary">
                        {
                          compiledMeasures.filter(
                            (m: any) => m.autoStatus === "conform"
                          ).length
                        }
                      </p>
                      <p className="mt-1 text-xs font-medium text-foreground">
                        {t("Medidas cumpridas")}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {t("Com estado Conforme ou Implementada.")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-destructive/25 bg-destructive/[0.06] p-4">
                      <p className="text-2xl font-semibold text-destructive">
                        {
                          compiledMeasures.filter(
                            (m: any) => m.autoStatus === "nc"
                          ).length
                        }
                      </p>
                      <p className="mt-1 text-xs font-medium text-foreground">
                        {t("Não conformidades")}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {t("A rever no seguimento técnico.")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-2xl font-semibold text-foreground">
                        {compiledMeasures.length}
                      </p>
                      <p className="mt-1 text-xs font-medium text-foreground">
                        {t("Medidas com registo")}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {t("Apenas as medidas efetivamente preenchidas.")}
                      </p>
                    </div>
                  </div>

                  <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {t("Fichas de controlo que alimentam o relatório")}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t(
                            "Abra cada ficha para verificar a origem das medidas, os estados e as observações antes de escolher o que entra no capítulo 5."
                          )}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-border bg-muted/20 text-muted-foreground"
                      >
                        {weeklyFormsForRdcd.length} {t("fichas com respostas")}
                      </Badge>
                    </div>
                    <Accordion
                      type="single"
                      collapsible
                      className="divide-y divide-border rounded-xl border border-border px-3"
                    >
                      {weeklyFormsForRdcd.map(
                        ({ submission, responses }: any) => (
                          <AccordionItem
                            key={submission.id}
                            value={`submission-${submission.id}`}
                            className="border-0"
                          >
                            <AccordionTrigger className="py-3 no-underline hover:no-underline">
                              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 pr-2">
                                <span className="font-semibold text-foreground">
                                  S{submission.weekNumber}/{submission.weekYear}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {t("Ficha")} #{submission.id}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {responses.length} {t("medidas registadas")}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                              <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full min-w-[620px] text-left text-xs">
                                  <thead className="bg-muted/40 text-muted-foreground">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">
                                        {t("Medida")}
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        {t("Descrição")}
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        {t("Estado")}
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        {t("Observação")}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {responses.map((response: any) => (
                                      <tr
                                        key={response.id}
                                        className="border-t border-border"
                                      >
                                        <td className="px-3 py-2 align-top font-medium text-foreground">
                                          {response.measure.number ||
                                            response.measure.id}
                                        </td>
                                        <td className="max-w-md px-3 py-2 align-top leading-5 text-foreground">
                                          {localizeDcapeDescription(
                                            response.measure.description,
                                            language
                                          )}
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                          <Badge
                                            variant="outline"
                                            className={
                                              statusColors[
                                                response.status === "NC"
                                                  ? "nc"
                                                  : response.status === "NA"
                                                    ? "na"
                                                    : "conform"
                                              ]
                                            }
                                          >
                                            {responseStatusLabels[
                                              response.status
                                            ] ||
                                              response.status ||
                                              "—"}
                                          </Badge>
                                        </td>
                                        <td className="max-w-xs px-3 py-2 align-top leading-5 text-muted-foreground">
                                          {response.observations || "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      )}
                    </Accordion>
                  </section>

                  <section className="rdcd-curation mt-5 grid gap-5 rounded-2xl border border-primary/15 bg-primary/[0.025] p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 lg:col-start-1">
                      <div>
                        <p className="stand-kicker text-primary">
                          {t("CURADORIA DO CAPÍTULO 5")}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-foreground">
                          {t("Escolha semanas, fotografias e notas a incluir")}
                        </h3>
                        <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                          {t(
                            "Cada medida apresenta exclusivamente as semanas em que foi respondida numa ficha aprovada. Pode escolher semanas diferentes para cada medida e reduzir a seleção fotográfica ao essencial."
                          )}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setMeasureSelections(current =>
                            Object.fromEntries(
                              compiledMeasures.map((measure: any) => [
                                measure.id,
                                {
                                  ...(current[measure.id] || {
                                    selectedImageUrls: [],
                                    notes: "",
                                  }),
                                  selectedWeeks: measure.responses.map(
                                    (response: any) =>
                                      `${response.year}-W${String(response.week).padStart(2, "0")}`
                                  ),
                                },
                              ])
                            )
                          )
                        }
                      >
                        {t("Selecionar todas as semanas disponíveis")}
                      </Button>
                    </div>
                    <div className="space-y-4 lg:col-start-1">
                      {measuresBySection.map(sec => (
                        <div
                          key={sec.id}
                          className="rounded-xl border border-border bg-card"
                        >
                          <div className="border-b border-border bg-muted/20 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              {sec.name}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {sec.measures.length}{" "}
                              {t("medidas com registo nas fichas aprovadas")}
                            </p>
                          </div>
                          <div className="divide-y divide-border">
                            {sec.measures.map((m: any) => {
                              const selection = measureSelections[m.id] || {
                                selectedWeeks: [],
                                selectedImageUrls: [],
                                notes: "",
                              };
                              const selectedSubmissionIds = new Set(
                                m.responses
                                  .filter((response: any) =>
                                    selection.selectedWeeks.includes(
                                      `${response.year}-W${String(response.week).padStart(2, "0")}`
                                    )
                                  )
                                  .map((response: any) => response.submissionId)
                              );
                              const images = (
                                evidenceByMeasure[m.id] || []
                              ).filter(image =>
                                selectedSubmissionIds.has(image.submissionId)
                              );
                              return (
                                <div
                                  key={m.id}
                                  className={`cursor-pointer p-4 transition-colors ${curationPreviewMeasure?.id === m.id ? "bg-primary/[0.045]" : "hover:bg-muted/20"}`}
                                  onClick={() =>
                                    setActiveMeasurePreviewId(m.id)
                                  }
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-foreground">
                                        {t("Medida")} {m.number}
                                      </p>
                                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        {localizeDcapeDescription(
                                          m.description,
                                          language
                                        )}
                                      </p>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={
                                        statusColors[m.autoStatus] || ""
                                      }
                                    >
                                      {t(
                                        statusLabels[m.autoStatus] ||
                                          m.autoStatus
                                      )}
                                    </Badge>
                                  </div>
                                  <div className="mt-3">
                                    <p className="text-xs font-medium text-foreground">
                                      {t("Semanas respondidas nesta medida")}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {m.responses.map((response: any) => {
                                        const weekKey = `${response.year}-W${String(response.week).padStart(2, "0")}`;
                                        const selected =
                                          selection.selectedWeeks.includes(
                                            weekKey
                                          );
                                        return (
                                          <Button
                                            type="button"
                                            key={`${response.submissionId}-${weekKey}`}
                                            size="sm"
                                            variant={
                                              selected ? "default" : "outline"
                                            }
                                            className="h-8 text-xs"
                                            onClick={() => {
                                              const current = measureSelections[
                                                m.id
                                              ] || {
                                                selectedWeeks: [],
                                                selectedImageUrls: [],
                                                notes: "",
                                              };
                                              const selectedWeeks =
                                                current.selectedWeeks.includes(
                                                  weekKey
                                                )
                                                  ? current.selectedWeeks.filter(
                                                      (week: string) =>
                                                        week !== weekKey
                                                    )
                                                  : [
                                                      ...current.selectedWeeks,
                                                      weekKey,
                                                    ];
                                              setMeasureSelections(
                                                previous => ({
                                                  ...previous,
                                                  [m.id]: {
                                                    ...current,
                                                    selectedWeeks,
                                                  },
                                                })
                                              );
                                            }}
                                          >
                                            S{response.week}/{response.year} ·{" "}
                                            {responseStatusLabels[
                                              response.status
                                            ] || response.status}
                                          </Button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  {images.length > 0 && (
                                    <div className="mt-4">
                                      <p className="text-xs font-medium text-foreground">
                                        {t(
                                          "Fotografias disponíveis nas semanas selecionadas"
                                        )}
                                      </p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {images.map(image => {
                                          const selected =
                                            selection.selectedImageUrls.includes(
                                              image.url
                                            );
                                          return (
                                            <button
                                              type="button"
                                              key={image.url}
                                              onClick={() =>
                                                setMeasureSelections(
                                                  current => {
                                                    const item = current[
                                                      m.id
                                                    ] || {
                                                      selectedWeeks: [],
                                                      selectedImageUrls: [],
                                                      notes: "",
                                                    };
                                                    const selectedImageUrls =
                                                      item.selectedImageUrls.includes(
                                                        image.url
                                                      )
                                                        ? item.selectedImageUrls.filter(
                                                            url =>
                                                              url !== image.url
                                                          )
                                                        : [
                                                            ...item.selectedImageUrls,
                                                            image.url,
                                                          ];
                                                    return {
                                                      ...current,
                                                      [m.id]: {
                                                        ...item,
                                                        selectedImageUrls,
                                                      },
                                                    };
                                                  }
                                                )
                                              }
                                              className={`overflow-hidden rounded-lg border text-left transition-colors ${selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/60"}`}
                                            >
                                              <img
                                                src={image.url}
                                                alt={image.filename}
                                                className="h-20 w-28 object-cover"
                                              />
                                              <span className="block max-w-28 truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                                                {image.filename}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  <Textarea
                                    value={selection.notes}
                                    onChange={event =>
                                      setMeasureSelections(current => ({
                                        ...current,
                                        [m.id]: {
                                          ...selection,
                                          notes: event.target.value,
                                        },
                                      }))
                                    }
                                    className="mt-4 min-h-20 bg-background text-xs"
                                    placeholder={t(
                                      "Nota editorial opcional para esta medida no RDCD"
                                    )}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <aside className="rdcd-page-console lg:col-start-2 lg:row-span-2 lg:row-start-1">
                      <div className="rdcd-page-console-topbar">
                        <span className="stand-mono">
                          {t("PRÉ-VISUALIZAÇÃO VIVA")}
                        </span>
                        <span>
                          {reportNumber.trim() ||
                            `RDCD-${selectedProject?.code || "PROJ"}-001`}
                        </span>
                      </div>
                      {curationPreviewMeasure ? (
                        <div className="space-y-4 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="stand-kicker text-primary">
                                {t("PONTO 5 · FICHA SEMANAL")}
                              </p>
                              <h4 className="mt-1 text-sm font-semibold text-foreground">
                                {t("Medida")} {curationPreviewMeasure.number}
                              </h4>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                statusColors[
                                  curationPreviewMeasure.autoStatus
                                ] || ""
                              }
                            >
                              {t(
                                statusLabels[
                                  curationPreviewMeasure.autoStatus
                                ] || curationPreviewMeasure.autoStatus
                              )}
                            </Badge>
                          </div>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {localizeDcapeDescription(
                              curationPreviewMeasure.description,
                              language
                            )}
                          </p>
                          <div className="rounded-xl border border-border bg-card p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              {t("Excerto que será composto no Word")}
                            </p>
                            <div className="mt-3 overflow-hidden rounded-lg border border-border">
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-muted/40 text-muted-foreground">
                                  <tr>
                                    <th className="px-2 py-2 font-medium">
                                      {t("Período")}
                                    </th>
                                    <th className="px-2 py-2 font-medium">
                                      {t("Estado")}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {isOperationsReport ? (
                                    <tr className="border-t border-border">
                                      <td className="px-2 py-2 text-foreground">
                                        {startWeek && endWeek
                                          ? `S${startWeek.split("-W")[1]}–S${endWeek.split("-W")[1]}/${selectedYear}`
                                          : "—"}
                                      </td>
                                      <td className="px-2 py-2 text-foreground">
                                        {t(
                                          statusLabels[
                                            curationPreviewMeasure.autoStatus
                                          ] || curationPreviewMeasure.autoStatus
                                        )}
                                      </td>
                                    </tr>
                                  ) : curationPreviewResponses.length > 0 ? (
                                    curationPreviewResponses.map(
                                      (response: any) => (
                                        <tr
                                          key={`${response.submissionId}-${response.week}`}
                                          className="border-t border-border"
                                        >
                                          <td className="px-2 py-2 text-foreground">
                                            S{response.week}/{response.year}
                                          </td>
                                          <td className="px-2 py-2 text-foreground">
                                            {responseStatusLabels[
                                              response.status
                                            ] || response.status}
                                          </td>
                                        </tr>
                                      )
                                    )
                                  ) : (
                                    <tr className="border-t border-border">
                                      <td
                                        className="px-2 py-3 text-muted-foreground"
                                        colSpan={2}
                                      >
                                        {t(
                                          "Selecione uma semana nesta medida."
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-foreground">
                                {t("Fotografias no excerto")}
                              </p>
                              <span className="text-[11px] text-muted-foreground">
                                {curationPreviewImages.length}
                              </span>
                            </div>
                            {curationPreviewImages.length > 0 ? (
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                {curationPreviewImages
                                  .slice(0, 4)
                                  .map(image => (
                                    <figure
                                      key={image.url}
                                      className="overflow-hidden rounded-lg border border-border bg-card"
                                    >
                                      <img
                                        src={image.url}
                                        alt={image.filename}
                                        className="h-20 w-full object-cover"
                                      />
                                      <figcaption className="truncate px-2 py-1.5 text-[10px] text-muted-foreground">
                                        {image.filename}
                                      </figcaption>
                                    </figure>
                                  ))}
                              </div>
                            ) : (
                              <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-3 text-[11px] leading-4 text-muted-foreground">
                                {t(
                                  "Nenhuma fotografia foi selecionada para esta medida."
                                )}
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs">
                              {t("Texto editorial da medida")}
                            </Label>
                            <Textarea
                              value={curationPreviewSelection?.notes || ""}
                              onClick={event => event.stopPropagation()}
                              onChange={event =>
                                setMeasureSelections(current => ({
                                  ...current,
                                  [curationPreviewMeasure.id]: {
                                    ...(current[curationPreviewMeasure.id] || {
                                      selectedWeeks: [],
                                      selectedImageUrls: [],
                                      notes: "",
                                    }),
                                    notes: event.target.value,
                                  },
                                }))
                              }
                              className="mt-1.5 min-h-28 bg-background text-xs leading-5"
                              placeholder={t(
                                "Edite aqui a nota que acompanhará esta medida no capítulo 5."
                              )}
                            />
                          </div>
                          <p className="border-t border-border pt-3 text-[10px] leading-4 text-muted-foreground">
                            {t(
                              "Pré-visualização editorial: os registos aprovados, evidências e estados de origem não são alterados."
                            )}
                          </p>
                        </div>
                      ) : (
                        <div className="p-5 text-xs leading-5 text-muted-foreground">
                          {t(
                            "Selecione uma medida à esquerda para compor e rever o respetivo excerto."
                          )}
                        </div>
                      )}
                    </aside>
                  </section>
                </>
              )}
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t("Anterior")}
                </Button>
                <Button onClick={() => setStep(4)}>
                  {t("Completar capítulos")}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Editorial studio and report identity */}
        {step === 4 && (
          <div className="space-y-5">
            <Card className="stand-surface overflow-hidden">
              <CardContent className="p-0">
                <div className="border-b border-border bg-muted/20 px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="size-5 text-primary" />
                        <p className="stand-kicker text-primary">
                          {t("ESTÚDIO EDITORIAL")}
                        </p>
                      </div>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                        {t("Construa o relatório, não apenas um formulário")}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {t(
                          "Escreva capítulo a capítulo com contexto, fontes e controlo de emissão. As fontes operacionais continuam protegidas nos respetivos módulos e este rascunho não altera qualquer registo de origem."
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draftId && (
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/5 px-3 py-1.5 text-primary"
                        >
                          <Save className="mr-1.5 size-3.5" />
                          {t("Rascunho")} #{draftId}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="border-border bg-card px-3 py-1.5 text-foreground"
                      >
                        <Check className="mr-1.5 size-3.5 text-primary" />
                        {completedEditorialSections}/{EDITORIAL_SECTIONS.length}{" "}
                        {t("capítulos com conteúdo")}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-0 xl:grid-cols-[270px_minmax(0,1fr)_270px]">
                  <aside className="border-b border-border bg-muted/10 p-3 xl:border-r xl:border-b-0">
                    <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("Estrutura do relatório")}
                    </p>
                    <nav
                      className="grid gap-1"
                      aria-label={t("Capítulos editáveis do RDCD")}
                    >
                      {EDITORIAL_SECTIONS.map(section => {
                        const Icon = section.icon;
                        const isActive = activeEditorialSection === section.key;
                        const isComplete =
                          content[section.key].trim().length > 0;
                        return (
                          <button
                            key={section.key}
                            type="button"
                            onClick={() =>
                              setActiveEditorialSection(section.key)
                            }
                            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-accent"}`}
                          >
                            <span
                              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-primary-foreground/15" : "bg-primary/10 text-primary"}`}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold leading-4">
                                {t(section.label)}
                              </span>
                              <span
                                className={`mt-0.5 block text-[11px] ${isActive ? "text-primary-foreground/75" : "text-muted-foreground"}`}
                              >
                                {isComplete
                                  ? t("Conteúdo registado")
                                  : t("Por completar")}
                              </span>
                            </span>
                            {isComplete && (
                              <Check
                                className={`size-4 ${isActive ? "text-primary-foreground" : "text-primary"}`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </nav>
                  </aside>

                  <main className="min-w-0 p-5 sm:p-6">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <activeEditorial.icon className="size-5" />
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {t(activeEditorial.label)}
                          </h3>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">
                            {t(activeEditorial.prompt)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-border bg-card text-muted-foreground"
                      >
                        {content[activeEditorial.key].trim().length}{" "}
                        {t("caracteres")}
                      </Badge>
                    </div>
                    <div className="space-y-5">
                      <section className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="stand-kicker text-primary">
                              {t("DADOS DE CONTEXTO")}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {t("Fontes disponíveis para este capítulo")}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {t(
                                "Estes indicadores são apenas de leitura. Use-os para sustentar a redação, sem alterar os registos de origem."
                              )}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateActiveChapterBlock(current => ({
                                ...current,
                                sourceReferences: [
                                  ...current.sourceReferences,
                                  `${presentedReportModel.label} — ${presentedReportModel.sourceLabel}`,
                                ],
                              }))
                            }
                          >
                            <Link2 className="mr-1.5 size-3.5" />
                            {t("Adicionar modelo como fonte")}
                          </Button>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {chapterDataContext.map(item => (
                            <div
                              key={item.label}
                              className="rounded-xl border border-border bg-card p-3"
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {item.label}
                              </p>
                              <p
                                className="mt-1 truncate text-sm font-semibold text-foreground"
                                title={item.value}
                              >
                                {item.value}
                              </p>
                              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                                {item.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>
                      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {t("Síntese técnica")}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {t(
                                "Escreva a interpretação técnica do capítulo. Esta síntese será colocada no corpo do Word, sem alterar qualquer registo de origem."
                              )}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-border bg-muted/20 text-muted-foreground"
                          >
                            {activeChapterBlock.summary.length}{" "}
                            {t("caracteres")}
                          </Badge>
                        </div>
                        <Textarea
                          value={activeChapterBlock.summary}
                          onChange={event =>
                            updateChapterSummary(event.target.value)
                          }
                          placeholder={t(activeEditorial.prompt)}
                          className="mt-4 min-h-[190px] resize-y border-border bg-background p-4 text-sm leading-7 shadow-sm placeholder:text-muted-foreground/80"
                          aria-label={t(activeEditorial.label)}
                        />
                      </section>

                      <div className="grid gap-5 lg:grid-cols-2">
                        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <ImagePlus className="size-4 text-primary" />
                                <p className="text-sm font-semibold text-foreground">
                                  {t("Figuras, fotografias e gráficos")}
                                </p>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {t(
                                  "Inclua imagens de contexto ou um gráfico preparado pela equipa, sempre com legenda editorial."
                                )}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                                <ImagePlus className="mr-1.5 size-3.5" />
                                {t("Inserir imagem")}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg"
                                  className="sr-only"
                                  onChange={event => {
                                    const file = event.target.files?.[0];
                                    if (file)
                                      void addEditorialFigure(file, "image");
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </label>
                              <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                                <BarChart3 className="mr-1.5 size-3.5" />
                                {t("Inserir gráfico")}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg"
                                  className="sr-only"
                                  onChange={event => {
                                    const file = event.target.files?.[0];
                                    if (file)
                                      void addEditorialFigure(file, "chart");
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                          {selectedMeasureImageLibrary.length > 0 && (
                            <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/15 p-3">
                              <p className="text-[11px] font-medium text-foreground">
                                {t("Fotografias já selecionadas no capítulo 5")}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {selectedMeasureImageLibrary
                                  .slice(0, 8)
                                  .map((image: any) => (
                                    <button
                                      key={`${image.measureNumber}-${image.url}`}
                                      type="button"
                                      onClick={() =>
                                        void copySelectedEvidenceToChapter(
                                          image
                                        )
                                      }
                                      className="overflow-hidden rounded-md border border-border text-left transition-colors hover:border-primary"
                                      title={t("Inserir no capítulo atual")}
                                    >
                                      <img
                                        src={image.url}
                                        alt={image.filename}
                                        className="size-12 object-cover"
                                      />
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                          <div className="mt-4 space-y-3">
                            {activeChapterBlock.figures.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
                                {t(
                                  "Ainda não foram inseridas figuras neste capítulo."
                                )}
                              </p>
                            ) : (
                              activeChapterBlock.figures.map(
                                (figure, index) => (
                                  <div
                                    key={figure.id}
                                    className="flex gap-3 rounded-xl border border-border bg-muted/10 p-3"
                                  >
                                    <img
                                      src={reportFigureMediaUrl(figure.url)}
                                      alt={
                                        figure.caption || t("Figura do RDCD")
                                      }
                                      className="h-16 w-20 shrink-0 rounded-md border border-border object-cover"
                                    />
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <select
                                          value={figure.kind}
                                          onChange={event =>
                                            updateActiveChapterBlock(
                                              current => ({
                                                ...current,
                                                figures: current.figures.map(
                                                  (item, itemIndex) =>
                                                    itemIndex === index
                                                      ? {
                                                          ...item,
                                                          kind: event.target
                                                            .value as ChapterFigure["kind"],
                                                        }
                                                      : item
                                                ),
                                              })
                                            )
                                          }
                                          className="h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground"
                                          aria-label={t("Tipo de figura")}
                                        >
                                          <option value="image">
                                            {t("Imagem")}
                                          </option>
                                          <option value="chart">
                                            {t("Gráfico")}
                                          </option>
                                        </select>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="size-7 text-muted-foreground hover:text-destructive"
                                          onClick={() =>
                                            updateActiveChapterBlock(
                                              current => ({
                                                ...current,
                                                figures: current.figures.filter(
                                                  (_, itemIndex) =>
                                                    itemIndex !== index
                                                ),
                                              })
                                            )
                                          }
                                          aria-label={t("Remover figura")}
                                        >
                                          <Trash2 className="size-3.5" />
                                        </Button>
                                      </div>
                                      <Input
                                        value={figure.caption}
                                        onChange={event =>
                                          updateActiveChapterBlock(current => ({
                                            ...current,
                                            figures: current.figures.map(
                                              (item, itemIndex) =>
                                                itemIndex === index
                                                  ? {
                                                      ...item,
                                                      caption:
                                                        event.target.value,
                                                    }
                                                  : item
                                            ),
                                          }))
                                        }
                                        className="h-8 bg-background text-xs"
                                        placeholder={t("Legenda da figura")}
                                      />
                                    </div>
                                  </div>
                                )
                              )
                            )}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <TableProperties className="size-4 text-primary" />
                                <p className="text-sm font-semibold text-foreground">
                                  {t("Tabelas do capítulo")}
                                </p>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {t(
                                  "Construa quadros simples de acompanhamento; a tabela é composta no Word exatamente com estes campos."
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateActiveChapterBlock(current => ({
                                  ...current,
                                  tables: [
                                    ...current.tables,
                                    {
                                      id: createEditorialId("table"),
                                      title: t("Tabela de acompanhamento"),
                                      columns: [t("Indicador"), t("Valor")],
                                      rows: [["", ""]],
                                    },
                                  ],
                                }))
                              }
                            >
                              <Plus className="mr-1 size-3.5" />
                              {t("Adicionar tabela")}
                            </Button>
                          </div>
                          <div className="mt-4 space-y-4">
                            {activeChapterBlock.tables.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
                                {t(
                                  "Ainda não foram adicionadas tabelas a este capítulo."
                                )}
                              </p>
                            ) : (
                              activeChapterBlock.tables.map(
                                (table, tableIndex) => (
                                  <div
                                    key={table.id}
                                    className="rounded-xl border border-border bg-muted/10 p-3"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Input
                                        value={table.title}
                                        onChange={event =>
                                          updateActiveChapterBlock(current => ({
                                            ...current,
                                            tables: current.tables.map(
                                              (item, itemIndex) =>
                                                itemIndex === tableIndex
                                                  ? {
                                                      ...item,
                                                      title: event.target.value,
                                                    }
                                                  : item
                                            ),
                                          }))
                                        }
                                        className="h-8 bg-background text-xs font-medium"
                                        placeholder={t("Título da tabela")}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-muted-foreground hover:text-destructive"
                                        onClick={() =>
                                          updateActiveChapterBlock(current => ({
                                            ...current,
                                            tables: current.tables.filter(
                                              (_, itemIndex) =>
                                                itemIndex !== tableIndex
                                            ),
                                          }))
                                        }
                                        aria-label={t("Remover tabela")}
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </div>
                                    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                                      <table className="min-w-full text-left text-[11px]">
                                        <thead className="bg-muted/40">
                                          <tr>
                                            {table.columns.map(
                                              (column, columnIndex) => (
                                                <th
                                                  key={`${table.id}-column-${columnIndex}`}
                                                  className="min-w-28 p-1.5"
                                                >
                                                  <Input
                                                    value={column}
                                                    onChange={event =>
                                                      updateActiveChapterBlock(
                                                        current => ({
                                                          ...current,
                                                          tables:
                                                            current.tables.map(
                                                              (
                                                                item,
                                                                itemIndex
                                                              ) =>
                                                                itemIndex ===
                                                                tableIndex
                                                                  ? {
                                                                      ...item,
                                                                      columns:
                                                                        item.columns.map(
                                                                          (
                                                                            value,
                                                                            index
                                                                          ) =>
                                                                            index ===
                                                                            columnIndex
                                                                              ? event
                                                                                  .target
                                                                                  .value
                                                                              : value
                                                                        ),
                                                                    }
                                                                  : item
                                                            ),
                                                        })
                                                      )
                                                    }
                                                    className="h-7 bg-background text-[11px]"
                                                    placeholder={t("Coluna")}
                                                  />
                                                </th>
                                              )
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {table.rows.map((row, rowIndex) => (
                                            <tr
                                              key={`${table.id}-row-${rowIndex}`}
                                              className="border-t border-border"
                                            >
                                              {table.columns.map(
                                                (_, columnIndex) => (
                                                  <td
                                                    key={`${table.id}-cell-${rowIndex}-${columnIndex}`}
                                                    className="p-1.5"
                                                  >
                                                    <Input
                                                      value={
                                                        row[columnIndex] || ""
                                                      }
                                                      onChange={event =>
                                                        updateActiveChapterBlock(
                                                          current => ({
                                                            ...current,
                                                            tables:
                                                              current.tables.map(
                                                                (
                                                                  item,
                                                                  itemIndex
                                                                ) =>
                                                                  itemIndex ===
                                                                  tableIndex
                                                                    ? {
                                                                        ...item,
                                                                        rows: item.rows.map(
                                                                          (
                                                                            rowValue,
                                                                            index
                                                                          ) =>
                                                                            index ===
                                                                            rowIndex
                                                                              ? item.columns.map(
                                                                                  (
                                                                                    __,
                                                                                    cellIndex
                                                                                  ) =>
                                                                                    cellIndex ===
                                                                                    columnIndex
                                                                                      ? event
                                                                                          .target
                                                                                          .value
                                                                                      : rowValue[
                                                                                          cellIndex
                                                                                        ] ||
                                                                                        ""
                                                                                )
                                                                              : rowValue
                                                                        ),
                                                                      }
                                                                    : item
                                                              ),
                                                          })
                                                        )
                                                      }
                                                      className="h-7 bg-background text-[11px]"
                                                      placeholder="—"
                                                    />
                                                  </td>
                                                )
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="mt-2 flex justify-end">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-[11px]"
                                        onClick={() =>
                                          updateActiveChapterBlock(current => ({
                                            ...current,
                                            tables: current.tables.map(
                                              (item, itemIndex) =>
                                                itemIndex === tableIndex
                                                  ? {
                                                      ...item,
                                                      rows: [
                                                        ...item.rows,
                                                        item.columns.map(
                                                          () => ""
                                                        ),
                                                      ],
                                                    }
                                                  : item
                                            ),
                                          }))
                                        }
                                      >
                                        <Plus className="mr-1 size-3" />
                                        {t("Linha")}
                                      </Button>
                                    </div>
                                  </div>
                                )
                              )
                            )}
                          </div>
                        </section>
                      </div>

                      <div className="grid gap-5 lg:grid-cols-2">
                        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {t("Pontos-chave")}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {t(
                                  "Estruture a leitura do capítulo em conclusões, decisões ou factos verificáveis."
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateActiveChapterBlock(current => ({
                                  ...current,
                                  keyPoints: [...current.keyPoints, ""],
                                }))
                              }
                            >
                              <Plus className="mr-1 size-3.5" />
                              {t("Adicionar")}
                            </Button>
                          </div>
                          <div className="mt-4 space-y-2">
                            {activeChapterBlock.keyPoints.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
                                {t("Ainda não foram adicionados pontos-chave.")}
                              </p>
                            ) : (
                              activeChapterBlock.keyPoints.map(
                                (point, index) => (
                                  <div
                                    key={`${activeEditorial.key}-point-${index}`}
                                    className="flex items-start gap-2"
                                  >
                                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
                                    <Input
                                      value={point}
                                      onChange={event =>
                                        updateActiveChapterBlock(current => ({
                                          ...current,
                                          keyPoints: current.keyPoints.map(
                                            (value, itemIndex) =>
                                              itemIndex === index
                                                ? event.target.value
                                                : value
                                          ),
                                        }))
                                      }
                                      placeholder={t(
                                        "Ex.: alteração relevante, decisão ou conclusão a destacar"
                                      )}
                                      className="bg-background text-xs"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={() =>
                                        updateActiveChapterBlock(current => ({
                                          ...current,
                                          keyPoints: current.keyPoints.filter(
                                            (_, itemIndex) =>
                                              itemIndex !== index
                                          ),
                                        }))
                                      }
                                      aria-label={t("Remover")}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                )
                              )
                            )}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {t("Fontes e referências")}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {t(
                                  "Registe as fontes documentais, fichas ou decisões que suportam este capítulo."
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateActiveChapterBlock(current => ({
                                  ...current,
                                  sourceReferences: [
                                    ...current.sourceReferences,
                                    "",
                                  ],
                                }))
                              }
                            >
                              <Plus className="mr-1 size-3.5" />
                              {t("Adicionar")}
                            </Button>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 text-[11px]"
                              onClick={() =>
                                updateActiveChapterBlock(current => ({
                                  ...current,
                                  sourceReferences: [
                                    ...current.sourceReferences,
                                    `${filteredSubmissions.length} ${t("fichas semanais aprovadas")} (${startWeek || "—"}–${endWeek || "—"})`,
                                  ],
                                }))
                              }
                            >
                              <FileText className="mr-1.5 size-3.5" />
                              {t("Usar fichas aprovadas")}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 text-[11px]"
                              onClick={() =>
                                updateActiveChapterBlock(current => ({
                                  ...current,
                                  sourceReferences: [
                                    ...current.sourceReferences,
                                    `${selectedMeasureCount} ${t("medidas selecionadas para o capítulo 5")}`,
                                  ],
                                }))
                              }
                            >
                              <ListTodo className="mr-1.5 size-3.5" />
                              {t("Usar medidas selecionadas")}
                            </Button>
                            {includeWaste && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 text-[11px]"
                                onClick={() =>
                                  updateActiveChapterBlock(current => ({
                                    ...current,
                                    sourceReferences: [
                                      ...current.sourceReferences,
                                      `${wasteRows.length} e-GAR(s) ${t("no período")}`,
                                    ],
                                  }))
                                }
                              >
                                <Database className="mr-1.5 size-3.5" />
                                {t("Usar e-GARs")}
                              </Button>
                            )}
                          </div>
                          <div className="mt-3 space-y-2">
                            {activeChapterBlock.sourceReferences.length ===
                            0 ? (
                              <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
                                {t(
                                  "Ainda não foram registadas fontes para este capítulo."
                                )}
                              </p>
                            ) : (
                              activeChapterBlock.sourceReferences.map(
                                (reference, index) => (
                                  <div
                                    key={`${activeEditorial.key}-source-${index}`}
                                    className="flex items-center gap-2"
                                  >
                                    <Link2 className="size-3.5 shrink-0 text-primary" />
                                    <Input
                                      value={reference}
                                      onChange={event =>
                                        updateActiveChapterBlock(current => ({
                                          ...current,
                                          sourceReferences:
                                            current.sourceReferences.map(
                                              (value, itemIndex) =>
                                                itemIndex === index
                                                  ? event.target.value
                                                  : value
                                            ),
                                        }))
                                      }
                                      placeholder={t(
                                        "Referência documental, ficheiro, decisão ou registo"
                                      )}
                                      className="bg-background text-xs"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={() =>
                                        updateActiveChapterBlock(current => ({
                                          ...current,
                                          sourceReferences:
                                            current.sourceReferences.filter(
                                              (_, itemIndex) =>
                                                itemIndex !== index
                                            ),
                                        }))
                                      }
                                      aria-label={t("Remover")}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                )
                              )
                            )}
                          </div>
                        </section>
                      </div>

                      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {t("Ações, responsabilidades e prazos")}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {t(
                                "Inclua ações de seguimento apenas quando forem confirmadas. A tabela segue para o capítulo e permite revisão antes da emissão."
                              )}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateActiveChapterBlock(current => ({
                                ...current,
                                actions: [
                                  ...current.actions,
                                  {
                                    action: "",
                                    owner: "",
                                    dueDate: "",
                                    status: "",
                                  },
                                ],
                              }))
                            }
                          >
                            <Plus className="mr-1 size-3.5" />
                            {t("Adicionar ação")}
                          </Button>
                        </div>
                        {activeChapterBlock.actions.length === 0 ? (
                          <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-xs leading-5 text-muted-foreground">
                            {t(
                              "Não existem ações ou prazos registados neste capítulo."
                            )}
                          </div>
                        ) : (
                          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                            <table className="w-full min-w-[760px] text-left text-xs">
                              <thead className="bg-muted/40 text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2 font-medium">
                                    {t("Ação")}
                                  </th>
                                  <th className="px-3 py-2 font-medium">
                                    {t("Responsável")}
                                  </th>
                                  <th className="px-3 py-2 font-medium">
                                    {t("Prazo")}
                                  </th>
                                  <th className="px-3 py-2 font-medium">
                                    {t("Estado")}
                                  </th>
                                  <th className="w-10 px-2 py-2">
                                    <span className="sr-only">
                                      {t("Remover")}
                                    </span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeChapterBlock.actions.map(
                                  (action, index) => (
                                    <tr
                                      key={`${activeEditorial.key}-action-${index}`}
                                      className="border-t border-border"
                                    >
                                      <td className="p-2">
                                        <Input
                                          value={action.action}
                                          onChange={event =>
                                            updateActiveChapterBlock(
                                              current => ({
                                                ...current,
                                                actions: current.actions.map(
                                                  (item, itemIndex) =>
                                                    itemIndex === index
                                                      ? {
                                                          ...item,
                                                          action:
                                                            event.target.value,
                                                        }
                                                      : item
                                                ),
                                              })
                                            )
                                          }
                                          placeholder={t("Ação de seguimento")}
                                          className="h-8 bg-background text-xs"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <Input
                                          value={action.owner}
                                          onChange={event =>
                                            updateActiveChapterBlock(
                                              current => ({
                                                ...current,
                                                actions: current.actions.map(
                                                  (item, itemIndex) =>
                                                    itemIndex === index
                                                      ? {
                                                          ...item,
                                                          owner:
                                                            event.target.value,
                                                        }
                                                      : item
                                                ),
                                              })
                                            )
                                          }
                                          placeholder={t("Entidade ou pessoa")}
                                          className="h-8 bg-background text-xs"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <Input
                                          value={action.dueDate}
                                          onChange={event =>
                                            updateActiveChapterBlock(
                                              current => ({
                                                ...current,
                                                actions: current.actions.map(
                                                  (item, itemIndex) =>
                                                    itemIndex === index
                                                      ? {
                                                          ...item,
                                                          dueDate:
                                                            event.target.value,
                                                        }
                                                      : item
                                                ),
                                              })
                                            )
                                          }
                                          placeholder="dd/mm/aaaa"
                                          className="h-8 bg-background text-xs"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <Input
                                          value={action.status}
                                          onChange={event =>
                                            updateActiveChapterBlock(
                                              current => ({
                                                ...current,
                                                actions: current.actions.map(
                                                  (item, itemIndex) =>
                                                    itemIndex === index
                                                      ? {
                                                          ...item,
                                                          status:
                                                            event.target.value,
                                                        }
                                                      : item
                                                ),
                                              })
                                            )
                                          }
                                          placeholder={t("Ex.: em curso")}
                                          className="h-8 bg-background text-xs"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="size-8 text-muted-foreground hover:text-destructive"
                                          onClick={() =>
                                            updateActiveChapterBlock(
                                              current => ({
                                                ...current,
                                                actions: current.actions.filter(
                                                  (_, itemIndex) =>
                                                    itemIndex !== index
                                                ),
                                              })
                                            )
                                          }
                                          aria-label={t("Remover")}
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        {t(activeEditorial.source)}
                      </span>
                      <span>
                        {t(
                          "Guardado no rascunho apenas quando escolher Guardar rascunho."
                        )}
                      </span>
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={
                          EDITORIAL_SECTIONS.findIndex(
                            section => section.key === activeEditorial.key
                          ) === 0
                        }
                        onClick={() => {
                          const index = EDITORIAL_SECTIONS.findIndex(
                            section => section.key === activeEditorial.key
                          );
                          setActiveEditorialSection(
                            EDITORIAL_SECTIONS[Math.max(0, index - 1)].key
                          );
                        }}
                      >
                        <ChevronLeft className="mr-1 size-4" />
                        {t("Capítulo anterior")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          EDITORIAL_SECTIONS.findIndex(
                            section => section.key === activeEditorial.key
                          ) ===
                          EDITORIAL_SECTIONS.length - 1
                        }
                        onClick={() => {
                          const index = EDITORIAL_SECTIONS.findIndex(
                            section => section.key === activeEditorial.key
                          );
                          setActiveEditorialSection(
                            EDITORIAL_SECTIONS[
                              Math.min(EDITORIAL_SECTIONS.length - 1, index + 1)
                            ].key
                          );
                        }}
                      >
                        {t("Próximo capítulo")}
                        <ChevronRight className="ml-1 size-4" />
                      </Button>
                    </div>
                  </main>

                  <aside className="border-t border-border bg-muted/10 p-4 xl:border-t-0 xl:border-l">
                    <p className="stand-kicker text-primary">
                      {t("PRÉ-VISUALIZAÇÃO DE EMISSÃO")}
                    </p>
                    <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                      <p className="text-xs font-semibold text-foreground">
                        {reportNumber.trim() ||
                          `RDCD-${selectedProject?.code || "PROJ"}-001`}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {selectedProject
                          ? `${selectedProject.code} — ${selectedProject.name}`
                          : t("Projeto por confirmar")}
                      </p>
                      <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">
                            {t("Período")}
                          </span>
                          <span className="font-medium text-foreground">
                            {startWeek && endWeek
                              ? `S${startWeek.split("-W")[1]}–S${endWeek.split("-W")[1]}/${selectedYear}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">
                            {t("Revisão")}
                          </span>
                          <span className="font-medium text-foreground">
                            {revision || "00"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">
                            {t("Perfil")}
                          </span>
                          <span className="text-right font-medium text-foreground">
                            {RDCD_BRAND_PROFILES[brandProfile].label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <div className="flex items-center justify-between border-b border-border bg-muted/25 px-3 py-2">
                          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            <FileTextIcon className="size-3.5 text-primary" />
                            {t("Página em composição")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {t(activeEditorial.label)}
                          </span>
                        </div>
                        <div className="space-y-3 p-3">
                          <p className="text-xs font-semibold leading-5 text-foreground">
                            {t(activeEditorial.label)}
                          </p>
                          <p className="line-clamp-5 text-[11px] leading-5 text-muted-foreground">
                            {activeChapterBlock.summary.trim() ||
                              t(
                                "A síntese técnica deste capítulo aparecerá aqui enquanto é redigida."
                              )}
                          </p>
                          {activeChapterBlock.keyPoints.filter(Boolean).length >
                            0 && (
                            <ul className="space-y-1 text-[10px] leading-4 text-muted-foreground">
                              {activeChapterBlock.keyPoints
                                .filter(Boolean)
                                .slice(0, 3)
                                .map((point, index) => (
                                  <li
                                    key={`${point}-${index}`}
                                    className="flex gap-1.5"
                                  >
                                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                                    {point}
                                  </li>
                                ))}
                            </ul>
                          )}
                          {activeChapterBlock.figures.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {activeChapterBlock.figures
                                .slice(0, 2)
                                .map(figure => (
                                  <figure
                                    key={figure.id}
                                    className="overflow-hidden rounded-md border border-border"
                                  >
                                    <img
                                      src={reportFigureMediaUrl(figure.url)}
                                      alt={
                                        figure.caption || t("Figura do RDCD")
                                      }
                                      className="h-14 w-full object-cover"
                                    />
                                    <figcaption className="truncate px-1.5 py-1 text-[9px] text-muted-foreground">
                                      {figure.caption || t("Sem legenda")}
                                    </figcaption>
                                  </figure>
                                ))}
                            </div>
                          )}
                          {activeChapterBlock.tables.length > 0 && (
                            <p className="rounded-md border border-dashed border-border bg-muted/20 px-2 py-1.5 text-[10px] text-muted-foreground">
                              {activeChapterBlock.tables.length}{" "}
                              {activeChapterBlock.tables.length === 1
                                ? t("tabela composta")
                                : t("tabelas compostas")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                            <ListTodo className="size-4 text-primary" />
                            {t("Medidas selecionadas")}
                          </span>
                          <span className="text-lg font-semibold text-foreground">
                            {selectedMeasureCount}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                          {t("Com semanas escolhidas para o capítulo 5.")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                            <Images className="size-4 text-primary" />
                            {t("Fotografias")}
                          </span>
                          <span className="text-lg font-semibold text-foreground">
                            {selectedPhotoCount}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                          {t("Selecionadas para o anexo fotográfico.")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                            <Database className="size-4 text-primary" />
                            {t("e-GARs")}
                          </span>
                          <span className="text-lg font-semibold text-foreground">
                            {includeWaste ? wasteRows.length : "—"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                          {includeWaste
                            ? t("Serão listados no Anexo III.")
                            : t("Anexo de resíduos desativado.")}
                        </p>
                      </div>
                    </div>
                  </aside>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="stand-surface">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="size-5" />
                    </span>
                    <div>
                      <p className="stand-kicker text-primary">
                        {t("CONTROLO DE EMISSÃO")}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-foreground">
                        {t("Ficha técnica e identidades institucionais")}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t(
                          "Defina os elementos que identificam a versão do Word. Estes dados são guardados no rascunho e aparecem na ficha técnica do relatório."
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <Label>{t("N.º do relatório")}</Label>
                      <Input
                        value={reportNumber}
                        onChange={event => setReportNumber(event.target.value)}
                        placeholder={`RDCD-${selectedProject?.code || "PROJ"}-001`}
                        className="mt-1.5 bg-card"
                      />
                    </div>
                    <div>
                      <Label>{t("Fase da obra reportada")}</Label>
                      <Select
                        value={reportPhase}
                        onValueChange={setReportPhase}
                      >
                        <SelectTrigger className="mt-1.5 bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Preparação prévia">
                            {t("Preparação prévia")}
                          </SelectItem>
                          <SelectItem value="Execução da obra">
                            {t("Execução da obra")}
                          </SelectItem>
                          <SelectItem value="Fase final">
                            {t("Fase final")}
                          </SelectItem>
                          <SelectItem value="Desativação">
                            {t("Desativação")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("Revisão")}</Label>
                      <Input
                        value={revision}
                        onChange={event => setRevision(event.target.value)}
                        placeholder="00"
                        className="mt-1.5 bg-card"
                      />
                    </div>
                    <div>
                      <Label>{t("Elaborado por")}</Label>
                      <Input
                        value={preparedBy}
                        onChange={event => setPreparedBy(event.target.value)}
                        placeholder={t(
                          "Nome / função — Equipa Ambiental Start Campus"
                        )}
                        className="mt-1.5 bg-card"
                      />
                    </div>
                    <div>
                      <Label>{t("Revisto / aprovado por")}</Label>
                      <Input
                        value={reviewedBy}
                        onChange={event => setReviewedBy(event.target.value)}
                        placeholder={t("Nome / função")}
                        className="mt-1.5 bg-card"
                      />
                    </div>
                    <div>
                      <Label>{t("Base de identidades")}</Label>
                      <Select
                        value={brandProfile}
                        onValueChange={value => {
                          const profileId = value as RdcdBrandProfileId;
                          setBrandProfile(profileId);
                          setReportLogos(defaultReportLogos(profileId));
                        }}
                      >
                        <SelectTrigger className="mt-1.5 bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(RDCD_BRAND_PROFILES).map(
                            ([id, profile]) => (
                              <SelectItem key={id} value={id}>
                                {profile.label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {t(
                          "A base repõe os logótipos predefinidos; pode depois personalizar cada entidade apenas para este relatório."
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-border bg-muted/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {t("Logótipos deste RDCD")}
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t(
                            "Altere o nome ou substitua o logótipo de cada entidade. As alterações ficam apenas neste rascunho e são auditadas."
                          )}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-border bg-card text-muted-foreground"
                      >
                        {reportLogos.length}/4
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {reportLogos.map((logo, index) => (
                        <div
                          key={`${logo.url}-${index}`}
                          className="rounded-xl border border-border bg-card p-3"
                        >
                          <div className="flex h-14 items-center justify-center rounded-lg border border-dashed border-border bg-background p-2">
                            <img
                              src={reportLogoMediaUrl(logo.url)}
                              alt={logo.name}
                              className="max-h-10 max-w-full object-contain"
                            />
                          </div>
                          <Label className="mt-3 block text-xs">
                            {t("Entidade")}
                          </Label>
                          <Input
                            value={logo.name}
                            onChange={event =>
                              setReportLogos(current =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, name: event.target.value }
                                    : item
                                )
                              )
                            }
                            className="mt-1 h-8 bg-background text-xs"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                              <input
                                type="file"
                                accept="image/png,image/jpeg"
                                className="sr-only"
                                disabled={uploadLogoMutation.isPending}
                                onChange={event => {
                                  const file = event.target.files?.[0];
                                  if (file) void replaceReportLogo(index, file);
                                  event.currentTarget.value = "";
                                }}
                              />
                              {uploadLogoMutation.isPending
                                ? t("A carregar...")
                                : t("Substituir logótipo")}
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              disabled={reportLogos.length <= 1}
                              onClick={() =>
                                setReportLogos(current =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index
                                  )
                                )
                              }
                              aria-label={t("Remover")}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {reportLogos.length < 4 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() =>
                          setReportLogos(current => [
                            ...current,
                            {
                              name: t("Nova entidade"),
                              url: "/manus-storage/start-campus-rdcd_d271a631.png",
                              type: "png",
                              width: 120,
                              height: 48,
                            },
                          ])
                        }
                      >
                        <Plus className="mr-1.5 size-3.5" />
                        {t("Adicionar entidade")}
                      </Button>
                    )}
                  </div>
                  {usesSin02Template && (
                    <p className="mt-5 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-foreground">
                      {t(
                        "O modelo SIN02 pré-preenche dados institucionais do template. Confirme sempre TUA, licenças e vigência antes da emissão."
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-5">
                <Card className="stand-surface">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Database className="mt-0.5 size-5 text-primary" />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {t("Anexo e-GAR do período")}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {includeWaste
                            ? t(
                                "O anexo usará os registos atuais e-GAR para este projeto e período. Dados ausentes não são estimados."
                              )
                            : t(
                                "O anexo de resíduos está desativado neste rascunho."
                              )}
                        </p>
                        {includeWaste && (
                          <p className="mt-3 text-sm font-semibold text-foreground">
                            {wasteRows.length}{" "}
                            {t("e-GAR(s) encontrados no período")}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {savedDrafts.length > 0 && (
                  <Card className="stand-surface">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        <h3 className="text-sm font-semibold">
                          {t("Rascunhos deste projeto")}
                        </h3>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {savedDrafts.slice(0, 8).map((draft: any) => (
                          <Button
                            key={draft.id}
                            size="sm"
                            variant={
                              draft.id === draftId ? "default" : "outline"
                            }
                            onClick={() => loadDraft(draft)}
                          >
                            {draft.reportNumber || `RDCD #${draft.id}`} · S
                            {draft.startWeek}–S{draft.endWeek}/
                            {draft.reportYear}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ChevronLeft className="mr-1 size-4" />
                {t("Anterior")}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void saveDraft()}
                  disabled={isSavingDraft}
                >
                  <Save className="mr-1.5 size-4" />
                  {isSavingDraft ? t("A guardar...") : t("Guardar rascunho")}
                </Button>
                <Button onClick={() => setStep(5)}>
                  {t("Rever emissão")}
                  <Eye className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: review and generation */}
        {step === 5 && (
          <Card className="stand-surface">
            <CardContent className="p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t("Pré-visualização do RDCD")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(
                      "Revise a seleção e guarde o rascunho antes de gerar o Word. A geração não aprova, assina nem arquiva o relatório."
                    )}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/5 text-primary"
                >
                  {RDCD_BRAND_PROFILES[brandProfile].label}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("Projeto")}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {selectedProject
                      ? `${selectedProject.code} — ${selectedProject.name}`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("Período")}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    S{startWeek.split("-W")[1]}–S{endWeek.split("-W")[1]}/
                    {selectedYear}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("Fichas aprovadas")}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {filteredSubmissions.length}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("e-GARs no anexo")}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {includeWaste ? wasteRows.length : t("Não incluído")}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("Medidas / semanas selecionadas")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {
                      Object.values(measureSelections).filter(
                        item => item.selectedWeeks.length > 0
                      ).length
                    }{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{" "}
                      {Object.values(measureSelections).reduce(
                        (count, item) => count + item.selectedWeeks.length,
                        0
                      )}{" "}
                      {t("semanas")}
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("Fotografias selecionadas")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {Object.values(measureSelections).reduce(
                      (count, item) => count + item.selectedImageUrls.length,
                      0
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("Planos selecionados")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {includePlans ? selectedPlanIds.length : 0}
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-foreground">
                <p className="flex items-center gap-2 font-semibold">
                  <Check className="size-4 text-amber-700 dark:text-amber-300" />
                  {t("Controlo humano obrigatório")}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {t(
                    "Antes de emissão externa, confirme o TUA, anexos, evidências, quantidades e-GAR, conclusões, responsável e aprovação. Este Word é um dossiê de trabalho, não uma aprovação automática."
                  )}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap justify-between gap-3">
                <Button variant="outline" onClick={() => setStep(4)}>
                  <ChevronLeft className="mr-1 size-4" />
                  {t("Anterior")}
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void saveDraft()}
                    disabled={isSavingDraft}
                  >
                    <Save className="mr-1.5 size-4" />
                    {isSavingDraft ? t("A guardar...") : t("Guardar rascunho")}
                  </Button>
                  <Button
                    onClick={generateWord}
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    {isGenerating ? t("A gerar...") : t("Gerar RDCD (.docx)")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
