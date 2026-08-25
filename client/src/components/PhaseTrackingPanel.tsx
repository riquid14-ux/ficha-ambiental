import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Clock3, History, Save, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_curso: "Em curso",
  em_validacao: "Em validação",
  concluido: "Concluído",
  bloqueado: "Bloqueado",
};

const STATUS_STYLES: Record<string, string> = {
  nao_iniciado: "border-slate-200 bg-slate-50 text-slate-700",
  em_curso: "border-blue-200 bg-blue-50 text-blue-700",
  em_validacao: "border-amber-200 bg-amber-50 text-amber-700",
  concluido: "border-emerald-200 bg-emerald-50 text-emerald-700",
  bloqueado: "border-red-200 bg-red-50 text-red-700",
};

function formatDateTime(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

export default function PhaseTrackingPanel({ phase, projectId, compact = false }: { phase: any; projectId: number; compact?: boolean }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ownerId, setOwnerId] = useState(phase?.ownerId ? String(phase.ownerId) : "none");
  const [supportName, setSupportName] = useState(phase?.supportName || "");
  const [supportCompany, setSupportCompany] = useState(phase?.supportCompany || "");
  const [supportEmail, setSupportEmail] = useState(phase?.supportEmail || "");
  const [supportPhone, setSupportPhone] = useState(phase?.supportPhone || "");
  const [status, setStatus] = useState(phase?.trackingStatus || "nao_iniciado");
  const [updateText, setUpdateText] = useState("");

  useEffect(() => {
    setOwnerId(phase?.ownerId ? String(phase.ownerId) : "none");
    setSupportName(phase?.supportName || "");
    setSupportCompany(phase?.supportCompany || "");
    setSupportEmail(phase?.supportEmail || "");
    setSupportPhone(phase?.supportPhone || "");
    setStatus(phase?.trackingStatus || "nao_iniciado");
  }, [phase]);

  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";
  const canUpdate = isAdminOrDono || user?.role === "raa" || phase?.ownerId === user?.id;
  const { data: candidates = [] } = trpc.projectPhases.responsibleCandidates.useQuery(
    { projectId },
    { enabled: Boolean(phase && open && isAdminOrDono) },
  );
  const { data: history = [] } = trpc.projectPhases.updateHistory.useQuery(
    { phaseId: phase?.id || 0 },
    { enabled: Boolean(phase && historyOpen) },
  );
  const configureMutation = trpc.projectPhases.configureTracking.useMutation({
    onSuccess: async () => { await utils.projectPhases.list.invalidate({ projectId }); toast.success("Responsáveis actualizados"); },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.projectPhases.addStatusUpdate.useMutation({
    onSuccess: async () => { setUpdateText(""); await utils.projectPhases.list.invalidate({ projectId }); toast.success("Status update registado"); },
    onError: error => toast.error(error.message),
  });

  if (!phase) return null;

  return (
    <Card className={`mt-3 border-emerald-100 bg-emerald-50/30 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Responsável interno</p><p className="mt-1 text-sm font-semibold">{phase.ownerName || "Por definir"}</p></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Suporte</p><p className="mt-1 text-sm font-semibold">{[phase.supportName, phase.supportCompany].filter(Boolean).join(" — ") || "Por definir"}</p></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Estado do acompanhamento</p><Badge variant="outline" className={`mt-1 ${STATUS_STYLES[phase.trackingStatus]}`}>{STATUS_LABELS[phase.trackingStatus]}</Badge></div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}><History className="mr-1.5 h-4 w-4" />Histórico</Button>
          {(isAdminOrDono || canUpdate) && <Button size="sm" onClick={() => setOpen(true)}>Actualizar</Button>}
        </div>
      </div>
      <div className="mt-3 rounded-lg border bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Último status update</p>
        {phase.latestUpdate ? <><p className="mt-1 text-sm">{phase.latestUpdate.updateText}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" />{phase.latestUpdate.createdByName} · {formatDateTime(phase.latestUpdate.createdAt)}</p></> : <p className="mt-1 text-sm text-muted-foreground">Ainda sem actualizações.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Acompanhamento — {phase.phaseName}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {isAdminOrDono && <section className="space-y-3 rounded-xl border p-4"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-emerald-700" /><h4 className="font-semibold">Responsável interno</h4></div><Select value={ownerId} onValueChange={setOwnerId}><SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger><SelectContent><SelectItem value="none">Sem responsável</SelectItem>{candidates.map((candidate: any) => <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.name} — {candidate.role}</SelectItem>)}</SelectContent></Select><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-emerald-700" /><h4 className="font-semibold">Suporte</h4></div><div className="grid gap-3 sm:grid-cols-2"><Input value={supportName} onChange={event => setSupportName(event.target.value)} placeholder="Nome" /><Input value={supportCompany} onChange={event => setSupportCompany(event.target.value)} placeholder="Empresa/entidade" /><Input type="email" value={supportEmail} onChange={event => setSupportEmail(event.target.value)} placeholder="Email" /><Input value={supportPhone} onChange={event => setSupportPhone(event.target.value)} placeholder="Telefone" /></div><Button variant="outline" className="w-full" disabled={configureMutation.isPending} onClick={() => configureMutation.mutate({ phaseId: phase.id, ownerId: ownerId === "none" ? null : Number(ownerId), supportName: supportName.trim() || null, supportCompany: supportCompany.trim() || null, supportEmail: supportEmail.trim() || null, supportPhone: supportPhone.trim() || null })}><Save className="mr-2 h-4 w-4" />Guardar responsáveis</Button></section>}
            {canUpdate && <section className="space-y-3 rounded-xl border p-4"><h4 className="font-semibold">Novo status update</h4><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Textarea value={updateText} onChange={event => setUpdateText(event.target.value)} placeholder="Estado actual, trabalho concluído, bloqueios e próximos passos..." className="min-h-28" /><Button className="w-full" disabled={updateText.trim().length < 3 || updateMutation.isPending} onClick={() => updateMutation.mutate({ phaseId: phase.id, status: status as any, updateText })}><Save className="mr-2 h-4 w-4" />Registar update</Button></section>}
            <p className="text-xs text-muted-foreground">Este acompanhamento não cria eventos de calendário nem alertas automáticos.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Histórico — {phase.phaseName}</DialogTitle></DialogHeader>{history.length ? <div className="space-y-2">{history.map((update: any) => <div key={update.id} className="rounded-xl border p-3"><div className="flex items-center justify-between"><Badge variant="outline" className={STATUS_STYLES[update.status]}>{STATUS_LABELS[update.status]}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(update.createdAt)}</span></div><p className="mt-2 text-sm">{update.updateText}</p><p className="mt-1 text-xs text-muted-foreground">Por {update.createdByName}</p></div>)}</div> : <p className="text-sm text-muted-foreground">Sem actualizações registadas.</p>}</DialogContent>
      </Dialog>
    </Card>
  );
}
