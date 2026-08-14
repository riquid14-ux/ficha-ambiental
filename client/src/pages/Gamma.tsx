import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Heart, Users, Leaf, Lightbulb, BookOpen, Plus, Settings, Trash2, Edit2, CheckCircle2, XCircle } from "lucide-react";

const DEFAULT_PILLARS = ["Educação", "Saúde Mental e Bem-Estar", "Inclusão Social e Integração", "Sustentabilidade", "Inovação e Abordagem"];
const PILLAR_ICONS: Record<string, any> = { "Educação": BookOpen, "Saúde Mental e Bem-Estar": Heart, "Inclusão Social e Integração": Users, "Sustentabilidade": Leaf, "Inovação e Abordagem": Lightbulb };
const MUNICIPALITIES = ["Sines", "Santiago do Cacém", "Sines e Santiago do Cacém"];
const ENTITY_TYPES = ["Associação", "IPSS", "Escola", "Empresa", "Grupo informal", "Pessoa individual", "Entidade pública"];
const STATUSES = ["Não iniciado", "Em preparação", "Em curso", "Concluído", "Suspenso"];
const PRIORITIES = ["Alta", "Média", "Baixa"];

const DEFAULT_ELIGIBILITY = [
  { key: "E1", label: "O projeto beneficia diretamente Sines e/ou Santiago do Cacém?" },
  { key: "E2", label: "O projeto enquadra-se claramente em pelo menos um dos cinco pilares?" },
  { key: "E3", label: "A candidatura contém problema, atividades, beneficiários, orçamento e cronograma?" },
  { key: "E4", label: "O prazo, a equipa e o orçamento são globalmente plausíveis?" },
  { key: "E5", label: "A entidade e pessoa responsável estão identificadas e disponíveis?" },
  { key: "E6", label: "Existem condições mínimas de legalidade, ética, segurança e proteção de dados?" },
];

const DEFAULT_SCORING = [
  { key: "C1", label: "Necessidade local e evidência", weight: 12, question: "O problema é prioritário, atual e demonstrado por dados?" },
  { key: "C2", label: "Alinhamento com o pilar", weight: 10, question: "A solução responde de forma direta e coerente ao pilar principal?" },
  { key: "C3", label: "Beneficiários, alcance e equidade", weight: 8, question: "Os beneficiários estão bem definidos e o projeto reduz barreiras?" },
  { key: "C4", label: "Impacto esperado", weight: 12, question: "A mudança proposta é relevante, específica e plausível?" },
  { key: "C5", label: "Metodologia e atividades", weight: 8, question: "As atividades são adequadas e suficientes para atingir os objetivos?" },
  { key: "C6", label: "Participação da comunidade", weight: 7, question: "A comunidade participa no desenho, execução ou avaliação?" },
  { key: "C7", label: "Parcerias e complementaridade", weight: 6, question: "As parcerias acrescentam capacidade e evitam duplicação?" },
  { key: "C8", label: "Capacidade da equipa e viabilidade", weight: 8, question: "A equipa tem competências, tempo e governação adequados?" },
  { key: "C9", label: "Cronograma", weight: 5, question: "O plano temporal é realista, faseado e com marcos verificáveis?" },
  { key: "C10", label: "Orçamento e custo-impacto", weight: 8, question: "Os custos são claros, elegíveis, proporcionais e eficientes?" },
  { key: "C11", label: "Continuidade e escala", weight: 6, question: "Existem condições para manter benefícios ou replicar a solução?" },
  { key: "C12", label: "Indicadores e monitorização", weight: 5, question: "Há indicadores, metas e fontes que permitam medir resultados?" },
  { key: "C13", label: "Riscos, ética e salvaguardas", weight: 5, question: "Os riscos e salvaguardas estão identificados e serão geridos?" },
];

