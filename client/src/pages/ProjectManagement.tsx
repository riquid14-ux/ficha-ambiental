import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Building2, FolderKanban, Plus, Users } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function ProjectManagement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user && user.role !== "admin" && user.role !== "dono_obra") {
    setLocation("/dashboard");
    return null;
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão de Projetos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gerir projetos, atribuir empresas e utilizadores
            </p>
          </div>
          <CreateProjectDialog />
        </div>
        <ProjectList />
      </div>
    </AppLayout>
  );
}

function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const utils = trpc.useUtils();
  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setOpen(false);
      setCode("");
      setName("");
      setDescription("");
      toast.success("Projeto criado com sucesso");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Projeto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Código</Label>
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="SIN02" />
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do projeto" />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição breve" />
          </div>
          <Button
            className="w-full"
            disabled={!code || !name || createProject.isPending}
            onClick={() => createProject.mutate({ code, name, description: description || undefined })}
          >
            {createProject.isPending ? "A criar..." : "Criar Projeto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectList() {
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>Nenhum projeto criado ainda.</p>
          <p className="text-sm mt-1">Crie o primeiro projeto para começar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {projects.map(project => (
        <Card key={project.id} className={`cursor-pointer transition-all ${selectedProject === project.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}>
          <CardHeader className="pb-2" onClick={() => setSelectedProject(selectedProject === project.id ? null : project.id)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" />
                <span className="font-bold">{project.code}</span>
                <span className="font-normal text-muted-foreground">— {project.name}</span>
              </CardTitle>
              {project.description && (
                <span className="text-xs text-muted-foreground">{project.description}</span>
              )}
            </div>
          </CardHeader>
          {selectedProject === project.id && (
            <CardContent>
              <Tabs defaultValue="companies" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="companies" className="gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    Empresas
                  </TabsTrigger>
                  <TabsTrigger value="users" className="gap-2">
                    <Users className="h-3.5 w-3.5" />
                    Utilizadores
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="companies" className="mt-4">
                  <ProjectCompaniesTab projectId={project.id} />
                </TabsContent>
                <TabsContent value="users" className="mt-4">
                  <ProjectUsersTab projectId={project.id} />
                </TabsContent>
              </Tabs>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

function ProjectCompaniesTab({ projectId }: { projectId: number }) {
  const { data: projectCompanies = [] } = trpc.projects.getCompanies.useQuery({ projectId });
  const { data: allCompanies = [] } = trpc.companies.list.useQuery();
  const utils = trpc.useUtils();

  const addCompany = trpc.projects.addCompany.useMutation({
    onSuccess: () => utils.projects.getCompanies.invalidate({ projectId }),
  });
  const removeCompany = trpc.projects.removeCompany.useMutation({
    onSuccess: () => utils.projects.getCompanies.invalidate({ projectId }),
  });

  const assignedIds = new Set(projectCompanies.map(c => c.id));

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        Selecione as empresas que trabalham neste projeto:
      </p>
      {allCompanies.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma empresa registada.</p>
      ) : (
        <div className="space-y-2">
          {allCompanies.map(company => (
            <label key={company.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer">
              <Checkbox
                checked={assignedIds.has(company.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    addCompany.mutate({ projectId, companyId: company.id });
                  } else {
                    removeCompany.mutate({ projectId, companyId: company.id });
                  }
                }}
              />
              <div>
                <span className="font-medium text-sm">{company.shortName}</span>
                <span className="font-medium text-sm">{company.shortName}</span>
                <span className="text-xs text-muted-foreground ml-2">({company.companyType})</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectUsersTab({ projectId }: { projectId: number }) {
  const { data: projectUserAssocs = [] } = trpc.projects.getUsers.useQuery({ projectId });
  const { data: allUsers = [] } = trpc.users.list.useQuery();
  const utils = trpc.useUtils();

  const addUser = trpc.projects.addUser.useMutation({
    onSuccess: () => utils.projects.getUsers.invalidate({ projectId }),
  });
  const removeUser = trpc.projects.removeUser.useMutation({
    onSuccess: () => utils.projects.getUsers.invalidate({ projectId }),
  });

  const assignedUserIds = new Set(projectUserAssocs.map(u => u.userId));
  // Filter out the hidden system admin
  const visibleUsers = allUsers.filter(u => u.email !== "riquid14@gmail.com");

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        Selecione os utilizadores com acesso a este projeto:
      </p>
      {visibleUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum utilizador registado.</p>
      ) : (
        <div className="space-y-2">
          {visibleUsers.map(user => (
            <label key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer">
              <Checkbox
                checked={assignedUserIds.has(user.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    addUser.mutate({ projectId, userId: user.id });
                  } else {
                    removeUser.mutate({ projectId, userId: user.id });
                  }
                }}
              />
              <div>
                <span className="font-medium text-sm">{user.name || user.email}</span>
                <span className="text-xs text-muted-foreground ml-2">{user.email}</span>
                <span className="text-xs text-muted-foreground ml-2">({user.role})</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
