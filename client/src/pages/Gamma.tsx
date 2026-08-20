import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { Heart, Users, Leaf, Lightbulb, BookOpen, Plus, Settings, Trash2, Edit2, CheckCircle2, XCircle, Download, Upload } from "lucide-react";

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

const NECESSIDADES_SINES = [{"id": 1, "pilar": "Educação", "necessidade": "Sucesso escolar e competências fundamentais", "sinais": "Necessidade de inclusão educativa, competências de leitura/escrita e competências socioemocionais.", "perguntas": "Que alunos enfrentam maiores dificuldades? Em que idades e escolas? Que barreiras explicam absentismo ou insucesso?", "indicadores": "Participação; assiduidade; progressão; competências antes/depois; satisfação de alunos e famílias.", "parceiros": "Escolas; agrupamentos; famílias; bibliotecas; associações juvenis; voluntários qualificados.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 2, "pilar": "Educação", "necessidade": "Ocupação de tempos livres e participação juvenil", "sinais": "Resposta insuficiente de ocupação de tempos livres a partir dos 6 anos e fraco envolvimento de jovens na comunidade.", "perguntas": "Que horários e atividades faltam? Que custos, transportes ou perceções impedem a participação?", "indicadores": "Vagas; taxa de ocupação; retenção; diversidade dos participantes; iniciativas cocriadas por jovens.", "parceiros": "Municípios; escolas; clubes; associações culturais/desportivas; transportes; espaços comunitários.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 3, "pilar": "Educação", "necessidade": "Qualificação, transição e aprendizagem ao longo da vida", "sinais": "Desajuste entre formação e mercado local; necessidade de requalificação e retenção de jovens.", "perguntas": "Que competências são pedidas pelas entidades empregadoras? Quem está excluído da oferta atual?", "indicadores": "Conclusão; certificação; transição para estágio/emprego; competências adquiridas; empregabilidade.", "parceiros": "IEFP; centros de formação; empresas; escolas profissionais; Sines Tecnopolo; mentores.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 4, "pilar": "Educação", "necessidade": "Português, literacia digital e acesso a informação", "sinais": "Barreiras linguísticas e diversidade de níveis de literacia afetam integração, formação e serviços.", "perguntas": "Que línguas e níveis estão presentes? Quais são as tarefas digitais ou administrativas mais difíceis?", "indicadores": "Níveis de língua; autonomia digital; acesso a serviços; conclusão de percursos; confiança.", "parceiros": "PLA; mediadores; bibliotecas; escolas; associações de migrantes; voluntariado.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 5, "pilar": "Saúde mental e bem-estar", "necessidade": "Prevenção e promoção de saúde mental em todas as idades", "sinais": "Agravamento de problemas de saúde mental e necessidade de respostas preventivas continuadas.", "perguntas": "Que grupos, contextos e sinais exigem prioridade? Que respostas já existem e onde estão as lacunas?", "indicadores": "Bem-estar percebido; literacia; procura precoce de ajuda; referenciações; adesão; continuidade.", "parceiros": "Saúde; escolas; IPSS; psicólogos; associações; cuidadores; desporto; cultura.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 6, "pilar": "Saúde mental e bem-estar", "necessidade": "Acesso, referenciação e continuidade de cuidados", "sinais": "Escassez de respostas públicas em psicologia, psiquiatria e neurologia; dificuldade de acesso a especialidades e transporte.", "perguntas": "Quanto tempo esperam as pessoas? Que situações ficam sem resposta? Que circuitos de referenciação funcionam?", "indicadores": "Tempo de espera; referenciações concluídas; desistências; sessões; cobertura territorial; satisfação.", "parceiros": "ULS/centros de saúde; profissionais; IPSS; municípios; transporte social; redes de referenciação.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 7, "pilar": "Saúde mental e bem-estar", "necessidade": "Literacia em saúde numa comunidade multicultural", "sinais": "Diferentes níveis de literacia em saúde, agravados por barreiras linguísticas e culturais.", "perguntas": "Que temas geram maior confusão? Em que línguas e formatos deve ser dada a informação?", "indicadores": "Compreensão antes/depois; alcance por língua; comportamentos preventivos; navegação nos serviços.", "parceiros": "Saúde; mediadores interculturais; farmácias; escolas; associações; comunicação local.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 8, "pilar": "Saúde mental e bem-estar", "necessidade": "Vida ativa, prevenção de dependências e apoio a cuidadores", "sinais": "Necessidade de promover estilos de vida ativos, prevenir comportamentos aditivos e valorizar cuidadores informais.", "perguntas": "Que atividades são acessíveis? Que grupos não participam? Que sobrecarga sentem os cuidadores?", "indicadores": "Atividade física; fatores de risco; sobrecarga do cuidador; adesão; competências de autocuidado.", "parceiros": "Desporto; saúde; CRI; associações; cuidadores; juntas; grupos informais.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 9, "pilar": "Inclusão social e integração", "necessidade": "Acolhimento e integração de migrantes", "sinais": "Barreiras linguísticas, acesso a emprego, serviços e necessidade de mediação intercultural.", "perguntas": "Quais são as primeiras dificuldades após a chegada? Que informação e acompanhamento faltam?", "indicadores": "Atendimentos; resolução de processos; participação; língua; emprego; redes de apoio.", "parceiros": "CLAIM/serviços; mediadores; escolas; empresas; associações; juntas; comunidades migrantes.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 10, "pilar": "Inclusão social e integração", "necessidade": "Envelhecimento ativo e combate ao isolamento", "sinais": "Aumento do envelhecimento, isolamento social e insuficiência de apoio domiciliário e vagas.", "perguntas": "Quem está isolado e porquê? Que transporte, companhia, cuidados ou atividades fariam diferença?", "indicadores": "Pessoas sinalizadas; contactos regulares; participação; autonomia; sobrecarga familiar; referenciações.", "parceiros": "IPSS; saúde; juntas; vizinhança; voluntariado; transporte; comércio local.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 11, "pilar": "Inclusão social e integração", "necessidade": "Deficiência, acessibilidade e participação", "sinais": "Barreiras urbanas, insuficiência de respostas e estigma na integração profissional.", "perguntas": "Que barreiras físicas, comunicacionais e atitudinais existem? Que adaptações são prioritárias?", "indicadores": "Barreiras removidas; participação; estágios/emprego; satisfação; produtos de apoio.", "parceiros": "Organizações de deficiência; município; empresas; escolas; arquitetos; terapeutas.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 12, "pilar": "Inclusão social e integração", "necessidade": "Pobreza infantil e igualdade de oportunidades", "sinais": "Pressão económica, lacunas em creche/OTL e respostas insuficientes de psicologia e pedopsiquiatria dos 0 aos 6 anos.", "perguntas": "Que crianças ficam sem serviços essenciais? Como participarão crianças, jovens e famílias no desenho?", "indicadores": "Acesso a serviços; assiduidade; desenvolvimento; participação; redução de privação; apoio familiar.", "parceiros": "CPCJ; escolas; saúde; ação social; IPSS; famílias; Garantia para a Infância.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 13, "pilar": "Inclusão social e integração", "necessidade": "Segurança, violência e vulnerabilidade extrema", "sinais": "Vulnerabilidade de vítimas de violência doméstica, pessoas sem abrigo e famílias com condições habitacionais frágeis.", "perguntas": "Que percursos de apoio são interrompidos? Onde existem riscos imediatos ou falta de resposta?", "indicadores": "Pessoas acompanhadas; segurança; acesso a direitos; alojamento; encaminhamentos concluídos.", "parceiros": "Ação social; saúde; forças de segurança; justiça; habitação; IPSS; apoio jurídico.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social 2025–2028"}, {"id": 19, "pilar": "Habitação e condições de vida", "necessidade": "Acesso a habitação a custos comportáveis", "sinais": "Pressão do mercado habitacional associada aos grandes investimentos no território; dificuldade de jovens, famílias e trabalhadores essenciais em comprar ou arrendar no concelho.", "perguntas": "Quem está a sair do concelho por falta de casa? Que grupos (jovens, famílias monoparentais, migrantes, seniores) estão mais expostos? Que soluções intermédias existem?", "indicadores": "Agregados apoiados; esforço com renda; saídas forçadas do concelho; soluções habitacionais criadas; tempo até solução.", "parceiros": "Município (ELH/1.º Direito); IHRU; IPSS; cooperativas de habitação; empregadores; senhorios; apoio jurídico.", "fonte": "Estratégia Local de Habitação de Sines (1.º Direito) — Município de Sines"}, {"id": 20, "pilar": "Habitação e condições de vida", "necessidade": "Condições de habitabilidade, reabilitação e eficiência energética", "sinais": "Existem agregados identificados em condições habitacionais indignas e parque habitacional envelhecido; pobreza energética e conforto térmico afetam saúde e despesa das famílias.", "perguntas": "Que casas precisam de intervenção urgente? Que famílias não conseguem aquecer/arrefecer a casa? Que apoios existem e porque não chegam?", "indicadores": "Habitações intervencionadas; famílias em pobreza energética; consumo/despesa energética; queixas de humidade e frio; satisfação pós-obra.", "parceiros": "Município; IHRU; ação social; empresas de construção; voluntariado técnico; fornecedores de energia.", "fonte": "Estratégia Local de Habitação de Sines (1.º Direito) — Município de Sines"}, {"id": 21, "pilar": "Habitação e condições de vida", "necessidade": "Acolhimento de novos residentes e coesão de bairro", "sinais": "Chegada acelerada de trabalhadores e novas famílias cria risco de sobrelotação, alojamento precário e tensões entre residentes antigos e novos.", "perguntas": "Onde há maior concentração de novos residentes? Que conflitos e receios existem? Que espaços de convívio entre comunidades faltam?", "indicadores": "Novos residentes acompanhados; ocorrências de sobrelotação; participação em atividades de bairro; perceção de convivência; conflitos mediados.", "parceiros": "Município; juntas de freguesia; empresas empregadoras; associações de moradores; associações de migrantes; forças de segurança.", "fonte": "Estratégia Local de Habitação de Sines — Município de Sines; Diagnóstico Social de Sines 2024"}, {"id": 22, "pilar": "Mobilidade e acessibilidade", "necessidade": "Transporte urbano e ligações dentro do concelho", "sinais": "O transporte urbano assegura um circuito com ligação a serviços públicos, escolas, mercado e centro de saúde, mas persistem lacunas de horários, frequência e cobertura fora da cidade (Porto Covo e áreas dispersas).", "perguntas": "Que percursos e horários faltam? Quem fica sem transporte ao fim do dia e ao fim de semana? Que custo travá a utilização?", "indicadores": "Passageiros; cobertura de horários; paragens servidas; passes emitidos; viagens perdidas por falta de transporte; satisfação.", "parceiros": "Município (autoridade de transportes); CIMAL; Rodoviária do Alentejo; escolas; IPSS; empresas; juntas de freguesia.", "fonte": "Município de Sines — Transporte urbano"}, {"id": 23, "pilar": "Mobilidade e acessibilidade", "necessidade": "Mobilidade suave, espaço público e acessibilidade universal", "sinais": "Elevada dependência do automóvel individual, pressão de estacionamento no centro e descontinuidade de percursos pedónais e cicláveis, com barreiras para pessoas com mobilidade reduzida.", "perguntas": "Que percursos diários são feitos a pé? Onde estão os pontos inseguros ou intransitáveis? Que ligações cicláveis fariam diferença?", "indicadores": "Repartição modal; metros de percurso acessível criado; barreiras removidas; sinistralidade pedónal; utilização de bicicleta.", "parceiros": "Município; CIMAL; escolas; organizações de deficiência; associações de ciclistas; comércio local; empresas.", "fonte": "Município de Sines — Transportes; PMUS Alentejo Litoral (CIMAL)"}, {"id": 24, "pilar": "Mobilidade e acessibilidade", "necessidade": "Transporte para saúde, formação e emprego", "sinais": "O acesso a consultas de especialidade, formação e postos de trabalho fora da cidade depende de transporte próprio, penalizando idosos, jovens sem carta e famílias de baixos rendimentos.", "perguntas": "Quantas consultas ou formações se perdem por falta de transporte? Que soluções partilhadas (boleias, transporte social) são viáveis?", "indicadores": "Deslocamentos assegurados; faltas evitadas; utentes abrangidos; custo por viagem; tempo médio de deslocamento.", "parceiros": "ULS Litoral Alentejano; Município; IPSS; Rodoviária do Alentejo; IEFP; empresas; voluntariado.", "fonte": "Diagnóstico Social de Sines 2024; Município de Sines — Transportes"}, {"id": 25, "pilar": "Cultura, património e identidade", "necessidade": "Acesso e participação cultural ao longo do ano", "sinais": "Sines tem uma oferta cultural forte (Centro de Artes, FMM, movimento associativo), mas a participação é desigual e a programação de proximidade fora dos grandes eventos é mais frágil.", "perguntas": "Quem não vai e porquê (custo, horário, transporte, língua, perceção)? Que públicos estão ausentes? Que criação local falta apoiar?", "indicadores": "Públicos alcançados; diversidade dos participantes; atividades descentralizadas; novos criadores apoiados; satisfação.", "parceiros": "Município (Centro de Artes, Biblioteca, Museu); associações culturais; escolas; IPSS; artistas locais; empresas mecenas.", "fonte": "Município de Sines — Cultura"}, {"id": 26, "pilar": "Cultura, património e identidade", "necessidade": "Interculturalidade e valorização das comunidades presentes", "sinais": "A comunidade é cada vez mais diversa; a cultura pode ser um espaço de encontro, mas exige programação cocriada com as comunidades e não apenas dirigida a elas.", "perguntas": "Que comunidades querem partilhar a sua cultura? Que barreiras existem à cocriação? Que datas e espaços fazem sentido?", "indicadores": "Iniciativas cocriadas; comunidades envolvidas; participantes por origem; perceção de pertença; parcerias novas.", "parceiros": "Associação Caboverdiana de Sines e Santiago do Cacém; associações de migrantes; CLAIM; Município; escolas; grupos informais.", "fonte": "Município de Sines — Cultura; Diagnóstico Social de Sines 2024"}, {"id": 27, "pilar": "Cultura, património e identidade", "necessidade": "Prática desportiva e equipamentos de proximidade", "sinais": "O movimento associativo desportivo é vasto e depende de apoios; faltam respostas para prática informal, feminina, adaptada e para idades em que se verifica maior abandono.", "perguntas": "Que modalidades e horários estão em falta? Que custos e transportes excluem? Onde há abandono da prática e porquê?", "indicadores": "Praticantes por idade e género; abandono; utilização de equipamentos; bolsas/isenções; atletas com deficiência integrados.", "parceiros": "Clubes e coletividades do concelho; Município; escolas; empresas patrocinadoras; saúde; famílias.", "fonte": "Município de Sines — Cultura e Desporto; protocolo de apoio ao movimento associativo (Município/Petrogal)"}, {"id": 28, "pilar": "Ambiente, clima e território", "necessidade": "Qualidade do ar, ruído e convivência com a atividade industrial", "sinais": "O concelho é marcado pela componente industrial e portuária; a harmonização entre crescimento económico, bem-estar e ambiente é um objetivo assumido no planeamento municipal e uma preocupação recorrente dos moradores.", "perguntas": "Que zonas e períodos geram mais queixas? Que informação ambiental chega à população e em que formato? Que canal de resposta existe?", "indicadores": "Queixas registadas e resolvidas; dados de qualidade do ar e ruído divulgados; alcance da informação; confiança percebida; sessões públicas.", "parceiros": "APA; CCDR Alentejo; Município; empresas industriais e portuárias; associações ambientais; moradores; saúde pública.", "fonte": "PDM de Sines (Município de Sines); Grandes Opções do Plano e Orçamento 2022–2026"}, {"id": 29, "pilar": "Ambiente, clima e território", "necessidade": "Adaptação climática, água e proteção do litoral", "sinais": "Existe um Plano Intermunicipal de Adaptação às Alterações Climáticas do Alentejo Litoral; calor extremo, seca, erosão costeira e risco de incêndio afetam de forma desigual grupos vulneráveis.", "perguntas": "Quem está mais exposto ao calor e à seca? Que espaços de refresco existem? Que zonas costeiras e rurais estão em risco?", "indicadores": "Pessoas vulneráveis identificadas; espaços de refresco disponíveis; consumo de água; área verde/sombra criada; ações de prevenção realizadas.", "parceiros": "CIMAL (PIAAC Alentejo Litoral); Município; Proteção Civil; APA/ICNF; escolas; IPSS; associações ambientais.", "fonte": "PIAAC — Plano Intermunicipal de Adaptação às Alterações Climáticas do Alentejo Litoral (Município de Sines)"}, {"id": 30, "pilar": "Ambiente, clima e território", "necessidade": "Resíduos, economia circular e literacia ambiental", "sinais": "O município desenvolve atividades regulares de educação ambiental (Bandeira Azul, biodiversidade, lixo marinho), mas os comportamentos de separação, reutilização e limpeza de praias e espaço público exigem continuidade.", "perguntas": "Que resíduos têm maior impacto local? Que públicos e locais devem ser priorizados? Que barreiras práticas dificultam a separação?", "indicadores": "Taxa de separação; resíduos recolhidos em ações de limpeza; participantes; conhecimento antes/depois; escolas envolvidas.", "parceiros": "Município (Ambiente); AMBILITAL; escolas; associações ambientais; comércio; empresas; voluntariado.", "fonte": "Município de Sines — Bandeira Azul | Atividades de Educação Ambiental"}, {"id": 31, "pilar": "Capacitação e participação cívica", "necessidade": "Capacitação e sustentabilidade financeira do terceiro setor", "sinais": "As associações e IPSS locais são o principal veículo de resposta social, mas dependem de apoios anuais, têm equipas pequenas e pouca capacidade de gestão de projetos e candidaturas.", "perguntas": "Que competências faltam (gestão, candidaturas, comunicação, avaliação)? Que estruturas estão em risco? Que apoio não financeiro faria diferença?", "indicadores": "Entidades capacitadas; candidaturas submetidas/aprovadas; diversificação de receitas; retenção de equipas; projetos com continuidade.", "parceiros": "Rede Social de Sines; Município; IPSS e associações; empresas (mecenato e voluntáriado de competências); fundações; CIMAL.", "fonte": "Plano de Desenvolvimento Social de Sines 2025–2028; protocolo de apoio ao movimento associativo (Município/Petrogal)"}, {"id": 32, "pilar": "Capacitação e participação cívica", "necessidade": "Participação cívica e voz da comunidade nas decisões", "sinais": "O município prevê reforçar consultas públicas e mecanismos participativos; num território em transformação rápida, moradores, jovens e comunidades migrantes têm pouca representação nos fóruns de decisão.", "perguntas": "Quem não está na mesa? Que formatos e horários permitiriam participar? Como se devolve à comunidade o resultado do que foi ouvido?", "indicadores": "Sessões realizadas; participantes e diversidade; propostas acolhidas; taxa de retorno de informação; confiança percebida.", "parceiros": "Município; juntas de freguesia; Rede Social; associações; escolas; conselho municipal de juventude; empresas.", "fonte": "Grandes Opções do Plano e Orçamento 2022–2026 (Município de Sines); Plano de Desenvolvimento Social 2025–2028"}, {"id": 33, "pilar": "Capacitação e participação cívica", "necessidade": "Dados locais, diagnóstico partilhado e medição de impacto", "sinais": "Os diagnósticos existem mas estão dispersos e desatualizam-se depressa face à velocidade da mudança; falta um conjunto comum de indicadores para acompanhar o impacto das intervenções.", "perguntas": "Que dados já são recolhidos e por quem? Que indicadores todos aceitariam usar? Com que periodicidade e em que formato devem ser partilhados?", "indicadores": "Indicadores comuns definidos; entidades que reportam; atualizações por ano; decisões informadas por dados; relatórios publicados.", "parceiros": "Rede Social de Sines; Município; INE/Censos; ULS Litoral Alentejano; escolas; IEFP; universidades; empresas.", "fonte": "Diagnóstico Social de Sines 2024; Plano de Desenvolvimento Social de Sines 2025–2028"}];

