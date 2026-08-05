import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function Calendario() {
  const { user } = useAuth();
  const storedProject = localStorage.getItem("selectedProjectId");
  const projectId = storedProject ? parseInt(storedProject) : undefined;

  const { data: plans, isLoading } = trpc.monitoringPlans.list.useQuery(
    projectId ? { projectId } : undefined
  );

  const now = Date.now();

  // Categorize plans
  const plansWithDates = (plans || []).filter(p => p.periodicity);
  const overdue = plansWithDates.filter(p => p.nextReportingDate && p.nextReportingDate < now && p.nextReportingDate > 0);
  const upcoming = plansWithDates.filter(p => p.nextReportingDate && p.nextReportingDate >= now)
    .sort((a, b) => (a.nextReportingDate || 0) - (b.nextReportingDate || 0));
  const noDate = plansWithDates.filter(p => !p.nextReportingDate);
  const completed = plansWithDates.filter(p => p.lastReportingDate && !p.nextReportingDate);

  function formatDate(ts: number | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
  }

  function timeUntil(ts: number | null) {
    if (!ts) return "";
    const diff = ts - now;
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return `${Math.abs(days)} dias em atraso`;
    if (days === 0) return "Hoje";
    if (days === 1) return "Amanhã";
    if (days < 30) return `Daqui a ${days} dias`;
    const months = Math.floor(days / 30);
    if (months === 1) return "Daqui a 1 mês";
    return `Daqui a ${months} meses`;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  // Find the next upcoming report for the hero alert
  const nextReport = upcoming[0];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Calendário de Reporting
        </h1>
        <p className="text-muted-foreground">Visão geral dos reportings programados e próximos prazos</p>
      </div>

      {/* Hero Alert - Next Reporting */}
      {nextReport && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm text-emerald-600 font-medium">Próximo Reporting</p>
                <p className="font-bold text-lg text-emerald-900">{nextReport.name}</p>
                <p className="text-sm text-emerald-700">
                  {formatDate(nextReport.nextReportingDate)} — {timeUntil(nextReport.nextReportingDate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue Reports */}
      {overdue.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Em Atraso ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map(plan => (
              <Card key={plan.id} className="border-red-200 bg-red-50/50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-red-900">{plan.name}</p>
                    <p className="text-xs text-red-600">Previsto: {formatDate(plan.nextReportingDate)} — {timeUntil(plan.nextReportingDate)}</p>
                  </div>
                  <Badge variant="destructive">{plan.periodicity}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Reports */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Próximos Reportings ({upcoming.length})
          </h2>
          <div className="space-y-2">
            {upcoming.map(plan => {
              const days = Math.ceil(((plan.nextReportingDate || 0) - now) / 86400000);
              const urgency = days <= 7 ? "destructive" : days <= 30 ? "default" : "secondary";
              return (
                <Card key={plan.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(plan.nextReportingDate)} — {timeUntil(plan.nextReportingDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={urgency}>{plan.periodicity}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Plans without dates */}
      {noDate.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-muted-foreground">Sem Data Definida ({noDate.length})</h2>
          <p className="text-xs text-muted-foreground">Estes planos têm periodicidade mas ainda não têm datas de reporting definidas. O DO/Admin pode definir na página Planos.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {noDate.map(plan => (
              <Card key={plan.id} className="border-dashed">
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">{plan.periodicity}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {plansWithDates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum plano com periodicidade definida.</p>
          <p className="text-sm">Os planos são geridos na página "Planos".</p>
        </div>
      )}
    </div>
  );
}
