import React from "react";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StandMetricCard } from "@/components/stand/StandMetricCard";
import { StandPageHeader } from "@/components/stand/StandPageHeader";
import { StandStatusBadge } from "@/components/stand/StandStatusBadge";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDocumentLibraryView } from "@/lib/document-library-view";
import { trpc } from "@/lib/trpc";
import { Award, BookOpen, ClipboardCheck, ExternalLink, FileText, Leaf, ShieldAlert, ShieldCheck } from "lucide-react";

const TOPICS = {
  obrigacoes_ambientais: { label: "Obrigações Ambientais", description: "Requisitos, obrigações legais e documentação de referência.", icon: ShieldCheck },
  certificacoes: { label: "Certificações", description: "Documentação de certificações ambientais e requisitos associados.", icon: Award },
  recomendacoes: { label: "Recomendações", description: "Guias, boas práticas e recomendações aplicáveis aos projectos.", icon: Leaf },
} as const;

export type LibraryItem = {
  id: number;
  topic: keyof typeof TOPICS;
  subtopic: string | null;
  title: string;
  language: string;
  description: string | null;
  filename: string;
  fileSize: number;
  status: "draft" | "published" | "archived";
  isProjectCentral: number;
  isMandatoryRead: number;
  createdByName: string;
  createdAt: Date | string;
};

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentCard({ document, projectId }: { document: LibraryItem; projectId: number }) {
  const topic = TOPICS[document.topic];
  const Icon = topic.icon;
  return (
    <Card className="group flex h-full flex-col border-border bg-card shadow-[0_1px_2px_hsl(var(--shadow-color)/0.04),0_10px_24px_hsl(var(--shadow-color)/0.035)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_30px_hsl(var(--shadow-color)/0.09)]">
      <CardHeader className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-xl border border-primary/10 bg-primary/10 p-2.5 text-primary"><Icon className="h-4 w-4" /></div>
            <div className="min-w-0"><CardTitle className="text-base leading-snug text-card-foreground">{document.title}</CardTitle><p className="mt-1 text-xs font-medium text-muted-foreground">{topic.label}</p></div>
          </div>
          <Badge variant="outline" className="shrink-0 border-primary/20 bg-primary/5 text-xs font-semibold text-primary">{document.language}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-4 p-5 pt-0">
        <div className="flex min-h-6 flex-wrap items-center gap-2">
          {document.subtopic && <Badge variant="secondary" className="text-xs font-medium">{document.subtopic}</Badge>}
          {document.isMandatoryRead === 1 && <StandStatusBadge label="Leitura obrigatória" tone="warning" icon={ShieldAlert} />}
        </div>
        <p className="min-h-10 text-sm leading-6 text-muted-foreground">{document.description || "Documento de consulta disponível na biblioteca ambiental."}</p>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5 truncate" title={`${document.filename} · ${formatFileSize(document.fileSize)}`}><FileText className="h-3.5 w-3.5 shrink-0" />{document.filename} · {formatFileSize(document.fileSize)}</span>
          <a aria-label={`Consultar ${document.title} num novo separador`} className="inline-flex shrink-0 items-center gap-1 rounded-md font-semibold text-primary outline-none transition-colors hover:text-primary/75 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href={`/api/documentos/${document.id}/pdf?projectId=${projectId}`} target="_blank" rel="noopener noreferrer">Consultar <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      </CardContent>
    </Card>
  );
}

function TopicPanel({ documents, topic, projectId, onlyLeed = false }: { documents: LibraryItem[]; topic: keyof typeof TOPICS; projectId: number; onlyLeed?: boolean }) {
  const topicInfo = TOPICS[topic];
  const Icon = topicInfo.icon;
  const filtered = documents.filter(item => item.isProjectCentral !== 1 && item.topic === topic && (!onlyLeed || item.subtopic?.toLowerCase() === "leed"));
  if (filtered.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="h-5 w-5" /></div><p className="font-semibold text-foreground">Sem documentos publicados</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Os documentos publicados pela Start Campus serão apresentados aqui.</p></div>;
  }
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(document => <DocumentCard key={document.id} document={document} projectId={projectId} />)}</div>;
}

