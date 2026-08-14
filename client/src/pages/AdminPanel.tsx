import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { Building2, Users, Plus, FileUp, ClipboardList, ImageIcon } from "lucide-react";
import { Info, Shield, FileCheck, Eye, HardHat, Mail, Trash2, UserPlus, FolderKanban } from "lucide-react";
import { useLocation } from "wouter";
import ImagesTab from "./AdminImagesTab";

const ROLE_LABELS: Record<string, string> = {
  user: "Utilizador",
  admin: "Admin",
  ee: "EE",
  raa: "RAA",
  rap: "RAP",
  dono_obra: "Dono de Obra",
  observador: "Observador",
};

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


function AuditLogTab() {
  const { data: logs, isLoading } = trpc.audit.list.useQuery({ limit: 200 });
  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar...</p>;
  if (!logs || logs.length === 0) return <p className="text-sm text-muted-foreground">Sem registos de auditoria.</p>;
  return (
    <div className="max-h-[500px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white border-b">
          <tr>
            <th className="text-left p-2">Data</th>
            <th className="text-left p-2">Utilizador</th>
            <th className="text-left p-2">Ação</th>
            <th className="text-left p-2">Entidade</th>
            <th className="text-left p-2">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id} className="border-b hover:bg-gray-50">
              <td className="p-2 text-xs">{new Date(log.createdAt).toLocaleString("pt-PT")}</td>
              <td className="p-2">{log.userName || "—"}</td>
              <td className="p-2">{log.action}</td>
              <td className="p-2">{log.entity || "—"}</td>
              <td className="p-2 text-xs max-w-[200px] truncate">{log.oldValue ? `${log.oldValue} → ${log.newValue}` : log.newValue || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPanel() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.role !== "admin" && user?.role !== "dono_obra") {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Acesso restrito a administradores e Dono de Obra.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Administração</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de empresas, utilizadores e submissões</p>
        </div>

        {/* Explanatory Roles Panel */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">Tipos de Entidade e Permissões</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex items-start gap-2 p-2 bg-white dark:bg-slate-900 rounded border">
                <HardHat className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">EE — Entidade Executante</p>
                  <p className="text-xs text-muted-foreground">Submete as fichas de controlo semanais relativas às suas medidas.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-white dark:bg-slate-900 rounded border">
                <Shield className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">RAP — Resp. Acompanhamento Patrimonial</p>
                  <p className="text-xs text-muted-foreground">Submete as fichas de controlo semanais relativas às suas medidas.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-white dark:bg-slate-900 rounded border">
                <FileCheck className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">RAA — Resp. Acompanhamento Ambiental</p>
                  <p className="text-xs text-muted-foreground">Revê as fichas submetidas. Aprova ou rejeita com comentários por medida.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-white dark:bg-slate-900 rounded border">
                <Building2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Dono de Obra — Start Campus</p>
                  <p className="text-xs text-muted-foreground">Visão geral do projeto. Acesso de administração e supervisão.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-white dark:bg-slate-900 rounded border">
                <Eye className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Observador</p>
                  <p className="text-xs text-muted-foreground">Acesso de leitura. Pode ver dashboard, histórico e revisões.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="companies">
          <TabsList>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" /> Empresas
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" /> Utilizadores
            </TabsTrigger>
            <TabsTrigger value="submissions" className="gap-2">
              <ClipboardList className="w-4 h-4" /> Submissões
            </TabsTrigger>
            <TabsTrigger value="historical" className="gap-2">
              <FileUp className="w-4 h-4" /> Histórico PDF
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-2">
              <ImageIcon className="w-4 h-4" /> Imagens
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-2">
              🔑 Pedidos de Acesso
            </TabsTrigger>
            <TabsTrigger value="melhorias" className="gap-2">
              💡 Melhorias
            </TabsTrigger>
            {user?.role === "admin" && (
              <TabsTrigger value="auditoria" className="gap-2">
                📋 Auditoria
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="companies" className="mt-4">
            <CompaniesTab />
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>
          <TabsContent value="submissions" className="mt-4">
            <SubmissionsTab />
          </TabsContent>
          <TabsContent value="historical" className="mt-4">
            <HistoricalTab />
          </TabsContent>
          <TabsContent value="images" className="mt-4">
            <ImagesTab />
          </TabsContent>
          <TabsContent value="pedidos" className="mt-4"><PendingAccountsTab /></TabsContent>
          <TabsContent value="melhorias" className="mt-4">
            <MelhoriasTab />
          </TabsContent>
        
        {/* Audit Log Tab - Admin only */}
        {user?.role === "admin" && (
          <TabsContent value="auditoria" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Ações</CardTitle>
                <p className="text-sm text-muted-foreground">Registo de todas as alterações realizadas na plataforma (apenas leitura)</p>
              </CardHeader>
              <CardContent>
                <AuditLogTab />
              </CardContent>
            </Card>
          </TabsContent>
        )}
</Tabs>
      </div>
    </AppLayout>
  );
}

function CompaniesTab() {
  const [newName, setNewName] = useState("");
  const [newShortName, setNewShortName] = useState("");
  const [newType, setNewType] = useState<"ee" | "rap" | "dono_obra" | "raa" | "observador">("ee");
  const [dialogOpen, setDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const companiesQuery = trpc.companies.list.useQuery();
  const projectsQuery = trpc.projects.list.useQuery();
  const companyAssignmentsQuery = trpc.projects.allCompanyAssignments.useQuery();
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

  const setCompanyProjectsMutation = trpc.projects.setCompanyProjects.useMutation({
    onSuccess: () => {
      toast.success("Projetos da empresa atualizados");
      utils.projects.allCompanyAssignments.invalidate();
      setEditingCompanyId(null);
    },
  });

  // Build a map of companyId -> projectIds
  const companyProjectsMap = useMemo(() => {
    const map = new Map<number, number[]>();
    if (companyAssignmentsQuery.data) {
      for (const a of companyAssignmentsQuery.data) {
        const existing = map.get(a.companyId) || [];
        existing.push(a.projectId);
        map.set(a.companyId, existing);
      }
    }
    return map;
  }, [companyAssignmentsQuery.data]);

  const createMutation = trpc.companies.create.useMutation({
    onSuccess: () => {
      toast.success("Empresa criada com sucesso");
      utils.companies.list.invalidate();
      setDialogOpen(false);
      setNewName("");
      setNewShortName("");
      setNewType("ee");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Empresas / Entidades</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Empresa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Nome completo</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Empresa ABC, Lda." />
              </div>
              <div>
                <Label>Sigla / Nome curto</Label>
                <Input value={newShortName} onChange={(e) => setNewShortName(e.target.value)} placeholder="Ex: ABC" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as "ee" | "rap" | "dono_obra" | "raa" | "observador")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ee">EE - Entidade Executante</SelectItem>
                    <SelectItem value="rap">RAP - Resp. Acompanhamento Patrimonial</SelectItem>
                    <SelectItem value="dono_obra">Dono de Obra</SelectItem>
                    <SelectItem value="raa">RAA - Resp. Acompanhamento Ambiental</SelectItem>
                    <SelectItem value="observador">Observador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({ name: newName, shortName: newShortName, companyType: newType })}
                disabled={!newName || !newShortName}
              >
                Criar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Sigla</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Projetos</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companiesQuery.data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell><Badge variant="outline">{c.companyType === "rap" ? "RAP - " : ""}{c.shortName}</Badge></TableCell>
                <TableCell>
                  <Badge variant={c.companyType === "ee" ? "default" : c.companyType === "rap" ? "secondary" : "outline"}>
                    {c.companyType === "ee" ? "EE" : c.companyType === "rap" ? "RAP" : c.companyType === "dono_obra" ? "Dono de Obra" : c.companyType === "raa" ? "RAA" : "Observador"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {editingCompanyId === c.id ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {projectsQuery.data?.filter(p => p.code !== "main").map(p => (
                          <label key={p.id} className="flex items-center gap-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedProjectIds.includes(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProjectIds(prev => [...prev, p.id]);
                                } else {
                                  setSelectedProjectIds(prev => prev.filter(id => id !== p.id));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            {p.code}
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 text-xs px-2"
                          onClick={() => setCompanyProjectsMutation.mutate({ companyId: c.id, projectIds: selectedProjectIds })}
                          disabled={setCompanyProjectsMutation.isPending}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2"
                          onClick={() => setEditingCompanyId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 min-w-[80px]"
                      onClick={() => {
                        setEditingCompanyId(c.id);
                        setSelectedProjectIds(companyProjectsMap.get(c.id) || []);
                      }}
                    >
                      {(companyProjectsMap.get(c.id) || []).length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {(companyProjectsMap.get(c.id) || []).map(pid => {
                            const proj = projectsQuery.data?.find(p => p.id === pid);
                            return proj ? (
                              <Badge key={pid} variant="secondary" className="text-[10px] px-1 py-0">
                                {proj.code}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FolderKanban className="w-3 h-3" />
                          Todos
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={c.active ? "default" : "secondary"}>
                    {c.active ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {companiesQuery.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma empresa registada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SubmissionsTab() {
  const submissionsQuery = trpc.submissions.listAll.useQuery({});
  const companiesQuery = trpc.companies.list.useQuery();
  const companyMap = new Map(companiesQuery.data?.map((c) => [c.id, c]) || []);
  const [, setLocation] = useLocation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Todas as Submissões</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissionsQuery.data?.map((sub) => {
              const company = companyMap.get(sub.companyId);
              return (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">S{sub.weekNumber}/{sub.weekYear}</TableCell>
                  <TableCell>
                    {company?.companyType === "rap" ? "RAP - " : ""}{company?.shortName || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sub.weekStartDate} - {sub.weekEndDate}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[sub.status] || "secondary"}>
                      {STATUS_LABELS[sub.status] || sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setLocation(`/ficha/${sub.id}`)}>
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {submissionsQuery.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma submissão registada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const utils = trpc.useUtils();
  const usersQuery = trpc.users.list.useQuery();
  const companiesQuery = trpc.companies.list.useQuery();
  const invitationsQuery = trpc.invitations.list.useQuery();
  const projectsQuery = trpc.projects.list.useQuery();
  const userAssignmentsQuery = trpc.projects.allUserAssignments.useQuery();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompanyId, setInviteCompanyId] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<string>("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingProjectsUserId, setEditingProjectsUserId] = useState<number | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

  const assignCompanyMutation = trpc.users.assignCompany.useMutation({
    onSuccess: () => {
      toast.success("Empresa atribuída");
      utils.users.list.invalidate();
    },
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Papel atualizado");
      utils.users.list.invalidate();
    },
  });

  const createInviteMutation = trpc.invitations.create.useMutation({
    onSuccess: () => {
      toast.success("Convite enviado com sucesso");
      utils.invitations.list.invalidate();
      setInviteEmail("");
      setInviteCompanyId("");
      setInviteRole("");
      setShowInviteDialog(false);
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao criar convite");
    },
  });

  const deleteInviteMutation = trpc.invitations.delete.useMutation({
    onSuccess: () => {
      toast.success("Convite removido");
      utils.invitations.list.invalidate();
    },
  });

  const setUserProjectsMutation = trpc.projects.setUserProjects.useMutation({
    onSuccess: () => {
      toast.success("Projetos atualizados");
      utils.projects.allUserAssignments.invalidate();
      setEditingProjectsUserId(null);
    },
  });

  // Build a map of userId -> projectIds
  const userProjectsMap = useMemo(() => {
    const map = new Map<number, number[]>();
    if (userAssignmentsQuery.data) {
      for (const a of userAssignmentsQuery.data) {
        const existing = map.get(a.userId) || [];
        existing.push(a.projectId);
        map.set(a.userId, existing);
      }
    }
    return map;
  }, [userAssignmentsQuery.data]);

  const handleInvite = () => {
    if (!inviteEmail || !inviteCompanyId || !inviteRole) {
      toast.error("Preencha todos os campos");
      return;
    }
    createInviteMutation.mutate({
      email: inviteEmail,
      companyId: Number(inviteCompanyId),
      role: inviteRole as any,
    });
  };

  return (
    <div className="space-y-6">
      {/* Invite User Button + Dialog */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Utilizadores</CardTitle>
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Convidar Utilizador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Novo Utilizador</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@empresa.pt"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select value={inviteCompanyId} onValueChange={setInviteCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companiesQuery.data?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.shortName} ({c.companyType.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ee">EE — Entidade Executante</SelectItem>
                      <SelectItem value="rap">RAP — Resp. Acomp. Patrimonial</SelectItem>
                      <SelectItem value="raa">RAA — Resp. Acomp. Ambiental</SelectItem>
                      <SelectItem value="dono_obra">Dono de Obra</SelectItem>
                      <SelectItem value="observador">Observador</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quando esta pessoa fizer login pela primeira vez com este email, será automaticamente associada à empresa e papel selecionados.
                </p>
                <Button onClick={handleInvite} className="w-full" disabled={createInviteMutation.isPending}>
                  {createInviteMutation.isPending ? "A enviar..." : "Enviar Convite"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
               <TableHead>Papel</TableHead>
               <TableHead>Empresa</TableHead>
               <TableHead>Projetos</TableHead>
                <TableHead>Fases</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email || "-"}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(v) => updateRoleMutation.mutate({ userId: u.id, role: v as any })}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Utilizador</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="ee">EE</SelectItem>
                        <SelectItem value="raa">RAA</SelectItem>
                        <SelectItem value="rap">RAP</SelectItem>
                        <SelectItem value="dono_obra">Dono de Obra</SelectItem>
                        <SelectItem value="observador">Observador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.companyId ? String(u.companyId) : "none"}
                      onValueChange={(v) => assignCompanyMutation.mutate({ userId: u.id, companyId: v === "none" ? null : Number(v) })}
                    >
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue placeholder="Sem empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem empresa</SelectItem>
                        {companiesQuery.data?.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.companyType === "rap" ? "RAP - " : ""}{c.shortName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {editingProjectsUserId === u.id ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {projectsQuery.data?.filter(p => p.code !== "main").map(p => (
                            <label key={p.id} className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedProjectIds.includes(p.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProjectIds(prev => [...prev, p.id]);
                                  } else {
                                    setSelectedProjectIds(prev => prev.filter(id => id !== p.id));
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              {p.code}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-6 text-xs px-2"
                            onClick={() => setUserProjectsMutation.mutate({ userId: u.id, projectIds: selectedProjectIds })}
                            disabled={setUserProjectsMutation.isPending}
                          >
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={() => setEditingProjectsUserId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 min-w-[80px]"
                        onClick={() => {
                          setEditingProjectsUserId(u.id);
                          setSelectedProjectIds(userProjectsMap.get(u.id) || []);
                        }}
                      >
                        {(userProjectsMap.get(u.id) || []).length > 0 ? (
                          <div className="flex flex-wrap gap-0.5">
                            {(userProjectsMap.get(u.id) || []).map(pid => {
                              const proj = projectsQuery.data?.find(p => p.id === pid);
                              return proj ? (
                                <Badge key={pid} variant="secondary" className="text-[10px] px-1 py-0">
                                  {proj.code}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                           <FolderKanban className="w-3 h-3" />
                           Todos
                         </span>
                       )}
                     </div>
                   )}
                 </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-0.5">
                      {(u.role === "admin" || u.role === "dono_obra" || u.role === "raa") ? (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 text-green-700">Todas</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">Construção</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitationsQuery.data && invitationsQuery.data.filter((i) => i.status === "pending").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Convites Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitationsQuery.data.filter((i) => i.status === "pending").map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>{inv.companyName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABELS[inv.role] || inv.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString("pt-PT")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteInviteMutation.mutate({ id: inv.id })}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HistoricalTab() {
  const utils = trpc.useUtils();
  const companiesQuery = trpc.companies.list.useQuery();
  const historicalQuery = trpc.historical.list.useQuery({});
  const uploadMutation = trpc.historical.upload.useMutation({
    onSuccess: () => {
      toast.success("PDF histórico carregado com sucesso");
      utils.historical.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [weekNumber, setWeekNumber] = useState<string>("");
  const [weekYear, setWeekYear] = useState<string>(String(new Date().getFullYear()));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedCompany || !weekNumber || !weekYear) {
      toast.error("Preencha todos os campos e selecione um ficheiro.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        companyId: Number(selectedCompany),
        weekNumber: Number(weekNumber),
        weekYear: Number(weekYear),
        filename: file.name,
        mimeType: file.type || "application/pdf",
        data: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carregar Ficha Histórica (PDF)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Empresa</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {companiesQuery.data?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.companyType === "rap" ? "RAP - " : ""}{c.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Semana</Label>
              <Input type="number" min={1} max={53} value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} placeholder="Ex: 32" />
            </div>
            <div>
              <Label>Ano</Label>
              <Input type="number" min={2020} max={2030} value={weekYear} onChange={(e) => setWeekYear(e.target.value)} />
            </div>
            <div>
              <Label>Ficheiro PDF</Label>
              <Input type="file" accept=".pdf" ref={fileInputRef} />
            </div>
          </div>
          <Button className="mt-4" onClick={handleUpload} disabled={uploadMutation.isPending}>
            <FileUp className="w-4 h-4 mr-2" />
            {uploadMutation.isPending ? "A carregar..." : "Carregar PDF"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fichas Históricas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Ficheiro</TableHead>
                <TableHead>Data Upload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historicalQuery.data?.map((h) => {
                const company = companiesQuery.data?.find((c) => c.id === h.companyId);
                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">S{h.weekNumber}/{h.weekYear}</TableCell>
                    <TableCell>{company?.companyType === "rap" ? "RAP - " : ""}{company?.shortName || "-"}</TableCell>
                    <TableCell>
                      <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                        {h.filename || "PDF"}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(h.uploadedAt).toLocaleDateString("pt-PT")}
                    </TableCell>
                  </TableRow>
                );
              })}
              {historicalQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma ficha histórica carregada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MelhoriasTab() {
  const { data: feedbacks, refetch } = trpc.feedback.list.useQuery();
  const updateMutation = trpc.feedback.updateStatus.useMutation({ onSuccess: () => refetch() });
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Feedback e Melhorias dos Utilizadores</h3>
      {!feedbacks || feedbacks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sem feedback recebido. Os utilizadores podem enviar sugestões pelo menu do perfil.</p>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((fb: any) => (
            <div key={fb.id} className={`border rounded-lg p-4 ${fb.status === "implementado" ? "border-green-200 bg-green-50/30" : fb.status === "rejeitado" ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{fb.userName || fb.userEmail || "Anónimo"}</p>
                  <p className="text-xs text-muted-foreground">{fb.createdAt ? new Date(fb.createdAt).toLocaleDateString("pt-PT") : ""}</p>
                </div>
                <select className="text-xs border rounded px-2 py-1" value={fb.status || "pendente"} onChange={e => updateMutation.mutate({ id: fb.id, status: e.target.value })}>
                  <option value="pendente">Pendente</option>
                  <option value="em_analise">Em Análise</option>
                  <option value="implementado">Implementado</option>
                  <option value="rejeitado">Rejeitado</option>
                </select>
              </div>
              <p className="text-sm mt-2">{fb.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pending Accounts Tab ───────────────────────────────────────────────────
function PendingAccountsTab() {
  const pendingQuery = trpc.auth.pendingAccounts.useQuery();
  const approveMutation = trpc.auth.approveAccount.useMutation({
    onSuccess: () => { pendingQuery.refetch(); },
  });
  const pending = (pendingQuery.data || []) as any[];
  if (pending.length === 0) return <div className="text-center py-8 text-muted-foreground">Nenhum pedido de acesso pendente.</div>;
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Pedidos de Acesso Pendentes</h3>
      {pending.map((p: any) => (
        <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">{p.name}</p>
            <p className="text-sm text-muted-foreground">{p.email}</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700" onClick={() => approveMutation.mutate({ userId: p.id, approve: true })}>Aprovar</button>
            <button className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700" onClick={() => approveMutation.mutate({ userId: p.id, approve: false })}>Rejeitar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
