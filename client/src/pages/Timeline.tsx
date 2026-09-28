import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useBrandImage } from "@/hooks/useBrandImage";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
import PhaseMeasures from "./PhaseMeasures";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Layers,
  Settings,
  EyeOff,
  Eye,
  Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { StandMetricCard } from "@/components/stand/StandMetricCard";
import { StandPageHeader } from "@/components/stand/StandPageHeader";
import { StandStatusBadge } from "@/components/stand/StandStatusBadge";
import {
  DCAPE_MONITORING_PROGRAMMES,
  DCAPE_OTHER_PLANS,
  DCAPE_PHASES,
  getDcapePhaseForLegacyValue,
  type DcapePhaseKey,
} from "@shared/phases";
import { isTimelinePhaseApplicable, phaseLogicalSummary } from "@/lib/dcape-presentation";

type PhaseDef = (typeof PHASE_DEFS)[number];
type PhaseDataItem = PhaseDef & {
  total: number;
  elements: number;
  concluido: number;
  emCurso: number;
  pendente: number;
  progress: number;
  isComplete: boolean;
  hasActivity: boolean;
};

const OPERATION_ONLY_PROJECT_CODES = ["SIN01"];
const PHASE_DEFS = DCAPE_PHASES.map((phase) => ({
  ...phase,
  label: phase.name,
  shortLabel: phase.shortName,
  color: phase.key === "construcao" ? "bg-primary" : "bg-[#6D7A70]",
  lightColor: phase.key === "construcao"
    ? "border-primary/30 bg-primary/10"
    : "border-[#6D7A70]/30 bg-[#EDEBEB]/60",
  textColor: "text-foreground",
}));

function getPhaseColor(phaseKey: string): string {
  const canonicalKey = PHASE_DEFS.find((phase) => phase.key === phaseKey || phase.label === phaseKey)?.key;
  return canonicalKey === "construcao"
    ? "bg-primary text-primary-foreground border-primary"
    : "bg-muted text-foreground border-border";
}

