import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Clock3, History, Save, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
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

export default function MeasureTrackingPanel({
  measure,
  tracking,
  projectId,
}: {
  measure: any;
  tracking: any;
  projectId: number;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ownerId, setOwnerId] = useState(tracking?.ownerId ? String(tracking.ownerId) : "none");
  const [supportName, setSupportName] = useState(tracking?.supportName || "");
  const [supportCompany, setSupportCompany] = useState(tracking?.supportCompany || "");
  const [supportEmail, setSupportEmail] = useState(tracking?.supportEmail || "");
  const [supportPhone, setSupportPhone] = useState(tracking?.supportPhone || "");
  const [status, setStatus] = useState(tracking?.trackingStatus || "nao_iniciado");
  const [updateText, setUpdateText] = useState("");

  useEffect(() => {
    setOwnerId(tracking?.ownerId ? String(tracking.ownerId) : "none");
    setSupportName(tracking?.supportName || "");
    setSupportCompany(tracking?.supportCompany || "");
    setSupportEmail(tracking?.supportEmail || "");
    setSupportPhone(tracking?.supportPhone || "");
    setStatus(tracking?.trackingStatus || "nao_iniciado");
  }, [tracking]);

  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";
  const canUpdate = isAdminOrDono || user?.role === "raa" || tracking?.ownerId === user?.id;
  const { data: candidates = [] } = trpc.phaseMeasures.responsibleCandidates.useQuery(
    { projectId },
    { enabled: open && isAdminOrDono },
  );
  const { data: history = [] } = trpc.phaseMeasures.updateHistory.useQuery(
    { projectId, measureId: measure.id },
    { enabled: historyOpen },
  );
  const configureMutation = trpc.phaseMeasures.configureTracking.useMutation({
    onSuccess: async () => {
      await utils.phaseMeasures.getStatuses.invalidate({ projectId });
      toast.success("Responsáveis da medida actualizados");
    },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.phaseMeasures.addStatusUpdate.useMutation({
    onSuccess: async () => {
      setUpdateText("");
      await utils.phaseMeasures.getStatuses.invalidate({ projectId });
      toast.success("Status update da medida registado");
    },
    onError: error => toast.error(error.message),
  });

  const trackingStatus = tracking?.trackingStatus || "nao_iniciado";

  return (
    <Card className="border-emerald-100 bg-emerald-50/30 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Responsável pela medida</p>
            <p className="mt-1 text-sm font-semibold">{tracking?.ownerName || "Por definir"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Suporte</p>
            <p className="mt-1 text-sm font-semibold">{[tracking?.supportName, tracking?.supportCompany].filter(Boolean).join(" — ") || "Por definir"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Estado do acompanhamento</p>
            <Badge variant="outline" className={`mt-1 ${STATUS_STYLES[trackingStatus]}`}>{STATUS_LABELS[trackingStatus]}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}><History className="mr-1.5 h-4 w-4" />Histórico</Button>
          {(isAdminOrDono || canUpdate) && <Button size="sm" onClick={() => setOpen(true)}>Actualizar</Button>}
        </div>
      </div>

      <div className="mt-3 rounded-lg border bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Último status update desta medida</p>
        {tracking?.latestUpdate ? (
          <>
            <p className="mt-1 text-sm">{tracking.latestUpdate.updateText}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" />{tracking.latestUpdate.createdByName} · {formatDateTime(tracking.latestUpdate.createdAt)}</p>
          </>
        ) : <p className="mt-1 text-sm text-muted-foreground">Ainda sem actualizações nesta medida.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Medida {measure.number} — responsável, suporte e update</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {isAdminOrDono && (
              <section className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-emerald-700" /><h4 className="font-semibold">Responsável interno pela medida</h4></div>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {candidates.map((candidate: any) => <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.name} — {candidate.role}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-emerald-700" /><h4 className="font-semibold">Suporte desta medida</h4></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={supportName} onChange={event => setSupportName(event.target.value)} placeholder="Nome" />
                  <Input value={supportCompany} onChange={event => setSupportCompany(event.target.value)} placeholder="Empresa/entidade" />
                  <Input type="email" value={supportEmail} onChange={event => setSupportEmail(event.target.value)} placeholder="Email" />
                  <Input value={supportPhone} onChange={event => setSupportPhone(event.target.value)} placeholder="Telefone" />
                </div>
                <Button variant="outline" className="w-full" disabled={configureMutation.isPending} onClick={() => configureMutation.mutate({
                  projectId,
                  measureId: measure.id,
                  ownerId: ownerId === "none" ? null : Number(ownerId),
                  supportName: supportName.trim() || null,
                  supportCompany: supportCompany.trim() || null,
                  supportEmail: supportEmail.trim() || null,
                  supportPhone: supportPhone.trim() || null,
                })}><Save className="mr-2 h-4 w-4" />Guardar responsável e suporte</Button>
              </section>
            )}

            {canUpdate && (
              <section className="space-y-3 rounded-xl border p-4">
                <h4 className="font-semibold">Novo status update desta medida</h4>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
                <Textarea value={updateText} onChange={event => setUpdateText(event.target.value)} placeholder="Estado actual da medida, trabalho concluído, bloqueios e próximos passos..." className="min-h-28" />
                <Button className="w-full" disabled={updateText.trim().length < 3 || updateMutation.isPending} onClick={() => updateMutation.mutate({ projectId, measureId: measure.id, status: status as any, updateText })}><Save className="mr-2 h-4 w-4" />Registar update da medida</Button>
              </section>
            )}
            <p className="text-xs text-muted-foreground">O acompanhamento desta medida não cria eventos de calendário nem alertas automáticos.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico da medida {measure.number}</DialogTitle></DialogHeader>
          {history.length ? (
            <div className="space-y-2">{history.map((update: any) => (
              <div key={update.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between"><Badge variant="outline" className={STATUS_STYLES[update.status]}>{STATUS_LABELS[update.status]}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(update.createdAt)}</span></div>
                <p className="mt-2 text-sm">{update.updateText}</p>
                <p className="mt-1 text-xs text-muted-foreground">Por {update.createdByName}</p>
              </div>
            ))}</div>
          ) : <p className="text-sm text-muted-foreground">Sem actualizações registadas para esta medida.</p>}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
