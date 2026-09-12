import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { AlertTriangle, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

type Draft = Record<"electricityCarbonFactorKgKwh" | "waterPotableCarbonFactorKgM3" | "waterIndustrialCarbonFactorKgM3" | "maxPue" | "maxSeawaterReturnTempC" | "minSeawaterFlowLps" | "maxSeawaterFlowLps" | "maxSeawaterDeltaTK", string>;
const emptyDraft: Draft = { electricityCarbonFactorKgKwh: "", waterPotableCarbonFactorKgM3: "", waterIndustrialCarbonFactorKgM3: "", maxPue: "", maxSeawaterReturnTempC: "", minSeawaterFlowLps: "", maxSeawaterFlowLps: "", maxSeawaterDeltaTK: "" };

const fields: Array<{ key: keyof Draft; label: string; unit: string; note: string }> = [
  { key: "electricityCarbonFactorKgKwh", label: "Fator de eletricidade", unit: "kg CO₂e/kWh", note: "Ativa carbono do edifício e CUE." },
  { key: "waterPotableCarbonFactorKgM3", label: "Fator de água potável", unit: "kg CO₂e/m³", note: "Mantido para análise de ciclo de vida." },
  { key: "waterIndustrialCarbonFactorKgM3", label: "Fator de água industrial", unit: "kg CO₂e/m³", note: "Mantido para análise de ciclo de vida." },
  { key: "maxPue", label: "PUE máximo", unit: "rácio", note: "Desvio quando o valor medido ultrapassa o limite." },
  { key: "maxSeawaterReturnTempC", label: "Temperatura máxima de descarga", unit: "°C", note: "Limite de licença ou operação aprovado." },
  { key: "minSeawaterFlowLps", label: "Caudal mínimo de captação", unit: "L/s", note: "Desvio quando a medição fica abaixo deste limite." },
  { key: "maxSeawaterFlowLps", label: "Caudal máximo de captação", unit: "L/s", note: "Desvio quando a medição ultrapassa este limite." },
  { key: "maxSeawaterDeltaTK", label: "ΔT máximo de água do mar", unit: "K", note: "Valor máximo de retorno menos captação." },
];

function parseDraft(draft: Draft) {
  const parsed = {} as Record<keyof Draft, number | null>;
  for (const [key, value] of Object.entries(draft) as Array<[keyof Draft, string]>) {
    if (!value.trim()) { parsed[key] = null; continue; }
    const number = Number(value.replace(",", "."));
    if (!Number.isFinite(number)) return null;
    parsed[key] = number;
  }
  return parsed;
}

export default function OperationSettingsAdmin() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id || 0;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const settingsQuery = trpc.operation.settings.useQuery({ projectId }, { enabled: activeProject?.code === "SIN01" && projectId > 0 });
  const updateMutation = trpc.operation.updateSettings.useMutation({
    onSuccess: () => { toast.success("Configuração operacional guardada e auditada."); settingsQuery.refetch(); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings) { setDraft(emptyDraft); return; }
    setDraft(Object.fromEntries(Object.keys(emptyDraft).map(key => [key, settings[key as keyof typeof settings] === null || settings[key as keyof typeof settings] === undefined ? "" : String(settings[key as keyof typeof settings])])) as Draft);
  }, [settingsQuery.data]);

  if (activeProject?.code !== "SIN01") return <p className="text-sm text-muted-foreground">Selecione o SIN01 — NEST para configurar parâmetros de Operação.</p>;
  const save = () => {
    const parsed = parseDraft(draft);
    if (!parsed) { toast.error("Use apenas números válidos; deixe em branco um parâmetro ainda não aprovado."); return; }
    updateMutation.mutate({ projectId, ...parsed });
  };

  return <div className="space-y-4">
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base text-emerald-950"><Settings2 className="size-4" />Parâmetros aprovados de Operação — SIN01/NEST</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-emerald-950">Introduza apenas fatores de emissão e limites formalmente aprovados. Um campo vazio mantém o indicador em validação, sem criar estimativas implícitas.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map(field => <div key={field.key} className="rounded-lg border bg-white p-3"><Label htmlFor={field.key} className="text-sm">{field.label} <span className="font-normal text-muted-foreground">({field.unit})</span></Label><Input id={field.key} className="mt-2" inputMode="decimal" value={draft[field.key]} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))} placeholder="Por configurar" /><p className="mt-1 text-xs text-muted-foreground">{field.note}</p></div>)}
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><AlertTriangle className="mt-0.5 size-4 shrink-0" />Os alertas de conformidade só são mostrados quando o respetivo limite estiver preenchido. O histórico de alterações fica registado na auditoria.</div>
        <Button onClick={save} disabled={updateMutation.isPending}><Save className="mr-2 size-4" />{updateMutation.isPending ? "A guardar..." : "Guardar parâmetros aprovados"}</Button>
      </CardContent>
    </Card>
  </div>;
}
