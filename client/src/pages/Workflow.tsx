import AppLayout from "@/components/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, BookOpen, Pencil, Save, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Workflow() {
  const { user } = useAuth();
  const { activeProject, isAllProjects, projects } = useProject();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const utils = trpc.useUtils();

  const canEdit = user?.role === "admin" || user?.role === "dono_obra";

  const workflowQuery = trpc.workflow.get.useQuery(
    { projectId: activeProject?.id! },
    { enabled: !!activeProject && !isAllProjects }
  );

  const updateMutation = trpc.workflow.update.useMutation({
    onSuccess: () => {
      toast.success("Workflow atualizado com sucesso");
      setEditing(false);
      utils.workflow.get.invalidate({ projectId: activeProject?.id! });
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao atualizar workflow");
    },
  });

  useEffect(() => {
    if (workflowQuery.data) {
      setEditText(workflowQuery.data.workflowDescription);
    }
  }, [workflowQuery.data]);

  const handleSave = () => {
    if (!activeProject) return;
    updateMutation.mutate({ projectId: activeProject.id, workflowDescription: editText });
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Workflow do Projeto
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Descrição do processo e fluxo de trabalho para todas as partes envolvidas.
          </p>
        </div>

        {isAllProjects && (
          <Card>
            <CardContent className="p-6 text-center">
              <Info className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                Selecione um projeto específico no menu lateral para ver o workflow.
              </p>
            </CardContent>
          </Card>
        )}

        {!isAllProjects && activeProject && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {activeProject.code} — {activeProject.name}
                </CardTitle>
                {canEdit && !editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="w-4 h-4 mr-1.5" />
                    Editar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {workflowQuery.isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">A carregar...</span>
                </div>
              )}

              {!workflowQuery.isLoading && !editing && (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {workflowQuery.data?.workflowDescription ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {workflowQuery.data.workflowDescription}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">
                        Nenhum workflow definido para este projeto.
                      </p>
                      {canEdit && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing(true)}>
                          <Pencil className="w-4 h-4 mr-1.5" />
                          Definir Workflow
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {editing && (
                <div className="space-y-4">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Descreva o workflow do projeto...&#10;&#10;Exemplo:&#10;1. EE/RAP preenche a ficha semanal com evidências&#10;2. RAA revê e aprova ou rejeita com comentários&#10;3. Se rejeitada, EE/RAP corrige e resubmete&#10;4. Após aprovação, ficha fica disponível no histórico"
                    className="min-h-[200px] text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={updateMutation.isPending} size="sm">
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      ) : (
                        <Save className="w-4 h-4 mr-1.5" />
                      )}
                      Guardar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditText(workflowQuery.data?.workflowDescription || ""); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info card about the workflow */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Quem pode editar:</strong> Administrador e Dono de Obra</p>
                <p><strong>Quem pode ver:</strong> Todos os utilizadores com acesso ao projeto</p>
                <p>O workflow serve para que todas as partes (EE, RAP, RAA, DO) estejam cientes do processo de controlo ambiental.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
