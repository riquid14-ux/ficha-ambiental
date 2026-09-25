import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, Send, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type RequestedUser = { fullName: string; email: string };
const statusLabels: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado", cancelled: "Cancelado" };

export default function EepRequests() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { projects } = useProject();
  const [companyName, setCompanyName] = useState("");
  const [shortName, setShortName] = useState("");
  const [allowKpi, setAllowKpi] = useState(true);
  const [allowWaste, setAllowWaste] = useState(false);
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [requestedUsers, setRequestedUsers] = useState<RequestedUser[]>([{ fullName: "", email: "" }]);
  const requests = trpc.eepRequests.mine.useQuery(undefined, { enabled: user?.role === "ee" });
  const create = trpc.eepRequests.create.useMutation({
    onSuccess: () => {
      toast.success("Pedido EEP submetido para aprovação");
      setCompanyName(""); setShortName(""); setAllowKpi(true); setAllowWaste(false); setProjectIds([]); setRequestedUsers([{ fullName: "", email: "" }]);
      requests.refetch();
    },
    onError: error => toast.error(error.message),
  });

  if (user?.role !== "ee") return <AppLayout><div className="p-8 text-center text-muted-foreground">{t("Esta área é exclusiva das Entidades Executantes.")}</div></AppLayout>;
  const validUsers = requestedUsers.filter(item => item.fullName.trim() && item.email.trim());
  const canSubmit = companyName.trim().length >= 2 && shortName.trim().length >= 2 && projectIds.length > 0 && (allowKpi || allowWaste) && validUsers.length === requestedUsers.length && validUsers.length > 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div><h1 className="text-2xl font-semibold">{t("Pedidos EEP")}</h1><p className="text-sm text-muted-foreground">{t("Peça a criação de uma Entidade Executante Parceira, dos seus utilizadores e dos acessos necessários.")}</p></div>
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />{t("Nova EEP")}</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2"><div><Label>Nome da empresa</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} /></div><div><Label>Sigla</Label><Input value={shortName} onChange={e => setShortName(e.target.value)} /></div></div>
              <div><Label>Módulos solicitados</Label><div className="mt-2 flex gap-5 rounded-lg border p-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={allowKpi} onChange={e => setAllowKpi(e.target.checked)} />KPI</label><label className="flex items-center gap-2"><input type="checkbox" checked={allowWaste} onChange={e => setAllowWaste(e.target.checked)} />Resíduos</label></div></div>
              <div><Label>Projectos da sua EE</Label><div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border p-3">{projects.map(project => <label key={project.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={projectIds.includes(project.id)} onChange={e => setProjectIds(current => e.target.checked ? [...current, project.id] : current.filter(id => id !== project.id))} />{project.code}</label>)}</div></div>
              <div className="space-y-3"><div className="flex items-center justify-between"><Label>Utilizadores a convidar</Label><Button type="button" size="sm" variant="outline" onClick={() => setRequestedUsers(current => [...current, { fullName: "", email: "" }])}><Plus className="mr-1 h-3 w-3" />Adicionar</Button></div>{requestedUsers.map((item, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><Input placeholder="Nome completo" value={item.fullName} onChange={e => setRequestedUsers(current => current.map((user, i) => i === index ? { ...user, fullName: e.target.value } : user))} /><Input type="email" placeholder="email@empresa.pt" value={item.email} onChange={e => setRequestedUsers(current => current.map((user, i) => i === index ? { ...user, email: e.target.value } : user))} /><Button size="icon" variant="ghost" disabled={requestedUsers.length === 1} onClick={() => setRequestedUsers(current => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
              <Button className="w-full" disabled={!canSubmit || create.isPending} onClick={() => create.mutate({ companyName, shortName, allowKpi, allowWaste, projectIds, users: validUsers })}><Send className="mr-2 h-4 w-4" />Submeter pedido</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Pedidos da minha EE</CardTitle></CardHeader>
            <CardContent className="space-y-3">{requests.data?.map(request => <div key={request.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{request.shortName} — {request.companyName}</p><p className="text-xs text-muted-foreground">{request.requestedUsers.length} utilizador(es) · {[request.allowKpi && "KPI", request.allowWaste && "Resíduos"].filter(Boolean).join(" + ")}</p></div><Badge variant={request.status === "approved" ? "default" : request.status === "rejected" ? "destructive" : "secondary"}>{statusLabels[request.status]}</Badge></div>{request.reviewNotes && <p className="mt-3 rounded bg-muted p-2 text-xs">{request.reviewNotes}</p>}</div>)}{requests.data?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Ainda não existem pedidos.</p>}</CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
