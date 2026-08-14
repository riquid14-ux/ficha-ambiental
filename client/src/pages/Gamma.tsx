import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Heart, Users, Leaf, Lightbulb, BookOpen, Plus, Star, CheckCircle2, XCircle, Settings } from "lucide-react";

const PILLAR_ICONS: Record<string, any> = {
  "Educação": BookOpen,
  "Saúde Mental e Bem-Estar": Heart,
  "Inclusão Social e Integração": Users,
  "Sustentabilidade": Leaf,
  "Inovação e Abordagem": Lightbulb,
};

const MUNICIPALITIES = ["Sines", "Santiago do Cacém", "Sines e Santiago do Cacém"];
const ENTITY_TYPES = ["Associação", "IPSS", "Escola", "Empresa", "Grupo informal", "Pessoa individual", "Entidade pública"];
const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  eligible: "bg-green-100 text-green-800",
  not_eligible: "bg-red-100 text-red-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-gray-100 text-gray-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-purple-100 text-purple-800",
};

// Mock data for the edition (in production this comes from the DB)
const EDITION = {
  name: "GAMMA 2.0",
  pillars: ["Educação", "Saúde Mental e Bem-Estar", "Inclusão Social e Integração", "Sustentabilidade", "Inovação e Abordagem"],
  eligibility: [
    { key: "E1", label: "O projeto está alinhado com pelo menos um dos cinco pilares?" },
    { key: "E2", label: "A entidade proponente está legalmente constituída?" },
    { key: "E3", label: "O projeto beneficia a comunidade local (Sines/Santiago do Cacém)?" },
    { key: "E4", label: "O orçamento é realista e proporcional ao impacto?" },
    { key: "E5", label: "Existe capacidade de execução demonstrada?" },
    { key: "E6", label: "O projeto não duplica iniciativas já existentes?" },
  ],
  scoring: [
    { key: "C1", label: "Necessidade local e evidência", weight: 12 },
    { key: "C2", label: "Alinhamento com o pilar", weight: 10 },
    { key: "C3", label: "Beneficiários, alcance e equidade", weight: 8 },
    { key: "C4", label: "Impacto esperado", weight: 12 },
    { key: "C5", label: "Metodologia e atividades", weight: 8 },
    { key: "C6", label: "Participação da comunidade", weight: 7 },
    { key: "C7", label: "Parcerias e complementaridade", weight: 6 },
    { key: "C8", label: "Capacidade da equipa e viabilidade", weight: 8 },
    { key: "C9", label: "Cronograma", weight: 5 },
    { key: "C10", label: "Orçamento e custo-impacto", weight: 8 },
    { key: "C11", label: "Continuidade e escala", weight: 6 },
    { key: "C12", label: "Indicadores e monitorização", weight: 5 },
    { key: "C13", label: "Riscos, ética e salvaguardas", weight: 5 },
  ],
};

