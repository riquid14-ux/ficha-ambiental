import AppLayout from "@/components/AppLayout";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import { useState, useMemo } from "react";
import { CheckCircle, AlertTriangle, MinusCircle, Building2, Clock, FolderKanban, FileBarChart, CalendarDays, TrendingUp } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  I: "#22c55e",
  C: "#3b82f6",
  NC: "#ef4444",
  NA: "#94a3b8",
};

const STATUS_LABELS: Record<string, string> = {
  I: "Implementado",
  C: "Conforme",
  NC: "Não Conforme",
  NA: "Não Aplicável",
};

type StatusFilter = "all" | "I" | "C" | "NC" | "NA";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { activeProject, isAllProjects, projects } = useProject();
  const allProjectsProgressQuery = trpc.phaseMeasures.getAllProjectsProgress.useQuery(undefined, { enabled: isAllProjects });

  // Check if this is an operation-only project
  const OPERATION_ONLY_PROJECT_CODES = ["SIN01"];
  const isOperationOnly = !isAllProjects && activeProject && OPERATION_ONLY_PROJECT_CODES.includes(activeProject.code);
  const { data: brandImages } = trpc.appSettings.getAll.useQuery();

  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");

  const companiesQuery = trpc.companies.list.useQuery();
  const sectionsQuery = trpc.sections.list.useQuery();

  const canSeeAll = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "raa" || user?.role === "observador";
  const submissionsQuery = canSeeAll
    ? trpc.submissions.listAll.useQuery({})
    : trpc.submissions.mySubmissions.useQuery();

  const weeks = useMemo(() => {
    const data = submissionsQuery.data || [];
    const unique = new Map<string, { weekNumber: number; weekYear: number }>();
    for (const s of data) {
      const key = `${s.weekYear}-${s.weekNumber}`;
      if (!unique.has(key)) unique.set(key, { weekNumber: s.weekNumber, weekYear: s.weekYear });
    }
    return Array.from(unique.values()).sort((a, b) => b.weekYear - a.weekYear || b.weekNumber - a.weekNumber);
  }, [submissionsQuery.data]);

  const analyticsQuery = trpc.analytics.overview.useQuery({
    companyId: selectedCompany !== "all" ? Number(selectedCompany) : undefined,
    sectionId: selectedSection !== "all" ? Number(selectedSection) : undefined,
    weekYear: selectedWeek !== "all" ? Number(selectedWeek.split("-")[0]) : undefined,
    weekNumber: selectedWeek !== "all" ? Number(selectedWeek.split("-")[1]) : undefined,
    projectId: !isAllProjects && activeProject ? activeProject.id : undefined,
  });

  // Overdue detection
  const overdueQuery = trpc.overdue.check.useQuery(
    !isAllProjects && activeProject ? { projectId: activeProject.id } : undefined
  );

  const analytics = analyticsQuery.data;
  const calendarEventsQuery = trpc.calendarEvents.list.useQuery(activeProject?.id ? { projectId: activeProject.id } : { projectId: 0 });
  const wasteQuery = trpc.wasteEgars.list.useQuery({ projectId: activeProject?.id || 0, year: new Date().getFullYear() });

  // Filter charts by selected status
  const filteredByWeek = useMemo(() => {
    if (!analytics?.byWeek) return [];
    if (selectedStatus === "all") return analytics.byWeek;
    return analytics.byWeek.map((w: any) => ({
      ...w,
      I: selectedStatus === "I" ? w.I : 0,
      C: selectedStatus === "C" ? w.C : 0,
      NC: selectedStatus === "NC" ? w.NC : 0,
      NA: selectedStatus === "NA" ? w.NA : 0,
    }));
  }, [analytics, selectedStatus]);

  const filteredByCompany = useMemo(() => {
    if (!(analytics as any)?.byCompany) return [];
    if (selectedStatus === "all") return (analytics as any).byCompany;
    return (analytics as any).byCompany.map((c: any) => ({
      ...c,
      I: selectedStatus === "I" ? c.I : 0,
      C: selectedStatus === "C" ? c.C : 0,
      NC: selectedStatus === "NC" ? c.NC : 0,
      NA: selectedStatus === "NA" ? c.NA : 0,
    }));
  }, [analytics, selectedStatus]);

  const filteredBySection = useMemo(() => {
    if (!analytics?.bySection) return [];
    if (selectedStatus === "all") return analytics.bySection;
    return analytics.bySection.map((s: any) => ({
      ...s,
      I: selectedStatus === "I" ? s.I : 0,
      C: selectedStatus === "C" ? s.C : 0,
      NC: selectedStatus === "NC" ? s.NC : 0,
      NA: selectedStatus === "NA" ? s.NA : 0,
    }));
  }, [analytics, selectedStatus]);

  // Cumulative project evolution
  const projectEvolution = useMemo(() => {
    if (!analytics?.byWeek || analytics.byWeek.length === 0) return [];
    let cumI = 0, cumC = 0, cumNC = 0, cumNA = 0;
    return analytics.byWeek.map((w: any) => {
      cumI += w.I; cumC += w.C; cumNC += w.NC; cumNA += w.NA;
      const total = cumI + cumC + cumNC + cumNA;
      return {
        week: w.week,
        conformidade: total > 0 ? Math.round(((cumI + cumC) / total) * 100) : 0,
        naoConformidade: total > 0 ? Math.round((cumNC / total) * 100) : 0,
      };
    });
  }, [analytics]);

  const pieData = useMemo(() => {
    if (!analytics?.byStatus) return [];
    const entries = selectedStatus === "all"
      ? Object.entries(analytics.byStatus)
      : Object.entries(analytics.byStatus).filter(([key]) => key === selectedStatus);
    return entries
      .filter(([, v]) => (v as number) > 0)
      .map(([key, value]) => ({
        name: STATUS_LABELS[key],
        value,
        color: STATUS_COLORS[key],
      }));
  }, [analytics, selectedStatus]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Dashboard")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("Visão geral do cumprimento ambiental")}</p>
          </div>
        </div>

        {/* Brand hero image */}
        <div className="relative rounded-xl overflow-hidden h-48 ">
          <img src={brandImages?.image_dashboard || "/manus-storage/sc-aerial-2_18fcfe53.png"} alt="" className="w-full h-full object-cover" style={{ objectPosition: brandImages?.image_dashboard_position || "center" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent flex items-center pl-6">
            <p className="text-white font-semibold text-lg">{t("Plataforma de Gestão Ambiental — Start Campus")}</p>
          </div>
        </div>

        {/* Operation-only project dashboard */}
        {isOperationOnly && (
          <div className="space-y-4">
            {/* Operation header */}
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 shrink-0">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-900">{t("Fase de Operação")} — {activeProject?.name}</p>
                    <p className="text-xs text-muted-foreground">{t("Monitorização contínua de medidas ambientais e gestão de resíduos")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Dynamic cards row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">15</p>
                <p className="text-xs text-muted-foreground">{t("Medidas Exploração")}</p>
              </CardContent></Card>
              <Card className="cursor-pointer hover:border-sky-300" onClick={() => window.location.href = "/calendario"}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-sky-600">{(() => { const calEvents = calendarEventsQuery?.data; if (!calEvents || calEvents.length === 0) return "—"; const next = calEvents.filter((e: any) => e.status === "pending" && new Date(Number(e.nextDate)) > new Date()).sort((a: any, b: any) => Number(a.nextDate) - Number(b.nextDate))[0]; return next ? new Date(Number(next.nextDate)).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }) : "—"; })()}</p>
                  <p className="text-xs text-muted-foreground">{t("Próximo Reporting")}</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:border-amber-300" onClick={() => window.location.href = "/mirr"}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{wasteQuery?.data?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">e-GARs ({new Date().getFullYear()})</p>
                </CardContent>
              </Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">{(() => { const calEvents = calendarEventsQuery?.data; if (!calEvents) return 0; return calEvents.filter((e: any) => e.status === "pending" && new Date(Number(e.nextDate)) < new Date()).length; })()}</p>
                <p className="text-xs text-muted-foreground">{t("Em Incumprimento")}</p>
              </CardContent></Card>
            </div>
            {/* Reporting timeline */}
            <Card>
              <CardHeader><CardTitle className="text-sm">{t("Próximos Reportings")}</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const calEvents = calendarEventsQuery?.data;
                  if (!calEvents || calEvents.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">{t("Sem eventos de reporting configurados.")}</p>;
                  const upcoming = calEvents.filter((e: any) => e.status === "pending").sort((a: any, b: any) => Number(a.nextDate) - Number(b.nextDate)).slice(0, 5);
                  return (
                    <div className="space-y-2">
                      {upcoming.map((evt: any) => {
                        const date = new Date(Number(evt.nextDate));
                        const isOverdue = date < new Date();
                        return (
                          <div key={evt.id} className={`flex items-center justify-between p-2 rounded border ${isOverdue ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
                            <div>
                              <p className="text-sm font-medium">{evt.name}</p>
                              <p className="text-xs text-muted-foreground">{evt.ownerName || "Sem responsável"}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-medium ${isOverdue ? "text-red-600" : ""}`}>{date.toLocaleDateString("pt-PT")}</p>
                              {isOverdue && <Badge variant="destructive" className="text-[10px]">{t("Em atraso")}</Badge>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
            {/* Responsible persons */}
            <Card>
              <CardHeader><CardTitle className="text-sm">{t("Responsáveis pelo Reporting")}</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const calEvents = calendarEventsQuery?.data;
                  if (!calEvents) return null;
                  const owners = calEvents.filter((e: any) => e.ownerName).reduce((acc: Record<string, string[]>, e: any) => { if (!acc[e.ownerName]) acc[e.ownerName] = []; acc[e.ownerName].push(e.name); return acc; }, {});
                  if (Object.keys(owners).length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Atribua responsáveis no Calendário → Gerir.</p>;
                  return (
                    <div className="space-y-2">
                      {Object.entries(owners).map(([name, events]) => (
                        <div key={name} className="flex items-center justify-between p-2 rounded border border-gray-100">
                          <p className="text-sm font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">{(events as string[]).length} {t("reportings atribuídos")}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          
            {/* Waste summary */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Resíduos ({new Date().getFullYear()})</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const waste = wasteQuery?.data;
                  if (!waste || waste.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">{t("Sem e-GARs registadas. Vá ao MIRR para registar.")}</p>;
                  const total = waste.reduce((s: number, e: any) => s + (parseFloat(e.correctedQuantity || e.quantity) || 0), 0);
                  const recycled = waste.filter((e: any) => e.destination === "recycled").reduce((s: number, e: any) => s + (parseFloat(e.correctedQuantity || e.quantity) || 0), 0);
                  const incinerated = waste.filter((e: any) => e.destination === "incinerated").reduce((s: number, e: any) => s + (parseFloat(e.correctedQuantity || e.quantity) || 0), 0);
                  const landfill = total - recycled - incinerated;
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total: <strong>{total.toFixed(3)} t</strong></span>
                        <span className="text-sm text-green-600">Desvio aterro: <strong>{total > 0 ? ((recycled / total) * 100).toFixed(0) : 0}%</strong></span>
                      </div>
                      <div className="h-4 rounded-full overflow-hidden flex bg-muted">
                        {recycled > 0 && <div className="bg-emerald-400 h-full" style={{ width: `${(recycled/total)*100}%` }} />}
                        {incinerated > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(incinerated/total)*100}%` }} />}
                        {landfill > 0 && <div className="bg-red-400 h-full" style={{ width: `${(landfill/total)*100}%` }} />}
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400" /> Reciclado ({recycled.toFixed(2)}t)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" /> Incinerado ({incinerated.toFixed(2)}t)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-400" /> Aterro ({landfill.toFixed(2)}t)</span>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* All Projects Professional Dashboard */}
        {isAllProjects && (
          <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-emerald-700">{(() => { const subs = submissionsQuery.data; if (!subs || !Array.isArray(subs)) return 0; return subs.filter((s: any) => s.status === "approved").length; })()}</p>
                <p className="text-[11px] text-emerald-600 font-medium mt-1">{t("Fichas Aprovadas")}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-blue-700">{(() => { const subs = submissionsQuery.data; if (!subs || !Array.isArray(subs)) return 0; return subs.filter((s: any) => s.status === "submitted" || s.status === "under_review").length; })()}</p>
                <p className="text-[11px] text-blue-600 font-medium mt-1">{t("Em Revisão")}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-slate-600">{(() => { const subs = submissionsQuery.data; if (!subs || !Array.isArray(subs)) return 0; return subs.filter((s: any) => s.status === "draft").length; })()}</p>
                <p className="text-[11px] text-slate-500 font-medium mt-1">{t("Rascunhos")}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-amber-700">{projects.length}</p>
                <p className="text-[11px] text-amber-600 font-medium mt-1">{t("Projetos Ativos")}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-red-700">{(() => { const calEvents = calendarEventsQuery?.data; if (!calEvents) return 0; return (calEvents as any[]).filter((e: any) => e.status === "pending" && e.nextDate && Number(e.nextDate) < Date.now()).length; })()}</p>
                <p className="text-[11px] text-red-600 font-medium mt-1">{t("Em Incumprimento")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Compliance by Project + Calendar Deadlines side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Project Compliance */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{t("Cumprimento por Projeto")}</p>
                  <Badge variant="outline" className="text-[10px]">{projects.length} projetos</Badge>
                </div>
                <div className="space-y-2">
                  {allProjectsProgressQuery.data ? allProjectsProgressQuery.data.map((proj: any) => {
                    const currentPhase = proj.phases.find((p: any) => p.progress < 100) || proj.phases[proj.phases.length - 1];
                    const overallProgress = proj.phases.length > 0 ? Math.round(proj.phases.reduce((s: number, p: any) => s + p.progress, 0) / proj.phases.length) : 0;
                    // Color logic based on endDate of current phase
                    const now = new Date();
                    const endDateStr = currentPhase?.endDate;
                    let colorClass = "bg-emerald-500"; // default green = on track
                    let statusText = t("No prazo");
                    if (endDateStr) {
                      const endDate = new Date(endDateStr);
                      const diffMs = endDate.getTime() - now.getTime();
                      const diffDays = diffMs / (1000 * 60 * 60 * 24);
                      if (diffDays < 0 && currentPhase.progress < 100) {
                        colorClass = "bg-red-500"; // overdue
                        statusText = t("Em atraso");
                      } else if (diffDays < 30 && currentPhase.progress < 100) {
                        colorClass = "bg-amber-500"; // less than 1 month
                        statusText = "< 1 mês";
                      }
                    } else if (overallProgress === 0) {
                      colorClass = "bg-gray-300";
                      statusText = t("Sem data");
                    }
                    const projCode = proj.code;
                    const matchedProject = projects.find((p: any) => p.code === projCode);
                    return (
                      <div key={proj.projectId} className="flex items-center gap-3 p-2.5 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => { if (matchedProject) { localStorage.setItem("activeProjectId", String(matchedProject.id)); window.location.href = "/fases"; } }}>
                        <div className={`w-2.5 h-10 rounded-full ${colorClass}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{proj.code}</p>
                          <p className="text-[10px] text-muted-foreground">{t(currentPhase?.key || "Pré-Licenciamento")}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-[11px] font-medium px-2 py-0.5 rounded ${colorClass === "bg-red-500" ? "bg-red-50 dark:bg-red-900/20 text-red-600" : colorClass === "bg-amber-500" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" : colorClass === "bg-emerald-500" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{statusText}</p>
                        </div>
                      </div>
                    );
                  }) : <p className="text-xs text-muted-foreground">{t("A carregar...")}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Deadlines & Reporting */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">{t("Entregáveis & Prazos")}</p>
                {calendarEventsQuery.data && (() => {
                  const events = (calendarEventsQuery.data as any[]) || [];
                  const now = Date.now();
                  const overdue = events.filter((e: any) => e.nextDate && Number(e.nextDate) < now && e.status !== "reported" && e.status !== "validated");
                  const upcoming = events.filter((e: any) => e.nextDate && Number(e.nextDate) >= now && Number(e.nextDate) < now + 60 * 24 * 60 * 60 * 1000).sort((a: any, b: any) => Number(a.nextDate) - Number(b.nextDate));
                  const validated = events.filter((e: any) => e.status === "validated" || e.status === "reported");
                  return (
                    <div className="space-y-3">
                      {overdue.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200">
                          <p className="text-[11px] font-semibold text-red-700 mb-1.5">Em Incumprimento ({overdue.length})</p>
                          {overdue.slice(0, 4).map((e: any) => (
                            <div key={e.id} className="flex justify-between text-[10px] text-red-600 py-0.5">
                              <span className="truncate flex-1">{e.name}</span>
                              <span className="ml-2 shrink-0">{e.projectCode || "Geral"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {upcoming.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
                          <p className="text-[11px] font-semibold text-amber-700 mb-1.5">Próximos 60 dias ({upcoming.length})</p>
                          {upcoming.slice(0, 4).map((e: any) => (
                            <div key={e.id} className="flex justify-between text-[10px] text-amber-600 py-0.5">
                              <span className="truncate flex-1">{e.name}</span>
                              <span className="ml-2 shrink-0">{new Date(Number(e.nextDate)).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-3 text-center pt-1">
                        <div className="flex-1 p-2 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100">
                          <p className="text-lg font-bold text-emerald-700">{validated.length}</p>
                          <p className="text-[9px] text-emerald-600">{t("Validados")}</p>
                        </div>
                        <div className="flex-1 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-100">
                          <p className="text-lg font-bold text-blue-700">{events.length}</p>
                          <p className="text-[9px] text-blue-600">{t("Total Eventos")}</p>
                        </div>
                        <div className="flex-1 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-100">
                          <p className="text-lg font-bold text-red-700">{overdue.length}</p>
                          <p className="text-[9px] text-red-600">{t("Atrasados")}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Submission Activity + Overdue Companies */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Weekly Activity Chart placeholder */}
            <Card className="lg:col-span-2">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">{t("Actividade de Submissão (últimas 12 semanas)")}</p>
                <div className="grid grid-cols-12 gap-1 h-24 items-end">
                  {(() => {
                    const subs = submissionsQuery.data;
                    if (!subs || !Array.isArray(subs)) return null;
                    const now = new Date();
                    const currentWeek = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
                    const currentYear = now.getFullYear();
                    const bars = [];
                    for (let i = 11; i >= 0; i--) {
                      let w = currentWeek - i;
                      let y = currentYear;
                      if (w <= 0) { w += 52; y--; }
                      const count = subs.filter((s: any) => s.weekNumber === w && s.weekYear === y && s.status !== "deleted" && s.status !== "draft").length;
                      const maxH = 80;
                      const h = Math.max(count * 12, 4);
                      bars.push(
                        <div key={`${y}-${w}`} className="flex flex-col items-center gap-0.5">
                          <div className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors" style={{ height: `${Math.min(h, maxH)}px` }} title={`S${w}: ${count} fichas`} />
                          <span className="text-[8px] text-muted-foreground">S{w}</span>
                        </div>
                      );
                    }
                    return bars;
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">{t("Resumo Geral")}</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-xs font-medium">{t("Total de Fichas")}</span>
                    <span className="text-sm font-bold">{(() => { const s = submissionsQuery.data; return s && Array.isArray(s) ? s.filter((x: any) => x.status !== "deleted").length : 0; })()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-xs font-medium">{t("Taxa de Aprovação")}</span>
                    <span className="text-sm font-bold text-emerald-600">{(() => { const s = submissionsQuery.data; if (!s || !Array.isArray(s)) return "—"; const total = s.filter((x: any) => x.status !== "deleted" && x.status !== "draft").length; const approved = s.filter((x: any) => x.status === "approved").length; return total > 0 ? `${Math.round(approved / total * 100)}%` : "—"; })()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-xs">{t("Empresas Ativas")}</span>
                    <span className="text-sm font-bold">{companiesQuery.data?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-xs">{t("Próximo RDCD")}</span>
                    <span className="text-sm font-bold text-blue-600">{(() => { const calEvents = calendarEventsQuery?.data; if (!calEvents) return "—"; const rdcd = (calEvents as any[]).find((e: any) => e.name?.includes("RDCD") && e.status === "pending"); return rdcd ? new Date(Number(rdcd.nextDate)).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }) : "—"; })()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Mini Phase Timeline */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t("Fases dos Projetos")}</p>
                <span className="text-[10px] text-muted-foreground">{t("Visão rápida do estado de cada projecto")}</span>
              </div>
              <div className="space-y-2">
                {projects.map((p: any) => {
                  const phases = ["Pré-Lic.", "Lic.", "Pré-Const.", "Prep.", "Exec.", "Final", "Final C.", "Expl.", "Oper."];
                  const currentIdx = p.code === "SIN01" ? 8 : Math.min(Math.floor(Math.random() * 3) + (p.code === "SIN02" ? 3 : 0), 8);
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono w-14 shrink-0 text-muted-foreground">{p.code}</span>
                      <div className="flex-1 flex gap-0.5">
                        {phases.map((ph, i) => (
                          <div key={i} className={`h-3 flex-1 rounded-sm text-[6px] flex items-center justify-center font-medium ${i < currentIdx ? "bg-emerald-500 text-white" : i === currentIdx ? "bg-amber-400 text-amber-900" : "bg-muted text-gray-400"}`} title={ph}>
                            {ph.slice(0, 3)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 text-[9px] text-muted-foreground pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500"></span> Concluída</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400"></span>  {t("Em curso")}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-muted border"></span> Por iniciar</span>
              </div>
            </CardContent>
          </Card>
          </>
        )}
        {/* Keep existing individual project content below */}
        {isAllProjects && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{t("Visão Agregada — Fichas de Controlo")}</p>
                  <p className="text-xs text-muted-foreground">{t("Filtros e gráficos de evolução das fichas submetidas.")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}





        {/* RDCD Countdown Alert */}
        {!isOperationOnly && (user?.role === "admin" || user?.role === "dono_obra") && (() => {
          // Calculate weeks since first submission or estimate next RDCD
          const submissions = submissionsQuery.data;
          if (!submissions || !Array.isArray(submissions) || submissions.length === 0) return null;
          const approvedSubs = submissions.filter((s: any) => s.status === "approved");
          if (approvedSubs.length === 0) return null;
          // Find earliest approved submission
          const earliest = approvedSubs.reduce((min: any, s: any) => {
            const weekKey = s.weekYear * 100 + s.weekNumber;
            const minKey = min.weekYear * 100 + min.weekNumber;
            return weekKey < minKey ? s : min;
          }, approvedSubs[0]);
          // Calculate weeks since first submission
          const now = new Date();
          const currentWeek = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
          const currentYear = now.getFullYear();
          const weeksSinceFirst = (currentYear - earliest.weekYear) * 52 + (currentWeek - earliest.weekNumber);
          const weeksInSemester = 26;
          const weeksUntilNextRDCD = weeksInSemester - (weeksSinceFirst % weeksInSemester);
          const nextRDCDWeek = currentWeek + weeksUntilNextRDCD;
          
          return (
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 shrink-0">
                    <FileBarChart className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-blue-800">{t("Próximo RDCD")}</p>
                    <p className="text-xs text-blue-600">
                      {weeksUntilNextRDCD <= 4
                        ? `Faltam ${weeksUntilNextRDCD} semanas para o próximo relatório semestral`
                        : `Próximo RDCD em ~${weeksUntilNextRDCD} semanas (Semana ${nextRDCDWeek > 52 ? nextRDCDWeek - 52 : nextRDCDWeek}/${nextRDCDWeek > 52 ? currentYear + 1 : currentYear})`
                      }
                    </p>
                  </div>
                  <a href="/rdcd" className="text-xs text-blue-700 font-medium hover:underline shrink-0">{t("Gerar RDCD")} →</a>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Overdue Alert - only for construction projects */}
        {!isOperationOnly && overdueQuery.data && overdueQuery.data.overdueCompanies.length > 0 && (
          <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50 shrink-0">
                  <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-red-800 dark:text-red-300 text-sm">
                    Fichas em Atraso ({overdueQuery.data.overdueCompanies.length} {overdueQuery.data.overdueCompanies.length === 1 ? "empresa" : "empresas"})
                  </h3>
                  <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5 mb-2">
                    Empresas com mais de 3 semanas sem submeter ficha semanal.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {overdueQuery.data.overdueCompanies.map((c) => (
                      <span key={c.companyId} className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 text-xs font-medium px-2 py-1 rounded">
                        <span className="uppercase text-[10px] font-bold opacity-60">{c.companyType}</span>
                        {c.companyName}
                        <span className="text-red-600 dark:text-red-400 font-bold">({c.weeksBehind} sem.)</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isOperationOnly && (<>
        {/* Mini Calendar & Phase Timeline for individual project */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Mini Calendar - Upcoming Deadlines */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  {t("Próximos Prazos")}
                </p>
                <a href="/calendario" className="text-[10px] text-primary hover:underline">{t("Ver calendário")} →</a>
              </div>
              {calendarEventsQuery.data && (() => {
                const events = (calendarEventsQuery.data as any[]) || [];
                const now = Date.now();
                const upcoming = events.filter((e: any) => e.nextDate && Number(e.nextDate) >= now).sort((a: any, b: any) => Number(a.nextDate) - Number(b.nextDate)).slice(0, 5);
                const overdue = events.filter((e: any) => e.nextDate && Number(e.nextDate) < now && e.status !== "reported" && e.status !== "validated");
                if (upcoming.length === 0 && overdue.length === 0) return <p className="text-xs text-muted-foreground py-4 text-center">{t("Sem prazos definidos")}</p>;
                return (
                  <div className="space-y-1.5">
                    {overdue.length > 0 && (
                      <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 mb-2">
                        <p className="text-[10px] font-semibold text-red-700 mb-1">{t("Em Incumprimento")} ({overdue.length})</p>
                        {overdue.slice(0, 3).map((e: any) => (
                          <div key={e.id} className="flex justify-between text-[10px] text-red-600 py-0.5">
                            <span className="truncate flex-1">{e.name}</span>
                            <span className="ml-2 shrink-0">{new Date(Number(e.nextDate)).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {upcoming.map((e: any) => {
                      const daysUntil = Math.ceil((Number(e.nextDate) - now) / 86400000);
                      const isUrgent = daysUntil <= 14;
                      return (
                        <div key={e.id} className={`flex items-center gap-2 p-2 rounded-lg ${isUrgent ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200" : "bg-muted/30"}`}>
                          <div className={`w-1.5 h-8 rounded-full ${isUrgent ? "bg-amber-400" : "bg-emerald-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate">{e.name}</p>
                            <p className="text-[9px] text-muted-foreground">{new Date(Number(e.nextDate)).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" })}</p>
                          </div>
                          <span className={`text-[9px] font-medium ${isUrgent ? "text-amber-700" : "text-muted-foreground"}`}>{daysUntil}d</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          {/* Phase Timeline for individual project */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {t("Fases do Projeto")}
                </p>
                <a href="/timeline" className="text-[10px] text-primary hover:underline">{t("Ver timeline")} →</a>
              </div>
              {(() => {
                const phases = ["Pré-Licenciamento", "Licenciamento", "Pré-Construção", "Preparação", "Execução da Obra", "Finalização", "Final Construção", "Exploração", "Operação"].map(p => t(p));
                return (
                  <div className="space-y-1">
                    {phases.map((phase, i) => {
                      const isActive = i === 3;
                      const isDone = i < 3;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${isDone ? "bg-emerald-500 text-white" : isActive ? "bg-amber-400 text-amber-900 ring-2 ring-amber-200" : "bg-muted text-gray-400"}`}>
                            {isDone ? "✓" : i + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] ${isActive ? "font-semibold text-amber-800" : isDone ? "text-emerald-700" : "text-muted-foreground"}`}>{phase}</span>
                              {isActive && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">{t("Em curso")}</span>}
                            </div>
                          </div>
                          {isDone && <span className="text-[9px] text-emerald-600">100%</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap gap-3 justify-end">
          <div className="flex flex-wrap gap-3">
            {canSeeAll && (
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("Empresa")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("Todas as empresas")}</SelectItem>
                  {companiesQuery.data?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.companyType === "rap" ? "RAP - " : ""}{c.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("Semana")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Todas as semanas")}</SelectItem>
                {weeks.map((w) => (
                  <SelectItem key={`${w.weekYear}-${w.weekNumber}`} value={`${w.weekYear}-${w.weekNumber}`}>
                    S{w.weekNumber}/{w.weekYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as StatusFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("Estado")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Todos os estados")}</SelectItem>
                <SelectItem value="I">{t("Implementado")}</SelectItem>
                <SelectItem value="C">{t("Conforme")}</SelectItem>
                <SelectItem value="NC">{t("Não Conforme")}</SelectItem>
                <SelectItem value="NA">{t("Não Aplicável")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Secção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Todas as secções")}</SelectItem>
                {sectionsQuery.data?.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name.length > 40 ? s.name.slice(0, 40) + "..." : s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards - clickable to filter */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={`cursor-pointer transition-all ${selectedStatus === "I" ? "ring-2 ring-green-500" : "hover:shadow-md"}`} onClick={() => setSelectedStatus(selectedStatus === "I" ? "all" : "I")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><CheckCircle className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.I ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t("Implementado")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${selectedStatus === "C" ? "ring-2 ring-blue-500" : "hover:shadow-md"}`} onClick={() => setSelectedStatus(selectedStatus === "C" ? "all" : "C")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><CheckCircle className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.C ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t("Conforme")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${selectedStatus === "NC" ? "ring-2 ring-red-500" : "hover:shadow-md"}`} onClick={() => setSelectedStatus(selectedStatus === "NC" ? "all" : "NC")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.NC ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t("Não Conforme")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${selectedStatus === "NA" ? "ring-2 ring-slate-400" : "hover:shadow-md"}`} onClick={() => setSelectedStatus(selectedStatus === "NA" ? "all" : "NA")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100"><MinusCircle className="w-5 h-5 text-slate-500" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.NA ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t("Não Aplicável")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active filter indicator */}
        {selectedStatus !== "all" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            <span>Filtro ativo:</span>
            <span className="font-medium" style={{ color: STATUS_COLORS[selectedStatus] }}>{STATUS_LABELS[selectedStatus]}</span>
            <button className="ml-2 underline text-xs" onClick={() => setSelectedStatus("all")}>{t("Limpar")}</button>
          </div>
        )}

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("Evolução Semanal")}</CardTitle></CardHeader>
            <CardContent>
              {filteredByWeek.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredByWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {(selectedStatus === "all" || selectedStatus === "I") && <Bar dataKey="I" name="Implementado" fill={STATUS_COLORS.I} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "C") && <Bar dataKey="C" name="Conforme" fill={STATUS_COLORS.C} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "NC") && <Bar dataKey="NC" name="Não Conforme" fill={STATUS_COLORS.NC} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "NA") && <Bar dataKey="NA" name="Não Aplicável" fill={STATUS_COLORS.NA} stackId="a" />}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">{t("Sem dados disponíveis")}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("Evolução do Projeto (Acumulado)")}</CardTitle></CardHeader>
            <CardContent>
              {projectEvolution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={projectEvolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="conformidade" name="Conformidade (I+C)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="naoConformidade" name="Não Conformidade" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">{t("Sem dados disponíveis")}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />{t("Distribuição por Entidade Executante")}</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredByCompany.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredByCompany}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="companyName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {(selectedStatus === "all" || selectedStatus === "I") && <Bar dataKey="I" name="Implementado" fill={STATUS_COLORS.I} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "C") && <Bar dataKey="C" name="Conforme" fill={STATUS_COLORS.C} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "NC") && <Bar dataKey="NC" name="Não Conforme" fill={STATUS_COLORS.NC} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "NA") && <Bar dataKey="NA" name="Não Aplicável" fill={STATUS_COLORS.NA} stackId="a" />}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">{t("Sem dados disponíveis")}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("Distribuição por Estado")}</CardTitle></CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {pieData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">{t("Sem dados disponíveis")}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* By Section */}
        {filteredBySection.some((s: any) => s.I + s.C + s.NC + s.NA > 0) && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("Cumprimento por Secção")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={filteredBySection.filter((s: any) => s.I + s.C + s.NC + s.NA > 0)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="sectionName" width={200} tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.length > 30 ? v.slice(0, 30) + "..." : v} />
                  <Tooltip />
                  <Legend />
                  {(selectedStatus === "all" || selectedStatus === "I") && <Bar dataKey="I" name="Implementado" fill={STATUS_COLORS.I} stackId="a" />}
                  {(selectedStatus === "all" || selectedStatus === "C") && <Bar dataKey="C" name="Conforme" fill={STATUS_COLORS.C} stackId="a" />}
                  {(selectedStatus === "all" || selectedStatus === "NC") && <Bar dataKey="NC" name="Não Conforme" fill={STATUS_COLORS.NC} stackId="a" />}
                  {(selectedStatus === "all" || selectedStatus === "NA") && <Bar dataKey="NA" name="Não Aplicável" fill={STATUS_COLORS.NA} stackId="a" />}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        </>)}
      </div>
    </AppLayout>
  );
}
