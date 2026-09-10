import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { useState, useRef, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Building2, Users, Plus, FileUp, ClipboardList, ImageIcon, Info, Shield, FileCheck, Eye, HardHat, Mail, Trash2, UserPlus, FolderKanban, Pencil, XCircle, CheckCircle2, Calendar, Settings2, BookOpen } from "lucide-react";
import { useLocation } from "wouter";
import ImagesTab from "./AdminImagesTab";
import { CompanyRelationshipMap } from "@/components/CompanyRelationshipMap";
import { useProject } from "@/contexts/ProjectContext";
import DocumentLibraryAdminTab from "./DocumentLibraryAdminTab";

const ROLE_LABELS: Record<string, string> = {
  user: "Utilizador",
  admin: "Administrador",
  ee: "EE",
  ee_partner: "EEP — Entidade Executante Parceira",
  raa: "RAA",
  pm: "PM — Gestor de Projeto",
  rap: "RAP",
  dono_obra: "Dono de Obra",
  observador: "Observador",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Submetida",
  under_review: "Em Revisão",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  submitted: "default",
  under_review: "outline",
  approved: "default",
  rejected: "destructive",
};

const PM_MODULE_OPTIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "planos", label: "Planos" },
  { id: "calendar", label: "Calendário" },
  { id: "timeline", label: "Timeline e Fases" },
  { id: "ficha", label: "Fichas semanais" },
  { id: "residuos", label: "Resíduos" },
  { id: "kpi", label: "KPI" },
  { id: "documentacao", label: "Documentação" },
] as const;

const DEFAULT_PM_MODULE_IDS = PM_MODULE_OPTIONS.map(module => module.id);

function parsePmModuleIds(value?: string | null) {
  if (!value) return DEFAULT_PM_MODULE_IDS;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every(module => DEFAULT_PM_MODULE_IDS.includes(module))) return parsed as string[];
  } catch {
    // Os PM existentes mantêm acesso completo até o administrador guardar a configuração.
  }
  return DEFAULT_PM_MODULE_IDS;
}

type CompanyPeriodRecord = {
  id: number;
  shortName: string;
  companyType: string;
  startWeek: number | null;
  startYear: number | null;
  endWeek: number | null;
  endYear: number | null;
  bufferWeeks: number | null;
};

function CompanyPeriodRow({ period, saving, onSave }: { period: CompanyPeriodRecord; saving: boolean; onSave: (input: { id: number; startWeek: number | null; startYear: number | null; endWeek: number | null; endYear: number | null; bufferWeeks: number }) => void }) {
  const makeDraft = () => ({
    startWeek: period.startWeek?.toString() ?? "",
    startYear: period.startYear?.toString() ?? "",
    endWeek: period.endWeek?.toString() ?? "",
    endYear: period.endYear?.toString() ?? "",
    bufferWeeks: (period.bufferWeeks ?? 4).toString(),
  });
  const [draft, setDraft] = useState(makeDraft);
  useEffect(() => setDraft(makeDraft()), [period.id, period.startWeek, period.startYear, period.endWeek, period.endYear, period.bufferWeeks]);

  const setField = (field: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [field]: value }));
  const nullableNumber = (value: string) => value.trim() === "" ? null : Number(value);
  const save = () => {
    const startWeek = nullableNumber(draft.startWeek);
    const startYear = nullableNumber(draft.startYear);
    const endWeek = nullableNumber(draft.endWeek);
    const endYear = nullableNumber(draft.endYear);
    const bufferWeeks = Number(draft.bufferWeeks);
    if (![period.id, startWeek, startYear, endWeek, endYear, bufferWeeks].filter(value => value !== null).every(Number.isFinite)) return toast.error("Preencha os períodos apenas com números válidos.");
    if ((startWeek === null) !== (startYear === null)) return toast.error("Indique a semana e o ano de início.");
    if ((endWeek === null) !== (endYear === null)) return toast.error("Indique a semana e o ano de fim.");
    if ([startWeek, endWeek].some(value => value !== null && (!Number.isInteger(value) || value < 1 || value > 53))) return toast.error("As semanas devem estar entre 1 e 53.");
    if ([startYear, endYear].some(value => value !== null && (!Number.isInteger(value) || value < 2020 || value > 2100))) return toast.error("Os anos devem estar entre 2020 e 2100.");
    if (!Number.isInteger(bufferWeeks) || bufferWeeks < 0 || bufferWeeks > 12) return toast.error("O buffer deve estar entre 0 e 12 semanas.");
    if (startWeek !== null && startYear !== null && endWeek !== null && endYear !== null && endYear * 53 + endWeek < startYear * 53 + startWeek) return toast.error("O fim dos trabalhos não pode ser anterior ao início.");
    onSave({ id: period.id, startWeek, startYear, endWeek, endYear, bufferWeeks });
  };

  return (
    <TableRow>
      <TableCell>{period.shortName}</TableCell>
      <TableCell><Badge variant="outline">{period.companyType === "ee_partner" ? "EEP" : period.companyType?.toUpperCase()}</Badge></TableCell>
      <TableCell><div className="flex gap-1"><Input aria-label={`Semana inicial ${period.shortName}`} type="number" min={1} max={53} className="w-16 h-8 text-xs" placeholder="S" value={draft.startWeek} onChange={event => setField("startWeek", event.target.value)} /><Input aria-label={`Ano inicial ${period.shortName}`} type="number" min={2020} max={2100} className="w-20 h-8 text-xs" placeholder="Ano" value={draft.startYear} onChange={event => setField("startYear", event.target.value)} /></div></TableCell>
      <TableCell><div className="flex gap-1"><Input aria-label={`Semana final ${period.shortName}`} type="number" min={1} max={53} className="w-16 h-8 text-xs" placeholder="S" value={draft.endWeek} onChange={event => setField("endWeek", event.target.value)} /><Input aria-label={`Ano final ${period.shortName}`} type="number" min={2020} max={2100} className="w-20 h-8 text-xs" placeholder="Ano" value={draft.endYear} onChange={event => setField("endYear", event.target.value)} /></div></TableCell>
      <TableCell><Input aria-label={`Buffer ${period.shortName}`} type="number" min={0} max={12} className="w-16 h-8 text-xs" value={draft.bufferWeeks} onChange={event => setField("bufferWeeks", event.target.value)} /></TableCell>
      <TableCell><Button size="sm" className="h-8" disabled={saving} onClick={save}>{saving ? "A guardar..." : "Guardar"}</Button></TableCell>
    </TableRow>
  );
}


