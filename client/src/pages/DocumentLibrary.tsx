import React from "react";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
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
    <Card className="h-full border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon className="h-4 w-4" /></div>
            <div className="min-w-0"><CardTitle className="text-base leading-snug">{document.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{topic.label}</p></div>
          </div>
          <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800">{document.language}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {document.subtopic && <Badge variant="secondary">{document.subtopic}</Badge>}
          {document.isMandatoryRead === 1 && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100"><ShieldAlert className="mr-1 h-3 w-3" />Leitura obrigatória</Badge>}
        </div>
        <p className="min-h-10 text-sm leading-relaxed text-slate-600">{document.description || "Documento de consulta disponível na biblioteca ambiental."}</p>
        <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5 truncate"><FileText className="h-3.5 w-3.5 shrink-0" />{document.filename} · {formatFileSize(document.fileSize)}</span>
          <a className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-700 hover:text-emerald-900 hover:underline" href={`/api/documentos/${document.id}/pdf?projectId=${projectId}`} target="_blank" rel="noopener noreferrer">Consultar <ExternalLink className="h-3.5 w-3.5" /></a>
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
    return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><Icon className="mx-auto mb-3 h-8 w-8 text-slate-400" /><p className="font-medium text-slate-700">Sem documentos publicados</p><p className="mt-1 text-sm text-slate-500">Os documentos publicados pela Start Campus serão apresentados aqui.</p></div>;
  }
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(document => <DocumentCard key={document.id} document={document} projectId={projectId} />)}</div>;
}

function CentralDocumentCard({ document, projectId }: { document: LibraryItem; projectId: number }) {
  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-800"><FileText className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="font-semibold leading-snug text-slate-900">{document.title}</p><p className="mt-1 text-xs text-slate-500">{document.filename} · {document.language}</p></div>
          </div>
          {document.isMandatoryRead === 1 && <Badge className="shrink-0 bg-amber-700 hover:bg-amber-700"><ClipboardCheck className="mr-1 h-3 w-3" />Obrigatório</Badge>}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">{document.description || "Documento-base a consultar antes de iniciar actividade no projeto."}</p>
        <a className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-950 hover:underline" href={`/api/documentos/${document.id}/pdf?projectId=${projectId}`} target="_blank" rel="noopener noreferrer">Ler documento <ExternalLink className="h-4 w-4" /></a>
      </CardContent>
    </Card>
  );
}

export function DocumentLibraryReadOnlyContent({ role, documents, projectId }: { role: Parameters<typeof getDocumentLibraryView>[0]; documents: LibraryItem[]; projectId: number }) {
  const { centralDocuments, showManagementControls } = getDocumentLibraryView(role, documents);
  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-800 to-teal-700 p-7 text-white">
        <div className="flex max-w-3xl items-start gap-4">
          <div className="rounded-xl bg-white/15 p-3"><BookOpen className="h-7 w-7" /></div>
          <div><p className="text-sm font-medium uppercase tracking-wider text-emerald-100">Repositório central</p><h1 className="mt-1 text-3xl font-bold">Documentação Ambiental</h1><p className="mt-2 text-sm leading-relaxed text-emerald-50">Consulte a documentação publicada pela Start Campus para apoiar o cumprimento ambiental, as certificações e as decisões no projecto.</p></div>
        </div>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3"><div className="rounded-xl bg-amber-100 p-2.5 text-amber-800"><ShieldCheck className="h-6 w-6" /></div><div><p className="text-sm font-semibold uppercase tracking-wide text-amber-900">Consulta prioritária</p><h2 className="mt-1 text-xl font-bold text-slate-900">Central de Documentos do Projeto</h2><p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-700">DCAPE, PGA e outros documentos-base que definem as regras ambientais do projeto. Consulte-os antes de iniciar actividade em obra.</p></div></div>
                {centralDocuments.some(document => document.isMandatoryRead === 1) && <Badge className="w-fit bg-amber-700 hover:bg-amber-700"><ClipboardCheck className="mr-1 h-3.5 w-3.5" />Inclui leitura obrigatória</Badge>}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{centralDocuments.length > 0 ? centralDocuments.map(document => <CentralDocumentCard key={document.id} document={document} projectId={projectId} />) : <div className="rounded-lg border border-dashed border-amber-300 bg-white/70 px-5 py-6 text-sm text-slate-600 md:col-span-2 xl:col-span-3">A Administração ainda não publicou documentos-base nesta central. Quando DCAPE, PGA ou outros documentos de referência forem carregados, ficarão destacados aqui.</div>}</div>
      </section>

      <Tabs defaultValue="obrigacoes_ambientais" className="space-y-5">
              <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                <TabsTrigger value="obrigacoes_ambientais" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white">Obrigações Ambientais</TabsTrigger>
                <TabsTrigger value="certificacoes" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white">Certificações</TabsTrigger>
                <TabsTrigger value="recomendacoes" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white">Recomendações</TabsTrigger>
              </TabsList>
              <TabsContent value="obrigacoes_ambientais"><TopicPanel documents={documents} topic="obrigacoes_ambientais" projectId={projectId} /></TabsContent>
              <TabsContent value="certificacoes" className="space-y-4"><Tabs defaultValue="todas" className="space-y-4"><TabsList><TabsTrigger value="todas">Todas</TabsTrigger><TabsTrigger value="leed">LEED</TabsTrigger></TabsList><TabsContent value="todas"><TopicPanel documents={documents} topic="certificacoes" projectId={projectId} /></TabsContent><TabsContent value="leed"><TopicPanel documents={documents} topic="certificacoes" projectId={projectId} onlyLeed /></TabsContent></Tabs></TabsContent>
              <TabsContent value="recomendacoes"><TopicPanel documents={documents} topic="recomendacoes" projectId={projectId} /></TabsContent>
      </Tabs>
      {showManagementControls && <p className="sr-only">Gestão disponível na Administração.</p>}
    </div>
  );
}

export default function DocumentLibrary() {
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
  const projectId = activeProject?.id;
  const { data, isLoading, error } = trpc.documentLibrary.list.useQuery(
    projectId ? { projectId } : undefined,
    { enabled: Boolean(projectId) && !isAllProjects },
  );
  const documents = (data || []) as LibraryItem[];

  return (
    <AppLayout>
      {isAllProjects || !projectId ? <Card><CardContent className="p-8 text-center"><BookOpen className="mx-auto mb-3 h-8 w-8 text-emerald-700" /><p className="font-semibold text-slate-800">Seleccione um projeto para consultar a documentação</p><p className="mt-1 text-sm text-muted-foreground">A Documentação é apresentada apenas no projeto individual a que cada documento foi aplicado.</p></CardContent></Card> : isLoading ? <p className="text-sm text-muted-foreground">A carregar documentação...</p> : error ? <Card><CardContent className="p-8 text-center text-sm text-destructive">Não tem autorização para consultar a documentação deste projeto.</CardContent></Card> : <DocumentLibraryReadOnlyContent role={user?.role} documents={documents} projectId={projectId} />}
    </AppLayout>
  );
}
