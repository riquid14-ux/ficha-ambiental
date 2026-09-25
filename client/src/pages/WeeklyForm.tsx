import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";
import { LOGO_URL } from "@/lib/logo";
import { Save, Send, Upload, X, Loader2, AlertTriangle, Check, XCircle, Trash2, FileText, ArrowRight, FilePlus, Paperclip, Download, File, Grid3X3, History, ClipboardList, FileUp, CalendarDays, Building2, ListChecks, CircleAlert, Camera } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MatrizFull from "./Matriz";
import ReviewPageFull from "./ReviewPage";
import SubmissionHistoryFull from "./SubmissionHistory";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { isWeeklyControlMeasureNumber } from "@shared/weekly-control";
import { StandPageHeader } from "@/components/stand/StandPageHeader";
import { StandMetricCard } from "@/components/stand/StandMetricCard";
import { StandStatusBadge } from "@/components/stand/StandStatusBadge";
function getWeekOptions() {
  const now = new Date();
  const year = now.getFullYear();
  const options = [];
  for (let w = 1; w <= 53; w++) {
    options.push({ value: w, label: `Semana ${w}` });
  }
  return { options, year, currentWeek: getISOWeek(now) };
}

function getISOWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function getWeekDates(weekNumber: number, year: number) {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  return { start: fmt(monday), end: fmt(sunday) };
}

type ResponseMap = Record<number, { status: "I" | "C" | "NC" | "NA" | null; observations: string | null }>;

