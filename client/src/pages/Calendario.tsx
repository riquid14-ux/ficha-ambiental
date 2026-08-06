import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Clock, AlertTriangle } from "lucide-react";

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface CalendarEvent {
  id: number;
  name: string;
  date: Date;
  type: "reporting" | "overdue";
  periodicity?: string;
  projectName?: string;
}

export default function Calendario() {
  const { isAllProjects, activeProject, projects } = useProject();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Fetch plans - if "Todos os Projetos", fetch all
  const storedProject = localStorage.getItem("selectedProjectId");
  const projectId = storedProject && storedProject !== "all" ? parseInt(storedProject) : undefined;

  const { data: plans, isLoading } = trpc.monitoringPlans.list.useQuery(
    projectId ? { projectId } : undefined
  );

  const now = Date.now();

  // Build calendar events from plans
  const events = useMemo(() => {
    if (!plans) return [];
    const evts: CalendarEvent[] = [];
    for (const plan of plans) {
      if (plan.nextReportingDate && plan.nextReportingDate > 0) {
        const date = new Date(plan.nextReportingDate);
        const isOverdue = plan.nextReportingDate < now;
        // Find project name
        const proj = projects.find(p => p.id === plan.projectId);
        evts.push({
          id: plan.id,
          name: plan.name,
          date,
          type: isOverdue ? "overdue" : "reporting",
          periodicity: plan.periodicity || undefined,
          projectName: proj?.code || undefined,
        });
      }
    }
    return evts;
  }, [plans, projects, now]);

  // Calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = (firstDayOfMonth.getDay() + 6) % 7; // Monday=0
  const daysInMonth = lastDayOfMonth.getDate();

  // Build grid cells
  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [startDay, daysInMonth]);

  // Events by day
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

  // Selected day events
  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return events.filter(e =>
      e.date.getFullYear() === selectedDay.getFullYear() &&
      e.date.getMonth() === selectedDay.getMonth() &&
      e.date.getDate() === selectedDay.getDate()
    );
  }, [selectedDay, events]);

  // Next upcoming event for hero alert
  const nextEvent = useMemo(() => {
    return events
      .filter(e => e.type === "reporting" && e.date.getTime() >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  }, [events, now]);

  // Overdue count
  const overdueCount = events.filter(e => e.type === "overdue").length;

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  }
  function goToday() {
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  }

  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
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
        <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
      </div>

      {/* Hero alerts */}
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

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">
              {MONTHS_PT[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {DAYS_PT.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1.5">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="bg-muted/30 h-20" />;
              }
              const dayEvents = eventsByDay[day] || [];
              const hasOverdue = dayEvents.some(e => e.type === "overdue");
              const hasReporting = dayEvents.some(e => e.type === "reporting");
              const isSelected = selectedDay && selectedDay.getDate() === day && selectedDay.getMonth() === month && selectedDay.getFullYear() === year;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(new Date(year, month, day))}
                  className={`bg-background h-20 p-1 text-left transition-all hover:bg-primary/5 relative ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                >
                  <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday(day) ? "bg-primary text-primary-foreground" : ""}`}>
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="mt-0.5 space-y-0.5 overflow-hidden">
                      {dayEvents.slice(0, 2).map(evt => (
                        <div
                          key={evt.id}
                          className={`text-[9px] leading-tight px-1 py-0.5 rounded truncate ${evt.type === "overdue" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}
                        >
                          {evt.projectName && <span className="font-bold">{evt.projectName} </span>}
                          {evt.name.length > 20 ? evt.name.slice(0, 18) + "…" : evt.name}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 2} mais</span>
                      )}
                    </div>
                  )}
                  {/* Dot indicators */}
                  {dayEvents.length > 0 && (
                    <div className="absolute bottom-1 right-1 flex gap-0.5">
                      {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      {hasReporting && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </div>
                  )}
                </button>
              );
            })}
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
                  <div key={evt.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${evt.type === "overdue" ? "border-red-200 bg-red-50/50" : "border-emerald-200 bg-emerald-50/50"}`}>
                    <div>
                      <p className="font-medium text-sm">{evt.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {evt.projectName && <span className="font-medium">{evt.projectName} · </span>}
                        {evt.periodicity}
                      </p>
                    </div>
                    <Badge variant={evt.type === "overdue" ? "destructive" : "default"} className="text-xs">
                      {evt.type === "overdue" ? "Em atraso" : "Agendado"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Reporting agendado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>Em atraso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">H</span>
          <span>Hoje</span>
        </div>
      </div>
    </div>
  );
}
