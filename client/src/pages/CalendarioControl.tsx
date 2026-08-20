import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, Plus, Trash2, Save, X, Eye, EyeOff } from "lucide-react";

export default function CalendarioControl() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { projects } = useProject();
  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";

  const { data: calEvents, refetch } = trpc.calendarEvents.listAll.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const createMutation = trpc.calendarEvents.create.useMutation({
    onSuccess: () => { refetch(); toast.success("Evento criado"); setShowAdd(false); resetNewEvent(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMutation = trpc.calendarEvents.update.useMutation({
    onSuccess: () => { refetch(); toast.success(t("Evento atualizado")); setEditingId(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMutation = trpc.calendarEvents.delete.useMutation({
    onSuccess: () => { refetch(); toast.success(t("Evento eliminado")); },
    onError: (e: any) => toast.error(e.message),
  });
  const assignOwnerMutation = trpc.calendarEvents.assignOwner.useMutation({
    onSuccess: () => { refetch(); toast.success(t("Responsável atualizado")); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateStatusMutation = trpc.calendarEvents.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast.success(t("Estado atualizado")); },
    onError: (e: any) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [newEvent, setNewEvent] = useState({ name: "", periodicity: "Anual", category: "", date: "", projectId: "" });
  const [showHidden, setShowHidden] = useState(false);

  function resetNewEvent() {
    setNewEvent({ name: "", periodicity: "Anual", category: "", date: "", projectId: "" });
  }

  function startEdit(evt: any) {
    setEditingId(evt.id);
    setEditData({
      name: evt.name,
      periodicity: evt.periodicity || "",
      nextDate: evt.nextDate ? new Date(evt.nextDate).toISOString().split("T")[0] : "",
      category: evt.category || "",
    });
  }

  function saveEdit(id: number) {
    const updates: any = { id };
    if (editData.name) updates.name = editData.name;
    if (editData.periodicity) updates.periodicity = editData.periodicity;
    if (editData.category) updates.category = editData.category;
    if (editData.nextDate) updates.nextDate = new Date(editData.nextDate).getTime();
    updateMutation.mutate(updates);
  }

  if (!isAdminOrDono) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-muted-foreground">{t("Acesso restrito a Admin e Dono de Obra.")}</p>
        </div>
      </AppLayout>
    );
  }

  const now = Date.now();

  // Filter events: show active or all based on toggle
  const filteredEvents = calEvents
    ? showHidden ? calEvents : calEvents.filter((e: any) => e.active !== 0)
    : [];

  return (
    <AppLayout>
      <div className="space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6" />{t("Control Room — Calendário")}</h1>
            <p className="text-muted-foreground text-sm">{t("Gerir todos os eventos de reporting: criar, editar datas, atribuir responsáveis, eliminar")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowHidden(!showHidden)}>
              {showHidden ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
              {showHidden ? "Mostrar todos" : "Mostrar ocultos"}
            </Button>
            <Button onClick={() => setShowAdd(!showAdd)}>
              <Plus className="w-4 h-4 mr-1" /> Novo Evento
            </Button>
          </div>
        </div>

        {/* Add new event form */}
        {showAdd && (
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3">{t("Adicionar Novo Evento")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">{t("Nome")}</label>
                  <Input value={newEvent.name} onChange={e => setNewEvent(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Gases APA" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("Projeto")}</label>
                  <select className="w-full h-9 border rounded-md px-2 text-sm" value={newEvent.projectId} onChange={e => setNewEvent(p => ({ ...p, projectId: e.target.value }))}>
                    <option value="">— Todos —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("Periodicidade")}</label>
                  <select className="w-full h-9 border rounded-md px-2 text-sm" value={newEvent.periodicity} onChange={e => setNewEvent(p => ({ ...p, periodicity: e.target.value }))}>
                    <option value="Anual">{t("Anual")}</option>
                    <option value="Semestral">{t("Semestral")}</option>
                    <option value="Trimestral">{t("Trimestral")}</option>
                    <option value="Mensal">{t("Mensal")}</option>
                    <option value="Pontual">{t("Pontual")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("Próxima Data")}</label>
                  <Input type="date" value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={() => {
                    if (!newEvent.name || !newEvent.date) { toast.error(t("Preencha nome e data")); return; }
                    createMutation.mutate({
                      name: newEvent.name,
                      projectId: newEvent.projectId ? parseInt(newEvent.projectId) : undefined,
                      periodicity: newEvent.periodicity,
                      category: newEvent.category || undefined,
                      firstDate: new Date(newEvent.date).getTime(),
                      nextDate: new Date(newEvent.date).getTime(),
                    });
                  }} disabled={createMutation.isPending}>
                    Criar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); resetNewEvent(); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events management table */}
        <Card>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left bg-muted/30">
                    <th className="py-2.5 px-2 font-medium">{t("Evento")}</th>
                    <th className="py-2.5 px-2 font-medium">{t("Projeto")}</th>
                    <th className="py-2.5 px-2 font-medium">{t("Periodicidade")}</th>
                    <th className="py-2.5 px-2 font-medium">{t("Próxima Data")}</th>
                    <th className="py-2.5 px-2 font-medium">{t("Responsável")}</th>
                    <th className="py-2.5 px-2 font-medium">{t("Estado")}</th>
                    <th className="py-2.5 px-2 font-medium">{t("Ações")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length > 0 ? (
                    [...filteredEvents]
                      .sort((a: any, b: any) => (a.nextDate || 0) - (b.nextDate || 0))
                      .map((evt: any) => {
                        const isOverdue = evt.nextDate && evt.nextDate < now && evt.status === "pending";
                        const proj = projects.find(p => p.id === evt.projectId);
                        const isEditing = editingId === evt.id;

                        return (
                          <tr key={evt.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2.5 px-2">
                              {isEditing ? (
                                <Input className="h-7 text-xs" value={editData.name} onChange={e => setEditData((p: any) => ({ ...p, name: e.target.value }))} />
                              ) : (
                                <span className="font-medium">{evt.name}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-muted-foreground">{proj?.code || "Global"}</td>
                            <td className="py-2.5 px-2">
                              {isEditing ? (
                                <select className="h-7 text-xs border rounded px-1" value={editData.periodicity} onChange={e => setEditData((p: any) => ({ ...p, periodicity: e.target.value }))}>
                                  <option value="Anual">{t("Anual")}</option>
                                  <option value="Semestral">{t("Semestral")}</option>
                                  <option value="Trimestral">{t("Trimestral")}</option>
                                  <option value="Mensal">{t("Mensal")}</option>
                                  <option value="Pontual">{t("Pontual")}</option>
                                </select>
                              ) : (
                                <span>{evt.periodicity || "—"}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2">
                              {isEditing ? (
                                <Input type="date" className="h-7 text-xs" value={editData.nextDate} onChange={e => setEditData((p: any) => ({ ...p, nextDate: e.target.value }))} />
                              ) : (
                                <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                                  {evt.nextDate ? new Date(evt.nextDate).toLocaleDateString("pt-PT") : "—"}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2">
                              <select
                                className="h-7 text-xs border rounded px-1 w-full max-w-[130px]"
                                value={evt.ownerId || ""}
                                onChange={(e) => {
                                  const userId = parseInt(e.target.value);
                                  const selectedUser = users?.find((u: any) => u.id === userId);
                                  if (selectedUser) {
                                    assignOwnerMutation.mutate({ id: evt.id, ownerId: userId, ownerName: selectedUser.fullName || selectedUser.name || selectedUser.email || "" });
                                  }
                                }}
                              >
                                <option value="">— Nenhum —</option>
                                {users?.map((u: any) => (
                                  <option key={u.id} value={u.id}>{u.fullName || u.name || u.email}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 px-2">
                              {isOverdue ? (
                                <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">{ t("Em atraso") }</Badge>
                              ) : evt.status === "reported" ? (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">{ t("Reportado") }</Badge>
                              ) : evt.status === "confirmed" ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">{ t("Confirmado") }</Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">{t("Pendente")}</Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-1">
                                {isEditing ? (
                                  <>
                                    <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => saveEdit(evt.id)}>
                                      <Save className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => setEditingId(null)}>
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => startEdit(evt)}>
                                      Editar
                                    </Button>
                                    {(isOverdue || evt.status === "pending") && (
                                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-blue-300 text-blue-700" onClick={() => updateStatusMutation.mutate({ id: evt.id, status: "reported" })}>
                                        Reportado
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => {
                                      if (confirm("Eliminar este evento?")) deleteMutation.mutate({ id: evt.id });
                                    }}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                      title={evt.active === 0 ? "Mostrar no calendário" : "Ocultar do calendário"}
                                      onClick={() => {
                                        if (evt.active === 0) {
                                          updateMutation.mutate({ id: evt.id, name: evt.name });
                                        } else {
                                          deleteMutation.mutate({ id: evt.id });
                                        }
                                      }}
                                    >
                                      {evt.active === 0 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        Nenhum evento criado. Clique em "Novo Evento" para adicionar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