function CentralDocumentCard({ document, projectId }: { document: LibraryItem; projectId: number }) {
  return (
    <Card className="h-full border-amber-500/25 bg-gradient-to-br from-amber-500/[0.10] via-card to-card shadow-[0_1px_2px_hsl(var(--shadow-color)/0.04),0_10px_24px_hsl(var(--shadow-color)/0.035)] dark:from-amber-500/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-800 dark:text-amber-200"><FileText className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="font-semibold leading-snug text-card-foreground">{document.title}</p><p className="mt-1 text-xs text-muted-foreground">{document.filename} · {document.language}</p></div>
          </div>
          {document.isMandatoryRead === 1 && <StandStatusBadge label="Obrigatório" tone="warning" icon={ClipboardCheck} />}
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{document.description || "Documento-base a consultar antes de iniciar actividade no projeto."}</p>
        <a aria-label={`Ler ${document.title} num novo separador`} className="mt-4 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/75 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href={`/api/documentos/${document.id}/pdf?projectId=${projectId}`} target="_blank" rel="noopener noreferrer">Ler documento <ExternalLink className="h-4 w-4" /></a>
      </CardContent>
    </Card>
  );
}

export function DocumentLibraryReadOnlyContent({ role, documents, projectId, projectContext }: { role: Parameters<typeof getDocumentLibraryView>[0]; documents: LibraryItem[]; projectId: number; projectContext?: string }) {
  const { centralDocuments, showManagementControls } = getDocumentLibraryView(role, documents);
  const mandatoryDocuments = documents.filter(document => document.isMandatoryRead === 1).length;
  return (
    <div className="space-y-6 pb-8">
      <StandPageHeader eyebrow="STAND · REPOSITÓRIO CENTRAL" title="Documentação Ambiental" description="Consulte a documentação publicada pela Start Campus para apoiar o cumprimento ambiental, as certificações e as decisões no projecto." context={projectContext || "Projeto ativo"} tone="governance">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><BookOpen className="h-3.5 w-3.5 text-primary" />Fonte documental controlada para consulta operacional.</div>
      </StandPageHeader>

      <section aria-label="Resumo da biblioteca" className="grid gap-3 sm:grid-cols-3">
        <StandMetricCard label="Documentos visíveis" value={documents.length} detail="Referências disponíveis neste projeto" icon={BookOpen} tone="brand" />
        <StandMetricCard label="Central do projeto" value={centralDocuments.length} detail="Documentos-base para iniciar atividade" icon={FileText} tone="warning" />
        <StandMetricCard label="Leitura obrigatória" value={mandatoryDocuments} detail="Itens que requerem consulta prioritária" icon={ShieldAlert} tone={mandatoryDocuments > 0 ? "warning" : "neutral"} />
      </section>

      <section aria-labelledby="central-documents-title" className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.045] p-5 shadow-[0_1px_2px_hsl(var(--shadow-color)/0.025)] sm:p-6 dark:bg-amber-500/[0.06]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-800 dark:text-amber-200"><ShieldCheck className="h-6 w-6" /></div><div><p className="stand-kicker text-amber-800 dark:text-amber-200">Consulta prioritária</p><h2 id="central-documents-title" className="mt-1 text-xl font-bold tracking-tight text-foreground">Central de Documentos do Projeto</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">DCAPE, PGA e outros documentos-base que definem as regras ambientais do projeto. Consulte-os antes de iniciar actividade em obra.</p></div></div>
          {centralDocuments.some(document => document.isMandatoryRead === 1) && <StandStatusBadge label="Inclui leitura obrigatória" tone="warning" icon={ClipboardCheck} />}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{centralDocuments.length > 0 ? centralDocuments.map(document => <CentralDocumentCard key={document.id} document={document} projectId={projectId} />) : <div className="rounded-xl border border-dashed border-amber-500/35 bg-card/70 px-5 py-7 text-sm leading-6 text-muted-foreground md:col-span-2 xl:col-span-3">A Administração ainda não publicou documentos-base nesta central. Quando DCAPE, PGA ou outros documentos de referência forem carregados, ficarão destacados aqui.</div>}</div>
      </section>

      <Tabs defaultValue="obrigacoes_ambientais" className="space-y-5">
        <div className="border-b border-border pb-3">
          <p className="stand-kicker mb-3 text-muted-foreground">Arquivo de referência</p>
          <TabsList aria-label="Categorias de documentação" className="h-auto flex-wrap justify-start gap-1 rounded-xl border border-border bg-muted/50 p-1.5">
            <TabsTrigger value="obrigacoes_ambientais" className="min-h-9 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Obrigações Ambientais</TabsTrigger>
            <TabsTrigger value="certificacoes" className="min-h-9 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Certificações</TabsTrigger>
            <TabsTrigger value="recomendacoes" className="min-h-9 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Recomendações</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="obrigacoes_ambientais" className="mt-0 outline-none"><TopicPanel documents={documents} topic="obrigacoes_ambientais" projectId={projectId} /></TabsContent>
        <TabsContent value="certificacoes" className="mt-0 space-y-4 outline-none"><Tabs defaultValue="todas" className="space-y-4"><TabsList aria-label="Filtro de certificações" className="h-auto rounded-lg border border-border bg-muted/40 p-1"><TabsTrigger value="todas" className="min-h-8 rounded-md px-3 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">Todas</TabsTrigger><TabsTrigger value="leed" className="min-h-8 rounded-md px-3 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">LEED</TabsTrigger></TabsList><TabsContent value="todas" className="mt-0 outline-none"><TopicPanel documents={documents} topic="certificacoes" projectId={projectId} /></TabsContent><TabsContent value="leed" className="mt-0 outline-none"><TopicPanel documents={documents} topic="certificacoes" projectId={projectId} onlyLeed /></TabsContent></Tabs></TabsContent>
        <TabsContent value="recomendacoes" className="mt-0 outline-none"><TopicPanel documents={documents} topic="recomendacoes" projectId={projectId} /></TabsContent>
      </Tabs>
      {showManagementControls && <p className="sr-only">Gestão disponível na Administração.</p>}
    </div>
  );
}

