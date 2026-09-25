import { useState, useMemo, useRef, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, FileText, CheckCircle2, AlertCircle, Clock, MessageSquare, Image, Paperclip, Send, Trash2, Download, ChevronDown, ChevronRight, ChevronLeft, X, ZoomIn, ZoomOut, RotateCcw, Images } from "lucide-react";
import MeasureTrackingPanel from "@/components/MeasureTrackingPanel";
import { groupsWithMeasures } from "@/lib/phase-measure-presentation";

// Projects that are operation-only (no construction phase)
const OPERATION_ONLY_PROJECT_CODES = ["SIN01"];
const SIN01_EVIDENCE_START_YEAR = 2026;

// All project lifecycle phases (excluding construction which has its own weekly form)
const ALL_PHASES = [
  { key: "Prévias Licenciamento", label: "Previamente ao Licenciamento", shortLabel: "Pré-Licenciamento", order: 1, color: "bg-purple-500" },
  { key: "Em Sede de Licenciamento", label: "Em Sede de Licenciamento", shortLabel: "Licenciamento", order: 2, color: "bg-blue-500" },
  { key: "Pré-Construção", label: "Previamente ao Início da Construção", shortLabel: "Pré-Construção", order: 3, color: "bg-cyan-500" },
  { key: "Preparação Prévia", label: "Preparação Prévia à Construção", shortLabel: "Preparação Prévia", order: 4, color: "bg-teal-500" },
  { key: "Execução da Obra", label: "Execução da Obra", shortLabel: "Execução", order: 5, color: "bg-amber-500" },
  { key: "Fase Final", label: "Fase Final", shortLabel: "Fase Final", order: 6, color: "bg-rose-500" },
  { key: "Fase Final Construção", label: "Fase Final da Construção", shortLabel: "Final Construção", order: 7, color: "bg-orange-500" },
  { key: "Exploração", label: "Fase de Exploração", shortLabel: "Exploração", order: 8, color: "bg-green-500" },
  { key: "Desativação (Pós-Exploração)", label: "Fase de Desativação", shortLabel: "Desativação", order: 9, color: "bg-muted0" },
];