function AuditLogTab() {
  const { t } = useLanguage();
  const { data: logs, isLoading } = trpc.audit.list.useQuery({ limit: 200 });
  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar...</p>;
  if (!logs || logs.length === 0) return <p className="text-sm text-muted-foreground">Sem registos de auditoria.</p>;
  return (
    <div className="max-h-[500px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background border-b">
          <tr>
            <th className="text-left p-2">Data</th>
            <th className="text-left p-2">Utilizador</th>
            <th className="text-left p-2">{t("Ação")}</th>
            <th className="text-left p-2">Entidade</th>
            <th className="text-left p-2">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id} className="border-b hover:bg-muted">
              <td className="p-2 text-xs">{new Date(log.createdAt).toLocaleString("pt-PT")}</td>
              <td className="p-2">{log.userName || "—"}</td>
              <td className="p-2">{log.action}</td>
              <td className="p-2">{log.entity || "—"}</td>
              <td className="p-2 text-xs max-w-[200px] truncate">{log.oldValue ? `${log.oldValue} → ${log.newValue}` : log.newValue || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPanel() {
  const { t } = useLanguage();
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Administração")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("Gestão de empresas, utilizadores e submissões")}</p>
        </div>

        {/* Explanatory Roles Panel */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">{t("Tipos de Entidade e Permissões")}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <HardHat className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">EE — Entidade Executante</p>
                  <p className="text-xs text-muted-foreground">{t("Submete as fichas de controlo semanais relativas às suas medidas.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background rounded border">
                <Users className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">EEP — Entidade Executante Parceira</p>
                  <p className="text-xs text-muted-foreground">Subcontratado de uma EE. Acede apenas a KPI e/ou Resíduos nos projectos autorizados.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <Shield className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">RAP — Resp. Acompanhamento Patrimonial</p>
                  <p className="text-xs text-muted-foreground">{t("Submete as fichas de controlo semanais relativas às suas medidas.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <FileCheck className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">RAA — Resp. Acompanhamento Ambiental</p>
                  <p className="text-xs text-muted-foreground">{t("Revê as fichas submetidas. Aprova ou rejeita com comentários por medida.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <Users className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">PM — Gestor de Projeto</p>
                  <p className="text-xs text-muted-foreground">{t("Acompanha o projecto, o calendário, a timeline e os indicadores dentro do seu âmbito.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <Building2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Dono de Obra — Start Campus</p>
                  <p className="text-xs text-muted-foreground">{t("Visão geral do projeto. Acesso de administração e supervisão.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background dark:bg-slate-900 rounded border">
                <Eye className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Observador</p>
                  <p className="text-xs text-muted-foreground">{t("Acesso de leitura. Pode ver dashboard, histórico e revisões.")}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="companies">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap p-1">
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" /> Empresas
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" /> Utilizadores
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-2">
              <ImageIcon className="w-4 h-4" /> Imagens
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-2">
              <BookOpen className="w-4 h-4" /> Documentação
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-2">
              🔑 Pedidos de Acesso
            </TabsTrigger>
            {user?.role === "admin" && (
              <TabsTrigger value="pedidos-eep" className="gap-2">
                <Building2 className="w-4 h-4" /> Pedidos EEP
              </TabsTrigger>
            )}
            <TabsTrigger value="melhorias" className="gap-2">
              💡 Melhorias
            </TabsTrigger>
            {user?.role === "admin" && (
              <TabsTrigger value="auditoria" className="gap-2">
                📋 Auditoria
              </TabsTrigger>
            )}
            {user?.role === "admin" && (
              <TabsTrigger value="email" className="gap-2">
                ✉️ {t("Email")}
              </TabsTrigger>
            )}
            {user?.role === "admin" && (
              <TabsTrigger value="notificacoes" className="gap-2">
                🔔 {t("Notificações")}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="companies" className="mt-4">
            <CompaniesTab />
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>
          <TabsContent value="images" className="mt-4">
            <ImagesTab />
          </TabsContent>
          <TabsContent value="documentos" className="mt-4">
            <DocumentLibraryAdminTab />
          </TabsContent>
          <TabsContent value="pedidos" className="mt-4"><PendingAccountsTab /></TabsContent>
          {user?.role === "admin" && <TabsContent value="pedidos-eep" className="mt-4"><EepRequestsAdminTab /></TabsContent>}
          <TabsContent value="melhorias" className="mt-4">
            <MelhoriasTab />
          </TabsContent>
          {user?.role === "admin" && (
            <TabsContent value="email" className="mt-4">
              <EmailConfigTab />
            </TabsContent>
          )}
          {user?.role === "admin" && (
            <TabsContent value="notificacoes" className="mt-4">
              <NotificationRecipientsTab />
            </TabsContent>
          )}
        
        {/* Audit Log Tab - Admin only */}
        {user?.role === "admin" && (
          <TabsContent value="auditoria" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("Histórico de Ações")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("Registo de todas as alterações realizadas na plataforma (apenas leitura)")}</p>
              </CardHeader>
              <CardContent>
                <AuditLogTab />
              </CardContent>
            </Card>
          </TabsContent>
        )}
</Tabs>
      </div>

    </AppLayout>
  );
}

function CompaniesTab() {
  const { t } = useLanguage();
  const { activeProject, isAllProjects } = useProject();
  const [newName, setNewName] = useState("");
  const [newShortName, setNewShortName] = useState("");
  const [newType, setNewType] = useState<"ee" | "ee_partner" | "rap" | "dono_obra" | "raa" | "pm" | "observador">("ee");
  const [newProjectIds, setNewProjectIds] = useState<number[]>([]);
  const [newParentCompanyId, setNewParentCompanyId] = useState<number | null>(null);
  const [newAllowKpi, setNewAllowKpi] = useState(false);
  const [newAllowWaste, setNewAllowWaste] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [selectedCompanyForPeriod, setSelectedCompanyForPeriod] = useState<any>(null);
  const [periodProject, setPeriodProject] = useState<number>(0);
  const [wwwDialogOpen, setWwwDialogOpen] = useState(false);
  const [wwwProject, setWwwProject] = useState<number>(0);
  const [wwwWeek, setWwwWeek] = useState("");
  const [wwwYear, setWwwYear] = useState(String(new Date().getFullYear()));
  const [wwwReason, setWwwReason] = useState("");
  const utils = trpc.useUtils();

  const companiesQuery = trpc.companies.list.useQuery();
  const projectsQuery = trpc.projects.list.useQuery();
  const companyAssignmentsQuery = trpc.projects.allCompanyAssignments.useQuery();
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

  const deleteCompanyMutation = trpc.companies.delete.useMutation({
    onSuccess: () => { toast.success(t("Empresa eliminada")); companiesQuery.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateCompanyMutation = trpc.companies.update.useMutation({
    onSuccess: () => { toast.success(t("Empresa atualizada")); companiesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const setCompanyProjectsMutation = trpc.projects.setCompanyProjects.useMutation({
    onSuccess: () => {
      toast.success("Projetos da empresa atualizados");
      utils.projects.allCompanyAssignments.invalidate();
      setEditingCompanyId(null);
    },
  });
  const companyPeriodsQuery = trpc.companyPeriods.getByProject.useQuery({ projectId: periodProject }, { enabled: periodProject > 0 && periodDialogOpen });
  const updatePeriodMutation = trpc.companyPeriods.update.useMutation({
    onSuccess: () => { toast.success(t("Período atualizado")); companyPeriodsQuery.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const wwwListQuery = trpc.weeksWithoutWork.list.useQuery({ projectId: wwwProject }, { enabled: wwwProject > 0 && wwwDialogOpen });
  const addWwwMutation = trpc.weeksWithoutWork.add.useMutation({
    onSuccess: () => { toast.success(t("Semana sem trabalhos adicionada")); wwwListQuery.refetch(); setWwwWeek(""); setWwwReason(""); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeWwwMutation = trpc.weeksWithoutWork.remove.useMutation({
    onSuccess: () => { toast.success(t("Semana removida")); wwwListQuery.refetch(); },
  });

  // Build a map of companyId -> projectIds
  const companyProjectsMap = useMemo(() => {
    const map = new Map<number, number[]>();
    if (companyAssignmentsQuery.data) {
      for (const a of companyAssignmentsQuery.data) {
        const existing = map.get(a.companyId) || [];
        if (!existing.includes(a.projectId)) existing.push(a.projectId);
        map.set(a.companyId, existing);
      }
    }
    return map;
  }, [companyAssignmentsQuery.data]);
  const visibleCompanies = useMemo(() => {
    const companies = companiesQuery.data || [];
    if (isAllProjects || !activeProject) return companies;
    const companyIds = new Set((companyAssignmentsQuery.data || [])
      .filter(assignment => assignment.projectId === activeProject.id)
      .map(assignment => assignment.companyId));
    return companies.filter(company => companyIds.has(company.id));
  }, [activeProject?.id, companiesQuery.data, companyAssignmentsQuery.data, isAllProjects]);

  const createMutation = trpc.companies.create.useMutation({
    onSuccess: async () => {
      toast.success(t("Empresa criada com sucesso"));
      await Promise.all([
        utils.companies.list.invalidate(),
        utils.projects.allCompanyAssignments.invalidate(),
      ]);
      setDialogOpen(false);
      setNewName("");
      setNewShortName("");
      setNewType("ee");
      setNewProjectIds([]);
      setNewParentCompanyId(null);
      setNewAllowKpi(false);
      setNewAllowWaste(false);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("Empresas / Entidades")}</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Criar Nova Empresa")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>{t("Nome completo")}</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Empresa ABC, Lda." />
              </div>
              <div>
                <Label>Sigla / Nome curto</Label>
                <Input value={newShortName} onChange={(e) => setNewShortName(e.target.value)} placeholder="Ex: ABC" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={newType} onValueChange={(v) => { setNewType(v as "ee" | "ee_partner" | "rap" | "dono_obra" | "raa" | "pm" | "observador"); setNewProjectIds([]); setNewParentCompanyId(null); setNewAllowKpi(false); setNewAllowWaste(false); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ee">EE - Entidade Executante</SelectItem>
                    <SelectItem value="ee_partner">EEP — Entidade Executante Parceira</SelectItem>
                    <SelectItem value="rap">RAP - Resp. Acompanhamento Patrimonial</SelectItem>
                    <SelectItem value="dono_obra">Dono de Obra</SelectItem>
                    <SelectItem value="raa">RAA - Resp. Acompanhamento Ambiental</SelectItem>
                    <SelectItem value="pm">PM — Gestor de Projeto</SelectItem>
                    <SelectItem value="observador">Observador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newType === "ee_partner" && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                  <div>
                    <Label>EE principal a que responde</Label>
                    <Select value={newParentCompanyId ? String(newParentCompanyId) : undefined} onValueChange={value => { setNewParentCompanyId(Number(value)); setNewProjectIds([]); }}>
                      <SelectTrigger><SelectValue placeholder="Seleccione uma EE" /></SelectTrigger>
                      <SelectContent>{companiesQuery.data?.filter(company => company.companyType === "ee").map(company => <SelectItem key={company.id} value={String(company.id)}>{company.shortName} — {company.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={newAllowKpi} onChange={event => setNewAllowKpi(event.target.checked)} /> KPI</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={newAllowWaste} onChange={event => setNewAllowWaste(event.target.checked)} /> Resíduos</label>
                  </div>
                </div>
              )}
              <div>
                <Label>Projectos <span className="text-destructive">*</span></Label>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border p-3">
                  {projectsQuery.data?.filter(project => project.code !== "main" && project.code !== "SIN01-NEST" && (newType !== "ee_partner" || (newParentCompanyId && (companyProjectsMap.get(newParentCompanyId) || []).includes(project.id)))).map(project => (
                    <label key={project.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={newProjectIds.includes(project.id)} onChange={event => setNewProjectIds(current => event.target.checked ? [...current, project.id] : current.filter(id => id !== project.id))} />
                      {project.code}
                    </label>
                  ))}
                  {newType === "ee_partner" && !newParentCompanyId && <p className="col-span-2 text-xs text-muted-foreground">Seleccione primeiro a EE principal.</p>}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({ name: newName, shortName: newShortName, companyType: newType, projectIds: newProjectIds, parentCompanyId: newParentCompanyId ?? undefined, allowKpi: newAllowKpi, allowWaste: newAllowWaste })}
                disabled={!newName || !newShortName || newProjectIds.length === 0 || (newType === "ee_partner" && (!newParentCompanyId || (!newAllowKpi && !newAllowWaste)))}
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
              <TableHead>Tipo</TableHead>
              <TableHead>Ligação EEP</TableHead>
              <TableHead>Projetos</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCompanies.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell><Badge variant="outline">{c.companyType === "rap" ? "RAP - " : ""}{c.shortName}</Badge></TableCell>
                <TableCell>
                  <Badge variant={c.companyType === "ee" ? "default" : c.companyType === "ee_partner" ? "secondary" : c.companyType === "rap" ? "secondary" : "outline"}>
                    {c.companyType === "ee" ? "EE" : c.companyType === "ee_partner" ? "EEP" : c.companyType === "rap" ? "RAP" : c.companyType === "dono_obra" ? "Dono de Obra" : c.companyType === "raa" ? "RAA" : c.companyType === "pm" ? "PM" : "Observador"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {c.companyType === "ee_partner" ? (
                    <div className="text-xs">
                      <span className="font-medium">EEP de {c.parentCompanyName || "—"}</span>
                      <div className="text-muted-foreground">{[c.allowKpi && "KPI", c.allowWaste && "Resíduos"].filter(Boolean).join(" + ") || "Sem módulos"}</div>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {editingCompanyId === c.id ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {projectsQuery.data?.filter(p => p.code !== "main" && p.code !== "SIN01-NEST").map(p => (
                          <label key={p.id} className="flex items-center gap-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedProjectIds.includes(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProjectIds(prev => [...prev, p.id]);
                                } else {
                                  setSelectedProjectIds(prev => prev.filter(id => id !== p.id));
                                }
                              }}
                              className="rounded border-border"
                            />
                            {p.code}
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 text-xs px-2"
                          onClick={() => setCompanyProjectsMutation.mutate({ companyId: c.id, projectIds: selectedProjectIds })}
                          disabled={setCompanyProjectsMutation.isPending}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2"
                          onClick={() => setEditingCompanyId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 min-w-[80px]"
                      onClick={() => {
                        setEditingCompanyId(c.id);
                        setSelectedProjectIds(companyProjectsMap.get(c.id) || []);
                      }}
                    >
                      {(companyProjectsMap.get(c.id) || []).length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {(companyProjectsMap.get(c.id) || []).map(pid => {
                            const proj = projectsQuery.data?.find(p => p.id === pid);
                            return proj ? (
                              <Badge key={pid} variant="secondary" className="text-[10px] px-1 py-0">
                                {proj.code}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FolderKanban className="w-3 h-3" />
                          Sem projectos atribuídos
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={c.active ? "default" : "secondary"}>
                    {c.active ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const newName = prompt("Nome da empresa:", c.name); if (newName && newName !== c.name) updateCompanyMutation.mutate({ id: c.id, name: newName }); }} title="Editar">
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600" onClick={() => { if (confirm(`Desativar a empresa "${c.name}"? Os dados serão preservados.`)) updateCompanyMutation.mutate({ id: c.id, active: c.active ? 0 : 1 }); }} title={c.active ? "Desativar" : "Reativar"}>
                      {c.active ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => { if (confirm(`ELIMINAR PERMANENTEMENTE a empresa "${c.name}"? Esta ação é irreversível!`)) deleteCompanyMutation.mutate({ id: c.id }); }} title="Eliminar">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                    </div>
                </TableCell>
              </TableRow>
            ))}
            {visibleCompanies.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma empresa registada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Period Management & Weeks Without Work Buttons */}
        <div className="mt-4 flex gap-2">
          <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Calendar className="w-4 h-4 mr-1" /> {t("Períodos Activos")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("Períodos Activos por Empresa/Projeto")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Select value={String(periodProject)} onValueChange={v => setPeriodProject(Number(v))}>
                  <SelectTrigger><SelectValue placeholder={t("Selecione um projeto")} /></SelectTrigger>
                  <SelectContent>
                    {projectsQuery.data?.filter(p => p.code !== "main").map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.code} — {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {periodProject > 0 && companyPeriodsQuery.data && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Empresa")}</TableHead>
                        <TableHead>{t("Tipo")}</TableHead>
                        <TableHead>{t("Semana Início")}</TableHead>
                        <TableHead>{t("Semana Fim")}</TableHead>
                        <TableHead>{t("Buffer (semanas)")}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyPeriodsQuery.data.map(period => <CompanyPeriodRow key={period.id} period={period} saving={updatePeriodMutation.isPending} onSave={input => updatePeriodMutation.mutate(input)} />)}
                    </TableBody>
                  </Table>
                )}
                <p className="text-xs text-muted-foreground">{t("O buffer permite que a empresa submeta/corrija fichas durante X semanas após o fim dos trabalhos. Default: 4 semanas.")}</p>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={wwwDialogOpen} onOpenChange={setWwwDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><XCircle className="w-4 h-4 mr-1" /> {t("Semanas sem Trabalhos")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("Semanas sem Trabalhos")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Select value={String(wwwProject)} onValueChange={v => setWwwProject(Number(v))}>
                  <SelectTrigger><SelectValue placeholder={t("Selecione um projeto")} /></SelectTrigger>
                  <SelectContent>
                    {projectsQuery.data?.filter(p => p.code !== "main").map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.code} — {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {wwwProject > 0 && (
                  <>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="Semana" value={wwwWeek} onChange={e => setWwwWeek(e.target.value)} className="w-24" />
                      <Input type="number" placeholder="Ano" value={wwwYear} onChange={e => setWwwYear(e.target.value)} className="w-24" />
                      <Input placeholder={t("Motivo (ex: Natal)")} value={wwwReason} onChange={e => setWwwReason(e.target.value)} className="flex-1" />
                      <Button size="sm" onClick={() => addWwwMutation.mutate({ projectId: wwwProject, weekNumber: Number(wwwWeek), weekYear: Number(wwwYear), reason: wwwReason || null })} disabled={!wwwWeek || !wwwYear}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {(wwwListQuery.data as any[] || []).map((w: any) => (
                        <div key={w.id} className="flex items-center justify-between p-2 border rounded text-sm">
                          <span>S{w.weekNumber}/{w.weekYear} — {w.reason || "Sem motivo"}</span>
                          <Button variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => removeWwwMutation.mutate({ id: w.id })}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      ))}
                      {(!wwwListQuery.data || (wwwListQuery.data as any[]).length === 0) && <p className="text-xs text-muted-foreground text-center py-4">{t("Nenhuma semana sem trabalhos definida")}</p>}
                    </div>
                  </>
                )}
                <p className="text-xs text-muted-foreground">{t("Semanas marcadas como 'sem trabalhos' não contam como incumprimento na Matriz de Acompanhamento.")}</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {!isAllProjects && activeProject && (
          <CompanyRelationshipMap
            companies={visibleCompanies.map(company => ({
              id: company.id,
              name: company.name,
              shortName: company.shortName,
              companyType: company.companyType,
              active: company.active,
              parentCompanyId: company.parentCompanyId,
              allowKpi: company.allowKpi,
              allowWaste: company.allowWaste,
            }))}
            assignments={companyAssignmentsQuery.data || []}
            projects={projectsQuery.data || []}
            activeProjectId={activeProject.id}
          />
        )}
      </CardContent>
    </Card>
  );
}

function SubmissionsTab() {
  const { t } = useLanguage();
  const submissionsQuery = trpc.submissions.listAll.useQuery({});
  const companiesQuery = trpc.companies.list.useQuery();
  const companyMap = new Map(companiesQuery.data?.map((c) => [c.id, c]) || []);
  const [, setLocation] = useLocation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("Todas as Submissões")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>{t("Período")}</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>{t("Ações")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissionsQuery.data?.map((sub) => {
              const company = companyMap.get(sub.companyId);
              return (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">S{sub.weekNumber}/{sub.weekYear}</TableCell>
                  <TableCell>
                    {company?.companyType === "rap" ? "RAP - " : ""}{company?.shortName || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sub.weekStartDate} - {sub.weekEndDate}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[sub.status] || "secondary"}>
                      {STATUS_LABELS[sub.status] || sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setLocation(`/ficha/${sub.id}`)}>
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {submissionsQuery.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("Nenhuma submissão registada")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { activeProject, isAllProjects } = useProject();
  const usersQuery = trpc.users.list.useQuery();
  const companiesQuery = trpc.companies.list.useQuery();
  const invitationsQuery = trpc.invitations.list.useQuery();
  const projectsQuery = trpc.projects.list.useQuery();
  const userAssignmentsQuery = trpc.projects.allUserAssignments.useQuery();
  const companyAssignmentsQuery = trpc.projects.allCompanyAssignments.useQuery();
  const partnersQuery = trpc.partners.list.useQuery();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompanyId, setInviteCompanyId] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<string>("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingProjectsUserId, setEditingProjectsUserId] = useState<number | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [partnerConfig, setPartnerConfig] = useState<{
    userId: number;
    name: string;
    parentCompanyId: string;
    allowKpi: boolean;
    allowWaste: boolean;
    active: boolean;
    projectIds: number[];
  } | null>(null);
  const [pmConfig, setPmConfig] = useState<{
    userId: number;
    name: string;
    accessByProject: Array<{ projectId: number; modules: string[] }>;
  } | null>(null);
  const userProjectsMap = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const assignment of userAssignmentsQuery.data || []) {
      const existing = map.get(assignment.userId) || [];
      if (!existing.includes(assignment.projectId)) existing.push(assignment.projectId);
      map.set(assignment.userId, existing);
    }
    return map;
  }, [userAssignmentsQuery.data]);
  const pmModulesByUserProject = useMemo(() => new Map(
    (userAssignmentsQuery.data || []).map(assignment => [`${assignment.userId}-${assignment.projectId}`, assignment.accessModules || null]),
  ), [userAssignmentsQuery.data]);
  const scopedProjectId = isAllProjects ? null : activeProject?.id ?? null;
  const scopedCompanyIds = useMemo(() => new Set(
    scopedProjectId === null ? [] : (companyAssignmentsQuery.data || [])
      .filter(assignment => assignment.projectId === scopedProjectId)
      .map(assignment => assignment.companyId),
  ), [companyAssignmentsQuery.data, scopedProjectId]);
  const scopedCompanies = useMemo(() => {
    const companies = companiesQuery.data || [];
    return scopedProjectId === null ? companies : companies.filter(company => scopedCompanyIds.has(company.id));
  }, [companiesQuery.data, scopedCompanyIds, scopedProjectId]);
  const scopedUsers = useMemo(() => {
    const users = usersQuery.data || [];
    if (scopedProjectId === null) return users;
    return users.filter((candidate: any) =>
      scopedCompanyIds.has(candidate.companyId) ||
      (userProjectsMap.get(candidate.id) || []).includes(scopedProjectId) ||
      ["admin", "dono_obra", "raa"].includes(candidate.role),
    );
  }, [scopedCompanyIds, scopedProjectId, userProjectsMap, usersQuery.data]);
  const scopedInvitations = useMemo(() => {
    const invitations = invitationsQuery.data || [];
    return scopedProjectId === null ? invitations : invitations.filter(invitation => scopedCompanyIds.has(invitation.companyId));
  }, [invitationsQuery.data, scopedCompanyIds, scopedProjectId]);
  const scopedPartners = useMemo(() => {
    const partners = partnersQuery.data || [];
    return scopedProjectId === null ? partners : partners.filter((partner: any) => (partner.projectIds || []).includes(scopedProjectId));
  }, [partnersQuery.data, scopedProjectId]);

  // Filtered and paginated users
  const filteredUsers = useMemo(() => {
    const data = scopedUsers;
    return data.filter((u: any) => {
      const matchSearch = !searchTerm || u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = filterRole === "all" || u.role === filterRole;
      const matchProject = scopedProjectId !== null || filterProject === "all" || (userProjectsMap.get(u.id) || []).includes(Number(filterProject));
      const matchCompany = filterCompany === "all" || String(u.companyId) === filterCompany;
      return matchSearch && matchRole && matchProject && matchCompany;
    });
  }, [scopedUsers, searchTerm, filterRole, filterProject, filterCompany, scopedProjectId, userProjectsMap]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage, PAGE_SIZE]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterRole, filterProject, filterCompany, scopedProjectId]);

  const deleteUserMutation = trpc.auth.deleteUser.useMutation({
    onSuccess: () => { toast.success(t("Utilizador eliminado")); setDeleteUserId(null); setDeleteConfirmName(""); usersQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const assignCompanyMutation = trpc.users.assignCompany.useMutation({
    onSuccess: () => {
      toast.success(t("Empresa atribuída"));
      utils.users.list.invalidate();
    },
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Papel atualizado");
      utils.users.list.invalidate();
    },
  });

  const configurePartnerMutation = trpc.partners.configure.useMutation({
    onSuccess: async () => {
      toast.success("Acesso da EEP actualizado");
      setPartnerConfig(null);
      await Promise.all([
        utils.partners.list.invalidate(),
        utils.projects.allUserAssignments.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const configurePmAccessMutation = trpc.projects.setPmAccessModules.useMutation({
    onSuccess: async () => {
      toast.success("Acesso do PM actualizado");
      setPmConfig(null);
      await utils.projects.allUserAssignments.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const createInviteMutation = trpc.invitations.create.useMutation({
    onSuccess: () => {
      toast.success(t("Convite enviado com sucesso"));
      utils.invitations.list.invalidate();
      setInviteEmail("");
      setInviteCompanyId("");
      setInviteRole("");
      setShowInviteDialog(false);
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao criar convite");
    },
  });

  const deleteInviteMutation = trpc.invitations.delete.useMutation({
    onSuccess: () => {
      toast.success(t("Convite removido"));
      utils.invitations.list.invalidate();
    },
  });

  const setUserProjectsMutation = trpc.projects.setUserProjects.useMutation({
    onSuccess: () => {
      toast.success("Projetos atualizados");
      utils.projects.allUserAssignments.invalidate();
      setEditingProjectsUserId(null);
    },
  });

  const handleInvite = () => {
    if (!inviteEmail || !inviteCompanyId || !inviteRole) {
      toast.error("Preencha todos os campos");
      return;
    }
    createInviteMutation.mutate({
      email: inviteEmail,
      companyId: Number(inviteCompanyId),
      role: inviteRole as any,
    });
  };

  const eeCompanies = scopedCompanies.filter(company => company.companyType === "ee");
  const parentProjectIds = new Set(
    (companyAssignmentsQuery.data ?? [])
      .filter(item => String(item.companyId) === partnerConfig?.parentCompanyId)
      .map(item => item.projectId),
  );
  const partnerSelectableProjects = (projectsQuery.data ?? []).filter(project => parentProjectIds.has(project.id));
  const pmUsers = scopedUsers.filter((candidate: any) => candidate.role === "pm");

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-emerald-700" />
            EEP — Entidades Executantes Parceiras
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cada parceiro pertence a uma EE principal e só pode usar KPI e/ou Resíduos nos projectos seleccionados dentro do âmbito dessa EE.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {scopedPartners.map((partner: any) => (
            <div key={partner.id} className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{partner.name || partner.email}</p>
                <p className="text-xs text-muted-foreground">
                  {partner.companyName || "Sem empresa parceira"} → EE principal: {partner.parentCompanyName || "Por configurar"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {partner.allowKpi && <Badge variant="secondary">KPI</Badge>}
                  {partner.allowWaste && <Badge variant="secondary">Resíduos</Badge>}
                  {(partner.projects ?? []).map((project: any) => <Badge key={project.id} variant="outline">{project.code}</Badge>)}
                  {!partner.active && <Badge variant="destructive">Inactivo</Badge>}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPartnerConfig({
                  userId: partner.id,
                  name: partner.name || partner.email || "EEP",
                  parentCompanyId: partner.parentCompanyId ? String(partner.parentCompanyId) : "",
                  allowKpi: !!partner.allowKpi,
                  allowWaste: !!partner.allowWaste,
                  active: !!partner.active,
                  projectIds: partner.projectIds ?? [],
                })}
              >
                <Settings2 className="mr-2 size-4" /> Configurar
              </Button>
            </div>
          ))}
          {!partnersQuery.isLoading && scopedPartners.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Crie uma empresa do tipo EEP e atribua o papel Entidade Executante Parceira a um utilizador para configurar o acesso.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!partnerConfig} onOpenChange={open => !open && setPartnerConfig(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar EEP — Entidade Executante Parceira</DialogTitle>
          </DialogHeader>
          {partnerConfig && (
            <div className="space-y-5">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="font-medium">{partnerConfig.name}</p>
                <p className="text-xs text-muted-foreground">Os projectos disponíveis são sempre limitados aos projectos da EE principal.</p>
              </div>
              <div className="space-y-2">
                <Label>EE principal</Label>
                <Select value={partnerConfig.parentCompanyId} onValueChange={value => setPartnerConfig(current => current ? { ...current, parentCompanyId: value, projectIds: [] } : current)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar a EE responsável" /></SelectTrigger>
                  <SelectContent>
                    {eeCompanies.map(company => <SelectItem key={company.id} value={String(company.id)}>{company.shortName} — {company.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                  <input type="checkbox" checked={partnerConfig.allowKpi} onChange={event => setPartnerConfig(current => current ? { ...current, allowKpi: event.target.checked } : current)} />
                  <div><p className="text-sm font-medium">KPI</p><p className="text-xs text-muted-foreground">Submissões parciais semanais</p></div>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                  <input type="checkbox" checked={partnerConfig.allowWaste} onChange={event => setPartnerConfig(current => current ? { ...current, allowWaste: event.target.checked } : current)} />
                  <div><p className="text-sm font-medium">Resíduos</p><p className="text-xs text-muted-foreground">e-GAR por subprojecto</p></div>
                </label>
              </div>
              <div className="space-y-2">
                <Label>Projectos autorizados</Label>
                <div className="grid max-h-52 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
                  {partnerSelectableProjects.map(project => (
                    <label key={project.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={partnerConfig.projectIds.includes(project.id)}
                        onChange={event => setPartnerConfig(current => current ? {
                          ...current,
                          projectIds: event.target.checked ? [...current.projectIds, project.id] : current.projectIds.filter(id => id !== project.id),
                        } : current)}
                      />
                      {project.code} — {project.name}
                    </label>
                  ))}
                  {partnerConfig.parentCompanyId && partnerSelectableProjects.length === 0 && <p className="text-xs text-muted-foreground">A EE principal ainda não tem projectos atribuídos.</p>}
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={partnerConfig.active} onChange={event => setPartnerConfig(current => current ? { ...current, active: event.target.checked } : current)} />
                Acesso activo
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPartnerConfig(null)}>Cancelar</Button>
                <Button
                  disabled={configurePartnerMutation.isPending || !partnerConfig.parentCompanyId || (partnerConfig.active && (!partnerConfig.allowKpi && !partnerConfig.allowWaste))}
                  onClick={() => configurePartnerMutation.mutate({
                    userId: partnerConfig.userId,
                    parentCompanyId: Number(partnerConfig.parentCompanyId),
                    allowKpi: partnerConfig.allowKpi,
                    allowWaste: partnerConfig.allowWaste,
                    active: partnerConfig.active,
                    projectIds: partnerConfig.projectIds,
                  })}
                >
                  {configurePartnerMutation.isPending ? "A guardar..." : "Guardar acesso"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-sky-200 bg-sky-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4 text-sky-700" />PM — Gestão de Projeto</CardTitle>
          <p className="text-xs text-muted-foreground">O PM consulta o processo completo nos projetos atribuídos. A Administração pode restringir módulos por projeto sem lhe atribuir poderes de aprovação ou administração.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {pmUsers.map((pm: any) => {
            const projectIds = userProjectsMap.get(pm.id) || [];
            return <div key={pm.id} className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{pm.name || pm.email}</p>
                <p className="text-xs text-muted-foreground">Consulta de dashboards, fichas, indicadores, resíduos, planos, documentação e acompanhamento, dentro do âmbito configurado.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {projectIds.map(projectId => {
                    const project = projectsQuery.data?.find(item => item.id === projectId);
                    const modules = parsePmModuleIds(pmModulesByUserProject.get(`${pm.id}-${projectId}`));
                    return project ? <Badge key={projectId} variant="outline">{project.code} · {modules.length === DEFAULT_PM_MODULE_IDS.length ? "processo completo" : `${modules.length} módulos`}</Badge> : null;
                  })}
                  {projectIds.length === 0 && <Badge variant="secondary">Sem projetos atribuídos</Badge>}
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={projectIds.length === 0} onClick={() => setPmConfig({ userId: pm.id, name: pm.name || pm.email || "PM", accessByProject: projectIds.map(projectId => ({ projectId, modules: parsePmModuleIds(pmModulesByUserProject.get(`${pm.id}-${projectId}`)) })) })}>
                <Settings2 className="mr-2 size-4" />Configurar acesso
              </Button>
            </div>;
          })}
          {!usersQuery.isLoading && pmUsers.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Não existem PM no âmbito atual.</p>}
        </CardContent>
      </Card>

      <Dialog open={!!pmConfig} onOpenChange={open => !open && setPmConfig(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Configurar acesso do PM</DialogTitle></DialogHeader>
          {pmConfig && <div className="space-y-5">
            <div className="rounded-lg bg-muted/50 p-3"><p className="font-medium">{pmConfig.name}</p><p className="text-xs text-muted-foreground">A seleção controla a consulta por módulo em cada projeto. A aprovação de fichas e a administração mantêm-se separadas e não são atribuídas ao PM.</p></div>
            {pmConfig.accessByProject.map(access => {
              const project = projectsQuery.data?.find(item => item.id === access.projectId);
              return <section key={access.projectId} className="rounded-lg border p-4"><div className="mb-3"><p className="font-medium">{project?.code || `Projeto ${access.projectId}`}</p><p className="text-xs text-muted-foreground">Selecione os módulos de consulta deste projeto.</p></div><div className="grid gap-2 sm:grid-cols-2">{PM_MODULE_OPTIONS.map(module => <label key={module.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"><input type="checkbox" checked={access.modules.includes(module.id)} onChange={event => setPmConfig(current => current ? { ...current, accessByProject: current.accessByProject.map(item => item.projectId !== access.projectId ? item : { ...item, modules: event.target.checked ? [...item.modules, module.id] : item.modules.filter(id => id !== module.id) }) } : current)} />{module.label}</label>)}</div></section>;
            })}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPmConfig(null)}>Cancelar</Button><Button disabled={configurePmAccessMutation.isPending || pmConfig.accessByProject.some(item => item.modules.length === 0)} onClick={() => configurePmAccessMutation.mutate({ userId: pmConfig.userId, accessByProject: pmConfig.accessByProject as any })}>{configurePmAccessMutation.isPending ? "A guardar..." : "Guardar acesso"}</Button></div>
          </div>}
        </DialogContent>
      </Dialog>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder={t("Pesquisar") + " (nome, email)"}
            value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full"
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="all">{t("Todos")} Roles</option>
          <option value="admin">Admin</option>
          <option value="dono_obra">Dono de Obra</option>
          <option value="pm">PM</option>
          <option value="ee">EE</option>
          <option value="ee_partner">EEP — Entidade Executante Parceira</option>
          <option value="rap">RAP</option>
          <option value="raa">RAA</option>
          <option value="observador">Observador</option>
        </select>
        {isAllProjects && <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="all">{t("Todos")} {t("Projetos")}</option>
          {projectsQuery.data?.map((p: any) => (
            <option key={p.id} value={String(p.id)}>{p.code}</option>
          ))}
        </select>}
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
        >
          <option value="all">{t("Todas")} {t("Empresas")}</option>
          {scopedCompanies.map((c: any) => (
            <option key={c.id} value={String(c.id)}>{c.shortName} ({c.companyType.toUpperCase()})</option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">{filteredUsers.length} {t("Utilizadores")}</span>
      </div>
      {/* Invite User Button + Dialog */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("Utilizadores")}</CardTitle>
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Convidar Utilizador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("Convidar Novo Utilizador")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@empresa.pt"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select value={inviteCompanyId} onValueChange={setInviteCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {scopedCompanies.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.shortName} ({c.companyType.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ee">EE — Entidade Executante</SelectItem>
                      <SelectItem value="ee_partner">EEP — Entidade Executante Parceira</SelectItem>
                      <SelectItem value="rap">RAP — Resp. Acomp. Patrimonial</SelectItem>
                      <SelectItem value="raa">RAA — Resp. Acomp. Ambiental</SelectItem>
                      <SelectItem value="dono_obra">Dono de Obra</SelectItem>
                      <SelectItem value="pm">PM — Gestor de Projeto</SelectItem>
                      <SelectItem value="observador">Observador</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quando esta pessoa fizer login pela primeira vez com este email, será automaticamente associada à empresa e papel selecionados.
                </p>
                <Button onClick={handleInvite} className="w-full" disabled={createInviteMutation.isPending}>
                  {createInviteMutation.isPending ? "A enviar..." : "Enviar Convite"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
               <TableHead>Papel</TableHead>
               <TableHead>Empresa</TableHead>
               <TableHead>Projetos</TableHead>
                <TableHead>Fases</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name || "-"}
                    {u.role === "admin" && <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">ADMIN</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email || "-"}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(v) => updateRoleMutation.mutate({ userId: u.id, role: v as any })}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Utilizador</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="ee">EE</SelectItem>
                        <SelectItem value="ee_partner">EEP — Entidade Executante Parceira</SelectItem>
                        <SelectItem value="raa">RAA</SelectItem>
                        <SelectItem value="rap">RAP</SelectItem>
                        <SelectItem value="dono_obra">Dono de Obra</SelectItem>
                      <SelectItem value="pm">PM — Gestor de Projeto</SelectItem>
                        <SelectItem value="observador">Observador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.companyId ? String(u.companyId) : "none"}
                      onValueChange={(v) => assignCompanyMutation.mutate({ userId: u.id, companyId: v === "none" ? null : Number(v) })}
                    >
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue placeholder="Sem empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem empresa</SelectItem>
                        {companiesQuery.data?.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.companyType === "rap" ? "RAP - " : ""}{c.shortName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {editingProjectsUserId === u.id ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {projectsQuery.data?.filter(p => p.code !== "main" && p.code !== "SIN01-NEST").map(p => (
                            <label key={p.id} className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedProjectIds.includes(p.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProjectIds(prev => [...prev, p.id]);
                                  } else {
                                    setSelectedProjectIds(prev => prev.filter(id => id !== p.id));
                                  }
                                }}
                                className="rounded border-border"
                              />
                              {p.code}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-6 text-xs px-2"
                            onClick={() => setUserProjectsMutation.mutate({ userId: u.id, projectIds: selectedProjectIds })}
                            disabled={setUserProjectsMutation.isPending}
                          >
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={() => setEditingProjectsUserId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 min-w-[80px]"
                        onClick={() => {
                          setEditingProjectsUserId(u.id);
                          setSelectedProjectIds(userProjectsMap.get(u.id) || []);
                        }}
                      >
                        {(userProjectsMap.get(u.id) || []).length > 0 ? (
                          <div className="flex flex-wrap gap-0.5">
                            {(userProjectsMap.get(u.id) || []).map(pid => {
                              const proj = projectsQuery.data?.find(p => p.id === pid);
                              return proj ? (
                                <Badge key={pid} variant="secondary" className="text-[10px] px-1 py-0">
                                  {proj.code}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                           <FolderKanban className="w-3 h-3" />
                           Todos
                         </span>
                       )}
                     </div>
                   )}
                 </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-0.5">
                      {(u.role === "admin" || u.role === "dono_obra" || u.role === "raa") ? (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 dark:bg-green-900/20 text-green-700">Todas</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{t("Construção")}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.role !== "admin" && user?.role === "admin" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteUserId(u.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 mb-4 px-2">
          <span className="text-sm text-muted-foreground">
            {filteredUsers.length} {t("Utilizadores")} · {t("Página")} {currentPage} {t("de")} {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              {t("Anterior")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
              {t("Próximo")}
            </Button>
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {scopedInvitations.filter((i) => i.status === "pending").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Convites Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scopedInvitations.filter((i) => i.status === "pending").map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>{inv.companyName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABELS[inv.role] || inv.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString("pt-PT")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteInviteMutation.mutate({ id: inv.id })}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {deleteUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setDeleteUserId(null); setDeleteConfirmName(""); }}>
          <div className="bg-background rounded-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2 text-destructive">{t("Eliminar Utilizador")}</h3>
            <p className="text-sm text-muted-foreground mb-4">Tem a certeza?</p>
            <p className="text-sm mb-2">Escreva o nome para confirmar:</p>
            <Input value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)} placeholder="Nome completo" className="mb-4" />
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" onClick={() => deleteUserMutation.mutate({ userId: deleteUserId!, confirmName: deleteConfirmName })} disabled={!deleteConfirmName || deleteUserMutation.isPending}>{t("Confirmar")}</Button>
              <Button variant="outline" className="flex-1" onClick={() => { setDeleteUserId(null); setDeleteConfirmName(""); }}>{t("Cancelar")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoricalTab() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const companiesQuery = trpc.companies.list.useQuery();
  const historicalQuery = trpc.historical.list.useQuery({});
  const uploadMutation = trpc.historical.upload.useMutation({
    onSuccess: () => {
      toast.success(t("PDF histórico carregado com sucesso"));
      utils.historical.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [weekNumber, setWeekNumber] = useState<string>("");
  const [weekYear, setWeekYear] = useState<string>(String(new Date().getFullYear()));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedCompany || !weekNumber || !weekYear) {
      toast.error("Preencha todos os campos e selecione um ficheiro.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        companyId: Number(selectedCompany),
        weekNumber: Number(weekNumber),
        weekYear: Number(weekYear),
        filename: file.name,
        mimeType: file.type || "application/pdf",
        data: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Carregar Ficha Histórica (PDF)")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Empresa</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {companiesQuery.data?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.companyType === "rap" ? "RAP - " : ""}{c.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Semana</Label>
              <Input type="number" min={1} max={53} value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} placeholder="Ex: 32" />
            </div>
            <div>
              <Label>Ano</Label>
              <Input type="number" min={2020} max={2030} value={weekYear} onChange={(e) => setWeekYear(e.target.value)} />
            </div>
            <div>
              <Label>Ficheiro PDF</Label>
              <Input type="file" accept=".pdf" ref={fileInputRef} />
            </div>
          </div>
          <Button className="mt-4" onClick={handleUpload} disabled={uploadMutation.isPending}>
            <FileUp className="w-4 h-4 mr-2" />
            {uploadMutation.isPending ? "A carregar..." : "Carregar PDF"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Fichas Históricas")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Ficheiro</TableHead>
                <TableHead>Data Upload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historicalQuery.data?.map((h) => {
                const company = companiesQuery.data?.find((c) => c.id === h.companyId);
                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">S{h.weekNumber}/{h.weekYear}</TableCell>
                    <TableCell>{company?.companyType === "rap" ? "RAP - " : ""}{company?.shortName || "-"}</TableCell>
                    <TableCell>
                      <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                        {h.filename || "PDF"}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(h.uploadedAt).toLocaleDateString("pt-PT")}
                    </TableCell>
                  </TableRow>
                );
              })}
              {historicalQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("Nenhuma ficha histórica carregada")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MelhoriasTab() {
  const { t } = useLanguage();
  const { data: feedbacks, refetch } = trpc.feedback.list.useQuery();
  const updateMutation = trpc.feedback.updateStatus.useMutation({ onSuccess: () => refetch() });
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t("Feedback e Melhorias dos Utilizadores")}</h3>
      {!feedbacks || feedbacks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t("Sem feedback recebido")}</p>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((fb: any) => (
            <div key={fb.id} className={`border rounded-lg p-4 ${fb.status === "implementado" ? "border-green-200 bg-green-50/30" : fb.status === "rejeitado" ? "border-red-200 bg-red-50/30" : "border-border"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{fb.userName || fb.userEmail || "Anónimo"}</p>
                  <p className="text-xs text-muted-foreground">{fb.createdAt ? new Date(fb.createdAt).toLocaleDateString("pt-PT") : ""}</p>
                </div>
                <select className="text-xs border rounded px-2 py-1" value={fb.status || "pendente"} onChange={e => updateMutation.mutate({ id: fb.id, status: e.target.value })}>
                  <option value="pendente">Pendente</option>
                  <option value="em_analise">{t("Em Análise")}</option>
                  <option value="implementado">Implementado</option>
                  <option value="rejeitado">Rejeitado</option>
                </select>
              </div>
              <p className="text-sm mt-2">{fb.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EEP Requests Admin Tab ─────────────────────────────────────────────────
function EepRequestsAdminTab() {
  const requests = trpc.eepRequests.list.useQuery();
  const companies = trpc.companies.list.useQuery();
  const projects = trpc.projects.list.useQuery();
  const approve = trpc.eepRequests.approve.useMutation({ onSuccess: () => { toast.success("Pedido EEP aprovado e convites criados"); requests.refetch(); }, onError: error => toast.error(error.message) });
  const reject = trpc.eepRequests.reject.useMutation({ onSuccess: () => { toast.success("Pedido EEP rejeitado"); requests.refetch(); }, onError: error => toast.error(error.message) });
  const statusLabel: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado", cancelled: "Cancelado" };
  const projectCodes = (json: string) => {
    try { return (JSON.parse(json) as number[]).map(id => projects.data?.find(project => project.id === id)?.code || String(id)); } catch { return []; }
  };

  return (
    <div className="space-y-4">
      {requests.data?.map(request => (
        <Card key={request.id}>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2"><h3 className="font-semibold">{request.shortName} — {request.companyName}</h3><Badge variant={request.status === "approved" ? "default" : request.status === "rejected" ? "destructive" : "secondary"}>{statusLabel[request.status]}</Badge></div>
                <p className="text-sm text-muted-foreground">Responde a <strong>{companies.data?.find(company => company.id === request.parentCompanyId)?.shortName || request.parentCompanyId}</strong> · {[request.allowKpi && "KPI", request.allowWaste && "Resíduos"].filter(Boolean).join(" + ")}</p>
                <div className="flex flex-wrap gap-1">{projectCodes(request.projectIdsJson).map(code => <Badge key={code} variant="outline">{code}</Badge>)}</div>
                <div className="text-sm"><p className="font-medium">Utilizadores a convidar</p>{request.requestedUsers.map(item => <p key={item.id} className="text-muted-foreground">{item.fullName} · {item.email}</p>)}</div>
                {request.reviewNotes && <p className="rounded bg-muted p-2 text-xs">{request.reviewNotes}</p>}
              </div>
              {request.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: request.id })}><CheckCircle2 className="mr-1 h-4 w-4" />Aprovar</Button>
                  <Button size="sm" variant="destructive" disabled={reject.isPending} onClick={() => { const notes = prompt("Motivo da rejeição:"); if (notes?.trim()) reject.mutate({ id: request.id, notes: notes.trim() }); }}><XCircle className="mr-1 h-4 w-4" />Rejeitar</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {requests.data?.length === 0 && <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Não existem pedidos EEP.</CardContent></Card>}
    </div>
  );
}

// ─── Pending Accounts Tab ───────────────────────────────────────────────────
function PendingAccountsTab() {
  const { t } = useLanguage();
  const pendingQuery = trpc.auth.pendingAccounts.useQuery();
  const approveMutation = trpc.auth.approveAccount.useMutation({
    onSuccess: () => { pendingQuery.refetch(); },
  });
  const pending = (pendingQuery.data || []) as any[];
  if (pending.length === 0) return <div className="text-center py-8 text-muted-foreground">Nenhum pedido de acesso pendente.</div>;
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Pedidos de Acesso Pendentes</h3>
      {pending.map((p: any) => (
        <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">{p.name}</p>
            <p className="text-sm text-muted-foreground">{p.email}</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700" onClick={() => approveMutation.mutate({ userId: p.id, approve: true })}>{t("Aprovar")}</button>
            <button className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700" onClick={() => approveMutation.mutate({ userId: p.id, approve: false })}>{t("Rejeitar")}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmailConfigTab() {
  const { t } = useLanguage();
  const settingsQuery = trpc.appSettings.getAll.useQuery();
  const updateMutation = trpc.appSettings.update.useMutation({
    onSuccess: () => settingsQuery.refetch(),
    onError: (e: any) => toast.error(e.message),
  });
  const settings = settingsQuery.data || {};
  const [smtpHost, setSmtpHost] = useState(settings.email_smtp_host || "");
  const [smtpPort, setSmtpPort] = useState(settings.email_smtp_port || "587");
  const [smtpUser, setSmtpUser] = useState(settings.email_smtp_user || "");
  const [smtpPass, setSmtpPass] = useState(settings.email_smtp_pass || "");
  const [fromEmail, setFromEmail] = useState(settings.email_from || "apoioamb@startcampus.pt");
  const [fromName, setFromName] = useState(settings.email_from_name || "Plataforma de Gestão Ambiental - Start Campus");
  const [enabled, setEnabled] = useState(settings.email_enabled === "true");

  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data;
      setSmtpHost(s.email_smtp_host || "");
      setSmtpPort(s.email_smtp_port || "587");
      setSmtpUser(s.email_smtp_user || "");
      setSmtpPass(s.email_smtp_pass || "");
      setFromEmail(s.email_from || "apoioamb@startcampus.pt");
      setFromName(s.email_from_name || "Plataforma de Gestão Ambiental - Start Campus");
      setEnabled(s.email_enabled === "true");
    }
  }, [settingsQuery.data]);

  const handleSave = async () => {
    const pairs: [string, string][] = [
      ["email_smtp_host", smtpHost], ["email_smtp_port", smtpPort],
      ["email_smtp_user", smtpUser], ["email_smtp_pass", smtpPass],
      ["email_from", fromEmail], ["email_from_name", fromName],
      ["email_enabled", enabled ? "true" : "false"],
    ];
    for (const [key, value] of pairs) {
      await updateMutation.mutateAsync({ key, value });
    }
    toast.success(t("Configuração de email guardada com sucesso"));
  };

  return (
    <div className="space-y-4">
      {/* Enable/Disable toggle card */}
      <Card className={`border-2 transition-colors ${enabled ? 'border-green-500 dark:border-green-600' : 'border-muted'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                <span className="text-lg">{enabled ? '✅' : '📧'}</span>
              </div>
              <div>
                <p className="font-semibold text-sm">{t("Notificações por Email")}</p>
                <p className="text-xs text-muted-foreground">{enabled ? t("Ativo — o sistema envia emails automáticos") : t("Inativo — nenhum email será enviado")}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* SMTP Server Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">🔧 {t("Servidor SMTP")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("Configuração técnica — a equipa de IT fornece estes dados")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">{t("Servidor")}</Label><Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.office365.com" className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("Porta")}</Label><Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("Utilizador")}</Label><Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="apoioamb@startcampus.pt" className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("Palavra-passe")}</Label><Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" className="h-9" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Sender Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">📨 {t("Remetente")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">{t("Email de envio")}</Label><Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="apoioamb@startcampus.pt" className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("Nome do remetente")}</Label><Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder={t("Plataforma de Gestão Ambiental")} className="h-9" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Notification types info */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="font-medium text-sm mb-3">{t("Emails automáticos enviados pelo sistema")}:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-start gap-2 text-xs p-2 rounded bg-background border">
              <span className="text-green-600 mt-0.5">📤</span>
              <div><span className="font-medium">{t("Ficha submetida")}</span><br/><span className="text-muted-foreground">{t("Notifica RAA, Admin e Dono de Obra")}</span></div>
            </div>
            <div className="flex items-start gap-2 text-xs p-2 rounded bg-background border">
              <span className="text-blue-600 mt-0.5">✅</span>
              <div><span className="font-medium">{t("Ficha aprovada/rejeitada")}</span><br/><span className="text-muted-foreground">{t("Notifica o submitter")}</span></div>
            </div>
            <div className="flex items-start gap-2 text-xs p-2 rounded bg-background border">
              <span className="text-purple-600 mt-0.5">👤</span>
              <div><span className="font-medium">{t("Convite de utilizador")}</span><br/><span className="text-muted-foreground">{t("Email com link de acesso e credenciais")}</span></div>
            </div>
            <div className="flex items-start gap-2 text-xs p-2 rounded bg-background border">
              <span className="text-red-600 mt-0.5">🔒</span>
              <div><span className="font-medium">{t("Acesso não autorizado")}</span><br/><span className="text-muted-foreground">{t("Notifica o administrador")}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={handleSave} disabled={updateMutation.isPending} size="lg" className="w-full gap-2">
        {updateMutation.isPending ? t("A guardar...") : t("Guardar Configuração")}
      </Button>
    </div>
  );
}

function NotificationRecipientsTab() {
  const { t } = useLanguage();
  const projectsQuery = trpc.projects.list.useQuery();
  const usersQuery = trpc.users.list.useQuery();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const recipientsQuery = trpc.notificationRecipients.list.useQuery(
    { projectId: selectedProject! },
    { enabled: !!selectedProject }
  );

  const addMutation = trpc.notificationRecipients.add.useMutation({
    onSuccess: () => {
      recipientsQuery.refetch();
      setSelectedUser("");
      toast.success(t("Destinatário adicionado com sucesso"));
    },
    onError: () => toast.error(t("Erro ao adicionar destinatário")),
  });

  const removeMutation = trpc.notificationRecipients.remove.useMutation({
    onSuccess: () => {
      recipientsQuery.refetch();
      toast.success(t("Destinatário removido"));
    },
  });

  const projects = projectsQuery.data || [];
  const users = (usersQuery.data || []) as any[];
  const recipients = (recipientsQuery.data || []) as any[];

  const typeLabels: Record<string, string> = {
    submission: t("Novas Submissões"),
    approval: t("Aprovações"),
    rejection: t("Rejeições"),
    all: t("Todas as Notificações"),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔔 {t("Destinatários de Notificações por Projeto")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("Defina quem recebe emails quando fichas são submetidas, aprovadas ou rejeitadas em cada projeto.")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Project selector */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">{t("Projeto")}</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={selectedProject || ""}
              onChange={(e) => setSelectedProject(Number(e.target.value) || null)}
            >
              <option value="">{t("Selecione um projeto...")}</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedProject && (
          <>
            {/* Add recipient */}
            <div className="flex gap-3 items-end border-t pt-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">{t("Utilizador")}</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">{t("Selecione um utilizador...")}</option>
                  {users
                    .filter((u) => u.role === "raa" || u.role === "admin" || u.role === "dono_obra" || u.role === "pm")
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email} ({u.role?.toUpperCase()})</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t("Tipo")}</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="all">{t("Todas as Notificações")}</option>
                  <option value="submission">{t("Novas Submissões")}</option>
                  <option value="approval">{t("Aprovações")}</option>
                  <option value="rejection">{t("Rejeições")}</option>
                </select>
              </div>
              <Button
                size="sm"
                disabled={!selectedUser || addMutation.isPending}
                onClick={() => {
                  if (selectedUser) {
                    addMutation.mutate({
                      projectId: selectedProject,
                      userId: Number(selectedUser),
                      notificationType: selectedType as any,
                    });
                  }
                }}
              >
                {t("Adicionar")}
              </Button>
            </div>

            {/* Recipients list */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">
                {t("Destinatários configurados")} ({recipients.length})
              </h4>
              {recipients.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("Sem destinatários configurados. Quando uma ficha for submetida, todos os utilizadores RAA/Admin/DO serão notificados por defeito.")}
                </p>
              )}
              <div className="space-y-2">
                {recipients.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="text-sm font-medium">{r.userName || r.userEmail}</p>
                      <p className="text-xs text-muted-foreground">{r.userEmail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {typeLabels[r.notificationType] || r.notificationType}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => removeMutation.mutate({ id: r.id })}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
