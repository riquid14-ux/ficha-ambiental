import { useEffect, useRef, useState } from "react";
import { Camera, CalendarDays, ChevronRight, FileImage, Layers3, LockKeyhole, MapPinned, Plus, ShieldCheck, Upload } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { ProjectMapCanvas } from "@/components/ProjectMapCanvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function ProjectMap() {
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
  const projectId = activeProject?.id ?? 0;
  const canWrite = ["admin", "dono_obra", "pm", "raa", "ee"].includes(user?.role ?? "");
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [showSurveyDialog, setShowSurveyDialog] = useState(false);
  const [showBaseMapDialog, setShowBaseMapDialog] = useState(false);
  const [surveyName, setSurveyName] = useState("");
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [baseMapFile, setBaseMapFile] = useState<File | null>(null);
  const [baseMapForm, setBaseMapForm] = useState({ west: "", south: "", east: "", north: "", sourceName: "", sourceUrl: "", attribution: "", license: "" });

  const listQuery = trpc.projectMap.list.useQuery({ projectId }, { enabled: projectId > 0 && !isAllProjects });
  const surveyQuery = trpc.projectMap.survey.useQuery({ id: selectedSurveyId ?? 0 }, { enabled: !!selectedSurveyId });

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
  const uploadBaseMapMutation = trpc.projectMap.uploadBaseMap.useMutation({
    onSuccess: async () => {
      await Promise.all([listQuery.refetch(), surveyQuery.refetch()]);
      setShowBaseMapDialog(false);
      setBaseMapFile(null);
      toast.success("Mapa base privado actualizado");
    },
    onError: error => toast.error(error.message),
  });

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files || !selectedSurveyId || !projectId) return;
    const accepted = Array.from(files).filter(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (!accepted.length) return toast.error("Seleccione fotografias JPEG, PNG ou WebP.");
    setUploading(true);
    let withoutGps = 0;
    try {
      for (const file of accepted) {
        const result = await uploadPhotoMutation.mutateAsync({ surveyId: selectedSurveyId, projectId, filename: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64: await fileToBase64(file) });
        if (!result.geolocated) withoutGps += 1;
      }
      await Promise.all([surveyQuery.refetch(), listQuery.refetch()]);
      toast.success(`${accepted.length} fotografia(s) adicionada(s)`);
      if (withoutGps) toast.warning(`${withoutGps} fotografia(s) não têm GPS e ficam fora da composição até serem georreferenciadas.`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar fotografias");
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleBaseMapUpload = async () => {
    if (!baseMapFile || !projectId) return toast.error("Seleccione o ficheiro do mapa base.");
    const west = Number(baseMapForm.west), south = Number(baseMapForm.south), east = Number(baseMapForm.east), north = Number(baseMapForm.north);
    if (![west, south, east, north].every(Number.isFinite)) return toast.error("Preencha os quatro limites WGS84.");
    if (!baseMapForm.sourceName.trim() || !baseMapForm.attribution.trim() || !baseMapForm.license.trim()) return toast.error("Fonte, atribuição e licença são obrigatórias.");
    uploadBaseMapMutation.mutate({
      projectId,
      filename: baseMapFile.name,
      mimeType: baseMapFile.type as "image/jpeg" | "image/png" | "image/webp",
      base64: await fileToBase64(baseMapFile),
      bounds: { west, south, east, north },
      sourceName: baseMapForm.sourceName.trim(),
      sourceUrl: baseMapForm.sourceUrl.trim() || undefined,
      attribution: baseMapForm.attribution.trim(),
      license: baseMapForm.license.trim(),
    });
  };

  if (isAllProjects || !activeProject) return <AppLayout><div className="p-8 text-center text-muted-foreground">Seleccione um projecto individual para abrir o Mapa.</div></AppLayout>;

  const surveys = listQuery.data?.surveys ?? [];
  const selectedData = surveyQuery.data;
  const photos = selectedData?.photos ?? [];
  const locatedPhotos = photos.filter(photo => Number.isFinite(Number(photo.latitude)) && Number.isFinite(Number(photo.longitude)));

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><MapPinned className="size-6 text-emerald-700" /><h1 className="text-2xl font-bold">Mapa</h1><Badge variant="outline">{activeProject.code}</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">Levantamentos privados, camadas fotográficas e ortomosaicos do projecto</p>
          </div>
          {canWrite && <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowBaseMapDialog(true)}><Layers3 className="mr-2 size-4" />Mapa base</Button>
            <Button onClick={() => setShowSurveyDialog(true)}><Plus className="mr-2 size-4" />Novo levantamento</Button>
          </div>}
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-xs text-emerald-900">
            <span className="flex items-center gap-1.5 font-medium"><LockKeyhole className="size-4" />Sem envio de coordenadas para mapas públicos</span>
            <span>Buffer automático de 200 m</span><span>Imagens oblíquas ficam como referência GPS</span><span>“Ortomosaico” apenas quando existe produto fotogramétrico real</span>
          </CardContent>
        </Card>

        <div className="grid min-h-[680px] gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Levantamentos</p><p className="text-[11px] text-muted-foreground">{surveys.length} no projecto</p></div><Camera className="size-5 text-emerald-700" /></div>
            <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
              {surveys.map(survey => (
                <button key={survey.id} type="button" onClick={() => setSelectedSurveyId(survey.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedSurveyId === survey.id ? "border-emerald-400 bg-emerald-50" : "hover:bg-muted/50"}`}>
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{survey.name}</p><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></div>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarDays className="size-3" />{survey.capturedAt ? new Date(survey.capturedAt).toLocaleDateString("pt-PT") : "Sem data"}</p>
                  <div className="mt-2 flex gap-1.5"><Badge variant="secondary">{survey.photoCount} fotos</Badge><Badge variant="outline">{survey.resultType === "orthomosaic" ? "Ortomosaico" : "Camadas"}</Badge></div>
                </button>
              ))}
              {!listQuery.isLoading && surveys.length === 0 && <div className="rounded-xl border border-dashed p-5 text-center"><FileImage className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 text-xs font-medium">Sem levantamentos</p><p className="mt-1 text-[11px] text-muted-foreground">Crie um levantamento antes de carregar fotografias.</p></div>}
            </div>
            {selectedSurveyId && canWrite && <>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={event => handlePhotoFiles(event.target.files)} />
              <Button className="w-full" variant="outline" disabled={uploading} onClick={() => photoInputRef.current?.click()}><Upload className="mr-2 size-4" />{uploading ? "A carregar..." : "Adicionar fotografias"}</Button>
            </>}
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
          <ProjectMapCanvas photos={photos} setting={selectedData?.setting ?? listQuery.data?.setting} survey={selectedData?.survey} />
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
          <DialogHeader><DialogTitle>Mapa base privado do projecto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Carregue um raster autorizado e indique os limites WGS84. A imagem fica em storage privado; a fonte, atribuição e licença ficam auditadas.</p>
            <div className="space-y-2"><Label>Imagem raster</Label><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setBaseMapFile(event.target.files?.[0] ?? null)} /></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(["west", "south", "east", "north"] as const).map(key => <div key={key} className="space-y-1"><Label className="capitalize">{key}</Label><Input type="number" step="0.000001" value={baseMapForm[key]} onChange={event => setBaseMapForm(current => ({ ...current, [key]: event.target.value }))} /></div>)}</div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Fonte</Label><Input value={baseMapForm.sourceName} onChange={event => setBaseMapForm(current => ({ ...current, sourceName: event.target.value }))} /></div><div className="space-y-1"><Label>URL da fonte</Label><Input value={baseMapForm.sourceUrl} onChange={event => setBaseMapForm(current => ({ ...current, sourceUrl: event.target.value }))} /></div><div className="space-y-1"><Label>Atribuição</Label><Input value={baseMapForm.attribution} onChange={event => setBaseMapForm(current => ({ ...current, attribution: event.target.value }))} /></div><div className="space-y-1"><Label>Licença</Label><Input value={baseMapForm.license} onChange={event => setBaseMapForm(current => ({ ...current, license: event.target.value }))} /></div></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowBaseMapDialog(false)}>Cancelar</Button><Button disabled={uploadBaseMapMutation.isPending} onClick={handleBaseMapUpload}><ShieldCheck className="mr-2 size-4" />{uploadBaseMapMutation.isPending ? "A guardar..." : "Guardar mapa base"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
