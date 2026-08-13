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
import { Save, Send, Upload, X, Image as ImageIcon, Loader2, AlertTriangle, Check, XCircle, Trash2, FileText, ArrowRight } from "lucide-react";
import { FilePlus, Paperclip, Download, File, Grid3X3, History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MatrizFull from "./Matriz";
import ReviewPageFull from "./ReviewPage";
import SubmissionHistoryFull from "./SubmissionHistory";
import { Input } from "@/components/ui/input";

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

  const sectionsQuery = trpc.sections.list.useQuery();
  const measuresQuery = trpc.measures.list.useQuery();
  const utils = trpc.useUtils();

  // Fetch all submissions for the user's company (for drafts panel)
  const mySubmissionsQuery = trpc.submissions.mySubmissions.useQuery(undefined, {
    enabled: !!user?.companyId,
  });

  // Filter for draft and rejected fichas (Rascunhos panel)
  const draftsAndRejected = useMemo(() => {
    const data = mySubmissionsQuery.data || [];
    const filtered = data.filter(
      (s: any) => s.status === "draft" || s.status === "rejected"
    );
    // Filter by active project
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
      toast.success("Ficheiro anexado com sucesso");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao anexar ficheiro");
    },
  });

  const deleteFileMutation = trpc.files.delete.useMutation({
    onSuccess: () => {
      utils.files.getBySubmission.invalidate({ submissionId: submissionId! });
      toast.success("Ficheiro removido");
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
      toast.success("Guardado com sucesso");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const submitMutation = trpc.submissions.submit.useMutation({
    onSuccess: () => {
      toast.success("Ficha submetida com sucesso!");
      utils.submissions.mySubmissions.invalidate();
      setLocation("/historico");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resubmitMutation = trpc.submissions.resubmit.useMutation({
    onSuccess: () => {
      toast.success("Ficha resubmetida com sucesso!");
      utils.submissions.mySubmissions.invalidate();
      setLocation("/historico");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = trpc.submissions.delete.useMutation({
    onSuccess: () => {
      toast.success("Ficha eliminada com sucesso!");
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
            toast.error("Erro ao carregar imagem");
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
  const canDelete = (subStatus === "draft" || subStatus === "rejected") &&
    (user?.role === "admin" || user?.role === "dono_obra" || submissionQuery.data?.createdBy === user?.id);

  // Can submit: only creator or admin
  const canSubmitThis = user?.role === "admin" || user?.role === "dono_obra" || submissionQuery.data?.createdBy === user?.id;

  // Group measures by section
  const measuresBySection = useMemo(() => {
    if (!measuresQuery.data || !sectionsQuery.data) return [];
    // Filter measures: only show those relevant to this user's role
    const relevantMeasures = measureFilterType
      ? measuresQuery.data.filter((m) => m.responsible.toUpperCase().includes(measureFilterType))
      : measuresQuery.data;
    const map = new Map<number, typeof relevantMeasures>();
    for (const m of relevantMeasures) {
      if (!map.has(m.sectionId)) map.set(m.sectionId, []);
      map.get(m.sectionId)!.push(m);
    }
    return sectionsQuery.data.map((s) => ({
      section: s,
      measures: map.get(s.id) || [],
    })).filter((s) => s.measures.length > 0);
  }, [measuresQuery.data, sectionsQuery.data, measureFilterType]);

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
            <p className="text-muted-foreground">
              A sua conta ainda não está associada a nenhuma empresa. Contacte Nairana Aguiar (npa@startcampus.pt).
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">  
        {/* Aerial hero image */}
        <div className="relative rounded-xl overflow-hidden h-44">
          <img src="https://www.startcampus.pt/hubfs/Images/Webiste/Start_Campus__%20(8).jpg" alt="Start Campus Sines" className="w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end pb-3 pl-5">
            <p className="text-white text-xs font-medium opacity-90">Start Campus — Sines, Portugal</p>
          </div>
        </div>

        {/* Ficha Header with Logo and Company */}
        <Card>
          <CardContent className="p-6">
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
              <p className="text-xs text-muted-foreground text-center">DCAPE — Acompanhamento Semanal</p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Nova Ficha / Rascunhos */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="nova" className="gap-1 text-xs">
              <FilePlus className="w-3.5 h-3.5" />
              Nova Ficha
            </TabsTrigger>
            <TabsTrigger value="rascunhos" className="gap-1 text-xs">
              <FileText className="w-3.5 h-3.5" />
              Rascunhos
              {draftsAndRejected.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                  {draftsAndRejected.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="matriz" className="gap-1 text-xs">
              <Grid3X3 className="w-3.5 h-3.5" />
              Matriz
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1 text-xs">
              <History className="w-3.5 h-3.5" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="revisao" className="gap-1 text-xs">
              <FileText className="w-3.5 h-3.5" />
              Revisão
            </TabsTrigger>
          </TabsList>

          {/* Tab: Nova Ficha */}
          <TabsContent value="nova" className="space-y-4 mt-4">
            {/* Date/Week Selection (before starting) */}
            {!started && !params.id && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selecionar Semana</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione a semana e o ano para a qual pretende preencher a ficha de controlo.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Semana</Label>
                  <Select value={String(selectedWeek)} onValueChange={(v) => setSelectedWeek(Number(v))}>
                    <SelectTrigger>
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
                  <Label className="text-sm font-medium">Ano</Label>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger>
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
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  Período: <strong>{weekDates.start}</strong> a <strong>{weekDates.end}</strong>
                </p>
              </div>
              {isAllProjects && !params.id ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Selecione um projeto específico no menu lateral para criar uma ficha de controlo.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button onClick={() => setStarted(true)} size="lg" className="w-full">
                    Iniciar Ficha — Semana {selectedWeek}/{selectedYear}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    As respostas da sua última ficha submetida serão carregadas automaticamente como ponto de partida.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Form Content (after starting or editing existing) */}
        {(started || params.id) && (
          <>
            {/* Status and Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Semana {submissionQuery.data?.weekNumber || selectedWeek}/{submissionQuery.data?.weekYear || selectedYear}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({weekDates.start} — {weekDates.end})
                  </span>
                </h2>
                {isSubmitted && <Badge className="mt-1">Submetida — Aguarda Revisão</Badge>}
                {isApproved && <Badge className="mt-1 bg-green-600">Aprovada</Badge>}
                {isRejected && (
                  <div className="mt-2 p-4 border-2 border-red-500 bg-red-50 dark:bg-red-950/40 rounded-lg shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shrink-0 animate-pulse">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-red-800 dark:text-red-200">AÇÃO IMEDIATA NECESSÁRIA</h3>
                        <p className="text-xs text-red-600 dark:text-red-400">Esta ficha foi rejeitada pela RAA e requer correção prioritária.</p>
                      </div>
                    </div>
                    {submissionQuery.data?.reviewNotes && (
                      <div className="mt-2 p-3 bg-white dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded">
                        <p className="text-sm text-red-800 dark:text-red-200">
                          <strong>Notas do revisor:</strong> {submissionQuery.data.reviewNotes}
                        </p>
                      </div>
                    )}
                    {reviewFeedbackMap.size > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                        <XCircle className="w-4 h-4 shrink-0" />
                        <span>
                          <strong>{Array.from(reviewFeedbackMap.values()).filter(v => v.verdict === "nok").length}</strong> medida(s) marcada(s) como não conforme — corrija os itens assinalados abaixo e resubmeta.
                        </span>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-red-500 dark:text-red-400 italic">
                      As medidas com problemas estão destacadas a vermelho. Corrija e clique em "Resubmeter".
                    </p>
                  </div>
                )}
                {isUnderReview && <Badge variant="outline" className="mt-1">Em Revisão</Badge>}
              </div>
              {!isReadOnly && (
                <div className="flex gap-2">
                  {canDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("Tem a certeza que pretende eliminar esta ficha? Esta ação é irreversível.")) {
                          deleteMutation.mutate({ id: submissionId! });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                  {canSubmitThis && (
                    <Button onClick={isRejected ? handleResubmit : handleSubmit} disabled={submitting}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      {isRejected ? "Resubmeter" : "Submeter"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Measures by Section */}
            <Accordion type="multiple" className="space-y-2">
          {measuresBySection.map(({ section, measures }) => (
            <AccordionItem key={section.id} value={String(section.id)} className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{section.phase}</Badge>
                  <span className="text-left">{section.name.length > 60 ? section.name.slice(0, 60) + "..." : section.name}</span>
                  <Badge variant="outline" className="ml-auto text-xs">{measures.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {measures.map((measure) => {
                    const response = responses[measure.id];
                    const images = imagesByMeasure.get(measure.id) || [];
                    const reviewFeedback = reviewFeedbackMap.get(measure.id);
                    return (
                      <div key={measure.id} className={`p-4 border rounded-lg space-y-3 ${reviewFeedback?.verdict === "nok" ? "border-red-300 bg-red-50/50 dark:bg-red-950/20" : "bg-card"}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-mono bg-muted px-2 py-1 rounded shrink-0">
                            {measure.number}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-relaxed">{measure.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Responsável: {measure.responsible.replace(/\|/g, " / ").replace("DO", "DO - Start Campus").replace("EE", "EE - Empresa")}
                            </p>
                          </div>
                          {reviewFeedback && (
                            <span className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${reviewFeedback.verdict === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {reviewFeedback.verdict === "ok" ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {reviewFeedback.verdict === "ok" ? "RAA: OK" : "RAA: NC"}
                            </span>
                          )}
                        </div>

                        {/* RAA Review Feedback */}
                        {reviewFeedback && (reviewFeedback.comment || reviewFeedback.verdict === "nok") && (
                          <div className={`ml-8 p-2 border rounded text-xs ${reviewFeedback.verdict === "nok" ? "bg-red-100/80 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300" : "bg-green-100/80 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"}`}>
                            <strong>Comentário RAA:</strong> {reviewFeedback.comment || (reviewFeedback.verdict === "nok" ? "Medida marcada como não conforme — necessita correção." : "Conforme.")}
                          </div>
                        )}

                        {/* Status Radio */}
                        <RadioGroup
                          value={response?.status || ""}
                          onValueChange={(v) => handleStatusChange(measure.id, v as any)}
                          className="flex flex-wrap gap-4"
                          disabled={isReadOnly}
                        >
                          {(["I", "C", "NC", "NA"] as const).map((s) => (
                            <div key={s} className="flex items-center gap-1.5">
                              <RadioGroupItem value={s} id={`${measure.id}-${s}`} />
                              <Label htmlFor={`${measure.id}-${s}`} className="text-xs cursor-pointer">
                                {s === "I" ? "Implementado" : s === "C" ? "Conforme" : s === "NC" ? "Não Conforme" : "N/A"}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>

                        {/* Observations */}
                        <Textarea
                          placeholder="Observações..."
                          value={response?.observations || ""}
                          onChange={(e) => handleObservationChange(measure.id, e.target.value)}
                          className="text-sm min-h-[60px]"
                          disabled={isReadOnly}
                        />

                        {/* Images */}
                        <div className="flex flex-wrap gap-2 items-center">
                          {images.map((img: any) => (
                            <div key={img.id} className="relative group w-16 h-16 rounded border overflow-hidden">
                              <img src={img.url} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {!isReadOnly && (
                            <label className="w-16 h-16 rounded border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                              {uploadingMeasure === measure.id ? (
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                              ) : (
                                <Upload className="w-5 h-5 text-muted-foreground" />
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                multiple
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
                                    <div key={f.id} className="flex items-center gap-1.5 bg-muted/50 border rounded px-2 py-1 text-xs group">
                                      <File className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[150px]" title={f.filename}>
                                        {f.filename}
                                      </a>
                                      {f.fileSize && (
                                        <span className="text-muted-foreground">({Math.round(f.fileSize / 1024)}KB)</span>
                                      )}
                                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                                        <Download className="w-3 h-3" />
                                      </a>
                                      {!isReadOnly && (
                                        <button
                                          onClick={() => deleteFileMutation.mutate({ id: f.id })}
                                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!isReadOnly && (
                                <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                                  {uploadingFileMeasure === measure.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Paperclip className="w-3.5 h-3.5" />
                                  )}
                                  <span>Anexar ficheiro</span>
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.csv"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleFileUpload(measure.id, e.target.files)}
                                  />
                                </label>
                              )}
                            </div>
                          );
                        })()}
                      </div>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5" />
                  Rascunhos e Rejeitadas
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Fichas em rascunho ou rejeitadas que necessitam de atenção.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {mySubmissionsQuery.isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">A carregar...</span>
                  </div>
                )}
                {mySubmissionsQuery.isError && (
                  <div className="p-4 rounded-lg border border-red-200 bg-red-50/50 text-sm text-red-600">
                    Erro ao carregar rascunhos. Tente novamente.
                  </div>
                )}
                {!mySubmissionsQuery.isLoading && !mySubmissionsQuery.isError && draftsAndRejected.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Sem rascunhos ou fichas rejeitadas neste projeto.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Quando criar uma nova ficha ou receber uma rejeição, ela aparecerá aqui.
                    </p>
                  </div>
                )}
                {draftsAndRejected.map((sub: any) => (
                  <div
                    key={sub.id}
                    className={`p-4 rounded-lg border transition-all hover:shadow-md ${
                      sub.status === "rejected"
                        ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">
                          Semana {sub.weekNumber} / {sub.weekYear}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {sub.weekStartDate} — {sub.weekEndDate}
                        </p>
                      </div>
                      <Badge
                        variant={sub.status === "rejected" ? "destructive" : "outline"}
                        className="text-xs shrink-0"
                      >
                        {sub.status === "rejected" ? "Rejeitada" : "Rascunho"}
                      </Badge>
                    </div>
                    {sub.status === "rejected" && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Ação imediata necessária</span>
                      </div>
                    )}
                    <Button
                      variant={sub.status === "rejected" ? "destructive" : "default"}
                      size="sm"
                      className="w-full mt-3 gap-2"
                      onClick={() => {
                        setLocation(`/ficha/${sub.id}`);
                      }}
                    >
                      <ArrowRight className="w-4 h-4" />
                      Continuar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Matriz */}
          <TabsContent value="matriz" className="mt-4">
            <MatrizEmbedded />
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="historico" className="mt-4">
            <HistoricoEmbedded />
          </TabsContent>

          {/* Tab: Revisão */}
          <TabsContent value="revisao" className="mt-4">
            <ReviewPageFull embedded />
          </TabsContent>

        </Tabs>
      </div>
    </AppLayout>
  );
}





function MatrizEmbedded() {
  return <MatrizFull embedded />;
}

function HistoricoEmbedded() {
  return <SubmissionHistoryFull embedded />;
}
