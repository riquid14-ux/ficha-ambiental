import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { FileText, Calendar, Download, Filter, FolderDown, BarChart3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export default function SubmissionHistory(props: any) {
  const { t } = useLanguage();
  const embedded = props?.embedded;
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { activeProject, isAllProjects } = useProject();
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("all");
  const [filterValue, setFilterValue] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState<"fichas" | "medidas">("fichas");
  const [viewMode, setViewMode] = useState<"submissions" | "deleted">("submissions");

  // Per-measure export state
  const [measureSearch, setMeasureSearch] = useState("");
  const [selectedMeasureIds, setSelectedMeasureIds] = useState<number[]>([]);
  const [measureStatusFilter, setMeasureStatusFilter] = useState<string>("all");
  const [measureStartDate, setMeasureStartDate] = useState("");
  const [measureEndDate, setMeasureEndDate] = useState("");
  const [exportingMeasure, setExportingMeasure] = useState(false);

  const submissionsQuery = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "raa" || user?.role === "observador"
    ? trpc.submissions.listAll.useQuery({})
    : trpc.submissions.mySubmissions.useQuery();

  // Filter submissions by active project
  const submissions = useMemo(() => {
    const data = submissionsQuery.data || [];
    // Exclude drafts from history - drafts belong in the WeeklyForm "Rascunhos" tab
    const nonDrafts = data.filter((s: any) => s.status !== "draft");
    if (isAllProjects) return nonDrafts;
    if (!activeProject) return nonDrafts;
    return nonDrafts.filter((s: any) => s.projectId === activeProject.id);
  }, [submissionsQuery.data, activeProject, isAllProjects]);

  const companiesQuery = trpc.companies.list.useQuery();
  const companyMap = new Map(companiesQuery.data?.map((c) => [c.id, c]) || []);

  const usersQuery = trpc.users.list.useQuery(undefined, { enabled: user?.role === "admin" || user?.role === "dono_obra" || user?.role === "raa" });
  const userMap = new Map((usersQuery.data || []).map((u: any) => [u.id, u.name || u.email]));
  const getUserName = (id: number | null | undefined) => id ? (userMap.get(id) || `#${id}`) : "-";
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const deleteMutation = trpc.submissions.delete.useMutation({
    onSuccess: () => { toast.success(t("Ficha eliminada com sucesso")); submissionsQuery.refetch(); setDeleteDialogOpen(false); setDeleteTarget(null); setDeleteConfirmText(""); },
    onError: (err: any) => toast.error(err.message),
  });

  // Fetch measures and sections for per-measure export
  const measuresQuery = trpc.measures.list.useQuery();
  const sectionsQuery = trpc.sections.list.useQuery();

  // Filter measures by search
  const filteredMeasures = useMemo(() => {
    if (!measuresQuery.data) return [];
    // First filter by role: EE/RAP only see their measures
    let roleMeasures = measuresQuery.data;
    const role = user?.role;
    if (role && role !== "admin" && role !== "raa" && role !== "dono_obra" && role !== "observador") {
      if (role === "rap") {
        roleMeasures = roleMeasures.filter((m) => m.responsible.toUpperCase().includes("RAP"));
      } else {
        // EE and others
        roleMeasures = roleMeasures.filter((m) => m.responsible.toUpperCase().includes("EE"));
      }
    }
    if (!measureSearch) return roleMeasures;
    const q = measureSearch.toLowerCase();
    return roleMeasures.filter(
      (m) => m.number.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    );
  }, [measuresQuery.data, measureSearch, user?.role]);

  // Handle per-measure export
  const handleExportMeasure = () => {
    if (selectedMeasureIds.length === 0) {
      toast.error("Selecione pelo menos uma medida para exportar.");
      return;
    }
    if (!measureStartDate || !measureEndDate) {
      toast.error("Selecione as datas de início e fim do período.");
      return;
    }
    setExportingMeasure(true);
    toast.info(`A gerar PDF de evolução para ${selectedMeasureIds.length} medida(s)...`);

    const params = new URLSearchParams({
      measureIds: selectedMeasureIds.join(","),
      startDate: measureStartDate,
      endDate: measureEndDate,
    });
    if (measureStatusFilter !== "all") {
      params.set("status", measureStatusFilter);
    }

    const link = document.createElement("a");
    link.href = `/api/pdf/measure?${params.toString()}`;
    link.download = `medidas_evolucao.pdf`;
    link.click();

    setTimeout(() => setExportingMeasure(false), 2000);
  };

  const toggleMeasure = (id: number) => {
    setSelectedMeasureIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Generate filter options based on period type
  const filterOptions = useMemo(() => {
    if (!submissions || submissions.length === 0) return [];

    switch (filterPeriod) {
      case "week": {
        const weeksSet = new Set<string>();
        submissions.forEach((s: any) => weeksSet.add(`${s.weekYear}-S${String(s.weekNumber).padStart(2, "0")}`));
        const weeks = Array.from(weeksSet).sort().reverse();
        return weeks.map((w) => ({ value: w, label: `Semana ${w.split("-S")[1]} / ${w.split("-S")[0]}` }));
      }
      case "month": {
        const monthsSet = new Set<string>();
        submissions.forEach((s: any) => {
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
        submissions.forEach((s: any) => {
          const m = getMonthFromWeek(s.weekNumber, s.weekYear);
          quartersSet.add(`${s.weekYear}-Q${getQuarter(m)}`);
        });
        return Array.from(quartersSet).sort().reverse().map((q) => ({ value: q, label: `${q.split("-")[1]} ${q.split("-")[0]}` }));
      }
      case "semester": {
        const semSet = new Set<string>();
        submissions.forEach((s: any) => {
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
  }, [submissions, filterPeriod]);

  // Filter submissions based on selected period and value
  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    if (filterPeriod === "all" || filterValue === "all") return submissions;

    return submissions.filter((s: any) => {
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
  }, [submissions, filterPeriod, filterValue]);

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

  const inner = (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Histórico de Submissões")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("Consulte e exporte fichas por período ou por medida")}</p>
        </div>

        {/* View mode toggle: Submissions vs Deleted */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === "submissions" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("submissions")}
            className="gap-1.5"
          >
            <FileText className="w-4 h-4" />
            Fichas Submetidas
          </Button>
          {(user?.role === "admin" || user?.role === "dono_obra") && (
            <Button
              variant={viewMode === "deleted" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("deleted")}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Fichas Eliminadas
            </Button>
          )}
        </div>

        {viewMode === "deleted" ? (
          <DeletionHistoryView />
        ) : (
        <Tabs value={exportMode} onValueChange={(v) => setExportMode(v as any)}>
          <TabsList>
            <TabsTrigger value="fichas">
              <FileText className="w-4 h-4 mr-1.5" /> Por Ficha
            </TabsTrigger>
            <TabsTrigger value="medidas">
              <BarChart3 className="w-4 h-4 mr-1.5" /> Por Medida
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab: Por Ficha ─── */}
          <TabsContent value="fichas" className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {filteredSubmissions.length} ficha{filteredSubmissions.length !== 1 ? "s" : ""}
                {filterPeriod !== "all" && filterValue !== "all" ? " (filtrado)" : ""}
              </p>
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
                    <SelectItem value="all">{t("Todos")}</SelectItem>
                    <SelectItem value="week">{t("Semana")}</SelectItem>
                    <SelectItem value="month">{t("Mês")}</SelectItem>
                    <SelectItem value="quarter">{t("Trimestre")}</SelectItem>
                    <SelectItem value="semester">{t("Semestre")}</SelectItem>
                  </SelectContent>
                </Select>

                {filterPeriod !== "all" && filterOptions.length > 0 && (
                  <Select value={filterValue} onValueChange={setFilterValue}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("Todos")}</SelectItem>
                      {filterOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

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
              <div className="text-muted-foreground text-sm">{t("A carregar...")}</div>
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
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("Criado por")}: {getUserName(sub.createdBy)}
                            {sub.reviewedBy && <> · {t("Aprovado por")}: {getUserName(sub.reviewedBy)}</>}
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
                        {user?.role === "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(sub);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
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
          </TabsContent>

          {/* ─── Tab: Por Medida ─── */}
          <TabsContent value="medidas" className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-5 space-y-5">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{t("Exportar Evolução por Medida")}</h3>
                  <p className="text-sm text-muted-foreground">{t("Selecione uma ou mais medidas e um período para gerar um PDF com a evolução semanal (estado, observações e fotos).")}</p>
                </div>

                {/* Period and Status filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t("Data Início")}</Label>
                    <Input
                      type="date"
                      value={measureStartDate}
                      onChange={(e) => setMeasureStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t("Data Fim")}</Label>
                    <Input
                      type="date"
                      value={measureEndDate}
                      onChange={(e) => setMeasureEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t("Filtrar por Estado")}</Label>
                    <Select value={measureStatusFilter} onValueChange={setMeasureStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("Todos os estados")}</SelectItem>
                        <SelectItem value="I">{t("Implementado")}</SelectItem>
                        <SelectItem value="C">{t("Conforme")}</SelectItem>
                        <SelectItem value="NC">{t("Não Conforme")}</SelectItem>
                        <SelectItem value="NA">{t("Não Aplicável")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Measure selector */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Selecionar Medidas ({selectedMeasureIds.length} selecionada{selectedMeasureIds.length !== 1 ? "s" : ""})</Label>
                  <Input
                    placeholder={t("Pesquisar medida por número ou descrição...")}
                    value={measureSearch}
                    onChange={(e) => setMeasureSearch(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex gap-2 mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedMeasureIds(filteredMeasures.map((m) => m.id))}
                    >
                      Selecionar todas
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedMeasureIds([])}
                    >{t("Limpar seleção")}</Button>
                  </div>
                  <ScrollArea className="h-[280px] border rounded-md p-2">
                    <div className="space-y-1">
                      {filteredMeasures.map((measure) => {
                        const section = sectionsQuery.data?.find((s) => s.id === measure.sectionId);
                        return (
                          <div
                            key={measure.id}
                            className={`flex items-start gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors ${selectedMeasureIds.includes(measure.id) ? "bg-primary/5 border border-primary/20" : ""}`}
                            onClick={() => toggleMeasure(measure.id)}
                          >
                            <Checkbox
                              checked={selectedMeasureIds.includes(measure.id)}
                              onCheckedChange={() => toggleMeasure(measure.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{measure.number}</span>
                                <span className="text-xs text-muted-foreground">{section?.name?.substring(0, 40)}</span>
                              </div>
                              <p className="text-xs text-foreground mt-0.5 line-clamp-2">{measure.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* Export button */}
                <Button
                  onClick={handleExportMeasure}
                  disabled={exportingMeasure || selectedMeasureIds.length === 0 || !measureStartDate || !measureEndDate}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {exportingMeasure
                    ? "A gerar PDF..."
                    : `Exportar Evolução (${selectedMeasureIds.length} medida${selectedMeasureIds.length !== 1 ? "s" : ""})`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        )}
      </div>
  );

  const deleteDialog = (
    <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeleteTarget(null); setDeleteConfirmText(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">{t("Eliminar Ficha Semanal")}</DialogTitle>
        </DialogHeader>
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm">
              {t("Confirma que quer eliminar a ficha semanal da")} <strong>{companyMap.get(deleteTarget.companyId)?.shortName || "?"}</strong> — S{deleteTarget.weekNumber}/{deleteTarget.weekYear}?
            </p>
            <p className="text-sm text-muted-foreground">
              {t("Criado por")}: {getUserName(deleteTarget.createdBy)} | {t("Aprovado por")}: {deleteTarget.reviewedBy ? getUserName(deleteTarget.reviewedBy) : "-"}
            </p>
            <div>
              <label className="text-sm font-medium">{t("Escreva")} "<strong>eliminar</strong>" {t("para confirmar")}:</label>
              <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="eliminar" className="mt-1" />
            </div>
            <Button variant="destructive" disabled={deleteConfirmText.toLowerCase() !== "eliminar" || deleteMutation.isPending} onClick={() => deleteMutation.mutate({ id: deleteTarget.id })} className="w-full">
              {deleteMutation.isPending ? t("A eliminar...") : t("Confirmar Eliminação")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (embedded) return inner;
  return <AppLayout>{inner}{deleteDialog}</AppLayout>;
}

function DeletionHistoryView() {
  const { t } = useLanguage();
  const deletionLogsQuery = trpc.deletionLogs.list.useQuery();
  const { activeProject, isAllProjects } = useProject();
  const { user } = useAuth();
  const recoverMutation = trpc.submissions.recover.useMutation({
    onSuccess: () => {
      toast.success("Ficha recuperada com sucesso!");
      deletionLogsQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao recuperar ficha.");
    },
  });

  // Filter by active project
  const filteredLogs = useMemo(() => {
    const logs = deletionLogsQuery.data || [];
    if (isAllProjects) return logs;
    if (!activeProject) return logs;
    return logs.filter((log: any) => log.projectId === activeProject.id);
  }, [deletionLogsQuery.data, activeProject, isAllProjects]);

  if (deletionLogsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">{t("A carregar histórico de eliminações...")}</CardContent>
      </Card>
    );
  }

  if (deletionLogsQuery.isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">{t("Não foi possível carregar o histórico de eliminações.")}</CardContent>
      </Card>
    );
  }

  if (filteredLogs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">{t("Nenhuma ficha foi eliminada até ao momento.")}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Semana")}</TableHead>
              <TableHead>{t("Empresa")}</TableHead>
              <TableHead>{t("Eliminado por")}</TableHead>
              <TableHead>{t("Data")}</TableHead>
              <TableHead>{t("Recuperar")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log: any) => (
              <TableRow key={log.id}>{(() => {
                const deletedAt = new Date(log.deletedAt).getTime();
                const daysSince = (Date.now() - deletedAt) / (1000 * 60 * 60 * 24);
                const canRecover = daysSince <= 21 && (user?.role === "admin" || user?.role === "dono_obra" || user?.id === log.createdBy);
                const daysLeft = Math.max(0, Math.ceil(21 - daysSince));
                return (<>
                <TableCell className="font-medium">
                  S{String(log.weekNumber).padStart(2, "0")} / {log.weekYear}
                </TableCell>
                <TableCell>{log.companyName || "-"}</TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium">{log.deletedByName || "-"}</span>
                    {log.deletedByEmail && (
                      <span className="text-xs text-muted-foreground ml-1">({log.deletedByEmail})</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(log.deletedAt).toLocaleString("pt-PT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell>
                  {canRecover ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-700 border-green-300 hover:bg-green-50"
                      disabled={recoverMutation.isPending}
                      onClick={() => recoverMutation.mutate({ id: log.submissionId })}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Recuperar ({daysLeft}d)
                    </Button>
                  ) : daysSince > 21 ? (
                    <span className="text-xs text-muted-foreground">{t("Expirado")}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("Sem permissão")}</span>
                  )}
                </TableCell>
                </>);
              })()}</TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
import { RotateCcw } from "lucide-react";
