import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { CheckCircle2, Circle, FileText, AlertTriangle, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// === LEED O&M v4.1 Data ===
const LEED_CATEGORIES = [
  { name: "Informação do Edifício", items: [
    { id: "L1", label: "Área construída excluindo estacionamento", unit: "m² (GFA)", granularity: "Valor único" },
    { id: "L2", label: "Lista de inquilinos e nº total de ocupantes por inquilino (FTE + visitantes)", unit: "headcount", granularity: "Por inquilino" },
    { id: "L3", label: "Nº médio diário de visitantes", unit: "pessoas/dia", granularity: "Média diária" },
    { id: "L4", label: "Horas de operação semanais do edifício", unit: "h/semana", granularity: "Por zona AVAC" },
    { id: "L5", label: "Plantas de todos os pisos (MEP e arquitetura, com áreas demarcadas)", unit: "DWG/PDF", granularity: "Por piso" },
  ]},
  { name: "Local (Site)", items: [
    { id: "L6", label: "Volume da cisterna de águas pluviais e esquema de reutilização", unit: "m³", granularity: "Esquema + volume" },
    { id: "L7", label: "Planta do local: áreas vegetadas, pedonais, veículos, estacionamento", unit: "m² por tipologia", granularity: "Planta com áreas" },
    { id: "L8", label: "Fichas técnicas de acabamentos de superfície (SR/SRI)", unit: "SR ou SRI", granularity: "Por material" },
    { id: "L9", label: "Plano de iluminação exterior e fichas técnicas de luminárias", unit: "W, lm, BUG, CCT", granularity: "Por luminária" },
  ]},
  { name: "Consumos", items: [
    { id: "L10", label: "Registos de consumo de energia dos últimos 12 meses", unit: "kWh", granularity: "Mensal, por contador" },
    { id: "L11", label: "Registos de consumo de água dos últimos 12 meses", unit: "m³", granularity: "Mensal, por contador" },
  ]},
  { name: "Sistemas do Edifício", items: [
    { id: "L12", label: "Auditoria energética ASHRAE Nível 1 (últimos 5 anos)", unit: "Relatório", granularity: "Documento completo" },
    { id: "L13", label: "Inventário de equipamentos com refrigerante (tipo, carga, GWP)", unit: "kg, GWP", granularity: "Por equipamento" },
    { id: "L14", label: "Lista de equipamentos de ventilação e fichas técnicas", unit: "m³/h", granularity: "Por UTA/ventilador" },
    { id: "L15", label: "Auditoria de qualidade do ar interior (caudais, COVs, CO2)", unit: "ppm, μg/m³", granularity: "Por zona" },
  ]},
  { name: "Resíduos", items: [
    { id: "L16", label: "Certificados de gestão de RSU e resíduos desviados (12 meses)", unit: "kg, %", granularity: "Mensal, por fluxo" },
  ]},
  { name: "Políticas e Planos", items: [
    { id: "L17", label: "Plano de Gestão do Local (Site Management Plan)", unit: "Documento", granularity: "Anual" },
    { id: "L18", label: "Política de Limpeza Verde (Green Cleaning Policy)", unit: "Documento", granularity: "Anual" },
    { id: "L19", label: "Política de Compras Sustentáveis", unit: "Documento", granularity: "Anual" },
    { id: "L20", label: "Plano Integrado de Gestão de Pragas (IPM)", unit: "Documento", granularity: "Anual" },
    { id: "L21", label: "Política de Controlo de Tabaco", unit: "Documento", granularity: "Anual" },
  ]},
];

// === EED — Diretiva (UE) 2023/1791, Art. 12.º ===
const EED_CATEGORIES = [
  { name: "Informação Geral da Instalação", items: [
    { id: "E1", label: "Nome e localização do centro de dados", unit: "Texto", granularity: "Identificação" },
    { id: "E2", label: "Potência instalada de TI", unit: "kW", granularity: "Total do site" },
    { id: "E3", label: "Área útil do centro de dados", unit: "m²", granularity: "Total" },
    { id: "E4", label: "Data de início de operação", unit: "Data", granularity: "Ano" },
    { id: "E5", label: "Proprietário/operador e contacto", unit: "Texto", granularity: "Identificação" },
  ]},
  { name: "Capacidade de TI e Tráfego de Dados", items: [
    { id: "E6", label: "Capacidade de computação instalada (racks/servidores)", unit: "racks", granularity: "Total" },
    { id: "E7", label: "Tráfego de dados (entrada + saída)", unit: "TB/ano", granularity: "Anual" },
    { id: "E8", label: "Volume de dados armazenados", unit: "PB", granularity: "Snapshot anual" },
  ]},
  { name: "Indicadores de Energia e Sustentabilidade", items: [
    { id: "E9", label: "PUE — Power Usage Effectiveness", unit: "ratio", granularity: "Anual (média)" },
    { id: "E10", label: "Consumo total de energia do site", unit: "MWh/ano", granularity: "Anual" },
    { id: "E11", label: "Consumo de energia de TI", unit: "MWh/ano", granularity: "Anual" },
    { id: "E12", label: "REF — Renewable Energy Factor", unit: "%", granularity: "Anual" },
    { id: "E13", label: "ERF — Energy Reuse Factor", unit: "%", granularity: "Anual" },
    { id: "E14", label: "CUE — Carbon Usage Effectiveness", unit: "kgCO2/kWh", granularity: "Anual" },
    { id: "E15", label: "Temperatura de referência das salas de dados", unit: "°C", granularity: "Setpoint" },
  ]},
  { name: "Água", items: [
    { id: "E16", label: "WUE — Water Usage Effectiveness", unit: "L/kWh", granularity: "Anual" },
    { id: "E17", label: "Consumo total de água do site", unit: "m³/ano", granularity: "Anual" },
    { id: "E18", label: "Fonte de água (rede, furo, reutilizada)", unit: "Texto + %", granularity: "Por fonte" },
  ]},
  { name: "Submissão e Publicação", items: [
    { id: "E19", label: "Relatório anual submetido à DGEG", unit: "Documento", granularity: "Até 15 maio" },
    { id: "E20", label: "Publicação na base de dados europeia (EBDC)", unit: "Confirmação", granularity: "Anual" },
  ]},
];

// === CELE — EU ETS (Geradores de Emergência) ===
const CELE_CATEGORIES = [
  { name: "Características dos Geradores (Dados de Entrada)", items: [
    { id: "C1", label: "Inventário de geradores (marca, modelo, potência, ano)", unit: "Lista", granularity: "Por gerador" },
    { id: "C2", label: "Título de emissão de GEE (TEGEE) — nº e validade", unit: "Documento", granularity: "Por instalação" },
    { id: "C3", label: "Tipo de combustível por gerador (diesel, gás natural)", unit: "Texto", granularity: "Por gerador" },
    { id: "C4", label: "Capacidade do depósito de combustível", unit: "litros", granularity: "Por gerador" },
    { id: "C5", label: "Regime de funcionamento (ensaio semanal, emergência)", unit: "Texto", granularity: "Por gerador" },
  ]},
  { name: "Dados Anuais de Atividade (Dados de Saída)", items: [
    { id: "C6", label: "Horas de funcionamento em ensaio (12 meses)", unit: "horas", granularity: "Por gerador, mensal" },
    { id: "C7", label: "Horas de funcionamento em emergência (12 meses)", unit: "horas", granularity: "Por gerador, mensal" },
    { id: "C8", label: "Combustível consumido em ensaios", unit: "litros", granularity: "Anual, por gerador" },
    { id: "C9", label: "Combustível consumido em emergência", unit: "litros", granularity: "Anual, por gerador" },
    { id: "C10", label: "Emissões de CO2 resultantes (cálculo: litros × FE × densidade)", unit: "tCO2", granularity: "Anual" },
  ]},
  { name: "Plano de Monitorização e Documentação", items: [
    { id: "C11", label: "Plano de monitorização aprovado pela APA", unit: "Documento", granularity: "Válido até revisão" },
    { id: "C12", label: "Relatório Anual de Emissões (RAE) submetido via SIRAPA", unit: "Documento", granularity: "Até 31 março" },
    { id: "C13", label: "Parecer de verificação por entidade acreditada", unit: "Documento", granularity: "Anual" },
    { id: "C14", label: "Devolução de licenças de emissão (se aplicável)", unit: "Confirmação", granularity: "Até 30 abril" },
  ]},
];

// Points map for LEED
const LEED_TIERS = [
  { level: "Certified", points: "40–49", color: "bg-gray-100" },
  { level: "Silver", points: "50–59", color: "bg-gray-200" },
  { level: "Gold", points: "60–79", color: "bg-amber-100" },
  { level: "Platinum", points: "80–100", color: "bg-emerald-100" },
];

export default function Certifications() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const isAdmin = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "pm";

  const [itemStates, setItemStates] = useState<Record<string, { status: string; notes: string }>>({});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const updateItemState = (id: string, field: string, value: string) => {
    setItemStates(prev => ({ ...prev, [id]: { ...prev[id], status: prev[id]?.status || "pending", notes: prev[id]?.notes || "", [field]: value } }));
  };

  const getStatusIcon = (status: string) => {
    if (status === "done") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === "progress") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <Circle className="w-4 h-4 text-gray-300" />;
  };

  const renderItems = (items: { id: string; label: string; unit: string; granularity: string }[]) => (
    <div className="space-y-2">
      {items.map(item => {
        const state = itemStates[item.id] || { status: "pending", notes: "" };
        const isExpanded = expandedItem === item.id;
        return (
          <div key={item.id} className="border rounded-lg overflow-hidden">
            <div className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
              {getStatusIcon(state.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{item.unit}</Badge>
                  <span className="text-xs text-muted-foreground">{item.granularity}</span>
                </div>
              </div>
              <Badge variant={state.status === "done" ? "default" : state.status === "progress" ? "secondary" : "outline"} className="text-xs shrink-0">
                {state.status === "done" ? "Concluído" : state.status === "progress" ? "Em Curso" : "Pendente"}
              </Badge>
            </div>
            {isExpanded && (
              <div className="border-t p-3 bg-gray-50/50 space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" name={item.id} checked={state.status === "done"} onChange={() => updateItemState(item.id, "status", "done")} className="accent-green-600" />
                    <span className="text-green-700 font-medium">{t("Concluído")}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" name={item.id} checked={state.status === "progress"} onChange={() => updateItemState(item.id, "status", "progress")} className="accent-amber-600" />
                    <span className="text-amber-700 font-medium">{t("Em Curso")}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" name={item.id} checked={state.status === "pending"} onChange={() => updateItemState(item.id, "status", "pending")} className="accent-gray-400" />
                    <span className="text-gray-600">{t("Pendente")}</span>
                  </label>
                  <input type="text" placeholder="Notas rápidas..." className="flex-1 h-7 text-xs border rounded px-2" value={state.notes} onChange={e => updateItemState(item.id, "notes", e.target.value)} />
                </div>
                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">💬 Comentários (0)</span>
                  <span className="flex items-center gap-1">📷 Fotos (0)</span>
                  <span className="flex items-center gap-1">📎 Ficheiros (0)</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-1">
                    <input type="text" placeholder="Adicionar comentário..." className="flex-1 h-8 text-xs border rounded px-2" />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">📤</Button>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => toast.info("Upload de fotos disponível quando ligado ao SharePoint")}>
                    📷 Adicionar Foto
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => toast.info("Upload de ficheiros disponível quando ligado ao SharePoint")}>
                    📎 Anexar Ficheiro
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("Certificações — SIN01 NEST")}</h1>
          <p className="text-muted-foreground">LEED O&M v4.1 · EED (Art. 12.º Dir. 2023/1791) · CELE (EU ETS)</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-green-600" />
                <span className="font-semibold">{t("LEED O&M v4.1")}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{LEED_CATEGORIES.reduce((s, c) => s + c.items.length, 0)} itens de dados · 6 categorias</p>
              <p className="text-xs text-muted-foreground">100 pontos possíveis · Submissão via Arc/LEED Online</p>
              <div className="flex gap-1 mt-2">
                {LEED_TIERS.map(t => (
                  <Badge key={t.level} variant="outline" className={`text-[10px] ${t.color}`}>{t.level} {t.points}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-semibold">{t("EED — Centros de Dados")}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{EED_CATEGORIES.reduce((s, c) => s + c.items.length, 0)} itens · 5 categorias · 24 KPIs</p>
              <p className="text-xs text-muted-foreground">Art. 12.º Dir. (UE) 2023/1791 · Submissão à DGEG até 15 maio</p>
              <Badge variant="outline" className="mt-2 text-[10px] bg-blue-50">Aplica-se a DC ≥ 500 kW TI</Badge>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-orange-600" />
                <span className="font-semibold">{t("CELE — EU ETS")}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{CELE_CATEGORIES.reduce((s, c) => s + c.items.length, 0)} itens · 3 categorias · Geradores de emergência</p>
              <p className="text-xs text-muted-foreground">RAE via SIRAPA/APA até 31 março · Licenças até 30 abril</p>
              <Badge variant="outline" className="mt-2 text-[10px] bg-orange-50">{t("Instalações com TEGEE")}</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Admin Note */}
        {isAdmin && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 flex items-start gap-3">
              <FileText className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">Itens estáticos (informação que não muda anualmente) podem ser submetidos uma vez e ficam validados permanentemente. Ao submeter, pode incluir texto descritivo, documentos (PDF/Word) ou imagens como evidência.</p>
            </CardContent>
          </Card>
        )}

        {/* Shared Data Note */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">Dados comuns entre certificações (ex: consumo de energia, água) são submetidos uma única vez e partilhados automaticamente entre LEED, EED e CELE.</p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="leed">{t("LEED O&M v4.1")}</TabsTrigger>
            <TabsTrigger value="eed">EED</TabsTrigger>
            <TabsTrigger value="cele">CELE</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Progresso por Certificação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "LEED O&M v4.1", total: LEED_CATEGORIES.reduce((s, c) => s + c.items.length, 0), color: "bg-green-500", deadline: "Anual — Arc/LEED Online" },
                  { name: "EED", total: EED_CATEGORIES.reduce((s, c) => s + c.items.length, 0), color: "bg-blue-500", deadline: "Até 15 maio — DGEG" },
                  { name: "CELE", total: CELE_CATEGORIES.reduce((s, c) => s + c.items.length, 0), color: "bg-orange-500", deadline: "RAE até 31 março — APA/SIRAPA" },
                ].map(cert => (
                  <div key={cert.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{cert.name}</span>
                      <span className="text-xs text-muted-foreground">{cert.deadline}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                        <div className={`${cert.color} h-2.5 rounded-full`} style={{ width: "0%" }}></div>
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">0/{cert.total}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Próximos Prazos</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 border rounded"><Badge className="bg-orange-100 text-orange-800 text-xs">CELE</Badge><span className="text-sm flex-1">RAE — Relatório Anual de Emissões</span><span className="text-xs text-muted-foreground">31 março</span></div>
                  <div className="flex items-center gap-3 p-2 border rounded"><Badge className="bg-orange-100 text-orange-800 text-xs">CELE</Badge><span className="text-sm flex-1">Devolução de licenças de emissão</span><span className="text-xs text-muted-foreground">30 abril</span></div>
                  <div className="flex items-center gap-3 p-2 border rounded"><Badge className="bg-blue-100 text-blue-800 text-xs">EED</Badge><span className="text-sm flex-1">Relatório anual à DGEG</span><span className="text-xs text-muted-foreground">15 maio</span></div>
                  <div className="flex items-center gap-3 p-2 border rounded"><Badge className="bg-green-100 text-green-800 text-xs">LEED</Badge><span className="text-sm flex-1">Submissão de dados de performance (Arc)</span><span className="text-xs text-muted-foreground">Contínuo</span></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leed" className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
              <p className="text-xs text-green-800"><strong>LEED O&M v4.1 — Existing Buildings</strong> · 90 pontos de performance + 10 pontos de créditos. Submissão contínua via plataforma Arc. Dados de 12 meses de operação.</p>
            </div>
            {LEED_CATEGORIES.map(cat => (
              <Card key={cat.name}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{cat.name}</CardTitle></CardHeader>
                <CardContent>{renderItems(cat.items)}</CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="eed" className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <p className="text-xs text-blue-800"><strong>EED — Relato de Sustentabilidade de Centros de Dados</strong> · Art. 12.º da Diretiva (UE) 2023/1791. Aplica-se a centros de dados com potência TI ≥ 500 kW. 24 KPIs em 3 blocos: energia, água, resíduos. Submissão anual à DGEG até 15 de maio.</p>
            </div>
            {EED_CATEGORIES.map(cat => (
              <Card key={cat.name}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{cat.name}</CardTitle></CardHeader>
                <CardContent>{renderItems(cat.items)}</CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="cele" className="space-y-4">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mb-4">
              <p className="text-xs text-orange-800"><strong>CELE — Comércio Europeu de Licenças de Emissão (EU ETS)</strong> · Aplica-se a instalações com título de emissão de GEE (TEGEE). Os geradores de emergência funcionam poucas horas/ano e qualificam-se tipicamente como fontes de minimis. RAE submetido via SIRAPA até 31 de março.</p>
            </div>
            {CELE_CATEGORIES.map(cat => (
              <Card key={cat.name}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{cat.name}</CardTitle></CardHeader>
                <CardContent>{renderItems(cat.items)}</CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
