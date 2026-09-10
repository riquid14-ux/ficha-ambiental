import { useState } from "react";
import { BookOpen, ClipboardCheck, ExternalLink, FileText, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const TOPICS = {
  obrigacoes_ambientais: "Obrigações Ambientais",
  certificacoes: "Certificações",
  recomendacoes: "Recomendações",
} as const;

const STATUS = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" } as const;
type Topic = keyof typeof TOPICS;
type Status = keyof typeof STATUS;
type LibraryItem = {
  id: number; topic: Topic; subtopic: string | null; title: string; language: string; description: string | null;
  filename: string; fileSize: number; status: Status; isProjectCentral: number; isMandatoryRead: number; centralOrder: number; appliesToAllProjects: number; projectIds: number[]; createdByName: string; createdAt: Date | string;
};

type DocumentScope = { appliesToAllProjects: boolean; projectIds: number[] };

const initialForm = { topic: "obrigacoes_ambientais" as Topic, subtopic: "", title: "", language: "Português (Portugal)", description: "", status: "draft" as "draft" | "published", isProjectCentral: false, isMandatoryRead: false, centralOrder: 0, appliesToAllProjects: false, projectIds: [] as number[] };

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o PDF."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DocumentScopeFields({ value, onChange, projects, prefix }: { value: DocumentScope; onChange: (value: DocumentScope) => void; projects: Array<{ id: number; code: string; name: string }>; prefix: string }) {
  const toggleProject = (projectId: number, checked: boolean) => onChange({
    ...value,
    projectIds: checked ? [...value.projectIds, projectId] : value.projectIds.filter(id => id !== projectId),
  });
  return (
    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3 md:col-span-2 xl:col-span-3">
      <div className="flex items-start gap-3">
        <Checkbox id={`${prefix}-all-projects`} checked={value.appliesToAllProjects} onCheckedChange={checked => onChange({ appliesToAllProjects: checked === true, projectIds: checked === true ? [] : value.projectIds })} />
        <div><Label htmlFor={`${prefix}-all-projects`} className="font-semibold text-slate-800">Aplicar a todos os projetos</Label><p className="mt-1 text-xs text-slate-600">O documento ficará disponível em cada projeto individual, incluindo projetos adicionados no futuro.</p></div>
      </div>
      {!value.appliesToAllProjects && <div className="space-y-2 border-t border-sky-100 pt-3"><p className="text-sm font-medium text-slate-800">Selecionar projetos aplicáveis</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{projects.map(project => <label key={project.id} className="flex cursor-pointer items-start gap-2 rounded-md border bg-white p-2.5 text-sm"><Checkbox checked={value.projectIds.includes(project.id)} onCheckedChange={checked => toggleProject(project.id, checked === true)} /><span><strong>{project.code}</strong><span className="block text-xs text-muted-foreground">{project.name}</span></span></label>)}</div>{projects.length === 0 && <p className="text-xs text-muted-foreground">Não existem projetos operacionais disponíveis.</p>}</div>}
    </div>
  );
}

