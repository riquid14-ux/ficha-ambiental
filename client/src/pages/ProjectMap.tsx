import { useEffect, useRef, useState } from "react";
import { Camera, CalendarDays, CheckCircle2, ChevronRight, Clock3, Cpu, ExternalLink, FileCheck2, FileImage, GitCompareArrows, Layers3, LockKeyhole, MapPinned, Plus, ShieldCheck, TriangleAlert, Upload, XCircle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { ProjectMapCanvas } from "@/components/ProjectMapCanvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readPhotoMetadata(metadataJson?: string | null) {
  try {
    return metadataJson ? JSON.parse(metadataJson) as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readValidation(validationJson?: string | null) {
  try {
    return validationJson ? JSON.parse(validationJson) as { accepted?: boolean; issues?: Array<{ code: string; level: "error" | "warning"; message: string }> } : null;
  } catch {
    return null;
  }
}

const JOB_LABELS: Record<string, string> = {
  validating: "A validar",
  ready: "Pronto para processar",
  queued: "Em fila",
  processing: "A processar",
  completed: "Concluído",
  rejected: "Rejeitado",
  failed: "Falhou",
  cancelled: "Cancelado",
};

export default function ProjectMap() {
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
  const projectId = activeProject?.id ?? 0;
  const canView = ["admin", "dono_obra", "pm"].includes(user?.role ?? "");
  const canWrite = user?.role === "admin";
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [showSurveyDialog, setShowSurveyDialog] = useState(false);
  const [showBaseMapDialog, setShowBaseMapDialog] = useState(false);
  const [surveyName, setSurveyName] = useState("");
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [compareWithPrevious, setCompareWithPrevious] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [baseMapForm, setBaseMapForm] = useState({ west: "", south: "", east: "", north: "" });

  const listQuery = trpc.projectMap.list.useQuery({ projectId }, { enabled: canView && projectId > 0 && !isAllProjects });
  const surveyQuery = trpc.projectMap.survey.useQuery({ id: selectedSurveyId ?? 0 }, { enabled: canView && !!selectedSurveyId });

  useEffect(() => {
    if (listQuery.data?.surveys.length && !listQuery.data.surveys.some(item => item.id === selectedSurveyId)) {
      setSelectedSurveyId(listQuery.data.surveys[0].id);
    }
    if (!listQuery.data?.surveys.length) setSelectedSurveyId(null);
  }, [listQuery.data?.surveys, selectedSurveyId]);

  const createSurveyMutation = trpc.projectMap.createSurvey.useMutation({
    onSuccess: async result => {
      await listQuery.refetch();
      setSelectedSurveyId(result.id);
      setShowSurveyDialog(false);
      setSurveyName("");
      toast.success("Levantamento criado");
    },
    onError: error => toast.error(error.message),
  });
  const uploadPhotoMutation = trpc.projectMap.uploadPhoto.useMutation();
  const validateSurveyMutation = trpc.projectMap.validateSurvey.useMutation({
    onSuccess: async result => {
      await Promise.all([surveyQuery.refetch(), listQuery.refetch()]);
      if (result.validation.accepted) toast.success("Lote DJI validado e pronto para o worker privado");
      else toast.error("O lote foi rejeitado. Corrija os erros indicados antes de processar.");
    },
    onError: error => toast.error(error.message),
  });
  const startProcessingMutation = trpc.projectMap.startProcessing.useMutation({
    onSuccess: async result => {
      await Promise.all([surveyQuery.refetch(), listQuery.refetch()]);
      if (!result.started) toast.info(result.worker.message);
    },
    onError: error => toast.error(error.message),
  });
  const cancelProcessingMutation = trpc.projectMap.cancelProcessing.useMutation({
    onSuccess: async () => {
      await Promise.all([surveyQuery.refetch(), listQuery.refetch()]);
      toast.success("Processamento cancelado sem afectar a aplicação");
    },
    onError: error => toast.error(error.message),
  });
  const updateBaseMapBoundsMutation = trpc.projectMap.updateBaseMapBounds.useMutation({
    onSuccess: async () => {
      await Promise.all([listQuery.refetch(), surveyQuery.refetch()]);
      setShowBaseMapDialog(false);
      toast.success("Limites do mapa base actualizados");
    },
    onError: error => toast.error(error.message),
  });

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files || !selectedSurveyId || !projectId) return;
    const accepted = Array.from(files).filter(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (!accepted.length) return toast.error("Seleccione fotografias JPEG, PNG ou WebP.");
    setUploading(true);
    setUploadProgress({ completed: 0, total: accepted.length });
    let withoutGps = 0;
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        const result = await uploadPhotoMutation.mutateAsync({ surveyId: selectedSurveyId, projectId, filename: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64: await fileToBase64(file) });
        if (!result.geolocated) withoutGps += 1;
        setUploadProgress({ completed: index + 1, total: accepted.length });
        await new Promise(resolve => window.setTimeout(resolve, 0));
      }
      await Promise.all([surveyQuery.refetch(), listQuery.refetch()]);
      toast.success(`${accepted.length} fotografia(s) adicionada(s)`);
      if (withoutGps) toast.warning(`${withoutGps} fotografia(s) não têm GPS e ficam fora da composição até serem georreferenciadas.`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar fotografias");
    } finally {
      setUploading(false);
      setUploadProgress({ completed: 0, total: 0 });
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const openBaseMapDialog = () => {
    const setting = listQuery.data?.setting;
    try {
      const bounds = setting?.boundsJson ? JSON.parse(setting.boundsJson) : {};
      setBaseMapForm({ west: String(bounds.west ?? ""), south: String(bounds.south ?? ""), east: String(bounds.east ?? ""), north: String(bounds.north ?? "") });
    } catch {
      setBaseMapForm({ west: "", south: "", east: "", north: "" });
    }
    setShowBaseMapDialog(true);
  };

  const handleBaseMapBounds = () => {
    if (!projectId) return;
    const west = Number(baseMapForm.west), south = Number(baseMapForm.south), east = Number(baseMapForm.east), north = Number(baseMapForm.north);
    if (![west, south, east, north].every(Number.isFinite)) return toast.error("Preencha os quatro limites WGS84.");
    updateBaseMapBoundsMutation.mutate({
      projectId,
      bounds: { west, south, east, north },
    });
  };

  if (!canView) return <AppLayout><div className="p-8 text-center text-muted-foreground">O Mapa está disponível apenas para Administrador, Dono de Obra e Gestor de Projecto.</div></AppLayout>;
  if (isAllProjects || !activeProject) return <AppLayout><div className="p-8 text-center text-muted-foreground">Seleccione um projecto individual para abrir o Mapa.</div></AppLayout>;

  const surveys = listQuery.data?.surveys ?? [];
  const chronologicalSurveys = [...surveys].sort((a, b) => Number(a.capturedAt ?? 0) - Number(b.capturedAt ?? 0));
  const selectedTimelineIndex = chronologicalSurveys.findIndex(item => item.id === selectedSurveyId);
  const previousSurveyId = selectedTimelineIndex > 0 ? chronologicalSurveys[selectedTimelineIndex - 1]?.id : null;
  const comparisonQuery = trpc.projectMap.survey.useQuery({ id: previousSurveyId ?? 0 }, { enabled: canView && compareWithPrevious && !!previousSurveyId });
  const selectedData = surveyQuery.data;
  const photos = selectedData?.photos ?? [];
  const locatedPhotos = photos.filter(photo => Number.isFinite(Number(photo.latitude)) && Number.isFinite(Number(photo.longitude)));
  const job = selectedData?.job;
  const validation = readValidation(job?.validationJson);
  const worker = selectedData?.worker ?? listQuery.data?.worker;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><MapPinned className="size-6 text-emerald-700" /><h1 className="text-2xl font-bold">Mapa</h1><Badge variant="outline">{activeProject.code}</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">Levantamentos privados, camadas fotográficas e ortomosaicos do projecto</p>
          </div>
          {canWrite && <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openBaseMapDialog}><Layers3 className="mr-2 size-4" />Ajustar limites</Button>
            <Button onClick={() => setShowSurveyDialog(true)}><Plus className="mr-2 size-4" />Novo levantamento</Button>
          </div>}
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-xs text-emerald-900">
            <span className="flex items-center gap-1.5 font-medium"><LockKeyhole className="size-4" />Sem envio de coordenadas para mapas públicos</span>
            <span>Buffer automático de 200 m</span><span>Imagens oblíquas ficam como referência GPS</span><span>“Ortomosaico” apenas quando existe produto fotogramétrico real</span>
          </CardContent>
        </Card>

        {surveys.length > 0 && <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Clock3 className="size-4 text-emerald-700" /><div><p className="text-sm font-semibold">Evolução da obra</p><p className="text-[11px] text-muted-foreground">Seleccione uma data para manter o mesmo enquadramento e comparar os levantamentos.</p></div></div><div className="flex items-center gap-2">{previousSurveyId && <Button size="sm" variant={compareWithPrevious ? "default" : "outline"} onClick={() => setCompareWithPrevious(value => !value)}><GitCompareArrows className="mr-1.5 size-3.5" />{compareWithPrevious ? "Comparação activa" : "Comparar com anterior"}</Button>}<Badge variant="outline">{surveys.length} datas</Badge></div></div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {chronologicalSurveys.map(survey => <button key={survey.id} type="button" onClick={() => { setSelectedSurveyId(survey.id); setCompareWithPrevious(false); }} className={`min-w-36 rounded-xl border px-3 py-2 text-left transition-colors ${selectedSurveyId === survey.id ? "border-emerald-500 bg-emerald-50" : "bg-background hover:bg-muted/50"}`}><p className="text-xs font-medium">{survey.capturedAt ? new Date(survey.capturedAt).toLocaleDateString("pt-PT") : "Sem data"}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{survey.name}</p><p className="mt-1 text-[10px] font-medium text-emerald-800">{survey.job ? JOB_LABELS[survey.job.status] : "Fotografias individuais"}</p></button>)}
            </div>
          </CardContent>
        </Card>}

        <div className="grid min-h-[680px] gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Levantamentos</p><p className="text-[11px] text-muted-foreground">{surveys.length} no projecto</p></div><Camera className="size-5 text-emerald-700" /></div>
            <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
              {surveys.map(survey => (
                <button key={survey.id} type="button" onClick={() => setSelectedSurveyId(survey.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedSurveyId === survey.id ? "border-emerald-400 bg-emerald-50" : "hover:bg-muted/50"}`}>
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{survey.name}</p><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></div>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarDays className="size-3" />{survey.capturedAt ? new Date(survey.capturedAt).toLocaleDateString("pt-PT") : "Sem data"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="secondary">{survey.photoCount} fotos</Badge><Badge variant="outline">{survey.resultType === "orthomosaic" ? "Ortomosaico" : "Camadas"}</Badge>{survey.job && <Badge variant={survey.job.status === "completed" ? "default" : survey.job.status === "rejected" || survey.job.status === "failed" ? "destructive" : "outline"}>{JOB_LABELS[survey.job.status] ?? survey.job.status}</Badge>}</div>
                </button>
              ))}
              {!listQuery.isLoading && surveys.length === 0 && <div className="rounded-xl border border-dashed p-5 text-center"><FileImage className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 text-xs font-medium">Sem levantamentos</p><p className="mt-1 text-[11px] text-muted-foreground">Crie um levantamento antes de carregar fotografias.</p></div>}
            </div>
            {selectedSurveyId && canWrite && <>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={event => handlePhotoFiles(event.target.files)} />
              <Button className="w-full" variant="outline" disabled={uploading} onClick={() => photoInputRef.current?.click()}><Upload className="mr-2 size-4" />{uploading ? `A carregar ${uploadProgress.completed}/${uploadProgress.total}` : "Adicionar fotografias"}</Button>
              {uploading && <Progress value={uploadProgress.total ? (uploadProgress.completed / uploadProgress.total) * 100 : 0} className="h-2" />}
            </>}
            {selectedSurveyId && canWrite && photos.length > 0 && <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="flex items-center gap-2"><Cpu className="size-4 text-emerald-700" /><p className="text-xs font-semibold">Fotogrametria DJI</p></div>
              <Button className="w-full" size="sm" disabled={validateSurveyMutation.isPending} onClick={() => validateSurveyMutation.mutate({ surveyId: selectedSurveyId })}>{validateSurveyMutation.isPending ? "A validar..." : "Validar lote DJI"}</Button>
              {job && <>
                <div className="flex items-center justify-between text-[11px]"><span>Estado</span><Badge variant={job.status === "completed" ? "default" : job.status === "rejected" || job.status === "failed" ? "destructive" : "outline"}>{JOB_LABELS[job.status] ?? job.status}</Badge></div>
                {(job.status === "queued" || job.status === "processing") && <Progress value={job.progress} className="h-2" />}
                <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground"><span>{job.geolocatedCount}/{job.imageCount} com GPS</span><span>{job.nadirCount} nadir · {job.obliqueCount} oblíquas</span></div>
                {job.status === "ready" && <Button className="w-full" size="sm" onClick={() => startProcessingMutation.mutate({ surveyId: selectedSurveyId })} disabled={startProcessingMutation.isPending}>{startProcessingMutation.isPending ? "A verificar worker..." : "Processar ortomosaico"}</Button>}
                {["ready", "queued", "processing"].includes(job.status) && <Button className="w-full" size="sm" variant="ghost" onClick={() => cancelProcessingMutation.mutate({ surveyId: selectedSurveyId })} disabled={cancelProcessingMutation.isPending}>Cancelar trabalho</Button>}
                {job.status === "completed" && <div className="space-y-1.5 rounded-lg border bg-background p-2 text-[10px]">
                  <p className="flex items-center gap-1 font-semibold"><FileCheck2 className="size-3.5 text-emerald-700" />Outputs privados</p>
                  {job.orthophotoUrl && <a className="flex items-center justify-between text-emerald-800 hover:underline" href={job.orthophotoUrl} target="_blank" rel="noreferrer"><span>Ortofoto</span><ExternalLink className="size-3" /></a>}
                  {job.dsmUrl && <a className="flex items-center justify-between text-emerald-800 hover:underline" href={job.dsmUrl} target="_blank" rel="noreferrer"><span>Modelo de superfície</span><ExternalLink className="size-3" /></a>}
                  {job.reportUrl && <a className="flex items-center justify-between text-emerald-800 hover:underline" href={job.reportUrl} target="_blank" rel="noreferrer"><span>Relatório de qualidade</span><ExternalLink className="size-3" /></a>}
                  <p className="text-muted-foreground">Os tiles só são pedidos quando a camada for activada.</p>
                </div>}
              </>}
              <div className={`rounded-lg p-2 text-[10px] ${worker?.configured && worker?.healthy ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}`}>
                <div className="flex items-start gap-1.5">{worker?.configured && worker?.healthy ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />}<span>{worker?.message ?? "A verificar o worker privado..."}</span></div>
              </div>
            </div>}
            {validation?.issues?.length ? <div className="space-y-1.5 rounded-xl border p-3">
              <p className="text-xs font-semibold">Qualidade do lote</p>
              {validation.issues.map(issue => <div key={issue.code} className={`flex items-start gap-1.5 text-[10px] ${issue.level === "error" ? "text-red-700" : "text-amber-800"}`}>{issue.level === "error" ? <XCircle className="mt-0.5 size-3 shrink-0" /> : <TriangleAlert className="mt-0.5 size-3 shrink-0" />}<span>{issue.message}</span></div>)}
            </div> : null}
            {selectedSurveyId && <div className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground"><p className="font-medium text-foreground">Qualidade do levantamento</p><p className="mt-1">{locatedPhotos.length}/{photos.length} fotografias posicionadas. Fotografias sem GPS não são forçadas para o mapa.</p></div>}
            {photos.length > 0 && <div className="space-y-2">
              <p className="text-xs font-semibold">Fotografias do levantamento</p>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {photos.map(photo => {
                  const metadata = readPhotoMetadata(photo.metadataJson);
                  const yaw = metadata.gimbalYawDegree;
                  const hasGps = Number.isFinite(Number(photo.latitude)) && Number.isFinite(Number(photo.longitude));
                  return <div key={photo.id} className="rounded-xl border bg-background p-2.5 text-[11px]">
                    <div className="flex items-start justify-between gap-2"><p className="truncate font-medium" title={photo.filename}>{photo.filename}</p><Badge variant={hasGps ? "secondary" : "outline"}>{hasGps ? "GPS" : "Sem GPS"}</Badge></div>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-muted-foreground"><span>Altitude</span><strong className="text-right text-foreground">{photo.relativeAltitudeM != null ? `${Number(photo.relativeAltitudeM).toFixed(1)} m` : "—"}</strong><span>Yaw</span><strong className="text-right text-foreground">{Number.isFinite(Number(yaw)) ? `${Number(yaw).toFixed(0)}°` : "—"}</strong></div>
                  </div>;
                })}
              </div>
            </div>}
          </aside>
          <ProjectMapCanvas photos={photos} setting={selectedData?.setting ?? listQuery.data?.setting} survey={selectedData?.survey} comparisonSurvey={compareWithPrevious ? comparisonQuery.data?.survey : null} />
        </div>
      </div>

      <Dialog open={showSurveyDialog} onOpenChange={setShowSurveyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo levantamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={surveyName} onChange={event => setSurveyName(event.target.value)} placeholder="Ex.: Voo semanal — zona norte" /></div>
            <div className="space-y-2"><Label>Data de captura</Label><Input type="date" value={surveyDate} onChange={event => setSurveyDate(event.target.value)} /></div>
            <Button className="w-full" disabled={!surveyName.trim() || createSurveyMutation.isPending} onClick={() => createSurveyMutation.mutate({ projectId, name: surveyName.trim(), capturedAt: surveyDate ? new Date(`${surveyDate}T12:00:00`).getTime() : undefined })}>{createSurveyMutation.isPending ? "A criar..." : "Criar levantamento"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBaseMapDialog} onOpenChange={setShowBaseMapDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Ajustar limites do mapa base</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">A plataforma fornece o mapa base oficial. Ajuste apenas os limites WGS84 para alinhar o enquadramento do projecto.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(["west", "south", "east", "north"] as const).map(key => <div key={key} className="space-y-1"><Label className="capitalize">{key}</Label><Input type="number" step="0.000001" value={baseMapForm[key]} onChange={event => setBaseMapForm(current => ({ ...current, [key]: event.target.value }))} /></div>)}</div>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs"><p className="font-medium">{listQuery.data?.setting?.sourceName}</p><p className="mt-1 text-muted-foreground">{listQuery.data?.setting?.attribution} · {listQuery.data?.setting?.license}</p></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowBaseMapDialog(false)}>Cancelar</Button><Button disabled={updateBaseMapBoundsMutation.isPending} onClick={handleBaseMapBounds}><ShieldCheck className="mr-2 size-4" />{updateBaseMapBoundsMutation.isPending ? "A guardar..." : "Guardar limites"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
