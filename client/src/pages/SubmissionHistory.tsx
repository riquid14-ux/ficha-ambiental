import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { FileText, Calendar, Download, Filter, FolderDown } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterPeriod = "all" | "week" | "month" | "quarter" | "semester";

function getMonthFromWeek(weekNumber: number, year: number): number {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7);
  return monday.getMonth() + 1;
}

function getQuarter(month: number): number {
  return Math.ceil(month / 3);
}

function getSemester(month: number): number {
  return month <= 6 ? 1 : 2;
}

export default function SubmissionHistory() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("all");
  const [filterValue, setFilterValue] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  const submissionsQuery = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "raa" || user?.role === "observador"
    ? trpc.submissions.listAll.useQuery({})
    : trpc.submissions.mySubmissions.useQuery();

  const companiesQuery = trpc.companies.list.useQuery();
  const companyMap = new Map(companiesQuery.data?.map((c) => [c.id, c]) || []);

  // Generate filter options based on period type
  const filterOptions = useMemo(() => {
    if (!submissionsQuery.data || submissionsQuery.data.length === 0) return [];

    switch (filterPeriod) {
      case "week": {
        const weeksSet = new Set<string>();
        submissionsQuery.data.forEach((s) => weeksSet.add(`${s.weekYear}-S${String(s.weekNumber).padStart(2, "0")}`));
        const weeks = Array.from(weeksSet).sort().reverse();
        return weeks.map((w) => ({ value: w, label: `Semana ${w.split("-S")[1]} / ${w.split("-S")[0]}` }));
      }
      case "month": {
        const monthsSet = new Set<string>();
        submissionsQuery.data.forEach((s) => {
          const m = getMonthFromWeek(s.weekNumber, s.weekYear);
          monthsSet.add(`${s.weekYear}-${String(m).padStart(2, "0")}`);
        });
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return Array.from(monthsSet).sort().reverse().map((m) => {
          const [y, mo] = m.split("-");
          return { value: m, label: `${monthNames[parseInt(mo) - 1]} ${y}` };
        });
      }
      case "quarter": {
        const quartersSet = new Set<string>();
        submissionsQuery.data.forEach((s) => {
          const m = getMonthFromWeek(s.weekNumber, s.weekYear);
          quartersSet.add(`${s.weekYear}-Q${getQuarter(m)}`);
        });
        return Array.from(quartersSet).sort().reverse().map((q) => ({ value: q, label: `${q.split("-")[1]} ${q.split("-")[0]}` }));
      }
      case "semester": {
        const semSet = new Set<string>();
        submissionsQuery.data.forEach((s) => {
          const m = getMonthFromWeek(s.weekNumber, s.weekYear);
          semSet.add(`${s.weekYear}-H${getSemester(m)}`);
        });
        return Array.from(semSet).sort().reverse().map((s) => {
          const [y, sem] = s.split("-H");
          return { value: s, label: `${sem === "1" ? "1.º" : "2.º"} Semestre ${y}` };
        });
      }
      default:
        return [];
    }
  }, [submissionsQuery.data, filterPeriod]);

  // Filter submissions based on selected period and value
  const filteredSubmissions = useMemo(() => {
    if (!submissionsQuery.data) return [];
    if (filterPeriod === "all" || filterValue === "all") return submissionsQuery.data;

    return submissionsQuery.data.filter((s) => {
      const month = getMonthFromWeek(s.weekNumber, s.weekYear);
      switch (filterPeriod) {
        case "week":
          return `${s.weekYear}-S${String(s.weekNumber).padStart(2, "0")}` === filterValue;
        case "month":
          return `${s.weekYear}-${String(month).padStart(2, "0")}` === filterValue;
        case "quarter":
          return `${s.weekYear}-Q${getQuarter(month)}` === filterValue;
        case "semester":
          return `${s.weekYear}-H${getSemester(month)}` === filterValue;
        default:
          return true;
      }
    });
  }, [submissionsQuery.data, filterPeriod, filterValue]);

  // Export all filtered submissions as PDFs (download individually or as batch)
  const handleExportAll = async () => {
    const exportable = filteredSubmissions.filter((s) => s.status === "submitted" || s.status === "approved");
    if (exportable.length === 0) {
      toast.error("Nenhuma ficha submetida/aprovada para exportar neste período.");
      return;
    }
    setExporting(true);
    toast.info(`A exportar ${exportable.length} ficha(s)...`);

    // Use the batch PDF endpoint
    const ids = exportable.map((s) => s.id).join(",");
    const link = document.createElement("a");
    link.href = `/api/pdf/batch?ids=${ids}`;
    link.download = `fichas_${filterPeriod}_${filterValue || "todas"}.zip`;
    link.click();
    
    setTimeout(() => setExporting(false), 2000);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Histórico de Submissões</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {filteredSubmissions.length} ficha{filteredSubmissions.length !== 1 ? "s" : ""}
              {filterPeriod !== "all" && filterValue !== "all" ? " (filtrado)" : ""}
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select
              value={filterPeriod}
              onValueChange={(v) => {
                setFilterPeriod(v as FilterPeriod);
                setFilterValue("all");
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="semester">Semestre</SelectItem>
              </SelectContent>
            </Select>

            {filterPeriod !== "all" && filterOptions.length > 0 && (
              <Select value={filterValue} onValueChange={setFilterValue}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Export All button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              disabled={exporting || filteredSubmissions.filter((s) => s.status === "submitted" || s.status === "approved").length === 0}
            >
              <FolderDown className="w-4 h-4 mr-1" />
              {exporting ? "A exportar..." : "Exportar PDFs"}
            </Button>
          </div>
        </div>

        {submissionsQuery.isLoading ? (
          <div className="text-muted-foreground text-sm">A carregar...</div>
        ) : filteredSubmissions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {submissionsQuery.data?.length === 0
                  ? "Ainda não existem submissões."
                  : "Nenhuma ficha encontrada para o período selecionado."}
              </p>
              {submissionsQuery.data?.length === 0 && (
                <Button className="mt-4" onClick={() => setLocation("/ficha")}>
                  Criar primeira ficha
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredSubmissions.map((sub) => (
              <Card key={sub.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation(`/ficha/${sub.id}`)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Semana {sub.weekNumber} / {sub.weekYear}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {sub.weekStartDate} a {sub.weekEndDate}
                        {(user?.role === "admin" || user?.role === "dono_obra" || user?.role === "raa" || user?.role === "observador") && companyMap.get(sub.companyId) && (
                          <span className="ml-2">— {companyMap.get(sub.companyId)?.shortName}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(sub.status === "submitted" || sub.status === "approved") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const link = document.createElement("a");
                          link.href = `/api/pdf/submission/${sub.id}`;
                          link.download = `ficha_S${sub.weekNumber}_${sub.weekYear}.pdf`;
                          link.click();
                          toast.success("A gerar PDF...");
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" /> PDF
                      </Button>
                    )}
                    <Badge
                      variant={
                        sub.status === "approved" ? "default" :
                        sub.status === "submitted" ? "secondary" :
                        sub.status === "rejected" ? "destructive" :
                        "outline"
                      }
                    >
                      {sub.status === "approved" ? "Aprovada" :
                       sub.status === "submitted" ? "Submetida" :
                       sub.status === "rejected" ? "Rejeitada" :
                       sub.status === "under_review" ? "Em revisão" :
                       "Rascunho"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
