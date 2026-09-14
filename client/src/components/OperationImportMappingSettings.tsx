import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { FileInput, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const mappingFields = [
  { key: "organizerTimestamp", label: "Data/hora no organizador", help: "Coluna que identifica cada leitura de 15 minutos.", initial: "time stamp, timestamp" },
  { key: "outdoorTemp", label: "Temperatura exterior", help: "Temperatura ambiente de referência.", initial: "temp exterior" },
  { key: "seawaterTemp", label: "Temperatura de captação", help: "Temperatura da água do mar na entrada.", initial: "sw_tmp" },
  { key: "seawaterFlow", label: "Caudal de água do mar", help: "Caudal de captação do circuito.", initial: "sw_flow" },
  { key: "coolingCycles", label: "Ciclos de arrefecimento", help: "Contagem ou indicador de ciclos.", initial: "total_fc" },
  { key: "wue", label: "WUE recebido", help: "WUE informado diretamente pelo BMS, se existir.", initial: "wue" },
  { key: "pcwSupply", label: "PCW de fornecimento", help: "Temperatura PCW de fornecimento.", initial: "pcw_sp1" },
  { key: "pcwReturn", label: "PCW de retorno", help: "Temperatura PCW de retorno.", initial: "pcw_ret1" },
  { key: "hallPowerColumns", label: "Salas TI para somar", help: "Todas as colunas que compõem a carga TI.", initial: "artic, warhol, blue" },
  { key: "sitePowerMw", label: "Potência total do site", help: "Potência total do edifício em MW; é convertida para kW.", initial: "site" },
] as const;

type MappingKey = typeof mappingFields[number]["key"];
type MappingDraft = Record<MappingKey, string>;

function defaults(): MappingDraft { return Object.fromEntries(mappingFields.map(field => [field.key, field.initial])) as MappingDraft; }
function parseStoredMapping(value: string | null | undefined): MappingDraft {
  const next = defaults();
  if (!value) return next;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    for (const field of mappingFields) {
      const aliases = parsed[field.key];
      if (Array.isArray(aliases)) {
        const clean = aliases.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map(item => item.trim()).slice(0, 12);
        if (clean.length) next[field.key] = clean.join(", ");
      }
    }
  } catch { /* A configuração vazia ou antiga mantém os aliases de referência. */ }
  return next;
}

export default function OperationImportMappingSettings({ projectId, mappingJson, onSaved }: { projectId: number; mappingJson?: string | null; onSaved: () => void }) {
  const [draft, setDraft] = useState<MappingDraft>(() => parseStoredMapping(mappingJson));
  const update = trpc.operation.updateImportMapping.useMutation({ onSuccess: () => { toast.success("Mapeamento de importação guardado e auditado."); onSaved(); }, onError: error => toast.error(error.message) });
  useEffect(() => { setDraft(parseStoredMapping(mappingJson)); }, [mappingJson]);
  const save = () => {
    const mapping = {} as Record<MappingKey, string[]>;
    for (const field of mappingFields) {
      const aliases = Array.from(new Set(draft[field.key].split(",").map(item => item.trim()).filter(item => item && item.length <= 80 && !/[<>\r\n]/.test(item)))).slice(0, 12);
      if (!aliases.length) { toast.error(`Indique pelo menos um cabeçalho para ${field.label.toLowerCase()}.`); return; }
      mapping[field.key] = aliases;
    }
    update.mutate({ projectId, mapping });
  };
  return <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="rounded-xl bg-sky-100 p-2 text-sky-700"><FileInput className="size-5" /></span><div><h3 className="font-semibold text-slate-950">Mapeamento de cabeçalhos do relatório</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Quando o BMS alterar nomes de colunas, indique abaixo os cabeçalhos que correspondem a cada métrica. O mapeamento aplica-se apenas a <strong>novas importações</strong>; não reescreve leituras históricas.</p></div></div><Button type="button" onClick={save} disabled={update.isPending} className="shrink-0"><Save className="mr-2 size-4" />{update.isPending ? "A guardar..." : "Guardar mapeamento"}</Button></div><div className="mt-5 grid gap-4 md:grid-cols-2">{mappingFields.map(field => <div key={field.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><Label htmlFor={`mapping-${field.key}`} className="text-sm font-medium text-slate-900">{field.label}</Label><Input id={`mapping-${field.key}`} className="mt-2 bg-white" value={draft[field.key]} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))} placeholder={field.initial} /><p className="mt-2 text-xs leading-5 text-slate-500">{field.help} Se houver alternativas, separe-as por vírgula.</p></div>)}</div><p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong>Regra de segurança:</strong> valide o primeiro relatório novo na aba Dados. A importação guarda sempre a fonte, a data, a unidade, a qualidade e o lote de origem para auditoria.</p></CardContent></Card>;
}
