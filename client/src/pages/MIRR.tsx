import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Download, Upload, Recycle, Settings, X } from "lucide-react";
import ExcelJS from "exceljs";

const DEFAULT_LER_CODES = [
  { code: "20107", name: "Resíduos Verdes", hazardous: false },
  { code: "80111", name: "Tintas e vernizes (perigoso)", hazardous: true },
  { code: "110111", name: "Líquidos de lavagem aquosos (perigoso)", hazardous: true },
  { code: "130701", name: "Fuelóleo e gasóleo", hazardous: true },
  { code: "130899", name: "Óleos usados", hazardous: true },
  { code: "150101", name: "Embalagens de papel e cartão", hazardous: false },
  { code: "150102", name: "Embalagens de plástico", hazardous: false },
  { code: "150103", name: "Embalagens de madeira", hazardous: false },
  { code: "150105", name: "Embalagens compósitas", hazardous: false },
  { code: "150110", name: "Embalagens com resíduos perigosos", hazardous: true },
  { code: "150111", name: "Embalagens metálicas (perigoso)", hazardous: true },
  { code: "150202", name: "Absorventes contaminados (perigoso)", hazardous: true },
  { code: "150203", name: "Absorventes não perigosos", hazardous: false },
  { code: "160103", name: "Pneus usados", hazardous: false },
  { code: "160216", name: "Toners", hazardous: false },
  { code: "170101", name: "Betão", hazardous: false },
  { code: "170107", name: "Misturas de betão/tijolos/telhas", hazardous: false },
  { code: "170201", name: "Madeira", hazardous: false },
  { code: "170203", name: "Plástico", hazardous: false },
  { code: "170301", name: "Misturas betuminosas (perigoso)", hazardous: true },
  { code: "170302", name: "Misturas betuminosas não perigosas", hazardous: false },
  { code: "170405", name: "Ferro e aço", hazardous: false },
  { code: "170411", name: "Cabos", hazardous: false },
  { code: "170503", name: "Solos com substâncias perigosas", hazardous: true },
  { code: "170604", name: "Material de isolamento", hazardous: false },
  { code: "170802", name: "Materiais à base de gesso", hazardous: false },
  { code: "170904", name: "Resíduos mistos de C&D", hazardous: false },
  { code: "200108", name: "Resíduos biodegradáveis de cozinha", hazardous: false },
  { code: "160214", name: "Equipamentos descartados", hazardous: false },
  { code: "200101", name: "Papel e cartão", hazardous: false },
  { code: "200301", name: "Resíduos sólidos urbanos", hazardous: false },
  { code: "200307", name: "Monstros (resíduos volumosos)", hazardous: false },
];

