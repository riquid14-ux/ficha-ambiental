import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle, MessageSquare, Eye } from "lucide-react";
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

export default function ReviewPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const canReview = user?.role === "raa" || user?.role === "admin" || user?.role === "dono_obra";

  const submissionsQuery = trpc.submissions.listAll.useQuery({});
  const companiesQuery = trpc.companies.list.useQuery();
  const companyMap = new Map(companiesQuery.data?.map((c) => [c.id, c]) || []);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");

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

  const addCommentMutation = trpc.reviewComments.add.useMutation({
    onSuccess: () => {
      toast.success("Comentário adicionado");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!canReview) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Acesso restrito a RAA, Admin e Dono de Obra.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  // Filter to show only submitted ones for review
  const pendingReview = submissionsQuery.data?.filter((s) => s.status === "submitted") || [];
  const reviewed = submissionsQuery.data?.filter((s) => s.status === "approved" || s.status === "rejected") || [];

  const handleApprove = (sub: any) => {
    setSelectedSubmission(sub);
    setReviewDialogOpen(true);
  };

  const submitReview = (status: "approved" | "rejected") => {
    if (!selectedSubmission) return;
    reviewMutation.mutate({
      id: selectedSubmission.id,
      status,
      notes: reviewNotes || null,
    });
  };

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
              <MessageSquare className="w-4 h-4" />
              Fichas Pendentes de Revisão ({pendingReview.length})
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
                      <TableCell>
                        {company?.companyType === "rap" ? "RAP - " : ""}{company?.shortName || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sub.weekStartDate} - {sub.weekEndDate}</TableCell>
                      <TableCell className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setLocation(`/ficha/${sub.id}`)}>
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                        <Button variant="default" size="sm" onClick={() => handleApprove(sub)}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Rever
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pendingReview.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma ficha pendente de revisão
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Already Reviewed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fichas Já Revistas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.map((sub) => {
                  const company = companyMap.get(sub.companyId);
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">S{sub.weekNumber}/{sub.weekYear}</TableCell>
                      <TableCell>{company?.companyType === "rap" ? "RAP - " : ""}{company?.shortName || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[sub.status] || "secondary"}>
                          {STATUS_LABELS[sub.status] || sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {sub.reviewNotes || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {reviewed.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma ficha revista ainda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rever Ficha</DialogTitle>
            </DialogHeader>
            {selectedSubmission && (
              <div className="space-y-4 pt-2">
                <div className="text-sm">
                  <p><strong>Empresa:</strong> {companyMap.get(selectedSubmission.companyId)?.shortName}</p>
                  <p><strong>Semana:</strong> S{selectedSubmission.weekNumber}/{selectedSubmission.weekYear}</p>
                  <p><strong>Período:</strong> {selectedSubmission.weekStartDate} - {selectedSubmission.weekEndDate}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Notas / Comentários</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Adicione notas sobre a revisão (opcional)..."
                    rows={4}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    variant="default"
                    onClick={() => submitReview("approved")}
                    disabled={reviewMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" /> Aprovar
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => submitReview("rejected")}
                    disabled={reviewMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Rejeitar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

