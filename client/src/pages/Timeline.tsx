import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
import PhaseMeasures from "./PhaseMeasures";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, Layers, Settings, EyeOff, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

type PhaseDef = typeof PHASE_DEFS[number];
type PhaseDataItem = PhaseDef & { total: number; concluido: number; emCurso: number; pendente: number; progress: number; isComplete: boolean; hasActivity: boolean };

// Phase definitions matching the database
// Construction sub-phases that should be labelled "Construção" in the all-projects view
const CONSTRUCTION_PHASE_KEYS = ["Preparação Prévia", "Execução da Obra", "Fase Final"];

// Simplified phase labels for the all-projects badge
function getSimplifiedPhaseLabel(phaseKey: string): string {
  if (CONSTRUCTION_PHASE_KEYS.includes(phaseKey)) return "Construção";
  const def = PHASE_DEFS.find(p => p.key === phaseKey);
  return def?.label || phaseKey; // will be wrapped with t() at render
}

function getPhaseColor(phaseKey: string): string {
  if (CONSTRUCTION_PHASE_KEYS.includes(phaseKey)) return "bg-emerald-100 text-emerald-800 dark:text-emerald-100 border-emerald-300";
  const def = PHASE_DEFS.find(p => p.key === phaseKey);
  if (!def) return "bg-muted text-foreground";
  return def.lightColor + " " + def.textColor;
}

// Projects that are operation-only (no construction phase)
const OPERATION_ONLY_PROJECT_CODES = ["SIN01"];
const OPERATION_PHASES = ["Exploração", "Desativação (Pós-Exploração)"];

