import AppLayout from "@/components/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, BookOpen, Pencil, Save, Info, ArrowDown, ArrowRight, CheckCircle2, XCircle, RotateCcw, FileText, Send, Eye, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Workflow() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
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
    onError: (err: any) => {
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
    // FLOW-09 FIX: Append-only notes — prepend new note with timestamp and author
    const timestamp = new Date().toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const author = user?.name || "—";
    const newEntry = `[${timestamp}] ${author}:\n${editText.trim()}`;
    const existing = workflowQuery.data?.workflowDescription || "";
    const combined = existing ? `${newEntry}\n\n---\n\n${existing}` : newEntry;
    updateMutation.mutate({ projectId: activeProject.id, workflowDescription: combined });
    setEditText("");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            {t("Workflow do Projeto")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Processo de submissão e revisão de fichas de controlo ambiental.")}
          </p>
        </div>

        {/* Visual Workflow Diagram - always visible */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("Fluxo de Submissão de Fichas")}</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkflowDiagram />
          </CardContent>
        </Card>

        {/* Project-specific workflow description */}
        {isAllProjects && (
          <Card>
            <CardContent className="p-6 text-center">
              <Info className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {t("Selecione um projeto específico no menu lateral para ver notas adicionais do workflow.")}
              </p>
            </CardContent>
          </Card>
        )}

        {!isAllProjects && activeProject && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {t("Notas do Projeto")} — {activeProject.code}
                </CardTitle>
                {canEdit && !editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="w-4 h-4 mr-1.5" />
                    {t("Editar")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {workflowQuery.isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">{t("A carregar...")}</span>
                </div>
              )}

              {!workflowQuery.isLoading && !editing && (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {workflowQuery.data?.workflowDescription ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {workflowQuery.data.workflowDescription}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground text-sm">
                        {t("Nenhuma nota adicional definida para este projeto.")}
                      </p>
                      {canEdit && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing(true)}>
                          <Pencil className="w-4 h-4 mr-1.5" />
                          {t("Adicionar Nota")}
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
                    placeholder={t("Escreva uma nova nota... (será adicionada ao histórico)")}
                    className="min-h-[150px] text-sm"
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

        {/* Roles explanation */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("Papéis no Processo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2 p-2 rounded-md bg-background border">
                <div className="w-6 h-6 rounded-full bg-[#0A3638] flex items-center justify-center shrink-0">
                  <span className="text-[#0A3638] font-bold text-[10px]">EE</span>
                </div>
                <div>
                  <p className="font-medium">{t("Entidade Executante")}</p>
                  <p className="text-muted-foreground">{t("Preenche e submete a ficha semanal com evidências fotográficas e documentais.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-md bg-background border">
                <div className="w-6 h-6 rounded-full bg-[#F4F4FF] flex items-center justify-center shrink-0">
                  <span className="text-[#0A3638] font-bold text-[10px]">{t("RAP")}</span>
                </div>
                <div>
                  <p className="font-medium">{t("Resp. Acompanhamento do Projeto")}</p>
                  <p className="text-muted-foreground">{t("Preenche e submete a ficha semanal com evidências fotográficas e documentais.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-md bg-background border">
                <div className="w-6 h-6 rounded-full bg-[#EDEBEB] flex items-center justify-center shrink-0">
                  <span className="text-[#646461] font-bold text-[10px]">{t("RAA")}</span>
                </div>
                <div>
                  <p className="font-medium">{t("Resp. Acompanhamento Ambiental")}</p>
                  <p className="text-muted-foreground">{t("Revê, comenta, aprova ou rejeita as fichas submetidas. Garante conformidade.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-md bg-background border">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-[10px]">DO</span>
                </div>
                <div>
                  <p className="font-medium">{t("Dono de Obra")}</p>
                  <p className="text-muted-foreground">{t("Supervisiona o processo global, gere fases e define o workflow do projeto.")}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function WorkflowDiagram() {
  const { t } = useLanguage();
  return (
    <div className="py-4">
      {/* Main flow - vertical on mobile, horizontal on desktop */}
      <div className="flex flex-col items-center gap-0">
        {/* Step 1: EE/RAP creates draft */}
        <FlowStep
          icon={<FileText className="w-5 h-5" />}
          title={t("1. Criação da Ficha")}
          description="EE ou RAP preenche a ficha semanal com texto, imagens e ficheiros por medida"
          color="blue"
          actor="EE / RAP"
        />
        <FlowArrow />

        {/* Step 2: Submit */}
        <FlowStep
          icon={<Send className="w-5 h-5" />}
          title={t("2. Submissão")}
          description="A ficha é submetida para revisão. Fica com estado 'Em Revisão'"
          color="indigo"
          actor="EE / RAP"
        />
        <FlowArrow />

        {/* Step 3: RAA reviews */}
        <FlowStep
          icon={<Eye className="w-5 h-5" />}
          title={t("3. Revisão pela RAA")}
          description="RAA analisa a ficha, verifica evidências e conformidade com as medidas"
          color="amber"
          actor="RAA"
        />
        <FlowArrow />

        {/* Decision point */}
        <div className="relative w-full max-w-lg">
          <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-4 bg-muted/20">
            <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t("Decisão da RAA")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Approved path */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-full p-3 rounded-lg bg-primary dark:bg-primary/20 border border-primary text-center">
                  <CheckCircle2 className="w-6 h-6 text-primary dark:text-primary mx-auto mb-1" />
                  <p className="text-sm font-semibold text-primary dark:text-primary">{t("Aprovada")}</p>
                  <p className="text-xs text-primary dark:text-primary mt-1">{t("Ficha validada e arquivada no histórico")}</p>
                </div>
                <ArrowDown className="w-4 h-4 text-primary dark:text-primary" />
                <div className="text-center px-2 py-1.5 rounded bg-primary/50 dark:bg-primary/30 border border-primary dark:border-primary">
                  <p className="text-xs text-primary dark:text-primary font-medium">{t("Disponível no Histórico")}</p>
                  <p className="text-[10px] text-primary dark:text-primary">{t("Exportável em PDF")}</p>
                </div>
              </div>

              {/* Rejected path */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-full p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 text-center">
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">{t("Rejeitada")}</p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">{t("RAA adiciona comentários com motivo da rejeição")}</p>
                </div>
                <ArrowDown className="w-4 h-4 text-red-500 dark:text-red-400" />
                <div className="text-center px-2 py-1.5 rounded bg-red-100/50 dark:bg-red-900/30 border border-red-200 dark:border-red-700">
                  <p className="text-xs text-red-800 dark:text-red-200 font-medium">{t("Volta para Rascunhos")}</p>
                  <p className="text-[10px] text-red-700 dark:text-red-300">{t("EE/RAP corrige e resubmete")}</p>
                </div>
                <ArrowDown className="w-4 h-4 text-muted-foreground" />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RotateCcw className="w-3 h-3" />
                  <span>{t("Volta ao passo 1")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 justify-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0A3638]" />{t("Ação EE/RAP")}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0A3638]" /> {t("Ação EE/RAP")}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EDEBEB]" /> {t("Ação RAA")}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> {t("Aprovado")}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {t("Rejeitado")}</span>
      </div>
    </div>
  );
}

function FlowStep({ icon, title, description, color, actor }: { icon: React.ReactNode; title: string; description: string; color: string; actor: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-[#0A3638] dark:bg-[#0A3638]/30 border-[#0A3638] dark:border-[#0A3638] text-[#0A3638] dark:text-[#0A3638]",
    indigo: "bg-[#F4F4FF] dark:bg-[#F4F4FF]/30 border-[#0A3638] dark:border-[#0A3638] text-[#0A3638] dark:text-[#0A3638]",
    amber: "bg-[#EDEBEB] dark:bg-[#EDEBEB]/30 border-[#6D7A70] dark:border-[#6D7A70] text-[#646461] dark:text-[#646461]",
    green: "bg-primary dark:bg-primary/30 border-primary dark:border-primary text-primary dark:text-primary",
  };
  const badgeClasses: Record<string, string> = {
    blue: "bg-[#0A3638] dark:bg-[#0A3638]/40 text-[#0A3638] dark:text-[#0A3638]",
    indigo: "bg-[#F4F4FF] dark:bg-[#F4F4FF]/40 text-[#0A3638] dark:text-[#0A3638]",
    amber: "bg-[#EDEBEB] dark:bg-[#EDEBEB]/40 text-[#646461] dark:text-[#646461]",
    green: "bg-primary dark:bg-primary/40 text-primary dark:text-primary",
  };

  return (
    <div className={`w-full max-w-lg p-4 rounded-lg border ${colorClasses[color]} flex items-start gap-3`}>
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeClasses[color]}`}>{actor}</span>
        </div>
        <p className="text-xs mt-0.5 opacity-80">{description}</p>
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="py-1">
      <ArrowDown className="w-4 h-4 text-muted-foreground/50" />
    </div>
  );
}
