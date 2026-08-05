import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, FileText, CheckCircle2, AlertCircle, Clock } from "lucide-react";

// All project lifecycle phases (excluding construction which has its own weekly form)
const ALL_PHASES = [
  { key: "Prévias Licenciamento", label: "Previamente ao Licenciamento", shortLabel: "Pré-Licenciamento", order: 1 },
  { key: "Em Sede de Licenciamento", label: "Em Sede de Licenciamento", shortLabel: "Licenciamento", order: 2 },
  { key: "Pré-Construção", label: "Previamente ao Início da Construção", shortLabel: "Pré-Construção", order: 3 },
  { key: "Fase Final Construção", label: "Fase Final da Construção", shortLabel: "Final Construção", order: 5 },
  { key: "Exploração", label: "Fase de Exploração", shortLabel: "Exploração", order: 6 },
  { key: "Desativação (Pós-Exploração)", label: "Fase de Desativação", shortLabel: "Desativação", order: 7 },
];

export default function PhaseMeasures() {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "raa";

  const sectionsQuery = trpc.sections.list.useQuery();
  const measuresQuery = trpc.measures.list.useQuery();

  const projectId = activeProject?.id || 1;

  const statusesQuery = trpc.phaseMeasures.getStatuses.useQuery({ projectId });

  const updateStatusMutation = trpc.phaseMeasures.updateStatus.useMutation({
    onSuccess: () => { statusesQuery.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addMeasureMutation = trpc.measures.create.useMutation({
    onSuccess: () => { measuresQuery.refetch(); toast.success("Medida adicionada"); setShowAdd(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [activePhase, setActivePhase] = useState(ALL_PHASES[0].key);
  const [newMeasure, setNewMeasure] = useState({ number: "", description: "", sectionId: 0 });
  const [statuses, setStatuses] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  // Sync persisted statuses to local state
  useEffect(() => {
    if (statusesQuery.data) {
      const s: Record<number, string> = {};
      const n: Record<number, string> = {};
      for (const item of statusesQuery.data) {
        s[item.measureId] = item.status;
        if (item.notes) n[item.measureId] = item.notes;
      }
      setStatuses(s);
      setNotes(n);
    }
  }, [statusesQuery.data]);

  function handleStatusChange(measureId: number, status: string) {
    setStatuses(prev => ({ ...prev, [measureId]: status }));
    updateStatusMutation.mutate({
      measureId,
      projectId,
      status: status as "pendente" | "em_curso" | "concluido",
      notes: notes[measureId] || null,
    });
  }

  function handleNotesBlur(measureId: number) {
    if (statuses[measureId]) {
      updateStatusMutation.mutate({
        measureId,
        projectId,
        status: statuses[measureId] as "pendente" | "em_curso" | "concluido",
        notes: notes[measureId] || null,
      });
    }
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

  // Calculate compliance overview
  const complianceOverview = useMemo(() => {
    const overview: Record<string, { total: number; concluido: number; em_curso: number; pendente: number }> = {};
    for (const phase of ALL_PHASES) {
      const data = phaseData[phase.key] || [];
      const total = data.reduce((acc: number, d: any) => acc + d.measures.length, 0);
      let concluido = 0, em_curso = 0, pendente = 0;
      data.forEach((d: any) => d.measures.forEach((m: any) => {
        const s = statuses[m.id];
        if (s === "concluido") concluido++;
        else if (s === "em_curso") em_curso++;
        else pendente++;
      }));
      overview[phase.key] = { total, concluido, em_curso, pendente };
    }
    return overview;
  }, [phaseData, statuses]);

  if (!sectionsQuery.data || !measuresQuery.data) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ciclo de Vida do Projeto</h1>
          <p className="text-muted-foreground">Todas as fases do processo ambiental — do licenciamento à desativação</p>
        </div>
      </div>

      {!isAdminOrDono && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800">
              <strong>Modo de visualização.</strong> Apenas o Dono de Obra, Admin e RAA podem editar o estado das medidas nestas fases.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Overview cards - clickable phase selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {ALL_PHASES.map(phase => {
          const ov = complianceOverview[phase.key] || { total: 0, concluido: 0, em_curso: 0, pendente: 0 };
          const pct = ov.total > 0 ? Math.round((ov.concluido / ov.total) * 100) : 0;
          const isActive = activePhase === phase.key;
          return (
            <button
              key={phase.key}
              onClick={() => setActivePhase(phase.key)}
              className={`p-3 rounded-lg border text-left transition-all ${isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
            >
              <p className="text-xs font-medium truncate">{phase.shortLabel}</p>
              <div className="mt-1 flex items-end gap-1">
                <span className="text-lg font-bold">{pct}%</span>
                <span className="text-xs text-muted-foreground mb-0.5">{ov.concluido}/{ov.total}</span>
              </div>
              <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Active phase detail */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{ALL_PHASES.find(p => p.key === activePhase)?.label}</CardTitle>
            {isAdminOrDono && (
              <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Adicionar Medida</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Medida — {ALL_PHASES.find(p => p.key === activePhase)?.label}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Número (ex: PL-4)" value={newMeasure.number} onChange={e => setNewMeasure(p => ({ ...p, number: e.target.value }))} />
                    <Textarea placeholder="Descrição da medida/condição" value={newMeasure.description} onChange={e => setNewMeasure(p => ({ ...p, description: e.target.value }))} />
                    <Button onClick={() => {
                      if (!currentPhaseSection) { toast.error("Secção não encontrada"); return; }
                      addMeasureMutation?.mutate?.({
                        number: newMeasure.number,
                        description: newMeasure.description,
                        responsible: "DO",
                        sectionId: currentPhaseSection.id,
                      });
                    }} disabled={!newMeasure.number || !newMeasure.description}>
                      Adicionar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentPhaseSections.map(({ section, measures }: any) => (
            <div key={section.id} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{section.name}</p>
              {measures.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma medida registada nesta secção.</p>
              ) : measures.map((measure: any) => (
                <div key={measure.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">{measure.number}</Badge>
                        <span className="text-sm">{measure.description}</span>
                      </div>
                    </div>
                    <StatusBadge status={statuses[measure.id]} />
                  </div>
                  {isAdminOrDono && (
                    <div className="flex items-center gap-4 pt-1">
                      <RadioGroup
                        value={statuses[measure.id] || ""}
                        onValueChange={(v) => handleStatusChange(measure.id, v)}
                        className="flex gap-3"
                      >
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="concluido" id={`s-${measure.id}-c`} />
                          <Label htmlFor={`s-${measure.id}-c`} className="text-xs text-green-700">Concluído</Label>
                        </div>
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="em_curso" id={`s-${measure.id}-e`} />
                          <Label htmlFor={`s-${measure.id}-e`} className="text-xs text-amber-700">Em Curso</Label>
                        </div>
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="pendente" id={`s-${measure.id}-p`} />
                          <Label htmlFor={`s-${measure.id}-p`} className="text-xs text-gray-500">Pendente</Label>
                        </div>
                      </RadioGroup>
                      <Input
                        placeholder="Notas..."
                        className="h-7 text-xs flex-1"
                        value={notes[measure.id] || ""}
                        onChange={e => setNotes(prev => ({ ...prev, [measure.id]: e.target.value }))}
                        onBlur={() => handleNotesBlur(measure.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {currentPhaseSections.every((d: any) => d.measures.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma medida registada para esta fase.</p>
              {isAdminOrDono && <p className="text-sm">Use o botão "Adicionar Medida" para começar.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="outline" className="text-xs text-gray-400">Sem estado</Badge>;
  switch (status) {
    case "concluido":
      return <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />Concluído</Badge>;
    case "em_curso":
      return <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100"><Clock className="w-3 h-3 mr-1" />Em Curso</Badge>;
    case "pendente":
      return <Badge className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-100"><AlertCircle className="w-3 h-3 mr-1" />Pendente</Badge>;
    default:
      return null;
  }
}
