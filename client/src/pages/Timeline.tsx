import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, Layers } from "lucide-react";

type PhaseDef = typeof PHASE_DEFS[number];
type PhaseDataItem = PhaseDef & { total: number; concluido: number; emCurso: number; pendente: number; progress: number; isComplete: boolean; hasActivity: boolean };

// Phase definitions matching the database
const PHASE_DEFS = [
  { key: "Prévias Licenciamento", label: "Pré-Licenciamento", shortLabel: "Pré-Lic.", color: "bg-purple-500", lightColor: "bg-purple-50 border-purple-200", textColor: "text-purple-700" },
  { key: "Em Sede de Licenciamento", label: "Licenciamento", shortLabel: "Lic.", color: "bg-blue-500", lightColor: "bg-blue-50 border-blue-200", textColor: "text-blue-700" },
  { key: "Pré-Construção", label: "Pré-Construção", shortLabel: "Pré-Const.", color: "bg-cyan-500", lightColor: "bg-cyan-50 border-cyan-200", textColor: "text-cyan-700" },
  { key: "Preparação Prévia", label: "Construção (Preparação)", shortLabel: "Prep.", color: "bg-emerald-400", lightColor: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700" },
  { key: "Execução da Obra", label: "Construção (Execução)", shortLabel: "Exec.", color: "bg-emerald-500", lightColor: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700" },
  { key: "Fase Final", label: "Construção (Final)", shortLabel: "Final", color: "bg-emerald-600", lightColor: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700" },
  { key: "Fase Final Construção", label: "Final da Construção", shortLabel: "Final Const.", color: "bg-amber-500", lightColor: "bg-amber-50 border-amber-200", textColor: "text-amber-700" },
  { key: "Exploração", label: "Exploração", shortLabel: "Expl.", color: "bg-orange-500", lightColor: "bg-orange-50 border-orange-200", textColor: "text-orange-700" },
  { key: "Desativação (Pós-Exploração)", label: "Desativação", shortLabel: "Desat.", color: "bg-gray-500", lightColor: "bg-gray-50 border-gray-200", textColor: "text-gray-700" },
];

export default function Timeline() {
  const { user } = useAuth();
  const { activeProject, isAllProjects, projects } = useProject();

  const projectId = activeProject?.id;

  // Fetch all sections and measures
  const { data: allSections } = trpc.sections.list.useQuery();
  const { data: allMeasures } = trpc.measures.list.useQuery();

  // Fetch phase measure statuses for the selected project
  const { data: phaseStatuses } = trpc.phaseMeasures.getStatuses.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Compute compliance per phase
  const phaseData = useMemo(() => {
    if (!allSections || !allMeasures) return [];

    const statusMap = new Map<number, string>();
    (phaseStatuses || []).forEach(s => statusMap.set(s.measureId, s.status));

    return PHASE_DEFS.map(phaseDef => {
      // Find sections matching this phase
      const phaseSections = allSections.filter(s => s.phase === phaseDef.key);
      const sectionIds = new Set(phaseSections.map(s => s.id));

      // Find measures in those sections
      const phaseMeasures = allMeasures.filter(m => sectionIds.has(m.sectionId));
      const total = phaseMeasures.length;

      if (total === 0) return null;

      // Count statuses
      let concluido = 0;
      let emCurso = 0;
      let pendente = 0;

      phaseMeasures.forEach(m => {
        const status = statusMap.get(m.id) || "pendente";
        if (status === "concluido") concluido++;
        else if (status === "em_curso") emCurso++;
        else pendente++;
      });

      const progress = total > 0 ? Math.round((concluido / total) * 100) : 0;
      const isComplete = concluido === total;
      const hasActivity = concluido > 0 || emCurso > 0;

      return {
      ...phaseDef,
      total,
      concluido,
      emCurso,
      pendente,
      progress,
      isComplete,
      hasActivity,
    };
    }).filter(Boolean) as PhaseDataItem[];
  }, [allSections, allMeasures, phaseStatuses]);

  // Overall stats
  const totalMeasures = phaseData.reduce((sum, p) => sum + p.total, 0);
  const totalConcluido = phaseData.reduce((sum, p) => sum + p.concluido, 0);
  const totalEmCurso = phaseData.reduce((sum, p) => sum + p.emCurso, 0);
  const totalPendente = phaseData.reduce((sum, p) => sum + p.pendente, 0);
  const overallProgress = totalMeasures > 0 ? Math.round((totalConcluido / totalMeasures) * 100) : 0;

  if (!projectId) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
          <Layers className="w-6 h-6" /> Timeline do Projeto
        </h1>
        <p className="text-muted-foreground">Visão geral do estado de cada projeto e a fase em que se encontra.</p>

        {/* All projects overview with phase indicators */}
        {projects && projects.length > 0 && (
          <div className="space-y-2">
            {projects.map(p => (
              <Card key={p.id} className="hover:shadow-sm transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{p.code?.slice(0, 4)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.code}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">Ativo</Badge>
                  </div>
                  {/* Phase progress mini-bar */}
                  <div className="flex gap-1">
                    {PHASE_DEFS.slice(0, 6).map((phase, idx) => (
                      <div key={phase.key} className="flex-1">
                        <div className={`h-2 rounded-full ${phase.color} opacity-30`} />
                        <p className="text-[9px] text-center text-muted-foreground mt-0.5 truncate">{phase.shortLabel}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">Selecione um projeto no menu lateral para ver o detalhe completo da timeline.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="w-6 h-6" /> Timeline do Projeto
        </h1>
        <p className="text-muted-foreground text-sm">
          Visão geral do cumprimento de medidas por fase — {activeProject?.name}
        </p>
      </div>

      {/* Overall progress card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Progresso Global</p>
              <p className="text-3xl font-bold">{overallProgress}%</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground">{totalMeasures} medidas total</p>
              <div className="flex gap-3 mt-1">
                <span className="flex items-center gap-1 text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {totalConcluido}
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Clock className="w-3.5 h-3.5" /> {totalEmCurso}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <AlertCircle className="w-3.5 h-3.5" /> {totalPendente}
                </span>
              </div>
            </div>
          </div>
          <Progress value={overallProgress} className="h-3" />
        </CardContent>
      </Card>

      {/* Phase pipeline - visual timeline */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pipeline de Fases</h2>

        {/* Horizontal pipeline for desktop */}
        <div className="hidden lg:flex items-center gap-1 overflow-x-auto pb-2">
          {phaseData.map((phase, idx) => (
            <div key={phase.key} className="flex items-center">
              <div className={`relative px-3 py-2 rounded-lg border min-w-[110px] text-center ${phase.lightColor} ${phase.isComplete ? "ring-2 ring-green-400" : ""}`}>
                <p className="text-xs font-medium truncate">{phase.shortLabel}</p>
                <p className="text-lg font-bold">{phase.progress}%</p>
                <p className="text-[10px] text-muted-foreground">{phase.concluido}/{phase.total}</p>
                {phase.isComplete && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              {idx < phaseData.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mx-0.5" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detailed phase cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Detalhe por Fase</h2>
        {phaseData.map(phase => (
          <Card key={phase.key} className={`overflow-hidden ${phase.isComplete ? "border-green-200" : ""}`}>
            <CardContent className="p-0">
              <div className="flex items-stretch">
                {/* Color bar */}
                <div className={`w-1.5 ${phase.color} shrink-0`} />

                <div className="flex-1 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{phase.label}</h3>
                      {phase.isComplete && (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Concluída</Badge>
                      )}
                      {!phase.isComplete && phase.hasActivity && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">Em Curso</Badge>
                      )}
                      {!phase.isComplete && !phase.hasActivity && (
                        <Badge variant="secondary" className="text-xs">Pendente</Badge>
                      )}
                    </div>
                    <span className="text-sm font-bold">{phase.progress}%</span>
                  </div>

                  <Progress value={phase.progress} className="h-2 mb-2" />

                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" /> Concluídas: {phase.concluido}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Em curso: {phase.emCurso}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-300" /> Pendentes: {phase.pendente}
                    </span>
                    <span className="ml-auto font-medium">{phase.total} medidas</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {phaseData.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma fase com medidas encontrada.</p>
        </div>
      )}
    </div>
  );
}
