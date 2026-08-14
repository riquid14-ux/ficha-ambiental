import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle2, Circle, Upload, FileText, AlertTriangle, Link2 } from "lucide-react";

// Data items shared across certifications
const CERT_DATA_ITEMS = [
  // Building info (LEED)
  { key: "built_area", label: "Área construída (excl. estacionamento)", unit: "m²", category: "Edifício", usedBy: "leed" },
  { key: "occupants", label: "Nº total de ocupantes (FTE)", unit: "pessoas", category: "Edifício", usedBy: "leed" },
  { key: "visitors_daily", label: "Visitantes diários (média)", unit: "pessoas/dia", category: "Edifício", usedBy: "leed" },
  { key: "operating_hours", label: "Horas de operação semanais", unit: "h/semana", category: "Edifício", usedBy: "leed" },
  // Energy (shared LEED + EED + CELE)
  { key: "energy_12m", label: "Consumo de energia (12 meses)", unit: "kWh", category: "Energia", usedBy: "all" },
  { key: "energy_renewable", label: "Energia renovável consumida", unit: "kWh", category: "Energia", usedBy: "leed,eed" },
  { key: "pue", label: "PUE — Power Usage Effectiveness", unit: "ratio", category: "Energia", usedBy: "eed" },
  { key: "ref_factor", label: "REF — Renewable Energy Factor", unit: "%", category: "Energia", usedBy: "eed" },
  { key: "erf", label: "ERF — Energy Reuse Factor", unit: "%", category: "Energia", usedBy: "eed" },
  { key: "it_power", label: "Potência instalada de TI", unit: "kW", category: "Energia", usedBy: "eed" },
  // Water (shared LEED + EED)
  { key: "water_12m", label: "Consumo de água (12 meses)", unit: "m³", category: "Água", usedBy: "leed,eed" },
  { key: "wue", label: "WUE — Water Usage Effectiveness", unit: "L/kWh", category: "Água", usedBy: "eed" },
  { key: "rainwater_volume", label: "Volume cisterna águas pluviais", unit: "m³", category: "Água", usedBy: "leed" },
  // Emissions (CELE)
  { key: "generators_inventory", label: "Inventário de geradores (título GEE)", unit: "documento", category: "Emissões", usedBy: "cele" },
  { key: "fuel_tests", label: "Combustível consumido em ensaios (12 meses)", unit: "litros", category: "Emissões", usedBy: "cele" },
  { key: "fuel_emergency", label: "Combustível em operação de emergência", unit: "litros", category: "Emissões", usedBy: "cele" },
  { key: "co2_emissions", label: "Emissões de CO2 resultantes", unit: "tCO2", category: "Emissões", usedBy: "cele" },
  { key: "monitoring_plan", label: "Plano de monitorização aprovado", unit: "documento", category: "Emissões", usedBy: "cele" },
  { key: "annual_report", label: "Relatório Anual de Emissões (RAE)", unit: "documento", category: "Emissões", usedBy: "cele" },
  { key: "verification_report", label: "Parecer de verificação", unit: "documento", category: "Emissões", usedBy: "cele" },
  // Waste (LEED)
  { key: "waste_12m", label: "Resíduos gerados e desviados (12 meses)", unit: "kg", category: "Resíduos", usedBy: "leed" },
  // IAQ (LEED)
  { key: "iaq_audit", label: "Auditoria qualidade do ar interior", unit: "documento", category: "Qualidade Ar", usedBy: "leed" },
  { key: "refrigerant_inventory", label: "Inventário de refrigerantes", unit: "documento", category: "Refrigerantes", usedBy: "leed" },
  // EED specific
  { key: "data_traffic", label: "Tráfego de dados (entrada/saída)", unit: "TB", category: "TI", usedBy: "eed" },
  { key: "compute_capacity", label: "Capacidade de computação instalada", unit: "racks", category: "TI", usedBy: "eed" },
  { key: "temp_reference", label: "Temperatura de referência salas de dados", unit: "°C", category: "TI", usedBy: "eed" },
  // Policies (LEED)
  { key: "site_mgmt_plan", label: "Plano de Gestão do Local", unit: "documento", category: "Políticas", usedBy: "leed" },
  { key: "green_cleaning", label: "Política de Limpeza Verde", unit: "documento", category: "Políticas", usedBy: "leed" },
  { key: "purchasing_policy", label: "Política de Compras Sustentáveis", unit: "documento", category: "Políticas", usedBy: "leed" },
  { key: "ipm_plan", label: "Plano Integrado de Gestão de Pragas", unit: "documento", category: "Políticas", usedBy: "leed" },
  { key: "no_smoking", label: "Política de Controlo de Tabaco", unit: "documento", category: "Políticas", usedBy: "leed" },
];

