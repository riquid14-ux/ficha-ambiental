import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Settings2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { StandMetricCard } from "@/components/stand/StandMetricCard";
import { StandPageHeader } from "@/components/stand/StandPageHeader";
import { StandStatusBadge } from "@/components/stand/StandStatusBadge";

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
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
  sourceType?: string | null;
}

function getEventStatusMeta(type: CalendarEvent["type"]) {
  switch (type) {
    case "overdue":
      return {
        label: "Em Incumprimento",
        tone: "danger" as const,
        dot: "bg-rose-600",
      };
    case "reported":
      return { label: "Submetido", tone: "info" as const, dot: "bg-sky-600" };
    case "confirmed":
      return {
        label: "Validado",
        tone: "success" as const,
        dot: "bg-emerald-600",
      };
    case "internal_deadline":
      return {
        label: "Prazo Interno",
        tone: "warning" as const,
        dot: "bg-indigo-500",
      };
    default:
      return {
        label: "Prazo Regulatório",
        tone: "neutral" as const,
        dot: "bg-slate-500",
      };
  }
}

function MonthGrid({
  year,
  month,
  events,
  selectedDay,
  onSelectDay,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  selectedDay: Date | null;
  onSelectDay: (d: Date) => void;
}) {
  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

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
    <section
      aria-label={`${MONTHS_PT[month]} ${year}`}
      className="rounded-2xl border border-border/80 bg-card/70 p-3 shadow-[0_10px_28px_hsl(var(--shadow-color)/0.035)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">
          {MONTHS_PT[month]}{" "}
          <span className="font-normal text-muted-foreground">{year}</span>
        </h3>
        <span className="stand-kicker text-muted-foreground">
          {
            events.filter(
              event =>
                event.date.getFullYear() === year &&
                event.date.getMonth() === month
            ).length
          }{" "}
          eventos
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="row">
        {DAYS_PT.map(d => (
          <div
            key={d}
            role="columnheader"
            className="pb-1 text-center text-xs font-semibold text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="grid">
        {calendarCells.map((day, idx) => {
          if (day === null)
            return (
              <div
                key={idx}
                aria-hidden="true"
                className="min-h-20 rounded-xl bg-muted/35 dark:bg-muted/15"
              />
            );
          const dayEvents = eventsByDay[day] || [];
          const isSelected =
            selectedDay &&
            selectedDay.getDate() === day &&
            selectedDay.getMonth() === month &&
            selectedDay.getFullYear() === year;
          const date = new Date(year, month, day);
          const primaryEvent = dayEvents[0];
          const status = primaryEvent
            ? getEventStatusMeta(primaryEvent.type)
            : null;
          return (
            <button
              type="button"
              key={idx}
              role="gridcell"
              aria-label={`${date.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${dayEvents.length ? `, ${dayEvents.length} evento${dayEvents.length > 1 ? "s" : ""}` : ""}`}
              aria-current={isToday(day) ? "date" : undefined}
              aria-pressed={Boolean(isSelected)}
              onClick={() => onSelectDay(date)}
              className={`group relative min-h-20 rounded-xl border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-border/70 bg-background/80 hover:border-primary/35 hover:bg-primary/[0.035]"}`}
            >
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-1 text-xs font-semibold ${isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"}`}
              >
                {day}
              </span>
              {primaryEvent && (
                <div className="mt-1.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${status?.dot}`}
                    />
                    <span className="truncate text-xs font-medium leading-4 text-foreground">
                      {primaryEvent.name}
                    </span>
                  </div>
                  {dayEvents.length > 1 && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      +{dayEvents.length - 1} adicional
                      {dayEvents.length > 2 ? "is" : ""}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Calendario() {
  const { t } = useLanguage();
  const { isAllProjects, activeProject, projects } = useProject();
  const { user } = useAuth();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [newEvent, setNewEvent] = useState({
    name: "",
    periodicity: "Anual",
    category: "",
    date: "",
    entityToDeliver: "",
    entityLink: "",
  });
  const [showControlRoom, setShowControlRoom] = useState(false);

  // Use activeProject from context for correct per-project filtering
  const projectId =
    !isAllProjects && activeProject ? activeProject.id : undefined;

  // Fetch calendar events
  const {
    data: calEvents,
    refetch: refetchCalEvents,
    isLoading,
  } = trpc.calendarEvents.list.useQuery(projectId ? { projectId } : undefined);

  const createEventMutation = trpc.calendarEvents.create.useMutation({
    onSuccess: () => {
      refetchCalEvents();
      setShowCreateEvent(false);
      setNewEvent({
        name: "",
        periodicity: "Anual",
        category: "",
        date: "",
        entityToDeliver: "",
        entityLink: "",
      });
      toast.success("Evento criado");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const updateEventMutation = trpc.calendarEvents.update.useMutation({
    onSuccess: () => {
      refetchCalEvents();
      setEditingEvent(null);
      toast.success("Evento atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const updateStatusMutation = trpc.calendarEvents.updateStatus.useMutation({
    onSuccess: () => {
      refetchCalEvents();
      toast.success("Estado atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteEventMutation = trpc.calendarEvents.delete.useMutation({
    onSuccess: () => {
      refetchCalEvents();
      toast.success("Evento removido");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const assignOwnerMutation = trpc.calendarEvents.assignOwner.useMutation({
    onSuccess: () => {
      refetchCalEvents();
      toast.success(t("Responsável atribuído"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: brandImages } = trpc.appSettings.getAll.useQuery();
  // Fetch users for owner assignment
  const { data: users } = trpc.users.list.useQuery();

  const now = Date.now();

  const events = useMemo(() => {
    const evts: CalendarEvent[] = [];
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
            type:
              evt.status === "reported"
                ? "reported"
                : evt.status === "confirmed"
                  ? "confirmed"
                  : isOverdue
                    ? "overdue"
                    : "pending",
            periodicity: evt.periodicity || undefined,
            projectName: proj?.code || undefined,
            ownerName: evt.ownerName || undefined,
            rawId: evt.id,
            sourceType: evt.sourceType,
          });
        }
      }
    }
    // Add internal deadline markers (14 days before each pending event)
    const internalDeadlines: CalendarEvent[] = [];
    for (const evt of evts) {
      if (evt.type === "pending") {
        const internalDate = new Date(
          evt.date.getTime() - 14 * 24 * 60 * 60 * 1000
        );
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
  }, [calEvents, projects, now]);

  // Two months: current and next
  const year1 = currentDate.getFullYear();
  const month1 = currentDate.getMonth();
  const nextMonthDate = new Date(year1, month1 + 1, 1);
  const year2 = nextMonthDate.getFullYear();
  const month2 = nextMonthDate.getMonth();

  // Selected day events
  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return events.filter(
      e =>
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
        <StandPageHeader
          eyebrow="Governança ambiental · reporting"
          title={t("Calendário de Reporting")}
          context={
            isAllProjects
              ? t("Todos os Projetos")
              : activeProject?.name || "Projeto"
          }
          description={t("Datas de entrega de reportings")}
          tone="operations"
          actions={
            <>
              {isAdminOrDono && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => setShowControlRoom(!showControlRoom)}
                  aria-pressed={showControlRoom}
                >
                  <Settings2 className="mr-1.5 h-4 w-4" /> Gerir
                </Button>
              )}
              {isAdminOrDono && (
                <Button
                  size="sm"
                  className="bg-white text-emerald-950 hover:bg-emerald-50"
                  onClick={() => setShowCreateEvent(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Novo Evento
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={goToday}
              >
                {t("Hoje")}
              </Button>
            </>
          }
        >
          <div className="relative mt-1 h-14 overflow-hidden rounded-xl border border-white/10 bg-emerald-950/25">
            <img
              src={
                brandImages?.image_calendario ||
                "/manus-storage/sc-sin01_2c20c2d5.png"
              }
              alt=""
              className="h-full w-full object-cover opacity-45"
              style={{
                objectPosition:
                  brandImages?.image_calendario_position || "center",
              }}
              onError={e => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/70 via-emerald-950/20 to-transparent" />
            <span className="absolute inset-y-0 left-3 flex items-center text-xs font-medium text-emerald-50">
              Visão operacional de prazos, responsáveis e submissões
            </span>
          </div>
        </StandPageHeader>

        <section
          aria-label={t("Legenda")}
          className="rounded-2xl border border-border/80 bg-card/80 px-4 py-3 shadow-[0_10px_28px_hsl(var(--shadow-color)/0.035)]"
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className="stand-kicker text-muted-foreground">
              {t("Legenda")}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
              {t("Prazo Regulatório de Submissão")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              {t("Prazo Interno de Preparação")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
              {t("Submetido")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              {t("Validado pela Entidade")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
              {t("Em Incumprimento")}
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 text-xs font-bold text-primary-foreground">
                H
              </span>
              {t("Hoje")}
            </div>
          </div>
        </section>

        <section
          aria-label="Resumo de decisão"
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <StandMetricCard
            label={t("Próxima Entrega")}
            value={
              nextEvent
                ? nextEvent.date.toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "short",
                  })
                : "—"
            }
            detail={
              nextEvent
                ? `${nextEvent.name}${nextEvent.projectName ? ` · ${nextEvent.projectName}` : ""}`
                : t("Sem entregas futuras")
            }
            icon={Clock}
            tone={nextEvent ? "success" : "neutral"}
            onClick={
              nextEvent
                ? () => {
                    setCurrentDate(
                      new Date(
                        nextEvent.date.getFullYear(),
                        nextEvent.date.getMonth(),
                        1
                      )
                    );
                    setSelectedDay(new Date(nextEvent.date));
                  }
                : undefined
            }
          />
          <StandMetricCard
            label={t("Em Atraso")}
            value={overdueCount}
            detail={
              overdueCount === 1
                ? "reporting em atraso"
                : "reportings em atraso"
            }
            icon={AlertTriangle}
            tone={overdueCount > 0 ? "danger" : "success"}
          />
          <StandMetricCard
            label="Eventos de reporting"
            value={calEvents?.length || 0}
            detail={projectId ? activeProject?.name : t("Todos os Projetos")}
            icon={Calendar}
            tone="brand"
          />
        </section>

        <section
          aria-label="Calendário de entregas"
          className="rounded-2xl border border-border/80 bg-card/85 p-4 shadow-[0_16px_36px_hsl(var(--shadow-color)/0.05)] sm:p-5"
        >
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <p className="stand-kicker text-primary">Planeamento</p>
              <p className="mt-1 text-sm font-semibold tracking-tight">
                {MONTHS_PT[month1]} — {MONTHS_PT[month2]} {year2}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Mês anterior"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Mês seguinte"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <MonthGrid
              year={year1}
              month={month1}
              events={events}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            <MonthGrid
              year={year2}
              month={month2}
              events={events}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          </div>
        </section>

        {/* Selected day detail */}
        {selectedDay && (
          <section
            aria-live="polite"
            className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 shadow-[0_10px_28px_hsl(var(--shadow-color)/0.035)] sm:p-5"
          >
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="stand-kicker text-primary">Agenda diária</p>
                <h3 className="mt-1 text-base font-semibold tracking-tight">
                  {selectedDay.toLocaleDateString("pt-PT", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {selectedDayEvents.length} evento
                {selectedDayEvents.length !== 1 ? "s" : ""}
              </span>
            </div>
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("Sem reportings agendados neste dia.")}
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map(evt => {
                  const status = getEventStatusMeta(evt.type);
                  return (
                    <article
                      key={evt.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{evt.name}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {evt.projectName && (
                            <span className="font-medium text-foreground">
                              {evt.projectName} ·{" "}
                            </span>
                          )}
                          {evt.periodicity}
                          {evt.ownerName && <span> · {evt.ownerName}</span>}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <StandStatusBadge
                          label={status.label}
                          tone={status.tone}
                        />
                        {evt.sourceType === "monitoring_plan_assignment" && (
                          <span className="inline-flex items-center rounded-full border border-emerald-600/20 bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                            Gerido em Planos
                          </span>
                        )}
                        {isAdminOrDono &&
                          evt.rawId &&
                          evt.type !== "confirmed" &&
                          evt.sourceType !== "monitoring_plan_assignment" && (
                            <div className="flex gap-1.5">
                              {(evt.type === "pending" ||
                                evt.type === "overdue") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: evt.rawId!,
                                      status: "reported",
                                    })
                                  }
                                >
                                  Marcar Reportado
                                </Button>
                              )}
                              {evt.type === "reported" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-emerald-500/35 text-xs text-emerald-800 hover:bg-emerald-500/10 dark:text-emerald-200"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: evt.rawId!,
                                      status: "confirmed",
                                    })
                                  }
                                >
                                  Confirmar
                                </Button>
                              )}
                            </div>
                          )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Reporting Table */}
        <Card className="overflow-hidden rounded-2xl border-border/80 bg-card/90 shadow-[0_12px_30px_hsl(var(--shadow-color)/0.045)]">
          <CardContent className="p-0">
            <div className="border-b border-border/70 px-4 py-4 sm:px-5">
              <p className="stand-kicker text-primary">Registo operacional</p>
              <h3 className="mt-1 font-semibold tracking-tight">
                Elementos a Reportar{" "}
                {!projectId && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {t("— Todos os projetos")}
                  </span>
                )}
              </h3>
            </div>
            <div className="p-2 sm:p-3">
              {/* Smart aggregation for "Todos os Projetos" */}
              {!projectId && calEvents && calEvents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Evento")}
                        </th>
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Periodicidade")}
                        </th>
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Responsável")}
                        </th>
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Estado por Projeto")}
                        </th>
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Próxima Data")}
                        </th>
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
                            const minA = Math.min(
                              ...a.map((e: any) => e.nextDate || Infinity)
                            );
                            const minB = Math.min(
                              ...b.map((e: any) => e.nextDate || Infinity)
                            );
                            return minA - minB;
                          })
                          .map(([name, evts]) => {
                            const reported = evts.filter(
                              (e: any) =>
                                e.status === "reported" ||
                                e.status === "confirmed"
                            );
                            const pending = evts.filter(
                              (e: any) => e.status === "pending"
                            );
                            const overdue = pending.filter(
                              (e: any) => e.nextDate && e.nextDate < now
                            );
                            const nextDate = Math.min(
                              ...evts.map((e: any) => e.nextDate || Infinity)
                            );
                            const periodicity = evts[0]?.periodicity || "—";

                            // Build status summary
                            const pendingProjects = pending.map((e: any) => {
                              const p = projects.find(
                                pr => pr.id === e.projectId
                              );
                              return p?.code || "?";
                            });
                            const reportedProjects = reported.map((e: any) => {
                              const p = projects.find(
                                pr => pr.id === e.projectId
                              );
                              return p?.code || "?";
                            });

                            const allDone = pending.length === 0;
                            const hasOverdue = overdue.length > 0;

                            return (
                              <tr
                                key={name}
                                className="border-b last:border-0 hover:bg-muted/30"
                              >
                                <td className="py-2.5 px-2 font-medium">
                                  {name}
                                </td>
                                <td className="py-2.5 px-2 text-muted-foreground">
                                  {periodicity}
                                </td>
                                <td className="py-2.5 px-2 text-xs text-muted-foreground">
                                  {evts[0]?.ownerName || "—"}
                                </td>
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
                                        <span className="ml-1 text-muted-foreground">
                                          ({reportedProjects.length} reportados)
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-xs">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium border bg-amber-100 text-amber-800 border-amber-200">
                                        Pendente: {pendingProjects.join(", ")}
                                      </span>
                                      {reportedProjects.length > 0 && (
                                        <span className="ml-1 text-muted-foreground">
                                          ({reportedProjects.length} reportados)
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-2">
                                  {nextDate < Infinity ? (
                                    <span
                                      className={
                                        hasOverdue
                                          ? "text-red-600 font-medium"
                                          : ""
                                      }
                                    >
                                      {new Date(nextDate).toLocaleDateString(
                                        "pt-PT"
                                      )}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
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
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Evento")}
                        </th>
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Projeto")}
                        </th>
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Periodicidade")}
                        </th>
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Data Limite")}
                        </th>
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Responsável")}
                        </th>
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Entidade")}
                        </th>
                        <th className="py-2 px-2 font-medium text-muted-foreground">
                          {t("Estado")}
                        </th>
                        {isAdminOrDono && (
                          <th className="py-2 px-2 font-medium text-muted-foreground">
                            {t("Ação")}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {[...calEvents]
                        .sort(
                          (a: any, b: any) =>
                            (a.nextDate || 0) - (b.nextDate || 0)
                        )
                        .map((evt: any) => {
                          const isOverdue = evt.nextDate && evt.nextDate < now;
                          const statusType =
                            isOverdue && evt.status === "pending"
                              ? "overdue"
                              : evt.status;
                          const proj = projects.find(
                            p => p.id === evt.projectId
                          );
                          const badgeBg: Record<string, string> = {
                            overdue: "bg-red-100 text-red-800 border-red-200",
                            pending:
                              "bg-slate-100 text-slate-800 border-slate-200",
                            reported: "bg-sky-100 text-sky-800 border-sky-200",
                            confirmed:
                              "bg-emerald-100 text-emerald-800 dark:text-emerald-100 border-emerald-200",
                          };
                          const statusLabel: Record<string, string> = {
                            overdue: "Em Incumprimento",
                            pending: "Prazo Regulatório",
                            reported: "Submetido",
                            confirmed: "Validado pela Entidade",
                          };
                          return (
                            <tr
                              key={evt.id}
                              className="border-b last:border-0 hover:bg-muted/30"
                            >
                              <td className="py-2.5 px-2 font-medium">
                                {evt.name}
                              </td>
                              <td className="py-2.5 px-2 text-muted-foreground">
                                {proj?.code || "—"}
                              </td>
                              <td className="py-2.5 px-2 text-muted-foreground">
                                {evt.periodicity || "—"}
                              </td>
                              <td className="py-2.5 px-2">
                                {evt.nextDate
                                  ? new Date(evt.nextDate).toLocaleDateString(
                                      "pt-PT"
                                    )
                                  : "—"}
                              </td>
                              <td className="py-2.5 px-2">
                                {isAdminOrDono ? (
                                  <select
                                    className="h-7 text-xs border rounded px-1 w-full max-w-[140px]"
                                    value={evt.ownerId || ""}
                                    onChange={e => {
                                      const userId = parseInt(e.target.value);
                                      const selectedUser = users?.find(
                                        (u: any) => u.id === userId
                                      );
                                      if (selectedUser) {
                                        assignOwnerMutation.mutate({
                                          id: evt.id,
                                          ownerId: userId,
                                          ownerName:
                                            selectedUser.fullName ||
                                            selectedUser.name ||
                                            selectedUser.email ||
                                            "",
                                        });
                                      }
                                    }}
                                  >
                                    <option value="">— Selecionar —</option>
                                    {users?.map((u: any) => (
                                      <option key={u.id} value={u.id}>
                                        {u.fullName || u.name || u.email}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-muted-foreground text-xs">
                                    {evt.ownerName || "—"}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-xs">
                                {evt.entityToDeliver ? (
                                  evt.entityLink ? (
                                    <a
                                      href={evt.entityLink}
                                      target="_blank"
                                      className="text-primary underline hover:text-primary/80"
                                    >
                                      {evt.entityToDeliver}
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      {evt.entityToDeliver}
                                    </span>
                                  )
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2.5 px-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badgeBg[statusType] || ""}`}
                                >
                                  {statusLabel[statusType] || statusType}
                                </span>
                              </td>
                              {isAdminOrDono && (
                                <td className="py-2.5 px-2">
                                  {statusType === "pending" ||
                                  statusType === "overdue" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() =>
                                        updateStatusMutation.mutate({
                                          id: evt.id,
                                          status: "reported",
                                        })
                                      }
                                    >
                                      Marcar Reportado
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">
                                      {t("Data avançada automaticamente")}
                                    </span>
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
                <p className="text-sm text-muted-foreground">
                  {t("Nenhum evento de reporting criado")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inline Control Room */}
        {showControlRoom && isAdminOrDono && calEvents && (
          <Card className="overflow-hidden rounded-2xl border-violet-500/20 bg-violet-500/[0.035] shadow-[0_10px_28px_hsl(var(--shadow-color)/0.035)] dark:bg-violet-500/10">
            <CardContent className="p-4 sm:p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                {t("Gestão de Eventos")}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-border/80 bg-background/50 text-left">
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {t("Evento")}
                      </th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {t("Projeto")}
                      </th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {t("Periodicidade")}
                      </th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {t("Data")}
                      </th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {t("Responsável")}
                      </th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {t("Ações")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(calEvents as any[]).map((evt: any) => {
                      const proj = projects.find(p => p.id === evt.projectId);
                      const isEditing = editingEvent?.id === evt.id;
                      return (
                        <tr
                          key={evt.id}
                          className="border-b border-border/60 last:border-0 transition-colors hover:bg-background/60"
                        >
                          <td className="px-3 py-3 text-xs font-medium">
                            {evt.name}
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">
                            {proj?.code || "—"}
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {evt.periodicity || "—"}
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {evt.nextDate
                              ? new Date(evt.nextDate).toLocaleDateString(
                                  "pt-PT"
                                )
                              : "—"}
                          </td>
                          <td className="px-3 py-3">
                            <select
                              className="h-8 w-full max-w-[140px] rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                              value={evt.ownerId || ""}
                              onChange={e => {
                                const userId = parseInt(e.target.value);
                                const selectedUser = users?.find(
                                  (u: any) => u.id === userId
                                );
                                if (selectedUser) {
                                  assignOwnerMutation.mutate({
                                    id: evt.id,
                                    ownerId: userId,
                                    ownerName:
                                      selectedUser.fullName ||
                                      selectedUser.name ||
                                      selectedUser.email ||
                                      "",
                                  });
                                }
                              }}
                            >
                              <option value="">—</option>
                              {users?.map((u: any) => (
                                <option key={u.id} value={u.id}>
                                  {u.fullName || u.name || u.email}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                aria-label="Editar"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                title="Editar"
                                onClick={() => setEditingEvent(evt)}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                aria-label="Eliminar"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-700 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-300"
                                title="Eliminar"
                                onClick={() => {
                                  if (confirm("Eliminar este evento?"))
                                    deleteEventMutation.mutate({ id: evt.id });
                                }}
                              >
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onClick={() => setEditingEvent(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">
                {t("Editar Evento")}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">
                    {t("Nome")}
                  </label>
                  <Input
                    value={editingEvent.name}
                    onChange={e =>
                      setEditingEvent({ ...editingEvent, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {t("Periodicidade")}
                    </label>
                    <select
                      className="w-full h-9 border rounded-md px-2 text-sm"
                      value={editingEvent.periodicity || "Anual"}
                      onChange={e =>
                        setEditingEvent({
                          ...editingEvent,
                          periodicity: e.target.value,
                        })
                      }
                    >
                      <option value="Anual">{t("Anual")}</option>
                      <option value="Semestral">{t("Semestral")}</option>
                      <option value="Trimestral">{t("Trimestral")}</option>
                      <option value="Mensal">{t("Mensal")}</option>
                      <option value="Pontual">{t("Pontual")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {t("Data")}
                    </label>
                    <Input
                      type="date"
                      value={
                        editingEvent.nextDate
                          ? new Date(editingEvent.nextDate)
                              .toISOString()
                              .split("T")[0]
                          : ""
                      }
                      onChange={e =>
                        setEditingEvent({
                          ...editingEvent,
                          nextDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    Entidade (nome)
                  </label>
                  <Input
                    value={editingEvent.entityToDeliver || ""}
                    onChange={e =>
                      setEditingEvent({
                        ...editingEvent,
                        entityToDeliver: e.target.value,
                      })
                    }
                    placeholder="Ex: APA, CCDR Alentejo"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    {t("Link da Entidade (URL do portal de submissão)")}
                  </label>
                  <Input
                    value={editingEvent.entityLink || ""}
                    onChange={e =>
                      setEditingEvent({
                        ...editingEvent,
                        entityLink: e.target.value,
                      })
                    }
                    placeholder="https://siliamb.apambiente.pt"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      updateEventMutation.mutate({
                        id: editingEvent.id,
                        name: editingEvent.name,
                        periodicity: editingEvent.periodicity,
                        nextDate:
                          typeof editingEvent.nextDate === "string" &&
                          editingEvent.nextDate
                            ? new Date(editingEvent.nextDate).getTime()
                            : typeof editingEvent.nextDate === "number"
                              ? editingEvent.nextDate
                              : undefined,
                        entityToDeliver:
                          editingEvent.entityToDeliver || undefined,
                        entityLink: editingEvent.entityLink || undefined,
                      });
                      setEditingEvent(null);
                    }}
                  >
                    {t("Guardar")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingEvent(null)}
                  >
                    {t("Cancelar")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Create Event Dialog */}
        {showCreateEvent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onClick={() => setShowCreateEvent(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">
                {t("Novo Evento de Reporting")}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">
                    {t("Nome do evento")}
                  </label>
                  <Input
                    value={newEvent.name}
                    onChange={e =>
                      setNewEvent(prev => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ex: Gases Fluorados - APA"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {t("Periodicidade")}
                    </label>
                    <select
                      className="w-full h-9 border rounded-md px-2 text-sm"
                      value={newEvent.periodicity}
                      onChange={e =>
                        setNewEvent(prev => ({
                          ...prev,
                          periodicity: e.target.value,
                        }))
                      }
                    >
                      <option value="Anual">{t("Anual")}</option>
                      <option value="Semestral">{t("Semestral")}</option>
                      <option value="Trimestral">{t("Trimestral")}</option>
                      <option value="Mensal">{t("Mensal")}</option>
                      <option value="Pontual">{t("Pontual")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {t("Categoria")}
                    </label>
                    <Input
                      value={newEvent.category}
                      onChange={e =>
                        setNewEvent(prev => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                      placeholder="Ex: APA, Energia"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    {t("Próxima data de entrega")}
                  </label>
                  <Input
                    type="date"
                    value={newEvent.date}
                    onChange={e =>
                      setNewEvent(prev => ({ ...prev, date: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    {t("Entidade")}
                  </label>
                  <Input
                    value={newEvent.entityToDeliver}
                    onChange={e =>
                      setNewEvent(prev => ({
                        ...prev,
                        entityToDeliver: e.target.value,
                      }))
                    }
                    placeholder={t("Ex: APA, CCDR, Câmara Municipal")}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    Link da Entidade (URL do portal)
                  </label>
                  <Input
                    value={newEvent.entityLink}
                    onChange={e =>
                      setNewEvent(prev => ({
                        ...prev,
                        entityLink: e.target.value,
                      }))
                    }
                    placeholder="https://siliamb.apambiente.pt"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => {
                      if (!newEvent.name || !newEvent.date) {
                        toast.error("Preencha nome e data");
                        return;
                      }
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
                    }}
                    disabled={createEventMutation.isPending}
                    size="sm"
                  >
                    {createEventMutation.isPending
                      ? "A criar..."
                      : "Criar Evento"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateEvent(false)}
                  >
                    {t("Cancelar")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
