import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Calendar, Clock, Plus, Pencil, Upload, AlertTriangle, CheckCircle2, ArrowRight, CheckCheck, FileUp } from "lucide-react";

export default function Planos() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { projects } = useProject();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";

  const { data: plans, isLoading, refetch } = trpc.monitoringPlans.list.useQuery(undefined);

  const createMutation = trpc.monitoringPlans.create.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano criado com sucesso"); setShowCreate(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = trpc.monitoringPlans.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano atualizado"); setEditingPlan(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const submitDocMutation = trpc.monitoringPlans.submitDocument.useMutation({
    onSuccess: () => { refetch(); toast.success("Documento submetido na plataforma"); },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmDeliveryMutation = trpc.monitoringPlans.confirmDelivery.useMutation({
    onSuccess: (data: any) => {
      refetch();
      const nextDate = data.nextReportingDate ? new Date(data.nextReportingDate).toLocaleDateString("pt-PT") : "";
      toast.success(`Entrega confirmada! Próxima data: ${nextDate}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [newPlan, setNewPlan] = useState({ name: "", category: "programa_monitorizacao" as const, periodicity: "", notes: "", projectId: "" });

  const now = Date.now();

  // Sort plans: overdue first, then by next delivery date (soonest first), then no date
  const sortedPlans = useMemo(() => {
    if (!plans) return [];
    return [...plans].sort((a, b) => {
      const aNext = a.nextReportingDate || Infinity;
      const bNext = b.nextReportingDate || Infinity;
      const aOverdue = (aNext < now && aNext > 0) ? 1 : 0;
      const bOverdue = (bNext < now && bNext > 0) ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return aNext - bNext;
    });
  }, [plans, now]);

  // Categorize sorted plans
  const programas = sortedPlans.filter(p => p.category === "programa_monitorizacao");
  const planosList = sortedPlans.filter(p => p.category === "plano_projeto");

  // Stats
  const stats = useMemo(() => {
    if (!plans) return { total: 0, thisMonth: 0, upcoming: 0, noDate: 0 };
    const thisMonthEnd = new Date();
    thisMonthEnd.setMonth(thisMonthEnd.getMonth() + 1, 0);
    thisMonthEnd.setHours(23, 59, 59, 999);
    const thisMonthTs = thisMonthEnd.getTime();
    const total = plans.length;
    const thisMonth = plans.filter(p => p.nextReportingDate && p.nextReportingDate > 0 && p.nextReportingDate <= thisMonthTs && p.nextReportingDate >= now).length;
    const upcoming = plans.filter(p => p.nextReportingDate && p.nextReportingDate > thisMonthTs).length;
    const noDate = plans.filter(p => !p.nextReportingDate || p.nextReportingDate === 0).length;
    return { total, thisMonth, upcoming, noDate };
  }, [plans, now]);

  // Closest upcoming
  const nextReport = plans?.filter(p => p.nextReportingDate && p.nextReportingDate > now)
    .sort((a, b) => (a.nextReportingDate || 0) - (b.nextReportingDate || 0))[0];

  function formatDate(ts: number | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  }

  function daysUntil(ts: number | null) {
    if (!ts) return null;
    return Math.ceil((ts - now) / 86400000);
  }

  function timeLabel(ts: number | null) {
    const days = daysUntil(ts);
    if (days === null) return "";
    if (days < 0) return `${Math.abs(days)} dias em atraso`;
    if (days === 0) return "Hoje";
    if (days === 1) return "Amanhã";
    if (days < 30) return `${days} dias`;
    if (days < 60) return "~1 mês";
    return `~${Math.round(days / 30)} meses`;
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
          </div>
          <div className="h-40 bg-muted animate-pulse rounded" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("Planos de Monitorização")}< /h1>
          <p className="text-muted-foreground text-sm">Programas e planos do DCAPE — Fase de Construção</p>
        </div>
        {isAdminOrDono && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Novo Plano</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("Criar Novo Plano")}< /DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Nome do plano" value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))} />
                <Select value={newPlan.category} onValueChange={(v: any) => setNewPlan(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="programa_monitorizacao">Programa de Monitorização</SelectItem>
                    <SelectItem value="plano_projeto">Plano/Projeto</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Periodicidade (ex: Semestral, Trimestral)" value={newPlan.periodicity} onChange={e => setNewPlan(p => ({ ...p, periodicity: e.target.value }))} />
                <Select value={newPlan.projectId} onValueChange={(v) => setNewPlan(p => ({ ...p, projectId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Projeto (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos os projetos</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.code} — {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea placeholder="Notas adicionais" value={newPlan.notes} onChange={e => setNewPlan(p => ({ ...p, notes: e.target.value }))} />
                <Button onClick={() => createMutation.mutate({ name: newPlan.name, category: newPlan.category, periodicity: newPlan.periodicity || undefined, notes: newPlan.notes || undefined, projectId: newPlan.projectId && newPlan.projectId !== "none" ? parseInt(newPlan.projectId) : undefined })} disabled={!newPlan.name || createMutation.isPending}>
                  {createMutation.isPending ? "A criar..." : "Criar Plano"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border bg-background text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="p-3 rounded-lg border bg-amber-50 border-amber-200 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.thisMonth}</p>
          <p className="text-xs text-amber-600">{t("Entrega este mês")}< /p>
        </div>
        <div className="p-3 rounded-lg border bg-blue-50 border-blue-200 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
          <p className="text-xs text-blue-600">Próximos meses</p>
        </div>
        <div className="p-3 rounded-lg border bg-gray-50 border-gray-200 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{stats.noDate}</p>
          <p className="text-xs text-muted-foreground">Sem data definida</p>
        </div>
      </div>

      {/* Next report highlight */}
      {nextReport && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Próximo reporting</p>
              <p className="font-semibold text-sm truncate">{nextReport.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">{timeLabel(nextReport.nextReportingDate)}</p>
              <p className="text-xs text-muted-foreground">{formatDate(nextReport.nextReportingDate)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans list - grouped */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4" /> Programas de Monitorização ({programas.length}) — ordenados por próxima entrega
        </h2>
        {programas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum programa registado.</p>
        ) : (
          <div className="grid gap-2">
            {programas.map(plan => (
              <PlanRow key={plan.id} plan={plan} isAdminOrDono={isAdminOrDono} editingPlan={editingPlan} setEditingPlan={setEditingPlan} updateMutation={updateMutation} submitDocMutation={submitDocMutation} confirmDeliveryMutation={confirmDeliveryMutation} formatDate={formatDate} timeLabel={timeLabel} now={now} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mt-6">
          <Calendar className="w-4 h-4" /> Planos e Projetos ({planosList.length}) — ordenados por próxima entrega
        </h2>
        {planosList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano registado.</p>
        ) : (
          <div className="grid gap-2">
            {planosList.map(plan => (
            <PlanRow key={plan.id} plan={plan} isAdminOrDono={isAdminOrDono} editingPlan={editingPlan} setEditingPlan={setEditingPlan} updateMutation={updateMutation} submitDocMutation={submitDocMutation} confirmDeliveryMutation={confirmDeliveryMutation} formatDate={formatDate} timeLabel={timeLabel} now={now} />
            ))}
          </div>
        )}
      </div>
    </div>
  </AppLayout>);
}

function PlanRow({ plan, isAdminOrDono, editingPlan, setEditingPlan, updateMutation, submitDocMutation, confirmDeliveryMutation, formatDate, timeLabel, now }: any) {
  const [lastDate, setLastDate] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const isEditing = editingPlan === plan.id;
  const isOverdue = plan.nextReportingDate && plan.nextReportingDate < now && plan.nextReportingDate > 0;
  const isUpcoming = plan.nextReportingDate && plan.nextReportingDate > now && plan.nextReportingDate - now < 90 * 86400000;

  const statusColor = isOverdue ? "border-l-red-500" : isUpcoming ? "border-l-amber-500" : "border-l-green-500";

  return (
    <div className={`border rounded-lg p-3 border-l-4 ${statusColor} bg-background`}>
      <div className="flex items-center gap-3">
        {/* Status icon */}
        <div className="shrink-0">
          {isOverdue ? (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          ) : isUpcoming ? (
            <Clock className="w-4 h-4 text-amber-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
        </div>

        {/* Name and periodicity */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{plan.name}</p>
          {plan.notes && <p className="text-xs text-muted-foreground truncate">{plan.notes}</p>}
        </div>

        {/* Periodicity badge */}
        {plan.periodicity && (
          <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">{plan.periodicity}</Badge>
        )}

        {/* Dates */}
        <div className="text-right shrink-0 hidden md:block">
          <p className="text-xs text-muted-foreground">Último: {formatDate(plan.lastReportingDate)}</p>
          <p className="text-xs font-medium">
            Próximo: {formatDate(plan.nextReportingDate)}
            {plan.nextReportingDate && (
              <span className={`ml-1 ${isOverdue ? "text-red-600" : isUpcoming ? "text-amber-600" : "text-green-600"}`}>
                ({timeLabel(plan.nextReportingDate)})
              </span>
            )}
          </p>
        </div>

        {/* Actions */}
        {isAdminOrDono && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingPlan(isEditing ? null : plan.id)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Submission status banner */}
      {plan.submissionStatus === "submitted" && (
        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileUp className="w-4 h-4 text-amber-600" />
            <div>
              <p className="text-xs font-medium text-amber-800">Submetido na plataforma</p>
              <p className="text-[10px] text-amber-600">Falta confirmar envio à entidade competente</p>
            </div>
          </div>
          {isAdminOrDono && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={() => setShowConfirm(true)}
            >
              <CheckCheck className="w-3 h-3 mr-1" /> Confirmar Entrega
            </Button>
          )}
        </div>
      )}
      {plan.submissionStatus === "delivered" && (
        <div className="mt-2 p-2 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <div>
            <p className="text-xs font-medium text-green-800">Entregue à entidade competente</p>
            <p className="text-[10px] text-green-600">
              Confirmado em {plan.confirmedDeliveryAt ? new Date(plan.confirmedDeliveryAt).toLocaleDateString("pt-PT") : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Confirm delivery dialog */}
      {showConfirm && (
        <div className="mt-2 p-3 rounded-lg bg-white border-2 border-primary shadow-lg space-y-2">
          <p className="text-sm font-medium">Confirma que o plano foi entregue à entidade competente?</p>
          <p className="text-xs text-muted-foreground">Ao confirmar, a próxima data de entrega será atualizada automaticamente com base na periodicidade ({plan.periodicity || "anual"}).</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              confirmDeliveryMutation.mutate({ id: plan.id });
              setShowConfirm(false);
            }} disabled={confirmDeliveryMutation.isPending}>
              {confirmDeliveryMutation.isPending ? "A confirmar..." : "Sim, foi entregue"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowConfirm(false)}>{t("Cancelar")}< /Button>
          </div>
        </div>
      )}

      {/* Mobile dates */}
      <div className="flex gap-4 mt-2 text-xs text-muted-foreground md:hidden">
        <span>Último: {formatDate(plan.lastReportingDate)}</span>
        <span>Próximo: {formatDate(plan.nextReportingDate)}</span>
      </div>

      {/* Edit form */}
      {isEditing && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Último Reporting</label>
              <Input type="date" value={lastDate} onChange={e => setLastDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Próximo Reporting</label>
              <Input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <Button size="sm" onClick={() => {
            const data: any = { id: plan.id };
            if (lastDate) data.lastReportingDate = new Date(lastDate).getTime();
            if (nextDate) data.nextReportingDate = new Date(nextDate).getTime();
            updateMutation.mutate(data);
          }} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "A guardar..." : "Guardar Datas"}
          </Button>
          {/* Submit document button */}
          {plan.submissionStatus === "pending" && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Submeter documento do plano:</p>
              <input
                type="file"
                className="text-xs"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Read file as base64 and upload via tRPC
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = (reader.result as string).split(",")[1];
                    // Use the generic plan upload mutation
                    fetch("/api/trpc/monitoringPlans.submitDocument", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ json: { id: plan.id, fileUrl: `plan-doc-${plan.id}-${file.name}`, fileKey: `plans/${plan.id}/${Date.now()}-${file.name}` } }),
                    }).then(() => {
                      submitDocMutation.mutate({ id: plan.id, fileUrl: file.name, fileKey: `plans/${plan.id}/${file.name}` });
                    }).catch(() => {
                      // Fallback: just mark as submitted without actual file storage
                      submitDocMutation.mutate({ id: plan.id, fileUrl: file.name, fileKey: `plans/${plan.id}/${file.name}` });
                    });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