const PHASE_DEFS = [
  { key: "Prévias Licenciamento", label: "Pré-Licenciamento", shortLabel: "Pré-Lic.", color: "bg-purple-500", lightColor: "bg-purple-50 dark:bg-purple-900/20 border-purple-200", textColor: "text-purple-700" },
  { key: "Em Sede de Licenciamento", label: "Licenciamento", shortLabel: "Lic.", color: "bg-blue-500", lightColor: "bg-blue-50 dark:bg-blue-900/20 border-blue-200", textColor: "text-blue-700" },
  { key: "Pré-Construção", label: "Pré-Construção", shortLabel: "Pré-Const.", color: "bg-cyan-500", lightColor: "bg-cyan-50 border-cyan-200", textColor: "text-cyan-700" },
  { key: "Preparação Prévia", label: "Construção (Preparação)", shortLabel: "Prep.", color: "bg-emerald-400", lightColor: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200", textColor: "text-emerald-700" },
  { key: "Execução da Obra", label: "Construção (Execução)", shortLabel: "Exec.", color: "bg-emerald-500", lightColor: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200", textColor: "text-emerald-700" },
  { key: "Fase Final", label: "Construção (Final)", shortLabel: "Final", color: "bg-emerald-600", lightColor: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200", textColor: "text-emerald-700" },
  { key: "Fase Final Construção", label: "Final da Construção", shortLabel: "Final Const.", color: "bg-amber-500", lightColor: "bg-amber-50 dark:bg-amber-900/20 border-amber-200", textColor: "text-amber-700" },
  { key: "Exploração", label: "Exploração", shortLabel: "Expl.", color: "bg-orange-500", lightColor: "bg-orange-50 dark:bg-orange-900/20 border-orange-200", textColor: "text-orange-700" },
  { key: "Desativação (Pós-Exploração)", label: "Desativação", shortLabel: "Desat.", color: "bg-muted0", lightColor: "bg-muted border-border", textColor: "text-foreground" },
];

export default function Timeline() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeProject, isAllProjects, projects } = useProject();

  const [showSettings, setShowSettings] = useState(false);
  const updatePhaseMutation = trpc.projectPhases.updateSettings.useMutation({ onSuccess: () => { toast.success("Fase atualizada"); projectPhasesQuery.refetch(); } });
  const [activeSubTab, setActiveSubTab] = useState<"timeline" | "fases">("timeline");
  const projectId = activeProject?.id;

  // Fetch all sections and measures
  const { data: allSections } = trpc.sections.list.useQuery();
  const { data: brandImages } = trpc.appSettings.getAll.useQuery();
  const { data: allMeasures } = trpc.measures.list.useQuery();

  // Fetch phase measure statuses for the selected project
  const { data: phaseStatuses } = trpc.phaseMeasures.getStatuses.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const projectPhasesQuery = trpc.projectPhases.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const projectPhasesData = projectPhasesQuery.data || [];

  // Fetch all projects progress from backend (single endpoint)
  const { data: allProjectsProgress } = trpc.phaseMeasures.getAllProjectsProgress.useQuery(undefined, {
    enabled: !projectId, // only fetch when in all-projects view
  });

  // Compute current phase for each project based on real backend data
  const projectCurrentPhases = useMemo(() => {
    const result = new Map<number, string>();
    if (!allProjectsProgress) {
      // Default while loading
      for (const proj of projects) {
        if (OPERATION_ONLY_PROJECT_CODES.includes(proj.code)) {
          result.set(proj.id, "Operação");
        } else {
          result.set(proj.id, "Pré-Licenciamento");
        }
      }
      return result;
    }

    for (const proj of allProjectsProgress) {
      if (OPERATION_ONLY_PROJECT_CODES.includes(proj.code)) {
        result.set(proj.projectId, "Operação");
        continue;
      }
      // Find the first phase that is NOT at 100%
      let currentPhase = "Operação"; // if all are 100%, project is in operation
      for (const phase of proj.phases) {
        if (phase.key === "Desativação (Pós-Exploração)") continue;
        if (phase.progress < 100) {
          currentPhase = getSimplifiedPhaseLabel(phase.key);
          break;
        }
      }
      result.set(proj.projectId, currentPhase);
    }
    return result;
  }, [allProjectsProgress, projects]);

  // Phase progress per project (for the mini-bars)
  const projectPhaseProgress = useMemo(() => {
    const result = new Map<number, Map<string, number>>();
    if (!allProjectsProgress) return result;
    for (const proj of allProjectsProgress) {
      const phaseMap = new Map<string, number>();
      for (const phase of proj.phases) {
        phaseMap.set(phase.key, phase.progress);
      }
      result.set(proj.projectId, phaseMap);
    }
    return result;
  }, [allProjectsProgress]);

  // Compute compliance per phase
  const phaseData = useMemo(() => {
    if (!allSections || !allMeasures) return [];

    const statusMap = new Map<number, string>();
    (phaseStatuses || []).forEach(s => statusMap.set(s.measureId, s.status));

    // Filter phases for operation-only projects
    const isOperationOnly = activeProject && OPERATION_ONLY_PROJECT_CODES.includes(activeProject.code);
    const applicablePhases = isOperationOnly
      ? PHASE_DEFS.filter(p => OPERATION_PHASES.includes(p.key))
      : PHASE_DEFS;

    return applicablePhases.map(phaseDef => {
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

      // Merge DB data (hidden, dates, dbId)
      // Match DB phase using multiple strategies (phaseKey, phaseName, or normalized comparison)
      const normalizeKey = (s: string) => s.toLowerCase().replace(/[áàã]/g, "a").replace(/[éè]/g, "e").replace(/[íì]/g, "i").replace(/[óòõ]/g, "o").replace(/[úù]/g, "u").replace(/[^a-z0-9]/g, "");
      const defNorm = normalizeKey(phaseDef.key);
      const dbPhase = projectPhasesData.find((pp: any) => 
        pp.phaseName === phaseDef.key || pp.phaseKey === phaseDef.key ||
        normalizeKey(pp.phaseName) === defNorm || normalizeKey(pp.phaseKey) === defNorm ||
        // Handle specific mismatches
        (phaseDef.key === "Prévias Licenciamento" && (pp.phaseKey === "previas_licenciamento" || pp.phaseName?.includes("Licenciamento") && pp.phaseName?.includes("Previamente"))) ||
        (phaseDef.key === "Desativação (Pós-Exploração)" && (pp.phaseKey === "desativacao" || pp.phaseName === "Desativação")) ||
        (phaseDef.key === "Execução da Obra" && (pp.phaseKey === "execucao_obra" || pp.phaseKey === "construcao"))
      );
      return {
      ...phaseDef,
      total,
      concluido,
      emCurso,
      pendente,
      progress,
      isComplete,
      hasActivity,
      dbId: dbPhase?.id || 0,
      hidden: dbPhase?.hidden || false,
      startDate: dbPhase?.startDate || null,
      endDate: dbPhase?.endDate || null,
    };
    }).filter(Boolean) as PhaseDataItem[];
  }, [allSections, allMeasures, phaseStatuses, projectPhasesData]);

  // Overall stats
  const visiblePhaseData = phaseData.filter((p: any) => !p.hidden);
  const totalMeasures = visiblePhaseData.reduce((sum, p) => sum + p.total, 0);
  const totalConcluido = visiblePhaseData.reduce((sum, p) => sum + p.concluido, 0);
  const totalEmCurso = visiblePhaseData.reduce((sum, p) => sum + p.emCurso, 0);
  const totalPendente = visiblePhaseData.reduce((sum, p) => sum + p.pendente, 0);
  const overallProgress = totalMeasures > 0 ? Math.round((totalConcluido / totalMeasures) * 100) : 0;

  if (!projectId) {
    return (
      <AppLayout><div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
          <Layers className="w-6 h-6" /> Timeline do Projeto
        </h1>
        <p className="text-muted-foreground">{t("Visão geral do estado de cada projeto e a fase em que se encontra.")}</p>

        {/* Brand image */}
        <div className="relative rounded-xl overflow-hidden h-44">
          <img src="https://www.startcampus.pt/hubfs/Images/Webiste/Start_Campus__%20(17).jpg" alt="Start Campus" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-end pb-4 pl-5">
            <p className="text-white text-sm font-medium">{t("Ciclo de vida dos projetos Start Campus")}</p>
          </div>
        </div>

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
                    <Badge className={`text-xs border ${getPhaseColor(projectCurrentPhases.get(p.id) || "Pré-Licenciamento")}`}>
                      {projectCurrentPhases.get(p.id) || "Pré-Licenciamento"}
                    </Badge>
                  </div>
                  {/* Phase progress mini-bar */}
                  {OPERATION_ONLY_PROJECT_CODES.includes(p.code) ? (
                    <div className="flex gap-1">
                      <div className="flex-1">
                        <div className="h-2.5 rounded-full bg-orange-500" />
                        <p className="text-[9px] text-center text-muted-foreground mt-0.5">{t("Operação")}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-0.5">
                      {PHASE_DEFS.filter(ph => ph.key !== "Desativação (Pós-Exploração)").map((phase) => {
                        // Use real progress data from backend
                        const phaseProgress = projectPhaseProgress.get(p.id)?.get(phase.key) ?? 0;
                        const isComplete = phaseProgress === 100;
                        const isCurrent = phaseProgress > 0 && phaseProgress < 100;
                        return (
                          <div key={phase.key} className="flex-1">
                            <div className={`h-2 rounded-full ${phase.color} ${isComplete ? "opacity-100" : isCurrent ? "opacity-60" : "opacity-15"}`} title={`${t(phase.label)}: ${phaseProgress}%`} />
                            <p className="text-[8px] text-center text-muted-foreground mt-0.5 truncate">{t(phase.shortLabel)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">{t("Selecione um projeto no menu lateral para ver o detalhe completo da timeline.")}</p>
      </div></AppLayout>
    );
  }

  return (
    <AppLayout><div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        {/* Brand banner */}
        <div className="relative rounded-xl overflow-hidden h-32 mb-4 ">
          <img src={brandImages?.image_timeline || "/manus-storage/sc-datacenter-1_78c8d65f.jpg"} alt="" className="w-full h-full object-cover" style={{ objectPosition: brandImages?.image_timeline_position || "center" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-900/50 to-transparent" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="w-6 h-6" /> Timeline do Projeto
            </h1>
            <p className="text-muted-foreground text-sm">
              Visão geral do cumprimento de medidas por fase — {activeProject?.name}
            </p>
          </div>
          {user?.role === "admin" && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="w-4 h-4 mr-1" /> Definições
            </Button>
          )}
        </div>
      </div>
      {/* Sub-navigation: Vista Geral | Fases */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveSubTab("timeline")}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${activeSubTab === "timeline" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Vista Geral
        </button>
        <button
          onClick={() => setActiveSubTab("fases")}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${activeSubTab === "fases" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Fases
        </button>
      </div>

      {/* Render PhaseMeasures inline when Fases tab is active */}
      {activeSubTab === "fases" && (
        <PhaseMeasures embedded />
      )}

      {activeSubTab === "timeline" && (<>

      {/* Admin Settings Panel */}
      {showSettings && user?.role === "admin" && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1"><Settings className="w-4 h-4" /> {t("Definições da Timeline")}</p>
            <p className="text-xs text-muted-foreground">{t("Ocultar fases, definir datas de início/fim (sincroniza com calendário)")}</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {phaseData.map((phase: any) => (
                <div key={phase.key} className="flex items-center gap-2 p-2 border rounded bg-background text-xs">
                  <button onClick={() => updatePhaseMutation.mutate({ id: phase.dbId || 0, hidden: phase.hidden ? 0 : 1 })} className="shrink-0">
                    {phase.hidden ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-green-600" />}
                  </button>
                  <span className={`flex-1 font-medium ${phase.hidden ? "line-through text-gray-400" : ""}`}>{t(phase.label)}</span>
                  <Input type="date" className="w-32 h-7 text-xs" defaultValue={phase.startDate || ""} onBlur={(e: any) => updatePhaseMutation.mutate({ id: phase.dbId || 0, startDate: e.target.value || undefined })} placeholder="Início" />
                  <Input type="date" className="w-32 h-7 text-xs" defaultValue={phase.endDate || ""} onBlur={(e: any) => updatePhaseMutation.mutate({ id: phase.dbId || 0, endDate: e.target.value || undefined })} placeholder="Fim" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Overall progress card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">{t("Progresso Global")}</p>
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
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("Pipeline de Fases")}</h2>

        {/* Horizontal pipeline for desktop */}
        <div className="hidden lg:flex items-center gap-1 overflow-x-auto pb-2">
          {visiblePhaseData.map((phase, idx) => (
            <div key={phase.key} className="flex items-center">
              <div className={`relative px-3 py-2 rounded-lg border min-w-[110px] text-center ${phase.lightColor} ${phase.isComplete ? "ring-2 ring-green-400" : ""}`}>
                <p className="text-xs font-medium truncate">{t(phase.shortLabel)}</p>
                <p className="text-lg font-bold">{phase.progress}%</p>
                <p className="text-[10px] text-muted-foreground">{phase.concluido}/{phase.total}</p>
                {phase.isComplete && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              {idx < visiblePhaseData.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mx-0.5" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detailed phase cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("Detalhe por Fase")}</h2>
        {visiblePhaseData.map(phase => (
          <Card key={phase.key} className={`overflow-hidden ${phase.isComplete ? "border-green-200" : ""}`}>
            <CardContent className="p-0">
              <div className="flex items-stretch">
                {/* Color bar */}
                <div className={`w-1.5 ${phase.color} shrink-0`} />

                <div className="flex-1 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{t(phase.label)}</h3>
                      {phase.isComplete && (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">{t("Concluída")}</Badge>
                      )}
                      {!phase.isComplete && phase.hasActivity && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">{t("Em Curso")}</Badge>
                      )}
                      {!phase.isComplete && !phase.hasActivity && (
                        <Badge variant="secondary" className="text-xs">{t("Pendente")}</Badge>
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

      {visiblePhaseData.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t("Nenhuma fase com medidas encontrada.")}</p>
        </div>
      )}
      </>)}
    </div>
  </AppLayout>);
}