export default function Gamma() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("portfolio");
  const isAdmin = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "pm";

  // Edition state (admin can create/edit)
  const [editions, setEditions] = useState([{ id: 1, name: "GAMMA 2.0", number: 2, status: "active", pillars: [...DEFAULT_PILLARS], eligibility: [...DEFAULT_ELIGIBILITY], scoring: [...DEFAULT_SCORING] }]);
  const [activeEdition, setActiveEdition] = useState(0);
  const [showNewEdition, setShowNewEdition] = useState(false);
  const [newEditionName, setNewEditionName] = useState("");
  const [newPillar, setNewPillar] = useState("");
  const [winners, setWinners] = useState<{name: string; entity: string; pillar: string; amount: string; status: string; timeline: {phase: string; date: string; done: boolean}[]}[]>([]);
  const [showAddWinner, setShowAddWinner] = useState(false);
  const [newWinner, setNewWinner] = useState({ name: "", entity: "", pillar: "", amount: "", status: "Em curso" });
  const [editingPillar, setEditingPillar] = useState<number | null>(null);
  const [editPillarValue, setEditPillarValue] = useState("");

  const edition = editions[activeEdition];

  const createNewEdition = () => {
    if (!newEditionName.trim()) return;
    const newEd = { id: editions.length + 1, name: newEditionName, number: editions.length + 1, status: "draft" as string, pillars: [...DEFAULT_PILLARS], eligibility: [...DEFAULT_ELIGIBILITY], scoring: [...DEFAULT_SCORING] };
    setEditions([...editions, newEd]);
    setActiveEdition(editions.length);
    setShowNewEdition(false);
    setNewEditionName("");
    toast.success(`Edição "${newEditionName}" criada com sucesso!`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">GAMMA — Sustentabilidade Comunitária</h1>
            <p className="text-muted-foreground">Programa de apoio a projetos comunitários</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(activeEdition)} onValueChange={v => setActiveEdition(Number(v))}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {editions.map((ed, i) => <SelectItem key={i} value={String(i)}>{ed.name} {ed.status === "draft" ? "(Rascunho)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && <Button size="sm" variant="outline" onClick={() => setShowNewEdition(true)}><Plus className="w-4 h-4 mr-1" /> Nova Edição</Button>}
          </div>
        </div>

        {/* New Edition Dialog */}
        {showNewEdition && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">Criar Nova Edição</h3>
              <div className="flex gap-2">
                <Input placeholder="Nome da edição (ex: GAMMA 3.0)" value={newEditionName} onChange={e => setNewEditionName(e.target.value)} />
                <Button onClick={createNewEdition}>Criar</Button>
                <Button variant="outline" onClick={() => setShowNewEdition(false)}>Cancelar</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">A nova edição será criada com os pilares e critérios padrão. Pode editá-los depois na tab Definições.</p>
            </CardContent>
          </Card>
        )}

        {/* Pillar Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {edition.pillars.map(pillar => {
            const Icon = PILLAR_ICONS[pillar] || Leaf;
            return (
              <Card key={pillar} className="text-center p-3 hover:shadow-md transition-shadow">
                <Icon className="w-6 h-6 mx-auto mb-1 text-green-600" />
                <p className="text-xs font-medium leading-tight">{pillar}</p>
              </Card>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="portfolio">Portefólio</TabsTrigger>
            <TabsTrigger value="candidatura">Candidatura</TabsTrigger>
            <TabsTrigger value="avaliacao">Avaliação</TabsTrigger>
            <TabsTrigger value="necessidades">Necessidades</TabsTrigger>
            <TabsTrigger value="plano">Plano de Apoio</TabsTrigger>
            {isAdmin && <TabsTrigger value="definicoes">Definições</TabsTrigger>}
          </TabsList>

          {/* Portfolio */}
          <TabsContent value="portfolio" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Projetos — {edition.name}</CardTitle>
                <Button size="sm" onClick={() => setActiveTab("candidatura")}><Plus className="w-4 h-4 mr-1" /> Nova Candidatura</Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma candidatura submetida nesta edição.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Candidatura */}
          <TabsContent value="candidatura" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Ficha de Candidatura — {edition.name}</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm border-b pb-1">A. Identificação do Projeto e da Entidade</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-xs font-medium">Nome do Projeto *</label><Input placeholder="Nome do projeto comunitário" /></div>
                    <div><label className="text-xs font-medium">Entidade Proponente *</label><Input placeholder="Nome da entidade" /></div>
                    <div><label className="text-xs font-medium">Tipo de Entidade *</label><Select><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent>{ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-xs font-medium">Pessoa Responsável</label><Input placeholder="Nome completo" /></div>
                    <div><label className="text-xs font-medium">E-mail</label><Input type="email" placeholder="email@entidade.pt" /></div>
                    <div><label className="text-xs font-medium">Telefone</label><Input placeholder="+351..." /></div>
                    <div><label className="text-xs font-medium">Município(s) Beneficiado(s) *</label><Select><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent>{MUNICIPALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-xs font-medium">Localidade(s) / Área de Intervenção</label><Input placeholder="Localidades específicas" /></div>
                    <div><label className="text-xs font-medium">Pilar Principal *</label><Select><SelectTrigger><SelectValue placeholder="Selecionar pilar..." /></SelectTrigger><SelectContent>{edition.pillars.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-xs font-medium">Pilar Secundário</label><Select><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{edition.pillars.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-xs font-medium">Duração Estimada (meses)</label><Input type="number" placeholder="6" /></div>
                    <div><label className="text-xs font-medium">Data Prevista de Início</label><Input type="date" /></div>
                    <div><label className="text-xs font-medium">Orçamento Total (€) *</label><Input type="number" placeholder="0.00" /></div>
                    <div><label className="text-xs font-medium">Financiamento Solicitado ao GAMMA (€)</label><Input type="number" placeholder="0.00" /></div>
                    <div><label className="text-xs font-medium">Cofinanciamento / Recursos Próprios (€)</label><Input type="number" placeholder="0.00" /></div>
                    <div><label className="text-xs font-medium">Outros Financiamentos ou Apoios</label><Input placeholder="Descrever" /></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm border-b pb-1">B. Necessidade, Solução e Impacto</h3>
                  <div><label className="text-xs font-medium">1. Resumo Executivo (máx. 200 palavras)</label><Textarea placeholder="Síntese do projeto..." rows={3} /></div>
                  <div><label className="text-xs font-medium">2. Necessidade Local</label><Textarea placeholder="Que necessidade da comunidade este projeto pretende resolver?" rows={3} /></div>
                  <div><label className="text-xs font-medium">3. Evidência da Necessidade</label><Textarea placeholder="Dados, estudos ou testemunhos que comprovam a necessidade" rows={2} /></div>
                  <div><label className="text-xs font-medium">4. Beneficiários (quem, quantos, como são selecionados)</label><Textarea placeholder="Descrever beneficiários diretos e indiretos" rows={2} /></div>
                  <div><label className="text-xs font-medium">5. Equidade e Grupos Prioritários</label><Textarea placeholder="Como o projeto promove equidade e inclusão?" rows={2} /></div>
                  <div><label className="text-xs font-medium">6. Objetivo Geral e Objetivos Específicos</label><Textarea placeholder="Objetivos SMART..." rows={2} /></div>
                  <div><label className="text-xs font-medium">7. Mudanças Esperadas (outcomes)</label><Textarea placeholder="Que mudanças concretas se esperam?" rows={2} /></div>
                  <div><label className="text-xs font-medium">8. Atividades e Metodologia</label><Textarea placeholder="Descrição das atividades, faseamento, metodologia" rows={3} /></div>
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => { toast.success("Candidatura submetida!"); setActiveTab("portfolio"); }}>Submeter Candidatura</Button>
                  <Button variant="outline">Guardar Rascunho</Button>
                  <Button variant="ghost" onClick={() => setActiveTab("portfolio")}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Avaliação */}
          <TabsContent value="avaliacao" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Matriz de Avaliação Individual</CardTitle><p className="text-xs text-muted-foreground">Classificar de 1 a 5 e justificar com base na candidatura.</p></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">1. Verificação de Elegibilidade (Sim/Não)</h3>
                  {edition.eligibility.map(e => (
                    <div key={e.key} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Badge variant="outline" className="shrink-0 w-8 justify-center">{e.key}</Badge>
                      <span className="text-sm flex-1">{e.label}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" />Sim</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><XCircle className="w-3 h-3 text-red-600" />Não</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-semibold text-sm">2. Pontuação Ponderada (Total: {edition.scoring.reduce((s, c) => s + c.weight, 0)}%)</h3>
                  {edition.scoring.map(c => (
                    <div key={c.key} className="p-3 border rounded-lg space-y-1">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="shrink-0 w-12 justify-center text-xs">{c.weight}%</Badge>
                        <span className="text-sm font-medium flex-1">{c.label}</span>
                        <Input type="number" min="1" max="5" placeholder="1-5" className="w-16 h-7 text-xs" />
                      </div>
                      <p className="text-xs text-muted-foreground ml-16">{c.question}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-semibold text-sm">3. Parecer e Condições</h3>
                  <div><label className="text-xs font-medium">Pontos Fortes</label><Textarea rows={2} placeholder="Identificar os pontos fortes da candidatura..." /></div>
                  <div><label className="text-xs font-medium">Lacunas / Condições antes de Financiar</label><Textarea rows={2} placeholder="Condições que devem ser cumpridas..." /></div>
                  <div><label className="text-xs font-medium">Parecer Final do Avaliador</label><Select><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent><SelectItem value="approve">Aprovar</SelectItem><SelectItem value="conditional">Aprovar com Condições</SelectItem><SelectItem value="reject">Rejeitar</SelectItem></SelectContent></Select></div>
                  <div><label className="text-xs font-medium">Conflitos de Interesse Declarados</label><Input placeholder="Declarar ou indicar 'Nenhum'" /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Necessidades */}
          <TabsContent value="necessidades" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle className="text-lg">Registo de Necessidades</CardTitle><p className="text-xs text-muted-foreground">Necessidades identificadas na comunidade que podem originar candidaturas futuras.</p></div>
                {isAdmin && <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Registar Necessidade</Button>}
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma necessidade registada. Utilize este espaço para documentar necessidades da comunidade local.</div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plano de Apoio */}
          <TabsContent value="plano" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Plano de Apoio</CardTitle><p className="text-xs text-muted-foreground">Acompanhamento dos projetos aprovados: marcos, desembolsos e relatórios.</p></CardHeader>
              <CardContent>
                <div className="text-center py-8 text-sm text-muted-foreground">Nenhum projeto aprovado nesta edição. Os planos de apoio são criados automaticamente após aprovação.</div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Vencedores */}
          <TabsContent value="vencedores" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Projetos Vencedores — {edition.name}</CardTitle>
                  {isAdmin && <Button size="sm" onClick={() => setShowAddWinner(!showAddWinner)}><Plus className="w-3 h-3 mr-1" /> Adicionar Vencedor</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showAddWinner && isAdmin && (
                  <div className="p-4 border-2 border-dashed rounded-lg space-y-3 bg-green-50/50">
                    <h4 className="font-semibold text-sm">Novo Projeto Vencedor</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Nome do projeto..." value={newWinner.name} onChange={e => setNewWinner({...newWinner, name: e.target.value})} className="h-8 text-sm" />
                      <Input placeholder="Entidade promotora..." value={newWinner.entity} onChange={e => setNewWinner({...newWinner, entity: e.target.value})} className="h-8 text-sm" />
                      <select className="h-8 text-sm border rounded px-2" value={newWinner.pillar} onChange={e => setNewWinner({...newWinner, pillar: e.target.value})}>
                        <option value="">Pilar...</option>
                        {edition.pillars.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <Input placeholder="Montante (€)..." value={newWinner.amount} onChange={e => setNewWinner({...newWinner, amount: e.target.value})} className="h-8 text-sm" />
                    </div>
                    <Button size="sm" onClick={() => { if (newWinner.name) { setWinners([...winners, {...newWinner, timeline: [{phase: "Arranque", date: "", done: false}, {phase: "Meio-termo", date: "", done: false}, {phase: "Conclusão", date: "", done: false}]}]); setNewWinner({name: "", entity: "", pillar: "", amount: "", status: "Em curso"}); setShowAddWinner(false); toast.success("Vencedor adicionado!"); } }}>Confirmar</Button>
                  </div>
                )}
                {winners.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Nenhum projeto vencedor registado nesta edição.</div>
                ) : (
                  <div className="space-y-4">
                    {winners.map((w, wi) => (
                      <Card key={wi} className="border-l-4 border-l-green-500">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">{w.name}</h4>
                              <p className="text-xs text-muted-foreground">{w.entity} · {w.pillar} · {w.amount}€</p>
                            </div>
                            <Badge variant={w.status === "Concluído" ? "default" : "secondary"}>{w.status}</Badge>
                          </div>
                          <div>
                            <p className="text-xs font-medium mb-2">Timeline do Projeto:</p>
                            <div className="flex items-center gap-2">
                              {w.timeline.map((t, ti) => (
                                <div key={ti} className="flex-1">
                                  <div className="flex items-center gap-1">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${t.done ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
                                      {t.done && <span className="text-white text-[8px]">✓</span>}
                                    </div>
                                    <span className="text-xs">{t.phase}</span>
                                  </div>
                                  {isAdmin && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <input type="date" className="text-[10px] border rounded px-1 h-5 w-24" value={t.date} onChange={e => { const updated = [...winners]; updated[wi].timeline[ti].date = e.target.value; setWinners(updated); }} />
                                      <input type="checkbox" checked={t.done} onChange={e => { const updated = [...winners]; updated[wi].timeline[ti].done = e.target.checked; setWinners(updated); }} className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                              ))}
                              {isAdmin && (
                                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { const updated = [...winners]; updated[wi].timeline.push({phase: "Nova fase", date: "", done: false}); setWinners(updated); }}>+ Fase</Button>
                              )}
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-2 pt-2 border-t">
                              <select className="h-7 text-xs border rounded px-2" value={w.status} onChange={e => { const updated = [...winners]; updated[wi].status = e.target.value; setWinners(updated); }}>
                                <option value="Em curso">Em curso</option><option value="Concluído">Concluído</option><option value="Suspenso">Suspenso</option>
                              </select>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => { setWinners(winners.filter((_, i) => i !== wi)); }}>
                                <Trash2 className="w-3 h-3 mr-1" /> Remover
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Definições (Admin) */}
          {isAdmin && (
            <TabsContent value="definicoes" className="space-y-4">
              <Card>
                <CardHeader><div className="flex items-center gap-3"><CardTitle className="text-lg">Definições da Edição:</CardTitle><Input className="h-8 text-sm w-48" value={edition.name} onChange={e => { const updated = [...editions]; updated[activeEdition].name = e.target.value; setEditions(updated); }} /></div></CardHeader>
                <CardContent className="space-y-6">
                  {/* Pillars */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Pilares ({edition.pillars.length})</h3>
                    <div className="space-y-2">
                      {edition.pillars.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 border rounded">
                          {editingPillar === i ? (
                            <>
                              <Input value={editPillarValue} onChange={e => setEditPillarValue(e.target.value)} className="h-7 text-sm" />
                              <Button size="sm" className="h-7" onClick={() => { const updated = [...editions]; updated[activeEdition].pillars[i] = editPillarValue; setEditions(updated); setEditingPillar(null); }}>OK</Button>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingPillar(null)}>×</Button>
                            </>
                          ) : (
                            <>
                              <span className="text-sm flex-1">{p}</span>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditingPillar(i); setEditPillarValue(p); }}><Edit2 className="w-3 h-3" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => { const updated = [...editions]; updated[activeEdition].pillars.splice(i, 1); setEditions(updated); }}><Trash2 className="w-3 h-3" /></Button>
                            </>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <Input placeholder="Novo pilar..." value={newPillar} onChange={e => setNewPillar(e.target.value)} className="h-8 text-sm" />
                        <Button size="sm" className="h-8" onClick={() => { if (newPillar.trim()) { const updated = [...editions]; updated[activeEdition].pillars.push(newPillar.trim()); setEditions(updated); setNewPillar(""); } }}><Plus className="w-3 h-3 mr-1" /> Adicionar</Button>
                      </div>
                    </div>
                  </div>

                  {/* Eligibility */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Critérios de Elegibilidade ({edition.eligibility.length})</h3>
                    <div className="space-y-1">
                      {edition.eligibility.map((e, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 border rounded text-sm">
                          <Badge variant="outline" className="shrink-0">{e.key}</Badge>
                          <Input className="flex-1 h-7 text-xs" value={e.label} onChange={ev => { const updated = [...editions]; updated[activeEdition].eligibility[i].label = ev.target.value; setEditions(updated); }} />
                          <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => { const updated = [...editions]; updated[activeEdition].eligibility.splice(i, 1); setEditions(updated); }}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => { const updated = [...editions]; const n = updated[activeEdition].eligibility.length + 1; updated[activeEdition].eligibility.push({key: "E" + n, label: "Novo critério..."}); setEditions(updated); }}><Plus className="w-3 h-3 mr-1" /> Adicionar Critério</Button>
                    </div>
                  </div>

                  {/* Scoring */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Critérios de Pontuação (soma = {edition.scoring.reduce((s, c) => s + c.weight, 0)}%)</h3>
                    <div className="space-y-1">
                      {edition.scoring.map((c, i) => (
                        <div key={c.key} className="flex items-center gap-2 p-2 border rounded text-sm">
                          <Input type="number" className="w-14 h-7 text-xs text-center" value={c.weight} onChange={e => { const updated = [...editions]; updated[activeEdition].scoring[i].weight = parseInt(e.target.value) || 0; setEditions(updated); }} />
                          <span className="text-xs text-muted-foreground">%</span>
                          <Input className="flex-1 h-7 text-xs" value={c.label} onChange={e => { const updated = [...editions]; updated[activeEdition].scoring[i].label = e.target.value; setEditions(updated); }} />
                          <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => { const updated = [...editions]; updated[activeEdition].scoring.splice(i, 1); setEditions(updated); }}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => { const updated = [...editions]; const n = updated[activeEdition].scoring.length + 1; updated[activeEdition].scoring.push({key: "C" + n, label: "Novo critério...", weight: 5, question: ""}); setEditions(updated); }}><Plus className="w-3 h-3 mr-1" /> Adicionar Critério</Button>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button variant="outline" className="w-full" onClick={() => toast.success("Definições guardadas!")}>Guardar Alterações</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
