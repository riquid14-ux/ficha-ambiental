import AppLayout from "@/components/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Grid3X3, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Map submission status to display info
function getStatusDisplay(status: string) {
  switch (status) {
    case "draft":
      return { label: "Criada", color: "bg-amber-400", textColor: "text-amber-900", description: "Ficha criada (rascunho)" };
    case "submitted":
    case "under_review":
      return { label: "Em Revisão", color: "bg-blue-400", textColor: "text-blue-900", description: "Em processo de revisão" };
    case "approved":
      return { label: "Entregue", color: "bg-emerald-500", textColor: "text-white", description: "Aprovada/Entregue" };
    case "rejected":
      return { label: "Rejeitada", color: "bg-red-500", textColor: "text-white", description: "Rejeitada — necessita correção" };
    default:
      return { label: "—", color: "bg-muted", textColor: "text-muted-foreground", description: "" };
  }
}

export default function Matriz(props: any) {
  const { t } = useLanguage();
  const embedded = props?.embedded;
  const { activeProject, isAllProjects } = useProject();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const matrixQuery = trpc.matrix.getData.useQuery(
    isAllProjects ? { year: selectedYear } : { projectId: activeProject?.id, year: selectedYear }
  );

  // Fetch company periods and weeks without work for active project
  const periodsQuery = trpc.companyPeriods.getByProject.useQuery(
    { projectId: activeProject?.id! },
    { enabled: !!activeProject?.id && !isAllProjects }
  );
  const noWorkQuery = trpc.weeksWithoutWork.list.useQuery(
    { projectId: activeProject?.id! },
    { enabled: !!activeProject?.id && !isAllProjects }
  );

  // Helper: check if a company is active in a given week
  function isCompanyActiveInWeek(companyId: number, weekKey: string): boolean | null {
    if (isAllProjects || !periodsQuery.data) return null; // no filtering
    const parts = weekKey.split("-W");
    const year = parseInt(parts[0], 10);
    const week = parseInt(parts[1], 10);
    const period = (periodsQuery.data as any[]).find((p: any) => p.companyId === companyId);
    if (!period || (!period.startWeek && !period.endWeek)) return null; // no period set
    const buffer = period.bufferWeeks || 4;
    if (period.startWeek && period.startYear) {
      if (year < period.startYear || (year === period.startYear && week < period.startWeek)) return false;
    }
    if (period.endWeek && period.endYear) {
      const endTotal = period.endYear * 53 + period.endWeek + buffer;
      const currentTotal = year * 53 + week;
      if (currentTotal > endTotal) return false;
    }
    return true;
  }

  // Helper: check if a week is marked as no-work
  function isWeekNoWork(weekKey: string): boolean {
    if (!noWorkQuery.data) return false;
    const parts = weekKey.split("-W");
    const year = parseInt(parts[0], 10);
    const week = parseInt(parts[1], 10);
    return (noWorkQuery.data as any[]).some((w: any) => w.weekNumber === week && w.weekYear === year);
  }

  // Build the matrix: for each company, for each week, what's the status?
  const matrixData = useMemo(() => {
    if (!matrixQuery.data) return { rows: [], weeks: [] };

    const { submissions, companies, weeks } = matrixQuery.data;

    // Build a lookup: companyId -> weekKey -> best status
    const lookup = new Map<number, Map<string, string>>();
    for (const sub of submissions) {
      if (!lookup.has(sub.companyId)) lookup.set(sub.companyId, new Map());
      const companyMap = lookup.get(sub.companyId)!;
      // If multiple submissions for same company+week, pick the "best" status
      const existing = companyMap.get(sub.weekKey);
      const priority: Record<string, number> = { approved: 4, submitted: 3, under_review: 3, rejected: 2, draft: 1 };
      if (!existing || (priority[sub.status] || 0) > (priority[existing] || 0)) {
        companyMap.set(sub.weekKey, sub.status);
      }
    }

    const rows = companies.map(company => ({
      company,
      cells: weeks.map(weekKey => ({
        weekKey,
        status: lookup.get(company.id)?.get(weekKey) || null,
      })),
    }));

    return { rows, weeks };
  }, [matrixQuery.data]);

  // Format week key for display (2026-W32 -> S32)
  function formatWeek(weekKey: string) {
    const parts = weekKey.split("-W");
    return `S${parseInt(parts[1], 10)}`;
  }
  function formatWeekFull(weekKey: string) {
    const parts = weekKey.split("-W");
    return `Semana ${parseInt(parts[1], 10)} / ${parts[0]}`;
  }

  const inner = (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Grid3X3 className="w-6 h-6 text-primary" />
              {t("Matriz de Acompanhamento")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("Visão geral do estado das fichas por empresa e semana")}
              {!isAllProjects && activeProject && (
                <span className="ml-1 font-medium text-foreground">— {activeProject.code}</span>
              )}
            </p>
          </div>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Legend */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-muted-foreground">{t("Legenda")}:</span>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-muted border border-border" />
                <span>{t("Sem ficha")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-amber-400" />
                <span>{t("Criada (Rascunho)")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-blue-400" />
                <span>{t("Em Revisão")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-emerald-500" />
                <span>{t("Entregue")}</span>
              </div>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-red-500" />
                <span>{t("Rejeitada")}</span>
              </div>
              {isAllProjects && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-purple-400" />
                    <span>{t("Parcialmente entregue")}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Matrix Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {isAllProjects ? t("Visão Agregada por Empresa") : activeProject?.name || "Projeto"}
            </CardTitle>
            {isAllProjects && <p className="text-xs text-muted-foreground mt-1">{t("Cada linha representa uma empresa")}. Verde = todas as fichas entregues nessa semana.</p>}
          </CardHeader>
          <CardContent className="p-0">
            {matrixQuery.isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t("A carregar matriz...")}</span>
              </div>
            )}

            {matrixQuery.isError && (
              <div className="p-6 text-center text-red-600">
                {t("Erro ao carregar dados da matriz.")}
              </div>
            )}

            {!matrixQuery.isLoading && !matrixQuery.isError && matrixData.weeks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Grid3X3 className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  {t("Sem dados para exibir.")}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {t("As fichas submetidas aparecerão aqui organizadas por empresa e semana.")}
                </p>
              </div>
            )}

            {!matrixQuery.isLoading && !matrixQuery.isError && matrixData.weeks.length > 0 && (
              <div className="overflow-x-auto">
                <TooltipProvider delayDuration={200}>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-semibold text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[160px]">
                          Empresa
                        </th>
                        {matrixData.weeks.map(weekKey => (
                          <th key={weekKey} className="p-2 text-center font-medium text-muted-foreground min-w-[60px]">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{formatWeek(weekKey)}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{formatWeekFull(weekKey)}</p>
                              </TooltipContent>
                            </Tooltip>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.rows.map(row => (
                        <tr key={row.company.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-medium sticky left-0 bg-background z-10">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 uppercase">
                                {({"dono_obra":"DO","ee":"EE","rap":"RAP","raa":"RAA"} as Record<string,string>)[row.company.companyType] || row.company.companyType}
                              </Badge>
                              <span className="truncate">{row.company.shortName}</span>
                            </div>
                          </td>
                          {row.cells.map(cell => {
                            const inactive = isCompanyActiveInWeek(row.company.id, cell.weekKey) === false;
                            const noWork = isWeekNoWork(cell.weekKey);
                            const display = cell.status && !inactive ? getStatusDisplay(cell.status) : null;
                            return (
                              <td key={cell.weekKey} className="p-2 text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`w-8 h-8 rounded-md mx-auto flex items-center justify-center transition-all hover:scale-110 cursor-default ${
                                        inactive ? "bg-gray-200 border border-gray-300" :
                                        noWork ? "bg-gray-300 border border-gray-400" :
                                        display ? display.color : "bg-muted/50 border border-dashed border-border"
                                      }`}
                                    >
                                      {inactive ? (
                                        <span className="text-[8px] text-gray-500">—</span>
                                      ) : noWork ? (
                                        <span className="text-[8px] text-gray-600">P</span>
                                      ) : display ? (
                                        <span className={`text-[9px] font-bold ${display.textColor}`}>
                                          {display.label.charAt(0)}
                                        </span>
                                      ) : null}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">{row.company.shortName} — {formatWeekFull(cell.weekKey)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {inactive ? t("Empresa inactiva nesta semana") :
                                       noWork ? t("Semana sem trabalhos") :
                                       display ? display.description : t("Sem ficha submetida")}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TooltipProvider>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {!matrixQuery.isLoading && matrixData.rows.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {matrixData.rows.reduce((acc, row) => acc + row.cells.filter(c => c.status === "approved").length, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("Entregues")}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-500">
                    {matrixData.rows.reduce((acc, row) => acc + row.cells.filter(c => c.status === "submitted" || c.status === "under_review").length, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("Em Revisão")}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-500">
                    {matrixData.rows.reduce((acc, row) => acc + row.cells.filter(c => c.status === "draft").length, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("Rascunho")}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">
                    {matrixData.rows.reduce((acc, row) => acc + row.cells.filter(c => c.status === "rejected").length, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("Rejeitadas")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
  );
  if (embedded) return inner;
  return <AppLayout>{inner}</AppLayout>;
}
