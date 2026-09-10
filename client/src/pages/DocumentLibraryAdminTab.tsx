import { useState } from "react";
import { BookOpen, ExternalLink, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  filename: string; fileSize: number; status: Status; createdByName: string; createdAt: Date | string;
};

const initialForm = { topic: "obrigacoes_ambientais" as Topic, subtopic: "", title: "", language: "Português (Portugal)", description: "", status: "draft" as "draft" | "published" };

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

export default function DocumentLibraryAdminTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.documentLibrary.list.useQuery();
  const create = trpc.documentLibrary.create.useMutation({ onSuccess: () => { utils.documentLibrary.list.invalidate(); toast.success("Documento guardado na biblioteca."); setForm(initialForm); setFile(null); }, onError: error => toast.error(error.message) });
  const update = trpc.documentLibrary.update.useMutation({ onSuccess: () => { utils.documentLibrary.list.invalidate(); toast.success("Documento actualizado."); setEditing(null); }, onError: error => toast.error(error.message) });
  const remove = trpc.documentLibrary.delete.useMutation({ onSuccess: () => { utils.documentLibrary.list.invalidate(); toast.success("Documento eliminado da biblioteca."); }, onError: error => toast.error(error.message) });
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [editForm, setEditForm] = useState({ topic: "obrigacoes_ambientais" as Topic, subtopic: "", title: "", language: "", description: "", status: "draft" as Status });
  const documents = (data || []) as LibraryItem[];

  const setCreateTopic = (topic: Topic) => setForm(current => ({ ...current, topic, subtopic: topic === "certificacoes" ? current.subtopic : "" }));
  const openEdit = (document: LibraryItem) => {
    setEditing(document);
    setEditForm({ topic: document.topic, subtopic: document.subtopic || "", title: document.title, language: document.language, description: document.description || "", status: document.status });
  };
  const createDocument = async () => {
    if (!file) return toast.error("Seleccione o PDF a disponibilizar.");
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) return toast.error("Só são aceites ficheiros PDF.");
    if (file.size > 10 * 1024 * 1024) return toast.error("O PDF não pode ultrapassar 10 MB.");
    if (!form.title.trim() || !form.language.trim()) return toast.error("Indique título e língua do documento.");
    try {
      const data = await fileToBase64(file);
      create.mutate({ ...form, subtopic: form.subtopic.trim() || null, description: form.description.trim() || null, filename: file.name, mimeType: "application/pdf", data });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível preparar o PDF."); }
  };
  const saveEdit = () => {
    if (!editing || !editForm.title.trim() || !editForm.language.trim()) return toast.error("Indique título e língua do documento.");
    update.mutate({ id: editing.id, ...editForm, subtopic: editForm.subtopic.trim() || null, description: editForm.description.trim() || null });
  };

  return (
    <div className="space-y-5">
      <Card className="border-emerald-100">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BookOpen className="h-5 w-5 text-emerald-700" />Biblioteca de Documentação</CardTitle><p className="text-sm text-muted-foreground">Publique PDFs de referência. Os ficheiros permanecem em storage externo e só são disponibilizados por uma rota autenticada aos perfis autorizados.</p></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="document-title">Título do documento</Label><Input id="document-title" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Ex.: Obrigações ambientais de obra" /></div>
          <div className="space-y-2"><Label htmlFor="document-language">Língua de redacção</Label><Input id="document-language" value={form.language} onChange={event => setForm(current => ({ ...current, language: event.target.value }))} placeholder="Ex.: Português (Portugal)" /></div>
          <div className="space-y-2"><Label>Tópico</Label><Select value={form.topic} onValueChange={value => setCreateTopic(value as Topic)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TOPICS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          {form.topic === "certificacoes" && <div className="space-y-2"><Label>Subtópico</Label><Select value={form.subtopic || "nenhum"} onValueChange={value => setForm(current => ({ ...current, subtopic: value === "nenhum" ? "" : value }))}><SelectTrigger><SelectValue placeholder="Seleccione, se aplicável" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem subtópico</SelectItem><SelectItem value="LEED">LEED</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent></Select></div>}
          <div className="space-y-2"><Label>Estado inicial</Label><Select value={form.status} onValueChange={value => setForm(current => ({ ...current, status: value as "draft" | "published" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Rascunho — apenas Administração</SelectItem><SelectItem value="published">Publicado — disponível a perfis autorizados</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="document-file">PDF (máx. 10 MB)</Label><Input id="document-file" type="file" accept="application/pdf,.pdf" onChange={event => setFile(event.target.files?.[0] || null)} /></div>
          <div className="space-y-2 md:col-span-2 xl:col-span-3"><Label htmlFor="document-description">Descrição de consulta</Label><Textarea id="document-description" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Explique o âmbito ou a utilização deste documento." maxLength={2000} /></div>
          <div className="md:col-span-2 xl:col-span-3"><Button onClick={createDocument} disabled={create.isPending} className="gap-2 bg-emerald-700 hover:bg-emerald-800"><Plus className="h-4 w-4" />{create.isPending ? "A guardar PDF..." : "Adicionar à biblioteca"}</Button></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-lg">Documentos registados</CardTitle></CardHeader><CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">A carregar...</p> : documents.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Ainda não existem documentos na biblioteca.</p> : <div className="space-y-3">{documents.map(document => <div key={document.id} className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{document.title}</p><Badge variant={document.status === "published" ? "default" : "secondary"}>{STATUS[document.status]}</Badge><Badge variant="outline">{TOPICS[document.topic]}</Badge>{document.subtopic && <Badge variant="outline">{document.subtopic}</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{document.language} · {document.filename} · Registado por {document.createdByName} em {formatDate(document.createdAt)}</p></div><div className="flex flex-wrap gap-2"><a href={`/api/documentos/${document.id}/pdf`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1"><ExternalLink className="h-3.5 w-3.5" />Consultar</Button></a><Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(document)}><Pencil className="h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" disabled={remove.isPending} onClick={() => { if (window.confirm(`Eliminar “${document.title}” da biblioteca?`)) remove.mutate({ id: document.id }); }}><Trash2 className="h-3.5 w-3.5" />Eliminar</Button></div></div>)}</div>}
      </CardContent></Card>

      <Dialog open={Boolean(editing)} onOpenChange={open => !open && setEditing(null)}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Editar documento</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div className="space-y-2"><Label>Título</Label><Input value={editForm.title} onChange={event => setEditForm(current => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2"><Label>Língua de redacção</Label><Input value={editForm.language} onChange={event => setEditForm(current => ({ ...current, language: event.target.value }))} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tópico</Label><Select value={editForm.topic} onValueChange={value => setEditForm(current => ({ ...current, topic: value as Topic, subtopic: value === "certificacoes" ? current.subtopic : "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TOPICS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Estado</Label><Select value={editForm.status} onValueChange={value => setEditForm(current => ({ ...current, status: value as Status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>{editForm.topic === "certificacoes" && <div className="space-y-2"><Label>Subtópico</Label><Input value={editForm.subtopic} onChange={event => setEditForm(current => ({ ...current, subtopic: event.target.value }))} placeholder="Ex.: LEED" /></div>}<div className="space-y-2"><Label>Descrição</Label><Textarea value={editForm.description} onChange={event => setEditForm(current => ({ ...current, description: event.target.value }))} maxLength={2000} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={saveEdit} disabled={update.isPending}>{update.isPending ? "A guardar..." : "Guardar alterações"}</Button></div></div></DialogContent></Dialog>
    </div>
  );
}
