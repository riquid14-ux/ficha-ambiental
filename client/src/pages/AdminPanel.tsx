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
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Users, Plus } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminPanel() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.role !== "admin") {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Acesso restrito a administradores.</p>
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
          <p className="text-muted-foreground text-sm mt-1">Gestão de empresas e utilizadores</p>
        </div>

        <Tabs defaultValue="companies">
          <TabsList>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" /> Empresas
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" /> Utilizadores
            </TabsTrigger>
            <TabsTrigger value="submissions" className="gap-2">
              <Building2 className="w-4 h-4" /> Submissões
            </TabsTrigger>
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
        </Tabs>
      </div>
    </AppLayout>
  );
}

function CompaniesTab() {
  const [newName, setNewName] = useState("");
  const [newShortName, setNewShortName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const companiesQuery = trpc.companies.list.useQuery();
  const createMutation = trpc.companies.create.useMutation({
    onSuccess: () => {
      toast.success("Empresa criada com sucesso");
      utils.companies.list.invalidate();
      setDialogOpen(false);
      setNewName("");
      setNewShortName("");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Empresas Executantes (EE)</CardTitle>
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
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({ name: newName, shortName: newShortName })}
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
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companiesQuery.data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell><Badge variant="outline">{c.shortName}</Badge></TableCell>
                <TableCell>
                  <Badge variant={c.active ? "default" : "secondary"}>
                    {c.active ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {companiesQuery.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
            {submissionsQuery.data?.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell className="font-medium">S{sub.weekNumber}/{sub.weekYear}</TableCell>
                <TableCell>{companyMap.get(sub.companyId)?.shortName || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{sub.weekStartDate} - {sub.weekEndDate}</TableCell>
                <TableCell>
                  <Badge variant={sub.status === "submitted" ? "default" : "secondary"}>
                    {sub.status === "submitted" ? "Submetida" : "Rascunho"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setLocation(`/ficha/${sub.id}`)}>
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Utilizadores</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Empresa</TableHead>
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
                    onValueChange={(v) => updateRoleMutation.mutate({ userId: u.id, role: v as "user" | "admin" })}
                  >
                    <SelectTrigger className="w-[100px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={u.companyId ? String(u.companyId) : "none"}
                    onValueChange={(v) => assignCompanyMutation.mutate({ userId: u.id, companyId: v === "none" ? null : Number(v) })}
                  >
                    <SelectTrigger className="w-[150px] h-8">
                      <SelectValue placeholder="Sem empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem empresa</SelectItem>
                      {companiesQuery.data?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