export default function DocumentLibraryAdminTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.documentLibrary.list.useQuery();
  const projectsQuery = trpc.projects.list.useQuery();
  const create = trpc.documentLibrary.create.useMutation({ onSuccess: () => { utils.documentLibrary.list.invalidate(); toast.success("Documento guardado na biblioteca."); setForm(initialForm); setFile(null); }, onError: error => toast.error(error.message) });
  const update = trpc.documentLibrary.update.useMutation({ onSuccess: () => { utils.documentLibrary.list.invalidate(); toast.success("Documento actualizado."); setEditing(null); }, onError: error => toast.error(error.message) });
  const remove = trpc.documentLibrary.delete.useMutation({ onSuccess: () => { utils.documentLibrary.list.invalidate(); toast.success("Documento eliminado da biblioteca."); }, onError: error => toast.error(error.message) });
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [editForm, setEditForm] = useState({ topic: "obrigacoes_ambientais" as Topic, subtopic: "", title: "", language: "", description: "", status: "draft" as Status, isProjectCentral: false, isMandatoryRead: false, centralOrder: 0, appliesToAllProjects: false, projectIds: [] as number[] });
  const documents = (data || []) as LibraryItem[];
  const projects = (projectsQuery.data || []).filter((project: any) => project.code !== "main");

  const setCreateTopic = (topic: Topic) => setForm(current => ({ ...current, topic, subtopic: topic === "certificacoes" ? current.subtopic : "" }));
  const openEdit = (document: LibraryItem) => {
    setEditing(document);
    setEditForm({ topic: document.topic, subtopic: document.subtopic || "", title: document.title, language: document.language, description: document.description || "", status: document.status, isProjectCentral: document.isProjectCentral === 1, isMandatoryRead: document.isMandatoryRead === 1, centralOrder: document.centralOrder || 0, appliesToAllProjects: document.appliesToAllProjects === 1, projectIds: document.projectIds || [] });
  };
  const createDocument = async () => {
    if (!file) return toast.error("Seleccione o PDF a disponibilizar.");
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) return toast.error("Só são aceites ficheiros PDF.");
    if (file.size > 10 * 1024 * 1024) return toast.error("O PDF não pode ultrapassar 10 MB.");
    if (!form.title.trim() || !form.language.trim()) return toast.error("Indique título e língua do documento.");
    if (!form.appliesToAllProjects && form.projectIds.length === 0) return toast.error("Seleccione pelo menos um projeto ou aplique o documento a todos os projetos.");
    try {
      const data = await fileToBase64(file);
      create.mutate({ ...form, subtopic: form.subtopic.trim() || null, description: form.description.trim() || null, filename: file.name, mimeType: "application/pdf", data });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível preparar o PDF."); }
  };
  const saveEdit = () => {
    if (!editing || !editForm.title.trim() || !editForm.language.trim()) return toast.error("Indique título e língua do documento.");
    if (!editForm.appliesToAllProjects && editForm.projectIds.length === 0) return toast.error("Seleccione pelo menos um projeto ou aplique o documento a todos os projetos.");
    update.mutate({ id: editing.id, ...editForm, subtopic: editForm.subtopic.trim() || null, description: editForm.description.trim() || null });
  };

  return (
    <div className="space-y-5">
      <Card className="border-emerald-100">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BookOpen className="h-5 w-5 text-emerald-700" />Configuração da Documentação</CardTitle><p className="text-sm text-muted-foreground">Defina o título, descrição, língua, tópico, visibilidade e PDF. Marque DCAPE, PGA e outros documentos-base para os destacar na Central de Documentos do Projeto.</p></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="document-title">Título do documento</Label><Input id="document-title" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Ex.: Obrigações ambientais de obra" /></div>
          <div className="space-y-2"><Label htmlFor="document-language">Língua de redacção</Label><Input id="document-language" value={form.language} onChange={event => setForm(current => ({ ...current, language: event.target.value }))} placeholder="Ex.: Português (Portugal)" /></div>
          <div className="space-y-2"><Label>Tópico</Label><Select value={form.topic} onValueChange={value => setCreateTopic(value as Topic)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TOPICS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          {form.topic === "certificacoes" && <div className="space-y-2"><Label>Subtópico</Label><Select value={form.subtopic || "nenhum"} onValueChange={value => setForm(current => ({ ...current, subtopic: value === "nenhum" ? "" : value }))}><SelectTrigger><SelectValue placeholder="Seleccione, se aplicável" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem subtópico</SelectItem><SelectItem value="LEED">LEED</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent></Select></div>}
          <div className="space-y-2"><Label>Estado inicial</Label><Select value={form.status} onValueChange={value => setForm(current => ({ ...current, status: value as "draft" | "published" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Rascunho — apenas Administração</SelectItem><SelectItem value="published">Publicado — disponível a perfis autorizados</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="document-file">PDF (máx. 10 MB)</Label><Input id="document-file" type="file" accept="application/pdf,.pdf" onChange={event => setFile(event.target.files?.[0] || null)} /></div>
          <DocumentScopeFields value={form} onChange={scope => setForm(current => ({ ...current, ...scope }))} projects={projects} prefix="document" />
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 md:col-span-2 xl:col-span-3"><Checkbox id="document-central" checked={form.isProjectCentral} onCheckedChange={checked => setForm(current => ({ ...current, isProjectCentral: checked === true, isMandatoryRead: checked === true ? current.isMandatoryRead : false, centralOrder: checked === true ? current.centralOrder : 0 }))} /><div className="grid gap-1"><Label htmlFor="document-central" className="flex items-center gap-1.5 font-semibold text-slate-800"><ShieldCheck className="h-4 w-4 text-amber-800" />Destacar na Central de Documentos do Projeto</Label><p className="text-xs leading-relaxed text-slate-600">Use para DCAPE, PGA e outros documentos que estabelecem as regras de projecto.</p></div></div>
          {form.isProjectCentral && <><div className="flex items-start gap-3 rounded-lg border bg-slate-50 p-3"><Checkbox id="document-mandatory" checked={form.isMandatoryRead} onCheckedChange={checked => setForm(current => ({ ...current, isMandatoryRead: checked === true }))} /><div className="grid gap-1"><Label htmlFor="document-mandatory" className="flex items-center gap-1.5 font-semibold"><ClipboardCheck className="h-4 w-4 text-amber-800" />Assinalar como leitura obrigatória</Label><p className="text-xs text-muted-foreground">É apresentado com aviso reforçado na central.</p></div></div><div className="space-y-2"><Label htmlFor="central-order">Ordem na Central</Label><Input id="central-order" type="number" min={0} max={999} value={form.centralOrder} onChange={event => setForm(current => ({ ...current, centralOrder: Math.max(0, Math.min(999, Number(event.target.value) || 0)) }))} /><p className="text-xs text-muted-foreground">0 aparece primeiro.</p></div></>}
          <div className="space-y-2 md:col-span-2 xl:col-span-3"><Label htmlFor="document-description">Descrição de consulta</Label><Textarea id="document-description" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Explique o âmbito ou a utilização deste documento." maxLength={2000} /></div>
          <div className="md:col-span-2 xl:col-span-3"><Button onClick={createDocument} disabled={create.isPending} className="gap-2 bg-emerald-700 hover:bg-emerald-800"><Plus className="h-4 w-4" />{create.isPending ? "A guardar PDF..." : "Adicionar à biblioteca"}</Button></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-lg">Documentos registados</CardTitle></CardHeader><CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">A carregar...</p> : documents.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Ainda não existem documentos na biblioteca.</p> : <div className="space-y-3">{documents.map(document => { const previewProjectId = document.projectIds[0] || projects[0]?.id; return <div key={document.id} className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{document.title}</p><Badge variant={document.status === "published" ? "default" : "secondary"}>{STATUS[document.status]}</Badge><Badge variant="outline">{TOPICS[document.topic]}</Badge>{document.subtopic && <Badge variant="outline">{document.subtopic}</Badge>}{document.appliesToAllProjects === 1 ? <Badge variant="outline">Todos os projetos</Badge> : <Badge variant="outline">{document.projectIds.length} {document.projectIds.length === 1 ? "projeto" : "projetos"}</Badge>}{document.isProjectCentral === 1 && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Central</Badge>}{document.isMandatoryRead === 1 && <Badge className="bg-amber-700 hover:bg-amber-700">Leitura obrigatória</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{document.language} · {document.filename} · Registado por {document.createdByName} em {formatDate(document.createdAt)}</p></div><div className="flex flex-wrap gap-2">{previewProjectId && <a href={`/api/documentos/${document.id}/pdf?projectId=${previewProjectId}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1"><ExternalLink className="h-3.5 w-3.5" />Consultar</Button></a>}<Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(document)}><Pencil className="h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" disabled={remove.isPending} onClick={() => { if (window.confirm(`Eliminar “${document.title}” da biblioteca?`)) remove.mutate({ id: document.id }); }}><Trash2 className="h-3.5 w-3.5" />Eliminar</Button></div></div>; })}</div>}
      </CardContent></Card>

      <Dialog open={Boolean(editing)} onOpenChange={open => !open && setEditing(null)}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Editar documento</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div className="space-y-2"><Label>Título</Label><Input value={editForm.title} onChange={event => setEditForm(current => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2"><Label>Língua de redacção</Label><Input value={editForm.language} onChange={event => setEditForm(current => ({ ...current, language: event.target.value }))} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tópico</Label><Select value={editForm.topic} onValueChange={value => setEditForm(current => ({ ...current, topic: value as Topic, subtopic: value === "certificacoes" ? current.subtopic : "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TOPICS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Estado</Label><Select value={editForm.status} onValueChange={value => setEditForm(current => ({ ...current, status: value as Status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>{editForm.topic === "certificacoes" && <div className="space-y-2"><Label>Subtópico</Label><Input value={editForm.subtopic} onChange={event => setEditForm(current => ({ ...current, subtopic: event.target.value }))} placeholder="Ex.: LEED" /></div>}<DocumentScopeFields value={editForm} onChange={scope => setEditForm(current => ({ ...current, ...scope }))} projects={projects} prefix="edit-document" /><div className="space-y-2"><Label>Descrição</Label><Textarea value={editForm.description} onChange={event => setEditForm(current => ({ ...current, description: event.target.value }))} maxLength={2000} /></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><div className="flex items-start gap-3"><Checkbox id="edit-document-central" checked={editForm.isProjectCentral} onCheckedChange={checked => setEditForm(current => ({ ...current, isProjectCentral: checked === true, isMandatoryRead: checked === true ? current.isMandatoryRead : false, centralOrder: checked === true ? current.centralOrder : 0 }))} /><div><Label htmlFor="edit-document-central" className="font-semibold">Destacar na Central de Documentos do Projeto</Label><p className="mt-1 text-xs text-muted-foreground">Para documentos-base como DCAPE e PGA.</p></div></div>{editForm.isProjectCentral && <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="flex items-start gap-3"><Checkbox id="edit-document-mandatory" checked={editForm.isMandatoryRead} onCheckedChange={checked => setEditForm(current => ({ ...current, isMandatoryRead: checked === true }))} /><Label htmlFor="edit-document-mandatory" className="text-sm">Leitura obrigatória</Label></div><div className="space-y-1"><Label htmlFor="edit-central-order" className="text-sm">Ordem na Central</Label><Input id="edit-central-order" type="number" min={0} max={999} value={editForm.centralOrder} onChange={event => setEditForm(current => ({ ...current, centralOrder: Math.max(0, Math.min(999, Number(event.target.value) || 0)) }))} /></div></div>}</div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={saveEdit} disabled={update.isPending}>{update.isPending ? "A guardar..." : "Guardar alterações"}</Button></div></div></DialogContent></Dialog>
    </div>
  );
}
