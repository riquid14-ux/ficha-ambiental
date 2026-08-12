import { useState, useMemo } from "react";
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
import { Plus, Trash2, Download, Recycle, Flame, Mountain } from "lucide-react";
import ExcelJS from "exceljs";

const LER_CODES = [
  { code: "20107", name: "Resíduos Verdes", hazardous: false },
  { code: "80111", name: "Paint and varnish waste (hazardous)", hazardous: true },
  { code: "110111", name: "Aqueous washing liquids (hazardous)", hazardous: true },
  { code: "130701", name: "Fuel oil and diesel", hazardous: true },
  { code: "130899", name: "Used oils", hazardous: true },
  { code: "150101", name: "Paper and cardboard packaging", hazardous: false },
  { code: "150102", name: "Packaging and Plastic", hazardous: false },
  { code: "150103", name: "Wooden packaging", hazardous: false },
  { code: "150105", name: "Composite Packaging", hazardous: false },
  { code: "150110", name: "Packaging with hazardous residues", hazardous: true },
  { code: "150111", name: "Metal packaging (hazardous)", hazardous: true },
  { code: "150202", name: "Absorbents contaminated (hazardous)", hazardous: true },
  { code: "150203", name: "Absorbents non-hazardous", hazardous: false },
  { code: "160103", name: "Used Tyres", hazardous: false },
  { code: "160216", name: "Toner", hazardous: false },
  { code: "170101", name: "Betão", hazardous: false },
  { code: "170107", name: "Mixtures of concrete/bricks/tiles", hazardous: false },
  { code: "170201", name: "Madeira", hazardous: false },
  { code: "170203", name: "Plástico", hazardous: false },
  { code: "170301", name: "Bituminous (hazardous)", hazardous: true },
  { code: "170302", name: "Bituminous mixtures non-hazardous", hazardous: false },
  { code: "170405", name: "Iron and Steel", hazardous: false },
  { code: "170411", name: "Cabos", hazardous: false },
  { code: "170503", name: "Soils with hazardous substances", hazardous: true },
  { code: "170604", name: "Insulation material", hazardous: false },
  { code: "170802", name: "Gypsum-based materials", hazardous: false },
  { code: "170904", name: "Mixed C&D waste", hazardous: false },
  { code: "200108", name: "Biodegradable kitchen waste", hazardous: false },
  { code: "160214", name: "Discarded equipment", hazardous: false },
  { code: "200101", name: "Paper and Cardstock", hazardous: false },
  { code: "200301", name: "Municipal solid waste", hazardous: false },
  { code: "200307", name: "Bulky waste (Monstros)", hazardous: false },
];

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function MIRR() {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const projectId = activeProject?.id;
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEgar, setNewEgar] = useState({
    date: "", egarId: "", egarLink: "", operator: "", lerCode: "", designation: "", quantity: "", destination: "recycled" as "recycled" | "incinerated" | "landfill", month: new Date().getMonth() + 1, year: new Date().getFullYear()
  });

  const { data: egars, refetch } = trpc.wasteEgars.list.useQuery(
    { projectId: projectId || 0, year: selectedYear },
    { enabled: !!projectId }
  );

  const createMutation = trpc.wasteEgars.create.useMutation({
    onSuccess: () => { refetch(); setShowAddForm(false); setNewEgar({ date: "", egarId: "", egarLink: "", operator: "", lerCode: "", designation: "", quantity: "", destination: "recycled", month: new Date().getMonth() + 1, year: new Date().getFullYear() }); toast.success("e-GAR registada"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.wasteEgars.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Eliminada"); },
  });

  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";

  // Calculate monthly summaries
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
    ws1.addRow(["", "", "", "", "", "", "", selectedYear]);
    ws1.addRow(["", "Resíduos (Toneladas)", ...MONTHS_PT]);
    ws1.addRow(["", "Desviado de aterro", ...monthlySummary.map(m => m.recycled + m.incinerated)]);
    ws1.addRow(["", "Incinerado", ...monthlySummary.map(m => m.incinerated)]);
    ws1.addRow(["", "Outros resíduos enviados para aterro", ...monthlySummary.map(m => m.landfill)]);
    ws1.addRow([]);
    ws1.addRow(["", "Resíduos produzidos mensalmente (t)", ...monthlySummary.map(m => m.total)]);
    ws1.addRow(["", "Total", totalWaste.toFixed(3)]);
    ws1.addRow(["", "% Desviado de aterro", diversionRate + "%"]);
    const ws2 = wb.addWorksheet("Egars");
    ws2.addRow(["DATA", "E GAR ID", "Link", "Operador", "CÓDIGO LER", "DESIGNAÇÃO", "QUANTIDADE (T)"]);
    egars.forEach((e: any) => { ws2.addRow([e.date ? new Date(Number(e.date)).toLocaleDateString("pt-PT") : "", e.egarId || "", e.egarLink || "", e.operator || "", e.lerCode, e.designation, parseFloat(e.correctedQuantity || e.quantity)]); });
    const ws3 = wb.addWorksheet("Resíduos Reciclados");
    const destHeader = ["", "CÓDIGO LER", "DESIGNAÇÃO"];
    MONTHS_PT.forEach(m => { destHeader.push(m + " Rec%", m + " Inc%", m + " Lan%"); });
    ws3.addRow(destHeader);
    const lerUsed = Array.from(new Set(egars.map((e: any) => e.lerCode)));
    lerUsed.forEach(code => {
      const ler = LER_CODES.find(l => l.code === code);
      const row: any[] = ["", code, ler?.name || ""];
      for (let m = 1; m <= 12; m++) {
        const me = egars.filter((e: any) => e.lerCode === code && e.month === m);
        const tot = me.reduce((s: number, e: any) => s + parseFloat(e.correctedQuantity || e.quantity), 0);
        if (tot === 0) { row.push("", "", ""); continue; }
        const rec = me.filter((e: any) => e.destination === "recycled").reduce((s: number, e: any) => s + parseFloat(e.correctedQuantity || e.quantity), 0);
        const inc = me.filter((e: any) => e.destination === "incinerated").reduce((s: number, e: any) => s + parseFloat(e.correctedQuantity || e.quantity), 0);
        const lan = me.filter((e: any) => e.destination === "landfill").reduce((s: number, e: any) => s + parseFloat(e.correctedQuantity || e.quantity), 0);
        row.push(((rec/tot)*100).toFixed(0)+"%", ((inc/tot)*100).toFixed(0)+"%", ((lan/tot)*100).toFixed(0)+"%");
      }
      ws3.addRow(row);
    });
    const ws4 = wb.addWorksheet("Projeto");
    ws4.addRow(["", "CÓDIGO LER", "DESIGNAÇÃO", ...MONTHS_PT, "TOTAL (t)"]);
    lerUsed.forEach(code => {
      const ler = LER_CODES.find(l => l.code === code);
      const row: any[] = ["", code, ler?.name || ""];
      let yt = 0;
      for (let m = 1; m <= 12; m++) { const mt = egars.filter((e: any) => e.lerCode === code && e.month === m).reduce((s: number, e: any) => s + parseFloat(e.correctedQuantity || e.quantity), 0); row.push(mt > 0 ? mt.toFixed(3) : ""); yt += mt; }
      row.push(yt.toFixed(3));
      ws4.addRow(row);
    });
    ws4.addRow(["", "", "TOTAL", ...monthlySummary.map(m => m.total > 0 ? m.total.toFixed(3) : ""), totalWaste.toFixed(3)]);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `MIRR_WasteMap_${activeProject?.code || "Projeto"}_${selectedYear}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel exportado com sucesso");
  }

  function handleCreate() {
    if (!projectId || !newEgar.lerCode || !newEgar.quantity) { toast.error("Preencha LER Code e Quantidade"); return; }
    const ler = LER_CODES.find(l => l.code === newEgar.lerCode);
    createMutation.mutate({
      projectId,
      date: newEgar.date ? new Date(newEgar.date).getTime() : Date.now(),
      egarId: newEgar.egarId || undefined,
      egarLink: newEgar.egarLink || undefined,
      operator: newEgar.operator || undefined,
      lerCode: newEgar.lerCode,
      designation: newEgar.designation || ler?.name || newEgar.lerCode,
      quantity: newEgar.quantity,
      destination: newEgar.destination,
      month: newEgar.month,
      year: newEgar.year,
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Recycle className="w-6 h-6 text-emerald-600" /> MIRR — Gestão de Resíduos</h1>
            <p className="text-sm text-muted-foreground">Mapa Integrado de Registo de Resíduos — {activeProject?.name || "Projeto"}</p>
          </div>
          <div className="flex gap-2">
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdminOrDono && <Button onClick={() => setShowAddForm(!showAddForm)} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova e-GAR</Button>}
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!egars || egars.length === 0}><Download className="w-4 h-4 mr-1" /> Exportar Excel</Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{totalWaste.toFixed(3)}</p>
            <p className="text-xs text-muted-foreground">Total Resíduos (t)</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-sky-600">{totalRecycled.toFixed(3)}</p>
            <p className="text-xs text-muted-foreground">Reciclado (t)</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{diversionRate}%</p>
            <p className="text-xs text-muted-foreground">Taxa Desvio Aterro</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{egars?.length || 0}</p>
            <p className="text-xs text-muted-foreground">e-GARs Registadas</p>
          </CardContent></Card>
        </div>

        {/* Monthly bar chart (simple text-based) */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Resíduos por Mês ({selectedYear})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 gap-1 text-center text-xs">
              {monthlySummary.map(m => (
                <div key={m.month} className="space-y-1">
                  <div className="h-20 flex flex-col justify-end">
                    {m.total > 0 && (
                      <div className="space-y-0.5">
                        {m.recycled > 0 && <div className="bg-emerald-400 rounded-t" style={{ height: `${Math.max(4, (m.recycled / Math.max(totalWaste / 12, 0.001)) * 40)}px` }} />}
                        {m.incinerated > 0 && <div className="bg-amber-400" style={{ height: `${Math.max(4, (m.incinerated / Math.max(totalWaste / 12, 0.001)) * 40)}px` }} />}
                        {m.landfill > 0 && <div className="bg-red-400 rounded-b" style={{ height: `${Math.max(4, (m.landfill / Math.max(totalWaste / 12, 0.001)) * 40)}px` }} />}
                      </div>
                    )}
                  </div>
                  <p className="font-medium">{MONTHS_PT[m.month - 1]}</p>
                  <p className="text-muted-foreground">{m.total > 0 ? m.total.toFixed(2) : "—"}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400" /> Reciclado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> Incinerado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Aterro</span>
            </div>
          </CardContent>
        </Card>

        {/* Add e-GAR form */}
        {showAddForm && (
          <Card className="border-emerald-200">
            <CardHeader><CardTitle className="text-sm">Registar Nova e-GAR</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="text-xs text-muted-foreground">Data</label><Input type="date" value={newEgar.date} onChange={e => setNewEgar(p => ({ ...p, date: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground">e-GAR ID</label><Input value={newEgar.egarId} onChange={e => setNewEgar(p => ({ ...p, egarId: e.target.value }))} placeholder="Ex: EGAR-2026-001" /></div>
                <div><label className="text-xs text-muted-foreground">Operador</label><Input value={newEgar.operator} onChange={e => setNewEgar(p => ({ ...p, operator: e.target.value }))} placeholder="Ex: Ambigroup" /></div>
                <div><label className="text-xs text-muted-foreground">Link e-GAR</label><Input value={newEgar.egarLink} onChange={e => setNewEgar(p => ({ ...p, egarLink: e.target.value }))} placeholder="URL" /></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Código LER</label>
                  <Select value={newEgar.lerCode} onValueChange={v => { setNewEgar(p => ({ ...p, lerCode: v, designation: LER_CODES.find(l => l.code === v)?.name || "" })); }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{LER_CODES.map(l => <SelectItem key={l.code} value={l.code}>{l.code} — {l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs text-muted-foreground">Quantidade (t)</label><Input type="number" step="0.001" value={newEgar.quantity} onChange={e => setNewEgar(p => ({ ...p, quantity: e.target.value }))} placeholder="0.000" /></div>
                <div>
                  <label className="text-xs text-muted-foreground">Destino</label>
                  <Select value={newEgar.destination} onValueChange={v => setNewEgar(p => ({ ...p, destination: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recycled">Reciclagem</SelectItem>
                      <SelectItem value="incinerated">Incineração</SelectItem>
                      <SelectItem value="landfill">Aterro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Mês</label>
                  <Select value={String(newEgar.month)} onValueChange={v => setNewEgar(p => ({ ...p, month: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS_PT.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>Registar</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancelar</Button>
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
                    <th className="py-2 px-2 font-medium text-muted-foreground">Data</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">e-GAR ID</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Operador</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">LER</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Designação</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Qtd (t)</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Destino</th>
                    {isAdminOrDono && <th className="py-2 px-2"></th>}
                  </tr></thead>
                  <tbody>
                    {egars.map((e: any) => (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-2">{e.date ? new Date(Number(e.date)).toLocaleDateString("pt-PT") : "—"}</td>
                        <td className="py-2 px-2">{e.egarLink ? <a href={e.egarLink} target="_blank" className="text-primary underline">{e.egarId || "Link"}</a> : (e.egarId || "—")}</td>
                        <td className="py-2 px-2 text-muted-foreground">{e.operator || "—"}</td>
                        <td className="py-2 px-2"><Badge variant="outline" className="text-xs">{e.lerCode}</Badge></td>
                        <td className="py-2 px-2">{e.designation}</td>
                        <td className="py-2 px-2 font-medium">{parseFloat(e.correctedQuantity || e.quantity).toFixed(3)}</td>
                        <td className="py-2 px-2">
                          {e.destination === "recycled" && <Badge className="bg-emerald-100 text-emerald-800 text-xs"><Recycle className="w-3 h-3 mr-1" />Reciclagem</Badge>}
                          {e.destination === "incinerated" && <Badge className="bg-amber-100 text-amber-800 text-xs"><Flame className="w-3 h-3 mr-1" />Incineração</Badge>}
                          {e.destination === "landfill" && <Badge className="bg-red-100 text-red-800 text-xs"><Mountain className="w-3 h-3 mr-1" />Aterro</Badge>}
                        </td>
                        {isAdminOrDono && <td className="py-2 px-2"><Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => deleteMutation.mutate({ id: e.id })}><Trash2 className="w-3.5 h-3.5" /></Button></td>}
                      </tr>
                    ))}
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
