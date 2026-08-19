import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useMemo, useCallback } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import { CheckCircle, XCircle, MessageSquare, Eye, Filter, Check, X as XIcon, Send, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Submetida",
  under_review: "Em Revisão",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  submitted: "default",
  under_review: "outline",
  approved: "default",
  rejected: "destructive",
};

const MEASURE_STATUS_COLORS: Record<string, string> = {
  I: "bg-green-100 text-green-800",
  C: "bg-blue-100 text-blue-800",
  NC: "bg-red-100 text-red-800",
  NA: "bg-slate-100 text-slate-600",
};

type MeasureStatusFilter = "all" | "I" | "C" | "NC" | "NA";
type MeasureVerdict = "ok" | "nok" | null;
type VerdictMap = Record<number, { verdict: MeasureVerdict; comment: string }>;

export default function ReviewPage(props: any) {
  const { t } = useLanguage();
  const embedded = props?.embedded;
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { activeProject, isAllProjects } = useProject();

  const canReview = user?.role === "raa" || user?.role === "admin" || user?.role === "dono_obra";
  const canSee = canReview || user?.role === "observador";

  const submissionsQuery = trpc.submissions.listAll.useQuery({});
  const companiesQuery = trpc.companies.list.useQuery();
  const companyMap = new Map(companiesQuery.data?.map((c) => [c.id, c]) || []);
  const usersQuery = trpc.users.list.useQuery(undefined, { enabled: canReview });
  const userMap = new Map((usersQuery.data || []).map((u: any) => [u.id, u.name || u.email]));
  const getUserName = (id: number | null | undefined) => id ? (userMap.get(id) || `#${id}`) : "-";
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const deleteMutation = trpc.submissions.delete.useMutation({
    onSuccess: () => { toast.success(t("Ficha eliminada com sucesso")); submissionsQuery.refetch(); setDeleteDialogOpen(false); setDeleteTarget(null); setDeleteConfirmText(""); },
    onError: (err: any) => toast.error(err.message),
  });

  // Filter submissions by active project
  const filteredSubmissions = useMemo(() => {
    const data = submissionsQuery.data || [];
    if (isAllProjects) return data;
    if (!activeProject) return data;
    return data.filter((s: any) => s.projectId === activeProject.id);
  }, [submissionsQuery.data, activeProject, isAllProjects]);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [measureFilter, setMeasureFilter] = useState<MeasureStatusFilter>("all");
  const [verdicts, setVerdicts] = useState<VerdictMap>({});

  // Queries for detail/review view
  const sectionsQuery = trpc.sections.list.useQuery();
  const measuresQuery = trpc.measures.list.useQuery();
  const responsesQuery = trpc.responses.getBySubmission.useQuery(
    { submissionId: selectedSubmission?.id! },
    { enabled: !!selectedSubmission && (detailDialogOpen || reviewDialogOpen) }
  );

  const reviewMutation = trpc.submissions.review.useMutation({
    onSuccess: () => {
      toast.success("Revisão submetida com sucesso");
      utils.submissions.listAll.invalidate();
      setReviewDialogOpen(false);
      setSelectedSubmission(null);
      setReviewNotes("");
      setVerdicts({});
    },
    onError: (err) => toast.error(err.message),
  });

  const pendingReview = filteredSubmissions.filter((s) => s.status === "submitted") || [];
  const reviewed = filteredSubmissions.filter((s) => s.status === "approved" || s.status === "rejected") || [];

  const handleReview = (sub: any) => {
    setSelectedSubmission(sub);
    setVerdicts({});
    setReviewNotes("");
    setMeasureFilter("all");
    setReviewDialogOpen(true);
  };

  const handleViewDetail = (sub: any) => {
    setSelectedSubmission(sub);
    setMeasureFilter("all");
    setDetailDialogOpen(true);
  };

  const setVerdict = useCallback((measureId: number, verdict: MeasureVerdict) => {
    setVerdicts((prev) => ({
      ...prev,
      [measureId]: { ...prev[measureId], verdict, comment: prev[measureId]?.comment || "" },
    }));
  }, []);

  const setVerdictComment = useCallback((measureId: number, comment: string) => {
    setVerdicts((prev) => ({
      ...prev,
      [measureId]: { ...prev[measureId], verdict: prev[measureId]?.verdict || null, comment },
    }));
  }, []);

  const submitReview = (status: "approved" | "rejected") => {
    if (!selectedSubmission) return;
    // Collect per-measure reviews (only those with a verdict set)
    const measureReviews = Object.entries(verdicts)
      .filter(([, v]) => v.verdict !== null)
      .map(([measureId, v]) => ({
        measureId: Number(measureId),
        verdict: v.verdict as "ok" | "nok",
        comment: v.comment || null,
      }));
    reviewMutation.mutate({
      id: selectedSubmission.id,
      status,
      notes: reviewNotes || null,
      measureReviews: measureReviews.length > 0 ? measureReviews : undefined,
    });
  };

  // Group measures by section, filtered by status
  const filteredMeasuresBySection = useMemo(() => {
    if (!measuresQuery.data || !sectionsQuery.data || !responsesQuery.data) return [];
    const responseMap = new Map(responsesQuery.data.map((r) => [r.measureId, r]));
    const sectionMap = new Map<number, { section: any; measures: any[] }>();
    for (const s of sectionsQuery.data) {
      sectionMap.set(s.id, { section: s, measures: [] });
    }
    for (const m of measuresQuery.data) {
      const response = responseMap.get(m.id);
      const status = response?.status || null;
      // Only show measures that have actual responses (not empty/null)
      // This prevents RAA from seeing all 156 measures when only 30 were submitted
      if (!response || !response.status) continue;
      if (measureFilter !== "all" && status !== measureFilter) continue;
      const group = sectionMap.get(m.sectionId);
      if (group) group.measures.push({ ...m, response });
    }
    return Array.from(sectionMap.values()).filter((g) => g.measures.length > 0);
  }, [measuresQuery.data, sectionsQuery.data, responsesQuery.data, measureFilter]);

  // Count by status for the detail view
  const statusCounts = useMemo(() => {
    if (!responsesQuery.data) return { I: 0, C: 0, NC: 0, NA: 0, total: 0 };
    const counts = { I: 0, C: 0, NC: 0, NA: 0, total: 0 };
    for (const r of responsesQuery.data) {
      if (r.status === "I") counts.I++;
      else if (r.status === "C") counts.C++;
      else if (r.status === "NC") counts.NC++;
      else if (r.status === "NA") counts.NA++;
      counts.total++;
    }
    return counts;
  }, [responsesQuery.data]);

  // Count verdicts set
  const verdictCounts = useMemo(() => {
    let ok = 0, nok = 0;
    Object.values(verdicts).forEach((v) => {
      if (v.verdict === "ok") ok++;
      if (v.verdict === "nok") nok++;
    });
    return { ok, nok, total: ok + nok };
  }, [verdicts]);

  if (!canSee) {
    const restricted = <Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">{t("Acesso restrito.")}</p></CardContent></Card>;
    return embedded ? restricted : <AppLayout>{restricted}</AppLayout>;
  }

  const mainContent = (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Revisão de Fichas")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("Reveja, comente e aprove fichas submetidas pelas empresas")}</p>
        </div>

        {/* Pending Review */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />Fichas Pendentes de Revisão ({pendingReview.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Semana")}</TableHead>
                  <TableHead>{t("Empresa")}</TableHead>
                  <TableHead>{t("Período")}</TableHead>
                  <TableHead>{t("Criado por")}</TableHead>
                  <TableHead>{t("Ações")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReview.map((sub) => {
                  const company = companyMap.get(sub.companyId);
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">S{sub.weekNumber}/{sub.weekYear}</TableCell>
                      <TableCell>{company?.companyType === "rap" ? "RAP - " : ""}{company?.shortName || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sub.weekStartDate} - {sub.weekEndDate}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{getUserName(sub.createdBy)}</TableCell>
                      <TableCell className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(sub)}>
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                        {canReview && (
                          <Button variant="default" size="sm" onClick={() => handleReview(sub)}>
                            <CheckCircle className="w-4 h-4 mr-1" /> Rever
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pendingReview.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("Nenhuma ficha pendente de revisão")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Already Reviewed */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Fichas Já Revistas")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Semana")}</TableHead>
                  <TableHead>{t("Empresa")}</TableHead>
                  <TableHead>{t("Estado")}</TableHead>
                  <TableHead>{t("Notas")}</TableHead>
                  <TableHead>{t("Criado por")}</TableHead>
                  <TableHead>{t("Aprovado por")}</TableHead>
                  <TableHead>{t("Ações")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.map((sub) => {
                  const company = companyMap.get(sub.companyId);
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">S{sub.weekNumber}/{sub.weekYear}</TableCell>
                      <TableCell>{company?.companyType === "rap" ? "RAP - " : ""}{company?.shortName || "-"}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[sub.status] || "secondary"}>{STATUS_LABELS[sub.status] || sub.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{sub.reviewNotes || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{getUserName(sub.createdBy)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sub.status === "approved" ? getUserName(sub.reviewedBy) : "-"}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(sub)}>
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                        {user?.role === "admin" && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleteTarget(sub); setDeleteDialogOpen(true); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {reviewed.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("Nenhuma ficha revista ainda")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ═══ REVIEW DIALOG — Full per-measure review ═══ */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Rever Ficha — {selectedSubmission && `S${selectedSubmission.weekNumber}/${selectedSubmission.weekYear}`}
              </DialogTitle>
            </DialogHeader>
            {selectedSubmission && (
              <div className="space-y-4">
                {/* Summary info */}
                <div className="flex flex-wrap gap-4 text-sm bg-muted/50 p-3 rounded-lg">
                  <span><strong>{t("Empresa:")}</strong> {companyMap.get(selectedSubmission.companyId)?.shortName}</span>
                  <span><strong>{t("Período:")}</strong> {selectedSubmission.weekStartDate} - {selectedSubmission.weekEndDate}</span>
                  <span><strong>{t("Marcadas:")}</strong> {verdictCounts.total} ({verdictCounts.ok} ✓ / {verdictCounts.nok} ✗)</span>
                </div>

                {/* Status filter */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-medium text-muted-foreground">{t("Filtrar:")}</span>
                  <Button size="sm" variant={measureFilter === "all" ? "default" : "outline"} onClick={() => setMeasureFilter("all")}>
                    Todos ({statusCounts.total})
                  </Button>
                  <Button size="sm" variant={measureFilter === "I" ? "default" : "outline"} className={measureFilter === "I" ? "bg-green-600 hover:bg-green-700" : ""} onClick={() => setMeasureFilter("I")}>
                    I ({statusCounts.I})
                  </Button>
                  <Button size="sm" variant={measureFilter === "C" ? "default" : "outline"} className={measureFilter === "C" ? "bg-blue-600 hover:bg-blue-700" : ""} onClick={() => setMeasureFilter("C")}>
                    C ({statusCounts.C})
                  </Button>
                  <Button size="sm" variant={measureFilter === "NC" ? "default" : "outline"} className={measureFilter === "NC" ? "bg-red-600 hover:bg-red-700" : ""} onClick={() => setMeasureFilter("NC")}>
                    NC ({statusCounts.NC})
                  </Button>
                  <Button size="sm" variant={measureFilter === "NA" ? "default" : "outline"} className={measureFilter === "NA" ? "bg-slate-500 hover:bg-slate-600" : ""} onClick={() => setMeasureFilter("NA")}>
                    NA ({statusCounts.NA})
                  </Button>
                </div>

                {/* Measures grouped by section — with review controls */}
                <Accordion type="multiple" className="space-y-2" defaultValue={filteredMeasuresBySection.map(g => String(g.section.id))}>
                  {filteredMeasuresBySection.map(({ section, measures }) => (
                    <AccordionItem key={section.id} value={String(section.id)} className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{section.phase}</Badge>
                          <span className="text-left">{section.name.length > 50 ? section.name.slice(0, 50) + "..." : section.name}</span>
                          <Badge variant="outline" className="ml-auto text-xs">{measures.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {measures.map((m: any) => {
                            const v = verdicts[m.id];
                            return (
                              <div key={m.id} className={`p-3 border rounded-lg space-y-2 transition-colors ${v?.verdict === "ok" ? "border-green-300 bg-green-50/50 dark:bg-green-950/20" : v?.verdict === "nok" ? "border-red-300 bg-red-50/50 dark:bg-red-950/20" : "bg-card"}`}>
                                {/* Measure info */}
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{m.number}</span>
                                  <p className="text-sm flex-1">{m.description}</p>
                                  {m.response?.status && (
                                    <Badge className={`text-xs shrink-0 ${MEASURE_STATUS_COLORS[m.response.status]}`}>
                                      {m.response.status}
                                    </Badge>
                                  )}
                                </div>
                                {/* EE/RAP observations */}
                                {m.response?.observations && (
                                  <p className="text-xs text-muted-foreground ml-8 italic bg-muted/50 p-2 rounded">"{m.response.observations}"</p>
                                )}
                                {/* Review controls: ✓ / ✗ buttons + comment */}
                                <div className="flex items-center gap-2 ml-8 pt-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={v?.verdict === "ok" ? "default" : "outline"}
                                    className={`h-8 px-3 ${v?.verdict === "ok" ? "bg-green-600 hover:bg-green-700 text-white" : "hover:bg-green-50 dark:bg-green-900/20 hover:border-green-300"}`}
                                    onClick={() => setVerdict(m.id, v?.verdict === "ok" ? null : "ok")}
                                  >
                                    <Check className="w-4 h-4 mr-1" /> Conforme
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={v?.verdict === "nok" ? "default" : "outline"}
                                    className={`h-8 px-3 ${v?.verdict === "nok" ? "bg-red-600 hover:bg-red-700 text-white" : "hover:bg-red-50 dark:bg-red-900/20 hover:border-red-300"}`}
                                    onClick={() => setVerdict(m.id, v?.verdict === "nok" ? null : "nok")}
                                  >
                                    <XIcon className="w-4 h-4 mr-1" /> Não Conforme
                                  </Button>
                                  <Input
                                    placeholder="Comentário RAA (opcional)..."
                                    value={v?.comment || ""}
                                    onChange={(e) => setVerdictComment(m.id, e.target.value)}
                                    className="flex-1 h-8 text-xs"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {filteredMeasuresBySection.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">{t("Nenhuma medida com o estado selecionado")}</p>
                )}

                {/* General notes + action buttons */}
                <div className="border-t pt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium">{t("Notas gerais da revisão")}</label>
                    <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder={t("Adicione notas gerais sobre a revisão (opcional)...")} rows={3} />
                  </div>
                  <div className="flex gap-3">
                    {/* FLOW-04: Block self-approval in UI */}
                    {(selectedSubmission?.createdBy === user?.id || selectedSubmission?.submittedBy === user?.id) ? (
                      <div className="w-full text-center p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-md">
                        <p className="text-sm text-amber-700 font-medium">{t("Não pode aprovar/rejeitar uma ficha que criou ou submeteu.")}</p>
                        <p className="text-xs text-amber-600 mt-1">{t("Separação de funções: peça a outro revisor para avaliar esta ficha.")}</p>
                      </div>
                    ) : (
                      <>
                        <Button className="flex-1" variant="default" onClick={() => submitReview("approved")} disabled={reviewMutation.isPending}>
                          <CheckCircle className="w-4 h-4 mr-2" /> Aprovar Ficha
                        </Button>
                        <Button className="flex-1" variant="destructive" onClick={() => submitReview("rejected")} disabled={reviewMutation.isPending}>
                          <XCircle className="w-4 h-4 mr-2" /> Rejeitar Ficha
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══ DETAIL VIEW DIALOG (read-only) ═══ */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Detalhe da Ficha — {selectedSubmission && `S${selectedSubmission.weekNumber}/${selectedSubmission.weekYear}`}
              </DialogTitle>
            </DialogHeader>
            {selectedSubmission && (
              <div className="space-y-4">
                {/* Status filter buttons */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-medium text-muted-foreground">{t("Filtrar por:")}</span>
                  <Button size="sm" variant={measureFilter === "all" ? "default" : "outline"} onClick={() => setMeasureFilter("all")}>
                    Todos ({statusCounts.total})
                  </Button>
                  <Button size="sm" variant={measureFilter === "I" ? "default" : "outline"} className={measureFilter === "I" ? "bg-green-600 hover:bg-green-700" : ""} onClick={() => setMeasureFilter("I")}>
                    I ({statusCounts.I})
                  </Button>
                  <Button size="sm" variant={measureFilter === "C" ? "default" : "outline"} className={measureFilter === "C" ? "bg-blue-600 hover:bg-blue-700" : ""} onClick={() => setMeasureFilter("C")}>
                    C ({statusCounts.C})
                  </Button>
                  <Button size="sm" variant={measureFilter === "NC" ? "default" : "outline"} className={measureFilter === "NC" ? "bg-red-600 hover:bg-red-700" : ""} onClick={() => setMeasureFilter("NC")}>
                    NC ({statusCounts.NC})
                  </Button>
                  <Button size="sm" variant={measureFilter === "NA" ? "default" : "outline"} className={measureFilter === "NA" ? "bg-slate-500 hover:bg-slate-600" : ""} onClick={() => setMeasureFilter("NA")}>
                    NA ({statusCounts.NA})
                  </Button>
                </div>

                {/* Measures grouped by section */}
                <Accordion type="multiple" className="space-y-2">
                  {filteredMeasuresBySection.map(({ section, measures }) => (
                    <AccordionItem key={section.id} value={String(section.id)} className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{section.phase}</Badge>
                          <span className="text-left">{section.name.length > 50 ? section.name.slice(0, 50) + "..." : section.name}</span>
                          <Badge variant="outline" className="ml-auto text-xs">{measures.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {measures.map((m: any) => (
                            <div key={m.id} className="p-3 border rounded bg-card space-y-1">
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{m.number}</span>
                                <p className="text-sm flex-1">{m.description}</p>
                                {m.response?.status && (
                                  <Badge className={`text-xs shrink-0 ${MEASURE_STATUS_COLORS[m.response.status]}`}>
                                    {m.response.status}
                                  </Badge>
                                )}
                              </div>
                              {m.response?.observations && (
                                <p className="text-xs text-muted-foreground ml-8 italic">"{m.response.observations}"</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {filteredMeasuresBySection.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">{t("Nenhuma medida com o estado selecionado")}</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
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
      </div>
  );
  return embedded ? mainContent : <AppLayout>{mainContent}</AppLayout>;
}
