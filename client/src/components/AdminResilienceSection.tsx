import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, CheckCircle2, ClipboardCheck, Database, Plus, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Severity = "low" | "medium" | "high" | "critical";
type Status = "open" | "investigating" | "monitoring" | "resolved";

type IncidentDraft = {
  title: string;
  severity: Severity;
  status: Status;
  affectedServices: string;
  impactSummary: string;
  recoverySteps: string;
  followUpActions: string;
  occurredAt: string;
};

const severityLabel: Record<Severity, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const statusLabel: Record<Status, string> = {
  open: "Aberto",
  investigating: "Em investigação",
  monitoring: "Em monitorização",
  resolved: "Resolvido",
};

function defaultDraft(): IncidentDraft {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return {
    title: "",
    severity: "medium",
    status: "open",
    affectedServices: "Aplicação",
    impactSummary: "",
    recoverySteps: "",
    followUpActions: "",
    occurredAt: local,
  };
}

function statusVariant(status: Status): "default" | "secondary" | "destructive" | "outline" {
  if (status === "resolved") return "default";
  if (status === "open") return "destructive";
  if (status === "investigating") return "secondary";
  return "outline";
}

function severityClass(severity: Severity) {
  return severity === "critical" ? "border-red-200 bg-red-50 text-red-800" : severity === "high" ? "border-[#6D7A70] bg-[#EDEBEB] text-[#646461]" : severity === "medium" ? "border-[#0A3638] bg-[#0A3638] text-white" : "border-border bg-muted/40 text-foreground";
}

