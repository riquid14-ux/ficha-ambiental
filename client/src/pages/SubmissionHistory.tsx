import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { FileText, Calendar } from "lucide-react";

export default function SubmissionHistory() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const submissionsQuery = user?.role === "admin"
    ? trpc.submissions.listAll.useQuery({})
    : trpc.submissions.mySubmissions.useQuery();

  const companiesQuery = trpc.companies.list.useQuery();
  const companyMap = new Map(companiesQuery.data?.map((c) => [c.id, c]) || []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Histórico de Submissões</h1>
          <p className="text-muted-foreground text-sm mt-1">Fichas semanais submetidas</p>
        </div>

        {submissionsQuery.isLoading ? (
          <div className="text-muted-foreground text-sm">A carregar...</div>
        ) : submissionsQuery.data?.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Ainda não existem submissões.</p>
              <Button className="mt-4" onClick={() => setLocation("/ficha")}>
                Criar primeira ficha
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {submissionsQuery.data?.map((sub) => (
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
                        {user?.role === "admin" && companyMap.get(sub.companyId) && (
                          <span className="ml-2">— {companyMap.get(sub.companyId)?.shortName}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Badge variant={sub.status === "submitted" ? "default" : "secondary"}>
                    {sub.status === "submitted" ? "Submetida" : "Rascunho"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

