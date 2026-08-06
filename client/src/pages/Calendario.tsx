import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
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
          const hasReporting = dayEvents.some(e => e.type === "reporting");
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
                      className={`text-[8px] leading-tight px-0.5 py-0 rounded truncate ${evt.type === "overdue" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}
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
                  {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  {hasReporting && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
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
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const storedProject = localStorage.getItem("selectedProjectId");
  const projectId = storedProject && storedProject !== "all" ? parseInt(storedProject) : undefined;

  const { data: plans, isLoading } = trpc.monitoringPlans.list.useQuery(
    projectId ? { projectId } : undefined
  );

  const now = Date.now();

  const events = useMemo(() => {
    if (!plans) return [];
    const evts: CalendarEvent[] = [];
    for (const plan of plans) {
      if (plan.nextReportingDate && plan.nextReportingDate > 0) {
        const date = new Date(plan.nextReportingDate);
        const isOverdue = plan.nextReportingDate < now;
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
      .filter(e => e.type === "reporting" && e.date.getTime() >= now)
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
    </AppLayout>
  );
}