export default function PhaseMeasures(props: any) {
  const embedded = props?.embedded ?? false;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeProject } = useProject();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "raa";

  const projectId = activeProject?.id || 1;
  const sectionsQuery = trpc.sections.list.useQuery({ projectId }, { enabled: !!activeProject?.id });
  const measuresQuery = trpc.measures.list.useQuery({ projectId }, { enabled: !!activeProject?.id });
  const projectPhasesQuery = trpc.projectPhases.list.useQuery({ projectId });
  const hiddenPhaseKeys = new Set((projectPhasesQuery.data || []).filter((pp: any) => pp.hidden).map((pp: any) => pp.phaseKey || pp.phaseName));

  const statusesQuery = trpc.phaseMeasures.getStatuses.useQuery({ projectId });
  const evidenceQuery = trpc.phaseEvidence.list.useQuery({ projectId });

  const addCommentMutation = trpc.phaseEvidence.addComment.useMutation({
    onSuccess: () => { evidenceQuery.refetch(); toast.success(t("Comentário adicionado")); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadFileMutation = trpc.phaseEvidence.uploadFile.useMutation({
    onSuccess: () => { evidenceQuery.refetch(); toast.success("Ficheiro carregado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteEvidenceMutation = trpc.phaseEvidence.delete.useMutation({
    onSuccess: () => { evidenceQuery.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePhotoCategoryMutation = trpc.phaseEvidence.updateCategory.useMutation({
    onSuccess: () => { evidenceQuery.refetch(); toast.success(t("Categoria da fotografia atualizada")); },
    onError: (e: any) => toast.error(e.message),
  });

  const addMeasureMutation = trpc.measures.create.useMutation({
    onSuccess: () => { measuresQuery.refetch(); toast.success("Medida adicionada"); setShowAdd(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  // Filter phases based on project type
  const isOperationOnly = activeProject && OPERATION_ONLY_PROJECT_CODES.includes(activeProject.code);
  const visiblePhases = (isOperationOnly
    ? ALL_PHASES.filter(p => p.key === "Exploração" || p.key === "Desativação (Pós-Exploração)")
    : ALL_PHASES).filter(p => !hiddenPhaseKeys.has(p.key) && !hiddenPhaseKeys.has(p.label));

  const [evidenceYear, setEvidenceYear] = useState(() => Math.max(SIN01_EVIDENCE_START_YEAR, new Date().getFullYear()));
  const [activePhase, setActivePhase] = useState(visiblePhases[0]?.key || ALL_PHASES[0].key);
  const [newMeasure, setNewMeasure] = useState({ number: "", description: "", sectionId: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [editingMeasure, setEditingMeasure] = useState<{ id: number; number: string; description: string; responsible: string } | null>(null);

  const updateMeasureMutation = trpc.measures.update.useMutation({
    onSuccess: () => { measuresQuery.refetch(); toast.success("Medida atualizada"); setEditingMeasure(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMeasureMutation = trpc.measures.delete.useMutation({
    onSuccess: () => { measuresQuery.refetch(); toast.success("Medida eliminada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const isAdmin = user?.role === "admin";

  const [expandedMeasures, setExpandedMeasures] = useState<Set<number>>(new Set());

  function toggleMeasure(measureId: number) {
    setExpandedMeasures(prev => {
      const next = new Set(prev);
      if (next.has(measureId)) next.delete(measureId);
      else next.add(measureId);
      return next;
    });
  }

  // Group sections and measures by all lifecycle phases
  const phaseData = useMemo(() => {
    if (!sectionsQuery.data || !measuresQuery.data) return {};
    const result: Record<string, { section: any; measures: any[] }[]> = {};
    for (const phase of ALL_PHASES) {
      const phaseSections = sectionsQuery.data.filter((s: any) => s.phase === phase.key);
      result[phase.key] = phaseSections.map((s: any) => ({
        section: s,
        measures: measuresQuery.data.filter((m: any) => m.sectionId === s.id),
      }));
    }
    return result;
  }, [sectionsQuery.data, measuresQuery.data]);

  const currentPhaseSections = phaseData[activePhase] || [];
  const currentPhaseSection = currentPhaseSections[0]?.section;
  const currentPhaseInfo = ALL_PHASES.find(p => p.key === activePhase);
  const currentProjectPhase = (projectPhasesQuery.data || []).find((phase: any) => phase.phaseKey === activePhase || phase.phaseName === activePhase || phase.phaseName === currentPhaseInfo?.label);

  // Group evidence by measure
  const evidenceByMeasure = useMemo(() => {
    if (!evidenceQuery.data) return {};
    const map: Record<number, any[]> = {};
    for (const ev of evidenceQuery.data) {
      if (!map[ev.measureId]) map[ev.measureId] = [];
      map[ev.measureId].push(ev);
    }
    return map;
  }, [evidenceQuery.data]);

  const trackingByMeasure = useMemo(() => {
    const map: Record<number, any> = {};
    for (const item of statusesQuery.data || []) map[item.measureId] = item;
    return map;
  }, [statusesQuery.data]);

  // Calculate compliance overview
  const complianceOverview = useMemo(() => {
    const overview: Record<string, { total: number; concluido: number; em_curso: number; pendente: number }> = {};
    for (const phase of ALL_PHASES) {
      const data = phaseData[phase.key] || [];
      const total = data.reduce((acc: number, d: any) => acc + d.measures.length, 0);
      let concluido = 0, em_curso = 0, pendente = 0;
      data.forEach((d: any) => d.measures.forEach((m: any) => {
        const s = trackingByMeasure[m.id]?.trackingStatus || "nao_iniciado";
        if (s === "concluido") concluido++;
        else if (s !== "nao_iniciado") em_curso++;
        else pendente++;
      }));
      overview[phase.key] = { total, concluido, em_curso, pendente };
    }
    return overview;
  }, [phaseData, trackingByMeasure]);

  if (!sectionsQuery.data || !measuresQuery.data) {
    const loadingContent = (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded" />
      </div>
    );
    return embedded ? loadingContent : <AppLayout>{loadingContent}</AppLayout>;
  }

  const mainContent = (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${currentPhaseInfo?.color || "bg-gray-400"}`} />
            Fases do Projeto
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhamento das medidas ambientais por fase do ciclo de vida — {activeProject?.name || "Projeto"}
          </p>
        </div>
        {isOperationOnly && (
          <div className="flex items-center gap-2">
            <div className="text-lg font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-4 py-1.5">Evidências {evidenceYear}</div>
            <Select value={String(evidenceYear)} onValueChange={v => setEvidenceYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 11 }, (_, i) => SIN01_EVIDENCE_START_YEAR + i).map(y => (
                  <SelectItem key={y} value={String(y)}>{t("Evidências")} {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => toast.info(t("Exportação Word em desenvolvimento"))}>
              <Download className="w-4 h-4 mr-1" /> Criar Doc {evidenceYear}
            </Button>
          </div>
        )}
      </div>

      {!isAdminOrDono && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-3">
            <p className="text-sm text-blue-800">
              <strong>{t("Modo de visualização.")}</strong> Apenas o Dono de Obra, Admin e RAA podem editar o estado das medidas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Phase tabs */}
      <Tabs value={activePhase} onValueChange={setActivePhase}>
        <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
          {visiblePhases.map(phase => {
            const ov = complianceOverview[phase.key] || { total: 0, concluido: 0 };
            const pct = ov.total > 0 ? Math.round((ov.concluido / ov.total) * 100) : 0;
            return (
              <TabsTrigger
                key={phase.key}
                value={phase.key}
                className="flex-1 min-w-[120px] data-[state=active]:shadow-sm py-2 px-3"
              >
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${phase.color}`} />
                    <span className="text-xs font-medium">{phase.shortLabel}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{pct}% ({ov.concluido}/{ov.total})</span>
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {visiblePhases.map(phase => (
          <TabsContent key={phase.key} value={phase.key} className="mt-4 space-y-4">
            {/* Phase header with add button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{phase.label}</h2>
                <p className="text-sm text-muted-foreground">
                  {(complianceOverview[phase.key]?.total || 0)} medidas nesta fase
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentProjectPhase && <Button size="sm" variant="outline" onClick={() => window.open(`/api/pdf/fases/${projectId}?phaseId=${currentProjectPhase.id}`, "_blank", "noopener,noreferrer")}><Download className="w-4 h-4 mr-1" /> PDF desta fase</Button>}
                {isAdminOrDono && (
                  <Dialog open={showAdd && activePhase === phase.key} onOpenChange={setShowAdd}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />{t("Adicionar Medida")}</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nova Medida — {phase.label}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Input placeholder={t("Número (ex: PL-4)")} value={newMeasure.number} onChange={e => setNewMeasure(p => ({ ...p, number: e.target.value }))} />
                        <Textarea placeholder={t("Descrição da medida/condição")} value={newMeasure.description} onChange={e => setNewMeasure(p => ({ ...p, description: e.target.value }))} />
                        <Button onClick={() => {
                          const sec = (phaseData[phase.key] || [])[0]?.section;
                          if (!sec) { toast.error(t("Secção não encontrada")); return; }
                          addMeasureMutation?.mutate?.({
                            projectId,
                            number: newMeasure.number,
                            description: newMeasure.description,
                            responsible: "DO",
                            sectionId: sec.id,
                          });
                        }} disabled={!newMeasure.number || !newMeasure.description}>
                          Adicionar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {isAdmin && (
                  <Button size="sm" variant={showSettings ? "default" : "ghost"} onClick={() => setShowSettings(!showSettings)} title={t("Definições (Admin)")}>
                    <SettingsGear className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Admin Settings Panel */}
            {isAdmin && showSettings && (
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <SettingsGear className="w-4 h-4 text-amber-600" />{t("Definições de Medidas (Admin)")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">{t("Edite o número, descrição ou elimine medidas desta fase. Apenas visível para administradores.")}</p>
                  {(phaseData[phase.key] || []).map(({ measures: phaseMeasures }: any) =>
                    phaseMeasures.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2 p-2 rounded border bg-background">
                        {editingMeasure?.id === m.id ? (
                          <>
                            <Input className="w-20 h-8 text-xs" value={editingMeasure!.number} onChange={e => setEditingMeasure({ ...editingMeasure!, number: e.target.value })} />
                            <Input className="flex-1 h-8 text-xs" value={editingMeasure!.description} onChange={e => setEditingMeasure({ ...editingMeasure!, description: e.target.value })} />
                            <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => updateMeasureMutation.mutate({ id: editingMeasure!.id, projectId, number: editingMeasure!.number, description: editingMeasure!.description, responsible: editingMeasure!.responsible })}>
                              Guardar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingMeasure(null)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge variant="outline" className="text-xs font-mono shrink-0">{m.number}</Badge>
                            <span className="text-xs flex-1">{m.description}</span>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingMeasure({ id: m.id, number: m.number, description: m.description, responsible: m.responsible })}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Eliminar medida ${m.number}?`)) deleteMeasureMutation.mutate({ id: m.id, projectId }); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {/* Measures list */}
            {(() => {
              const groups = groupsWithMeasures(phaseData[phase.key] || []);
              if (groups.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t("Nenhuma medida registada nesta fase.")}</p>
                    {isAdminOrDono && <p className="text-sm">{t("Use o botão 'Adicionar Medida' para começar.")}</p>}
                  </div>
                );
              }
              return groups.map(({ section, measures }: any) => (
                <div key={section.id} className="space-y-2">
                  {measures.map((measure: any) => (
                    <MeasureCard
                      key={measure.id}
                      measure={measure}
                      tracking={trackingByMeasure[measure.id] || null}
                      projectId={projectId}
                      evidence={evidenceByMeasure[measure.id] || []}
                      isExpanded={expandedMeasures.has(measure.id)}
                      onToggle={() => toggleMeasure(measure.id)}
                      onAddComment={(content) => addCommentMutation.mutate({ projectId, measureId: measure.id, content, referenceYear: isOperationOnly ? evidenceYear : undefined })}
                      onUploadFile={(file, isPhoto, category) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const base64 = (reader.result as string).split(",")[1];
                          uploadFileMutation.mutate({
                            projectId,
                            measureId: measure.id,
                            filename: file.name,
                            mimeType: file.type,
                            data: base64,
                            isPhoto,
                            category: category || undefined,
                            referenceYear: isOperationOnly ? evidenceYear : undefined,
                          });
                        };
                        reader.readAsDataURL(file);
                      }}
                      onDeleteEvidence={(id) => deleteEvidenceMutation.mutate({ id })}
                      onUpdatePhotoCategory={(id, category) => updatePhotoCategoryMutation.mutate({ id, category })}
                      isEditable={!!isAdminOrDono}
                      phaseColor={phase.color}
                      isOperationOnly={!!isOperationOnly}
                      evidenceYear={evidenceYear}
                    />
                  ))}
                </div>
              ));
            })()}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
  return embedded ? mainContent : <AppLayout>{mainContent}</AppLayout>;
}
function MeasureCard({
  measure, tracking, projectId, evidence, isExpanded, onToggle,
  onAddComment, onUploadFile, onDeleteEvidence, onUpdatePhotoCategory,
  isEditable, phaseColor, isOperationOnly, evidenceYear,
}: {
  measure: any;
  tracking: any;
  projectId: number;
  evidence: any[];
  isExpanded: boolean;
  onToggle: () => void;
  onAddComment: (content: string) => void;
  onUploadFile: (file: File, isPhoto: boolean, category?: string) => void;
  onDeleteEvidence: (id: number) => void;
  onUpdatePhotoCategory: (id: number, category: string | null) => void;
  isEditable: boolean;
  phaseColor: string;
  isOperationOnly?: boolean;
  evidenceYear?: number;
}) {
  const { t } = useLanguage();
  const [commentText, setCommentText] = useState("");
  const [photoCategory, setPhotoCategory] = useState("");
  const [photoFilter, setPhotoFilter] = useState("all");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [photoScale, setPhotoScale] = useState(1);
  const [photoOffset, setPhotoOffset] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const comments = evidence.filter(e => e.type === "comment");
  const photos = evidence.filter(e => e.type === "photo");
  const files = evidence.filter(e => e.type === "file");
  const photoCategories = Array.from(new Set(photos.map((photo: any) => photo.category).filter(Boolean))) as string[];
  const visiblePhotos = photoFilter === "all" ? photos : photos.filter((photo: any) => photo.category === photoFilter);
  const selectedPhoto = selectedPhotoIndex === null ? null : visiblePhotos[selectedPhotoIndex];
  const totalAttachments = evidence.length;

  useEffect(() => {
    setPhotoScale(1);
    setPhotoOffset({ x: 0, y: 0 });
  }, [selectedPhotoIndex, photoFilter]);

  const resetPhotoView = () => {
    setPhotoScale(1);
    setPhotoOffset({ x: 0, y: 0 });
  };

  const trackingStatus = tracking?.trackingStatus || "nao_iniciado";
  const statusColor = trackingStatus === "concluido"
    ? "border-l-green-500"
    : trackingStatus === "bloqueado"
      ? "border-l-red-500"
      : trackingStatus !== "nao_iniciado"
        ? "border-l-amber-500"
        : "border-l-gray-300";

  return (
    <div className={`border rounded-lg overflow-hidden border-l-4 ${statusColor} transition-all`}>
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <Badge variant="outline" className="text-xs shrink-0 font-mono">{measure.number}</Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm">{measure.description}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span><strong>Responsável:</strong> {tracking?.ownerName || "Por definir"}</span>
            <span><strong>Suporte:</strong> {[tracking?.supportName, tracking?.supportCompany].filter(Boolean).join(" — ") || "Por definir"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totalAttachments > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Paperclip className="w-3 h-3" />{totalAttachments}
            </span>
          )}
          <StatusBadge status={trackingStatus} />
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t px-4 py-3 space-y-4 bg-muted/10">
          <MeasureTrackingPanel measure={measure} tracking={tracking} projectId={projectId} />

          {/* Evidence sections */}
          {isOperationOnly && evidenceYear && (
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-base px-3 py-1 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800">
                📅 Evidências {evidenceYear}
              </Badge>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Comments */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MessageSquare className="w-4 h-4" /> Comentários ({comments.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {comments.map(c => (
                  <div key={c.id} className="bg-background rounded-lg p-3 text-sm border">
                    <p className="text-foreground leading-relaxed">{c.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-muted-foreground text-xs">{c.createdByName} · {new Date(c.createdAt).toLocaleDateString("pt-PT")}{c.referenceYear ? ` · ${c.referenceYear}` : ""}</span>
                      {isEditable && (
                        <button onClick={() => onDeleteEvidence(c.id)} className="text-destructive/60 hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {isEditable && (
                <div className="flex gap-1">
                  <Input
                    placeholder={t("Adicionar comentário") + "..."}
                    className="h-7 text-xs"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && commentText.trim()) {
                        onAddComment(commentText.trim());
                        setCommentText("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={!commentText.trim()}
                    onClick={() => { onAddComment(commentText.trim()); setCommentText(""); }}
                  >
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            {/* Photos */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Image className="w-4 h-4" /> Fotos ({photos.length})
              </h4>
              {photoCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label={t("Filtrar fotografias por categoria")}>
                  <Button type="button" size="sm" variant={photoFilter === "all" ? "default" : "outline"} className="h-7 rounded-full px-2.5 text-xs" onClick={() => setPhotoFilter("all")}>
                    <Images className="mr-1 size-3" />{t("Todas")} ({photos.length})
                  </Button>
                  {photoCategories.map((category) => (
                    <Button type="button" key={category} size="sm" variant={photoFilter === category ? "default" : "outline"} className="h-7 rounded-full px-2.5 text-xs" onClick={() => setPhotoFilter(category)}>
                      {category} ({photos.filter((photo: any) => photo.category === category).length})
                    </Button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {visiblePhotos.map((p, index) => (
                  <div key={p.id} className="relative group">
                    <button
                      type="button"
                      className="block w-full overflow-hidden rounded-xl border bg-muted text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setSelectedPhotoIndex(index)}
                      aria-label={`${t("Abrir fotografia")}: ${p.filename || t("Fotografia")}`}
                    >
                      <img src={p.content} alt={p.filename || t("Fotografia")} className="h-40 w-full object-cover sm:h-44" />
                      <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">{p.category || t("Sem categoria")}</span>
                    </button>
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => onDeleteEvidence(p.id)}
                        className="absolute top-0.5 right-0.5 bg-destructive/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Dialog
                open={selectedPhotoIndex !== null}
                onOpenChange={(open) => { if (!open) setSelectedPhotoIndex(null); }}
              >
                <DialogContent
                  className="max-h-[94vh] max-w-6xl overflow-hidden border-border/70 bg-background p-0"
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" && selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
                      event.preventDefault();
                      setSelectedPhotoIndex(selectedPhotoIndex - 1);
                    }
                    if (event.key === "ArrowRight" && selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
                      event.preventDefault();
                      setSelectedPhotoIndex(selectedPhotoIndex + 1);
                    }
                  }}
                >
                  {selectedPhoto && selectedPhotoIndex !== null && (
                    <div className="flex max-h-[94vh] flex-col">
                      <DialogHeader className="border-b px-5 py-4 pr-12 text-left">
                        <DialogTitle className="truncate text-base">{selectedPhoto.filename || t("Fotografia")}</DialogTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-xs text-muted-foreground">{selectedPhotoIndex + 1}/{visiblePhotos.length}</p>
                          {isEditable ? (
                            <Select value={selectedPhoto.category || "sem-categoria"} onValueChange={(value) => onUpdatePhotoCategory(selectedPhoto.id, value === "sem-categoria" ? null : value)}>
                              <SelectTrigger className="h-7 min-w-40 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sem-categoria">{t("Sem categoria")}</SelectItem>
                                {photoCategories.filter((category) => category !== selectedPhoto.category).map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                                {selectedPhoto.category && <SelectItem value={selectedPhoto.category}>{selectedPhoto.category}</SelectItem>}
                              </SelectContent>
                            </Select>
                          ) : <span className="text-xs text-muted-foreground">{selectedPhoto.category || t("Sem categoria")}</span>}
                        </div>
                      </DialogHeader>
                      <div
                        className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden bg-black/95 p-3 sm:p-6"
                        onWheel={(event) => {
                          event.preventDefault();
                          const nextScale = Math.min(4, Math.max(1, photoScale + (event.deltaY < 0 ? 0.25 : -0.25)));
                          setPhotoScale(nextScale);
                          if (nextScale === 1) setPhotoOffset({ x: 0, y: 0 });
                        }}
                        onPointerDown={(event) => {
                          if (photoScale <= 1) return;
                          panStartRef.current = { x: event.clientX, y: event.clientY, offsetX: photoOffset.x, offsetY: photoOffset.y };
                          event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={(event) => {
                          if (!panStartRef.current || photoScale <= 1) return;
                          setPhotoOffset({ x: panStartRef.current.offsetX + event.clientX - panStartRef.current.x, y: panStartRef.current.offsetY + event.clientY - panStartRef.current.y });
                        }}
                        onPointerUp={() => { panStartRef.current = null; }}
                      >
                        <img
                          src={selectedPhoto.content}
                          alt={selectedPhoto.filename || t("Fotografia")}
                          className={`max-h-[74vh] w-auto max-w-full rounded-md object-contain transition-transform duration-150 ${photoScale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
                          style={{ transform: `translate(${photoOffset.x}px, ${photoOffset.y}px) scale(${photoScale})` }}
                          onDoubleClick={() => photoScale > 1 ? resetPhotoView() : setPhotoScale(2)}
                        />
                        <div className="absolute left-4 top-4 flex items-center gap-1 rounded-xl border border-white/15 bg-black/45 p-1 backdrop-blur">
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-white hover:bg-white/15 hover:text-white" onClick={() => setPhotoScale((value) => Math.min(4, value + 0.25))} aria-label={t("Ampliar fotografia")}><ZoomIn className="size-4" /></Button>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-white hover:bg-white/15 hover:text-white" onClick={() => { const nextScale = Math.max(1, photoScale - 0.25); setPhotoScale(nextScale); if (nextScale === 1) setPhotoOffset({ x: 0, y: 0 }); }} aria-label={t("Reduzir fotografia")}><ZoomOut className="size-4" /></Button>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-white hover:bg-white/15 hover:text-white" onClick={resetPhotoView} aria-label={t("Repor visualização")}><RotateCcw className="size-4" /></Button>
                          <a href={selectedPhoto.content} download={selectedPhoto.filename || "fotografia"} className="inline-flex size-8 items-center justify-center rounded-md text-white hover:bg-white/15" aria-label={t("Descarregar fotografia")}><Download className="size-4" /></a>
                        </div>
                        {selectedPhotoIndex > 0 && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full shadow-lg"
                            onClick={() => setSelectedPhotoIndex(selectedPhotoIndex - 1)}
                            aria-label={t("Anterior")}
                          >
                            <ChevronLeft className="size-5" />
                          </Button>
                        )}
                        {selectedPhotoIndex < visiblePhotos.length - 1 && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full shadow-lg"
                            onClick={() => setSelectedPhotoIndex(selectedPhotoIndex + 1)}
                            aria-label={t("Seguinte")}
                          >
                            <ChevronRight className="size-5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              {isEditable && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor={`photo-category-${measure.id}`}>{t("Categoria fotográfica")}</label>
                    <Input
                      id={`photo-category-${measure.id}`}
                      list={`photo-category-options-${measure.id}`}
                      className="h-8 text-xs"
                      placeholder={t("Ex.: Estaleiro, Linha de água, Acesso Norte")}
                      value={photoCategory}
                      onChange={(event) => setPhotoCategory(event.target.value)}
                      maxLength={120}
                    />
                    <datalist id={`photo-category-options-${measure.id}`}>
                      {photoCategories.map(category => <option key={category} value={category} />)}
                    </datalist>
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onUploadFile(f, true, photoCategory.trim() || undefined);
                    e.target.value = "";
                  }} />
                  <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={() => photoInputRef.current?.click()}>
                    <Image className="w-3 h-3 mr-1" /> {t("Adicionar fotografia")}
                  </Button>
                </>
              )}
            </div>

            {/* Files */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> Ficheiros ({files.length})
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-1.5 bg-background rounded p-1.5 border text-xs">
                    <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                    <a href={f.content} target="_blank" rel="noopener" className="flex-1 truncate hover:underline text-primary">{f.filename}</a>
                    <div className="flex gap-0.5 shrink-0">
                      <a href={f.content} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground">
                        <Download className="w-3 h-3" />
                      </a>
                      {isEditable && (
                        <button onClick={() => onDeleteEvidence(f.id)} className="text-destructive/60 hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {isEditable && (
                <>
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" className="hidden" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onUploadFile(f, false);
                    e.target.value = "";
                  }} />
                  <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="w-3 h-3 mr-1" /> Anexar Ficheiro
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const { t } = useLanguage();
  if (!status || status === "nao_iniciado") return <Badge variant="outline" className="text-xs text-gray-500 px-1.5 py-0">{t("Não iniciado")}</Badge>;
  switch (status) {
    case "concluido":
      return <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100 px-1.5 py-0"><CheckCircle2 className="w-3 h-3 mr-0.5" />{t("Reportado")}</Badge>;
    case "em_curso":
      return <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100 px-1.5 py-0"><Clock className="w-3 h-3 mr-0.5" />{t("Em Curso")}</Badge>;
    case "em_validacao":
      return <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100 px-1.5 py-0"><Clock className="w-3 h-3 mr-0.5" />{t("Em validação")}</Badge>;
    case "bloqueado":
      return <Badge className="text-xs bg-red-100 text-red-800 hover:bg-red-100 px-1.5 py-0"><AlertCircle className="w-3 h-3 mr-0.5" />{t("Bloqueado")}</Badge>;
    default:
      return null;
  }
}
import { Settings2 as SettingsGear, Pencil } from "lucide-react";
