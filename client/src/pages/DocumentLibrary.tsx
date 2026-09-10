import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BookOpen, ExternalLink, FileText, Leaf, Award, ShieldCheck } from "lucide-react";

const TOPICS = {
  obrigacoes_ambientais: { label: "Obrigações Ambientais", description: "Requisitos, obrigações legais e documentação de referência.", icon: ShieldCheck },
  certificacoes: { label: "Certificações", description: "Documentação de certificações ambientais e requisitos associados.", icon: Award },
  recomendacoes: { label: "Recomendações", description: "Guias, boas práticas e recomendações aplicáveis aos projectos.", icon: Leaf },
} as const;

type LibraryItem = {
  id: number;
  topic: keyof typeof TOPICS;
  subtopic: string | null;
  title: string;
  language: string;
  description: string | null;
  filename: string;
  fileSize: number;
  status: "draft" | "published" | "archived";
  createdByName: string;
  createdAt: Date | string;
};

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentCard({ document }: { document: LibraryItem }) {
  const topic = TOPICS[document.topic];
  const Icon = topic.icon;
  return (
    <Card className="h-full border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0 rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon className="h-4 w-4" /></div>
            <div className="min-w-0">
              <CardTitle className="text-base leading-snug">{document.title}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{topic.label}</p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800">{document.language}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {document.subtopic && <Badge variant="secondary">{document.subtopic}</Badge>}
        <p className="min-h-10 text-sm leading-relaxed text-slate-600">{document.description || "Documento de consulta disponível na biblioteca ambiental."}</p>
        <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5 truncate"><FileText className="h-3.5 w-3.5 shrink-0" />{document.filename} · {formatFileSize(document.fileSize)}</span>
          <a className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-700 hover:text-emerald-900 hover:underline" href={`/api/documentos/${document.id}/pdf`} target="_blank" rel="noopener noreferrer">
            Consultar <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function TopicPanel({ documents, topic, onlyLeed = false }: { documents: LibraryItem[]; topic: keyof typeof TOPICS; onlyLeed?: boolean }) {
  const topicInfo = TOPICS[topic];
  const Icon = topicInfo.icon;
  const filtered = documents.filter(item => item.topic === topic && (!onlyLeed || item.subtopic?.toLowerCase() === "leed"));
  if (filtered.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><Icon className="mx-auto mb-3 h-8 w-8 text-slate-400" /><p className="font-medium text-slate-700">Sem documentos publicados</p><p className="mt-1 text-sm text-slate-500">Os documentos aprovados pelo Administrador serão apresentados aqui.</p></div>;
  }
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(document => <DocumentCard key={document.id} document={document} />)}</div>;
}

export default function DocumentLibrary() {
  const { data, isLoading, error } = trpc.documentLibrary.list.useQuery();
  const documents = (data || []) as LibraryItem[];
  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-800 to-teal-700 p-7 text-white">
          <div className="flex max-w-3xl items-start gap-4">
            <div className="rounded-xl bg-white/15 p-3"><BookOpen className="h-7 w-7" /></div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-emerald-100">Repositório central</p>
              <h1 className="mt-1 text-3xl font-bold">Documentação Ambiental</h1>
              <p className="mt-2 text-sm leading-relaxed text-emerald-50">Consulte documentação publicada pela Administração para apoiar o cumprimento ambiental, as certificações e as decisões no projecto.</p>
            </div>
          </div>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">A carregar documentação...</p> : error ? <Card><CardContent className="p-8 text-center text-sm text-destructive">Não tem autorização para consultar esta biblioteca.</CardContent></Card> : (
          <Tabs defaultValue="obrigacoes_ambientais" className="space-y-5">
            <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
              <TabsTrigger value="obrigacoes_ambientais" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white">Obrigações Ambientais</TabsTrigger>
              <TabsTrigger value="certificacoes" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white">Certificações</TabsTrigger>
              <TabsTrigger value="recomendacoes" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white">Recomendações</TabsTrigger>
            </TabsList>
            <TabsContent value="obrigacoes_ambientais"><TopicPanel documents={documents} topic="obrigacoes_ambientais" /></TabsContent>
            <TabsContent value="certificacoes" className="space-y-4">
              <Tabs defaultValue="todas" className="space-y-4">
                <TabsList><TabsTrigger value="todas">Todas</TabsTrigger><TabsTrigger value="leed">LEED</TabsTrigger></TabsList>
                <TabsContent value="todas"><TopicPanel documents={documents} topic="certificacoes" /></TabsContent>
                <TabsContent value="leed"><TopicPanel documents={documents} topic="certificacoes" onlyLeed /></TabsContent>
              </Tabs>
            </TabsContent>
            <TabsContent value="recomendacoes"><TopicPanel documents={documents} topic="recomendacoes" /></TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