export default function AdminResilienceSection() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<IncidentDraft>(defaultDraft);
  const healthQuery = trpc.resilience.health.useQuery(undefined, { refetchInterval: 60_000, retry: 1 });
  const incidentsQuery = trpc.resilience.listIncidents.useQuery();
  const createMutation = trpc.resilience.createIncident.useMutation({
    onSuccess: async () => {
      await incidentsQuery.refetch();
      setDraft(defaultDraft());
      setOpen(false);
      toast.success("Incidente registado no histórico de recuperação.");
    },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.resilience.updateIncident.useMutation({
    onSuccess: async () => {
      await incidentsQuery.refetch();
      toast.success("Estado do incidente atualizado.");
    },
    onError: error => toast.error(error.message),
  });

  const openIncidents = useMemo(() => (incidentsQuery.data || []).filter((incident: any) => incident.status !== "resolved"), [incidentsQuery.data]);
  const field = <K extends keyof IncidentDraft>(key: K, value: IncidentDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const saveIncident = () => {
    const occurredAt = new Date(draft.occurredAt).getTime();
    if (!Number.isFinite(occurredAt)) return toast.error("Indique uma data e hora válidas.");
    createMutation.mutate({ ...draft, occurredAt });
  };
  const resolve = (incident: any) => updateMutation.mutate({
    id: incident.id,
    title: incident.title,
    severity: incident.severity,
    status: "resolved",
    affectedServices: incident.affectedServices,
    impactSummary: incident.impactSummary || "",
    recoverySteps: incident.recoverySteps || "",
    followUpActions: incident.followUpActions || "",
    occurredAt: new Date(incident.occurredAt).getTime(),
  });

  const ready = healthQuery.data?.status === "ready";
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary shadow-sm">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ready ? "bg-primary text-primary-foreground" : "bg-[#EDEBEB] text-[#646461]"}`}>
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Centro de resiliência</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Saúde do serviço e recuperação</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Área restrita a Administração para registar incidentes, documentar a retoma e acompanhar medidas de prevenção. Não guarda palavras-passe, tokens, ficheiros ou dados de sessão.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Badge className={ready ? "bg-primary hover:bg-primary" : "bg-[#EDEBEB] hover:bg-[#EDEBEB]"}>{healthQuery.isLoading ? "A verificar" : ready ? "Aplicação e base de dados disponíveis" : "Verificação pendente"}</Badge>
            <Button variant="outline" size="sm" onClick={() => { healthQuery.refetch(); utils.resilience.listIncidents.invalidate(); }}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Feed de incidentes</CardTitle>
                <CardDescription>O histórico mantém o contexto necessário para retomar a operação após uma falha.</CardDescription>
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Registar incidente</Button></DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Registar incidente operacional</DialogTitle>
                    <DialogDescription>Registe impacto e recuperação sem incluir credenciais, conteúdo de ficheiros ou dados pessoais desnecessários.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-2 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="incident-title">Resumo</Label><Input id="incident-title" value={draft.title} onChange={event => field("title", event.target.value)} placeholder="Ex.: Erro ao importar relatório BMS" /></div>
                    <div className="space-y-2"><Label>Severidade</Label><Select value={draft.severity} onValueChange={value => field("severity", value as Severity)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(severityLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Estado</Label><Select value={draft.status} onValueChange={value => field("status", value as Status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label htmlFor="incident-services">Serviços afetados</Label><Input id="incident-services" value={draft.affectedServices} onChange={event => field("affectedServices", event.target.value)} placeholder="Aplicação, importação BMS" /></div>
                    <div className="space-y-2"><Label htmlFor="incident-occurred">Data e hora</Label><Input id="incident-occurred" type="datetime-local" value={draft.occurredAt} onChange={event => field("occurredAt", event.target.value)} /></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="incident-impact">Impacto observado</Label><Textarea id="incident-impact" value={draft.impactSummary} onChange={event => field("impactSummary", event.target.value)} placeholder="Indique o comportamento observado e quem foi afetado." /></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="incident-recovery">Passos de recuperação</Label><Textarea id="incident-recovery" value={draft.recoverySteps} onChange={event => field("recoverySteps", event.target.value)} placeholder="Ex.: Confirmar saúde, consultar logs, repor versão estável, validar o fluxo." /></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="incident-followup">Ação preventiva / seguimento</Label><Textarea id="incident-followup" value={draft.followUpActions} onChange={event => field("followUpActions", event.target.value)} placeholder="Indique a melhoria ou validação a agendar." /></div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={saveIncident} disabled={createMutation.isPending}>{createMutation.isPending ? "A registar..." : "Guardar incidente"}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {incidentsQuery.isLoading && <p className="text-sm text-muted-foreground">A carregar o histórico de recuperação...</p>}
            {!incidentsQuery.isLoading && (!incidentsQuery.data || incidentsQuery.data.length === 0) && <div className="rounded-xl border border-dashed bg-muted/40 p-8 text-center"><CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-primary" /><p className="font-medium text-foreground">Sem incidentes registados</p><p className="mt-1 text-sm text-muted-foreground">O feed está pronto para documentar qualquer falha e a respetiva recuperação.</p></div>}
            {incidentsQuery.data?.map((incident: any) => (
              <div key={incident.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{incident.title}</p><Badge variant={statusVariant(incident.status as Status)}>{statusLabel[incident.status as Status]}</Badge><Badge variant="outline" className={severityClass(incident.severity as Severity)}>{severityLabel[incident.severity as Severity]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{incident.affectedServices} · {new Date(incident.occurredAt).toLocaleString("pt-PT")}</p></div>
                  {incident.status !== "resolved" && <Button size="sm" variant="outline" onClick={() => resolve(incident)} disabled={updateMutation.isPending}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Assinalar resolvido</Button>}
                </div>
                {(incident.impactSummary || incident.recoverySteps || incident.followUpActions) && <div className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground md:grid-cols-3">{incident.impactSummary && <p><strong className="text-foreground">Impacto:</strong> {incident.impactSummary}</p>}{incident.recoverySteps && <p><strong className="text-foreground">Retoma:</strong> {incident.recoverySteps}</p>}{incident.followUpActions && <p><strong className="text-foreground">Seguimento:</strong> {incident.followUpActions}</p>}</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="h-fit bg-[#0A3638] text-white">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><RotateCcw className="h-4 w-4 text-primary" /> Roteiro de retoma</CardTitle><CardDescription className="text-slate-300">Sequência curta para voltar a pôr o serviço sob controlo.</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p><strong className="text-white">1. Isolar e confirmar.</strong> Consulte a saúde do serviço e preserve os registos relevantes.</p></div>
            <div className="flex gap-3"><Database className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p><strong className="text-white">2. Proteger dados.</strong> Antes de qualquer correção invasiva, confirme o ponto de restauro aplicável com a equipa de TI.</p></div>
            <div className="flex gap-3"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p><strong className="text-white">3. Recuperar e validar.</strong> Reponha uma versão estável, teste login, leitura, carregamento e exportação, e só então feche o incidente.</p></div>
            {openIncidents.length > 0 && <div className="rounded-lg border border-[#6D7A70]/30 bg-[#EDEBEB]/10 p-3 text-[#646461]"><AlertTriangle className="mr-1 inline h-4 w-4" /> {openIncidents.length} incidente{openIncidents.length === 1 ? " em acompanhamento" : "s em acompanhamento"}.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
