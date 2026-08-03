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

function getWeekInfo() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);

  // Get Monday and Sunday of current week
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;

  return {
    weekNumber,
    weekYear: new Date().getFullYear(),
    weekStartDate: fmt(monday),
    weekEndDate: fmt(sunday),
  };
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

  const weekInfo = useMemo(() => getWeekInfo(), []);

  const sectionsQuery = trpc.sections.list.useQuery();
  const measuresQuery = trpc.measures.list.useQuery();
  const utils = trpc.useUtils();

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
    if (!params.id && user?.companyId) {
      createOrGetMutation.mutate(weekInfo);
    }
  }, [user?.companyId]);

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
    const map = new Map<number, typeof measuresQuery.data>();
    for (const m of measuresQuery.data) {
      if (!map.has(m.sectionId)) map.set(m.sectionId, []);
      map.get(m.sectionId)!.push(m);
    }
    return sectionsQuery.data.map((s) => ({
      section: s,
      measures: map.get(s.id) || [],
    }));
  }, [measuresQuery.data, sectionsQuery.data]);

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Ficha Semanal
              {submissionQuery.data && (
                <span className="text-muted-foreground font-normal text-lg ml-2">
                  — Semana {submissionQuery.data.weekNumber}/{submissionQuery.data.weekYear}
                </span>
              )}
            </h1>
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
      </div>
    </AppLayout>
  );
}