export default function Certifications() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const isAdmin = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "pm";

  // Group items by category
  const categories = useMemo(() => {
    const cats = new Map<string, typeof CERT_DATA_ITEMS>();
    CERT_DATA_ITEMS.forEach(item => {
      if (!cats.has(item.category)) cats.set(item.category, []);
      cats.get(item.category)!.push(item);
    });
    return cats;
  }, []);

  const getItemsForCert = (cert: string) => {
    return CERT_DATA_ITEMS.filter(item => item.usedBy === "all" || item.usedBy.includes(cert));
  };

  const leedItems = getItemsForCert("leed");
  const eedItems = getItemsForCert("eed");
  const celeItems = getItemsForCert("cele");

  // Shared items (used by more than one certification)
  const sharedItems = CERT_DATA_ITEMS.filter(item => {
    const certs = item.usedBy === "all" ? ["leed", "eed", "cele"] : item.usedBy.split(",");
    return certs.length > 1;
  });

  const renderDataItem = (item: typeof CERT_DATA_ITEMS[0], showCerts = false) => (
    <div key={item.key} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
      <Circle className="w-4 h-4 text-gray-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.unit} {showCerts && <span className="ml-2">→ {item.usedBy === "all" ? "LEED + EED + CELE" : item.usedBy.toUpperCase().replace(",", " + ")}</span>}</p>
      </div>
      {isAdmin && (
        <Button variant="outline" size="sm" className="text-xs" onClick={() => { setEditingItem(item.key); setEditValue(""); }}>
          <Upload className="w-3 h-3 mr-1" /> Submeter
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Certificações</h1>
        <p className="text-muted-foreground">LEED O&M v4.1 · EED · CELE — Gestão integrada de dados e submissões</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-sm">LEED O&M v4.1</span>
            </div>
            <p className="text-xs text-muted-foreground">{leedItems.length} itens de dados · 100 pontos possíveis</p>
            <Badge variant="outline" className="mt-2 text-xs">Anual — Arc/LEED Online</Badge>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-sm">EED — Centros de Dados</span>
            </div>
            <p className="text-xs text-muted-foreground">{eedItems.length} itens · Art. 12.º Dir. 2023/1791</p>
            <Badge variant="outline" className="mt-2 text-xs">Anual — até 15 maio · DGEG</Badge>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-orange-600" />
              <span className="font-semibold text-sm">CELE — EU ETS</span>
            </div>
            <p className="text-xs text-muted-foreground">{celeItems.length} itens · Geradores de emergência</p>
            <Badge variant="outline" className="mt-2 text-xs">Anual — ~31 março · APA/SIRAPA</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Shared Data Alert */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4 flex items-start gap-3">
          <Link2 className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Dados Partilhados entre Certificações</p>
            <p className="text-xs text-amber-700">{sharedItems.length} itens são comuns a mais do que uma certificação. Ao submeter uma vez, a informação é automaticamente disponibilizada nas outras.</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="leed">LEED O&M</TabsTrigger>
          <TabsTrigger value="eed">EED</TabsTrigger>
          <TabsTrigger value="cele">CELE</TabsTrigger>
          <TabsTrigger value="shared">Dados Partilhados</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Progresso por Certificação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24">LEED O&M</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3"><div className="bg-green-500 h-3 rounded-full" style={{ width: "0%" }}></div></div>
                  <span className="text-xs text-muted-foreground">0/{leedItems.length}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24">EED</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3"><div className="bg-blue-500 h-3 rounded-full" style={{ width: "0%" }}></div></div>
                  <span className="text-xs text-muted-foreground">0/{eedItems.length}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24">CELE</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3"><div className="bg-orange-500 h-3 rounded-full" style={{ width: "0%" }}></div></div>
                  <span className="text-xs text-muted-foreground">0/{celeItems.length}</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground"><AlertTriangle className="w-3 h-3 inline mr-1" />A plataforma funciona como camada de orquestração — os dados são armazenados no SharePoint/ACC. Aqui apenas se regista e acompanha o progresso.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leed" className="space-y-4">
          {Array.from(categories.entries()).filter(([_, items]) => items.some(i => i.usedBy === "all" || i.usedBy.includes("leed"))).map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{cat}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {items.filter(i => i.usedBy === "all" || i.usedBy.includes("leed")).map(item => renderDataItem(item))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="eed" className="space-y-4">
          {Array.from(categories.entries()).filter(([_, items]) => items.some(i => i.usedBy === "all" || i.usedBy.includes("eed"))).map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{cat}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {items.filter(i => i.usedBy === "all" || i.usedBy.includes("eed")).map(item => renderDataItem(item))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="cele" className="space-y-4">
          {Array.from(categories.entries()).filter(([_, items]) => items.some(i => i.usedBy.includes("cele"))).map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{cat}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {items.filter(i => i.usedBy.includes("cele")).map(item => renderDataItem(item))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="shared" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Itens Partilhados entre Certificações</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {sharedItems.map(item => renderDataItem(item, true))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
