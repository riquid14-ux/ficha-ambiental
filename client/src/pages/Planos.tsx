import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Calendar, Clock, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";

export default function Planos() {
  const { user } = useAuth();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";

  // Get active project from localStorage
  const storedProject = localStorage.getItem("selectedProjectId");
  const projectId = storedProject ? parseInt(storedProject) : undefined;

  const { data: plans, isLoading, refetch } = trpc.monitoringPlans.list.useQuery(
    projectId ? { projectId } : undefined
  );

  const createMutation = trpc.monitoringPlans.create.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano criado com sucesso"); setShowCreate(false); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.monitoringPlans.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano atualizado"); setEditingPlan(null); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.monitoringPlans.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano removido"); },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [newPlan, setNewPlan] = useState({ name: "", category: "programa_monitorizacao" as const, periodicity: "", notes: "" });

  const programas = plans?.filter(p => p.category === "programa_monitorizacao") || [];
  const planos = plans?.filter(p => p.category === "plano_projeto") || [];

  // Calculate next reporting alerts
  const now = Date.now();
  const upcomingReports = plans?.filter(p => p.nextReportingDate && p.nextReportingDate > now)
    .sort((a, b) => (a.nextReportingDate || 0) - (b.nextReportingDate || 0))
    .slice(0, 3) || [];

  const overdueReports = plans?.filter(p => p.nextReportingDate && p.nextReportingDate < now && p.nextReportingDate > 0) || [];

  function formatDate(ts: number | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function daysUntil(ts: number | null) {
    if (!ts) return null;
    const diff = Math.ceil((ts - now) / 86400000);
    return diff;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planos de Monitorização</h1>
          <p className="text-muted-foreground">Planos e programas do DCAPE — Fase de Construção</p>
        </div>
        {isAdminOrDono && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Novo Plano</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Plano</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Nome do plano" value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))} />
                <Select value={newPlan.category} onValueChange={v => setNewPlan(p => ({ ...p, category: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="programa_monitorizacao">Programa de Monitorização</SelectItem>
                    <SelectItem value="plano_projeto">Plano/Projeto</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Periodicidade (ex: Semestral, Trimestral)" value={newPlan.periodicity} onChange={e => setNewPlan(p => ({ ...p, periodicity: e.target.value }))} />
                <Textarea placeholder="Notas" value={newPlan.notes} onChange={e => setNewPlan(p => ({ ...p, notes: e.target.value }))} />
                <Button onClick={() => createMutation.mutate({ ...newPlan, periodicity: newPlan.periodicity || undefined, notes: newPlan.notes || undefined })} disabled={!newPlan.name || createMutation.isPending}>
                  {createMutation.isPending ? "A criar..." : "Criar Plano"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Alerts */}
      {overdueReports.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Reportings em atraso</p>
              {overdueReports.map(p => (
                <p key={p.id} className="text-sm text-red-700">
                  {p.name} — previsto para {formatDate(p.nextReportingDate)}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {upcomingReports.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">Próximos reportings</p>
              {upcomingReports.map(p => {
                const days = daysUntil(p.nextReportingDate);
                return (
                  <p key={p.id} className="text-sm text-amber-700">
                    {p.name} — {formatDate(p.nextReportingDate)} ({days} dias)
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="programas">
        <TabsList>
          <TabsTrigger value="programas">
            <FileText className="w-4 h-4 mr-2" />Programas de Monitorização ({programas.length})
          </TabsTrigger>
          <TabsTrigger value="planos">
            <Calendar className="w-4 h-4 mr-2" />Planos e Projetos ({planos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="programas" className="mt-4 space-y-3">
          {programas.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum programa de monitorização registado.</p>
          ) : programas.map(plan => (
            <PlanCard key={plan.id} plan={plan} isAdminOrDono={isAdminOrDono} editingPlan={editingPlan} setEditingPlan={setEditingPlan} updateMutation={updateMutation} deleteMutation={deleteMutation} formatDate={formatDate} daysUntil={daysUntil} />
          ))}
        </TabsContent>

        <TabsContent value="planos" className="mt-4 space-y-3">
          {planos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum plano/projeto registado.</p>
          ) : planos.map(plan => (
            <PlanCard key={plan.id} plan={plan} isAdminOrDono={isAdminOrDono} editingPlan={editingPlan} setEditingPlan={setEditingPlan} updateMutation={updateMutation} deleteMutation={deleteMutation} formatDate={formatDate} daysUntil={daysUntil} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlanCard({ plan, isAdminOrDono, editingPlan, setEditingPlan, updateMutation, deleteMutation, formatDate, daysUntil }: any) {
  const [lastDate, setLastDate] = useState("");
  const [nextDate, setNextDate] = useState("");
  const isEditing = editingPlan === plan.id;

  const days = daysUntil(plan.nextReportingDate);
  const isOverdue = plan.nextReportingDate && plan.nextReportingDate < Date.now();

  return (
    <Card className={isOverdue ? "border-red-200" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm">{plan.name}</h3>
              {plan.periodicity && (
                <Badge variant="secondary" className="text-xs">{plan.periodicity}</Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">Em atraso</Badge>
              )}
              {days !== null && days > 0 && days <= 30 && (
                <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100">{days} dias</Badge>
              )}
            </div>
            {plan.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.notes}</p>}
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>Último: {formatDate(plan.lastReportingDate)}</span>
              <span>Próximo: {formatDate(plan.nextReportingDate)}</span>
            </div>
          </div>
          {isAdminOrDono && (
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setEditingPlan(isEditing ? null : plan.id)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover este plano?")) deleteMutation.mutate({ id: plan.id }); }}>
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </div>
          )}
        </div>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