const DEFAULT_DESTINATIONS = [
  { key: "recycled", label: "Reciclagem", operation: "R13" },
  { key: "incinerated", label: "Incineração/Valorização Energética", operation: "R1" },
  { key: "landfill", label: "Aterro/Eliminação", operation: "D1" },
];

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function MIRR() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeProject } = useProject();
  const [location] = useLocation();
  const isMIRRPage = location === "/mirr";
  const pageTitle = isMIRRPage ? "MIRR" : t("Gestão de Resíduos");
  const pageSubtitle = isMIRRPage ? "Mapa Integrado de Registo de Resíduos — Operação" : "Gestão e rastreio de resíduos de construção";
  const [subProject, setSubProject] = useState("all");
  const [newSubProject, setNewSubProject] = useState("");
  const projectId = activeProject?.id;
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWasteMapCompanies, setSelectedWasteMapCompanies] = useState<number[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lerCodes, setLerCodes] = useState(DEFAULT_LER_CODES);
  const [destinations, setDestinations] = useState(DEFAULT_DESTINATIONS);
  const [newLer, setNewLer] = useState({ code: "", name: "", hazardous: false });
  const [newDest, setNewDest] = useState({ key: "", label: "", operation: "" });
  const [newEgar, setNewEgar] = useState({
    date: "", egarId: "", egarLink: "",
    operatorTransport: "", operatorTransportAPA: "",
    operatorReception: "", operatorReceptionAPA: "",
    lerCode: "", designation: "", quantity: "", correctedQuantity: "",
    destination: "recycled", month: new Date().getMonth() + 1, year: new Date().getFullYear()
  });

  const isPartner = user?.role === "ee_partner";
  const partnerAccessQuery = trpc.partners.myAccess.useQuery(undefined, { enabled: isPartner });
  const { data: subProjects, refetch: refetchSubprojects } = trpc.wasteEgars.subprojects.useQuery(
    { projectId: projectId || 0 },
    { enabled: !!projectId }
  );
  const { data: egars, refetch } = trpc.wasteEgars.list.useQuery(
    { projectId: projectId || 0, year: selectedYear, subProjectId: subProject === "all" ? undefined : Number(subProject) },
    { enabled: !!projectId }
  );
  const wasteMapQuery = trpc.wasteEgars.wasteMap.useQuery(
    { projectId: projectId || 0, year: selectedYear, companyIds: selectedWasteMapCompanies.length ? selectedWasteMapCompanies : undefined },
    { enabled: !!projectId }
  );

  const createMutation = trpc.wasteEgars.create.useMutation({
    onSuccess: () => { refetch(); setShowAddForm(false); setNewEgar({ date: "", egarId: "", egarLink: "", operatorTransport: "", operatorTransportAPA: "", operatorReception: "", operatorReceptionAPA: "", lerCode: "", designation: "", quantity: "", correctedQuantity: "", destination: "recycled", month: new Date().getMonth() + 1, year: new Date().getFullYear() }); toast.success("e-GAR registada com sucesso"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMutation = trpc.wasteEgars.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("e-GAR eliminada"); },
  });
  const createSubprojectMutation = trpc.wasteEgars.createSubproject.useMutation({
    onSuccess: async () => {
      await refetchSubprojects();
      setNewSubProject("");
      toast.success("Subprojecto criado");
    },
    onError: error => toast.error(error.message),
  });

  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";
  const isAdmin = user?.role === "admin";
  const canContribute = isAdminOrDono || user?.role === "ee" || isPartner;
  const canManageSubprojects = isAdminOrDono || user?.role === "ee";
  const wasteMapCompanies = useMemo(() => {
    const entries = new Map<number, string>();
    for (const row of wasteMapQuery.data || []) if (row.companyId) entries.set(row.companyId, row.companyName || `Entidade ${row.companyId}`);
    return Array.from(entries.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt"));
  }, [wasteMapQuery.data]);

  const monthlySummary = useMemo(() => {
    if (!egars) return [];
    const byMonth: Record<number, { recycled: number; incinerated: number; landfill: number; total: number }> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = { recycled: 0, incinerated: 0, landfill: 0, total: 0 };
    egars.forEach((e: any) => {
      const qty = parseFloat(e.correctedQuantity || e.quantity) || 0;
      byMonth[e.month].total += qty;
      if (e.destination === "recycled") byMonth[e.month].recycled += qty;
      else if (e.destination === "incinerated") byMonth[e.month].incinerated += qty;
      else byMonth[e.month].landfill += qty;
    });
    return Object.entries(byMonth).map(([m, v]) => ({ month: parseInt(m), ...v }));
  }, [egars]);

  const totalWaste = monthlySummary.reduce((s, m) => s + m.total, 0);
  const totalRecycled = monthlySummary.reduce((s, m) => s + m.recycled, 0);
  const diversionRate = totalWaste > 0 ? ((totalRecycled / totalWaste) * 100).toFixed(1) : "0.0";

  async function handleExportExcel() {
    if (!egars || egars.length === 0) return;
    const wb = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet("Página Principal");
    ws1.addRow(["MIRR — Mapa Integrado de Registo de Resíduos"]);
    ws1.addRow(["Projeto:", activeProject?.name || ""]);
    ws1.addRow(["Ano:", selectedYear]);
    ws1.addRow([]);
    ws1.addRow(["Código LER", "Designação", "Perigoso", "Quantidade (t)", "Qtd Corrigida (t)", "Destino", "Operação", "Op. Transporte", "Cód. APA Transp.", "Op. Receção", "Cód. APA Rec."]);
    const lerUsed = Array.from(new Set(egars.map((e: any) => e.lerCode)));
    lerUsed.forEach((code: string) => {
      const items = egars.filter((e: any) => e.lerCode === code);
      const ler = lerCodes.find(l => l.code === code);
      const totalQ = items.reduce((s: number, e: any) => s + (parseFloat(e.correctedQuantity || e.quantity) || 0), 0);
      const dest = destinations.find(d => d.key === items[0]?.destination);
      ws1.addRow([code, ler?.name || items[0]?.designation || "", ler?.hazardous ? "Sim" : "Não", totalQ.toFixed(3), "", dest?.label || "", dest?.operation || "", items[0]?.operator || "", "", "", ""]);
    });
    const ws2 = wb.addWorksheet("e-GARs");
    ws2.addRow(["Data", "Subprojecto", "Entidade contributora", "e-GAR ID", "Código LER", "Designação", "Quantidade (t)", "Qtd Corrigida (t)", "Destino", "Op. Transporte", "Cód. APA Transp.", "Op. Receção", "Cód. APA Rec.", "Mês"]);
    egars.forEach((e: any) => {
      const dest = destinations.find(d => d.key === e.destination);
      ws2.addRow([e.date ? new Date(Number(e.date)).toLocaleDateString("pt-PT") : "", e.subProjectName || "", e.companyName || "", e.egarId || "", e.lerCode, e.designation || "", e.quantity || "", e.correctedQuantity || "", dest?.label || e.destination, e.operator || "", "", "", "", MONTHS_PT[(e.month || 1) - 1]]);
    });
    const ws3 = wb.addWorksheet("Resumo Mensal");
    ws3.addRow(["Mês", "Total (t)", "Reciclado (t)", "Incinerado (t)", "Aterro (t)", "Taxa Desvio (%)"]);
    monthlySummary.forEach(m => {
      const rate = m.total > 0 ? ((m.recycled / m.total) * 100).toFixed(1) : "0.0";
      ws3.addRow([MONTHS_PT[m.month - 1], m.total.toFixed(3), m.recycled.toFixed(3), m.incinerated.toFixed(3), m.landfill.toFixed(3), rate]);
    });
    const ws4 = wb.addWorksheet("Projeto");
    ws4.addRow(["Projeto", activeProject?.name || ""]);
    ws4.addRow(["Ano", selectedYear]);
    ws4.addRow(["Total Resíduos (t)", totalWaste.toFixed(3)]);
    ws4.addRow(["Total Reciclado (t)", totalRecycled.toFixed(3)]);
    ws4.addRow(["Taxa Desvio Aterro", `${diversionRate}%`]);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `MIRR_${activeProject?.code || "projeto"}_${selectedYear}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel MIRR exportado");
  }

  async function handleExportWasteMap() {
    const rows = wasteMapQuery.data || [];
    if (!rows.length) { toast.error("Não existem dados de resíduos para o âmbito selecionado."); return; }
    const byLer = new Map<string, { designation: string; months: Record<number, number>; total: number }>();
    for (const row of rows as any[]) {
      const entry: { designation: string; months: Record<number, number>; total: number } = byLer.get(row.lerCode) || { designation: row.designation || "—", months: {}, total: 0 };
      const month = Number(row.month);
      entry.months[month] = (entry.months[month] || 0) + Number(row.quantity || 0);
      entry.total += Number(row.quantity || 0);
      byLer.set(row.lerCode, entry);
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = "Plataforma de Gestão Ambiental — Start Campus";
    const ws = wb.addWorksheet("Waste Map LER x Mês");
    ws.mergeCells("A1:O1"); ws.getCell("A1").value = `WASTE MAP — ${activeProject?.code || "Projeto"} — ${selectedYear}`;
    ws.getCell("A1").font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } }; ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
    ws.mergeCells("A2:O2"); ws.getCell("A2").value = selectedWasteMapCompanies.length ? `Entidades selecionadas: ${selectedWasteMapCompanies.length}` : "Âmbito: todas as entidades autorizadas";
    const headers = ["Código LER", "Designação", ...MONTHS_PT.map(month => `${month} (${selectedYear})`), "Total (t)"];
    ws.addTable({ name: "WasteMapPorMes", ref: "A4", headerRow: true, style: { theme: "TableStyleMedium4", showRowStripes: true }, columns: headers.map(name => ({ name })), rows: Array.from(byLer.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([code, row]) => [code, row.designation, ...Array.from({ length: 12 }, (_, index) => Number((row.months[index + 1] || 0).toFixed(3)) || ""), Number(row.total.toFixed(3))]) });
    ws.columns = [{ width: 16 }, { width: 42 }, ...Array.from({ length: 13 }, () => ({ width: 14 }))];
    ws.views = [{ state: "frozen", ySplit: 4, xSplit: 2 }];
    const detail = wb.addWorksheet("Detalhe por Entidade");
    detail.addTable({ name: "WasteMapDetalhe", ref: "A1", headerRow: true, style: { theme: "TableStyleMedium2", showRowStripes: true }, columns: ["Entidade", "Código LER", "Designação", "Mês", "Quantidade (t)"].map(name => ({ name })), rows: rows.map((row: any) => [row.companyName || "—", row.lerCode, row.designation || "—", MONTHS_PT[Number(row.month) - 1], Number(Number(row.quantity || 0).toFixed(3))]) });
    detail.columns = [{ width: 26 }, { width: 16 }, { width: 42 }, { width: 16 }, { width: 18 }];
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `Waste_Map_${activeProject?.code || "Projeto"}_${selectedYear}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
    toast.success("Waste Map exportado com sucesso.");
  }

  function handleCreate() {
    if (!projectId || !newEgar.lerCode || !newEgar.quantity) { toast.error(t("Preencha Código LER e Quantidade")); return; }
    if (!isMIRRPage && subProject === "all") { toast.error("Seleccione o subprojecto desta e-GAR."); return; }
    const ler = lerCodes.find(l => l.code === newEgar.lerCode);
    createMutation.mutate({
      projectId,
      subProjectId: subProject === "all" ? undefined : Number(subProject),
      date: newEgar.date ? new Date(newEgar.date).getTime() : Date.now(),
      egarId: newEgar.egarId || undefined,
      egarLink: newEgar.egarLink || undefined,
      operator: `${newEgar.operatorTransport}${newEgar.operatorTransportAPA ? ` (${newEgar.operatorTransportAPA})` : ""} | ${newEgar.operatorReception}${newEgar.operatorReceptionAPA ? ` (${newEgar.operatorReceptionAPA})` : ""}`,
      lerCode: newEgar.lerCode,
      designation: newEgar.designation || ler?.name || newEgar.lerCode,
      quantity: newEgar.quantity,
      correctedQuantity: newEgar.correctedQuantity || undefined,
      destination: newEgar.destination as "recycled" | "incinerated" | "landfill",
      month: newEgar.month,
      year: newEgar.year,
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Recycle className="w-6 h-6 text-emerald-600" /> {pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{pageSubtitle} — {activeProject?.name || "Projeto"}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isMIRRPage && (subProjects?.length ?? 0) > 0 && (
              <Select value={subProject} onValueChange={setSubProject}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sub-projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("Todos")}</SelectItem>
                  {subProjects?.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.code ? `${item.code} — ` : ""}{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {!isMIRRPage && canManageSubprojects && (
              <div className="flex gap-1">
                <Input className="h-9 w-[140px] text-xs" placeholder={t("Novo sub-projeto...")} value={newSubProject} onChange={e => setNewSubProject(e.target.value)} />
                <Button size="sm" variant="outline" disabled={!projectId || createSubprojectMutation.isPending} onClick={() => { if (projectId && newSubProject.trim()) createSubprojectMutation.mutate({ projectId, name: newSubProject.trim() }); }}><Plus className="w-3 h-3" /></Button>
              </div>
            )}
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 13 }, (_, i) => 2023 + i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {canContribute && <>
              <Button onClick={() => setShowAddForm(!showAddForm)} size="sm"><Plus className="w-4 h-4 mr-1" /> {t("Nova e-GAR")}</Button>
              {isAdminOrDono && <Button variant="outline" size="sm" onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".pdf,.xlsx,.csv"; input.onchange = (e: any) => { const file = e.target.files?.[0]; if (file) toast.info(t("Importação de e-GAR via ficheiro em desenvolvimento.")); }; input.click(); }}><Upload className="w-4 h-4 mr-1" /> {t("Importar e-GAR")}</Button>}
              {isAdmin && <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}><Settings className="w-4 h-4 mr-1" /> {t("Definições")}</Button>}
            </>}
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!egars || egars.length === 0}><Download className="w-4 h-4 mr-1" /> {t("Exportar Excel MIRR")}</Button>
            <Button variant="outline" size="sm" onClick={handleExportWasteMap} disabled={wasteMapQuery.isLoading || !(wasteMapQuery.data || []).length}><Download className="w-4 h-4 mr-1" /> Exportar Waste Map</Button>
          </div>
        </div>

        {isPartner && (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-emerald-900">Contributo de Resíduos do parceiro</p>
              <p className="mt-1 text-xs text-emerald-800/80">
                Regista apenas as e-GAR da {partnerAccessQuery.data?.companyName || "sua empresa"}. A EE {partnerAccessQuery.data?.parentCompanyName || "principal"} vê estes registos na consolidação por subprojecto.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-emerald-100 bg-emerald-50/40">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-sm font-semibold text-emerald-950">Waste Map por código LER e mês</p><p className="text-xs text-emerald-800">Escolha uma, várias ou todas as entidades autorizadas. A exportação apresenta as toneladas por código LER em cada mês.</p></div>
              {selectedWasteMapCompanies.length > 0 && <Button size="sm" variant="outline" onClick={() => setSelectedWasteMapCompanies([])}>Todas as entidades</Button>}
            </div>
            {wasteMapCompanies.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{wasteMapCompanies.map(([companyId, companyName]) => { const selected = selectedWasteMapCompanies.includes(companyId); return <Button key={companyId} size="sm" variant={selected ? "default" : "outline"} onClick={() => setSelectedWasteMapCompanies(current => selected ? current.filter(id => id !== companyId) : [...current, companyId])}>{companyName}</Button>; })}</div> : <p className="mt-3 text-xs text-muted-foreground">Sem entidades com e-GAR no período selecionado.</p>}
          </CardContent>
        </Card>

        {/* Settings Panel */}
        {showSettings && (
          <Card className="border-indigo-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{t("Definições MIRR")}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}><X className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* LER Codes Management */}
              <div>
                <h4 className="font-medium text-xs text-muted-foreground mb-2">Códigos LER ({lerCodes.length})</h4>
                <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                  {lerCodes.map((ler, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1">
                      <span className="font-mono font-medium w-16">{ler.code}</span>
                      <Input className="h-6 text-xs flex-1" value={ler.name} onChange={e => { const updated = [...lerCodes]; updated[i] = { ...ler, name: e.target.value }; setLerCodes(updated); }} />
                      {ler.hazardous && <Badge variant="destructive" className="text-[10px] h-4">{t("Perigoso")}</Badge>}
                      <button className="text-red-500 hover:text-red-700" onClick={() => setLerCodes(lerCodes.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 items-end">
                  <div><label className="text-[10px] text-muted-foreground">{t("Código")}</label><Input className="h-7 text-xs w-20" value={newLer.code} onChange={e => setNewLer(p => ({ ...p, code: e.target.value }))} placeholder="170904" /></div>
                  <div className="flex-1"><label className="text-[10px] text-muted-foreground">{t("Designação")}</label><Input className="h-7 text-xs" value={newLer.name} onChange={e => setNewLer(p => ({ ...p, name: e.target.value }))} placeholder={t("Nome do resíduo")} /></div>
                  <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={newLer.hazardous} onChange={e => setNewLer(p => ({ ...p, hazardous: e.target.checked }))} /> Perigoso</label>
                  <Button size="sm" className="h-7 text-xs" onClick={() => { if (newLer.code && newLer.name) { setLerCodes([...lerCodes, newLer]); setNewLer({ code: "", name: "", hazardous: false }); toast.success(t("Código LER adicionado")); } }}>{t("Adicionar")}</Button>
                </div>
              </div>
              {/* Destinations Management */}
              <div>
                <h4 className="font-medium text-xs text-muted-foreground mb-2">Destinos ({destinations.length})</h4>
                <div className="space-y-1 mb-2">
                  {destinations.map((dest, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1">
                      <Input className="h-6 text-xs w-24" value={dest.key} onChange={e => { const updated = [...destinations]; updated[i] = { ...dest, key: e.target.value }; setDestinations(updated); }} />
                      <Input className="h-6 text-xs flex-1" value={dest.label} onChange={e => { const updated = [...destinations]; updated[i] = { ...dest, label: e.target.value }; setDestinations(updated); }} />
                      <Input className="h-6 text-xs w-16" value={dest.operation} onChange={e => { const updated = [...destinations]; updated[i] = { ...dest, operation: e.target.value }; setDestinations(updated); }} placeholder="R13" />
                      <button className="text-red-500 hover:text-red-700" onClick={() => setDestinations(destinations.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 items-end">
                  <div><label className="text-[10px] text-muted-foreground">{t("Chave")}</label><Input className="h-7 text-xs w-24" value={newDest.key} onChange={e => setNewDest(p => ({ ...p, key: e.target.value }))} placeholder="recovery" /></div>
                  <div className="flex-1"><label className="text-[10px] text-muted-foreground">{t("Nome")}</label><Input className="h-7 text-xs" value={newDest.label} onChange={e => setNewDest(p => ({ ...p, label: e.target.value }))} placeholder={t("Valorização")} /></div>
                  <div><label className="text-[10px] text-muted-foreground">{t("Operação")}</label><Input className="h-7 text-xs w-16" value={newDest.operation} onChange={e => setNewDest(p => ({ ...p, operation: e.target.value }))} placeholder="R4" /></div>
                  <Button size="sm" className="h-7 text-xs" onClick={() => { if (newDest.key && newDest.label) { setDestinations([...destinations, newDest]); setNewDest({ key: "", label: "", operation: "" }); toast.success("Destino adicionado"); } }}>{t("Adicionar")}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{totalWaste.toFixed(3)}</p>
            <p className="text-xs text-muted-foreground">{t("Total Resíduos (t)")}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-sky-600">{totalRecycled.toFixed(3)}</p>
            <p className="text-xs text-muted-foreground">{t("Reciclado (t)")}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{diversionRate}%</p>
            <p className="text-xs text-muted-foreground">{t("Taxa Desvio Aterro")}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{egars?.length || 0}</p>
            <p className="text-xs text-muted-foreground">{t("e-GARs Registadas")}</p>
          </CardContent></Card>
        </div>

        {/* Monthly bar chart */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Resíduos por Mês ({selectedYear})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 gap-1 text-center text-xs">
              {monthlySummary.map(m => (
                <div key={m.month} className="space-y-1">
                  <div className="h-20 flex flex-col justify-end">
                    {m.total > 0 && (
                      <div className="flex flex-col justify-end h-full">
                        {m.landfill > 0 && <div className="bg-red-400 rounded-t" style={{ height: `${(m.landfill / Math.max(...monthlySummary.map(x => x.total), 1)) * 100}%`, minHeight: "2px" }} />}
                        {m.incinerated > 0 && <div className="bg-amber-400" style={{ height: `${(m.incinerated / Math.max(...monthlySummary.map(x => x.total), 1)) * 100}%`, minHeight: "2px" }} />}
                        {m.recycled > 0 && <div className="bg-emerald-400 rounded-b" style={{ height: `${(m.recycled / Math.max(...monthlySummary.map(x => x.total), 1)) * 100}%`, minHeight: "2px" }} />}
                      </div>
                    )}
                  </div>
                  <span className="text-muted-foreground">{MONTHS_PT[m.month - 1]}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400" /> {t(t("Reciclado"))}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> {t(t("Incinerado"))}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> {t(t("Aterro"))}</span>
            </div>
          </CardContent>
        </Card>

        {/* Add e-GAR form */}
        {showAddForm && (
          <Card className="border-emerald-200">
            <CardHeader><CardTitle className="text-sm">{t("Registar Nova e-GAR")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="text-xs text-muted-foreground">{t("Data")}</label><Input type="date" value={newEgar.date} onChange={e => setNewEgar(p => ({ ...p, date: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground">N.º e-GAR</label><Input value={newEgar.egarId} onChange={e => setNewEgar(p => ({ ...p, egarId: e.target.value }))} placeholder="Ex: EGAR-2026-001" /></div>
                <div><label className="text-xs text-muted-foreground">{t("Link e-GAR")}</label><Input value={newEgar.egarLink} onChange={e => setNewEgar(p => ({ ...p, egarLink: e.target.value }))} placeholder="URL do portal" /></div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("Mês")}</label>
                  <Select value={String(newEgar.month)} onValueChange={v => setNewEgar(p => ({ ...p, month: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS_PT.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="text-xs text-muted-foreground">{t("Operador de Transporte")}</label><Input value={newEgar.operatorTransport} onChange={e => setNewEgar(p => ({ ...p, operatorTransport: e.target.value }))} placeholder="Ex: Ambigroup" /></div>
                <div><label className="text-xs text-muted-foreground">{t("Cód. APA Transporte")}</label><Input value={newEgar.operatorTransportAPA} onChange={e => setNewEgar(p => ({ ...p, operatorTransportAPA: e.target.value }))} placeholder="Ex: APA-T-12345" /></div>
                <div><label className="text-xs text-muted-foreground">{t("Operador de Receção")}</label><Input value={newEgar.operatorReception} onChange={e => setNewEgar(p => ({ ...p, operatorReception: e.target.value }))} placeholder="Ex: Valorsul" /></div>
                <div><label className="text-xs text-muted-foreground">{t("Cód. APA Receção")}</label><Input value={newEgar.operatorReceptionAPA} onChange={e => setNewEgar(p => ({ ...p, operatorReceptionAPA: e.target.value }))} placeholder="Ex: APA-R-67890" /></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">{t("Código LER")}</label>
                  <Select value={newEgar.lerCode} onValueChange={v => { setNewEgar(p => ({ ...p, lerCode: v, designation: lerCodes.find(l => l.code === v)?.name || "" })); }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{lerCodes.map(l => <SelectItem key={l.code} value={l.code}>{l.code} — {l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs text-muted-foreground">{t("Quantidade Original (t)")}</label><Input type="number" step="0.001" value={newEgar.quantity} onChange={e => setNewEgar(p => ({ ...p, quantity: e.target.value }))} placeholder="0.000" /></div>
                <div><label className="text-xs text-muted-foreground">{t("Quantidade Corrigida (t)")}</label><Input type="number" step="0.001" value={newEgar.correctedQuantity} onChange={e => setNewEgar(p => ({ ...p, correctedQuantity: e.target.value }))} placeholder="Opcional" /></div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("Destino Final")}</label>
                  <Select value={newEgar.destination} onValueChange={v => setNewEgar(p => ({ ...p, destination: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {destinations.map(d => <SelectItem key={d.key} value={d.key}>{d.label} ({d.operation})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>{t("Registar e-GAR")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>{t("Cancelar")}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* e-GARs table */}
        <Card>
          <CardHeader><CardTitle className="text-sm">e-GARs Registadas ({selectedYear})</CardTitle></CardHeader>
          <CardContent>
            {!egars || egars.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma e-GAR registada para {selectedYear}. Clique "Nova e-GAR" para começar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left">
                    <th className="py-2 px-2 font-medium text-muted-foreground">{t("Data")}</th>
                    {!isMIRRPage && <th className="py-2 px-2 font-medium text-muted-foreground">Subprojecto</th>}
                    <th className="py-2 px-2 font-medium text-muted-foreground">Entidade</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">N.º e-GAR</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">{t("LER")}</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">{t("Designação")}</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">{t("Qtd (t)")}</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">{t("Operadores")}</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">{t("Destino")}</th>
                    {canContribute && <th className="py-2 px-2"></th>}
                  </tr></thead>
                  <tbody>
                    {egars.map((e: any) => {
                      const dest = destinations.find(d => d.key === e.destination);
                      return (
                        <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 px-2">{e.date ? new Date(Number(e.date)).toLocaleDateString("pt-PT") : "—"}</td>
                          {!isMIRRPage && <td className="py-2 px-2"><Badge variant="outline">{e.subProjectName || "Sem subprojecto"}</Badge></td>}
                          <td className="py-2 px-2 text-xs">{e.companyName || "—"}</td>
                          <td className="py-2 px-2">{e.egarLink ? <a href={e.egarLink} target="_blank" className="text-primary underline">{e.egarId || "Ver"}</a> : (e.egarId || "—")}</td>
                          <td className="py-2 px-2 font-mono text-xs">{e.lerCode}</td>
                          <td className="py-2 px-2 text-xs">{e.designation || "—"}</td>
                          <td className="py-2 px-2 font-medium">{e.correctedQuantity ? <><span className="text-green-700">{e.correctedQuantity}</span> <span className="text-[10px] text-muted-foreground line-through">{e.quantity}</span></> : e.quantity}</td>
                          <td className="py-2 px-2 text-xs">{e.operator || "—"}</td>
                          <td className="py-2 px-2"><Badge variant={e.destination === "recycled" ? "default" : e.destination === "landfill" ? "destructive" : "secondary"} className="text-[10px]">{dest?.label || e.destination}</Badge></td>
                          {canContribute && <td className="py-2 px-2">{(() => { const ownsRecord = e.createdBy === user?.id || (user?.companyId && e.companyId === user.companyId); const withinWindow = new Date(e.createdAt).getTime() + 48 * 60 * 60 * 1000 > Date.now(); const canDelete = isAdminOrDono || (ownsRecord && withinWindow); return canDelete ? <button title={isAdminOrDono ? "Eliminar e-GAR" : "Eliminar até 48 horas após o registo"} onClick={() => { if (confirm("Eliminar esta e-GAR? Esta ação ficará registada em auditoria.")) deleteMutation.mutate({ id: e.id }); }} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button> : <span className="text-[10px] text-muted-foreground">48 h expiradas</span>; })()}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
import { useLocation } from "wouter";