export default function Gamma() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("portfolio");
  const [showNewForm, setShowNewForm] = useState(false);
  const isAdmin = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "pm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GAMMA — Sustentabilidade Comunitária</h1>
          <p className="text-muted-foreground">Programa de apoio a projetos comunitários · Edição: {EDITION.name}</p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setActiveTab("config")}>
            <Settings className="w-4 h-4 mr-1" /> Configurar Edição
          </Button>
        )}
      </div>

      {/* Pillar Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {EDITION.pillars.map(pillar => {
          const Icon = PILLAR_ICONS[pillar] || Leaf;
          return (
            <Card key={pillar} className="text-center p-3">
              <Icon className="w-6 h-6 mx-auto mb-1 text-green-600" />
              <p className="text-xs font-medium">{pillar}</p>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="portfolio">Portefólio</TabsTrigger>
          <TabsTrigger value="candidatura">Nova Candidatura</TabsTrigger>
          <TabsTrigger value="avaliacao">Avaliação</TabsTrigger>
          <TabsTrigger value="necessidades">Necessidades</TabsTrigger>
          {isAdmin && <TabsTrigger value="config">Configuração</TabsTrigger>}
        </TabsList>

        {/* Portfolio */}
        <TabsContent value="portfolio" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">Projetos Candidatos</CardTitle>
              <Button size="sm" onClick={() => setActiveTab("candidatura")}><Plus className="w-4 h-4 mr-1" /> Nova Candidatura</Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma candidatura submetida nesta edição. Clique em "Nova Candidatura" para começar.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Candidacy Form */}
        <TabsContent value="candidatura" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Ficha de Candidatura — {EDITION.name}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Nome do Projeto</label><Input placeholder="Nome do projeto comunitário" /></div>
                <div><label className="text-sm font-medium">Entidade Proponente</label><Input placeholder="Nome da entidade" /></div>
                <div><label className="text-sm font-medium">Tipo de Entidade</label>
                  <Select><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-sm font-medium">Município</label>
                  <Select><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{MUNICIPALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-sm font-medium">Pilar</label>
                  <Select><SelectTrigger><SelectValue placeholder="Selecionar pilar..." /></SelectTrigger>
                    <SelectContent>{EDITION.pillars.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-sm font-medium">Orçamento Estimado (€)</label><Input type="number" placeholder="0.00" /></div>
              </div>
              <div><label className="text-sm font-medium">Descrição do Projeto</label><Textarea placeholder="Descreva o projeto, os seus objetivos e atividades previstas..." rows={3} /></div>
              <div><label className="text-sm font-medium">Necessidade Identificada</label><Textarea placeholder="Que necessidade da comunidade este projeto pretende resolver?" rows={2} /></div>
              <div><label className="text-sm font-medium">Solução Proposta</label><Textarea placeholder="Como é que o projeto vai resolver a necessidade identificada?" rows={2} /></div>
              <div><label className="text-sm font-medium">Impacto Esperado</label><Textarea placeholder="Que impacto espera alcançar? Quantos beneficiários?" rows={2} /></div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => { toast.success("Candidatura submetida com sucesso!"); setActiveTab("portfolio"); }}>Submeter Candidatura</Button>
                <Button variant="outline" onClick={() => setActiveTab("portfolio")}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evaluation */}
        <TabsContent value="avaliacao" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Avaliação de Candidaturas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Critérios de Elegibilidade (Sim/Não)</h3>
                {EDITION.eligibility.map(e => (
                  <div key={e.key} className="flex items-center gap-3 p-2 border rounded">
                    <Badge variant="outline" className="shrink-0">{e.key}</Badge>
                    <span className="text-sm flex-1">{e.label}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs"><CheckCircle2 className="w-3 h-3 mr-1 text-green-600" />Sim</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs"><XCircle className="w-3 h-3 mr-1 text-red-600" />Não</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-semibold">Critérios de Pontuação Ponderada (Total: 100%)</h3>
                {EDITION.scoring.map(c => (
                  <div key={c.key} className="flex items-center gap-3 p-2 border rounded">
                    <Badge variant="outline" className="shrink-0 w-10 justify-center">{c.weight}%</Badge>
                    <span className="text-sm flex-1">{c.label}</span>
                    <Input type="number" min="0" max="10" placeholder="0-10" className="w-20 h-7 text-xs" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Needs */}
        <TabsContent value="necessidades" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">Registo de Necessidades Identificadas</CardTitle>
              {isAdmin && <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma necessidade registada. Utilize este espaço para documentar necessidades da comunidade local que possam originar candidaturas futuras.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Config (Admin only) */}
        {isAdmin && (
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Configuração da Edição</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800"><strong>Edição Ativa:</strong> {EDITION.name} (Edição #{2})</p>
                  <p className="text-xs text-amber-700 mt-1">Os pilares, critérios de elegibilidade e pesos de pontuação são configuráveis por edição. Candidaturas da edição anterior mantêm os critérios com que foram avaliadas.</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Pilares ({EDITION.pillars.length})</h3>
                  <div className="space-y-1">
                    {EDITION.pillars.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 border rounded text-sm">
                        <span className="w-6 text-center text-xs text-muted-foreground">{i+1}</span>
                        <span className="flex-1">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Critérios de Pontuação (soma = {EDITION.scoring.reduce((s, c) => s + c.weight, 0)}%)</h3>
                  <div className="space-y-1">
                    {EDITION.scoring.map(c => (
                      <div key={c.key} className="flex items-center gap-2 p-2 border rounded text-sm">
                        <Badge variant="outline" className="w-12 justify-center">{c.weight}%</Badge>
                        <span className="flex-1">{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
