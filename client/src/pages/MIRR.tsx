import { useState, useMemo } from "react";
import React from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StandMetricCard } from "@/components/stand/StandMetricCard";
import { StandPageHeader } from "@/components/stand/StandPageHeader";
import { StandStatusBadge } from "@/components/stand/StandStatusBadge";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Plus,
  Recycle,
  Settings,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import ExcelJS from "exceljs";

const DEFAULT_LER_CODES = [
  { code: "20107", name: "Resíduos Verdes", hazardous: false },
  { code: "80111", name: "Tintas e vernizes (perigoso)", hazardous: true },
  {
    code: "110111",
    name: "Líquidos de lavagem aquosos (perigoso)",
    hazardous: true,
  },
  { code: "130701", name: "Fuelóleo e gasóleo", hazardous: true },
  { code: "130899", name: "Óleos usados", hazardous: true },
  { code: "150101", name: "Embalagens de papel e cartão", hazardous: false },
  { code: "150102", name: "Embalagens de plástico", hazardous: false },
  { code: "150103", name: "Embalagens de madeira", hazardous: false },
  { code: "150105", name: "Embalagens compósitas", hazardous: false },
  {
    code: "150110",
    name: "Embalagens com resíduos perigosos",
    hazardous: true,
  },
  { code: "150111", name: "Embalagens metálicas (perigoso)", hazardous: true },
  {
    code: "150202",
    name: "Absorventes contaminados (perigoso)",
    hazardous: true,
  },
  { code: "150203", name: "Absorventes não perigosos", hazardous: false },
  { code: "160103", name: "Pneus usados", hazardous: false },
  { code: "160216", name: "Toners", hazardous: false },
  { code: "170101", name: "Betão", hazardous: false },
  {
    code: "170107",
    name: "Misturas de betão/tijolos/telhas",
    hazardous: false,
  },
  { code: "170201", name: "Madeira", hazardous: false },
  { code: "170203", name: "Plástico", hazardous: false },
  { code: "170301", name: "Misturas betuminosas (perigoso)", hazardous: true },
  {
    code: "170302",
    name: "Misturas betuminosas não perigosas",
    hazardous: false,
  },
  { code: "170405", name: "Ferro e aço", hazardous: false },
  { code: "170411", name: "Cabos", hazardous: false },
  { code: "170503", name: "Solos com substâncias perigosas", hazardous: true },
  { code: "170604", name: "Material de isolamento", hazardous: false },
  { code: "170802", name: "Materiais à base de gesso", hazardous: false },
  { code: "170904", name: "Resíduos mistos de C&D", hazardous: false },
  {
    code: "200108",
    name: "Resíduos biodegradáveis de cozinha",
    hazardous: false,
  },
  { code: "160214", name: "Equipamentos descartados", hazardous: false },
  { code: "200101", name: "Papel e cartão", hazardous: false },
  { code: "200301", name: "Resíduos sólidos urbanos", hazardous: false },
  { code: "200307", name: "Monstros (resíduos volumosos)", hazardous: false },
];

const DEFAULT_DESTINATIONS = [
  { key: "recycled", label: "Reciclagem", operation: "R13" },
  {
    key: "incinerated",
    label: "Incineração/Valorização Energética",
    operation: "R1",
  },
  { key: "landfill", label: "Aterro/Eliminação", operation: "D1" },
];

