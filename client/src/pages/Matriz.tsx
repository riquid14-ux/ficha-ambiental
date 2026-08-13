import AppLayout from "@/components/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Grid3X3, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemo } from "react";

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
  const embedded = props?.embedded;
  const { activeProject, isAllProjects } = useProject();

  const matrixQuery = trpc.matrix.getData.useQuery(
    isAllProjects ? undefined : { projectId: activeProject?.id }
  );

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
              Matriz de Acompanhamento
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão geral do estado das fichas por empresa e semana
              {!isAllProjects && activeProject && (
                <span className="ml-1 font-medium text-foreground">— {activeProject.code}</span>
              )}
            </p>
          </div>
        </div>

        {/* Legend */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-muted-foreground">Legenda:</span>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-muted border border-border" />
                <span>Sem ficha</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-amber-400" />
                <span>Criada (Rascunho)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-blue-400" />
                <span>Em Revisão</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-emerald-500" />
                <span>Entregue</span>
              </div>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-red-500" />
                <span>Rejeitada</span>
              </div>
              {isAllProjects && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-purple-400" />
                    <span>Parcialmente entregue</span>
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
              {isAllProjects ? "Visão Agregada por Projeto" : activeProject?.name || "Projeto"}
            </CardTitle>
            {isAllProjects && <p className="text-xs text-muted-foreground mt-1">Cada linha representa um projeto. Verde = todas as fichas entregues nessa semana.</p>}
          </CardHeader>
          <CardContent className="p-0">
            {matrixQuery.isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">A carregar matriz...</span>
              </div>
            )}

            {matrixQuery.isError && (
              <div className="p-6 text-center text-red-600">
                Erro ao carregar dados da matriz. Tente novamente.
              </div>
            )}

            {!matrixQuery.isLoading && !matrixQuery.isError && matrixData.weeks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Grid3X3 className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  Sem dados para exibir.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  As fichas submetidas aparecerão aqui organizadas por empresa e semana.
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
                                {row.company.companyType}
                              </Badge>
                              <span className="truncate">{row.company.shortName}</span>
                            </div>
                          </td>
                          {row.cells.map(cell => {
                            const display = cell.status ? getStatusDisplay(cell.status) : null;
                            return (
                              <td key={cell.weekKey} className="p-2 text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`w-8 h-8 rounded-md mx-auto flex items-center justify-center transition-all hover:scale-110 cursor-default ${
                                        display ? display.color : "bg-muted/50 border border-dashed border-border"
                                      }`}
                                    >
                                      {display && (
                                        <span className={`text-[9px] font-bold ${display.textColor}`}>
                                          {display.label.charAt(0)}
                                        </span>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">{row.company.shortName} — {formatWeekFull(cell.weekKey)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {display ? display.description : "Sem ficha submetida"}
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
                  <p className="text-xs text-muted-foreground">Entregues</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-500">
                    {matrixData.rows.reduce((acc, row) => acc + row.cells.filter(c => c.status === "submitted" || c.status === "under_review").length, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Em Revisão</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-500">
                    {matrixData.rows.reduce((acc, row) => acc + row.cells.filter(c => c.status === "draft").length, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Rascunho</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">
                    {matrixData.rows.reduce((acc, row) => acc + row.cells.filter(c => c.status === "rejected").length, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Rejeitadas</p>
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
