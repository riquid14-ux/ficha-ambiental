import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
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

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const STATUS_LABELS: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_curso: "Em curso",
  em_validacao: "Em validação",
  concluido: "Concluído",
  bloqueado: "Bloqueado",
};

const STATUS_STYLES: Record<string, string> = {
  nao_iniciado: "bg-slate-100 text-slate-700 border-slate-200",
  em_curso: "bg-blue-50 text-blue-700 border-blue-200",
  em_validacao: "bg-amber-50 text-amber-700 border-amber-200",
  concluido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  bloqueado: "bg-red-50 text-red-700 border-red-200",
};

function formatDate(value?: number | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
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
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const calendarStart = new Date(year, monthIndex, 1 - mondayOffset);
  const cells = Array.from({ length: 42 }, (_, index) => new Date(calendarStart.getFullYear(), calendarStart.getMonth(), calendarStart.getDate() + index));
  const todayKey = new Date().toDateString();

  const plansByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const plan of plans) {
      if (!plan.nextReportingDate) continue;
      const key = new Date(plan.nextReportingDate).toDateString();
      map.set(key, [...(map.get(key) || []), plan]);
    }
    return map;
  }, [plans]);

  const selectedPlans = selectedDate ? plansByDay.get(selectedDate.toDateString()) || [] : [];

  return (
    <Card className="overflow-hidden border-emerald-100 shadow-sm">
      <div className="bg-gradient-to-r from-[#006341] to-[#008f67] px-5 py-4 text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Calendário exclusivo dos planos</p>
            <h2 className="mt-1 text-xl font-bold">Próximas entregas</h2>
            <p className="mt-1 text-sm text-emerald-50">Sincronizado automaticamente com o calendário global e com os alertas 30/15/7 dias.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/10 p-1 backdrop-blur">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold">{MONTHS_PT[monthIndex]} {year}</span>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} aria-label="Mês seguinte">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-7 gap-1">
          {DAYS_PT.map(day => <div key={day} className="pb-1 text-center text-[11px] font-semibold text-muted-foreground">{day}</div>)}
          {cells.map((date) => {
            const key = date.toDateString();
            const dayPlans = plansByDay.get(key) || [];
            const inMonth = date.getMonth() === monthIndex;
            const selected = selectedDate?.toDateString() === key;
            const overdue = dayPlans.some(plan => plan.nextReportingDate < Date.now());
            return (
              <button
                type="button"
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`relative min-h-16 rounded-lg border p-1.5 text-left transition ${selected ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40"} ${inMonth ? "bg-white" : "bg-slate-50 text-slate-300"}`}
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${key === todayKey ? "bg-[#006341] text-white" : ""}`}>{date.getDate()}</span>
                {dayPlans.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${overdue ? "bg-red-500" : "bg-emerald-500"}`} />
                    <p className="truncate text-[9px] font-medium text-slate-700">{dayPlans[0].planNumber}</p>
                    {dayPlans.length > 1 && <p className="text-[9px] text-muted-foreground">+{dayPlans.length - 1}</p>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {selectedDate && (
          <div className="mt-4 rounded-xl border bg-slate-50 p-3">
            <p className="text-sm font-semibold">{selectedDate.toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" })}</p>
            {selectedPlans.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Sem entregas de planos nesta data.</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {selectedPlans.map(plan => (
                  <div key={plan.id} className="rounded-lg border bg-white p-2.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{plan.planNumber}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-medium">{plan.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{plan.ownerName || "Responsável por definir"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Planos() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newPlan, setNewPlan] = useState({ planNumber: "", name: "", category: "programa_monitorizacao" as const, periodicity: "", notes: "" });

  const { data: plans = [], isLoading } = trpc.monitoringPlans.list.useQuery();
  const utils = trpc.useUtils();
  const createMutation = trpc.monitoringPlans.create.useMutation({
    onSuccess: async () => {
      await utils.monitoringPlans.list.invalidate();
      setShowCreate(false);
      setNewPlan({ planNumber: "", name: "", category: "programa_monitorizacao", periodicity: "", notes: "" });
      toast.success("Plano criado com sucesso");
    },
    onError: error => toast.error(error.message),
  });

  const sortedPlans = useMemo(() => [...plans].sort((a: any, b: any) => {
    const aDate = a.nextReportingDate || Number.MAX_SAFE_INTEGER;
    const bDate = b.nextReportingDate || Number.MAX_SAFE_INTEGER;
    if (aDate !== bDate) return aDate - bDate;
    return String(a.planNumber || "").localeCompare(String(b.planNumber || ""), "pt", { numeric: true });
  }), [plans]);

  const filteredPlans = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("pt-PT");
    return sortedPlans.filter((plan: any) => {
      const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
      const searchable = [plan.planNumber, plan.name, plan.ownerName, plan.supportName, plan.supportCompany, plan.latestUpdate?.updateText]
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
      overdue: plans.filter((plan: any) => plan.nextReportingDate && plan.nextReportingDate < now).length,
      next30: plans.filter((plan: any) => plan.nextReportingDate && plan.nextReportingDate >= now && plan.nextReportingDate <= monthAhead).length,
      updated: plans.filter((plan: any) => plan.latestUpdate).length,
    };
  }, [plans]);

  async function exportUpdates() {
    if (plans.length === 0) return toast.error("Não existem planos para exportar.");
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType } = await import("docx");
      const rows = sortedPlans.map((plan: any) => new TableRow({
        children: [
          new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: plan.planNumber || `P-${plan.id}`, bold: true })] })] }),
          new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, children: [new Paragraph(plan.name)] }),
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph(STATUS_LABELS[plan.status] || plan.status)] }),
          new TableCell({ width: { size: 13, type: WidthType.PERCENTAGE }, children: [new Paragraph(plan.ownerName || "Por definir")] }),
          new TableCell({ width: { size: 13, type: WidthType.PERCENTAGE }, children: [new Paragraph([plan.supportName, plan.supportCompany].filter(Boolean).join(" — ") || "Por definir")] }),
          new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph(formatDate(plan.nextReportingDate))] }),
          new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, children: [
            new Paragraph(plan.latestUpdate?.updateText || "Sem update registado"),
            ...(plan.latestUpdate ? [new Paragraph({ children: [new TextRun({ text: `${plan.latestUpdate.createdByName} · ${formatDateTime(plan.latestUpdate.createdAt)}`, italics: true, size: 18 })] })] : []),
          ] }),
        ],
      }));
      const header = new TableRow({
        tableHeader: true,
        children: ["N.º", "Plano", "Estado", "Responsável interno", "Suporte", "Próxima entrega", "Último update"].map(text => new TableCell({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "006341" },
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF" })] })],
        })),
      });
      const wordDocument = new Document({ sections: [{ children: [
        new Paragraph({ text: "Actualização dos Planos de Monitorização", heading: HeadingLevel.TITLE }),
        new Paragraph({ children: [new TextRun({ text: "Âmbito: ", bold: true }), new TextRun("20 planos universais aplicáveis a todos os projectos") ] }),
        new Paragraph({ children: [new TextRun({ text: "Gerado em: ", bold: true }), new TextRun(new Date().toLocaleString("pt-PT"))] }),
        new Paragraph({ text: "" }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }),
      ] }] });
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
    return <AppLayout><div className="mx-auto max-w-7xl space-y-4 p-6"><div className="h-10 w-80 animate-pulse rounded bg-muted" /><div className="h-96 animate-pulse rounded-xl bg-muted" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#006341]">Controlo e reporting</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("Planos de Monitorização")}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Calendário, responsáveis, evidências e último estado de cada plano numa única visão.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportUpdates}><Download className="mr-2 h-4 w-4" />Exportar updates</Button>
            {isAdminOrDono && (
              <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo plano</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Criar novo plano</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="text-xs font-medium">Número</label><Input value={newPlan.planNumber} onChange={event => setNewPlan(value => ({ ...value, planNumber: event.target.value }))} placeholder="P-21" /></div>
                      <div className="col-span-2"><label className="text-xs font-medium">Nome</label><Input value={newPlan.name} onChange={event => setNewPlan(value => ({ ...value, name: event.target.value }))} placeholder="Nome do plano" /></div>
                    </div>
                    <Select value={newPlan.category} onValueChange={(value: any) => setNewPlan(plan => ({ ...plan, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="programa_monitorizacao">Programa de Monitorização</SelectItem><SelectItem value="plano_projeto">Plano/Projecto</SelectItem></SelectContent></Select>
                    <Input value={newPlan.periodicity} onChange={event => setNewPlan(value => ({ ...value, periodicity: event.target.value }))} placeholder="Periodicidade (ex.: Semestral)" />
                    <Textarea value={newPlan.notes} onChange={event => setNewPlan(value => ({ ...value, notes: event.target.value }))} placeholder="Notas adicionais" />
                    <Button className="w-full" disabled={!newPlan.name || createMutation.isPending} onClick={() => createMutation.mutate({
                      name: newPlan.name,
                      planNumber: newPlan.planNumber || undefined,
                      category: newPlan.category,
                      periodicity: newPlan.periodicity || undefined,
                      notes: newPlan.notes || undefined,
                    })}>{createMutation.isPending ? "A criar..." : "Criar plano"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <PlanCalendar plans={plans as any[]} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Planos acompanhados" value={stats.total} icon={<FileText className="h-5 w-5" />} />
          <StatCard label="Em atraso" value={stats.overdue} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
          <StatCard label="Próximos 30 dias" value={stats.next30} icon={<CalendarDays className="h-5 w-5" />} tone="amber" />
          <StatCard label="Com update" value={stats.updated} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-bold">Acompanhamento dos planos</h2><p className="text-sm text-muted-foreground">Ordenado pela próxima entrega. Cada update mantém autor e data.</p></div><Badge variant="outline">{filteredPlans.length} de {sortedPlans.length} registos</Badge></div>
          <Card className="border-slate-200 bg-slate-50/60"><CardContent className="grid gap-3 p-3 sm:grid-cols-[1fr_220px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="bg-white pl-9" placeholder="Pesquisar por número, plano, responsável ou update..." /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os estados</SelectItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          </CardContent></Card>
          {filteredPlans.length === 0 ? (
            <Card><CardContent className="p-10 text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 font-medium">Ainda não existem planos para este contexto.</p></CardContent></Card>
          ) : filteredPlans.map((plan: any) => <PlanCard key={plan.id} plan={plan} user={user} />)}
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, icon, tone = "default" }: { label: string; value: number; icon: React.ReactNode; tone?: "default" | "red" | "amber" | "green" }) {
  const toneClass = tone === "red" ? "text-red-600 bg-red-50" : tone === "amber" ? "text-amber-600 bg-amber-50" : tone === "green" ? "text-emerald-600 bg-emerald-50" : "text-[#006341] bg-emerald-50";
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className={`rounded-xl p-2.5 ${toneClass}`}>{icon}</div><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}

function PlanCard({ plan, user }: { plan: any; user: any }) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [status, setStatus] = useState(plan.status || "nao_iniciado");
  const [updateText, setUpdateText] = useState("");
  const [ownerId, setOwnerId] = useState(plan.ownerId ? String(plan.ownerId) : "none");
  const [supportName, setSupportName] = useState(plan.supportName || "");
  const [supportCompany, setSupportCompany] = useState(plan.supportCompany || "");
  const [supportEmail, setSupportEmail] = useState(plan.supportEmail || "");
  const [supportPhone, setSupportPhone] = useState(plan.supportPhone || "");
  const [nextDate, setNextDate] = useState(dateInputValue(plan.nextReportingDate));
  const [lastDate, setLastDate] = useState(dateInputValue(plan.lastReportingDate));
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";
  const canUpdate = isAdminOrDono || user?.role === "raa" || plan.ownerId === user?.id;
  const isOverdue = plan.nextReportingDate && plan.nextReportingDate < Date.now();

  const { data: candidates = [] } = trpc.monitoringPlans.responsibleCandidates.useQuery(undefined, { enabled: Boolean(expanded && isAdminOrDono) });
  const { data: history } = trpc.monitoringPlans.history.useQuery({ planId: plan.id }, { enabled: showHistory });
  const refresh = async () => {
    await Promise.all([utils.monitoringPlans.list.invalidate(), utils.calendarEvents.list.invalidate()]);
  };
  const configureMutation = trpc.monitoringPlans.configure.useMutation({ onSuccess: async () => { await refresh(); toast.success("Responsável e prazos actualizados"); }, onError: error => toast.error(error.message) });
  const updateMutation = trpc.monitoringPlans.addUpdate.useMutation({ onSuccess: async () => { await refresh(); setUpdateText(""); toast.success("Status update registado"); }, onError: error => toast.error(error.message) });
  const uploadMutation = trpc.monitoringPlans.uploadAttachment.useMutation({ onSuccess: async () => { await refresh(); toast.success("Anexo guardado com segurança"); }, onError: error => toast.error(error.message) });
  const confirmMutation = trpc.monitoringPlans.confirmDelivery.useMutation({ onSuccess: async () => { await refresh(); toast.success("Entrega confirmada e próximo prazo actualizado"); }, onError: error => toast.error(error.message) });

  async function uploadFile(file?: globalThis.File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("O ficheiro excede o limite de 10MB.");
    const fileBase64 = await fileToBase64(file);
    uploadMutation.mutate({ planId: plan.id, filename: file.name, mimeType: file.type || "application/octet-stream", fileBase64 });
  }

  return (
    <Card className={`overflow-hidden border-l-4 ${isOverdue ? "border-l-red-500" : plan.status === "concluido" ? "border-l-emerald-500" : "border-l-[#006341]"}`}>
      <CardContent className="p-0">
        <div className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 gap-3">
              <Badge className="h-fit shrink-0 bg-[#006341]">{plan.planNumber || `P-${String(plan.id).padStart(2, "0")}`}</Badge>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold leading-tight">{plan.name}</h3><Badge variant="outline" className={STATUS_STYLES[plan.status]}>{STATUS_LABELS[plan.status] || plan.status}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">{plan.category === "programa_monitorizacao" ? "Programa de Monitorização" : "Plano/Projecto"}{plan.periodicity ? ` · ${plan.periodicity}` : ""}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[600px]">
              <InfoBlock icon={<UserRound className="h-4 w-4" />} label="Responsável interno" value={plan.ownerName || "Por definir"} />
              <InfoBlock icon={<UserRound className="h-4 w-4" />} label="Suporte" value={[plan.supportName, plan.supportCompany].filter(Boolean).join(" — ") || "Por definir"} />
              <InfoBlock icon={<CalendarDays className="h-4 w-4" />} label="Próxima entrega" value={formatDate(plan.nextReportingDate)} alert={Boolean(isOverdue)} />
              <InfoBlock icon={<Paperclip className="h-4 w-4" />} label="Anexos" value={String(plan.attachmentCount || 0)} />
            </div>
          </div>

          <div className="mt-3 rounded-xl border bg-slate-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Último status update</p>
                <p className="mt-1 text-sm leading-relaxed">{plan.latestUpdate?.updateText || "Ainda não foi registada uma actualização para este plano."}</p>
                {plan.latestUpdate && <p className="mt-1 text-xs text-muted-foreground">{plan.latestUpdate.createdByName} · {formatDateTime(plan.latestUpdate.createdAt)}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowHistory(true)}><Eye className="mr-1.5 h-3.5 w-3.5" />Histórico</Button>
                {(canUpdate || isAdminOrDono) && <Button size="sm" onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-180" /> : <Pencil className="mr-1.5 h-3.5 w-3.5" />}{expanded ? "Fechar" : "Actualizar"}</Button>}
              </div>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="border-t bg-white p-4">
            <div className="grid gap-5 lg:grid-cols-2">
              {isAdminOrDono && (
                <div className="space-y-3 rounded-xl border p-4">
                  <div><h4 className="font-semibold">Responsáveis e calendário</h4><p className="text-xs text-muted-foreground">O responsável interno tem conta; o suporte pode não estar registado.</p></div>
                  <Select value={ownerId} onValueChange={setOwnerId}><SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger><SelectContent><SelectItem value="none">Sem responsável</SelectItem>{candidates.map((candidate: any) => <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.name} — {candidate.role}</SelectItem>)}</SelectContent></Select>
                  <div className="grid grid-cols-2 gap-3"><Input value={supportName} onChange={event => setSupportName(event.target.value)} placeholder="Nome do suporte" /><Input value={supportCompany} onChange={event => setSupportCompany(event.target.value)} placeholder="Empresa/entidade" /></div>
                  <div className="grid grid-cols-2 gap-3"><Input type="email" value={supportEmail} onChange={event => setSupportEmail(event.target.value)} placeholder="Email do suporte" /><Input value={supportPhone} onChange={event => setSupportPhone(event.target.value)} placeholder="Telefone (opcional)" /></div>
                  <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-medium">Última entrega</label><Input type="date" value={lastDate} onChange={event => setLastDate(event.target.value)} /></div><div><label className="text-xs font-medium">Próxima entrega</label><Input type="date" value={nextDate} onChange={event => setNextDate(event.target.value)} /></div></div>
                  <Button variant="outline" className="w-full" disabled={configureMutation.isPending} onClick={() => configureMutation.mutate({ planId: plan.id, ownerId: ownerId === "none" ? null : Number(ownerId), supportName: supportName.trim() || null, supportCompany: supportCompany.trim() || null, supportEmail: supportEmail.trim() || null, supportPhone: supportPhone.trim() || null, lastReportingDate: toTimestamp(lastDate), nextReportingDate: toTimestamp(nextDate) })}><Save className="mr-2 h-4 w-4" />Guardar responsáveis e datas</Button>
                </div>
              )}

              {canUpdate && (
                <div className="space-y-3 rounded-xl border p-4">
                  <div><h4 className="font-semibold">Novo status update</h4><p className="text-xs text-muted-foreground">O texto, autor e data ficam guardados no histórico.</p></div>
                  <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                  <Textarea value={updateText} onChange={event => setUpdateText(event.target.value)} placeholder="Descreva o progresso, constrangimentos e próximos passos..." rows={5} />
                  <Button className="w-full" disabled={updateText.trim().length < 3 || updateMutation.isPending} onClick={() => updateMutation.mutate({ planId: plan.id, status: status as any, updateText })}><Save className="mr-2 h-4 w-4" />Registar update</Button>
                </div>
              )}
            </div>

            {canUpdate && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-semibold">Fotografias e anexos</p><p className="text-xs text-muted-foreground">PDF, Word, Excel ou imagens até 10MB. Todos os ficheiros são analisados antes de serem guardados.</p></div>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-[#006341] shadow-sm ring-1 ring-emerald-200 hover:bg-emerald-50">
                  <Upload className="mr-2 h-4 w-4" />{uploadMutation.isPending ? "A enviar..." : "Adicionar ficheiro"}
                  <input type="file" className="sr-only" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" disabled={uploadMutation.isPending} onChange={event => uploadFile(event.target.files?.[0])} />
                </label>
              </div>
            )}

            {plan.submissionStatus === "submitted" && canUpdate && <Button className="mt-4" variant="outline" onClick={() => confirmMutation.mutate({ planId: plan.id })} disabled={confirmMutation.isPending}><CheckCircle2 className="mr-2 h-4 w-4" />Confirmar entrega à entidade competente</Button>}
          </div>
        )}
      </CardContent>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{plan.planNumber} — Histórico e evidências</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div><h4 className="mb-2 text-sm font-semibold">Actualizações</h4>{history?.updates?.length ? <div className="space-y-2">{history.updates.map((update: any) => <div key={update.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><Badge variant="outline" className={STATUS_STYLES[update.status]}>{STATUS_LABELS[update.status]}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(update.createdAt)}</span></div><p className="mt-2 text-sm">{update.updateText}</p><p className="mt-1 text-xs text-muted-foreground">Por {update.createdByName}</p></div>)}</div> : <p className="text-sm text-muted-foreground">Sem actualizações registadas.</p>}</div>
            <div><h4 className="mb-2 text-sm font-semibold">Fotografias e anexos</h4>{history?.attachments?.length ? <div className="grid gap-2 sm:grid-cols-2">{history.attachments.map((attachment: any) => <button key={attachment.id} type="button" onClick={() => window.open(attachment.url, "_blank", "noopener,noreferrer")} className="flex items-center gap-3 rounded-xl border p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/40">{attachment.type === "photo" ? <Image className="h-5 w-5 text-emerald-600" /> : <File className="h-5 w-5 text-slate-600" />}<div className="min-w-0"><p className="truncate text-sm font-medium">{attachment.filename}</p><p className="text-xs text-muted-foreground">{attachment.uploadedByName} · {formatDateTime(attachment.uploadedAt)}</p></div></button>)}</div> : <p className="text-sm text-muted-foreground">Sem anexos.</p>}</div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InfoBlock({ icon, label, value, alert = false }: { icon: React.ReactNode; label: string; value: string; alert?: boolean }) {
  return <div className={`rounded-xl border px-3 py-2 ${alert ? "border-red-200 bg-red-50" : "bg-slate-50"}`}><div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${alert ? "text-red-600" : "text-muted-foreground"}`}>{icon}{label}</div><p className={`mt-1 truncate text-xs font-semibold ${alert ? "text-red-700" : ""}`}>{value}</p></div>;
}