const MONTHS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export default function MIRR() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeProject } = useProject();
  const [location] = useLocation();
  const isMIRRPage = location === "/mirr";
  const pageTitle = isMIRRPage ? "MIRR" : t("Gestão de Resíduos");
  const pageSubtitle = isMIRRPage
    ? "Mapa Integrado de Registo de Resíduos — Operação"
    : "Gestão e rastreio de resíduos de construção";
  const [subProject, setSubProject] = useState("all");
  const [newSubProject, setNewSubProject] = useState("");
  const projectId = activeProject?.id;
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWasteMapCompanies, setSelectedWasteMapCompanies] = useState<
    number[]
  >([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [egarPendingDelete, setEgarPendingDelete] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const [lerCodes, setLerCodes] = useState(DEFAULT_LER_CODES);
  const [destinations, setDestinations] = useState(DEFAULT_DESTINATIONS);
  const [newLer, setNewLer] = useState({
    code: "",
    name: "",
    hazardous: false,
  });
  const [newDest, setNewDest] = useState({ key: "", label: "", operation: "" });
  const [newEgar, setNewEgar] = useState({
    date: "",
    egarId: "",
    egarLink: "",
    operatorTransport: "",
    operatorTransportAPA: "",
    operatorReception: "",
    operatorReceptionAPA: "",
    lerCode: "",
    designation: "",
    quantity: "",
    correctedQuantity: "",
    destination: "recycled",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const isPartner = user?.role === "ee_partner";
  const partnerAccessQuery = trpc.partners.myAccess.useQuery(undefined, {
    enabled: isPartner,
  });
  const { data: subProjects, refetch: refetchSubprojects } =
    trpc.wasteEgars.subprojects.useQuery(
      { projectId: projectId || 0 },
      { enabled: !!projectId }
    );
  const { data: egars, refetch } = trpc.wasteEgars.list.useQuery(
    {
      projectId: projectId || 0,
      year: selectedYear,
      subProjectId: subProject === "all" ? undefined : Number(subProject),
    },
    { enabled: !!projectId }
  );
  const wasteMapQuery = trpc.wasteEgars.wasteMap.useQuery(
    {
      projectId: projectId || 0,
      year: selectedYear,
      companyIds: selectedWasteMapCompanies.length
        ? selectedWasteMapCompanies
        : undefined,
    },
    { enabled: !!projectId }
  );

  const createMutation = trpc.wasteEgars.create.useMutation({
    onSuccess: () => {
      refetch();
      wasteMapQuery.refetch();
      setShowAddForm(false);
      setNewEgar({
        date: "",
        egarId: "",
        egarLink: "",
        operatorTransport: "",
        operatorTransportAPA: "",
        operatorReception: "",
        operatorReceptionAPA: "",
        lerCode: "",
        designation: "",
        quantity: "",
        correctedQuantity: "",
        destination: "recycled",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      });
      toast.success("e-GAR registada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMutation = trpc.wasteEgars.delete.useMutation({
    onSuccess: () => {
      refetch();
      wasteMapQuery.refetch();
      setEgarPendingDelete(null);
      toast.success("e-GAR eliminada");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const createSubprojectMutation = trpc.wasteEgars.createSubproject.useMutation(
    {
      onSuccess: async () => {
        await refetchSubprojects();
        setNewSubProject("");
        toast.success("Subprojecto criado");
      },
      onError: error => toast.error(error.message),
    }
  );

  const isAdminOrDono = user?.role === "admin" || user?.role === "dono_obra";
  const isAdmin = user?.role === "admin";
  const canContribute = isAdminOrDono || user?.role === "ee" || isPartner;
  const canManageSubprojects = isAdminOrDono || user?.role === "ee";
  const wasteMapCompanies = useMemo(() => {
    const entries = new Map<number, string>();
    for (const row of wasteMapQuery.data || [])
      if (row.companyId)
        entries.set(
          row.companyId,
          row.companyName || `Entidade ${row.companyId}`
        );
    return Array.from(entries.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "pt")
    );
  }, [wasteMapQuery.data]);
  const hasUnassignedWasteMapRows = useMemo(
    () => (wasteMapQuery.data || []).some((row: any) => !row.companyId),
    [wasteMapQuery.data]
  );

  const monthlySummary = useMemo(() => {
    if (!egars) return [];
    const byMonth: Record<
      number,
      { recycled: number; incinerated: number; landfill: number; total: number }
    > = {};
    for (let m = 1; m <= 12; m++)
      byMonth[m] = { recycled: 0, incinerated: 0, landfill: 0, total: 0 };
    egars.forEach((e: any) => {
      const qty = parseFloat(e.correctedQuantity || e.quantity) || 0;
      byMonth[e.month].total += qty;
      if (e.destination === "recycled") byMonth[e.month].recycled += qty;
      else if (e.destination === "incinerated")
        byMonth[e.month].incinerated += qty;
      else byMonth[e.month].landfill += qty;
    });
    return Object.entries(byMonth).map(([m, v]) => ({
      month: parseInt(m),
      ...v,
    }));
  }, [egars]);

  const totalWaste = monthlySummary.reduce((s, m) => s + m.total, 0);
  const totalRecycled = monthlySummary.reduce((s, m) => s + m.recycled, 0);
  const diversionRate =
    totalWaste > 0 ? ((totalRecycled / totalWaste) * 100).toFixed(1) : "0.0";

  async function handleExportExcel() {
    if (!egars || egars.length === 0) return;
    const wb = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet("Página Principal");
    ws1.addRow(["MIRR — Mapa Integrado de Registo de Resíduos"]);
    ws1.addRow(["Projeto:", activeProject?.name || ""]);
    ws1.addRow(["Ano:", selectedYear]);
    ws1.addRow([]);
    ws1.addRow([
      "Código LER",
      "Designação",
      "Perigoso",
      "Quantidade (t)",
      "Qtd Corrigida (t)",
      "Destino",
      "Operação",
      "Op. Transporte",
      "Cód. APA Transp.",
      "Op. Receção",
      "Cód. APA Rec.",
    ]);
    const lerUsed = Array.from(new Set(egars.map((e: any) => e.lerCode)));
    lerUsed.forEach((code: string) => {
      const items = egars.filter((e: any) => e.lerCode === code);
      const ler = lerCodes.find(l => l.code === code);
      const totalQ = items.reduce(
        (s: number, e: any) =>
          s + (parseFloat(e.correctedQuantity || e.quantity) || 0),
        0
      );
      const dest = destinations.find(d => d.key === items[0]?.destination);
      ws1.addRow([
        code,
        ler?.name || items[0]?.designation || "",
        ler?.hazardous ? "Sim" : "Não",
        totalQ.toFixed(3),
        "",
        dest?.label || "",
        dest?.operation || "",
        items[0]?.operator || "",
        "",
        "",
        "",
      ]);
    });
    const ws2 = wb.addWorksheet("e-GARs");
    ws2.addRow([
      "Data",
      "Subprojecto",
      "Entidade contributora",
      "e-GAR ID",
      "Código LER",
      "Designação",
      "Quantidade (t)",
      "Qtd Corrigida (t)",
      "Destino",
      "Op. Transporte",
      "Cód. APA Transp.",
      "Op. Receção",
      "Cód. APA Rec.",
      "Mês",
    ]);
    egars.forEach((e: any) => {
      const dest = destinations.find(d => d.key === e.destination);
      ws2.addRow([
        e.date ? new Date(Number(e.date)).toLocaleDateString("pt-PT") : "",
        e.subProjectName || "",
        e.companyName || "",
        e.egarId || "",
        e.lerCode,
        e.designation || "",
        e.quantity || "",
        e.correctedQuantity || "",
        dest?.label || e.destination,
        e.operator || "",
        "",
        "",
        "",
        MONTHS_PT[(e.month || 1) - 1],
      ]);
    });
    const ws3 = wb.addWorksheet("Resumo Mensal");
    ws3.addRow([
      "Mês",
      "Total (t)",
      "Reciclado (t)",
      "Incinerado (t)",
      "Aterro (t)",
      "Taxa Desvio (%)",
    ]);
    monthlySummary.forEach(m => {
      const rate =
        m.total > 0 ? ((m.recycled / m.total) * 100).toFixed(1) : "0.0";
      ws3.addRow([
        MONTHS_PT[m.month - 1],
        m.total.toFixed(3),
        m.recycled.toFixed(3),
        m.incinerated.toFixed(3),
        m.landfill.toFixed(3),
        rate,
      ]);
    });
    const ws4 = wb.addWorksheet("Projeto");
    ws4.addRow(["Projeto", activeProject?.name || ""]);
    ws4.addRow(["Ano", selectedYear]);
    ws4.addRow(["Total Resíduos (t)", totalWaste.toFixed(3)]);
    ws4.addRow(["Total Reciclado (t)", totalRecycled.toFixed(3)]);
    ws4.addRow(["Taxa Desvio Aterro", `${diversionRate}%`]);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MIRR_${activeProject?.code || "projeto"}_${selectedYear}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel MIRR exportado");
  }

  async function handleExportWasteMap() {
    const rows = wasteMapQuery.data || [];
    if (!rows.length) {
      toast.error("Não existem dados de resíduos para o âmbito selecionado.");
      return;
    }
    const byLer = new Map<
      string,
      { designation: string; months: Record<number, number>; total: number }
    >();
    for (const row of rows as any[]) {
      const entry: {
        designation: string;
        months: Record<number, number>;
        total: number;
      } = byLer.get(row.lerCode) || {
        designation: row.designation || "—",
        months: {},
        total: 0,
      };
      const month = Number(row.month);
      entry.months[month] =
        (entry.months[month] || 0) + Number(row.quantity || 0);
      entry.total += Number(row.quantity || 0);
      byLer.set(row.lerCode, entry);
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = "Plataforma de Gestão Ambiental — Start Campus";
    const ws = wb.addWorksheet("Waste Map LER x Mês");
    ws.mergeCells("A1:O1");
    ws.getCell("A1").value =
      `WASTE MAP — ${activeProject?.code || "Projeto"} — ${selectedYear}`;
    ws.getCell("A1").font = {
      bold: true,
      size: 15,
      color: { argb: "FFFFFFFF" },
    };
    ws.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF047857" },
    };
    ws.mergeCells("A2:O2");
    ws.getCell("A2").value = selectedWasteMapCompanies.length
      ? `Entidades selecionadas: ${selectedWasteMapCompanies.length}`
      : "Âmbito: todas as entidades autorizadas";
    const headers = [
      "Código LER",
      "Designação",
      ...MONTHS_PT.map(month => `${month} (${selectedYear})`),
      "Total (t)",
    ];
    ws.addTable({
      name: "WasteMapPorMes",
      ref: "A4",
      headerRow: true,
      style: { theme: "TableStyleMedium4", showRowStripes: true },
      columns: headers.map(name => ({ name })),
      rows: Array.from(byLer.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, row]) => [
          code,
          row.designation,
          ...Array.from(
            { length: 12 },
            (_, index) => Number((row.months[index + 1] || 0).toFixed(3)) || ""
          ),
          Number(row.total.toFixed(3)),
        ]),
    });
    ws.columns = [
      { width: 16 },
      { width: 42 },
      ...Array.from({ length: 13 }, () => ({ width: 14 })),
    ];
    ws.views = [{ state: "frozen", ySplit: 4, xSplit: 2 }];
    const detail = wb.addWorksheet("Detalhe por Entidade");
    detail.addTable({
      name: "WasteMapDetalhe",
      ref: "A1",
      headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [
        "Entidade",
        "Código LER",
        "Designação",
        "Mês",
        "Quantidade (t)",
      ].map(name => ({ name })),
      rows: rows.map((row: any) => [
        row.companyName || "—",
        row.lerCode,
        row.designation || "—",
        MONTHS_PT[Number(row.month) - 1],
        Number(Number(row.quantity || 0).toFixed(3)),
      ]),
    });
    detail.columns = [
      { width: 26 },
      { width: 16 },
      { width: 42 },
      { width: 16 },
      { width: 18 },
    ];
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Waste_Map_${activeProject?.code || "Projeto"}_${selectedYear}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Waste Map exportado com sucesso.");
  }

  function handleCreate() {
    if (!projectId || !newEgar.lerCode || !newEgar.quantity) {
      toast.error(t("Preencha Código LER e Quantidade"));
      return;
    }
    if (!isMIRRPage && subProject === "all") {
      toast.error("Seleccione o subprojecto desta e-GAR.");
      return;
    }
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
      destination: newEgar.destination as
        | "recycled"
        | "incinerated"
        | "landfill",
      month: newEgar.month,
      year: newEgar.year,
    });
  }

  const maxMonthlyTotal = Math.max(
    ...monthlySummary.map(item => item.total),
    1
  );

  return (
    <AppLayout>
      <main
        className="mx-auto max-w-[1600px] space-y-6 pb-8"
        aria-label={pageTitle}
      >
        <StandPageHeader
          eyebrow="Operação ambiental"
          title={pageTitle}
          description={`${pageSubtitle} — ${activeProject?.name || "Projeto"}`}
          context={`Ano de reporte ${selectedYear}`}
          tone="operations"
          actions={
            <div className="flex max-w-4xl flex-wrap items-center justify-start gap-2 lg:justify-end">
              {!isMIRRPage && (subProjects?.length ?? 0) > 0 && (
                <Select value={subProject} onValueChange={setSubProject}>
                  <SelectTrigger
                    className="h-9 w-[180px] border-white/20 bg-card/10 text-xs text-white hover:bg-card/15"
                    aria-label="Selecionar sub-projeto"
                  >
                    <SelectValue placeholder="Sub-projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("Todos")}</SelectItem>
                    {subProjects?.map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.code ? `${item.code} — ` : ""}
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!isMIRRPage && canManageSubprojects && (
                <div className="flex items-center gap-1 rounded-md border border-white/15 bg-card/[0.06] p-1">
                  <Input
                    className="h-7 w-[144px] border-0 bg-transparent px-2 text-xs text-white placeholder:text-white/60 focus-visible:ring-1 focus-visible:ring-white"
                    placeholder={t("Novo sub-projeto...")}
                    value={newSubProject}
                    onChange={e => setNewSubProject(e.target.value)}
                    aria-label={t("Novo sub-projeto...")}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-white hover:bg-card/15 hover:text-white"
                    aria-label={t("Adicionar")}
                    title={t("Adicionar")}
                    disabled={!projectId || createSubprojectMutation.isPending}
                    onClick={() => {
                      if (projectId && newSubProject.trim())
                        createSubprojectMutation.mutate({
                          projectId,
                          name: newSubProject.trim(),
                        });
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Select
                value={String(selectedYear)}
                onValueChange={v => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger
                  className="h-9 w-[108px] border-white/20 bg-card/10 text-xs text-white hover:bg-card/15"
                  aria-label="Selecionar ano de reporte"
                >
                  <CalendarDays className="mr-2 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 13 }, (_, i) => 2023 + i).map(y => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canContribute && (
                <Button
                  type="button"
                  onClick={() => setShowAddForm(!showAddForm)}
                  size="sm"
                  className="h-9 bg-card text-primary hover:bg-primary"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> {t("Nova e-GAR")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-white/20 bg-transparent text-white hover:bg-card/15 hover:text-white"
                onClick={handleExportExcel}
                disabled={!egars || egars.length === 0}
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />{" "}
                {t("Exportar Excel MIRR")}
              </Button>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-primary/75">
            <span className="inline-flex items-center gap-1.5">
              <Recycle className="h-3.5 w-3.5" />
              Registo e rastreabilidade de resíduos
            </span>
            <span className="hidden h-3 w-px bg-card/20 sm:block" />
            <span>{egars?.length || 0} e-GARs no âmbito atual</span>
          </div>
        </StandPageHeader>

        {isPartner && (
          <aside
            className="rounded-xl border border-primary/20 bg-primary/[0.05] p-4 dark:bg-primary/10"
            aria-label="Âmbito de contributo do parceiro"
          >
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-[#0A3638]">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <StandStatusBadge
                  label="Contributo de parceiro"
                  tone="success"
                />
                <p className="mt-2 text-sm font-semibold text-foreground">
                  Contributo de Resíduos do parceiro
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Regista apenas as e-GAR da{" "}
                  {partnerAccessQuery.data?.companyName || "sua empresa"}. A EE{" "}
                  {partnerAccessQuery.data?.parentCompanyName || "principal"} vê
                  estes registos na consolidação por subprojecto.
                </p>
              </div>
            </div>
          </aside>
        )}

        <section
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start"
          aria-labelledby="waste-map-title"
        >
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <p
                    id="waste-map-title"
                    className="text-sm font-semibold text-foreground"
                  >
                    Waste Map por código LER e mês
                  </p>
                </div>
                <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
                  Escolha uma, várias ou todas as entidades autorizadas. A
                  exportação apresenta as toneladas por código LER em cada mês.
                </p>
              </div>
              {selectedWasteMapCompanies.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setSelectedWasteMapCompanies([])}
                >
                  Todas as entidades
                </Button>
              )}
            </div>
            {wasteMapCompanies.length > 0 || hasUnassignedWasteMapRows ? (
              <div
                className="mt-4 flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Filtro de entidades para o Waste Map"
              >
                {wasteMapCompanies.map(([companyId, companyName]) => {
                  const selected =
                    selectedWasteMapCompanies.includes(companyId);
                  return (
                    <Button
                      type="button"
                      key={companyId}
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      className="h-8 text-xs"
                      aria-pressed={selected}
                      onClick={() =>
                        setSelectedWasteMapCompanies(current =>
                          selected
                            ? current.filter(id => id !== companyId)
                            : [...current, companyId]
                        )
                      }
                    >
                      {companyName}
                    </Button>
                  );
                })}
                {hasUnassignedWasteMapRows && (
                  <StandStatusBadge
                    label="Sem entidade atribuída · Administração"
                    tone="warning"
                  />
                )}
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Sem entidades com e-GAR no período selecionado.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 justify-start px-4 text-xs xl:mt-5"
            onClick={handleExportWasteMap}
            disabled={
              wasteMapQuery.isLoading || !(wasteMapQuery.data || []).length
            }
          >
            <Download className="mr-2 h-4 w-4" /> Exportar Waste Map
          </Button>
        </section>

        {showSettings && (
          <section
            className="rounded-xl border border-border bg-card shadow-sm"
            aria-labelledby="mirr-settings-title"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="stand-kicker text-primary">Administração</p>
                <h2
                  id="mirr-settings-title"
                  className="mt-1 text-base font-semibold"
                >
                  {t("Definições MIRR")}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowSettings(false)}
                aria-label="Fechar definições"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-6 p-5 xl:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Códigos LER</h3>
                  <span className="text-xs text-muted-foreground">
                    {lerCodes.length} configurados
                  </span>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2">
                  {lerCodes.map((ler, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs shadow-sm"
                    >
                      <span className="w-16 shrink-0 font-mono font-semibold text-foreground">
                        {ler.code}
                      </span>
                      <Input
                        className="h-7 flex-1 text-xs"
                        aria-label={`Designação do código LER ${ler.code}`}
                        value={ler.name}
                        onChange={e => {
                          const updated = [...lerCodes];
                          updated[i] = { ...ler, name: e.target.value };
                          setLerCodes(updated);
                        }}
                      />
                      {ler.hazardous && (
                        <StandStatusBadge label={t("Perigoso")} tone="danger" />
                      )}
                      <button
                        type="button"
                        className="rounded p-1 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Eliminar código LER ${ler.code}`}
                        onClick={() =>
                          setLerCodes(lerCodes.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[96px_minmax(0,1fr)_auto_auto] sm:items-end">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("Código")}
                    </label>
                    <Input
                      className="h-8 text-xs"
                      value={newLer.code}
                      onChange={e =>
                        setNewLer(p => ({ ...p, code: e.target.value }))
                      }
                      placeholder="170904"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("Designação")}
                    </label>
                    <Input
                      className="h-8 text-xs"
                      value={newLer.name}
                      onChange={e =>
                        setNewLer(p => ({ ...p, name: e.target.value }))
                      }
                      placeholder={t("Nome do resíduo")}
                    />
                  </div>
                  <label className="flex h-8 items-center gap-2 whitespace-nowrap text-xs font-medium">
                    <input
                      className="h-4 w-4 rounded border-input accent-primary"
                      type="checkbox"
                      checked={newLer.hazardous}
                      onChange={e =>
                        setNewLer(p => ({ ...p, hazardous: e.target.checked }))
                      }
                    />{" "}
                    Perigoso
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      if (newLer.code && newLer.name) {
                        setLerCodes([...lerCodes, newLer]);
                        setNewLer({ code: "", name: "", hazardous: false });
                        toast.success(t("Código LER adicionado"));
                      }
                    }}
                  >
                    {t("Adicionar")}
                  </Button>
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Destinos</h3>
                  <span className="text-xs text-muted-foreground">
                    {destinations.length} configurados
                  </span>
                </div>
                <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-2">
                  {destinations.map((dest, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs shadow-sm"
                    >
                      <Input
                        className="h-7 w-24 text-xs"
                        aria-label={`Chave do destino ${dest.label}`}
                        value={dest.key}
                        onChange={e => {
                          const updated = [...destinations];
                          updated[i] = { ...dest, key: e.target.value };
                          setDestinations(updated);
                        }}
                      />
                      <Input
                        className="h-7 min-w-0 flex-1 text-xs"
                        aria-label={`Nome do destino ${dest.label}`}
                        value={dest.label}
                        onChange={e => {
                          const updated = [...destinations];
                          updated[i] = { ...dest, label: e.target.value };
                          setDestinations(updated);
                        }}
                      />
                      <Input
                        className="h-7 w-16 text-xs"
                        aria-label={`Operação do destino ${dest.label}`}
                        value={dest.operation}
                        onChange={e => {
                          const updated = [...destinations];
                          updated[i] = { ...dest, operation: e.target.value };
                          setDestinations(updated);
                        }}
                        placeholder="R13"
                      />
                      <button
                        type="button"
                        className="rounded p-1 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Eliminar destino ${dest.label}`}
                        onClick={() =>
                          setDestinations(
                            destinations.filter((_, j) => j !== i)
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[112px_minmax(0,1fr)_72px_auto] sm:items-end">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("Chave")}
                    </label>
                    <Input
                      className="h-8 text-xs"
                      value={newDest.key}
                      onChange={e =>
                        setNewDest(p => ({ ...p, key: e.target.value }))
                      }
                      placeholder="recovery"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("Nome")}
                    </label>
                    <Input
                      className="h-8 text-xs"
                      value={newDest.label}
                      onChange={e =>
                        setNewDest(p => ({ ...p, label: e.target.value }))
                      }
                      placeholder={t("Valorização")}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("Operação")}
                    </label>
                    <Input
                      className="h-8 text-xs"
                      value={newDest.operation}
                      onChange={e =>
                        setNewDest(p => ({ ...p, operation: e.target.value }))
                      }
                      placeholder="R4"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      if (newDest.key && newDest.label) {
                        setDestinations([...destinations, newDest]);
                        setNewDest({ key: "", label: "", operation: "" });
                        toast.success("Destino adicionado");
                      }
                    }}
                  >
                    {t("Adicionar")}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section
          aria-label="Indicadores MIRR"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StandMetricCard
            label={t("Total Resíduos (t)")}
            value={totalWaste.toFixed(3)}
            detail={`Âmbito selecionado · ${selectedYear}`}
            icon={Recycle}
            tone="brand"
          />
          <StandMetricCard
            label={t("Reciclado (t)")}
            value={totalRecycled.toFixed(3)}
            detail="Encaminhado para reciclagem"
            icon={Recycle}
            tone="success"
          />
          <StandMetricCard
            label={t("Taxa Desvio Aterro")}
            value={`${diversionRate}%`}
            detail="Percentagem reciclada do total"
            icon={BarChart3}
            tone="info"
          />
          <StandMetricCard
            label={t("e-GARs Registadas")}
            value={egars?.length || 0}
            detail={`Registos para ${selectedYear}`}
            icon={FileCheck2}
            tone="warning"
          />
        </section>

        <section
          className="rounded-xl border border-border bg-card shadow-sm"
          aria-labelledby="monthly-chart-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <p className="stand-kicker text-primary">Tendência operacional</p>
              <h2
                id="monthly-chart-title"
                className="mt-1 text-base font-semibold"
              >
                Resíduos por Mês ({selectedYear})
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Distribuição mensal por destino final, em toneladas.
              </p>
            </div>
            <div
              className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground"
              aria-label="Legenda do gráfico"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary" />{" "}
                {t(t("Reciclado"))}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#EDEBEB]" />{" "}
                {t(t("Incinerado"))}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />{" "}
                {t(t("Aterro"))}
              </span>
            </div>
          </div>
          <div className="p-5">
            <p className="sr-only">
              Gráfico com os resíduos mensais, divididos entre reciclagem,
              incineração e aterro.
            </p>
            <div
              className="grid grid-cols-6 gap-x-2 gap-y-5 sm:grid-cols-12"
              role="list"
              aria-label="Resumo mensal de resíduos"
            >
              {monthlySummary.map(m => (
                <div
                  key={m.month}
                  className="min-w-0 text-center"
                  role="listitem"
                  aria-label={`${MONTHS_PT[m.month - 1]}: ${m.total.toFixed(3)} toneladas; reciclado ${m.recycled.toFixed(3)}, incinerado ${m.incinerated.toFixed(3)}, aterro ${m.landfill.toFixed(3)}`}
                >
                  <div className="flex h-36 items-end justify-center rounded-md border border-border/70 bg-muted/20 px-2 pb-2 pt-2">
                    {m.total > 0 ? (
                      <div className="flex h-full w-full max-w-7 flex-col justify-end overflow-hidden rounded-sm">
                        {m.landfill > 0 && (
                          <div
                            className="bg-rose-500"
                            style={{
                              height: `${(m.landfill / maxMonthlyTotal) * 100}%`,
                              minHeight: "3px",
                            }}
                          />
                        )}
                        {m.incinerated > 0 && (
                          <div
                            className="bg-[#EDEBEB]"
                            style={{
                              height: `${(m.incinerated / maxMonthlyTotal) * 100}%`,
                              minHeight: "3px",
                            }}
                          />
                        )}
                        {m.recycled > 0 && (
                          <div
                            className="bg-primary"
                            style={{
                              height: `${(m.recycled / maxMonthlyTotal) * 100}%`,
                              minHeight: "3px",
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <span
                        className="mb-0.5 h-px w-full bg-border"
                        aria-hidden
                      />
                    )}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-foreground">
                    {MONTHS_PT[m.month - 1]}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {m.total.toFixed(3)} t
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {showAddForm && (
          <section
            className="rounded-xl border border-primary/25 bg-card shadow-sm"
            aria-labelledby="new-egar-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="stand-kicker text-primary">Novo registo</p>
                <h2
                  id="new-egar-title"
                  className="mt-1 text-base font-semibold"
                >
                  {t("Registar Nova e-GAR")}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Os campos de Código LER e Quantidade são obrigatórios.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setShowAddForm(false)}
              >
                {t("Cancelar")}
              </Button>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Data")}
                  </label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={newEgar.date}
                    onChange={e =>
                      setNewEgar(p => ({ ...p, date: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    N.º e-GAR
                  </label>
                  <Input
                    className="h-9 text-sm"
                    value={newEgar.egarId}
                    onChange={e =>
                      setNewEgar(p => ({ ...p, egarId: e.target.value }))
                    }
                    placeholder="Ex: EGAR-2026-001"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Link e-GAR")}
                  </label>
                  <Input
                    className="h-9 text-sm"
                    value={newEgar.egarLink}
                    onChange={e =>
                      setNewEgar(p => ({ ...p, egarLink: e.target.value }))
                    }
                    placeholder="URL do portal"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Mês")}
                  </label>
                  <Select
                    value={String(newEgar.month)}
                    onValueChange={v =>
                      setNewEgar(p => ({ ...p, month: parseInt(v) }))
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS_PT.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Operador de Transporte")}
                  </label>
                  <Input
                    className="h-9 text-sm"
                    value={newEgar.operatorTransport}
                    onChange={e =>
                      setNewEgar(p => ({
                        ...p,
                        operatorTransport: e.target.value,
                      }))
                    }
                    placeholder="Ex: Ambigroup"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Cód. APA Transporte")}
                  </label>
                  <Input
                    className="h-9 text-sm"
                    value={newEgar.operatorTransportAPA}
                    onChange={e =>
                      setNewEgar(p => ({
                        ...p,
                        operatorTransportAPA: e.target.value,
                      }))
                    }
                    placeholder="Ex: APA-T-12345"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Operador de Receção")}
                  </label>
                  <Input
                    className="h-9 text-sm"
                    value={newEgar.operatorReception}
                    onChange={e =>
                      setNewEgar(p => ({
                        ...p,
                        operatorReception: e.target.value,
                      }))
                    }
                    placeholder="Ex: Valorsul"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Cód. APA Receção")}
                  </label>
                  <Input
                    className="h-9 text-sm"
                    value={newEgar.operatorReceptionAPA}
                    onChange={e =>
                      setNewEgar(p => ({
                        ...p,
                        operatorReceptionAPA: e.target.value,
                      }))
                    }
                    placeholder="Ex: APA-R-67890"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Código LER")}
                  </label>
                  <Select
                    value={newEgar.lerCode}
                    onValueChange={v => {
                      setNewEgar(p => ({
                        ...p,
                        lerCode: v,
                        designation:
                          lerCodes.find(l => l.code === v)?.name || "",
                      }));
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {lerCodes.map(l => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.code} — {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Quantidade Original (t)")}
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    className="h-9 text-sm"
                    value={newEgar.quantity}
                    onChange={e =>
                      setNewEgar(p => ({ ...p, quantity: e.target.value }))
                    }
                    placeholder="0.000"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Quantidade Corrigida (t)")}
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    className="h-9 text-sm"
                    value={newEgar.correctedQuantity}
                    onChange={e =>
                      setNewEgar(p => ({
                        ...p,
                        correctedQuantity: e.target.value,
                      }))
                    }
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Destino Final")}
                  </label>
                  <Select
                    value={newEgar.destination}
                    onValueChange={v =>
                      setNewEgar(p => ({ ...p, destination: v }))
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {destinations.map(d => (
                        <SelectItem key={d.key} value={d.key}>
                          {d.label} ({d.operation})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {t("Registar e-GAR")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  O registo ficará disponível na consolidação do projeto.
                </p>
              </div>
            </div>
          </section>
        )}

        <section
          className="rounded-xl border border-border bg-card shadow-sm"
          aria-labelledby="egar-table-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="stand-kicker text-primary">Registo auditável</p>
              <h2
                id="egar-table-title"
                className="mt-1 text-base font-semibold"
              >
                e-GARs Registadas ({selectedYear})
              </h2>
            </div>
            <StandStatusBadge
              label={`${egars?.length || 0} registos`}
              tone={egars?.length ? "success" : "neutral"}
            />
          </div>
          {!egars || egars.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium">
                Nenhuma e-GAR registada para {selectedYear}.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clique "Nova e-GAR" para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/35 text-left">
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {t("Data")}
                    </th>
                    {!isMIRRPage && (
                      <th
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Subprojecto
                      </th>
                    )}
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Entidade
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      N.º e-GAR
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {t("LER")}
                    </th>
                    <th
                      scope="col"
                      className="min-w-48 px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {t("Designação")}
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {t("Qtd (t)")}
                    </th>
                    <th
                      scope="col"
                      className="min-w-52 px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {t("Operadores")}
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {t("Destino")}
                    </th>
                    {canContribute && (
                      <th scope="col" className="w-12 px-4 py-3">
                        <span className="sr-only">Ações</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {egars.map((e: any) => {
                    const dest = destinations.find(
                      d => d.key === e.destination
                    );
                    const destinationTone =
                      e.destination === "recycled"
                        ? "success"
                        : e.destination === "landfill"
                          ? "danger"
                          : "warning";
                    return (
                      <tr
                        key={e.id}
                        className="border-b border-border/80 last:border-0 hover:bg-muted/25"
                      >
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-foreground">
                          {e.date
                            ? new Date(Number(e.date)).toLocaleDateString(
                                "pt-PT"
                              )
                            : "—"}
                        </td>
                        {!isMIRRPage && (
                          <td className="px-4 py-3">
                            <StandStatusBadge
                              label={e.subProjectName || "Sem subprojecto"}
                              tone="neutral"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-muted-foreground">
                          {e.companyName || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">
                          {e.egarLink ? (
                            <a
                              href={e.egarLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                            >
                              {e.egarId || "Ver"}
                            </a>
                          ) : (
                            e.egarId || "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-foreground">
                          {e.lerCode}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {e.designation || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                          {e.correctedQuantity ? (
                            <>
                              <span className="text-primary dark:text-primary">
                                {e.correctedQuantity}
                              </span>{" "}
                              <span className="ml-1 text-xs font-normal text-muted-foreground line-through">
                                {e.quantity}
                              </span>
                            </>
                          ) : (
                            e.quantity
                          )}
                        </td>
                        <td className="px-4 py-3 leading-5 text-muted-foreground">
                          {e.operator || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StandStatusBadge
                            label={dest?.label || e.destination}
                            tone={destinationTone}
                          />
                        </td>
                        {canContribute && (
                          <td className="px-4 py-3 text-right">
                            {(() => {
                              const ownsRecord =
                                e.createdBy === user?.id ||
                                (user?.companyId &&
                                  e.companyId === user.companyId);
                              const withinWindow =
                                new Date(e.createdAt).getTime() +
                                  48 * 60 * 60 * 1000 >
                                Date.now();
                              const canDelete =
                                isAdminOrDono || (ownsRecord && withinWindow);
                              return canDelete ? (
                                <button
                                  type="button"
                                  title={
                                    isAdminOrDono
                                      ? "Eliminar e-GAR"
                                      : "Eliminar até 48 horas após o registo"
                                  }
                                  aria-label={`Eliminar ${e.egarId || `e-GAR #${e.id}`}`}
                                  onClick={() =>
                                    setEgarPendingDelete({
                                      id: e.id,
                                      label: e.egarId || `e-GAR #${e.id}`,
                                    })
                                  }
                                  className="rounded p-1.5 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <span className="whitespace-nowrap text-xs text-muted-foreground">
                                  48 h expiradas
                                </span>
                              );
                            })()}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {canContribute && isAdminOrDono && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".pdf,.xlsx,.csv";
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file)
                    toast.info(
                      t("Importação de e-GAR via ficheiro em desenvolvimento.")
                    );
                };
                input.click();
              }}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" /> {t("Importar e-GAR")}
            </Button>
            {isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="mr-1.5 h-3.5 w-3.5" /> {t("Definições")}
              </Button>
            )}
          </div>
        )}
        <AlertDialog
          open={!!egarPendingDelete}
          onOpenChange={open => !open && setEgarPendingDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar e-GAR?</AlertDialogTitle>
              <AlertDialogDescription>
                A e-GAR <strong>{egarPendingDelete?.label}</strong> será
                eliminada. Esta ação fica registada em auditoria e não pode ser
                revertida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
                onClick={() =>
                  egarPendingDelete &&
                  deleteMutation.mutate({ id: egarPendingDelete.id })
                }
              >
                {deleteMutation.isPending ? "A eliminar…" : "Eliminar e-GAR"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </AppLayout>
  );
}