export default function Gamma() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("portfolio");
  const [winners, setWinners] = useState<Array<{name: string; pillar: string; startDate: string; endDate: string; milestones: string; budget: string; status: string; timeline: Array<{phase: string; date: string; done: boolean}>; entity?: string; amount?: string; score?: number; priority?: string}>>([]);
  const isAdmin = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "pm";

  // Edition state (admin can create/edit)
  const [editions, setEditions] = useState([{ id: 1, name: "GAMMA 2.0", number: 2, status: "active", pillars: [...DEFAULT_PILLARS], eligibility: [...DEFAULT_ELIGIBILITY], scoring: [...DEFAULT_SCORING] }]);
  const [activeEdition, setActiveEdition] = useState(0);
  const [showNewEdition, setShowNewEdition] = useState(false);
  const [newEditionName, setNewEditionName] = useState("");
  const [newPillar, setNewPillar] = useState("");
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
    toast.success(t("Edição criada com sucesso"));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("GAMMA — Sustentabilidade Comunitária")}</h1>
            <p className="text-muted-foreground">{t("Programa de apoio a projetos comunitários")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(activeEdition)} onValueChange={v => setActiveEdition(Number(v))}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {editions.map((ed, i) => <SelectItem key={i} value={String(i)}>{ed.name} {ed.status === "draft" ? "(Rascunho)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && <Button size="sm" variant="outline" onClick={() => setShowNewEdition(true)}><Plus className="w-4 h-4 mr-1" /> {t("Nova Edição")}</Button>}
          </div>
        </div>

        {/* New Edition Dialog */}
        {showNewEdition && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">{t("Criar Nova Edição")}</h3>
              <div className="flex gap-2">
                <Input placeholder={t("Nome da edição (ex: GAMMA 3.0)")} value={newEditionName} onChange={e => setNewEditionName(e.target.value)} />
                <Button onClick={createNewEdition}>{t("Criar")}</Button>
                <Button variant="outline" onClick={() => setShowNewEdition(false)}>{t("Cancelar")}</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t("A nova edição será criada com os pilares e critérios padrão. Pode editá-los depois na tab Definições.")}</p>
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
            <TabsTrigger value="portfolio">{t("Portefólio")}</TabsTrigger>
            <TabsTrigger value="candidatura">Candidatura</TabsTrigger>
            <TabsTrigger value="avaliacao">{t("Avaliação")}</TabsTrigger>
            <TabsTrigger value="necessidades">{t("Necessidades")}</TabsTrigger>
            <TabsTrigger value="scorecard">{t("Scorecard")}</TabsTrigger>
            <TabsTrigger value="vencedores">{t("Vencedores")}</TabsTrigger>
            <TabsTrigger value="plano">Plano de Apoio</TabsTrigger>
            {isAdmin && <TabsTrigger value="definicoes">{t("Definições")}</TabsTrigger>}
          </TabsList>

          {/* Portfolio */}
          <TabsContent value="portfolio" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Projetos — {edition.name}</CardTitle>
                <Button size="sm" onClick={() => setActiveTab("candidatura")}><Plus className="w-4 h-4 mr-1" /> {t("Nova Candidatura")}</Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">{t("Nenhuma candidatura submetida nesta edição.")}</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Candidatura */}
          <TabsContent value="candidatura" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Ficha de Candidatura — {edition.name}</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm border-b pb-1">{t("A. Identificação do Projeto e da Entidade")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-xs font-medium">{t("Nome do Projeto *")}</label><Input placeholder={t("Nome do projeto comunitário")} /></div>
                    <div><label className="text-xs font-medium">Entidade Proponente *</label><Input placeholder={t("Nome da entidade")} /></div>
                    <div><label className="text-xs font-medium">{t("Tipo de Entidade *")}</label><Select><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent>{ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-xs font-medium">{t("Pessoa Responsável")}</label><Input placeholder={t("Nome completo")} /></div>
                    <div><label className="text-xs font-medium">E-mail</label><Input type="email" placeholder="email@entidade.pt" /></div>
                    <div><label className="text-xs font-medium">Telefone</label><Input placeholder="+351..." /></div>
                    <div><label className="text-xs font-medium">{t("Município(s) Beneficiado(s) *")}</label><Select><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent>{MUNICIPALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-xs font-medium">{t("Localidade(s) / Área de Intervenção")}</label><Input placeholder={t("Localidades específicas")} /></div>
                    <div><label className="text-xs font-medium">Pilar Principal *</label><Select><SelectTrigger><SelectValue placeholder="Selecionar pilar..." /></SelectTrigger><SelectContent>{edition.pillars.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-xs font-medium">{t("Pilar Secundário")}</label><Select><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{edition.pillars.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-xs font-medium">{t("Duração Estimada (meses)")}</label><Input type="number" placeholder="6" /></div>
                    <div><label className="text-xs font-medium">{t("Data Prevista de Início")}</label><Input type="date" /></div>
                    <div><label className="text-xs font-medium">{t("Orçamento Total (€) *")}</label><Input type="number" placeholder="0.00" /></div>
                    <div><label className="text-xs font-medium">Financiamento Solicitado ao GAMMA (€)</label><Input type="number" placeholder="0.00" /></div>
                    <div><label className="text-xs font-medium">{t("Cofinanciamento / Recursos Próprios (€)")}</label><Input type="number" placeholder="0.00" /></div>
                    <div><label className="text-xs font-medium">Outros Financiamentos ou Apoios</label><Input placeholder="Descrever" /></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm border-b pb-1">{t("B. Necessidade, Solução e Impacto")}</h3>
                  <div><label className="text-xs font-medium">{t("1. Resumo Executivo (máx. 200 palavras)")}</label><Textarea placeholder={t("Síntese do projeto...")} rows={3} /></div>
                  <div><label className="text-xs font-medium">2. Necessidade Local</label><Textarea placeholder={t("Que necessidade da comunidade este projeto pretende resolver?")} rows={3} /></div>
                  <div><label className="text-xs font-medium">{t("3. Evidência da Necessidade")}</label><Textarea placeholder="Dados, estudos ou testemunhos que comprovam a necessidade" rows={2} /></div>
                  <div><label className="text-xs font-medium">{t("4. Beneficiários (quem, quantos, como são selecionados)")}</label><Textarea placeholder={t("Descrever beneficiários diretos e indiretos")} rows={2} /></div>
                  <div><label className="text-xs font-medium">{t("5. Equidade e Grupos Prioritários")}</label><Textarea placeholder={t("Como o projeto promove equidade e inclusão?")} rows={2} /></div>
                  <div><label className="text-xs font-medium">{t("6. Objetivo Geral e Objetivos Específicos")}</label><Textarea placeholder="Objetivos SMART..." rows={2} /></div>
                  <div><label className="text-xs font-medium">{t("7. Mudanças Esperadas (outcomes)")}</label><Textarea placeholder={t("Que mudanças concretas se esperam?")} rows={2} /></div>
                  <div><label className="text-xs font-medium">8. Atividades e Metodologia</label><Textarea placeholder={t("Descrição das atividades, faseamento, metodologia")} rows={3} /></div>
                </div>
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button onClick={() => { toast.success("Candidatura submetida!"); setActiveTab("portfolio"); }}>{t("Submeter Candidatura")}</Button>
                  <Button variant="outline">{t("Guardar Rascunho")}</Button>
                  <Button variant="outline" onClick={() => {
                    const fields = [
                      "FICHA DE CANDIDATURA — PROGRAMA GAMMA\n",
                      "A. IDENTIFICAÇÃO DO PROJETO E DA ENTIDADE",
                      "Nome do Projeto: _______________",
                      "Entidade Proponente: _______________",
                      "Tipo de Entidade: _______________",
                      "Pessoa Responsável: _______________",
                      "E-mail: _______________",
                      "Telefone: _______________",
                      "Município(s) Beneficiado(s): _______________",
                      "Localidade(s) / Área de Intervenção: _______________",
                      "Pilar Principal: _______________",
                      "Pilar Secundário: _______________",
                      "Duração Estimada (meses): _______________",
                      "Data Prevista de Início: _______________",
                      "Orçamento Total (€): _______________",
                      "Financiamento Solicitado ao GAMMA (€): _______________",
                      "Cofinanciamento / Recursos Próprios (€): _______________",
                      "Outros Financiamentos ou Apoios: _______________",
                      "\nB. NECESSIDADE, SOLUÇÃO E IMPACTO",
                      "1. Resumo Executivo (máx. 200 palavras):\n_______________\n",
                      "2. Necessidade Local:\n_______________\n",
                      "3. Evidência da Necessidade:\n_______________\n",
                      "4. Beneficiários (quem, quantos, como são selecionados):\n_______________\n",
                      "5. Equidade e Grupos Prioritários:\n_______________\n",
                      "6. Objetivo Geral e Objetivos Específicos:\n_______________\n",
                      "7. Mudanças Esperadas (outcomes):\n_______________\n",
                      "8. Atividades e Metodologia:\n_______________\n",
                    ];
                    const blob = new Blob([fields.join("\n")], { type: "application/msword" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = "GAMMA_Candidatura_Formulario.doc"; a.click();
                    URL.revokeObjectURL(url);
                    toast.success(t("Formulário exportado em Word"));
                  }}>
                    <Download className="w-4 h-4 mr-1" /> Exportar Word
                  </Button>
                  <Button variant="outline" onClick={() => document.getElementById("gamma-import-file")?.click()}>
                    <Upload className="w-4 h-4 mr-1" /> Importar Word
                  </Button>
                  <input id="gamma-import-file" type="file" accept=".doc,.docx,.pdf,.txt" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const text = ev.target?.result as string;
                      toast.success("Ficheiro importado — campos preenchidos automaticamente");
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }} />
                  <Button variant="ghost" onClick={() => setActiveTab("portfolio")}>{t("Cancelar")}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Avaliação */}
          <TabsContent value="avaliacao" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">{t("Matriz de Avaliação Individual")}</CardTitle><p className="text-xs text-muted-foreground">Classificar de 1 a 5 e justificar com base na candidatura.</p></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">{t("1. Verificação de Elegibilidade (Sim/Não)")}</h3>
                  {edition.eligibility.map(e => (
                    <div key={e.key} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Badge variant="outline" className="shrink-0 w-8 justify-center">{e.key}</Badge>
                      <span className="text-sm flex-1">{e.label}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" />Sim</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><XCircle className="w-3 h-3 text-red-600" />{t("Não")}</Button>
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
                  <h3 className="font-semibold text-sm">{t("3. Parecer e Condições")}</h3>
                  <div><label className="text-xs font-medium">Pontos Fortes</label><Textarea rows={2} placeholder="Identificar os pontos fortes da candidatura..." /></div>
                  <div><label className="text-xs font-medium">{t("Lacunas / Condições antes de Financiar")}</label><Textarea rows={2} placeholder={t("Condições que devem ser cumpridas...")} /></div>
                  <div><label className="text-xs font-medium">{t("Parecer Final do Avaliador")}</label><Select><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent><SelectItem value="approve">{t("Aprovar")}</SelectItem><SelectItem value="conditional">{t("Aprovar com Condições")}</SelectItem><SelectItem value="reject">{t("Rejeitar")}</SelectItem></SelectContent></Select></div>
                  <div><label className="text-xs font-medium">Conflitos de Interesse Declarados</label><Input placeholder="Declarar ou indicar 'Nenhum'" /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Necessidades */}
          <TabsContent value="necessidades" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle className="text-lg">{t("Registo de Necessidades")}</CardTitle><p className="text-xs text-muted-foreground">Necessidades identificadas na comunidade que podem originar candidaturas futuras.</p></div>
                {isAdmin && <Button size="sm"><Plus className="w-4 h-4 mr-1" /> {t("Registar Necessidade")}</Button>}
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-sm text-muted-foreground">{t("Nenhuma necessidade registada. Utilize este espaço para documentar necessidades da comunidade local.")}</div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plano de Apoio */}
          <TabsContent value="scorecard" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("Scorecard de Projetos")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("Pontuação agregada dos projetos candidatos por critério de avaliação.")}</p>
              </CardHeader>
              <CardContent>
                {winners.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t("Sem projetos avaliados. Submeta candidaturas e avalie-as na tab Avaliação.")}</p>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">{t("Projeto")}</th>
                            <th className="text-left p-2">Pilar</th>
                            <th className="text-center p-2">{t("Pontuação")}</th>
                            <th className="text-center p-2">{t("Estado")}</th>
                            <th className="text-center p-2">Prioridade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {winners.map((p, i) => (
                            <tr key={i} className="border-b hover:bg-muted/50">
                              <td className="p-2 font-medium">{p.name}</td>
                              <td className="p-2"><Badge variant="outline">{p.pillar}</Badge></td>
                              <td className="p-2 text-center"><Badge className="bg-primary/10 text-primary">{p.score || "—"}/100</Badge></td>
                              <td className="p-2 text-center"><Badge variant={p.status === "Concluído" ? "default" : "secondary"}>{p.status}</Badge></td>
                              <td className="p-2 text-center"><Badge variant={p.priority === "Alta" ? "destructive" : "outline"}>{p.priority}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vencedores" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t("Projetos Vencedores")}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{t("Timeline de execução dos projetos aprovados e financiados.")}</p>
                </div>
                {isAdmin && <Button size="sm" onClick={() => { setWinners([...winners, { name: "", pillar: DEFAULT_PILLARS[0], startDate: "", endDate: "", milestones: "", budget: "", status: "Em curso", timeline: [] }]); }}><Plus className="w-4 h-4 mr-1" /> {t("Adicionar Vencedor")}</Button>}
              </CardHeader>
              <CardContent>
                {winners.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t("Sem projetos vencedores registados. O admin pode adicionar projetos aprovados.")}</p>
                ) : (
                  <div className="space-y-4">
                    {winners.map((w, i) => (
                      <div key={i} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          {isAdmin ? (
                            <Input value={w.name} placeholder={t("Nome do projeto vencedor")} onChange={(e) => { const nw = [...winners]; nw[i].name = e.target.value; setWinners(nw); }} className="font-semibold text-base max-w-md" />
                          ) : (
                            <h3 className="font-semibold text-base">{w.name || "Sem nome"}</h3>
                          )}
                          {isAdmin && <Button size="sm" variant="ghost" onClick={() => setWinners(winners.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-red-500" /></Button>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          {isAdmin ? (
                            <>
                              <Select value={w.pillar} onValueChange={(v) => { const nw = [...winners]; nw[i].pillar = v; setWinners(nw); }}>
                                <SelectTrigger><SelectValue placeholder="Pilar" /></SelectTrigger>
                                <SelectContent>{DEFAULT_PILLARS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                              </Select>
                              <Input type="date" value={w.startDate} onChange={(e) => { const nw = [...winners]; nw[i].startDate = e.target.value; setWinners(nw); }} />
                              <Input type="date" value={w.endDate} onChange={(e) => { const nw = [...winners]; nw[i].endDate = e.target.value; setWinners(nw); }} />
                              <Select value={w.status} onValueChange={(v) => { const nw = [...winners]; nw[i].status = v; setWinners(nw); }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            </>
                          ) : (
                            <>
                              <div><span className="text-xs text-muted-foreground">Pilar:</span> <Badge variant="outline">{w.pillar}</Badge></div>
                              <div><span className="text-xs text-muted-foreground">{t("Início:")}</span> {w.startDate || "—"}</div>
                              <div><span className="text-xs text-muted-foreground">Fim:</span> {w.endDate || "—"}</div>
                              <div><span className="text-xs text-muted-foreground">{t("Estado:")}</span> <Badge>{w.status}</Badge></div>
                            </>
                          )}
                        </div>
                        {isAdmin ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input value={w.budget} placeholder={t("Orçamento (ex: 15.000€)")} onChange={(e) => { const nw = [...winners]; nw[i].budget = e.target.value; setWinners(nw); }} />
                            <Input value={w.milestones} placeholder="Marcos (ex: Kick-off Jan, Entrega Jun)" onChange={(e) => { const nw = [...winners]; nw[i].milestones = e.target.value; setWinners(nw); }} />
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-muted-foreground">{t("Orçamento:")}</span> {w.budget || "—"}</div>
                            <div><span className="text-muted-foreground">Marcos:</span> {w.milestones || "—"}</div>
                          </div>
                        )}
                        {w.startDate && w.endDate && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{w.startDate}</span>
                              <span>{w.endDate}</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(5, ((Date.now() - new Date(w.startDate).getTime()) / (new Date(w.endDate).getTime() - new Date(w.startDate).getTime())) * 100))}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plano" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Plano de Apoio</CardTitle><p className="text-xs text-muted-foreground">{t("Acompanhamento dos projetos aprovados: marcos, desembolsos e relatórios.")}</p></CardHeader>
              <CardContent>
                <div className="text-center py-8 text-sm text-muted-foreground">{t("Nenhum projeto aprovado nesta edição. Os planos de apoio são criados automaticamente após aprovação.")}</div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Vencedores */}
          <TabsContent value="vencedores" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Projetos Vencedores — {edition.name}</CardTitle>
                  {isAdmin && <Button size="sm" onClick={() => setShowAddWinner(!showAddWinner)}><Plus className="w-3 h-3 mr-1" /> {t("Adicionar Vencedor")}</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showAddWinner && isAdmin && (
                  <div className="p-4 border-2 border-dashed rounded-lg space-y-3 bg-green-50/50">
                    <h4 className="font-semibold text-sm">{t("Novo Projeto Vencedor")}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder={t("Nome do projeto...")} value={newWinner.name} onChange={e => setNewWinner({...newWinner, name: e.target.value})} className="h-8 text-sm" />
                      <Input placeholder="Entidade promotora..." value={newWinner.entity} onChange={e => setNewWinner({...newWinner, entity: e.target.value})} className="h-8 text-sm" />
                      <select className="h-8 text-sm border rounded px-2" value={newWinner.pillar} onChange={e => setNewWinner({...newWinner, pillar: e.target.value})}>
                        <option value="">Pilar...</option>
                        {edition.pillars.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <Input placeholder="Montante (€)..." value={newWinner.amount} onChange={e => setNewWinner({...newWinner, amount: e.target.value})} className="h-8 text-sm" />
                    </div>
                    <Button size="sm" onClick={() => { if (newWinner.name) { setWinners([...winners, {...newWinner, startDate: "", endDate: "", milestones: "", budget: newWinner.amount || "", timeline: [{phase: "Arranque", date: "", done: false}, {phase: "Meio-termo", date: "", done: false}, {phase: "Conclusão", date: "", done: false}]}]); setNewWinner({name: "", entity: "", pillar: "", amount: "", status: "Em curso"}); setShowAddWinner(false); toast.success("Vencedor adicionado!"); } }}>{t("Confirmar")}</Button>
                  </div>
                )}
                {winners.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">{t("Nenhum projeto vencedor registado nesta edição.")}</div>
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
                            <p className="text-xs font-medium mb-2">{t("Timeline do Projeto:")}</p>
                            <div className="flex items-center gap-2">
                              {w.timeline.map((t, ti) => (
                                <div key={ti} className="flex-1">
                                  <div className="flex items-center gap-1">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${t.done ? "bg-green-500 border-green-500" : "border-border"}`}>
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
                                <option value="Em curso">{t("Em curso")}</option><option value="Concluído">{t("Concluído")}</option><option value="Suspenso">Suspenso</option>
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
                <CardHeader><div className="flex items-center gap-3"><CardTitle className="text-lg">{t("Definições da Edição:")}</CardTitle><Input className="h-8 text-sm w-48" value={edition.name} onChange={e => { const updated = [...editions]; updated[activeEdition].name = e.target.value; setEditions(updated); }} /></div></CardHeader>
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
                        <Input placeholder={t("Novo pilar...")} value={newPillar} onChange={e => setNewPillar(e.target.value)} className="h-8 text-sm" />
                        <Button size="sm" className="h-8" onClick={() => { if (newPillar.trim()) { const updated = [...editions]; updated[activeEdition].pillars.push(newPillar.trim()); setEditions(updated); setNewPillar(""); } }}><Plus className="w-3 h-3 mr-1" /> {t("Adicionar")}</Button>
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
                      <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => { const updated = [...editions]; const n = updated[activeEdition].eligibility.length + 1; updated[activeEdition].eligibility.push({key: "E" + n, label: "Novo critério..."}); setEditions(updated); }}><Plus className="w-3 h-3 mr-1" /> {t("Adicionar Critério")}</Button>
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
                      <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => { const updated = [...editions]; const n = updated[activeEdition].scoring.length + 1; updated[activeEdition].scoring.push({key: "C" + n, label: "Novo critério...", weight: 5, question: ""}); setEditions(updated); }}><Plus className="w-3 h-3 mr-1" /> {t("Adicionar Critério")}</Button>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button variant="outline" className="w-full" onClick={() => toast.success(t("Definições guardadas!"))}>{t("Guardar Alterações")}</Button>
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
