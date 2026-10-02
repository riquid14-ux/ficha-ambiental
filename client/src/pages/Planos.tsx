import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useBrandImage } from "@/hooks/useBrandImage";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { StandMetricCard } from "@/components/stand/StandMetricCard";
import { StandPageHeader } from "@/components/stand/StandPageHeader";
import {
  StandStatusBadge,
  type StandStatusTone,
} from "@/components/stand/StandStatusBadge";
import { addCivilMonths } from "@shared/reporting-calendar";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  File,
  FileText,
  Image,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Search,
  Upload,
  UserRound,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_curso: "Em curso",
  em_validacao: "Em validação",
  concluido: "Concluído",
  bloqueado: "Bloqueado",
};

function statusTone(status?: string): StandStatusTone {
  if (status === "concluido") return "success";
  if (status === "em_validacao") return "warning";
  if (status === "bloqueado") return "danger";
  if (status === "em_curso") return "info";
  return "neutral";
}

function formatDate(value?: number | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function dateInputValue(value?: number | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function toTimestamp(value: string) {
  return value ? new Date(`${value}T12:00:00`).getTime() : null;
}

async function fileToBase64(file: globalThis.File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function PlanCalendar({ plans }: { plans: any[] }) {
  const { t, language } = useLanguage();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const calendarStart = new Date(year, monthIndex, 1 - mondayOffset);
  const cells = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        calendarStart.getFullYear(),
        calendarStart.getMonth(),
        calendarStart.getDate() + index
      )
  );
  const todayKey = new Date().toDateString();
  const dateLocale = language === "en" ? "en-GB" : "pt-PT";
  const monthName = month.toLocaleDateString(dateLocale, { month: "long" });
  const calendarDays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(dateLocale, { weekday: "short" }).format(new Date(Date.UTC(2023, 0, 2 + index))),
  );

  const plansByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const plan of plans) {
      if (!plan.nextReportingDate) continue;
      const key = new Date(plan.nextReportingDate).toDateString();
      map.set(key, [...(map.get(key) || []), plan]);
    }
    return map;
  }, [plans]);

  const selectedPlans = selectedDate
    ? plansByDay.get(selectedDate.toDateString()) || []
    : [];

  return (
    <section
      aria-labelledby="plan-calendar-title"
      className="overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-[0_14px_32px_hsl(var(--shadow-color)/0.055)]"
    >
      <div className="border-b border-white/10 bg-gradient-to-br from-[#0A3638] via-[#0A3638] to-[#0A3638] px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="stand-kicker text-primary">
              {t("Calendário exclusivo dos planos")}
            </p>
            <h2
              id="plan-calendar-title"
              className="mt-2 text-xl font-semibold tracking-tight"
            >
              {t("Próximas entregas")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-white/75">{t("Sincronizado automaticamente com o calendário global e com os alertas 30/15/7 dias.")}</p>
          </div>
          <div
            className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-card/10 p-1.5 backdrop-blur sm:w-auto sm:justify-start"
            aria-label={t("Navegação do calendário")}
          >
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-card/15 hover:text-white"
              onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
              aria-label={t("Mês anterior")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              aria-live="polite"
              className="min-w-40 text-center text-sm font-semibold"
            >
              {monthName} {year}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-card/15 hover:text-white"
              onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
              aria-label={t("Mês seguinte")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-5">
        <div
          className="grid grid-cols-7 gap-1.5"
          role="grid"
          aria-label={`${t("Calendário de")} ${monthName} ${year}`}
        >
          {calendarDays.map(day => (
            <div
              key={day}
              role="columnheader"
              className="pb-1 text-center text-xs font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {cells.map(date => {
            const key = date.toDateString();
            const dayPlans = plansByDay.get(key) || [];
            const inMonth = date.getMonth() === monthIndex;
            const selected = selectedDate?.toDateString() === key;
            const overdue = dayPlans.some(
              plan => plan.nextReportingDate < Date.now()
            );
            return (
              <button
                type="button"
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                aria-pressed={selected}
                aria-label={`${date.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" })}${dayPlans.length ? `, ${dayPlans.length} ${t(dayPlans.length > 1 ? "entregas" : "entrega")}` : `, ${t("sem entregas")}`}`}
                className={`relative min-h-[72px] rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20" : "border-border hover:border-primary/35 hover:bg-muted/70"} ${inMonth ? "bg-card" : "bg-muted/45 text-muted-foreground/55"}`}
              >
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${key === todayKey ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {date.getDate()}
                </span>
                {dayPlans.length > 0 && (
                  <div className="mt-1.5 min-w-0">
                    <div
                      className={`mb-1 h-1.5 w-7 rounded-full ${overdue ? "bg-rose-500" : "bg-primary"}`}
                    />
                    <p className="truncate text-xs font-semibold text-foreground">
                      {dayPlans[0].planNumber}
                    </p>
                    {dayPlans.length > 1 && (
                      <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                        +{dayPlans.length - 1} {t("planos")}
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {selectedDate && (
          <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-sm font-semibold text-foreground">
              {selectedDate.toLocaleDateString(dateLocale, {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </p>
            {selectedPlans.length === 0 ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("Sem entregas de planos nesta data.")}
              </p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {selectedPlans.map(plan => (
                  <div
                    key={plan.id}
                    className="rounded-lg border border-border bg-card p-3 shadow-sm"
                  >
                    <span className="inline-flex rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                      {plan.planNumber}
                    </span>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                      {plan.name}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {plan.ownerName || t("Responsável por definir")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ApaReportingTimeline({ plans, user }: { plans: any[]; user: any }) {
  const { t, language } = useLanguage();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data: board = [], isLoading } = trpc.monitoringPlans.apaReportingBoard.useQuery({ year });
  const [selectedKey, setSelectedKey] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submittedDate, setSubmittedDate] = useState("");
  const [reportType, setReportType] = useState<"rdcd" | "relatorio_anual_dcape" | "outro">("rdcd");
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const dateLocale = language === "en" ? "en-GB" : "pt-PT";
  const formatTimelineDate = (value?: number | null) => value
    ? new Date(value).toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" })
    : t("Sem data");
  const occurrenceKey = (item: any) => `${item.calendarEvent.id}:${item.occurrenceAt}`;
  const selected = board.find((item: any) => occurrenceKey(item) === selectedKey) || board[0] || null;
  const maximumDueAt = receivedDate ? addCivilMonths(toTimestamp(receivedDate)!, 3) : null;

  const refresh = async () => {
    await Promise.all([
      utils.monitoringPlans.apaReportingBoard.invalidate(),
      utils.monitoringPlans.list.invalidate(),
      utils.calendarEvents.list.invalidate(),
    ]);
  };
  const cycleMutation = trpc.monitoringPlans.configureApaReportingCycle.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success(t("Ciclo RDCD e APA atualizado"));
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!selected) return;
    setSelectedKey(occurrenceKey(selected));
    const cycle = selected.cycle;
    setReceivedDate(dateInputValue(cycle?.receivedAt));
    setDueDate(dateInputValue(cycle?.submissionDueAt));
    setSubmittedDate(dateInputValue(cycle?.submittedAt));
    setReportType(cycle?.reportType || (selected.calendarEvent.name.toLocaleLowerCase("pt-PT").includes("rdcd") ? "rdcd" : "relatorio_anual_dcape"));
    setSelectedPlanIds((cycle?.plans || []).map((plan: any) => plan.id));
  }, [selectedKey, selected?.cycle?.id, selected?.occurrenceAt]);

  function togglePlan(planId: number) {
    setSelectedPlanIds(current => current.includes(planId)
      ? current.filter(id => id !== planId)
      : [...current, planId]);
  }

  function saveCycle() {
    if (!selected || !receivedDate || selectedPlanIds.length === 0) return;
    const receivedAt = toTimestamp(receivedDate)!;
    cycleMutation.mutate({
      id: selected.cycle?.id,
      calendarEventId: selected.calendarEvent.id,
      occurrenceAt: selected.occurrenceAt,
      reportType,
      receivedAt,
      submissionDueAt: toTimestamp(dueDate) ?? addCivilMonths(receivedAt, 3),
      submittedAt: toTimestamp(submittedDate),
      planIds: selectedPlanIds,
    });
  }

  return (
    <section aria-labelledby="apa-reporting-title" className="overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-[0_14px_32px_hsl(var(--shadow-color)/0.055)]">
      <div className="border-b border-white/10 bg-gradient-to-br from-[#0A3638] via-[#0A3638] to-[#0A3638] px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="stand-kicker text-primary">{t("Control room APA conectada")}</p>
            <h2 id="apa-reporting-title" className="mt-2 text-xl font-semibold tracking-tight">{t("Ciclos RDCD, planos agrupados e entrega à APA")}</h2>
            <p className="mt-1 text-sm leading-6 text-white/75">{t("A timeline usa os eventos RDCD já existentes no calendário global. Em cada ocorrência, indique a receção, agrupe os planos aplicáveis e o limite máximo APA é calculado a três meses civis.")}</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-card/10 px-3 py-2 text-xs leading-5 text-white/80">
            <p className="font-semibold text-white">{t("Regra de ouro")}</p>
            <p>{t("Receção do reporte + 3 meses civis = limite máximo APA")}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="stand-kicker text-primary">{t("Timeline anual de reporte")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("Navegue entre anos para antecipar janelas de receção e limites APA.")}</p>
          </div>
          <div className="flex items-center rounded-xl border border-border bg-muted/30 p-1">
            <Button variant="ghost" size="icon" onClick={() => setYear(value => value - 1)} aria-label={t("Ano anterior")}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-20 text-center text-sm font-semibold text-foreground">{year}</span>
            <Button variant="ghost" size="icon" onClick={() => setYear(value => value + 1)} aria-label={t("Ano seguinte")}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-36 animate-pulse rounded-xl bg-muted" />
        ) : board.length === 0 ? (
          <div className="rounded-xl border border-dashed border-primary/35 bg-primary/[0.035] px-5 py-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-sm font-semibold text-foreground">{t("Não existem eventos RDCD ou Relatório Anual DCAPE no calendário deste ano")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Registe o evento no Calendário de Reporting; ele aparecerá automaticamente nesta timeline anual.")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-1">
            <div className="relative min-w-[760px] py-6" aria-label={t("Timeline anual de reporte APA") }>
              <div aria-hidden="true" className="absolute left-8 right-8 top-1/2 h-px -translate-y-1/2 bg-border" />
              <div className="grid grid-cols-1 gap-3">
                {board.map((item: any, index: number) => {
                  const cycle = item.cycle;
                  const selectedItem = occurrenceKey(item) === occurrenceKey(selected || item);
                  const overdue = Boolean(cycle?.submissionDueAt && !cycle?.submittedAt && cycle.submissionDueAt < Date.now());
                  return (
                    <button
                      key={occurrenceKey(item)}
                      type="button"
                      onClick={() => setSelectedKey(occurrenceKey(item))}
                      className={`relative z-10 grid grid-cols-[150px_44px_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectedItem ? "border-primary bg-primary/[0.055] ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/40 hover:bg-muted/35"}`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">{formatTimelineDate(item.occurrenceAt)}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.calendarEvent.name}</p>
                      </div>
                      <span className={`mx-auto h-4 w-4 rounded-full border-4 border-card shadow-sm ${cycle?.submittedAt ? "bg-emerald-500" : overdue ? "bg-rose-500" : cycle ? "bg-amber-500" : "bg-primary"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{cycle ? `${cycle.plans.length} ${t("planos agrupados")}` : t("Por configurar")}</p>
                        <p className={`mt-0.5 text-xs ${overdue ? "text-rose-600 dark:text-rose-300" : "text-muted-foreground"}`}>
                          {cycle?.receivedAt ? `${t("Recebido")}: ${formatTimelineDate(cycle.receivedAt)} · ${t("Limite APA")}: ${formatTimelineDate(cycle.submissionDueAt)}` : t("Selecione para iniciar o ciclo de reporte")}
                          {cycle?.submittedAt ? ` · ${t("Enviado")}: ${formatTimelineDate(cycle.submittedAt)}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-4">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary" />{t("Ocorrência RDCD no calendário")}</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" />{t("Em preparação para APA")}</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" />{t("Enviado à APA")}</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-500" />{t("Prazo vencido")}</span>
        </div>

        {selected && (
          <div className="rounded-xl border border-border bg-muted/35 p-4 sm:p-5">
            <div className="flex flex-col gap-2 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="stand-kicker text-primary">{t("Ciclo selecionado")}</p>
                <h3 className="mt-1 text-base font-semibold text-foreground">{selected.calendarEvent.name} · {formatTimelineDate(selected.occurrenceAt)}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Os planos selecionados partilham um único evento de entrega APA, que é visível também no Calendário de Reporting.")}</p>
              </div>
              {!isAdmin && <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">{t("Só leitura")}</span>}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label htmlFor="cycle-type" className="text-xs font-semibold text-muted-foreground">{t("Reporte")}</label>
                <Select value={reportType} onValueChange={(value: any) => setReportType(value)} disabled={!isAdmin}>
                  <SelectTrigger id="cycle-type" className="mt-1.5 bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="rdcd">RDCD</SelectItem><SelectItem value="relatorio_anual_dcape">{t("Relatório Anual DCAPE")}</SelectItem><SelectItem value="outro">{t("Outro reporte APA")}</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="cycle-received" className="text-xs font-semibold text-muted-foreground">{t("Receção do reporte")}</label>
                <Input id="cycle-received" type="date" className="mt-1.5 bg-card" value={receivedDate} disabled={!isAdmin} onChange={event => { const value = event.target.value; setReceivedDate(value); const timestamp = toTimestamp(value); if (timestamp) setDueDate(dateInputValue(addCivilMonths(timestamp, 3))); }} />
              </div>
              <div>
                <label htmlFor="cycle-due" className="text-xs font-semibold text-muted-foreground">{t("Entrega máxima APA")}</label>
                <Input id="cycle-due" type="date" className="mt-1.5 bg-card" value={dueDate} disabled={!isAdmin} onChange={event => setDueDate(event.target.value)} />
              </div>
              <div>
                <label htmlFor="cycle-submitted" className="text-xs font-semibold text-muted-foreground">{t("Envio efetivo APA")}</label>
                <Input id="cycle-submitted" type="date" className="mt-1.5 bg-card" value={submittedDate} disabled={!isAdmin} onChange={event => setSubmittedDate(event.target.value)} />
              </div>
            </div>
            {maximumDueAt && <p className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.045] px-3 py-2 text-xs text-foreground">{t("Limite legal calculado")}: <span className="font-semibold">{formatTimelineDate(maximumDueAt)}</span>. {t("Pode antecipar, mas não ultrapassar esta data.")}</p>}

            <div className="mt-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{t("Planos a integrar nesta emissão")}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{t("Selecione todos os planos que serão consolidados no mesmo RDCD ou reporte anual.")}</p>
                </div>
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground">{selectedPlanIds.length} {t("selecionados")}</span>
              </div>
              <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {plans.map(plan => {
                  const checked = selectedPlanIds.includes(plan.id);
                  return <label key={plan.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${checked ? "border-primary/50 bg-primary/[0.055]" : "border-border bg-card hover:border-primary/35"}`}>
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={checked} disabled={!isAdmin} onChange={() => togglePlan(plan.id)} />
                    <span className="min-w-0"><span className="block text-xs font-bold text-primary">{plan.planNumber}</span><span className="mt-0.5 block line-clamp-2 text-xs font-medium leading-5 text-foreground">{plan.name}</span></span>
                  </label>;
                })}
              </div>
            </div>
            {isAdmin && <div className="mt-5 flex justify-end"><Button size="sm" onClick={saveCycle} disabled={!receivedDate || selectedPlanIds.length === 0 || cycleMutation.isPending}>{cycleMutation.isPending ? t("A guardar...") : <><Save className="mr-2 h-4 w-4" />{t("Guardar ciclo RDCD / APA")}</>}</Button></div>}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Planos() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { isAllProjects, canSeeAllProjects } = useProject();
  const [, setLocation] = useLocation();
  const plansImage = useBrandImage("planos");
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newPlan, setNewPlan] = useState({
    planNumber: "",
    name: "",
    category: "programa_monitorizacao" as const,
    periodicity: "",
    notes: "",
  });

  // A lista é intencionalmente global: cada plano DCAPE é universal e não se
  // replica por projeto. A navegação já só a expõe em "Todos os Projetos"; este
  // guard protege também URLs diretos guardados antes desta alteração.
  useEffect(() => {
    if (!isAllProjects) setLocation(canSeeAllProjects ? "/dashboard" : "/welcome");
  }, [canSeeAllProjects, isAllProjects, setLocation]);
  const { data: plans = [], isLoading } = trpc.monitoringPlans.list.useQuery(
    undefined,
    { enabled: isAllProjects }
  );
  const utils = trpc.useUtils();
  const createMutation = trpc.monitoringPlans.create.useMutation({
    onSuccess: async () => {
      await utils.monitoringPlans.list.invalidate();
      setShowCreate(false);
      setNewPlan({
        planNumber: "",
        name: "",
        category: "programa_monitorizacao",
        periodicity: "",
        notes: "",
      });
      toast.success("Plano criado com sucesso");
    },
    onError: error => toast.error(error.message),
  });

  const sortedPlans = useMemo(
    () =>
      [...plans].sort((a: any, b: any) => {
        const aDate = a.nextReportingDate || Number.MAX_SAFE_INTEGER;
        const bDate = b.nextReportingDate || Number.MAX_SAFE_INTEGER;
        if (aDate !== bDate) return aDate - bDate;
        return String(a.planNumber || "").localeCompare(
          String(b.planNumber || ""),
          "pt",
          { numeric: true }
        );
      }),
    [plans]
  );

  const filteredPlans = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("pt-PT");
    return sortedPlans.filter((plan: any) => {
      const matchesStatus =
        statusFilter === "all" || plan.status === statusFilter;
      const searchable = [
        plan.planNumber,
        plan.name,
        plan.ownerName,
        plan.supportName,
        plan.supportCompany,
        plan.latestUpdate?.updateText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-PT");
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [searchQuery, sortedPlans, statusFilter]);

  const stats = useMemo(() => {
    const now = Date.now();
    const monthAhead = now + 30 * 86400000;
    return {
      total: plans.length,
      overdue: plans.filter(
        (plan: any) => plan.nextReportingDate && plan.nextReportingDate < now
      ).length,
      next30: plans.filter(
        (plan: any) =>
          plan.nextReportingDate &&
          plan.nextReportingDate >= now &&
          plan.nextReportingDate <= monthAhead
      ).length,
      updated: plans.filter((plan: any) => plan.latestUpdate).length,
    };
  }, [plans]);

  async function exportUpdates() {
    if (plans.length === 0)
      return toast.error("Não existem planos para exportar.");
    try {
      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        HeadingLevel,
        Table,
        TableRow,
        TableCell,
        WidthType,
        ShadingType,
      } = await import("docx");
      const rows = sortedPlans.map(
        (plan: any) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 8, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: plan.planNumber || `P-${plan.id}`,
                        bold: true,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 22, type: WidthType.PERCENTAGE },
                children: [new Paragraph(plan.name)],
              }),
              new TableCell({
                width: { size: 10, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph(STATUS_LABELS[plan.status] || plan.status),
                ],
              }),
              new TableCell({
                width: { size: 13, type: WidthType.PERCENTAGE },
                children: [new Paragraph(plan.ownerName || "Por definir")],
              }),
              new TableCell({
                width: { size: 13, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph(
                    [plan.supportName, plan.supportCompany]
                      .filter(Boolean)
                      .join(" — ") || "Por definir"
                  ),
                ],
              }),
              new TableCell({
                width: { size: 12, type: WidthType.PERCENTAGE },
                children: [new Paragraph(formatDate(plan.nextReportingDate))],
              }),
              new TableCell({
                width: { size: 22, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph(
                    plan.latestUpdate?.updateText || "Sem update registado"
                  ),
                  ...(plan.latestUpdate
                    ? [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `${plan.latestUpdate.createdByName} · ${formatDateTime(plan.latestUpdate.createdAt)}`,
                              italics: true,
                              size: 18,
                            }),
                          ],
                        }),
                      ]
                    : []),
                ],
              }),
            ],
          })
      );
      const header = new TableRow({
        tableHeader: true,
        children: [
          "N.º",
          "Plano",
          "Estado",
          "Responsável interno",
          "Suporte",
          "Próxima entrega",
          "Último update",
        ].map(
          text =>
            new TableCell({
              shading: {
                type: ShadingType.CLEAR,
                color: "auto",
                fill: "006341",
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text, bold: true, color: "FFFFFF" }),
                  ],
                }),
              ],
            })
        ),
      });
      const wordDocument = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: "Actualização dos Planos de Monitorização",
                heading: HeadingLevel.TITLE,
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Âmbito: ", bold: true }),
                  new TextRun(
                    "20 planos universais aplicáveis a todos os projectos"
                  ),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Gerado em: ", bold: true }),
                  new TextRun(new Date().toLocaleString("pt-PT")),
                ],
              }),
              new Paragraph({ text: "" }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [header, ...rows],
              }),
            ],
          },
        ],
      });
      const blob = await Packer.toBlob(wordDocument);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `Atualizacao_Planos_Universais_${new Date().toISOString().slice(0, 10)}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Documento Word exportado");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível gerar o documento Word.");
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl space-y-4 p-6">
          <div className="h-10 w-80 animate-pulse rounded bg-muted" />
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <StandPageHeader
          eyebrow="Controlo e reporting"
          title={t("Planos de Monitorização")}
          description="Calendário, responsáveis, evidências e último estado de cada plano numa única visão."
          context={t("Todos os Projetos")}
          tone="operations"
          image={plansImage.url}
          imagePosition={plansImage.position}
          imageMode={plansImage.mode}
          actions={
            <>
              <Button
                variant="outline"
                className="border-white/20 bg-card/10 text-white hover:bg-card/20 hover:text-white"
                onClick={exportUpdates}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar updates
              </Button>
              {isAdminOrDono && (
                <Dialog open={showCreate} onOpenChange={setShowCreate}>
                  <DialogTrigger asChild>
                    <Button className="bg-card text-primary hover:bg-primary">
                      <Plus className="mr-2 h-4 w-4" />
                      Novo plano
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Criar novo plano</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label
                            htmlFor="new-plan-number"
                            className="text-xs font-semibold text-muted-foreground"
                          >
                            Número
                          </label>
                          <Input
                            id="new-plan-number"
                            className="mt-1.5"
                            value={newPlan.planNumber}
                            onChange={event =>
                              setNewPlan(value => ({
                                ...value,
                                planNumber: event.target.value,
                              }))
                            }
                            placeholder="P-21"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="new-plan-name"
                            className="text-xs font-semibold text-muted-foreground"
                          >
                            Nome
                          </label>
                          <Input
                            id="new-plan-name"
                            className="mt-1.5"
                            value={newPlan.name}
                            onChange={event =>
                              setNewPlan(value => ({
                                ...value,
                                name: event.target.value,
                              }))
                            }
                            placeholder="Nome do plano"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="new-plan-category"
                          className="text-xs font-semibold text-muted-foreground"
                        >
                          Categoria
                        </label>
                        <Select
                          value={newPlan.category}
                          onValueChange={(value: any) =>
                            setNewPlan(plan => ({ ...plan, category: value }))
                          }
                        >
                          <SelectTrigger
                            id="new-plan-category"
                            className="mt-1.5"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="programa_monitorizacao">
                              Programa de Monitorização
                            </SelectItem>
                            <SelectItem value="plano_projeto">
                              Plano/Projecto
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label
                          htmlFor="new-plan-periodicity"
                          className="text-xs font-semibold text-muted-foreground"
                        >
                          Periodicidade
                        </label>
                        <Input
                          id="new-plan-periodicity"
                          className="mt-1.5"
                          value={newPlan.periodicity}
                          onChange={event =>
                            setNewPlan(value => ({
                              ...value,
                              periodicity: event.target.value,
                            }))
                          }
                          placeholder="Periodicidade (ex.: Semestral)"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="new-plan-notes"
                          className="text-xs font-semibold text-muted-foreground"
                        >
                          Notas adicionais
                        </label>
                        <Textarea
                          id="new-plan-notes"
                          className="mt-1.5"
                          value={newPlan.notes}
                          onChange={event =>
                            setNewPlan(value => ({
                              ...value,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Notas adicionais"
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={!newPlan.name || createMutation.isPending}
                        onClick={() =>
                          createMutation.mutate({
                            name: newPlan.name,
                            planNumber: newPlan.planNumber || undefined,
                            category: newPlan.category,
                            periodicity: newPlan.periodicity || undefined,
                            notes: newPlan.notes || undefined,
                          })
                        }
                      >
                        {createMutation.isPending
                          ? "A criar..."
                          : "Criar plano"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          }
        />

        <section
          aria-label="Resumo de decisão dos planos"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StandMetricCard
            label="Planos acompanhados"
            value={stats.total}
            detail="Âmbito total em monitorização"
            icon={FileText}
            tone="brand"
          />
          <StandMetricCard
            label="Em atraso"
            value={stats.overdue}
            detail={
              stats.overdue
                ? "Requer priorização imediata"
                : "Sem entregas vencidas"
            }
            icon={AlertTriangle}
            tone={stats.overdue ? "danger" : "neutral"}
          />
          <StandMetricCard
            label="Próximos 30 dias"
            value={stats.next30}
            detail="Entregas a preparar no período"
            icon={CalendarDays}
            tone="warning"
          />
          <StandMetricCard
            label="Com update"
            value={stats.updated}
            detail="Planos com atualização registada"
            icon={CheckCircle2}
            tone="success"
          />
        </section>

        <PlanCalendar plans={plans as any[]} />

        <ApaReportingTimeline plans={plans as any[]} user={user} />

        <section aria-labelledby="plans-heading" className="space-y-4">
          <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="stand-kicker text-primary">Registo operacional</p>
              <h2
                id="plans-heading"
                className="mt-1 text-xl font-semibold tracking-tight"
              >
                Acompanhamento dos planos
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Ordenado pela próxima entrega. Cada update mantém autor e data.
              </p>
            </div>
            <p className="inline-flex h-8 w-fit items-center rounded-full border border-border bg-muted px-3 text-xs font-semibold text-muted-foreground">
              {filteredPlans.length} de {sortedPlans.length} registos
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-border bg-muted/45 p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_240px] sm:p-4">
            <div className="relative">
              <label htmlFor="plan-search" className="sr-only">
                Pesquisar planos
              </label>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="plan-search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="h-10 bg-card pl-10"
                placeholder="Pesquisar por número, plano, responsável ou update..."
              />
            </div>
            <div>
              <label htmlFor="plan-status-filter" className="sr-only">
                Filtrar por estado
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="plan-status-filter" className="h-10 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filteredPlans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center shadow-sm">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-4 text-sm font-semibold text-foreground">
                Ainda não existem planos para este contexto.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ajuste os filtros ou seleccione outro contexto de projeto.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlans.map((plan: any) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  user={user}
                  projectId={undefined}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function PlanCard({
  plan,
  user,
  projectId,
}: {
  plan: any;
  user: any;
  projectId?: number;
}) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [status, setStatus] = useState(plan.status || "nao_iniciado");
  const [updateText, setUpdateText] = useState("");
  const [ownerId, setOwnerId] = useState(
    plan.ownerId ? String(plan.ownerId) : "none"
  );
  const [supportName, setSupportName] = useState(plan.supportName || "");
  const [supportCompany, setSupportCompany] = useState(
    plan.supportCompany || ""
  );
  const [supportEmail, setSupportEmail] = useState(plan.supportEmail || "");
  const [supportPhone, setSupportPhone] = useState(plan.supportPhone || "");
  const [nextDate, setNextDate] = useState(
    dateInputValue(plan.nextReportingDate)
  );
  const [lastDate, setLastDate] = useState(
    dateInputValue(plan.lastReportingDate)
  );
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";
  const canUpdate =
    isAdminOrDono || user?.role === "raa" || plan.ownerId === user?.id;
  const isOverdue =
    plan.nextReportingDate && plan.nextReportingDate < Date.now();

  const { data: candidates = [] } =
    trpc.monitoringPlans.responsibleCandidates.useQuery(undefined, {
      enabled: Boolean(expanded && isAdminOrDono),
    });
  const { data: history } = trpc.monitoringPlans.history.useQuery(
    { planId: plan.id, projectId },
    { enabled: showHistory }
  );
  const refresh = async () => {
    await Promise.all([
      utils.monitoringPlans.list.invalidate(),
      utils.calendarEvents.list.invalidate(),
    ]);
  };
  const configureMutation = trpc.monitoringPlans.configure.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Responsável e prazos actualizados");
    },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.monitoringPlans.addUpdate.useMutation({
    onSuccess: async () => {
      await refresh();
      setUpdateText("");
      toast.success("Status update registado");
    },
    onError: error => toast.error(error.message),
  });
  const uploadMutation = trpc.monitoringPlans.uploadAttachment.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Anexo guardado com segurança");
    },
    onError: error => toast.error(error.message),
  });
  const confirmMutation = trpc.monitoringPlans.confirmDelivery.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Entrega confirmada e próximo prazo actualizado");
    },
    onError: error => toast.error(error.message),
  });

  async function uploadFile(file?: globalThis.File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024)
      return toast.error("O ficheiro excede o limite de 10MB.");
    const fileBase64 = await fileToBase64(file);
    uploadMutation.mutate({
      planId: plan.id,
      projectId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      fileBase64,
    });
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-card shadow-[0_8px_24px_hsl(var(--shadow-color)/0.05)] ${isOverdue ? "border-l-4 border-l-rose-600" : plan.status === "concluido" ? "border-l-4 border-l-emerald-600" : "border-l-4 border-l-primary"}`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="flex min-w-0 flex-1 gap-3">
            <span className="inline-flex h-fit shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-xs font-bold tracking-wide text-primary-foreground">
              {plan.planNumber || `P-${String(plan.id).padStart(2, "0")}`}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold leading-6 text-foreground">
                  {plan.name}
                </h3>
                <StandStatusBadge
                  label={STATUS_LABELS[plan.status] || plan.status}
                  tone={statusTone(plan.status)}
                />
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {plan.category === "programa_monitorizacao"
                  ? "Programa de Monitorização"
                  : "Plano/Projecto"}
                {plan.periodicity ? ` · ${plan.periodicity}` : ""}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[620px] xl:shrink-0">
            <InfoBlock
              icon={<UserRound className="h-4 w-4" />}
              label="Responsável interno"
              value={plan.ownerName || "Por definir"}
            />
            <InfoBlock
              icon={<UserRound className="h-4 w-4" />}
              label="Suporte"
              value={
                [plan.supportName, plan.supportCompany]
                  .filter(Boolean)
                  .join(" — ") || "Por definir"
              }
            />
            <InfoBlock
              icon={<CalendarDays className="h-4 w-4" />}
              label="Próxima entrega"
              value={formatDate(plan.nextReportingDate)}
              alert={Boolean(isOverdue)}
            />
            <InfoBlock
              icon={<Paperclip className="h-4 w-4" />}
              label="Anexos"
              value={String(plan.attachmentCount || 0)}
            />
          </dl>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-muted/55 p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="stand-kicker text-muted-foreground">
                Último status update
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {plan.latestUpdate?.updateText ||
                  "Ainda não foi registada uma actualização para este plano."}
              </p>
              {plan.latestUpdate && (
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {plan.latestUpdate.createdByName} ·{" "}
                  {formatDateTime(plan.latestUpdate.createdAt)}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowHistory(true)}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Histórico
              </Button>
              {(canUpdate || isAdminOrDono) && (
                <Button
                  size="sm"
                  onClick={() => setExpanded(value => !value)}
                  aria-expanded={expanded}
                >
                  {expanded ? (
                    <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-180" />
                  ) : (
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {expanded ? "Fechar" : "Actualizar"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/30 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {isAdminOrDono && (
              <section
                aria-labelledby={`plan-config-${plan.id}`}
                className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div>
                  <h4
                    id={`plan-config-${plan.id}`}
                    className="text-sm font-semibold text-foreground"
                  >
                    Responsáveis e calendário
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    O responsável interno tem conta; o suporte pode não estar
                    registado.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor={`plan-owner-${plan.id}`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Responsável interno
                  </label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger
                      id={`plan-owner-${plan.id}`}
                      className="mt-1.5"
                    >
                      <SelectValue placeholder="Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {candidates.map((candidate: any) => (
                        <SelectItem
                          key={candidate.id}
                          value={String(candidate.id)}
                        >
                          {candidate.name} — {candidate.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`support-name-${plan.id}`}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Nome do suporte
                    </label>
                    <Input
                      id={`support-name-${plan.id}`}
                      className="mt-1.5"
                      value={supportName}
                      onChange={event => setSupportName(event.target.value)}
                      placeholder="Nome do suporte"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`support-company-${plan.id}`}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Empresa/entidade
                    </label>
                    <Input
                      id={`support-company-${plan.id}`}
                      className="mt-1.5"
                      value={supportCompany}
                      onChange={event => setSupportCompany(event.target.value)}
                      placeholder="Empresa/entidade"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`support-email-${plan.id}`}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Email do suporte
                    </label>
                    <Input
                      id={`support-email-${plan.id}`}
                      className="mt-1.5"
                      type="email"
                      value={supportEmail}
                      onChange={event => setSupportEmail(event.target.value)}
                      placeholder="Email do suporte"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`support-phone-${plan.id}`}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Telefone
                    </label>
                    <Input
                      id={`support-phone-${plan.id}`}
                      className="mt-1.5"
                      value={supportPhone}
                      onChange={event => setSupportPhone(event.target.value)}
                      placeholder="Telefone (opcional)"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`last-date-${plan.id}`}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Última entrega
                    </label>
                    <Input
                      id={`last-date-${plan.id}`}
                      className="mt-1.5"
                      type="date"
                      value={lastDate}
                      onChange={event => setLastDate(event.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`next-date-${plan.id}`}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Próxima entrega
                    </label>
                    <Input
                      id={`next-date-${plan.id}`}
                      className="mt-1.5"
                      type="date"
                      value={nextDate}
                      onChange={event => setNextDate(event.target.value)}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={configureMutation.isPending}
                  onClick={() =>
                    configureMutation.mutate({
                      planId: plan.id,
                      ownerId: ownerId === "none" ? null : Number(ownerId),
                      supportName: supportName.trim() || null,
                      supportCompany: supportCompany.trim() || null,
                      supportEmail: supportEmail.trim() || null,
                      supportPhone: supportPhone.trim() || null,
                      lastReportingDate: toTimestamp(lastDate),
                      nextReportingDate: toTimestamp(nextDate),
                    })
                  }
                >
                  <Save className="mr-2 h-4 w-4" />
                  Guardar responsáveis e datas
                </Button>
              </section>
            )}

            {canUpdate && (
              <section
                aria-labelledby={`plan-update-${plan.id}`}
                className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div>
                  <h4
                    id={`plan-update-${plan.id}`}
                    className="text-sm font-semibold text-foreground"
                  >
                    Novo status update
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    O texto, autor e data ficam guardados no histórico.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor={`plan-status-${plan.id}`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Estado
                  </label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger
                      id={`plan-status-${plan.id}`}
                      className="mt-1.5"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label
                    htmlFor={`plan-update-text-${plan.id}`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Actualização
                  </label>
                  <Textarea
                    id={`plan-update-text-${plan.id}`}
                    className="mt-1.5"
                    value={updateText}
                    onChange={event => setUpdateText(event.target.value)}
                    placeholder="Descreva o progresso, constrangimentos e próximos passos..."
                    rows={5}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={
                    !projectId ||
                    updateText.trim().length < 3 ||
                    updateMutation.isPending
                  }
                  onClick={() =>
                    projectId &&
                    updateMutation.mutate({
                      planId: plan.id,
                      projectId,
                      status: status as any,
                      updateText,
                    })
                  }
                >
                  <Save className="mr-2 h-4 w-4" />
                  Registar update
                </Button>
              </section>
            )}
          </div>

          {canUpdate && (
            <section
              aria-label="Fotografias e anexos"
              className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Fotografias e anexos
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  PDF, Word, Excel ou imagens até 10MB. Todos os ficheiros são
                  analisados antes de serem guardados.
                </p>
              </div>
              <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-primary/25 bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/10 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <Upload className="mr-2 h-4 w-4" />
                {uploadMutation.isPending
                  ? "A enviar..."
                  : "Adicionar ficheiro"}
                <input
                  type="file"
                  className="sr-only"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  disabled={uploadMutation.isPending}
                  onChange={event => uploadFile(event.target.files?.[0])}
                />
              </label>
            </section>
          )}

          {plan.submissionStatus === "submitted" && canUpdate && (
            <Button
              className="mt-4"
              variant="outline"
              onClick={() =>
                projectId &&
                confirmMutation.mutate({ planId: plan.id, projectId })
              }
              disabled={!projectId || confirmMutation.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar entrega à entidade competente
            </Button>
          )}
        </div>
      )}

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {plan.planNumber} — Histórico e evidências
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Actualizações</h4>
              {history?.updates?.length ? (
                <div className="space-y-2">
                  {history.updates.map((update: any) => (
                    <div
                      key={update.id}
                      className="rounded-xl border border-border bg-muted/35 p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StandStatusBadge
                          label={STATUS_LABELS[update.status] || update.status}
                          tone={statusTone(update.status)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(update.createdAt)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-foreground">
                        {update.updateText}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Por {update.createdByName}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sem actualizações registadas.
                </p>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">
                Fotografias e anexos
              </h4>
              {history?.attachments?.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {history.attachments.map((attachment: any) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() =>
                        window.open(
                          attachment.url,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.035]"
                    >
                      {attachment.type === "photo" ? (
                        <Image className="h-5 w-5 text-primary dark:text-primary" />
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {attachment.filename}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {attachment.uploadedByName} ·{" "}
                          {formatDateTime(attachment.uploadedAt)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem anexos.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function InfoBlock({
  icon,
  label,
  value,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border px-3 py-2.5 ${alert ? "border-rose-500/25 bg-rose-500/[0.07]" : "border-border bg-muted/45"}`}
    >
      <dt
        className={`flex items-center gap-1.5 text-xs font-semibold ${alert ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"}`}
      >
        {icon}
        {label}
      </dt>
      <dd
        className={`mt-1 truncate text-xs font-semibold leading-5 ${alert ? "text-rose-800 dark:text-rose-200" : "text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}
