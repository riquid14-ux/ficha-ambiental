import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { CheckCircle2, Circle, FileText, AlertTriangle, Plus, Trash2, Upload, Save } from "lucide-react";
import { toast } from "sonner";

// === Generator type for CELE inventory ===
type Generator = {
  id: number;
  marca: string;
  modelo: string;
  potencia: string;
  ano: string;
};

export default function Certifications() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const isAdmin = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "pm";

  // === CELE State ===
  const [generators, setGenerators] = useState<Generator[]>([
    { id: 1, marca: "", modelo: "", potencia: "", ano: "" },
  ]);
  const [celeData, setCeleData] = useState({
    combustivel: "HVO",
    tegeeNumero: "",
    tegeeValidade: "",
    regime: "Ensaio semanal + emergência",
    capacidadeDeposito: "",
    horasEnsaio: "",
    horasEmergencia: "",
    combustivelEnsaio: "",
    combustivelEmergencia: "",
    emissoesCO2: "",
    planoMonitorizacao: "",
    raeSubmetido: false,
    parecerVerificacao: false,
    licencasDevolvidas: false,
    notas: "",
  });

  // === EED State ===
  const [eedData, setEedData] = useState({
    nome: "NEST — SIN01",
    localizacao: "Sines, Portugal",
    potenciaTI: "",
    areaUtil: "",
    dataOperacao: "",
    operador: "Start Campus",
    contacto: "",
    racks: "",
    trafegoDados: "",
    dadosArmazenados: "",
    pue: "",
    consumoTotal: "",
    consumoTI: "",
    ref: "",
    erf: "",
    cue: "",
    tempReferencia: "",
    wue: "",
    consumoAgua: "",
    fonteAgua: "",
    relatorioSubmetido: false,
    publicacaoEBDC: false,
    notas: "",
  });

  // === LEED State ===
  const [leedData, setLeedData] = useState({
    areaConstruida: "",
    ocupantes: "",
    visitantesDia: "",
    horasOperacao: "",
    plantasUpload: false,
    cisternas: "",
    areaVegetada: "",
    acabamentos: false,
    iluminacao: false,
    consumoEnergia: "",
    consumoAgua: "",
    auditoriaEnergetica: false,
    refrigerantes: false,
    ventilacao: false,
    qualidadeAr: false,
    residuos: false,
    planoGestao: false,
    limpezaVerde: false,
    comprasSustentaveis: false,
    ipm: false,
    tabaco: false,
    notas: "",
  });

  const addGenerator = () => {
    setGenerators(prev => [...prev, { id: Date.now(), marca: "", modelo: "", potencia: "", ano: "" }]);
  };
  const removeGenerator = (id: number) => {
    if (generators.length > 1) setGenerators(prev => prev.filter(g => g.id !== id));
  };
  const updateGenerator = (id: number, field: keyof Generator, value: string) => {
    setGenerators(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const handleSave = (section: string) => {
    toast.success(`${section} — dados guardados com sucesso`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("Certificações — SIN01 NEST")}</h1>
          <p className="text-muted-foreground">LEED O&M v4.1 · EED (Art. 12.º Dir. 2023/1791) · CELE (EU ETS)</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("leed")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-semibold">LEED O&M v4.1</span>
              </div>
              <p className="text-xs text-muted-foreground">{ t("Edifícios existentes") } · 6 { t("categorias") }</p>
              <p className="text-xs text-muted-foreground mt-1">{t("Submissão contínua via Arc/LEED Online")}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#0A3638] cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("eed")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-[#0A3638]" />
                <span className="font-semibold">EED — Centros de Dados</span>
              </div>
              <p className="text-xs text-muted-foreground">Art. 12.º Dir. (UE) 2023/1791</p>
              <p className="text-xs text-muted-foreground mt-1">{t("Submissão à DGEG até 15 maio")}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#6D7A70] cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("cele")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-[#646461]" />
                <span className="font-semibold">CELE — EU ETS</span>
              </div>
              <p className="text-xs text-muted-foreground">{ t("Geradores de emergência") } · { t("Fontes de minimis") }</p>
              <p className="text-xs text-muted-foreground mt-1">{ t("RAE via SIRAPA até 31 março") }</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">{t("Visão Geral")}</TabsTrigger>
            <TabsTrigger value="leed">LEED O&M v4.1</TabsTrigger>
            <TabsTrigger value="eed">EED</TabsTrigger>
            <TabsTrigger value="cele">CELE</TabsTrigger>
          </TabsList>

          {/* === OVERVIEW === */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">{t("Próximos Prazos")}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 border rounded"><Badge className="bg-[#EDEBEB] text-[#646461] text-xs">CELE</Badge><span className="text-sm flex-1">{t("RAE — Relatório Anual de Emissões")}</span><span className="text-xs text-muted-foreground">{ t("31 março") }</span></div>
                  <div className="flex items-center gap-3 p-2 border rounded"><Badge className="bg-[#EDEBEB] text-[#646461] text-xs">CELE</Badge><span className="text-sm flex-1">{ t("Devolução de licenças de emissão") }</span><span className="text-xs text-muted-foreground">{ t("30 abril") }</span></div>
                  <div className="flex items-center gap-3 p-2 border rounded"><Badge className="bg-[#0A3638] text-white text-xs">EED</Badge><span className="text-sm flex-1">{ t("Relatório anual à DGEG") }</span><span className="text-xs text-muted-foreground">{ t("15 maio") }</span></div>
                  <div className="flex items-center gap-3 p-2 border rounded"><Badge className="bg-primary text-[#0A3638] text-xs">LEED</Badge><span className="text-sm flex-1">{t("Submissão de dados de performance (Arc)")}</span><span className="text-xs text-muted-foreground">{ t("Contínuo") }</span></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === CELE — Smart Installation-Level Input === */}
          <TabsContent value="cele" className="space-y-4">
            <div className="p-3 bg-[#EDEBEB] dark:bg-[#EDEBEB]/20 border border-[#6D7A70] rounded-lg">
              <p className="text-xs text-[#646461]"><strong>{t("CELE — Comércio Europeu de Licenças de Emissão (EU ETS)")}</strong>{t("· Geradores de emergência qualificam-se como fontes de minimis. RAE submetido via SIRAPA até 31 de março.")}</p>
            </div>

            {/* Section 1: Generator Inventory */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t("Inventário de Geradores")}</CardTitle>
                  <Button size="sm" variant="outline" onClick={addGenerator} className="text-xs"><Plus className="w-3 h-3 mr-1" /> {t("Adicionar Gerador")}</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="p-2 text-xs font-medium text-muted-foreground">#</th>
                        <th className="p-2 text-xs font-medium text-muted-foreground">Marca</th>
                        <th className="p-2 text-xs font-medium text-muted-foreground">Modelo</th>
                        <th className="p-2 text-xs font-medium text-muted-foreground">{t("Potência (kW)")}</th>
                        <th className="p-2 text-xs font-medium text-muted-foreground">Ano</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {generators.map((g, i) => (
                        <tr key={g.id} className="border-b last:border-0">
                          <td className="p-2 text-xs text-muted-foreground">{i + 1}</td>
                          <td className="p-1"><Input className="h-8 text-xs" placeholder="Ex: Caterpillar" value={g.marca} onChange={e => updateGenerator(g.id, "marca", e.target.value)} /></td>
                          <td className="p-1"><Input className="h-8 text-xs" placeholder="Ex: C32" value={g.modelo} onChange={e => updateGenerator(g.id, "modelo", e.target.value)} /></td>
                          <td className="p-1"><Input className="h-8 text-xs" placeholder="Ex: 1000" value={g.potencia} onChange={e => updateGenerator(g.id, "potencia", e.target.value)} /></td>
                          <td className="p-1"><Input className="h-8 text-xs" placeholder="Ex: 2024" value={g.ano} onChange={e => updateGenerator(g.id, "ano", e.target.value)} /></td>
                          <td className="p-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600" onClick={() => removeGenerator(g.id)} disabled={generators.length <= 1}><Trash2 className="w-3 h-3" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Installation-Level Data (applies to ALL generators) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("Dados da Instalação")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("Informação comum a todos os geradores")}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t("Tipo de Combustível (todos os geradores)")}</label>
                    <Input className="h-9 mt-1" value={celeData.combustivel} onChange={e => setCeleData(p => ({...p, combustivel: e.target.value}))} />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t("Ex: HVO, Diesel, Gás Natural")}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t("Capacidade Total dos Depósitos")}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input className="h-9" placeholder="Ex: 50000" value={celeData.capacidadeDeposito} onChange={e => setCeleData(p => ({...p, capacidadeDeposito: e.target.value}))} />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">litros</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t("TEGEE — Nº do Título")}</label>
                    <Input className="h-9 mt-1" placeholder={t("Nº do título de emissão")} value={celeData.tegeeNumero} onChange={e => setCeleData(p => ({...p, tegeeNumero: e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">TEGEE — Validade</label>
                    <Input className="h-9 mt-1" type="date" value={celeData.tegeeValidade} onChange={e => setCeleData(p => ({...p, tegeeValidade: e.target.value}))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Regime de Funcionamento</label>
                    <Input className="h-9 mt-1" value={celeData.regime} onChange={e => setCeleData(p => ({...p, regime: e.target.value}))} />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t("Ex: Ensaio semanal + emergência")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Annual Activity Data (totals, not per-generator) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dados Anuais de Atividade</CardTitle>
                <p className="text-xs text-muted-foreground">{t("Totais da instalação (todos os geradores combinados)")}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Horas de Funcionamento — Ensaio</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input className="h-9" placeholder="Total 12 meses" value={celeData.horasEnsaio} onChange={e => setCeleData(p => ({...p, horasEnsaio: e.target.value}))} />
                      <span className="text-xs text-muted-foreground">horas</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t("Horas de Funcionamento — Emergência")}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input className="h-9" placeholder="Total 12 meses" value={celeData.horasEmergencia} onChange={e => setCeleData(p => ({...p, horasEmergencia: e.target.value}))} />
                      <span className="text-xs text-muted-foreground">horas</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t("Combustível Consumido — Ensaios")}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input className="h-9" placeholder="Total anual" value={celeData.combustivelEnsaio} onChange={e => setCeleData(p => ({...p, combustivelEnsaio: e.target.value}))} />
                      <span className="text-xs text-muted-foreground">litros</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t("Combustível Consumido — Emergência")}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input className="h-9" placeholder="Total anual" value={celeData.combustivelEmergencia} onChange={e => setCeleData(p => ({...p, combustivelEmergencia: e.target.value}))} />
                      <span className="text-xs text-muted-foreground">litros</span>
                    </div>
                  </div>
                  <div className="md:col-span-2 p-3 bg-[#EDEBEB] dark:bg-[#EDEBEB]/20 rounded-lg border border-[#6D7A70]">
                    <label className="text-xs font-medium text-[#646461]">{t("Emissões de CO2 Calculadas")}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input className="h-9 bg-background" placeholder="Litros × FE × Densidade" value={celeData.emissoesCO2} onChange={e => setCeleData(p => ({...p, emissoesCO2: e.target.value}))} />
                      <span className="text-xs text-muted-foreground">tCO2</span>
                    </div>
                    <p className="text-[10px] text-[#646461] mt-1">{t("Cálculo: total combustível × fator de emissão × densidade")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Documentation Checklist */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("Documentação e Submissões")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: "planoMonitorizacao", label: "Plano de monitorização aprovado pela APA", deadline: "Válido até revisão" },
                  { key: "raeSubmetido", label: "RAE — Relatório Anual de Emissões submetido via SIRAPA", deadline: "Até 31 março" },
                  { key: "parecerVerificacao", label: "Parecer de verificação por entidade acreditada", deadline: "Anual" },
                  { key: "licencasDevolvidas", label: "Devolução de licenças de emissão (se aplicável)", deadline: "Até 30 abril" },
                ].map(doc => (
                  <label key={doc.key} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors">
                    <input type="checkbox" className="accent-green-600 w-4 h-4" checked={!!(celeData as any)[doc.key]} onChange={e => setCeleData(p => ({...p, [doc.key]: e.target.checked}))} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{doc.label}</p>
                      <p className="text-xs text-muted-foreground">{doc.deadline}</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={e => { e.preventDefault(); toast.info("Upload disponível quando ligado ao SharePoint"); }}>
                      <Upload className="w-3 h-3 mr-1" /> Anexar
                    </Button>
                  </label>
                ))}
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Textarea placeholder={t("Notas adicionais sobre CELE...")} className="text-sm" value={celeData.notas} onChange={e => setCeleData(p => ({...p, notas: e.target.value}))} />
            </div>
            <Button className="bg-primary hover:bg-primary" onClick={() => handleSave("CELE")}><Save className="w-4 h-4 mr-2" /> {t("Guardar CELE")}</Button>
          </TabsContent>

          {/* === EED — Grouped KPI Input === */}
          <TabsContent value="eed" className="space-y-4">
            <div className="p-3 bg-[#0A3638] dark:bg-[#0A3638]/20 border border-[#0A3638] rounded-lg">
              <p className="text-xs text-[#0A3638]"><strong>EED — Relato de Sustentabilidade de Centros de Dados</strong> · Art. 12.º da Diretiva (UE) 2023/1791. Aplica-se a centros de dados com potência TI ≥ 500 kW. Submissão anual à DGEG até 15 de maio.</p>
            </div>

            {/* Identification */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("Identificação da Instalação")}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Nome do Centro de Dados")}</label><Input className="h-9 mt-1" value={eedData.nome} onChange={e => setEedData(p => ({...p, nome: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Localização")}</label><Input className="h-9 mt-1" value={eedData.localizacao} onChange={e => setEedData(p => ({...p, localizacao: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Operador</label><Input className="h-9 mt-1" value={eedData.operador} onChange={e => setEedData(p => ({...p, operador: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Contacto</label><Input className="h-9 mt-1" placeholder="Email ou telefone" value={eedData.contacto} onChange={e => setEedData(p => ({...p, contacto: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Potência Instalada de TI (kW)")}</label><Input className="h-9 mt-1" placeholder="kW" value={eedData.potenciaTI} onChange={e => setEedData(p => ({...p, potenciaTI: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Área Útil (m²)")}</label><Input className="h-9 mt-1" placeholder="m²" value={eedData.areaUtil} onChange={e => setEedData(p => ({...p, areaUtil: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Data de Início de Operação")}</label><Input className="h-9 mt-1" type="date" value={eedData.dataOperacao} onChange={e => setEedData(p => ({...p, dataOperacao: e.target.value}))} /></div>
                </div>
              </CardContent>
            </Card>

            {/* IT Capacity */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("Capacidade de TI e Tráfego")}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="text-xs font-medium text-muted-foreground">Racks/Servidores Instalados</label><Input className="h-9 mt-1" placeholder="Nº total" value={eedData.racks} onChange={e => setEedData(p => ({...p, racks: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Tráfego de Dados (TB/ano)")}</label><Input className="h-9 mt-1" placeholder="TB/ano" value={eedData.trafegoDados} onChange={e => setEedData(p => ({...p, trafegoDados: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Dados Armazenados (PB)</label><Input className="h-9 mt-1" placeholder="PB" value={eedData.dadosArmazenados} onChange={e => setEedData(p => ({...p, dadosArmazenados: e.target.value}))} /></div>
                </div>
              </CardContent>
            </Card>

            {/* Energy & Sustainability KPIs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Indicadores de Energia e Sustentabilidade</CardTitle>
                <p className="text-xs text-muted-foreground">Valores anuais — preencher uma vez por ano</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-[#0A3638] dark:bg-[#0A3638]/20 rounded-lg border border-[#0A3638]">
                    <label className="text-xs font-medium text-[#0A3638]">PUE</label>
                    <Input className="h-9 mt-1 bg-background" placeholder="Ex: 1.25" value={eedData.pue} onChange={e => setEedData(p => ({...p, pue: e.target.value}))} />
                    <p className="text-[10px] text-[#0A3638] mt-0.5">Power Usage Effectiveness</p>
                  </div>
                  <div className="p-3 bg-primary dark:bg-primary/20 rounded-lg border border-primary">
                    <label className="text-xs font-medium text-primary">REF (%)</label>
                    <Input className="h-9 mt-1 bg-background" placeholder="Ex: 95" value={eedData.ref} onChange={e => setEedData(p => ({...p, ref: e.target.value}))} />
                    <p className="text-[10px] text-primary mt-0.5">Renewable Energy Factor</p>
                  </div>
                  <div className="p-3 bg-[#EDEBEB] dark:bg-[#EDEBEB]/20 rounded-lg border border-[#6D7A70]">
                    <label className="text-xs font-medium text-[#646461]">ERF (%)</label>
                    <Input className="h-9 mt-1 bg-background" placeholder="Ex: 0" value={eedData.erf} onChange={e => setEedData(p => ({...p, erf: e.target.value}))} />
                    <p className="text-[10px] text-[#646461] mt-0.5">Energy Reuse Factor</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <label className="text-xs font-medium text-foreground">CUE</label>
                    <Input className="h-9 mt-1 bg-background" placeholder="kgCO2/kWh" value={eedData.cue} onChange={e => setEedData(p => ({...p, cue: e.target.value}))} />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Carbon Usage Effectiveness</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div><label className="text-xs font-medium text-muted-foreground">Consumo Total de Energia (MWh/ano)</label><Input className="h-9 mt-1" value={eedData.consumoTotal} onChange={e => setEedData(p => ({...p, consumoTotal: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Consumo de Energia TI (MWh/ano)</label><Input className="h-9 mt-1" value={eedData.consumoTI} onChange={e => setEedData(p => ({...p, consumoTI: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Temperatura de Referência (°C)")}</label><Input className="h-9 mt-1" placeholder="Setpoint" value={eedData.tempReferencia} onChange={e => setEedData(p => ({...p, tempReferencia: e.target.value}))} /></div>
                </div>
              </CardContent>
            </Card>

            {/* Water */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("Água")}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-[#0A3638] rounded-lg border border-[#0A3638]">
                    <label className="text-xs font-medium text-[#0A3638]">WUE (L/kWh)</label>
                    <Input className="h-9 mt-1 bg-background" placeholder="Ex: 0.5" value={eedData.wue} onChange={e => setEedData(p => ({...p, wue: e.target.value}))} />
                    <p className="text-[10px] text-[#0A3638] mt-0.5">Water Usage Effectiveness</p>
                  </div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Consumo Total de Água (m³/ano)")}</label><Input className="h-9 mt-1" value={eedData.consumoAgua} onChange={e => setEedData(p => ({...p, consumoAgua: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Fonte de Água")}</label><Input className="h-9 mt-1" placeholder="Rede, furo, reutilizada..." value={eedData.fonteAgua} onChange={e => setEedData(p => ({...p, fonteAgua: e.target.value}))} /></div>
                </div>
              </CardContent>
            </Card>

            {/* Submissions */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("Submissões")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                  <input type="checkbox" className="accent-green-600 w-4 h-4" checked={eedData.relatorioSubmetido} onChange={e => setEedData(p => ({...p, relatorioSubmetido: e.target.checked}))} />
                  <div className="flex-1"><p className="text-sm font-medium">{t("Relatório anual submetido à DGEG")}</p><p className="text-xs text-muted-foreground">{t("Até 15 maio")}</p></div>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={e => { e.preventDefault(); toast.info("Upload disponível quando ligado ao SharePoint"); }}><Upload className="w-3 h-3 mr-1" /> {t("Anexar")}</Button>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                  <input type="checkbox" className="accent-green-600 w-4 h-4" checked={eedData.publicacaoEBDC} onChange={e => setEedData(p => ({...p, publicacaoEBDC: e.target.checked}))} />
                  <div className="flex-1"><p className="text-sm font-medium">{t("Publicação na base de dados europeia (EBDC)")}</p><p className="text-xs text-muted-foreground">Anual</p></div>
                </label>
              </CardContent>
            </Card>

            <Textarea placeholder={t("Notas adicionais sobre EED...")} className="text-sm" value={eedData.notas} onChange={e => setEedData(p => ({...p, notas: e.target.value}))} />
            <Button className="bg-[#0A3638] hover:bg-[#0A3638]" onClick={() => handleSave("EED")}><Save className="w-4 h-4 mr-2" /> {t("Guardar EED")}</Button>
          </TabsContent>

          {/* === LEED — Smart Category Grouping === */}
          <TabsContent value="leed" className="space-y-4">
            <div className="p-3 bg-primary dark:bg-primary/20 border border-primary rounded-lg">
              <p className="text-xs text-primary"><strong>LEED O&M v4.1 — Existing Buildings</strong> · 90 pontos de performance + 10 pontos de créditos. Submissão contínua via plataforma Arc. Dados de 12 meses de operação.</p>
            </div>

            {/* Building Info - fill once */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("Informação do Edifício")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("Preencher uma vez — dados estáticos")}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Área Construída (GFA excl. estacionamento)")}</label><div className="flex items-center gap-2 mt-1"><Input className="h-9" placeholder="Ex: 45000" value={leedData.areaConstruida} onChange={e => setLeedData(p => ({...p, areaConstruida: e.target.value}))} /><span className="text-xs text-muted-foreground">m²</span></div></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Nº Total de Ocupantes (FTE + visitantes)</label><Input className="h-9 mt-1" placeholder="Por inquilino" value={leedData.ocupantes} onChange={e => setLeedData(p => ({...p, ocupantes: e.target.value}))} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Nº Médio Diário de Visitantes")}</label><div className="flex items-center gap-2 mt-1"><Input className="h-9" value={leedData.visitantesDia} onChange={e => setLeedData(p => ({...p, visitantesDia: e.target.value}))} /><span className="text-xs text-muted-foreground">pessoas/dia</span></div></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Horas de Operação Semanais")}</label><div className="flex items-center gap-2 mt-1"><Input className="h-9" value={leedData.horasOperacao} onChange={e => setLeedData(p => ({...p, horasOperacao: e.target.value}))} /><span className="text-xs text-muted-foreground">h/semana</span></div></div>
                </div>
                <label className="flex items-center gap-3 p-3 mt-4 border rounded-lg hover:bg-muted cursor-pointer">
                  <input type="checkbox" className="accent-green-600 w-4 h-4" checked={leedData.plantasUpload} onChange={e => setLeedData(p => ({...p, plantasUpload: e.target.checked}))} />
                  <div className="flex-1"><p className="text-sm">Plantas de todos os pisos (MEP + arquitetura)</p><p className="text-xs text-muted-foreground">{t("DWG/PDF com áreas demarcadas")}</p></div>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={e => { e.preventDefault(); toast.info("Upload disponível quando ligado ao SharePoint"); }}><Upload className="w-3 h-3 mr-1" /> {t("Anexar")}</Button>
                </label>
              </CardContent>
            </Card>

            {/* Site */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Local (Site)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Volume Cisterna Águas Pluviais")}</label><div className="flex items-center gap-2 mt-1"><Input className="h-9" placeholder="Volume" value={leedData.cisternas} onChange={e => setLeedData(p => ({...p, cisternas: e.target.value}))} /><span className="text-xs text-muted-foreground">m³</span></div></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Áreas Vegetadas / Pedonais / Veículos")}</label><Input className="h-9 mt-1" placeholder="m² por tipologia" value={leedData.areaVegetada} onChange={e => setLeedData(p => ({...p, areaVegetada: e.target.value}))} /></div>
                </div>
                <div className="space-y-2 mt-4">
                  {[
                    { key: "acabamentos", label: "Fichas técnicas de acabamentos de superfície (SR/SRI)" },
                    { key: "iluminacao", label: "Plano de iluminação exterior e fichas técnicas de luminárias" },
                  ].map(doc => (
                    <label key={doc.key} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                      <input type="checkbox" className="accent-green-600 w-4 h-4" checked={!!(leedData as any)[doc.key]} onChange={e => setLeedData(p => ({...p, [doc.key]: e.target.checked}))} />
                      <span className="text-sm flex-1">{doc.label}</span>
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={e => { e.preventDefault(); toast.info("Upload disponível quando ligado ao SharePoint"); }}><Upload className="w-3 h-3 mr-1" /> {t("Anexar")}</Button>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Consumption - annual data */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Consumos (12 Meses)</CardTitle>
                <p className="text-xs text-muted-foreground">Dados mensais por contador — preencher anualmente</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium text-muted-foreground">Consumo Total de Energia</label><div className="flex items-center gap-2 mt-1"><Input className="h-9" placeholder="Total 12 meses" value={leedData.consumoEnergia} onChange={e => setLeedData(p => ({...p, consumoEnergia: e.target.value}))} /><span className="text-xs text-muted-foreground">kWh</span></div></div>
                  <div><label className="text-xs font-medium text-muted-foreground">{t("Consumo Total de Água")}</label><div className="flex items-center gap-2 mt-1"><Input className="h-9" placeholder="Total 12 meses" value={leedData.consumoAgua} onChange={e => setLeedData(p => ({...p, consumoAgua: e.target.value}))} /><span className="text-xs text-muted-foreground">m³</span></div></div>
                </div>
              </CardContent>
            </Card>

            {/* Systems & Audits */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("Sistemas do Edifício e Auditorias")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { key: "auditoriaEnergetica", label: "Auditoria energética ASHRAE Nível 1 (últimos 5 anos)" },
                  { key: "refrigerantes", label: "Inventário de equipamentos com refrigerante (tipo, carga, GWP)" },
                  { key: "ventilacao", label: "Lista de equipamentos de ventilação e fichas técnicas" },
                  { key: "qualidadeAr", label: "Auditoria de qualidade do ar interior (caudais, COVs, CO2)" },
                  { key: "residuos", label: "Certificados de gestão de RSU e resíduos desviados (12 meses)" },
                ].map(doc => (
                  <label key={doc.key} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                    <input type="checkbox" className="accent-green-600 w-4 h-4" checked={!!(leedData as any)[doc.key]} onChange={e => setLeedData(p => ({...p, [doc.key]: e.target.checked}))} />
                    <span className="text-sm flex-1">{doc.label}</span>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={e => { e.preventDefault(); toast.info("Upload disponível quando ligado ao SharePoint"); }}><Upload className="w-3 h-3 mr-1" /> {t("Anexar")}</Button>
                  </label>
                ))}
              </CardContent>
            </Card>

            {/* Policies */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("Políticas e Planos")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { key: "planoGestao", label: "Plano de Gestão do Local (Site Management Plan)" },
                  { key: "limpezaVerde", label: "Política de Limpeza Verde (Green Cleaning Policy)" },
                  { key: "comprasSustentaveis", label: "Política de Compras Sustentáveis" },
                  { key: "ipm", label: "Plano Integrado de Gestão de Pragas (IPM)" },
                  { key: "tabaco", label: "Política de Controlo de Tabaco" },
                ].map(doc => (
                  <label key={doc.key} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                    <input type="checkbox" className="accent-green-600 w-4 h-4" checked={!!(leedData as any)[doc.key]} onChange={e => setLeedData(p => ({...p, [doc.key]: e.target.checked}))} />
                    <span className="text-sm flex-1">{doc.label}</span>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={e => { e.preventDefault(); toast.info("Upload disponível quando ligado ao SharePoint"); }}><Upload className="w-3 h-3 mr-1" /> {t("Anexar")}</Button>
                  </label>
                ))}
              </CardContent>
            </Card>

            <Textarea placeholder={t("Notas adicionais sobre LEED...")} className="text-sm" value={leedData.notas} onChange={e => setLeedData(p => ({...p, notas: e.target.value}))} />
            <Button className="bg-primary hover:bg-primary" onClick={() => handleSave("LEED")}><Save className="w-4 h-4 mr-2" /> {t("Guardar LEED")}</Button>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
