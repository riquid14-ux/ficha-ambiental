import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { useState, useRef, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Building2, Users, Plus, FileUp, ClipboardList, ImageIcon } from "lucide-react";
import { Info, Shield, FileCheck, Eye, HardHat, Mail, Trash2, UserPlus, FolderKanban, Pencil, XCircle, CheckCircle2 } from "lucide-react";
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
  const { t } = useLanguage();
  const { data: logs, isLoading } = trpc.audit.list.useQuery({ limit: 200 });
  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar...</p>;
  if (!logs || logs.length === 0) return <p className="text-sm text-muted-foreground">Sem registos de auditoria.</p>;
  return (
    <div className="max-h-[500px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background border-b">
          <tr>
            <th className="text-left p-2">Data</th>
            <th className="text-left p-2">Utilizador</th>
            <th className="text-left p-2">{t("Ação")}</th>
            <th className="text-left p-2">Entidade</th>
            <th className="text-left p-2">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id} className="border-b hover:bg-muted">
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
  const { t } = useLanguage();
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Administração")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("Gestão de empresas, utilizadores e submissões")}</p>
        </div>

        {/* Explanatory Roles Panel */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">{t("Tipos de Entidade e Permissões")}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <HardHat className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">EE — Entidade Executante</p>
                  <p className="text-xs text-muted-foreground">{t("Submete as fichas de controlo semanais relativas às suas medidas.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <Shield className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">RAP — Resp. Acompanhamento Patrimonial</p>
                  <p className="text-xs text-muted-foreground">{t("Submete as fichas de controlo semanais relativas às suas medidas.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <FileCheck className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">RAA — Resp. Acompanhamento Ambiental</p>
                  <p className="text-xs text-muted-foreground">{t("Revê as fichas submetidas. Aprova ou rejeita com comentários por medida.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <Building2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Dono de Obra — Start Campus</p>
                  <p className="text-xs text-muted-foreground">{t("Visão geral do projeto. Acesso de administração e supervisão.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <Eye className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Observador</p>
                  <p className="text-xs text-muted-foreground">{t("Acesso de leitura. Pode ver dashboard, histórico e revisões.")}</p>
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
            {user?.role === "admin" && (
              <TabsTrigger value="email" className="gap-2">
                ✉️ {t("Email")}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="companies" className="mt-4">
            <CompaniesTab />
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>
          <TabsContent value="images" className="mt-4">
            <ImagesTab />
          </TabsContent>
          <TabsContent value="pedidos" className="mt-4"><PendingAccountsTab /></TabsContent>
          <TabsContent value="melhorias" className="mt-4">
            <MelhoriasTab />
          </TabsContent>
          {user?.role === "admin" && (
            <TabsContent value="email" className="mt-4">
              <EmailConfigTab />
            </TabsContent>
          )}
        
        {/* Audit Log Tab - Admin only */}
        {user?.role === "admin" && (
          <TabsContent value="auditoria" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("Histórico de Ações")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("Registo de todas as alterações realizadas na plataforma (apenas leitura)")}</p>
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
  const { t } = useLanguage();
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

  const deleteCompanyMutation = trpc.companies.delete.useMutation({
    onSuccess: () => { toast.success(t("Empresa eliminada")); companiesQuery.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateCompanyMutation = trpc.companies.update.useMutation({
    onSuccess: () => { toast.success(t("Empresa atualizada")); companiesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
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
      toast.success(t("Empresa criada com sucesso"));
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
        <CardTitle className="text-base">{t("Empresas / Entidades")}</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Criar Nova Empresa")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>{t("Nome completo")}</Label>
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
                      <SelectItem value="pm">PM — Project Manager</SelectItem>
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
                        {projectsQuery.data?.filter(p => p.code !== "main" && p.code !== "SIN01-NEST").map(p => (
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
                              className="rounded border-border"
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
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const newName = prompt("Nome da empresa:", c.name); if (newName && newName !== c.name) updateCompanyMutation.mutate({ id: c.id, name: newName }); }} title="Editar">
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600" onClick={() => { if (confirm(`Desativar a empresa "${c.name}"? Os dados serão preservados.`)) updateCompanyMutation.mutate({ id: c.id, active: c.active ? 0 : 1 }); }} title={c.active ? "Desativar" : "Reativar"}>
                      {c.active ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => { if (confirm(`ELIMINAR PERMANENTEMENTE a empresa "${c.name}"? Esta ação é irreversível!`)) deleteCompanyMutation.mutate({ id: c.id }); }} title="Eliminar">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                    </div>
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
  const { t } = useLanguage();
  const submissionsQuery = trpc.submissions.listAll.useQuery({});
  const companiesQuery = trpc.companies.list.useQuery();
  const companyMap = new Map(companiesQuery.data?.map((c) => [c.id, c]) || []);
  const [, setLocation] = useLocation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("Todas as Submissões")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>{t("Período")}</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>{t("Ações")}</TableHead>
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
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("Nenhuma submissão registada")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const { user } = useAuth();
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

  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  // Filtered and paginated users
  const filteredUsers = useMemo(() => {
    const data = usersQuery.data || [];
    return data.filter((u: any) => {
      const matchSearch = !searchTerm || u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = filterRole === "all" || u.role === filterRole;
      const matchProject = filterProject === "all" || (userProjectsMap.get(u.id) || []).includes(Number(filterProject));
      const matchCompany = filterCompany === "all" || String(u.companyId) === filterCompany;
      return matchSearch && matchRole && matchProject && matchCompany;
    });
  }, [usersQuery.data, searchTerm, filterRole, filterProject, filterCompany]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage, PAGE_SIZE]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterRole, filterProject, filterCompany]);

  const deleteUserMutation = trpc.auth.deleteUser.useMutation({
    onSuccess: () => { toast.success(t("Utilizador eliminado")); setDeleteUserId(null); setDeleteConfirmName(""); usersQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const assignCompanyMutation = trpc.users.assignCompany.useMutation({
    onSuccess: () => {
      toast.success(t("Empresa atribuída"));
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
      toast.success(t("Convite enviado com sucesso"));
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
      toast.success(t("Convite removido"));
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
      {/* Search and Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder={t("Pesquisar") + " (nome, email)"}
            value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full"
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="all">{t("Todos")} Roles</option>
          <option value="admin">Admin</option>
          <option value="dono_obra">Dono de Obra</option>
          <option value="pm">PM</option>
          <option value="ee">EE</option>
          <option value="rap">RAP</option>
          <option value="raa">RAA</option>
          <option value="observador">Observador</option>
        </select>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="all">{t("Todos")} {t("Projetos")}</option>
          {projectsQuery.data?.map((p: any) => (
            <option key={p.id} value={String(p.id)}>{p.code}</option>
          ))}
        </select>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
        >
          <option value="all">{t("Todas")} {t("Empresas")}</option>
          {companiesQuery.data?.map((c: any) => (
            <option key={c.id} value={String(c.id)}>{c.shortName} ({c.companyType.toUpperCase()})</option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {usersQuery.data?.filter((u: any) => {
            const matchSearch = !searchTerm || u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchRole = filterRole === "all" || u.role === filterRole;
            const matchProject = filterProject === "all" || (userProjectsMap.get(u.id) || []).includes(Number(filterProject));
            const matchCompany = filterCompany === "all" || String(u.companyId) === filterCompany;
            return matchSearch && matchRole && matchProject && matchCompany;
          })?.length || 0} {t("Utilizadores")}
        </span>
      </div>
      {/* Invite User Button + Dialog */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("Utilizadores")}</CardTitle>
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Convidar Utilizador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("Convidar Novo Utilizador")}</DialogTitle>
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
                      <SelectItem value="pm">PM — Project Manager</SelectItem>
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
              {paginatedUsers.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name || "-"}
                    {u.role === "admin" && <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">ADMIN</Badge>}
                  </TableCell>
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
                      <SelectItem value="pm">PM — Project Manager</SelectItem>
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
                          {projectsQuery.data?.filter(p => p.code !== "main" && p.code !== "SIN01-NEST").map(p => (
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
                                className="rounded border-border"
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
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 dark:bg-green-900/20 text-green-700">Todas</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{t("Construção")}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.role !== "admin" && user?.role === "admin" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteUserId(u.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 mb-4 px-2">
          <span className="text-sm text-muted-foreground">
            {filteredUsers.length} {t("Utilizadores")} · {t("Página")} {currentPage} {t("de")} {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              {t("Anterior")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
              {t("Próximo")}
            </Button>
          </div>
        </div>
      )}

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
      {deleteUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setDeleteUserId(null); setDeleteConfirmName(""); }}>
          <div className="bg-background rounded-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2 text-destructive">{t("Eliminar Utilizador")}</h3>
            <p className="text-sm text-muted-foreground mb-4">Tem a certeza?</p>
            <p className="text-sm mb-2">Escreva o nome para confirmar:</p>
            <Input value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)} placeholder="Nome completo" className="mb-4" />
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" onClick={() => deleteUserMutation.mutate({ userId: deleteUserId!, confirmName: deleteConfirmName })} disabled={!deleteConfirmName || deleteUserMutation.isPending}>{t("Confirmar")}</Button>
              <Button variant="outline" className="flex-1" onClick={() => { setDeleteUserId(null); setDeleteConfirmName(""); }}>{t("Cancelar")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoricalTab() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const companiesQuery = trpc.companies.list.useQuery();
  const historicalQuery = trpc.historical.list.useQuery({});
  const uploadMutation = trpc.historical.upload.useMutation({
    onSuccess: () => {
      toast.success(t("PDF histórico carregado com sucesso"));
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
          <CardTitle className="text-base">{t("Carregar Ficha Histórica (PDF)")}</CardTitle>
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
          <CardTitle className="text-base">{t("Fichas Históricas")}</CardTitle>
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
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("Nenhuma ficha histórica carregada")}</TableCell>
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
  const { t } = useLanguage();
  const { data: feedbacks, refetch } = trpc.feedback.list.useQuery();
  const updateMutation = trpc.feedback.updateStatus.useMutation({ onSuccess: () => refetch() });
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t("Feedback e Melhorias dos Utilizadores")}</h3>
      {!feedbacks || feedbacks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t("Sem feedback recebido")}</p>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((fb: any) => (
            <div key={fb.id} className={`border rounded-lg p-4 ${fb.status === "implementado" ? "border-green-200 bg-green-50/30" : fb.status === "rejeitado" ? "border-red-200 bg-red-50/30" : "border-border"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{fb.userName || fb.userEmail || "Anónimo"}</p>
                  <p className="text-xs text-muted-foreground">{fb.createdAt ? new Date(fb.createdAt).toLocaleDateString("pt-PT") : ""}</p>
                </div>
                <select className="text-xs border rounded px-2 py-1" value={fb.status || "pendente"} onChange={e => updateMutation.mutate({ id: fb.id, status: e.target.value })}>
                  <option value="pendente">Pendente</option>
                  <option value="em_analise">{t("Em Análise")}</option>
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
  const { t } = useLanguage();
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
            <button className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700" onClick={() => approveMutation.mutate({ userId: p.id, approve: true })}>{t("Aprovar")}</button>
            <button className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700" onClick={() => approveMutation.mutate({ userId: p.id, approve: false })}>{t("Rejeitar")}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmailConfigTab() {
  const { t } = useLanguage();
  const settingsQuery = trpc.appSettings.getAll.useQuery();
  const updateMutation = trpc.appSettings.update.useMutation({
    onSuccess: () => settingsQuery.refetch(),
    onError: (e: any) => toast.error(e.message),
  });
  const settings = settingsQuery.data || {};
  const [smtpHost, setSmtpHost] = useState(settings.email_smtp_host || "");
  const [smtpPort, setSmtpPort] = useState(settings.email_smtp_port || "587");
  const [smtpUser, setSmtpUser] = useState(settings.email_smtp_user || "");
  const [smtpPass, setSmtpPass] = useState(settings.email_smtp_pass || "");
  const [fromEmail, setFromEmail] = useState(settings.email_from || "apoioamb@startcampus.pt");
  const [fromName, setFromName] = useState(settings.email_from_name || "Plataforma de Gestão Ambiental - Start Campus");
  const [enabled, setEnabled] = useState(settings.email_enabled === "true");

  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data;
      setSmtpHost(s.email_smtp_host || "");
      setSmtpPort(s.email_smtp_port || "587");
      setSmtpUser(s.email_smtp_user || "");
      setSmtpPass(s.email_smtp_pass || "");
      setFromEmail(s.email_from || "apoioamb@startcampus.pt");
      setFromName(s.email_from_name || "Plataforma de Gestão Ambiental - Start Campus");
      setEnabled(s.email_enabled === "true");
    }
  }, [settingsQuery.data]);

  const handleSave = async () => {
    const pairs: [string, string][] = [
      ["email_smtp_host", smtpHost], ["email_smtp_port", smtpPort],
      ["email_smtp_user", smtpUser], ["email_smtp_pass", smtpPass],
      ["email_from", fromEmail], ["email_from_name", fromName],
      ["email_enabled", enabled ? "true" : "false"],
    ];
    for (const [key, value] of pairs) {
      await updateMutation.mutateAsync({ key, value });
    }
    toast.success(t("Configuração de email guardada com sucesso"));
  };

  return (
    <div className="space-y-4">
      {/* Enable/Disable toggle card */}
      <Card className={`border-2 transition-colors ${enabled ? 'border-green-500 dark:border-green-600' : 'border-muted'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                <span className="text-lg">{enabled ? '✅' : '📧'}</span>
              </div>
              <div>
                <p className="font-semibold text-sm">{t("Notificações por Email")}</p>
                <p className="text-xs text-muted-foreground">{enabled ? t("Ativo — o sistema envia emails automáticos") : t("Inativo — nenhum email será enviado")}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* SMTP Server Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">🔧 {t("Servidor SMTP")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("Configuração técnica — a equipa de IT fornece estes dados")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">{t("Servidor")}</Label><Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.office365.com" className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("Porta")}</Label><Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("Utilizador")}</Label><Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="apoioamb@startcampus.pt" className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("Palavra-passe")}</Label><Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" className="h-9" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Sender Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">📨 {t("Remetente")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">{t("Email de envio")}</Label><Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="apoioamb@startcampus.pt" className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("Nome do remetente")}</Label><Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder={t("Plataforma de Gestão Ambiental")} className="h-9" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Notification types info */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="font-medium text-sm mb-3">{t("Emails automáticos enviados pelo sistema")}:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-start gap-2 text-xs p-2 rounded bg-background border">
              <span className="text-green-600 mt-0.5">📤</span>
              <div><span className="font-medium">{t("Ficha submetida")}</span><br/><span className="text-muted-foreground">{t("Notifica RAA, Admin e Dono de Obra")}</span></div>
            </div>
            <div className="flex items-start gap-2 text-xs p-2 rounded bg-background border">
              <span className="text-blue-600 mt-0.5">✅</span>
              <div><span className="font-medium">{t("Ficha aprovada/rejeitada")}</span><br/><span className="text-muted-foreground">{t("Notifica o submitter")}</span></div>
            </div>
            <div className="flex items-start gap-2 text-xs p-2 rounded bg-background border">
              <span className="text-purple-600 mt-0.5">👤</span>
              <div><span className="font-medium">{t("Convite de utilizador")}</span><br/><span className="text-muted-foreground">{t("Email com link de acesso e credenciais")}</span></div>
            </div>
            <div className="flex items-start gap-2 text-xs p-2 rounded bg-background border">
              <span className="text-red-600 mt-0.5">🔒</span>
              <div><span className="font-medium">{t("Acesso não autorizado")}</span><br/><span className="text-muted-foreground">{t("Notifica o administrador")}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={handleSave} disabled={updateMutation.isPending} size="lg" className="w-full gap-2">
        {updateMutation.isPending ? t("A guardar...") : t("Guardar Configuração")}
      </Button>
    </div>
  );
}
