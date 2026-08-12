import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Clock, AlertTriangle, Plus, Pencil, Trash2, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface CalendarEvent {
  id: number;
  name: string;
  date: Date;
  type: "pending" | "reported" | "confirmed" | "overdue" | "internal_deadline";
  periodicity?: string;
  projectName?: string;
  ownerName?: string;
  rawId?: number; // actual calendarEvent id for status updates
}

function MonthGrid({ year, month, events, selectedDay, onSelectDay }: {
  year: number; month: number; events: CalendarEvent[];
  selectedDay: Date | null; onSelectDay: (d: Date) => void;
}) {
  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [startDay, daysInMonth]);

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (const evt of events) {
      if (evt.date.getFullYear() === year && evt.date.getMonth() === month) {
        const day = evt.date.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(evt);
      }
    }
    return map;
  }, [events, year, month]);

  return (
    <div>
      <h3 className="text-center font-semibold text-sm mb-2">{MONTHS_PT[month]} {year}</h3>
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAYS_PT.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {calendarCells.map((day, idx) => {
          if (day === null) {
            return <div key={idx} className="bg-muted/30 h-16" />;
          }
          const dayEvents = eventsByDay[day] || [];
      const hasOverdue = dayEvents.some(e => e.type === "overdue");
      const hasPending = dayEvents.some(e => e.type === "pending");
      const hasReported = dayEvents.some(e => e.type === "reported");
      const hasConfirmed = dayEvents.some(e => e.type === "confirmed");
      const hasInternal = dayEvents.some(e => e.type === "internal_deadline");
          const isSelected = selectedDay && selectedDay.getDate() === day && selectedDay.getMonth() === month && selectedDay.getFullYear() === year;

          return (
            <button
              key={idx}
              onClick={() => onSelectDay(new Date(year, month, day))}
              className={`bg-background h-16 p-0.5 text-left transition-all hover:bg-primary/5 relative ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
            >
              <span className={`text-[10px] font-medium inline-flex items-center justify-center w-5 h-5 rounded-full ${isToday(day) ? "bg-primary text-primary-foreground" : ""}`}>
                {day}
              </span>
              {dayEvents.length > 0 && (
                <div className="mt-0.5 space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 1).map(evt => (
                    <div
                      key={evt.id}
                      className={`text-[8px] leading-tight px-0.5 py-0 rounded truncate ${evt.type === "overdue" ? "bg-red-100 text-red-800" : evt.type === "reported" ? "bg-blue-100 text-blue-800" : evt.type === "confirmed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
                    >
                      {evt.name.length > 12 ? evt.name.slice(0, 10) + "…" : evt.name}
                    </div>
                  ))}
                  {dayEvents.length > 1 && (
                    <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 1}</span>
                  )}
                </div>
              )}
              {dayEvents.length > 0 && (
                <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
                  {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                  {hasPending && <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                  {hasReported && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                  {hasConfirmed && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                  {hasInternal && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Calendario() {
  const { isAllProjects, activeProject, projects } = useProject();
  const { user } = useAuth();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [newEvent, setNewEvent] = useState({ name: "", periodicity: "Anual", category: "", date: "", entityToDeliver: "", entityLink: "" });
  const [showControlRoom, setShowControlRoom] = useState(false);

  // Use activeProject from context for correct per-project filtering
  const projectId = !isAllProjects && activeProject ? activeProject.id : undefined;

  const { data: plans, isLoading } = trpc.monitoringPlans.list.useQuery(
    projectId ? { projectId } : undefined
  );

  // Fetch calendar events
  const { data: calEvents, refetch: refetchCalEvents } = trpc.calendarEvents.list.useQuery(
    projectId ? { projectId } : undefined
  );

  const createEventMutation = trpc.calendarEvents.create.useMutation({
    onSuccess: () => { refetchCalEvents(); setShowCreateEvent(false); setNewEvent({ name: "", periodicity: "Anual", category: "", date: "", entityToDeliver: "", entityLink: "" }); toast.success("Evento criado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateEventMutation = trpc.calendarEvents.update.useMutation({
    onSuccess: () => { refetchCalEvents(); setEditingEvent(null); toast.success("Evento atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateStatusMutation = trpc.calendarEvents.updateStatus.useMutation({
    onSuccess: () => { refetchCalEvents(); toast.success("Estado atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteEventMutation = trpc.calendarEvents.delete.useMutation({
    onSuccess: () => { refetchCalEvents(); toast.success("Evento removido"); },
    onError: (e: any) => toast.error(e.message),
  });
  const assignOwnerMutation = trpc.calendarEvents.assignOwner.useMutation({
    onSuccess: () => { refetchCalEvents(); toast.success("Responsável atribuído"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Fetch users for owner assignment
  const { data: users } = trpc.users.list.useQuery();

  const now = Date.now();

  const events = useMemo(() => {
    const evts: CalendarEvent[] = [];
    // From monitoring plans
    if (plans) {
      for (const plan of plans) {
        if (plan.nextReportingDate && plan.nextReportingDate > 0) {
          const date = new Date(plan.nextReportingDate);
          const isOverdue = plan.nextReportingDate < now;
          const proj = projects.find(p => p.id === plan.projectId);
          evts.push({
            id: plan.id * 10000,
            name: plan.name,
            date,
            type: isOverdue ? "overdue" : "pending",
            periodicity: plan.periodicity || undefined,
            projectName: proj?.code || undefined,
          });
        }
      }
    }
    // From calendar events
    if (calEvents) {
      for (const evt of calEvents) {
        if (evt.nextDate && evt.nextDate > 0) {
          const date = new Date(evt.nextDate);
          const isOverdue = evt.nextDate < now;
          const proj = projects.find(p => p.id === evt.projectId);
          evts.push({
            id: evt.id,
            name: evt.name,
            date,
            type: evt.status === "reported" ? "reported" : evt.status === "confirmed" ? "confirmed" : (isOverdue ? "overdue" : "pending"),
            periodicity: evt.periodicity || undefined,
            projectName: proj?.code || undefined,
            ownerName: evt.ownerName || undefined,
            rawId: evt.id,
          });
        }
      }
    }
    // Add internal deadline markers (14 days before each pending event)
    const internalDeadlines: CalendarEvent[] = [];
    for (const evt of evts) {
      if (evt.type === "pending") {
        const internalDate = new Date(evt.date.getTime() - 14 * 24 * 60 * 60 * 1000);
        if (internalDate.getTime() > now) {
          internalDeadlines.push({
            ...evt,
            id: evt.id + 900000,
            date: internalDate,
            type: "internal_deadline",
            name: `⚡ ${evt.name} (limite interno)`,
          });
        }
      }
    }
    return [...evts, ...internalDeadlines];
  }, [plans, calEvents, projects, now]);

  // Two months: current and next
  const year1 = currentDate.getFullYear();
  const month1 = currentDate.getMonth();
  const nextMonthDate = new Date(year1, month1 + 1, 1);
  const year2 = nextMonthDate.getFullYear();
  const month2 = nextMonthDate.getMonth();

  // Selected day events
  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return events.filter(e =>
      e.date.getFullYear() === selectedDay.getFullYear() &&
      e.date.getMonth() === selectedDay.getMonth() &&
      e.date.getDate() === selectedDay.getDate()
    );
  }, [selectedDay, events]);

  // Next upcoming event
  const nextEvent = useMemo(() => {
    return events
      .filter(e => e.type !== "overdue" && e.date.getTime() >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  }, [events, now]);

  const overdueCount = events.filter(e => e.type === "overdue").length;

  function prevMonth() {
    setCurrentDate(new Date(year1, month1 - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setCurrentDate(new Date(year1, month1 + 1, 1));
    setSelectedDay(null);
  }
  function goToday() {
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              Calendário de Reporting
            </h1>
            <p className="text-muted-foreground text-sm">
              {isAllProjects ? "Todos os projetos" : activeProject?.name || "Projeto"} — Datas de entrega de reportings
            </p>
          </div>
          <div className="flex gap-2">
            {isAdminOrDono && (
              <Button size="sm" variant="outline" onClick={() => setShowControlRoom(!showControlRoom)}>
                <Settings2 className="w-3.5 h-3.5 mr-1" /> Gerir
              </Button>
            )}
            {isAdminOrDono && (
              <Button size="sm" onClick={() => setShowCreateEvent(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Novo Evento
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
          </div>
        </div>

        {/* Hero alerts */}
        {/* Legend */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-muted-foreground">Legenda:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-400 border border-slate-500" />
                <span>Prazo Regulatório de Submissão</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-indigo-400 border border-indigo-500" />
                <span>Prazo Interno de Preparação</span>
              </div>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-sky-400" />
                <span>Submetido</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600" />
                <span>Validado pela Entidade</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-600" />
                <span>Em Incumprimento</span>
              </div>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px] font-bold">H</span>
                <span>Hoje</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="hidden">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>Prazo Regulatório de Submissão</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <span>Prazo Interno de Preparação</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>Submetido</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span>Validado pela Entidade</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <span>Em Incumprimento</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {nextEvent && (
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-emerald-600 font-medium">Próxima Entrega</p>
                  <p className="font-semibold text-sm text-emerald-900 truncate">{nextEvent.name}</p>
                  <p className="text-xs text-emerald-700">
                    {nextEvent.date.toLocaleDateString("pt-PT", { day: "2-digit", month: "long" })}
                    {nextEvent.projectName && ` · ${nextEvent.projectName}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {overdueCount > 0 && (
            <Card className="border-red-200 bg-gradient-to-r from-red-50 to-orange-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-700" />
                </div>
                <div>
                  <p className="text-xs text-red-600 font-medium">Em Atraso</p>
                  <p className="font-semibold text-sm text-red-900">{overdueCount} {overdueCount === 1 ? "reporting" : "reportings"} em atraso</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Two-month calendar */}
        <Card>
          <CardContent className="p-4">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-muted-foreground">
                {MONTHS_PT[month1]} — {MONTHS_PT[month2]} {year2}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Two months side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MonthGrid year={year1} month={month1} events={events} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
              <MonthGrid year={year2} month={month2} events={events} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
            </div>
          </CardContent>
        </Card>

        {/* Selected day detail */}
        {selectedDay && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2">
                {selectedDay.toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem reportings agendados neste dia.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map(evt => (
                    <div key={evt.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${evt.type === "overdue" ? "border-red-200 bg-red-50/50" : evt.type === "reported" ? "border-blue-200 bg-blue-50/50" : evt.type === "confirmed" ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}`}>
                      <div>
                        <p className="font-medium text-sm">{evt.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {evt.projectName && <span className="font-medium">{evt.projectName} · </span>}
                          {evt.periodicity}
                          {evt.ownerName && <span> · {evt.ownerName}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${evt.type === "overdue" ? "bg-red-600 text-white" : evt.type === "reported" ? "bg-sky-400 text-white" : evt.type === "confirmed" ? "bg-emerald-600 text-white" : evt.type === "internal_deadline" ? "bg-indigo-400 text-white" : "bg-slate-400 text-white"}`}>
                          {evt.type === "overdue" ? "Em Incumprimento" : evt.type === "reported" ? "Submetido" : evt.type === "confirmed" ? "Validado" : evt.type === "internal_deadline" ? "Prazo Interno" : "Prazo Regulatório"}
                        </Badge>
                        {isAdminOrDono && evt.rawId && evt.type !== "confirmed" && (
                          <div className="flex gap-1">
                            {evt.type === "pending" || evt.type === "overdue" ? (
                              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => updateStatusMutation.mutate({ id: evt.rawId!, status: "reported" })}>
                                Marcar Reportado
                              </Button>
                            ) : null}
                            {evt.type === "reported" && (
                              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-green-300 text-green-700" onClick={() => updateStatusMutation.mutate({ id: evt.rawId!, status: "confirmed" })}>
                                Confirmar
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reporting Table */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">
              Elementos a Reportar {!projectId && <span className="text-sm font-normal text-muted-foreground">— Todos os projetos</span>}
            </h3>
            {/* Smart aggregation for "Todos os Projetos" */}
            {!projectId && calEvents && calEvents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-2 font-medium text-muted-foreground">Evento</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Periodicidade</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Responsável</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Estado por Projeto</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Próxima Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Group events by name
                      const grouped: Record<string, any[]> = {};
                      for (const evt of calEvents as any[]) {
                        const key = evt.name;
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(evt);
                      }
                      return Object.entries(grouped)
                        .sort(([, a], [, b]) => {
                          const minA = Math.min(...a.map((e: any) => e.nextDate || Infinity));
                          const minB = Math.min(...b.map((e: any) => e.nextDate || Infinity));
                          return minA - minB;
                        })
                        .map(([name, evts]) => {
                          const reported = evts.filter((e: any) => e.status === "reported" || e.status === "confirmed");
                          const pending = evts.filter((e: any) => e.status === "pending");
                          const overdue = pending.filter((e: any) => e.nextDate && e.nextDate < now);
                          const nextDate = Math.min(...evts.map((e: any) => e.nextDate || Infinity));
                          const periodicity = evts[0]?.periodicity || "—";
                          
                          // Build status summary
                          const pendingProjects = pending.map((e: any) => {
                            const p = projects.find(pr => pr.id === e.projectId);
                            return p?.code || "?";
                          });
                          const reportedProjects = reported.map((e: any) => {
                            const p = projects.find(pr => pr.id === e.projectId);
                            return p?.code || "?";
                          });
                          
                          const allDone = pending.length === 0;
                          const hasOverdue = overdue.length > 0;
                          
                          return (
                            <tr key={name} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="py-2.5 px-2 font-medium">{name}</td>
                              <td className="py-2.5 px-2 text-muted-foreground">{periodicity}</td>
                              <td className="py-2.5 px-2 text-xs text-muted-foreground">{evts[0]?.ownerName || "—"}</td>
                              <td className="py-2.5 px-2">
                                {allDone ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                                    Todos reportados
                                  </span>
                                ) : hasOverdue ? (
                                  <span className="text-xs">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium border bg-red-100 text-red-800 border-red-200">
                                      Falta: {pendingProjects.join(", ")}
                                    </span>
                                    {reportedProjects.length > 0 && (
                                      <span className="ml-1 text-muted-foreground">({reportedProjects.length} reportados)</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-xs">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium border bg-amber-100 text-amber-800 border-amber-200">
                                      Pendente: {pendingProjects.join(", ")}
                                    </span>
                                    {reportedProjects.length > 0 && (
                                      <span className="ml-1 text-muted-foreground">({reportedProjects.length} reportados)</span>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2">
                                {nextDate < Infinity ? (
                                  <span className={hasOverdue ? "text-red-600 font-medium" : ""}>
                                    {new Date(nextDate).toLocaleDateString("pt-PT")}
                                  </span>
                                ) : "—"}
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
            ) : projectId && calEvents && calEvents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-2 font-medium text-muted-foreground">Evento</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Projeto</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Periodicidade</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Data Limite</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Responsável</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Entidade</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Estado</th>
                      {isAdminOrDono && <th className="py-2 px-2 font-medium text-muted-foreground">Ação</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...calEvents]
                      .sort((a: any, b: any) => (a.nextDate || 0) - (b.nextDate || 0))
                      .map((evt: any) => {
                        const isOverdue = evt.nextDate && evt.nextDate < now;
                        const statusType = isOverdue && evt.status === "pending" ? "overdue" : evt.status;
                        const proj = projects.find(p => p.id === evt.projectId);
                        const badgeBg: Record<string, string> = {
                          overdue: "bg-red-100 text-red-800 border-red-200",
                          pending: "bg-slate-100 text-slate-800 border-slate-200",
                          reported: "bg-sky-100 text-sky-800 border-sky-200",
                          confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
                        };
                        const statusLabel: Record<string, string> = {
                          overdue: "Em Incumprimento",
                          pending: "Prazo Regulatório",
                          reported: "Submetido",
                          confirmed: "Validado pela Entidade",
                        };
                        return (
                          <tr key={evt.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2.5 px-2 font-medium">{evt.name}</td>
                            <td className="py-2.5 px-2 text-muted-foreground">{proj?.code || "—"}</td>
                            <td className="py-2.5 px-2 text-muted-foreground">{evt.periodicity || "—"}</td>
                            <td className="py-2.5 px-2">{evt.nextDate ? new Date(evt.nextDate).toLocaleDateString("pt-PT") : "—"}</td>
                            <td className="py-2.5 px-2">
                              {isAdminOrDono ? (
                                <select
                                  className="h-7 text-xs border rounded px-1 w-full max-w-[140px]"
                                  value={evt.ownerId || ""}
                                  onChange={(e) => {
                                    const userId = parseInt(e.target.value);
                                    const selectedUser = users?.find((u: any) => u.id === userId);
                                    if (selectedUser) {
                                      assignOwnerMutation.mutate({ id: evt.id, ownerId: userId, ownerName: selectedUser.fullName || selectedUser.name || selectedUser.email || "" });
                                    }
                                  }}
                                >
                                  <option value="">— Selecionar —</option>
                                  {users?.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.fullName || u.name || u.email}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-muted-foreground text-xs">{evt.ownerName || "—"}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-xs">{evt.entityToDeliver ? (evt.entityLink ? <a href={evt.entityLink} target="_blank" className="text-primary underline hover:text-primary/80">{evt.entityToDeliver}</a> : <span className="text-muted-foreground">{evt.entityToDeliver}</span>) : "—"}</td>
                            <td className="py-2.5 px-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badgeBg[statusType] || ""}`}>
                                {statusLabel[statusType] || statusType}
                              </span>
                            </td>
                            {isAdminOrDono && (
                              <td className="py-2.5 px-2">
                                {statusType === "pending" || statusType === "overdue" ? (
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatusMutation.mutate({ id: evt.id, status: "reported" })}>
                                    Marcar Reportado
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Data avançada automaticamente</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum evento de reporting criado. Use o botão "Novo Evento" para adicionar.</p>
            )}
          </CardContent>
        </Card>

        {/* Inline Control Room */}
        {showControlRoom && isAdminOrDono && calEvents && (
          <Card className="border-purple-200">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Gestão de Eventos
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Evento</th>
                      <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Projeto</th>
                      <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Periodicidade</th>
                      <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Data</th>
                      <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Responsável</th>
                      <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(calEvents as any[]).map((evt: any) => {
                      const proj = projects.find(p => p.id === evt.projectId);
                      const isEditing = editingEvent?.id === evt.id;
                      return (
                        <tr key={evt.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 px-2 text-xs font-medium">{evt.name}</td>
                          <td className="py-2 px-2 text-xs text-muted-foreground">{proj?.code || "—"}</td>
                          <td className="py-2 px-2 text-xs">{evt.periodicity || "—"}</td>
                          <td className="py-2 px-2 text-xs">{evt.nextDate ? new Date(evt.nextDate).toLocaleDateString("pt-PT") : "—"}</td>
                          <td className="py-2 px-2">
                            <select
                              className="h-6 text-[10px] border rounded px-1 w-full max-w-[120px]"
                              value={evt.ownerId || ""}
                              onChange={(e) => {
                                const userId = parseInt(e.target.value);
                                const selectedUser = users?.find((u: any) => u.id === userId);
                                if (selectedUser) {
                                  assignOwnerMutation.mutate({ id: evt.id, ownerId: userId, ownerName: selectedUser.fullName || selectedUser.name || selectedUser.email || "" });
                                }
                              }}
                            >
                              <option value="">—</option>
                              {users?.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.fullName || u.name || u.email}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1">
                              <button className="p-1 rounded hover:bg-muted" title="Editar" onClick={() => setEditingEvent(evt)}>
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button className="p-1 rounded hover:bg-red-100 text-red-600" title="Eliminar" onClick={() => { if (confirm("Eliminar este evento?")) deleteEventMutation.mutate({ id: evt.id }); }}>
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}


        
        {/* Edit Event Dialog */}
        {editingEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingEvent(null)}>
            <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Editar Evento</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nome</label>
                  <Input value={editingEvent.name} onChange={e => setEditingEvent({...editingEvent, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Periodicidade</label>
                    <select className="w-full h-9 border rounded-md px-2 text-sm" value={editingEvent.periodicity || "Anual"} onChange={e => setEditingEvent({...editingEvent, periodicity: e.target.value})}>
                      <option value="Anual">Anual</option><option value="Semestral">Semestral</option><option value="Trimestral">Trimestral</option><option value="Mensal">Mensal</option><option value="Pontual">Pontual</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Data</label>
                    <Input type="date" value={editingEvent.nextDate ? new Date(editingEvent.nextDate).toISOString().split("T")[0] : ""} onChange={e => setEditingEvent({...editingEvent, nextDate: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Entidade (nome)</label>
                  <Input value={editingEvent.entityToDeliver || ""} onChange={e => setEditingEvent({...editingEvent, entityToDeliver: e.target.value})} placeholder="Ex: APA, CCDR Alentejo" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Link da Entidade (URL do portal de submissão)</label>
                  <Input value={editingEvent.entityLink || ""} onChange={e => setEditingEvent({...editingEvent, entityLink: e.target.value})} placeholder="https://siliamb.apambiente.pt" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => { updateEventMutation.mutate({ id: editingEvent.id, name: editingEvent.name, periodicity: editingEvent.periodicity, nextDate: typeof editingEvent.nextDate === "string" ? new Date(editingEvent.nextDate).getTime() : editingEvent.nextDate, entityToDeliver: editingEvent.entityToDeliver, entityLink: editingEvent.entityLink }); setEditingEvent(null); }}>Guardar</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingEvent(null)}>Cancelar</Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Create Event Dialog */}
        {showCreateEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateEvent(false)}>
            <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Novo Evento de Reporting</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nome do evento</label>
                  <Input value={newEvent.name} onChange={e => setNewEvent(prev => ({ ...prev, name: e.target.value }))} placeholder="Ex: Gases Fluorados - APA" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Periodicidade</label>
                    <select className="w-full h-9 border rounded-md px-2 text-sm" value={newEvent.periodicity} onChange={e => setNewEvent(prev => ({ ...prev, periodicity: e.target.value }))}>
                      <option value="Anual">Anual</option>
                      <option value="Semestral">Semestral</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Mensal">Mensal</option>
                      <option value="Pontual">Pontual</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Categoria</label>
                    <Input value={newEvent.category} onChange={e => setNewEvent(prev => ({ ...prev, category: e.target.value }))} placeholder="Ex: APA, Energia" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Próxima data de entrega</label>
                  <Input type="date" value={newEvent.date} onChange={e => setNewEvent(prev => ({ ...prev, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Entidade</label>
                  <Input value={newEvent.entityToDeliver} onChange={e => setNewEvent(prev => ({ ...prev, entityToDeliver: e.target.value }))} placeholder="Ex: APA, CCDR, Câmara Municipal" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Link da Entidade (URL do portal)</label>
                  <Input value={newEvent.entityLink} onChange={e => setNewEvent(prev => ({ ...prev, entityLink: e.target.value }))} placeholder="https://siliamb.apambiente.pt" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => {
                    if (!newEvent.name || !newEvent.date) { toast.error("Preencha nome e data"); return; }
                    const dateMs = new Date(newEvent.date).getTime();
                    createEventMutation.mutate({
                      projectId: projectId || undefined,
                      name: newEvent.name,
                      periodicity: newEvent.periodicity,
                      category: newEvent.category || undefined,
                      firstDate: dateMs,
                      nextDate: dateMs,
                      entityToDeliver: newEvent.entityToDeliver || undefined,
                      entityLink: newEvent.entityLink || undefined,
                    });
                  }} disabled={createEventMutation.isPending} size="sm">
                    {createEventMutation.isPending ? "A criar..." : "Criar Evento"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowCreateEvent(false)}>Cancelar</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
