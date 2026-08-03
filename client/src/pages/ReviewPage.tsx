import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle, MessageSquare, Eye, Filter } from "lucide-react";
import { useLocation } from "wouter";

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

export default function ReviewPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const canReview = user?.role === "raa" || user?.role === "admin" || user?.role === "dono_obra";
  const canSee = canReview || user?.role === "observador";

  const submissionsQuery = trpc.submissions.listAll.useQuery({});
  const companiesQuery = trpc.companies.list.useQuery();
  const companyMap = new Map(companiesQuery.data?.map((c) => [c.id, c]) || []);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [measureFilter, setMeasureFilter] = useState<MeasureStatusFilter>("all");

  // Queries for detail view
  const sectionsQuery = trpc.sections.list.useQuery();
  const measuresQuery = trpc.measures.list.useQuery();
  const responsesQuery = trpc.responses.getBySubmission.useQuery(
    { submissionId: selectedSubmission?.id! },
    { enabled: !!selectedSubmission && detailDialogOpen }
  );

  const reviewMutation = trpc.submissions.review.useMutation({
    onSuccess: () => {
      toast.success("Revisão submetida com sucesso");
      utils.submissions.listAll.invalidate();
      setReviewDialogOpen(false);
      setSelectedSubmission(null);
      setReviewNotes("");
    },
    onError: (err) => toast.error(err.message),
  });

  const pendingReview = submissionsQuery.data?.filter((s) => s.status === "submitted") || [];
  const reviewed = submissionsQuery.data?.filter((s) => s.status === "approved" || s.status === "rejected") || [];

  const handleReview = (sub: any) => {
    setSelectedSubmission(sub);
    setReviewDialogOpen(true);
  };

  const handleViewDetail = (sub: any) => {
    setSelectedSubmission(sub);
    setMeasureFilter("all");
    setDetailDialogOpen(true);
  };

  const submitReview = (status: "approved" | "rejected") => {
    if (!selectedSubmission) return;
    reviewMutation.mutate({ id: selectedSubmission.id, status, notes: reviewNotes || null });
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

  if (!canSee) {
    return (
      <AppLayout>
        <Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">Acesso restrito.</p></CardContent></Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Revisão de Fichas</h1>
          <p className="text-muted-foreground text-sm mt-1">Reveja, comente e aprove fichas submetidas pelas empresas</p>
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
                  <TableHead>Semana</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Ações</TableHead>
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
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma ficha pendente de revisão</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Already Reviewed */}
        <Card>
          <CardHeader><CardTitle className="text-base">Fichas Já Revistas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Ações</TableHead>
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
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(sub)}>
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {reviewed.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma ficha revista ainda</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Rever Ficha</DialogTitle></DialogHeader>
            {selectedSubmission && (
              <div className="space-y-4 pt-2">
                <div className="text-sm">
                  <p><strong>Empresa:</strong> {companyMap.get(selectedSubmission.companyId)?.shortName}</p>
                  <p><strong>Semana:</strong> S{selectedSubmission.weekNumber}/{selectedSubmission.weekYear}</p>
                  <p><strong>Período:</strong> {selectedSubmission.weekStartDate} - {selectedSubmission.weekEndDate}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Notas / Comentários</label>
                  <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Adicione notas sobre a revisão (opcional)..." rows={4} />
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1" variant="default" onClick={() => submitReview("approved")} disabled={reviewMutation.isPending}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Aprovar
                  </Button>
                  <Button className="flex-1" variant="destructive" onClick={() => submitReview("rejected")} disabled={reviewMutation.isPending}>
                    <XCircle className="w-4 h-4 mr-2" /> Rejeitar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Detail View Dialog with Status Filter */}
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
                  <span className="text-sm font-medium text-muted-foreground">Filtrar por:</span>
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
                  <p className="text-center text-muted-foreground py-8">Nenhuma medida com o estado selecionado</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