export default function DocumentLibrary() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { activeProject, isAllProjects } = useProject();
  const projectId = activeProject?.id;
  const { data, isLoading, error } = trpc.documentLibrary.list.useQuery(
    projectId ? { projectId } : undefined,
    { enabled: Boolean(projectId) && !isAllProjects },
  );
  const documents = (data || []) as LibraryItem[];

  return (
    <AppLayout>
      <div className="pb-8">
        {isAllProjects || !projectId ? <Card className="border-border bg-card shadow-[0_1px_2px_hsl(var(--shadow-color)/0.04)]"><CardContent className="p-8 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="h-6 w-6" /></div><p className="font-semibold text-foreground">{t("Seleccione um projeto para consultar a documentação")}</p><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{t("A Documentação é apresentada apenas no projeto individual a que cada documento foi aplicado.")}</p></CardContent></Card> : isLoading ? <Card className="border-border bg-card"><CardContent className="p-8 text-center text-sm text-muted-foreground">{t("A carregar documentação...")}</CardContent></Card> : error ? <Card className="border-destructive/25 bg-destructive/[0.035]"><CardContent className="p-8 text-center text-sm font-medium text-destructive">{t("Não tem autorização para consultar a documentação deste projeto.")}</CardContent></Card> : <DocumentLibraryReadOnlyContent role={user?.role} documents={documents} projectId={projectId} projectContext={activeProject?.code} />}
      </div>
    </AppLayout>
  );
}