export default function WeeklyForm() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const { activeProject, isAllProjects } = useProject();
  const [responses, setResponses] = useState<ResponseMap>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMeasure, setUploadingMeasure] = useState<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [started, setStarted] = useState(!!params.id);
  const weekOpts = useMemo(() => getWeekOptions(), []);
  const [selectedWeek, setSelectedWeek] = useState(weekOpts.currentWeek);
  const [selectedYear, setSelectedYear] = useState(weekOpts.year);
  const [activeTab, setActiveTab] = useState<string>(params.id ? "nova" : "nova");

  const weekDates = useMemo(() => getWeekDates(selectedWeek, selectedYear), [selectedWeek, selectedYear]);

  const weekInfo = useMemo(() => ({
    weekNumber: selectedWeek,
    weekYear: selectedYear,
    weekStartDate: weekDates.start,
    weekEndDate: weekDates.end,
    projectId: activeProject?.id ?? 0,
  }), [selectedWeek, selectedYear, weekDates, activeProject]);

  const catalogueProjectId = activeProject?.id ?? 0;
  const sectionsQuery = trpc.sections.list.useQuery({ projectId: catalogueProjectId }, { enabled: catalogueProjectId > 0 });
  const measuresQuery = trpc.measures.list.useQuery({ projectId: catalogueProjectId }, { enabled: catalogueProjectId > 0 });
  // FLOW-07 FIX: Query project phases to determine current phase and scope the ficha
  const projectPhasesQuery = trpc.projectPhases.list.useQuery(
    { projectId: activeProject?.id ?? 0 },
    { enabled: !!activeProject?.id }
  );
  const [showAllMeasuresOnRejected, setShowAllMeasuresOnRejected] = useState(false);
  const utils = trpc.useUtils();

  // Fetch all submissions for the user's company (for drafts panel)
  const mySubmissionsQuery = trpc.submissions.mySubmissions.useQuery(undefined, {
    enabled: !!user?.companyId,
  });

  // Filter for draft and rejected fichas (Rascunhos panel)
  const draftsAndRejected = useMemo(() => {
    const data = mySubmissionsQuery.data || [];
    const filtered = data.filter(
      (s: any) => s.status === "draft"
    );
    if (!isAllProjects && activeProject) {
      return filtered.filter((s: any) => s.projectId === activeProject.id);
    }
    return filtered;
  }, [mySubmissionsQuery.data, activeProject, isAllProjects]);

  const rejectedFichas = useMemo(() => {
    const data = mySubmissionsQuery.data || [];
    const filtered = data.filter((s: any) => s.status === "rejected");
    if (!isAllProjects && activeProject) {
      return filtered.filter((s: any) => s.projectId === activeProject.id);
    }
    return filtered;
  }, [mySubmissionsQuery.data, activeProject, isAllProjects]);

  const approvedFichas = useMemo(() => {
    const data = mySubmissionsQuery.data || [];
    const filtered = data.filter((s: any) => s.status === "approved");
    if (!isAllProjects && activeProject) {
      return filtered.filter((s: any) => s.projectId === activeProject.id);
    }
    return filtered;
  }, [mySubmissionsQuery.data, activeProject, isAllProjects]);

  // Fetch company info to filter measures by type
  const companyQuery = trpc.companies.getById.useQuery(
    { id: user?.companyId! },
    { enabled: !!user?.companyId }
  );
  // Determine which measures to show based on user role
  // admin → all 156, EE → measures containing "EE", RAP → measures containing "RAP", dono_obra → measures containing "DO"
  const userRole = user?.role;
  const measureFilterType = useMemo(() => {
    if (userRole === "admin") return null; // show all
    if (userRole === "dono_obra") return "DO";
    if (userRole === "rap") return "RAP";
    // EE, observador, raa, user → use company type or default to EE
    const ct = companyQuery.data?.companyType?.toUpperCase();
    if (ct === "RAP") return "RAP";
    if (ct === "DO" || ct === "DONO_OBRA") return "DO";
    return "EE"; // default for EE companies
  }, [userRole, companyQuery.data?.companyType]);
  const companyName = companyQuery.data?.name ?? "Empresa não atribuída";

  const createOrGetMutation = trpc.submissions.createOrGet.useMutation({
    onSuccess: (data) => {
      if (data && !params.id) {
        setLocation(`/ficha/${data.id}`, { replace: true });
      }
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar ficha"),
  });

  const submissionId = params.id ? Number(params.id) : createOrGetMutation.data?.id;

  const responsesQuery = trpc.responses.getBySubmission.useQuery(
    { submissionId: submissionId! },
    { enabled: !!submissionId }
  );

  const evidenceQuery = trpc.evidence.getBySubmission.useQuery(
    { submissionId: submissionId! },
    { enabled: !!submissionId }
  );

  const filesQuery = trpc.files.getBySubmission.useQuery(
    { submissionId: submissionId! },
    { enabled: !!submissionId }
  );

  const uploadFileMutation = trpc.files.upload.useMutation({
    onSuccess: () => {
      utils.files.getBySubmission.invalidate({ submissionId: submissionId! });
      toast.success(t("Ficheiro anexado com sucesso"));
    },
    onError: (err) => {
      toast.error(err.message || t("Erro ao anexar ficheiro"));
    },
  });

  const deleteFileMutation = trpc.files.delete.useMutation({
    onSuccess: () => {
      utils.files.getBySubmission.invalidate({ submissionId: submissionId! });
      toast.success(t("Ficheiro removido"));
    },
  });

  const submissionQuery = trpc.submissions.getById.useQuery(
    { id: submissionId! },
    { enabled: !!submissionId }
  );

  // Fetch RAA per-measure reviews (for rejected fichas)
  const measureReviewsQuery = trpc.reviewComments.getMeasureReviews.useQuery(
    { submissionId: submissionId! },
    { enabled: !!submissionId }
  );

  // Map of measureId -> review verdict/comment
  const reviewFeedbackMap = useMemo(() => {
    const map = new Map<number, { verdict: string; comment: string | null }>();
    if (measureReviewsQuery.data) {
      for (const r of measureReviewsQuery.data) {
        map.set(r.measureId, { verdict: r.verdict, comment: r.comment });
      }
    }
    return map;
  }, [measureReviewsQuery.data]);

  const saveMutation = trpc.responses.save.useMutation({
    onSuccess: () => {
      toast.success(t("Guardado com sucesso"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const submitMutation = trpc.submissions.submit.useMutation({
    onSuccess: () => {
      toast.success(t("Ficha submetida com sucesso!"));
      utils.submissions.mySubmissions.invalidate();
      setLocation("/historico");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resubmitMutation = trpc.submissions.resubmit.useMutation({
    onSuccess: () => {
      toast.success(t("Ficha resubmetida com sucesso!"));
      utils.submissions.mySubmissions.invalidate();
      setLocation("/historico");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = trpc.submissions.delete.useMutation({
    onSuccess: () => {
      toast.success(t("Ficha eliminada com sucesso!"));
      utils.submissions.mySubmissions.invalidate();
      setLocation("/ficha");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Initialize: create or get submission
  useEffect(() => {
    if (!params.id && user?.companyId && started) {
      createOrGetMutation.mutate(weekInfo);
    }
  }, [user?.companyId, started]);

  // Load existing responses
  useEffect(() => {
    if (responsesQuery.data) {
      const map: ResponseMap = {};
      for (const r of responsesQuery.data) {
        map[r.measureId] = { status: r.status, observations: r.observations ?? null };
      }
      setResponses(map);
    }
  }, [responsesQuery.data]);

  const handleStatusChange = useCallback((measureId: number, status: "I" | "C" | "NC" | "NA") => {
    setResponses((prev) => ({
      ...prev,
      [measureId]: { ...prev[measureId], status, observations: prev[measureId]?.observations ?? null },
    }));
  }, []);

  const handleObservationChange = useCallback((measureId: number, observations: string) => {
    setResponses((prev) => ({
      ...prev,
      [measureId]: { ...prev[measureId], status: prev[measureId]?.status ?? null, observations: observations || null },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!submissionId) return;
    setSaving(true);
    const responsesList = Object.entries(responses).map(([measureId, data]) => ({
      measureId: Number(measureId),
      status: data.status,
      observations: data.observations,
    }));
    await saveMutation.mutateAsync({ submissionId, responses: responsesList });
    setSaving(false);
  }, [submissionId, responses]);

  const handleSubmit = useCallback(async () => {
    if (!confirm(t("Tem a certeza que pretende submeter esta ficha?"))) return;
    if (!submissionId) return;
    setSubmitting(true);
    // Save first
    const responsesList = Object.entries(responses).map(([measureId, data]) => ({
      measureId: Number(measureId),
      status: data.status,
      observations: data.observations,
    }));
    await saveMutation.mutateAsync({ submissionId, responses: responsesList });
    await submitMutation.mutateAsync({ id: submissionId });
    setSubmitting(false);
  }, [submissionId, responses]);

  const handleResubmit = useCallback(async () => {
    if (!submissionId) return;
    setSubmitting(true);
    const responsesList = Object.entries(responses).map(([measureId, data]) => ({
      measureId: Number(measureId),
      status: data.status,
      observations: data.observations,
    }));
    await saveMutation.mutateAsync({ submissionId, responses: responsesList });
    await resubmitMutation.mutateAsync({ id: submissionId });
    setSubmitting(false);
  }, [submissionId, responses]);

  const handleImageUpload = useCallback(async (measureId: number, files: FileList) => {
    if (!submissionId) return;
    setUploadingMeasure(measureId);

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const res = await fetch("/api/upload/evidence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              submissionId,
              measureId,
              filename: file.name,
              mimeType: file.type,
              data: base64,
            }),
          });
          if (res.ok) {
            utils.evidence.getBySubmission.invalidate({ submissionId });
            toast.success(`Imagem "${file.name}" carregada`);
          } else {
            toast.error(t("Erro ao carregar imagem"));
          }
        } catch {
          toast.error("Erro ao carregar imagem");
        }
        setUploadingMeasure(null);
      };
      reader.readAsDataURL(file);
    }
  }, [submissionId]);

  const subStatus = submissionQuery.data?.status;
  const isSubmitted = subStatus === "submitted";
  const isApproved = subStatus === "approved";
  const isRejected = subStatus === "rejected";
  const isUnderReview = subStatus === "under_review";
  const canEdit = subStatus === "draft" || subStatus === "rejected";
  const isReadOnly = user?.role === "observador" || (!canEdit && user?.role !== "admin" && user?.role !== "dono_obra");

  // Can delete: only creator or admin, and only draft/rejected
  const canDelete = (user?.role === "admin" || user?.role === "dono_obra") ||
    ((subStatus === "draft" || subStatus === "rejected") && submissionQuery.data?.createdBy === user?.id);

  // Can submit: only creator or admin
  const canSubmitThis = user?.role === "admin" || user?.role === "dono_obra" || submissionQuery.data?.createdBy === user?.id;

  // Group measures by section
  const measuresBySection = useMemo(() => {
    if (!measuresQuery.data || !sectionsQuery.data) return [];
    // Filter measures: only show those relevant to this user's role
    const weeklyMeasures = measuresQuery.data.filter((m) => isWeeklyControlMeasureNumber(m.number));
    let relevantMeasures = measureFilterType
      ? weeklyMeasures.filter((m) => m.responsible.toUpperCase().includes(measureFilterType))
      : weeklyMeasures;
    // FICHA-03: When ficha is rejected, only show measures marked as 'nok' by reviewer
    if (isRejected && !showAllMeasuresOnRejected && reviewFeedbackMap.size > 0) {
      const nokIds = new Set(Array.from(reviewFeedbackMap.entries()).filter(([, v]) => v.verdict === "nok").map(([id]) => id));
      if (nokIds.size > 0) relevantMeasures = relevantMeasures.filter(m => nokIds.has(m.id));
    }
    const map = new Map<number, typeof relevantMeasures>();
    for (const m of relevantMeasures) {
      if (!map.has(m.sectionId)) map.set(m.sectionId, []);
      map.get(m.sectionId)!.push(m);
    }
    // FLOW-07 FIX: Filter sections to current phase only (unless showAllPhases is on)
    // Ficha semanal shows ALL measures from the DCAPE Word document
    // Filtered only by responsible (EE/RAP/DO) - no phase filtering
    return sectionsQuery.data.map((s) => ({
      section: s,
      measures: map.get(s.id) || [],
    })).filter((s) => s.measures.length > 0);
  }, [measuresQuery.data, sectionsQuery.data, measureFilterType, isRejected, showAllMeasuresOnRejected, reviewFeedbackMap]);

  // Presentation-only decision summary. It deliberately derives from the existing response state.
  const responseSummary = useMemo(() => {
    const measureIds = measuresBySection.flatMap(({ measures }) => measures.map((measure) => measure.id));
    const selectedResponses = measureIds.map((measureId) => responses[measureId]?.status).filter(Boolean);
    return {
      total: measureIds.length,
      completed: selectedResponses.length,
      compliant: selectedResponses.filter((status) => status === "C" || status === "I").length,
      nonCompliant: selectedResponses.filter((status) => status === "NC").length,
    };
  }, [measuresBySection, responses]);

  // Evidence images grouped by measureId (via responseId)
  const imagesByMeasure = useMemo(() => {
    if (!evidenceQuery.data || !responsesQuery.data) return new Map<number, any[]>();
    const responseToMeasure = new Map<number, number>();
    for (const r of responsesQuery.data) {
      responseToMeasure.set(r.id, r.measureId);
    }
    const map = new Map<number, any[]>();
    for (const img of evidenceQuery.data) {
      const measureId = responseToMeasure.get(img.responseId);
      if (measureId) {
        if (!map.has(measureId)) map.set(measureId, []);
        map.get(measureId)!.push(img);
      }
    }
    return map;
  }, [evidenceQuery.data, responsesQuery.data]);

  // Group files by measure (same pattern as images)
  const filesByMeasure = useMemo(() => {
    if (!filesQuery.data || !responsesQuery.data) return new Map<number, any[]>();
    const responseToMeasure = new Map<number, number>();
    for (const r of responsesQuery.data) {
      responseToMeasure.set(r.id, r.measureId);
    }
    const map = new Map<number, any[]>();
    for (const file of filesQuery.data) {
      const measureId = responseToMeasure.get(file.responseId);
      if (measureId) {
        if (!map.has(measureId)) map.set(measureId, []);
        map.get(measureId)!.push(file);
      }
    }
    return map;
  }, [filesQuery.data, responsesQuery.data]);

  const [uploadingFileMeasure, setUploadingFileMeasure] = useState<number | null>(null);

  const handleFileUpload = useCallback(async (measureId: number, files: FileList) => {
    if (!submissionId) return;
    setUploadingFileMeasure(measureId);

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          await uploadFileMutation.mutateAsync({
            submissionId,
            measureId,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            data: base64,
            fileSize: file.size,
          });
        } catch {
          // error handled by mutation
        }
        setUploadingFileMeasure(null);
      };
      reader.readAsDataURL(file);
    }
  }, [submissionId, uploadFileMutation]);

  if (!user?.companyId && user?.role !== "admin") {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">{t("A sua conta ainda não está associada a nenhuma empresa. Contacte apoioamb@startcampus.pt.")}</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1440px] space-y-5 pb-8">
        <div className="print:hidden">
          <StandPageHeader
            eyebrow="DCAPE · ACOMPANHAMENTO OPERACIONAL"
            title="Ficha de Controlo de Medidas Ambientais"
            description={t("Registe evidências, acompanhe medidas e submeta o controlo semanal para revisão ambiental.")}
            context={activeProject?.code || "STAND"}
            tone="operations"
            actions={
              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-card/10 px-3 py-2 text-left backdrop-blur-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card/10"><Building2 className="h-4 w-4 text-primary" /></div>
                <div className="min-w-0">
                  <p className="max-w-[180px] truncate text-xs font-semibold text-white">{companyName}</p>
                  <p className="max-w-[180px] truncate text-[12px] text-primary/70">{user?.name || "—"}</p>
                </div>
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] leading-5 text-primary/80">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{t("Acompanhamento Semanal")}</span>
              {activeProject && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{activeProject.name}</span>}
            </div>
          </StandPageHeader>
        </div>

        {/* Ficha Header with Logo and Company */}
        <Card className="hidden print:block">
          <CardContent className="p-6 print:p-4">
            <div className="flex items-center justify-between mb-4">
              <img src={LOGO_URL} alt="Start Campus" className="h-12 object-contain" />
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{user?.name || "—"}</p>
                <p className="text-xs text-muted-foreground">{companyName}</p>
              </div>
            </div>
            <div className="border-t pt-4">
              <h1 className="text-xl font-bold tracking-tight text-foreground text-center mb-1">
                Ficha de Controlo de Medidas Ambientais
              </h1>
              <p className="text-xs text-muted-foreground text-center">{t("DCAPE — Acompanhamento Semanal")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Nova Ficha / Rascunhos */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border bg-card p-1 shadow-sm sm:grid-cols-3 xl:grid-cols-6 print:hidden">
            <TabsTrigger value="nova" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <FilePlus className="h-3.5 w-3.5" />
              Nova Ficha
            </TabsTrigger>
            <TabsTrigger value="rascunhos" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <FileText className="h-3.5 w-3.5" />
              {t("Estado de Fichas")}
              {(draftsAndRejected.length + rejectedFichas.length + approvedFichas.length) > 0 && (
                <Badge variant="secondary" className="ml-1 border-0 bg-background/20 px-1.5 py-0 text-[12px] text-current">
                  {draftsAndRejected.length + rejectedFichas.length + approvedFichas.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="matriz" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <Grid3X3 className="h-3.5 w-3.5" />
              Matriz
            </TabsTrigger>
            <TabsTrigger value="historico" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <History className="h-3.5 w-3.5" />{t("Histórico")}</TabsTrigger>
            <TabsTrigger value="revisao" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <FileText className="h-3.5 w-3.5" />
              {t("Revisão")}
            </TabsTrigger>

            <TabsTrigger value="pdf-historico" className="min-h-10 gap-1.5 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <FileUp className="h-3.5 w-3.5" />
              {t("Importar Fichas")}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Nova Ficha */}
          <TabsContent value="nova" className="space-y-4 mt-4">
            {/* Date/Week Selection (before starting) */}
            {!started && !params.id && (
          <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
            <CardHeader className="border-b bg-muted/30 px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></div>
                <div>
                  <p className="stand-kicker text-primary">PLANEAMENTO DO CICLO</p>
                  <CardTitle className="mt-1 text-lg tracking-tight">{t("Selecionar Semana")}</CardTitle>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{t("Selecione a semana e o ano para a qual pretende preencher a ficha de controlo.")}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("Semana")}</Label>
                  <Select value={String(selectedWeek)} onValueChange={(v) => setSelectedWeek(Number(v))}>
                    <SelectTrigger className="h-11 bg-background text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOpts.options.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("Ano")}</Label>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger className="h-11 bg-background text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 8 }, (_, i) => 2025 + i).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-4 dark:bg-primary/10">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><CalendarDays className="h-4 w-4" /></div>
                <div>
                  <p className="stand-kicker text-primary">{t("Período:")}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{weekDates.start} <span className="px-1 text-muted-foreground">—</span> {weekDates.end}</p>
                </div>
              </div>
              {isAllProjects && !params.id ? (
                <div className="rounded-xl border border-[#6D7A70]/25 bg-[#EDEBEB]/[0.08] p-4 text-sm text-[#646461] dark:text-[#646461]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{t("Selecione um projeto específico no menu lateral para criar uma ficha de controlo.")}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 border-t pt-5">
                  <Button onClick={() => setStarted(true)} size="lg" className="h-11 w-full gap-2 text-sm font-semibold sm:w-auto sm:px-6">
                    <ArrowRight className="h-4 w-4" />
                    {t("Iniciar Ficha")} — {t("Semana")} {selectedWeek}/{selectedYear}
                  </Button>
                  <p className="text-[12px] leading-5 text-muted-foreground">{t("As respostas da sua última ficha submetida serão carregadas automaticamente como ponto de partida.")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Form Content (after starting or editing existing) */}
        {(started || params.id) && (
          <>
            {/* Status and Actions */}
            <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="stand-kicker text-primary">FICHA EM CURSO</p>
                    {isSubmitted && <StandStatusBadge label={t("Submetida — Aguarda Revisão")} tone="info" />}
                    {isApproved && <StandStatusBadge label={t("Aprovada")} tone="success" />}
                    {isUnderReview && <StandStatusBadge label={t("Em Revisão")} tone="warning" />}
                    {!subStatus && <StandStatusBadge label={t("Rascunho")} tone="neutral" />}
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      {t("Semana")} {submissionQuery.data?.weekNumber || selectedWeek}/{submissionQuery.data?.weekYear || selectedYear}
                    </h2>
                    <span className="text-sm text-muted-foreground">{weekDates.start} — {weekDates.end}</span>
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{companyName}</p>
                </div>
                {!isReadOnly && (
                  <div className="flex flex-wrap items-center gap-2">
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => {
                          if (confirm(t("Tem a certeza que pretende eliminar esta ficha?"))) {
                            deleteMutation.mutate({ id: submissionId! });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    )}
                    <Button variant="outline" className="h-10" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Guardar
                    </Button>
                    {canSubmitThis && (
                      <Button className="h-10" onClick={isRejected ? handleResubmit : handleSubmit} disabled={submitting}>
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        {isRejected ? t("Resubmeter") : t("Submeter")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="grid gap-3 border-t bg-muted/25 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <StandMetricCard label={t("medidas")} value={responseSummary.total} detail="Disponíveis nesta ficha" icon={ListChecks} tone="brand" />
                <StandMetricCard label="RESPONDIDAS" value={<>{responseSummary.completed}<span className="ml-1 text-sm font-medium text-muted-foreground">/ {responseSummary.total}</span></>} detail="Com estado de avaliação" icon={Check} tone="info" />
                <StandMetricCard label="CONFORMES" value={responseSummary.compliant} detail="Implementadas ou conformes" icon={Check} tone="success" />
                <StandMetricCard label="NÃO CONFORMES" value={responseSummary.nonCompliant} detail="Exigem acompanhamento" icon={CircleAlert} tone={responseSummary.nonCompliant > 0 ? "danger" : "neutral"} />
              </div>
            </section>

            {isRejected && (
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-5 dark:bg-rose-500/10">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white"><CircleAlert className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-rose-950 dark:text-rose-100">{t("AÇÃO IMEDIATA NECESSÁRIA")}</h3><StandStatusBadge label={t("Rejeitada")} tone="danger" /></div>
                    <p className="mt-1 text-sm leading-6 text-rose-900/85 dark:text-rose-100/85">{t("Esta ficha foi rejeitada pela RAA e requer correção prioritária.")}</p>
                    {submissionQuery.data?.reviewNotes && (
                      <div className="mt-3 rounded-xl border border-rose-500/20 bg-background/80 p-3">
                        <p className="text-sm leading-6 text-foreground"><strong>{t("Notas do revisor:")}</strong> {submissionQuery.data.reviewNotes}</p>
                      </div>
                    )}
                    {reviewFeedbackMap.size > 0 && (
                      <p className="mt-3 flex items-start gap-2 text-[12px] font-medium leading-5 text-rose-800 dark:text-rose-200">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span><strong>{Array.from(reviewFeedbackMap.values()).filter(v => v.verdict === "nok").length}</strong>{t("medida(s) marcada(s) como não conforme — corrija os itens assinalados abaixo e resubmeta.")}</span>
                      </p>
                    )}
                    <button
                      type="button"
                      className="mt-3 min-h-10 rounded-lg px-2 text-[12px] font-semibold text-rose-800 underline decoration-rose-400 underline-offset-4 hover:text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 dark:text-rose-200 dark:hover:text-white"
                      onClick={() => setShowAllMeasuresOnRejected(prev => !prev)}
                    >
                      {showAllMeasuresOnRejected ? t("Mostrar apenas medidas rejeitadas") : t("Mostrar todas as medidas")}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Measures by Section */}
            <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
              <div>
                <p className="stand-kicker text-primary">MEDIDAS A AVALIAR</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{t("medidas")}</h3>
              </div>
              <p className="text-[12px] leading-5 text-muted-foreground">{responseSummary.completed} / {responseSummary.total} {t("medidas")}</p>
            </div>
            <Accordion type="multiple" className="space-y-3">
          {measuresBySection.map(({ section, measures }) => (
            <AccordionItem key={section.id} value={String(section.id)} className="overflow-hidden rounded-xl border border-border/80 bg-card px-0 shadow-sm">
              <AccordionTrigger className="px-4 py-4 text-sm font-semibold hover:bg-muted/40 hover:no-underline sm:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-3 pr-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[12px] font-bold text-primary">{String(section.phase).slice(0, 2)}</span>
                  <span className="min-w-0 text-left leading-5">{section.name.length > 60 ? section.name.slice(0, 60) + "..." : section.name}</span>
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[12px] font-semibold text-muted-foreground"><ListChecks className="h-3.5 w-3.5" />{measures.length}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="border-t bg-muted/[0.18] px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
                <div className="space-y-3">
                  {measures.map((measure) => {
                    const response = responses[measure.id];
                    const images = imagesByMeasure.get(measure.id) || [];
                    const reviewFeedback = reviewFeedbackMap.get(measure.id);
                    return (
                      <article key={measure.id} className={`space-y-4 rounded-xl border p-4 shadow-sm sm:p-5 ${reviewFeedback?.verdict === "nok" ? "border-rose-500/30 bg-rose-500/[0.045] dark:bg-rose-500/10" : "border-border/80 bg-card"}`}>
                        <div className="flex items-start gap-3">
                          <span className="rounded-lg bg-muted px-2.5 py-1.5 font-mono text-[12px] font-semibold text-foreground shadow-sm">
                            {measure.number}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-6 text-foreground">{measure.description}</p>
                            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                              Responsável: {measure.responsible.replace(/\|/g, " / ").replace(/\bDO\b/g, "Dono de Obra").replace(/\bEE\b/g, "Entidade Executante").replace(/\bRAP\b/g, "Resp. Acomp. Patrimonial").replace(/\bRAA\b/g, "Resp. Acomp. Ambiental")}
                            </p>
                          </div>
                          {reviewFeedback && (
                            <StandStatusBadge label={reviewFeedback.verdict === "ok" ? "RAA: OK" : "RAA: NC"} tone={reviewFeedback.verdict === "ok" ? "success" : "danger"} />
                          )}
                        </div>

                        {/* RAA Review Feedback */}
                        {reviewFeedback && (reviewFeedback.comment || reviewFeedback.verdict === "nok") && (
                          <div className={`rounded-lg border p-3 text-[12px] leading-5 ${reviewFeedback.verdict === "nok" ? "border-rose-500/20 bg-rose-500/[0.08] text-rose-900 dark:text-rose-200" : "border-primary/20 bg-primary/[0.08] text-primary dark:text-primary"}`}>
                            <strong>{t("Comentário RAA:")}</strong> {reviewFeedback.comment || (reviewFeedback.verdict === "nok" ? "Medida marcada como não conforme — necessita correção." : "Conforme.")}
                          </div>
                        )}

                        {/* Status Radio */}
                        <fieldset className="space-y-2">
                          <legend className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Estado da medida</legend>
                          <RadioGroup
                            value={response?.status || ""}
                            onValueChange={(v) => handleStatusChange(measure.id, v as any)}
                            className="grid grid-cols-2 gap-2 lg:grid-cols-4"
                            disabled={isReadOnly}
                          >
                            {(["I", "C", "NC", "NA"] as const).map((s) => {
                              const selected = response?.status === s;
                              const stateLabel = s === "I" ? t("Implementado") : s === "C" ? t("Conforme") : s === "NC" ? t("Não Conforme") : t("N/A");
                              const stateClass = s === "NC" ? "border-rose-500/35 bg-rose-500/[0.07] has-[[data-state=checked]]:border-rose-600 has-[[data-state=checked]]:bg-rose-500/[0.13]" : s === "C" || s === "I" ? "border-primary/25 bg-primary/[0.04] has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/[0.12]" : "border-border bg-background has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/[0.08]";
                              return (
                                <Label key={s} htmlFor={`${measure.id}-${s}`} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[12px] font-semibold transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${stateClass} ${isReadOnly ? "cursor-default opacity-70" : "hover:border-primary/50"}`}>
                                  <RadioGroupItem value={s} id={`${measure.id}-${s}`} aria-label={stateLabel} />
                                  <span>{stateLabel}</span>
                                  {selected && <Check className="ml-auto h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                                </Label>
                              );
                            })}
                          </RadioGroup>
                        </fieldset>

                        {/* Observations */}
                        <Textarea
                          placeholder={t("Observações...")}
                          value={response?.observations || ""}
                          onChange={(e) => handleObservationChange(measure.id, e.target.value)}
                          aria-label={`${t("Observações...")} — ${measure.number}`}
                          className="min-h-[76px] resize-y bg-background text-sm leading-6"
                          disabled={isReadOnly}
                        />

                        {/* Images */}
                        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                          {images.map((img: any) => (
                            <div key={img.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border bg-muted shadow-sm">
                              <img src={img.url} alt={`${t("Imagem")} — ${measure.number}`} className="h-full w-full object-cover" />
                            </div>
                          ))}
                          {!isReadOnly && (
                            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:bg-primary/[0.04] hover:text-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                              {uploadingMeasure === measure.id ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Camera className="h-5 w-5" />
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                aria-label={`Carregar imagem — ${measure.number}`}
                                className="hidden"
                                onChange={(e) => e.target.files && handleImageUpload(measure.id, e.target.files)}
                              />
                            </label>
                          )}
                        </div>

                        {/* Files */}
                        {(() => {
                          const measureFiles = filesByMeasure.get(measure.id) || [];
                          return (
                            <div className="space-y-1.5">
                              {measureFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {measureFiles.map((f: any) => (
                                    <div key={f.id} className="group flex min-h-9 items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-[12px]">
                                      <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[150px]" title={f.filename}>
                                        {f.filename}
                                      </a>
                                      {f.fileSize && (
                                        <span className="text-muted-foreground">({Math.round(f.fileSize / 1024)}KB)</span>
                                      )}
                                      <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`${t("Download")} ${f.filename}`} className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        <Download className="h-3.5 w-3.5" />
                                      </a>
                                      {!isReadOnly && (
                                        <button
                                          type="button"
                                          onClick={() => deleteFileMutation.mutate({ id: f.id })}
                                          aria-label={`${t("Eliminar")} ${f.filename}`}
                                          className="text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!isReadOnly && (
                                <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                                  {uploadingFileMeasure === measure.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Paperclip className="h-3.5 w-3.5" />
                                  )}
                                  <span>{t("Anexar ficheiro")}</span>
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.csv"
                                    multiple
                                    aria-label={`${t("Anexar ficheiro")} — ${measure.number}`}
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleFileUpload(measure.id, e.target.files)}
                                  />
                                </label>
                              )}
                            </div>
                          );
                        })()}
                      </article>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
            </Accordion>
          </>
        )}
        </TabsContent>

          {/* Tab: Rascunhos */}
        <TabsContent value="rascunhos" className="mt-4">
            <div className="space-y-6">
              {mySubmissionsQuery.isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">{t("A carregar...")}</span>
                </div>
              )}

              {/* Sub-secção: Rejeitadas */}
              {rejectedFichas.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-red-700">
                      <XCircle className="w-5 h-5" />
                      {t("Rejeitadas")}
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{rejectedFichas.length}</Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{t("Fichas devolvidas pela RAA para correcção. Ação imediata necessária.")}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {rejectedFichas.map((sub: any) => (
                      <div key={sub.id} className="p-3 rounded-lg border border-red-200 bg-red-50/50 transition-all hover:shadow-md">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{t("Semana")} {sub.weekNumber} / {sub.weekYear}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{sub.weekStartDate} — {sub.weekEndDate}</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{t("Corrigir")}</span>
                          </div>
                        </div>
                        <Button variant="destructive" size="sm" className="w-full mt-2 gap-2" onClick={() => setLocation(`/ficha/${sub.id}`)}>
                          <ArrowRight className="w-4 h-4" /> {t("Corrigir e Resubmeter")}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Sub-secção: Rascunhos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5" />
                    {t("Rascunhos")}
                    {draftsAndRejected.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{draftsAndRejected.length}</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{t("Fichas em rascunho que ainda não foram submetidas.")}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {draftsAndRejected.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <FileText className="w-8 h-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">{t("Sem rascunhos neste projeto.")}</p>
                    </div>
                  )}
                  {draftsAndRejected.map((sub: any) => (
                    <div key={sub.id} className="p-3 rounded-lg border border-border bg-card transition-all hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{t("Semana")} {sub.weekNumber} / {sub.weekYear}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{sub.weekStartDate} — {sub.weekEndDate}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{t("Rascunho")}</Badge>
                      </div>
                      <Button variant="default" size="sm" className="w-full mt-2 gap-2" onClick={() => setLocation(`/ficha/${sub.id}`)}>
                        <ArrowRight className="w-4 h-4" /> {t("Continuar")}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Sub-secção: Aprovadas */}
              <Card className="border-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-primary">
                    <Check className="w-5 h-5" />
                    {t("Aprovadas")}
                    {approvedFichas.length > 0 && <Badge className="text-[10px] px-1.5 py-0 bg-primary">{approvedFichas.length}</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{t("Fichas aprovadas pela RAA. Estas fichas contam para o compliance.")}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {approvedFichas.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Check className="w-8 h-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">{t("Sem fichas aprovadas neste projeto.")}</p>
                    </div>
                  )}
                  {approvedFichas.map((sub: any) => (
                    <div key={sub.id} className="p-3 rounded-lg border border-primary bg-primary/50 transition-all hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{t("Semana")} {sub.weekNumber} / {sub.weekYear}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{sub.weekStartDate} — {sub.weekEndDate}</p>
                        </div>
                        <Badge className="text-xs bg-primary">{t("Aprovada")}</Badge>
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-2 gap-2 text-primary border-primary" onClick={() => setLocation(`/ficha/${sub.id}`)}>
                        <ArrowRight className="w-4 h-4" /> {t("Ver Ficha")}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Matriz */}
          <TabsContent value="matriz" className="mt-4">
            <MatrizEmbedded />
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="historico" className="mt-4">
            <SubmissionHistoryFull embedded />
          </TabsContent>

          {/* Tab: Revisão */}
          <TabsContent value="revisao" className="mt-4">
            <ReviewPageFull embedded />
          </TabsContent>

          {/* Tab: Submissões (todas) */}
          <TabsContent value="submissoes" className="mt-4">
            <SubmissoesEmbedded />
          </TabsContent>

          {/* Tab: Histórico PDF */}
          <TabsContent value="pdf-historico" className="mt-4">
            <HistoricoEmbedded />
          </TabsContent>

        </Tabs>
      </div>
    </AppLayout>
  );
}





function MatrizEmbedded() {
  return <MatrizFull embedded />;
}

function SubmissoesEmbedded() {
  const { t } = useLanguage();
  const { activeProject } = useProject();
  const submissionsQuery = trpc.submissions.listAll.useQuery({});
  const companiesQuery = trpc.companies.list.useQuery();
  const companyMap = new Map(companiesQuery.data?.map((c: any) => [c.id, c]) || []);
  const [, setLocation] = useLocation();

  const filtered = useMemo(() => {
    if (!submissionsQuery.data || !activeProject) return [];
    return submissionsQuery.data.filter((s: any) => s.projectId === activeProject.id);
  }, [submissionsQuery.data, activeProject]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          {t("Todas as Submissões")} — {activeProject?.code || ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">{t("Semana")}</th>
                <th className="text-left py-2 px-3 font-medium">{t("Empresa")}</th>
                <th className="text-left py-2 px-3 font-medium">{t("Estado")}</th>
                <th className="text-left py-2 px-3 font-medium">{t("Período")}</th>
                <th className="text-left py-2 px-3 font-medium">{t("Ações")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => {
                const company = companyMap.get(s.companyId);
                return (
                  <tr key={s.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">S{s.weekNumber}/{s.weekYear}</td>
                    <td className="py-2 px-3">{company?.shortName || "-"}</td>
                    <td className="py-2 px-3">
                      <Badge variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "outline"} className="text-xs">
                        {s.status === "approved" ? t("Aprovada") : s.status === "rejected" ? t("Rejeitada") : s.status === "submitted" ? t("Submetida") : s.status === "under_review" ? t("Em Revisão") : t("Rascunho")}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{s.weekStartDate} — {s.weekEndDate}</td>
                    <td className="py-2 px-3">
                      <Button variant="ghost" size="sm" onClick={() => setLocation(`/ficha/${s.id}`)} className="text-xs">
                        {t("Ver")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t("Nenhuma submissão encontrada.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoricoPdfEmbedded() {
  const { t } = useLanguage();
  const { activeProject } = useProject();
  const utils = trpc.useUtils();
  const companiesQuery = trpc.companies.list.useQuery();
  const historicalQuery = trpc.historical.list.useQuery({});
  const uploadMutation = trpc.historical.upload.useMutation({
    onSuccess: () => {
      toast.success(t("PDF histórico carregado com sucesso"));
      utils.historical.list.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [weekNumber, setWeekNumber] = useState<string>("");
  const [weekYear, setWeekYear] = useState<string>(String(new Date().getFullYear()));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedCompany || !weekNumber || !weekYear) {
      toast.error(t("Preencha todos os campos e selecione um ficheiro."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        companyId: Number(selectedCompany),
        weekNumber: Number(weekNumber),
        weekYear: Number(weekYear),
        filename: file.name,
        mimeType: file.type || "application/pdf",
        data: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const filtered = useMemo(() => {
    if (!historicalQuery.data) return [];
    return historicalQuery.data;
  }, [historicalQuery.data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="w-5 h-5" />
            {t("Carregar Ficha Histórica (PDF)")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>{t("Empresa")}</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger><SelectValue placeholder={t("Selecionar...")} /></SelectTrigger>
                <SelectContent>
                  {companiesQuery.data?.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.companyType === "rap" ? "RAP - " : ""}{c.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("Semana")}</Label>
              <Input type="number" min={1} max={53} value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} placeholder="Ex: 32" />
            </div>
            <div>
              <Label>{t("Ano")}</Label>
              <Input type="number" min={2020} max={2035} value={weekYear} onChange={(e) => setWeekYear(e.target.value)} />
            </div>
            <div>
              <Label>{t("Ficheiro PDF")}</Label>
              <Input type="file" accept=".pdf" ref={fileInputRef} />
            </div>
          </div>
          <Button className="mt-4 gap-2" onClick={handleUpload} disabled={uploadMutation.isPending}>
            <FileUp className="w-4 h-4" />
            {uploadMutation.isPending ? t("A carregar...") : t("Carregar PDF")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Fichas Históricas")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">{t("Semana")}</th>
                  <th className="text-left py-2 px-3 font-medium">{t("Empresa")}</th>
                  <th className="text-left py-2 px-3 font-medium">{t("Ficheiro")}</th>
                  <th className="text-left py-2 px-3 font-medium">{t("Data Upload")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h: any) => {
                  const company = companiesQuery.data?.find((c: any) => c.id === h.companyId);
                  return (
                    <tr key={h.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">S{h.weekNumber}/{h.weekYear}</td>
                      <td className="py-2 px-3">{company?.companyType === "rap" ? "RAP - " : ""}{company?.shortName || "-"}</td>
                      <td className="py-2 px-3">
                        <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-[#0A3638] hover:underline text-sm">
                          {h.filename || "PDF"}
                        </a>
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {new Date(h.uploadedAt).toLocaleDateString("pt-PT")}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      {t("Nenhuma ficha histórica carregada")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HistoricoEmbedded() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeProject } = useProject();
  const canChooseCompany = ["admin", "dono_obra", "raa"].includes(user?.role || "");
  const canSubmitForReview = ["admin", "dono_obra", "ee", "rap"].includes(user?.role || "");
  const canArchiveApproved = ["admin", "raa"].includes(user?.role || "");
  const [destination, setDestination] = useState<"review" | "historical">("review");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [importWeek, setImportWeek] = useState<number>(1);
  const [importYear, setImportYear] = useState<number>(new Date().getFullYear());
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const companiesQuery = trpc.projects.getCompanies.useQuery(
    { projectId: activeProject?.id || 0 },
    { enabled: !!activeProject && canChooseCompany }
  );
  const ownCompanyQuery = trpc.companies.getById.useQuery(
    { id: user?.companyId || 0 },
    { enabled: !!user?.companyId && !canChooseCompany }
  );
  const analyzeMutation = trpc.submissions.analyzeImport.useMutation();
  const commitMutation = trpc.submissions.commitImport.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (user?.role === "raa") setDestination("historical");
    if (!canArchiveApproved && destination === "historical") setDestination("review");
  }, [user?.role, canArchiveApproved, destination]);

  useEffect(() => {
    if (!canChooseCompany && user?.companyId) {
      setSelectedCompany(String(user.companyId));
    }
  }, [canChooseCompany, user?.companyId]);

  useEffect(() => {
    setPreview(null);
  }, [destination, selectedCompany, importWeek, importYear, importFile, activeProject?.id]);

  const availableCompanies = canChooseCompany
    ? (companiesQuery.data || [])
    : (ownCompanyQuery.data ? [ownCompanyQuery.data] : []);
  const selectedCompanyData = availableCompanies.find((company: any) => company.id === Number(selectedCompany));

  const resetImport = () => {
    setImportFile(null);
    setPreview(null);
    if (canChooseCompany) setSelectedCompany("");
  };

  const handleAnalyze = async () => {
    if (!importFile || !activeProject || !selectedCompany) {
      toast.error(t("Seleccione o projecto, a empresa e o ficheiro."));
      return;
    }
    if (importFile.size > 10 * 1024 * 1024) {
      toast.error(t("O ficheiro excede o limite de 10 MB."));
      return;
    }
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
        reader.readAsDataURL(importFile);
      });
      const result = await analyzeMutation.mutateAsync({
        projectId: activeProject.id,
        companyId: Number(selectedCompany),
        weekNumber: importWeek,
        year: importYear,
        destination,
        fileBase64,
        filename: importFile.name,
      });
      setPreview(result);
      toast.success(t("Análise concluída. Confirme a pré-visualização antes de gravar."));
    } catch (error: any) {
      toast.error(error.message || t("Não foi possível analisar o ficheiro."));
    }
  };

  const handleCommit = async () => {
    if (!preview || !activeProject || !selectedCompany) return;
    try {
      const result = await commitMutation.mutateAsync({
        projectId: activeProject.id,
        companyId: Number(selectedCompany),
        weekNumber: importWeek,
        year: importYear,
        destination,
        fileKey: preview.fileKey,
        filename: preview.filename,
        mimeType: preview.mimeType,
        responses: preview.responses.map((response: any) => ({
          measureId: response.measureId,
          status: response.status,
          observations: response.observations || null,
        })),
        images: preview.images.map((image: any) => ({
          fileKey: image.fileKey,
          filename: image.filename,
          mimeType: image.mimeType,
          page: image.page,
        })),
      });
      toast.success(
        result.status === "approved"
          ? t("Ficha histórica aprovada adicionada ao histórico.")
          : t("Ficha importada e submetida à RAA para revisão.")
      );
      resetImport();
      await Promise.all([
        utils.submissions.invalidate(),
        utils.historical.invalidate(),
        utils.analytics.invalidate(),
        utils.matrix.invalidate(),
      ]);
    } catch (error: any) {
      toast.error(error.message || t("Não foi possível guardar a ficha importada."));
    }
  };

  if (!activeProject) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-10 h-10 text-[#646461] mx-auto mb-3" />
          <h3 className="font-semibold">{t("Seleccione um projecto")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("A importação de fichas é sempre associada a um projecto específico.")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-white">
          <CardTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-primary" />
            {t("Importar Ficha Externa")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("Receba fichas criadas no Word ou noutra aplicação sem perder o fluxo de revisão, o histórico ou a rastreabilidade.")}
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div>
            <Label className="text-sm font-semibold">{t("1. Escolha o destino da ficha")}</Label>
            <RadioGroup value={destination} onValueChange={(value) => setDestination(value as "review" | "historical")} className="grid md:grid-cols-2 gap-3 mt-3">
              {canSubmitForReview && (
                <label className={`rounded-xl border p-4 cursor-pointer transition-colors ${destination === "review" ? "border-[#0A3638] bg-[#0A3638]" : "hover:bg-muted/40"}`}>
                  <div className="flex gap-3">
                    <RadioGroupItem value="review" className="mt-1" />
                    <div>
                      <p className="font-semibold">{t("Submeter para revisão")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("A ficha entra como Submetida. A RAA recebe a notificação e pode aprovar ou rejeitar medidas.")}</p>
                    </div>
                  </div>
                </label>
              )}
              {canArchiveApproved && (
                <label className={`rounded-xl border p-4 cursor-pointer transition-colors ${destination === "historical" ? "border-primary bg-primary" : "hover:bg-muted/40"}`}>
                  <div className="flex gap-3">
                    <RadioGroupItem value="historical" className="mt-1" />
                    <div>
                      <p className="font-semibold">{t("Adicionar ao histórico aprovado")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("Para fichas antigas já validadas. Fica aprovada, auditada e disponível no Histórico, Dashboard, Matriz e RDCD.")}</p>
                    </div>
                  </div>
                </label>
              )}
            </RadioGroup>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <Label>{t("Projecto")}</Label>
              <Input value={`${activeProject.code} — ${activeProject.name}`} disabled className="mt-1" />
            </div>
            <div>
              <Label>{t("Empresa")}</Label>
              {canChooseCompany ? (
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("Seleccionar empresa")} /></SelectTrigger>
                  <SelectContent>
                    {availableCompanies.map((company: any) => (
                      <SelectItem key={company.id} value={String(company.id)}>{company.shortName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={selectedCompanyData?.shortName || t("A carregar...")} disabled className="mt-1" />
              )}
            </div>
            <div>
              <Label>{t("Semana")}</Label>
              <Select value={String(importWeek)} onValueChange={(value) => setImportWeek(Number(value))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 53 }, (_, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>{t("Semana")} {index + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("Ano")}</Label>
              <Input type="number" min={2020} max={2100} value={importYear} onChange={(event) => setImportYear(Number(event.target.value))} className="mt-1" />
            </div>
          </div>

          <div className="rounded-xl border border-dashed p-5 bg-muted/20">
            <Label>{t("2. Seleccione o documento")}</Label>
            <div className="relative mt-2 min-h-11 rounded-md border bg-background hover:bg-muted/40 transition-colors">
              <input
                id="external-ficha-file"
                type="file"
                accept=".pdf,.docx"
                aria-label={t("Escolher ficheiro PDF ou Word")}
                onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              />
              <div className="min-h-11 px-4 py-2 flex items-center justify-between gap-3 pointer-events-none">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Upload className="w-4 h-4 text-primary" />
                  {importFile ? importFile.name : t("Escolher ficheiro PDF ou Word")}
                </span>
                <span className="text-xs text-muted-foreground">{t("Procurar")}</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-2 mt-2 text-xs text-muted-foreground">
              <span>{t("Formatos aceites: PDF e Word (.docx). Máximo 10 MB.")}</span>
              {importFile && <span className="font-medium text-foreground">{(importFile.size / 1024 / 1024).toFixed(2)} MB</span>}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleAnalyze} disabled={!importFile || !selectedCompany || analyzeMutation.isPending} className="gap-2">
              {analyzeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {analyzeMutation.isPending ? t("A analisar texto e fotografias...") : t("Analisar e pré-visualizar")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card className="border-[#0A3638]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>{t("3. Confirme a pré-visualização")}</span>
              <Badge variant="outline">{preview.matchedMeasures} / {preview.totalMeasures} {t("medidas")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{t("Empresa")}</p><p className="font-semibold">{selectedCompanyData?.shortName}</p></div>
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{t("Período")}</p><p className="font-semibold">S{importWeek}/{importYear}</p></div>
              {(["I", "C", "NC", "NA"] as const).map(status => (
                <div key={status} className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{status}</p><p className="font-semibold text-xl">{preview.counts?.[status] || 0}</p></div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <span><strong>{preview.extractedPhotos}</strong> {t("fotografias extraídas")}</span>
              <a href={preview.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[#0A3638] hover:underline">{t("Abrir documento original")}</a>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr><th className="text-left p-3">{t("Medida")}</th><th className="text-left p-3">{t("Estado")}</th><th className="text-left p-3">{t("Observações")}</th></tr>
                  </thead>
                  <tbody>
                    {preview.responses.map((response: any) => (
                      <tr key={response.measureId} className="border-t align-top">
                        <td className="p-3"><p className="font-medium">{response.measureCode}</p><p className="text-xs text-muted-foreground line-clamp-2 max-w-xl">{response.measureDescription}</p></td>
                        <td className="p-3 min-w-[110px]">
                          <Select
                            value={response.status}
                            onValueChange={(status) => setPreview((current: any) => ({
                              ...current,
                              responses: current.responses.map((item: any) => item.measureId === response.measureId ? { ...item, status } : item),
                              counts: current.responses.reduce((counts: Record<string, number>, item: any) => {
                                const nextStatus = item.measureId === response.measureId ? status : item.status;
                                counts[nextStatus] = (counts[nextStatus] || 0) + 1;
                                return counts;
                              }, { I: 0, C: 0, NC: 0, NA: 0 }),
                            }))}
                          >
                            <SelectTrigger className={response.status === "NC" ? "border-red-300 text-red-700" : ""}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(["I", "C", "NC", "NA"] as const).map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 min-w-[300px]">
                          <Textarea
                            value={response.observations || ""}
                            onChange={(event) => setPreview((current: any) => ({
                              ...current,
                              responses: current.responses.map((item: any) => item.measureId === response.measureId ? { ...item, observations: event.target.value } : item),
                            }))}
                            placeholder={t("Confirmar ou corrigir observações")}
                            className="min-h-[72px] text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg bg-[#EDEBEB] border border-[#6D7A70] p-3 flex gap-2 text-sm text-[#646461]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t("A leitura automática é assistiva. Confirme o projecto, empresa, semana, estados e observações antes de gravar.")}</span>
            </div>

            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="outline" onClick={() => setPreview(null)}>{t("Voltar e alterar")}</Button>
              <Button onClick={handleCommit} disabled={commitMutation.isPending} className="gap-2">
                {commitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {destination === "historical" ? t("Confirmar histórico aprovado") : t("Submeter à RAA para revisão")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
