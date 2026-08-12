import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import { useState, useMemo } from "react";
import { CheckCircle, AlertTriangle, MinusCircle, Building2, Clock, FolderKanban, FileBarChart } from "lucide-react";

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
  const { activeProject, isAllProjects } = useProject();

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
  const calendarEventsQuery = trpc.calendarEvents.list.useQuery(isOperationOnly && activeProject?.id ? { projectId: activeProject.id } : { projectId: 0 });
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do cumprimento ambiental</p>
          </div>
        </div>

        {/* Brand hero image */}
        <div className="relative rounded-xl overflow-hidden h-48">
          <img src={brandImages?.image_dashboard || "https://www.startcampus.pt/hubfs/Images/Webiste/Start_Campus__%20(2).jpg"} alt="Start Campus" className="w-full h-full object-cover" style={{ objectPosition: brandImages?.image_dashboard_position || "center" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent flex items-center pl-6">
            <p className="text-white font-semibold text-lg">Controlo Ambiental — Start Campus</p>
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
                    <p className="font-semibold text-emerald-900">Fase de Operação — {activeProject?.name}</p>
                    <p className="text-xs text-muted-foreground">Monitorização contínua de medidas ambientais e gestão de resíduos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Dynamic cards row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">15</p>
                <p className="text-xs text-muted-foreground">Medidas Exploração</p>
              </CardContent></Card>
              <Card className="cursor-pointer hover:border-sky-300" onClick={() => window.location.href = "/calendario"}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-sky-600">{(() => { const calEvents = calendarEventsQuery?.data; if (!calEvents || calEvents.length === 0) return "—"; const next = calEvents.filter((e: any) => e.status === "pending" && new Date(Number(e.nextDate)) > new Date()).sort((a: any, b: any) => Number(a.nextDate) - Number(b.nextDate))[0]; return next ? new Date(Number(next.nextDate)).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }) : "—"; })()}</p>
                  <p className="text-xs text-muted-foreground">Próximo Reporting</p>
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
                <p className="text-xs text-muted-foreground">Em Incumprimento</p>
              </CardContent></Card>
            </div>
            {/* Reporting timeline */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Próximos Reportings</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const calEvents = calendarEventsQuery?.data;
                  if (!calEvents || calEvents.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Sem eventos de reporting configurados.</p>;
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
                              {isOverdue && <Badge variant="destructive" className="text-[10px]">Em atraso</Badge>}
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
              <CardHeader><CardTitle className="text-sm">Responsáveis pelo Reporting</CardTitle></CardHeader>
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
                          <p className="text-xs text-muted-foreground">{(events as string[]).length} reportings atribuídos</p>
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
                  if (!waste || waste.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Sem e-GARs registadas. Vá ao MIRR para registar.</p>;
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
                      <div className="h-4 rounded-full overflow-hidden flex bg-gray-100">
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

        {/* All Projects summary banner */}
        {isAllProjects && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Visão Agregada — Todos os Projetos</p>
                  <p className="text-xs text-muted-foreground">Os dados abaixo representam o acumulado de todas as fichas submetidas em todos os projetos.</p>
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
                    <p className="font-semibold text-sm text-blue-800">Próximo RDCD</p>
                    <p className="text-xs text-blue-600">
                      {weeksUntilNextRDCD <= 4
                        ? `Faltam ${weeksUntilNextRDCD} semanas para o próximo relatório semestral`
                        : `Próximo RDCD em ~${weeksUntilNextRDCD} semanas (Semana ${nextRDCDWeek > 52 ? nextRDCDWeek - 52 : nextRDCDWeek}/${nextRDCDWeek > 52 ? currentYear + 1 : currentYear})`
                      }
                    </p>
                  </div>
                  <a href="/rdcd" className="text-xs text-blue-700 font-medium hover:underline shrink-0">Gerar RDCD →</a>
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
        <div className="flex flex-wrap gap-3 justify-end">
          <div className="flex flex-wrap gap-3">
            {canSeeAll && (
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
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
                <SelectValue placeholder="Semana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as semanas</SelectItem>
                {weeks.map((w) => (
                  <SelectItem key={`${w.weekYear}-${w.weekNumber}`} value={`${w.weekYear}-${w.weekNumber}`}>
                    S{w.weekNumber}/{w.weekYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as StatusFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="I">Implementado</SelectItem>
                <SelectItem value="C">Conforme</SelectItem>
                <SelectItem value="NC">Não Conforme</SelectItem>
                <SelectItem value="NA">Não Aplicável</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Secção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as secções</SelectItem>
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
                <p className="text-xs text-muted-foreground">Implementado</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${selectedStatus === "C" ? "ring-2 ring-blue-500" : "hover:shadow-md"}`} onClick={() => setSelectedStatus(selectedStatus === "C" ? "all" : "C")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><CheckCircle className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.C ?? 0}</p>
                <p className="text-xs text-muted-foreground">Conforme</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${selectedStatus === "NC" ? "ring-2 ring-red-500" : "hover:shadow-md"}`} onClick={() => setSelectedStatus(selectedStatus === "NC" ? "all" : "NC")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.NC ?? 0}</p>
                <p className="text-xs text-muted-foreground">Não Conforme</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${selectedStatus === "NA" ? "ring-2 ring-slate-400" : "hover:shadow-md"}`} onClick={() => setSelectedStatus(selectedStatus === "NA" ? "all" : "NA")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100"><MinusCircle className="w-5 h-5 text-slate-500" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.NA ?? 0}</p>
                <p className="text-xs text-muted-foreground">Não Aplicável</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active filter indicator */}
        {selectedStatus !== "all" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            <span>Filtro ativo:</span>
            <span className="font-medium" style={{ color: STATUS_COLORS[selectedStatus] }}>{STATUS_LABELS[selectedStatus]}</span>
            <button className="ml-2 underline text-xs" onClick={() => setSelectedStatus("all")}>Limpar</button>
          </div>
        )}

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Evolução Semanal</CardTitle></CardHeader>
            <CardContent>
              {filteredByWeek.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredByWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {(selectedStatus === "all" || selectedStatus === "I") && <Bar dataKey="I" name="Implementado" fill={STATUS_COLORS.I} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "C") && <Bar dataKey="C" name="Conforme" fill={STATUS_COLORS.C} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "NC") && <Bar dataKey="NC" name="Não Conforme" fill={STATUS_COLORS.NC} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "NA") && <Bar dataKey="NA" name="Não Aplicável" fill={STATUS_COLORS.NA} stackId="a" />}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Evolução do Projeto (Acumulado)</CardTitle></CardHeader>
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
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />Distribuição por Entidade Executante</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredByCompany.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredByCompany}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="companyName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {(selectedStatus === "all" || selectedStatus === "I") && <Bar dataKey="I" name="Implementado" fill={STATUS_COLORS.I} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "C") && <Bar dataKey="C" name="Conforme" fill={STATUS_COLORS.C} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "NC") && <Bar dataKey="NC" name="Não Conforme" fill={STATUS_COLORS.NC} stackId="a" />}
                    {(selectedStatus === "all" || selectedStatus === "NA") && <Bar dataKey="NA" name="Não Aplicável" fill={STATUS_COLORS.NA} stackId="a" />}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Distribuição por Estado</CardTitle></CardHeader>
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
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* By Section */}
        {filteredBySection.some((s: any) => s.I + s.C + s.NC + s.NA > 0) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Cumprimento por Secção</CardTitle></CardHeader>
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
