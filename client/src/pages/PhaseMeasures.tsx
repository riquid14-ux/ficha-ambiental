import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Save, FileText, CheckCircle2, AlertCircle, Clock } from "lucide-react";

// The 3 new phases (not construction)
const NEW_PHASES = [
  { key: "Prévias Licenciamento", label: "Previamente ao Licenciamento", shortLabel: "Prévias" },
  { key: "Em Sede de Licenciamento", label: "Em Sede de Licenciamento", shortLabel: "Licenciamento" },
  { key: "Exploração", label: "Fase de Exploração", shortLabel: "Exploração" },
];

export default function PhaseMeasures() {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";

  const sectionsQuery = trpc.sections.list.useQuery();
  const measuresQuery = trpc.measures.list.useQuery();

  // Get the active project ID (default to first project)
  const projectId = activeProject?.id || 1;

  // Fetch persisted statuses from backend
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
  const [activePhase, setActivePhase] = useState(NEW_PHASES[0].key);
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

  // Save handler
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

  // Group sections and measures by the new phases only
  const phaseData = useMemo(() => {
    if (!sectionsQuery.data || !measuresQuery.data) return {};
    const result: Record<string, { section: any; measures: any[] }[]> = {};
    for (const phase of NEW_PHASES) {
      const phaseSections = sectionsQuery.data.filter(s => s.phase === phase.key);
      result[phase.key] = phaseSections.map(s => ({
        section: s,
        measures: measuresQuery.data.filter(m => m.sectionId === s.id),
      }));
    }
    return result;
  }, [sectionsQuery.data, measuresQuery.data]);

  const currentPhaseSection = phaseData[activePhase]?.[0]?.section;

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
          <h1 className="text-2xl font-bold">Fases do Projeto</h1>
          <p className="text-muted-foreground">Medidas e condições por fase — gerido pelo Dono de Obra</p>
        </div>
      </div>

      {!isAdminOrDono && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800">
              <strong>Modo de visualização.</strong> Apenas o Dono de Obra e Admin podem editar o estado das medidas nestas fases.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activePhase} onValueChange={setActivePhase}>
        <TabsList className="w-full justify-start">
          {NEW_PHASES.map(phase => {
            const data = phaseData[phase.key] || [];
            const totalMeasures = data.reduce((acc, d) => acc + d.measures.length, 0);
            return (
              <TabsTrigger key={phase.key} value={phase.key} className="text-xs sm:text-sm">
                {phase.shortLabel} ({totalMeasures})
              </TabsTrigger>
            );
          })}
        </TabsList>

        {NEW_PHASES.map(phase => (
          <TabsContent key={phase.key} value={phase.key} className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{phase.label}</h2>
              {isAdminOrDono && (
                <Dialog open={showAdd && activePhase === phase.key} onOpenChange={setShowAdd}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Adicionar Medida</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Medida — {phase.label}</DialogTitle>
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

            {(phaseData[phase.key] || []).map(({ section, measures }) => (
              <Card key={section.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{section.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {measures.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma medida registada nesta secção.</p>
                  ) : measures.map(measure => (
                    <div key={measure.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs shrink-0">{measure.number}</Badge>
                            <span className="text-sm font-medium">{measure.description}</span>
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
                </CardContent>
              </Card>
            ))}

            {(phaseData[phase.key] || []).every(d => d.measures.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma medida registada para esta fase.</p>
                {isAdminOrDono && <p className="text-sm">Use o botão "Adicionar Medida" para começar.</p>}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
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
