import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { Save, Send, Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [responses, setResponses] = useState<ResponseMap>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMeasure, setUploadingMeasure] = useState<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [started, setStarted] = useState(!!params.id);
  const weekOpts = useMemo(() => getWeekOptions(), []);
  const [selectedWeek, setSelectedWeek] = useState(weekOpts.currentWeek);
  const [selectedYear, setSelectedYear] = useState(weekOpts.year);

  const weekDates = useMemo(() => getWeekDates(selectedWeek, selectedYear), [selectedWeek, selectedYear]);

  const weekInfo = useMemo(() => ({
    weekNumber: selectedWeek,
    weekYear: selectedYear,
    weekStartDate: weekDates.start,
    weekEndDate: weekDates.end,
  }), [selectedWeek, selectedYear, weekDates]);

  const sectionsQuery = trpc.sections.list.useQuery();
  const measuresQuery = trpc.measures.list.useQuery();
  const utils = trpc.useUtils();

  // Fetch company info to filter measures by type
  const companyQuery = trpc.companies.getById.useQuery(
    { id: user?.companyId! },
    { enabled: !!user?.companyId }
  );
  const companyType = companyQuery.data?.companyType?.toUpperCase(); // "EE" or "RAP"
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

  const submissionQuery = trpc.submissions.getById.useQuery(
    { id: submissionId! },
    { enabled: !!submissionId }
  );

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

  // Group measures by section
  const measuresBySection = useMemo(() => {
    if (!measuresQuery.data || !sectionsQuery.data) return [];
    // Filter measures: only show those relevant to this company type
    const relevantMeasures = companyType
      ? measuresQuery.data.filter((m) => m.responsible.toUpperCase().includes(companyType))
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
  }, [measuresQuery.data, sectionsQuery.data, companyType]);

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

  if (!user?.companyId && user?.role !== "admin") {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              A sua conta ainda não está associada a nenhuma empresa. Contacte o administrador.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Ficha Header with Logo and Company */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <img src="/manus-storage/start_campus_logo_eb179749.png" alt="Start Campus" className="h-12 object-contain" />
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
                      <SelectItem value={String(weekOpts.year - 1)}>{weekOpts.year - 1}</SelectItem>
                      <SelectItem value={String(weekOpts.year)}>{weekOpts.year}</SelectItem>
                      <SelectItem value={String(weekOpts.year + 1)}>{weekOpts.year + 1}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  Período: <strong>{weekDates.start}</strong> a <strong>{weekDates.end}</strong>
                </p>
              </div>
              <Button onClick={() => setStarted(true)} size="lg" className="w-full">
                Iniciar Ficha — Semana {selectedWeek}/{selectedYear}
              </Button>
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
                  <div className="space-y-1">
                    <Badge variant="destructive" className="mt-1">Rejeitada — Edite e resubmeta</Badge>
                    {submissionQuery.data?.reviewNotes && (
                      <p className="text-xs text-muted-foreground bg-red-50 dark:bg-red-950/30 p-2 rounded">
                        <strong>Notas do revisor:</strong> {submissionQuery.data.reviewNotes}
                      </p>
                    )}
                  </div>
                )}
                {isUnderReview && <Badge variant="outline" className="mt-1">Em Revisão</Badge>}
              </div>
              {!isReadOnly && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                  <Button onClick={isRejected ? handleResubmit : handleSubmit} disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    {isRejected ? "Resubmeter" : "Submeter"}
                  </Button>
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
                    return (
                      <div key={measure.id} className="p-4 border rounded-lg bg-card space-y-3">
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
                        </div>

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
      </div>
    </AppLayout>
  );
}
