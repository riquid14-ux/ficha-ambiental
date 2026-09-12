import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";
import { Activity, BadgeEuro, Factory, Gauge, Leaf, Save, Settings2, Sparkles, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type NumericKey = "electricityCarbonFactorKgKwh" | "waterPotableCarbonFactorKgM3" | "waterIndustrialCarbonFactorKgM3" | "maxPue" | "maxSeawaterReturnTempC" | "minSeawaterFlowLps" | "maxSeawaterFlowLps" | "maxSeawaterDeltaTK" | "electricityPriceEurKwh" | "waterPriceEurM3" | "annualMaintenanceBudgetEur" | "targetPue" | "targetWueLkwh" | "forecastHorizonDays";
type Draft = Record<NumericKey, string>;

const emptyDraft: Draft = { electricityCarbonFactorKgKwh: "", waterPotableCarbonFactorKgM3: "", waterIndustrialCarbonFactorKgM3: "", maxPue: "", maxSeawaterReturnTempC: "", minSeawaterFlowLps: "", maxSeawaterFlowLps: "", maxSeawaterDeltaTK: "", electricityPriceEurKwh: "", waterPriceEurM3: "", annualMaintenanceBudgetEur: "", targetPue: "", targetWueLkwh: "", forecastHorizonDays: "" };
const illustrativeDraft: Draft = { electricityCarbonFactorKgKwh: "0.25", waterPotableCarbonFactorKgM3: "0.35", waterIndustrialCarbonFactorKgM3: "0.20", maxPue: "1.25", maxSeawaterReturnTempC: "25", minSeawaterFlowLps: "100", maxSeawaterFlowLps: "130", maxSeawaterDeltaTK: "6", electricityPriceEurKwh: "0.18", waterPriceEurM3: "2.5", annualMaintenanceBudgetEur: "250000", targetPue: "1.20", targetWueLkwh: "0.30", forecastHorizonDays: "90" };

const strategyLabels: Record<string, string> = { agua_mar: "Água do mar", chiller: "Chiller", hibrido_adiabatico: "Híbrido adiabático", torres_evaporativas: "Torres evaporativas", outro: "Outro" };
const sections: Array<{ id: string; label: string; icon: typeof Leaf; title: string; description: string; fields: Array<{ key: NumericKey; label: string; unit: string; note: string }> }> = [
  { id: "eficiencia", label: "Eficiência", icon: Gauge, title: "Metas de eficiência e sustentabilidade", description: "Defina a referência que o cockpit usa para comparar o desempenho medido e as previsões.", fields: [{ key: "targetPue", label: "PUE objetivo", unit: "rácio", note: "Meta operacional para comparar eficiência energética." }, { key: "targetWueLkwh", label: "WUE objetivo", unit: "L/kWh TI", note: "Meta de uso de água por energia TI." }, { key: "maxPue", label: "PUE máximo", unit: "rácio", note: "Limite que ativa alerta apenas em modo aprovado." }, { key: "electricityCarbonFactorKgKwh", label: "Fator de eletricidade", unit: "kg CO₂e/kWh", note: "Converte energia em carbono e CUE." }, { key: "waterPotableCarbonFactorKgM3", label: "Fator de água potável", unit: "kg CO₂e/m³", note: "Usado em análise de ciclo de vida." }, { key: "waterIndustrialCarbonFactorKgM3", label: "Fator de água industrial", unit: "kg CO₂e/m³", note: "Usado em análise de ciclo de vida." }] },
  { id: "mar", label: "Água do mar", icon: Waves, title: "Circuito de captação e descarga", description: "Centralize os limites ambientais e de operação do sistema de arrefecimento por água do mar.", fields: [{ key: "maxSeawaterReturnTempC", label: "Temperatura máxima de descarga", unit: "°C", note: "Limite de licença ou operação aprovado." }, { key: "minSeawaterFlowLps", label: "Caudal mínimo de captação", unit: "L/s", note: "Protege o desempenho do circuito." }, { key: "maxSeawaterFlowLps", label: "Caudal máximo de captação", unit: "L/s", note: "Limite de operação ou licença." }, { key: "maxSeawaterDeltaTK", label: "ΔT máximo", unit: "K", note: "Retorno menos captação." }] },
  { id: "economia", label: "Custos e previsão", icon: BadgeEuro, title: "Economia operacional e horizonte de previsão", description: "Estes parâmetros alimentam cenários comparativos; os dados medidos mantêm-se sempre separados.", fields: [{ key: "electricityPriceEurKwh", label: "Preço de eletricidade", unit: "EUR/kWh", note: "Referência para custo e cenário energético." }, { key: "waterPriceEurM3", label: "Preço de água", unit: "EUR/m³", note: "Referência para custos de água e WUE." }, { key: "annualMaintenanceBudgetEur", label: "Orçamento anual de manutenção", unit: "EUR/ano", note: "Base para avaliar estratégias e manutenção." }, { key: "forecastHorizonDays", label: "Horizonte de previsão", unit: "dias", note: "Janela usada nas leituras projetadas do cockpit." }] },
];

function parseDraft(draft: Draft) {
  const parsed = {} as Record<NumericKey, number | null>;
  for (const [key, value] of Object.entries(draft) as Array<[NumericKey, string]>) {
    if (!value.trim()) { parsed[key] = null; continue; }
    const numeric = Number(value.replace(",", "."));
    if (!Number.isFinite(numeric)) return null;
    parsed[key] = numeric;
  }
  return parsed;
}

export default function OperationSettingsAdmin() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id || 0;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [configurationMode, setConfigurationMode] = useState<"illustrative" | "approved">("approved");
  const [coolingStrategyBaseline, setCoolingStrategyBaseline] = useState("agua_mar");
  const settingsQuery = trpc.operation.settings.useQuery({ projectId }, { enabled: activeProject?.code === "SIN01" && projectId > 0 });
  const updateMutation = trpc.operation.updateSettings.useMutation({ onSuccess: () => { toast.success("Definições de Operação guardadas e auditadas."); settingsQuery.refetch(); }, onError: error => toast.error(error.message) });

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings) { setDraft(emptyDraft); setConfigurationMode("approved"); setCoolingStrategyBaseline("agua_mar"); return; }
    setDraft(Object.fromEntries(Object.keys(emptyDraft).map(key => [key, settings[key as keyof typeof settings] === null || settings[key as keyof typeof settings] === undefined ? "" : String(settings[key as keyof typeof settings])])) as Draft);
    setConfigurationMode(settings.configurationMode === "illustrative" ? "illustrative" : "approved");
    setCoolingStrategyBaseline(settings.coolingStrategyBaseline || "agua_mar");
  }, [settingsQuery.data]);

  if (activeProject?.code !== "SIN01") return <p className="text-sm text-muted-foreground">Selecione o SIN01 — NEST para configurar parâmetros de Operação.</p>;
  const save = () => {
    const parsed = parseDraft(draft);
    if (!parsed) { toast.error("Use apenas números válidos; deixe em branco um parâmetro ainda não definido."); return; }
    updateMutation.mutate({ projectId, configurationMode, coolingStrategyBaseline: coolingStrategyBaseline as any, ...parsed });
  };
  const useIllustrative = () => { setDraft(illustrativeDraft); setConfigurationMode("illustrative"); setCoolingStrategyBaseline("agua_mar"); toast.info("Valores ilustrativos carregados. Reveja-os antes de guardar."); };

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_top_right,_#164e63,_#0f172a_55%)] text-white shadow-xl">
      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><div className="mb-3 flex items-center gap-2"><span className="rounded-full bg-white/10 p-2"><Settings2 className="size-4" /></span><Badge className="border-white/20 bg-white/10 text-white">SIN01 · NEST</Badge></div><h2 className="text-2xl font-semibold tracking-tight">Centro de controlo da Operação</h2><p className="mt-2 text-sm leading-6 text-slate-200">Ajuste metas, fatores, custos, limites e a base de previsão do edifício. Todas as alterações são auditadas e as estimativas nunca substituem leituras medidas.</p></div><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl border border-white/10 bg-white/10 p-3"><p className="text-slate-300">Modo ativo</p><p className="mt-1 font-semibold">{configurationMode === "illustrative" ? "Demonstração" : "Aprovado"}</p></div><div className="rounded-xl border border-white/10 bg-white/10 p-3"><p className="text-slate-300">Sistema-base</p><p className="mt-1 font-semibold">{strategyLabels[coolingStrategyBaseline]}</p></div></div></div>
    </section>

    <div className="grid gap-3 md:grid-cols-2"><button type="button" onClick={() => setConfigurationMode("illustrative")} className={`rounded-2xl border p-5 text-left transition ${configurationMode === "illustrative" ? "border-amber-400 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:border-amber-200"}`}><div className="flex items-center gap-3"><span className="rounded-xl bg-amber-100 p-2 text-amber-700"><Sparkles className="size-5" /></span><div><p className="font-semibold text-slate-900">Demonstração ilustrativa</p><p className="mt-1 text-xs leading-5 text-slate-600">Permite testar o cockpit com referências configuráveis, sem conformidade ou alertas reais.</p></div></div></button><button type="button" onClick={() => setConfigurationMode("approved")} className={`rounded-2xl border p-5 text-left transition ${configurationMode === "approved" ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200"}`}><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Activity className="size-5" /></span><div><p className="font-semibold text-slate-900">Valores aprovados</p><p className="mt-1 text-xs leading-5 text-slate-600">Usa parâmetros formalmente validados para avaliações reais de carbono, limites e alertas.</p></div></div></button></div>

    <Card className="border-slate-200 shadow-sm"><CardContent className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-slate-900">Atalhos de configuração</p><p className="text-xs text-muted-foreground">Comece com referências ilustrativas ou ajuste todos os módulos manualmente.</p></div><Button type="button" variant="outline" onClick={useIllustrative}><Sparkles className="mr-2 size-4 text-amber-600" />Carregar demonstração</Button></div></CardContent></Card>

    <Tabs defaultValue="eficiencia" className="space-y-4"><TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-slate-100 p-1">{sections.map(section => { const Icon = section.icon; return <TabsTrigger key={section.id} value={section.id} className="gap-2 rounded-lg px-4"><Icon className="size-4" />{section.label}</TabsTrigger>; })}<TabsTrigger value="sistema" className="gap-2 rounded-lg px-4"><Factory className="size-4" />Sistema-base</TabsTrigger></TabsList>{sections.map(section => <TabsContent key={section.id} value={section.id}><SettingsSection title={section.title} description={section.description} icon={section.icon}>{section.fields.map(field => <SettingField key={field.key} field={field} value={draft[field.key]} onChange={value => setDraft(current => ({ ...current, [field.key]: value }))} />)}</SettingsSection></TabsContent>)}<TabsContent value="sistema"><SettingsSection title="Estratégia operacional de referência" description="Define o sistema dominante usado para enquadrar cenários e comparações de desempenho." icon={Factory}><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2"><Label>Estratégia-base de arrefecimento</Label><Select value={coolingStrategyBaseline} onValueChange={setCoolingStrategyBaseline}><SelectTrigger className="mt-2 max-w-md bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(strategyLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select><p className="mt-2 text-xs text-muted-foreground">Esta escolha não altera dados medidos. É usada apenas como contexto e pressuposto de cenários.</p></div></SettingsSection></TabsContent></Tabs>

    <div className={`flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between ${configurationMode === "illustrative" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><div><p className="font-semibold text-slate-900">{configurationMode === "illustrative" ? "Proteção de demonstração ativa" : "Modo aprovado ativo"}</p><p className="mt-1 text-xs leading-5 text-slate-700">{configurationMode === "illustrative" ? "Os cartões podem mostrar estimativas, mas nenhum limite produz alerta, desvio ou conclusão de conformidade." : "Confirme que todos os parâmetros foram formalmente aprovados antes de guardar; o histórico de alterações fica auditado."}</p></div><Button onClick={save} disabled={updateMutation.isPending} className="shrink-0 bg-slate-950 text-white hover:bg-slate-800"><Save className="mr-2 size-4" />{updateMutation.isPending ? "A guardar..." : "Guardar definições"}</Button></div>
  </div>;
}

function SettingsSection({ title, description, icon: Icon, children }: { title: string; description: string; icon: typeof Leaf; children: React.ReactNode }) { return <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="mb-5 flex gap-3"><span className="rounded-xl bg-slate-100 p-2 text-slate-700"><Icon className="size-5" /></span><div><h3 className="font-semibold text-slate-950">{title}</h3><p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div></CardContent></Card>; }
function SettingField({ field, value, onChange }: { field: { key: NumericKey; label: string; unit: string; note: string }; value: string; onChange: (value: string) => void }) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><Label htmlFor={field.key} className="text-sm font-medium text-slate-900">{field.label}</Label><div className="mt-2 flex items-center rounded-lg border bg-slate-50 focus-within:ring-2 focus-within:ring-emerald-200"><Input id={field.key} className="border-0 bg-transparent shadow-none focus-visible:ring-0" inputMode="decimal" value={value} onChange={event => onChange(event.target.value)} placeholder="Por configurar" /><span className="pr-3 text-xs font-medium text-slate-500">{field.unit}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{field.note}</p></div>; }