export default function Timeline() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { activeProject, isAllProjects, projects } = useProject();

  const [showSettings, setShowSettings] = useState(false);
  const updatePhaseMutation = trpc.projectPhases.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Fase atualizada");
      projectPhasesQuery.refetch();
    },
  });
  const [activeSubTab, setActiveSubTab] = useState<"timeline" | "fases">(
    "timeline"
  );
  const projectId = activeProject?.id;

  // Fetch the isolated catalogue for the active project.
  const catalogueProjectId = projectId ?? 0;
  const { data: allSections } = trpc.sections.list.useQuery(
    { projectId: catalogueProjectId },
    { enabled: catalogueProjectId > 0 }
  );
  const timelineImage = useBrandImage("timeline");
  const portfolioImage = useBrandImage("timeline_portfolio");
  const { data: allMeasures } = trpc.measures.list.useQuery(
    { projectId: catalogueProjectId },
    { enabled: catalogueProjectId > 0 }
  );

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
  const { data: allProjectsProgress } =
    trpc.phaseMeasures.getAllProjectsProgress.useQuery(undefined, {
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
          result.set(proj.id, "Previamente ao licenciamento");
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
      let currentPhase = "Fase de exploração";
      for (const phase of proj.phases) {
        if (phase.key === "desativacao") continue;
        if (phase.progress < 100) {
          currentPhase = PHASE_DEFS.find((definition) => definition.key === phase.key)?.label || phase.key;
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

    const statusMap: Record<number, { status?: string | null; trackingStatus?: string | null }> = {};
    (phaseStatuses || []).forEach((status: any) => {
      statusMap[status.measureId] = status;
    });

    // Filter phases for operation-only projects
    const isOperationOnly =
      activeProject &&
      OPERATION_ONLY_PROJECT_CODES.includes(activeProject.code);
    const applicablePhases = PHASE_DEFS.filter((phase) =>
      isTimelinePhaseApplicable(activeProject?.code, phase.key),
    );

    return applicablePhases
      .map(phaseDef => {
        const summary = phaseLogicalSummary(allMeasures, phaseDef.key, statusMap);
        const total = summary.total;

        const concluido = summary.concluded;
        const emCurso = summary.inProgress;
        const pendente = total - concluido - emCurso;

        const progress = total > 0 ? Math.round((concluido / total) * 100) : 0;
        const isComplete = concluido === total;
        const hasActivity = concluido > 0 || emCurso > 0;

        const dbPhase = projectPhasesData.find((projectPhase: any) => projectPhase.phaseKey === phaseDef.key);
        return {
          ...phaseDef,
          total,
          elements: summary.elements.length,
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
      })
      .filter(Boolean) as PhaseDataItem[];
  }, [allSections, allMeasures, phaseStatuses, projectPhasesData]);

  // Overall stats
  const visiblePhaseData = phaseData.filter((p: any) => !p.hidden);
  const totalMeasures = visiblePhaseData.reduce((sum, p) => sum + p.total, 0);
  const totalConcluido = visiblePhaseData.reduce(
    (sum, p) => sum + p.concluido,
    0
  );
  const totalEmCurso = visiblePhaseData.reduce((sum, p) => sum + p.emCurso, 0);
  const totalPendente = visiblePhaseData.reduce(
    (sum, p) => sum + p.pendente,
    0
  );
  const overallProgress =
    totalMeasures > 0 ? Math.round((totalConcluido / totalMeasures) * 100) : 0;

  if (!projectId) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto space-y-5">
          <StandPageHeader
            eyebrow="Governança ambiental · portefólio"
            title={t("Timeline do Projeto")}
            description={t(
              "Visão geral do estado de cada projeto e a fase em que se encontra."
            )}
            context={t("Todos os Projetos")}
            tone="governance"
            image={portfolioImage.url}
            imagePosition={portfolioImage.position}
            imageMode={portfolioImage.mode}
          >
            <p className="text-xs font-medium text-white/80">{t("Ciclo de vida dos projetos Start Campus")}</p>
          </StandPageHeader>

          {projects && projects.length > 0 && (
            <section
              aria-label="Estado do portefólio"
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              {projects.map(p => {
                const currentPhase =
                  projectCurrentPhases.get(p.id) || "Previamente ao licenciamento";
                const canonicalPhase = getDcapePhaseForLegacyValue(currentPhase)?.name || currentPhase;
                return (
                  <article
                    key={p.id}
                    className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-[0_10px_28px_hsl(var(--shadow-color)/0.035)] transition-colors hover:border-primary/25"
                  >
                    <div className="mb-4 flex items-start gap-3">
                      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                        {p.code?.slice(0, 4)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.code}
                        </p>
                      </div>
                    </div>
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span className="stand-kicker text-muted-foreground">
                        Fase atual
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getPhaseColor(currentPhase)}`}
                      >
                        {t(canonicalPhase)}
                      </span>
                    </div>
                    {OPERATION_ONLY_PROJECT_CODES.includes(p.code) ? (
                      <div>
                        <div className="h-2.5 rounded-full bg-[#EDEBEB]" />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t("Operação")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div
                          className="flex gap-1"
                          aria-label={`Progresso das fases de ${p.name}`}
                        >
                          {PHASE_DEFS.map(phase => {
                            const phaseProgress =
                              projectPhaseProgress.get(p.id)?.get(phase.key) ??
                              0;
                            const isComplete = phaseProgress === 100;
                            const isCurrent =
                              phaseProgress > 0 && phaseProgress < 100;
                            return (
                              <div
                                key={phase.key}
                                className={`h-2.5 flex-1 rounded-full ${phase.color} ${isComplete ? "opacity-100" : isCurrent ? "opacity-60" : "opacity-15"}`}
                                title={`${t(phase.label)}: ${phaseProgress}%`}
                              />
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("Progresso por fase")}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          )}

          <p className="rounded-xl border border-dashed border-border bg-muted/25 px-4 py-3 text-center text-xs text-muted-foreground">
            {t(
              "Selecione um projeto no menu lateral para ver o detalhe completo da timeline."
            )}
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        <StandPageHeader
          eyebrow="Governança ambiental · medidas"
          title={t("Timeline do Projeto")}
          context={activeProject?.name}
          description={t("Visão geral do cumprimento de medidas por fase")}
          tone="operations"
          image={timelineImage.url}
          imagePosition={timelineImage.position}
          imageMode={timelineImage.mode}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 bg-card/10 text-white hover:bg-card/20 hover:text-white"
                onClick={() =>
                  window.open(
                    `/api/pdf/fases/${projectId}`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                <Download className="mr-1.5 h-4 w-4" />
                Relatório PDF
              </Button>
              {user?.role === "admin" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 bg-card/10 text-white hover:bg-card/20 hover:text-white"
                  onClick={() => setShowSettings(!showSettings)}
                  aria-expanded={showSettings}
                >
                  <Settings className="mr-1.5 h-4 w-4" />
                  {t("Definições")}
                </Button>
              )}
            </>
          }
        >
          <p className="text-xs font-medium text-white/80">{t("Acompanhamento de execução por fase do projeto")}</p>
        </StandPageHeader>
        {/* Sub-navigation: Vista Geral | Fases */}
        <nav
          aria-label="Navegação da timeline"
          className="inline-flex rounded-xl border border-border bg-muted/45 p-1.5 shadow-sm"
        >
          <button
            type="button"
            aria-current={activeSubTab === "timeline" ? "page" : undefined}
            onClick={() => setActiveSubTab("timeline")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${activeSubTab === "timeline" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}
          >
            Vista Geral
          </button>
          <button
            type="button"
            aria-current={activeSubTab === "fases" ? "page" : undefined}
            onClick={() => setActiveSubTab("fases")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${activeSubTab === "fases" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}
          >
            Fases
          </button>
        </nav>

        {/* Render PhaseMeasures inline when Fases tab is active */}
        {activeSubTab === "fases" && <PhaseMeasures embedded />}

        {activeSubTab === "timeline" && (
          <>
            {/* Admin Settings Panel */}
            {showSettings && user?.role === "admin" && (
              <Card className="rounded-2xl border-[#6D7A70]/25 bg-[#EDEBEB]/[0.045] shadow-[0_10px_28px_hsl(var(--shadow-color)/0.035)] dark:bg-[#EDEBEB]/10">
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <Settings className="h-4 w-4" />{" "}
                      {t("Definições da Timeline")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t(
                        "Ocultar fases, definir datas de início/fim (sincroniza com calendário)"
                      )}
                    </p>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {phaseData.map((phase: any) => (
                      <div
                        key={phase.key}
                        className="flex items-center gap-2 rounded-xl border border-border/80 bg-card p-3 text-xs"
                      >
                        <button
                          type="button"
                          aria-label={`${phase.hidden ? "Mostrar" : "Ocultar"} ${t(phase.label)}`}
                          onClick={() =>
                            updatePhaseMutation.mutate({
                              id: phase.dbId || 0,
                              hidden: phase.hidden ? 0 : 1,
                            })
                          }
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {phase.hidden ? (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Eye className="w-4 h-4 text-primary" />
                          )}
                        </button>
                        <span
                          className={`flex-1 font-medium ${phase.hidden ? "line-through text-muted-foreground" : ""}`}
                        >
                          {t(phase.label)}
                        </span>
                        <Input
                          type="date"
                          className="h-8 w-32 text-xs"
                          defaultValue={phase.startDate || ""}
                          onBlur={(e: any) =>
                            updatePhaseMutation.mutate({
                              id: phase.dbId || 0,
                              startDate: e.target.value || undefined,
                            })
                          }
                          placeholder={t("Início")}
                        />
                        <Input
                          type="date"
                          className="h-8 w-32 text-xs"
                          defaultValue={phase.endDate || ""}
                          onBlur={(e: any) =>
                            updatePhaseMutation.mutate({
                              id: phase.dbId || 0,
                              endDate: e.target.value || undefined,
                            })
                          }
                          placeholder="Fim"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <section
              aria-label={t("Progresso Global")}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              <StandMetricCard
                label={t("Progresso Global")}
                value={`${overallProgress}%`}
                detail={`${totalMeasures} ${t("medidas total")}`}
                icon={Layers}
                tone="brand"
              />
              <StandMetricCard
                label={t("Concluídas")}
                value={totalConcluido}
                detail={`${totalMeasures ? Math.round((totalConcluido / totalMeasures) * 100) : 0}% do total`}
                icon={CheckCircle2}
                tone="success"
              />
              <StandMetricCard
                label={t("Em curso")}
                value={totalEmCurso}
                detail={t("Medidas com execução ativa")}
                icon={Clock}
                tone="warning"
              />
              <StandMetricCard
                label={t("Pendentes")}
                value={totalPendente}
                detail={t("Medidas sem atividade registada")}
                icon={AlertCircle}
                tone={totalPendente > 0 ? "neutral" : "success"}
              />
            </section>

            <section className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-[0_12px_30px_hsl(var(--shadow-color)/0.045)] sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="stand-kicker text-primary">
                    {t("Progresso Global")}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {overallProgress}% {t("de execução concluída")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {totalConcluido} {t("Concluídas")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#EDEBEB]" />
                    {totalEmCurso} {t("Em curso")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                    {totalPendente} {t("Pendentes")}
                  </span>
                </div>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </section>

            <section
              aria-labelledby="pipeline-title"
              className="rounded-2xl border border-border/80 bg-card/75 p-4 shadow-[0_10px_28px_hsl(var(--shadow-color)/0.035)] sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="stand-kicker text-primary">Planeamento</p>
                  <h2
                    id="pipeline-title"
                    className="mt-1 text-base font-semibold tracking-tight"
                  >
                    {t("Pipeline de Fases")}
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  {visiblePhaseData.length} fases visíveis
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {visiblePhaseData.map((phase, idx) => (
                  <div
                    key={phase.key}
                    className="flex min-w-[145px] flex-1 items-center gap-2"
                  >
                    <div
                      className={`relative w-full rounded-xl border p-3 ${phase.lightColor} ${phase.isComplete ? "ring-1 ring-emerald-500/50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-xs font-semibold">
                          {t(phase.shortLabel)}
                        </p>
                        {phase.isComplete && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary dark:text-primary" />
                        )}
                      </div>
                      <p className="mt-2 text-xl font-semibold tracking-tight">
                        {phase.progress}%
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {phase.concluido}/{phase.total} {t("medidas")}
                      </p>
                    </div>
                    {idx < visiblePhaseData.length - 1 && (
                      <ArrowRight
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-muted-foreground/55"
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="phase-detail-title" className="space-y-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {[
                  {
                    key: "programas-monitorizacao",
                    title: t("Programas de monitorização"),
                    items: DCAPE_MONITORING_PROGRAMMES,
                    countLabel: "1–7",
                  },
                  {
                    key: "outros-planos-projetos",
                    title: t("Outros Planos/Projetos"),
                    items: DCAPE_OTHER_PLANS,
                    countLabel: "1–13",
                  },
                ].map((group) => (
                  <article
                    key={group.key}
                    className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-[0_10px_28px_hsl(var(--shadow-color)/0.035)] sm:p-5"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="stand-kicker text-primary">DCAPE · {group.countLabel}</p>
                        <h2 className="mt-1 text-base font-semibold tracking-tight">{group.title}</h2>
                      </div>
                      <a className="shrink-0 text-xs font-semibold text-primary hover:underline" href="/planos">
                        {t("Gerir em Planos")} →
                      </a>
                    </div>
                    <ol className="grid gap-1.5 sm:grid-cols-2">
                      {group.items.map((item) => (
                        <li key={item.number} className="flex min-w-0 items-start gap-2 rounded-lg bg-muted/45 px-2.5 py-2 text-xs">
                          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{item.number}</span>
                          <span className="min-w-0 leading-5">{language === "en" ? item.nameEn : item.name}</span>
                          {item.archaeology && <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-semibold text-primary">{t("Arqueologia")}</span>}
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
              <div className="px-1">
                <p className="stand-kicker text-primary">Execução</p>
                <h2
                  id="phase-detail-title"
                  className="mt-1 text-base font-semibold tracking-tight"
                >
                  {t("Detalhe por Fase")}
                </h2>
              </div>
              {visiblePhaseData.map(phase => {
                const phaseStatus = phase.isComplete
                  ? { label: t("Concluída"), tone: "success" as const }
                  : phase.hasActivity
                    ? { label: t("Em Curso"), tone: "warning" as const }
                    : { label: t("Pendente"), tone: "neutral" as const };
                return (
                  <article
                    key={phase.key}
                    className="overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-[0_10px_28px_hsl(var(--shadow-color)/0.035)]"
                  >
                    <div className="flex items-stretch">
                      <div className={`w-1.5 shrink-0 ${phase.color}`} />
                      <div className="min-w-0 flex-1 p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold">
                                {t(phase.label)}
                              </h3>
                              <StandStatusBadge
                                label={phaseStatus.label}
                                tone={phaseStatus.tone}
                              />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {phase.total} {t("medidas")} {t("associadas")}
                              {phase.elements > 0 ? ` · ${phase.elements} ${t("elementos documentais")}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="stand-kicker text-muted-foreground">
                              {t("Progresso Global")}
                            </p>
                            <p className="mt-1 text-2xl font-semibold tracking-tight">
                              {phase.progress}%
                            </p>
                          </div>
                        </div>
                        <Progress
                          value={phase.progress}
                          className="my-4 h-2.5"
                        />
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-primary" />{" "}
                            {t("Concluídas")}: {phase.concluido}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#EDEBEB]" />{" "}
                            {t("Em curso")}: {phase.emCurso}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/55" />{" "}
                            {t("Pendentes")}: {phase.pendente}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/15 bg-primary/[0.045] p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-primary/10">
                          <p className="text-xs leading-5 text-primary dark:text-primary">
                            Responsável, suporte e status updates são definidos
                            individualmente em cada medida.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-xs"
                            onClick={() => setActiveSubTab("fases")}
                          >
                            Ver medidas e responsáveis
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            {visiblePhaseData.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/25 py-12 text-center text-muted-foreground">
                <Layers className="mx-auto mb-3 h-10 w-10 opacity-50" />
                <p className="text-sm">
                  {t("Nenhuma fase com medidas encontrada.")}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
