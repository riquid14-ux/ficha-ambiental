# Rastreabilidade de dashboards — Ronda 3

**Data:** 28 de setembro de 2026  
**Âmbito:** Dashboard de projeto, Timeline/Fases DCAPE e cockpit resumido NEST/SIN01.

> Este documento descreve o que é efetivamente apresentado nesta ronda. Não converte dados demonstrativos em dados medidos nem atribui valores a blocos sem uma fonte identificada.

## Princípios aplicados

- As consultas passam pelos procedimentos tRPC protegidos existentes; a informação é limitada ao projeto ativo e às permissões já aplicadas no servidor.
- Os cartões de operação usam `operation.overview`, que separa leituras, qualidade, parâmetros, dados financeiros e o indicador `hasDemoData`.
- Quando `hasDemoData` é verdadeiro, o cockpit apresenta uma etiqueta explícita de **Dados demonstrativos**.
- A Timeline e os cartões de fases não somam linhas históricas duplicadas: em obras, as linhas `EX-1…EX-19` só são retidas para auditoria quando já existe a numeração canónica DCAPE `92…110`; no SIN01, onde essa numeração não existe, as 19 linhas `EX` são o catálogo operacional efetivo.
- Elementos documentais são obrigações para efeitos de progresso, mas continuam separados de medidas na apresentação.

## Matriz de rastreabilidade

| Bloco apresentado | Fonte autorizada | Fórmula/apresentação | Estado vazio / ação | Verificação desta ronda |
|---|---|---|---|---|
| Fases do projeto (Dashboard e Timeline) | `measures.list`, `phaseMeasures.getStatuses`, `shared/phases.ts` | `phaseLogicalSummary`: conclusão lógica por obrigação; progresso = obrigações concluídas / obrigações totais | Sem catálogo: mensagem de catálogo DCAPE indisponível | SIN02: 3 / 2 / 34 / 72 / 5 / 19 / 1; total lógico 136 |
| Detalhe por fase | Mesmas fontes; `PhaseMeasures` recebe a fase selecionada | Apenas itens cuja chave canónica pertence à fase; itens filhos são agrupados sob a obrigação principal | Sem itens: estado vazio por fase | Fase pré-licenciamento observada com PL-1, PL-2 e PL-3 apenas |
| Medidas operacionais SIN01 | `measures.list` do projeto SIN01 + classificação `EX-*` | Contagem lógica `exploracao` | Sem catálogo: zero não é apresentado como dado real; cartão liga a Operação | 19 medidas `EX-1…EX-19` confirmadas na base ativa |
| Desativação SIN01 | `measures.list` do projeto SIN01 | Obrigação canónica 111, com filhos 111.1…111.5 agrupados | Sem catálogo: estado vazio | 1 obrigação lógica confirmada |
| PUE | `operation.overview.latest.pue` | Última leitura válida; número formatado em `pt-PT`/`en-GB` | “Registe leituras na Operação” | 1,17 (dados demo identificados) |
| WUE | `operation.overview.latest.wue_calculated_daily` ou `wue_reportado` | Última leitura válida do período | “Registe água e energia TI” | 0,2 L/kWh TI (dados demo identificados) |
| CUE | `operation.overview.environmental.cueKgKwh` | Valor calculado pelo contrato operacional e parâmetros aprovados | “Defina fator de carbono em Operação” | 0,297 kg CO₂e/kWh TI (dados demo identificados) |
| Cobertura de dados | `operation.overview.quality.coveragePercent` | Percentagem devolvida pelo serviço de qualidade para o período consultado | “Sem período com leituras válidas” | 99% (dados demo identificados) |
| Próximo reporting | `calendarEvents.list` do projeto ativo | Primeiro evento pendente futuro ordenado por data | “Sem entrega agendada” | Fonte/owner/data mostrados sem metas inventadas |
| MIRR no SIN01 | `wasteEgars.list` do projeto/ano | Contagem de registos e estado vazio quando não existirem e-GARs | Ligação para MIRR | 0 registos na demonstração |

## Planos universais e transição entre fases

> Os 20 Planos/Projetos DCAPE são universais: não são replicados por cada projeto. Por isso, a página **Planos** apenas é apresentada na visão **Todos os Projetos** e uma URL direta aberta com um projeto ativo redireciona para uma página permitida. A consulta não é executada fora dessa visão.

| Bloco apresentado | Fonte autorizada | Fórmula/apresentação | Salvaguarda | Verificação desta ronda |
|---|---|---|---|---|
| Planos de monitorização | `monitoringPlans.list` | Uma lista global de 20 planos, com calendário, responsável, suporte, anexos, último update e histórico | Não cria 20 × N projetos nem carrega dados ao abrir um projeto individual | Navegação e URL direta verificadas com SIN02 ativo |
| Relatório de transição entre fases | `phaseMeasures.transitionReport`, protegido por projeto e módulo `timeline` | Para cada projeto com Timeline ativa: fase em fecho, próxima fase e apenas obrigações lógicas pendentes, com estado, responsável, suporte e último update | Exclui ACP, que não tem módulo Timeline/DCAPE; não exporta nem revela projetos fora do âmbito do utilizador | Word exportado e renderizado: 22 páginas, responsável/suporte e autor/data do último update confirmados |

As regressões de navegação de função foram atualizadas para garantir que **Planos** surge apenas em *Todos os Projetos* para Admin/DO, e não na navegação de um projeto individual para RAA, PM ou Admin.

### Ciclos RDCD conectados ao reporte APA

| Bloco apresentado | Fonte autorizada | Regra / resultado | Salvaguarda |
|---|---|---|---|
| Timeline anual RDCD/APA | Eventos RDCD e Relatório Anual DCAPE já existentes em `calendar_events` | Expansão por meses civis a partir da data original e da periodicidade; o seletor permite ver anos anteriores e futuros sem deslocar a recorrência | Não cria um evento de origem fictício nem substitui o evento RDCD existente |
| Ciclo consolidado | `apa_reporting_cycles` + `apa_reporting_cycle_plans` | Uma ocorrência RDCD recebe data de receção, até 40 planos e uma entrega APA calculada a três meses civis | Apenas Admin cria/edita; autor, criação e alteração ficam auditáveis |
| Evento APA no calendário | `calendar_events` com `sourceType = apa_reporting_cycle` | Um único prazo APA é sincronizado por ciclo, com tipo, data, estado e número de planos consolidados | Os prazos individuais dos planos incluídos ficam inativos para não duplicar a obrigação |
| Alertas 30/15/7 dias | `scheduled-reminders` + responsáveis/suportes dos planos do ciclo | Destinatários de cada plano consolidado são deduplicados antes do email; registo de envio permanece por evento/destinatário | O trabalho cron só envia quando a configuração de email estiver ativa; a interface não declara que um email foi enviado |

**Verificação realizada:** o evento RDCD semestral existente em 15-10-2026 apareceu na timeline; ao mudar para 2027, a mesma âncora revelou 15-04-2027 e 15-10-2027. Sem gravar dados de teste, a interface calculou corretamente 30-04-2027 → 30-07-2027.

## Operação NEST — extensão de decisão

> A fotografia aérea continua a ser a **vista de infraestrutura**. Não é apresentada como um gémeo digital. O gémeo operacional é uma camada calculada, explicável e separada, que usa apenas leituras, parâmetros e qualidade já autorizados.

| Vista/indicador | Fonte autorizada | Regra de cálculo e sinal | Salvaguarda |
|---|---|---|---|
| Gémeo operacional — energia e TI | Leituras de energia do site, energia/potência TI, PUE e `operation.settings` | Compara PUE/valores recebidos com limites configurados; apresenta `normal`, `atenção`, `desvio`, `referência` ou `dados em falta` | Em modo ilustrativo, qualquer sinal é **referência**, nunca alerta de conformidade |
| Gémeo operacional — água do mar | Caudal, temperatura de descarga, ΔT, COP e limites de captação/descarga | Avalia limites mínimo/máximo e reúne o último valor válido por sistema | Falta de leitura devolve lacuna, nunca estado saudável |
| Gémeo operacional — sustentabilidade | `environmental` de `operation.overview` (CUE, carbono, WUE) | Mostra CUE apenas se houver energia TI e fator; carbono elétrico fica explicitamente marcado conforme origem | Inventário físico, faturas e telemetria permanecem conceitos separados |
| Sustentabilidade operacional | Leituras, inventário de HVO/gasóleo/CO₂, inventário químico e fonte EED | Painel de intensidade, recursos e prontidão de reporte; série temporal só existe com pelo menos duas observações | Não substitui formulário EED nem deduz submissão regulatória |
| Roldana de operação | `operation.settings`, mapeamento de importação e auditoria existente | Expõe modo, metas, limites, fatores, preços, estratégia, horizonte e aliases de colunas BMS | Alterar parâmetros não reescreve leituras históricas; guardar passa pelo procedimento protegido e auditado |

### Regressões acrescentadas

- `server/operation-digital-twin.test.ts` valida estados de desvio de PUE/caudal, modo ilustrativo e lacunas sem classificação indevida.
- `server/operation-sustainability.test.ts` mantém as regras de inventário e separação entre dados físicos, faturação e telemetria.

## Distribuição DCAPE confirmada

| Fase | Obrigações lógicas SIN02 | Composição |
|---|---:|---|
| Previamente ao licenciamento | 3 | 3 elementos documentais |
| Em sede de licenciamento | 2 | 2 elementos documentais |
| Previamente ao início da construção | 34 | 18 elementos + 16 medidas |
| Construção | 72 | 2 elementos + 70 medidas |
| Final da construção | 5 | 5 medidas |
| Exploração | 19 | 19 medidas canónicas; `EX-1…EX-19` históricos não duplicam o total |
| Desativação | 1 | Obrigação principal 111; subitens agrupados |
| **Total** | **136** | Cada obrigação pertence a uma única fase |

## Evidência visual capturada durante a validação

Os caminhos seguintes são artefactos efémeros da sessão de validação, não são parte do produto nem substituem testes reproduzíveis:

| Ecrã | Estado observado |
|---|---|
| Dashboard SIN01, EN/claro | PUE, WUE, CUE e cobertura mostrados; badge de demonstração; 19 medidas operacionais |
| Dashboard SIN02, EN/claro | Fases 3/2/34/72/5/19/1 e cartões de dados reais do projeto |
| Timeline SIN02, EN/claro | Sete fases, cartões por fase e programas/planos separados |
| Fases SIN02, EN/claro | Pré-licenciamento com apenas PL-1, PL-2 e PL-3; descrições regulamentares em inglês |
| Operação SIN01, EN/escuro | Gémeo operacional com PUE/WUE/CUE/COP/cobertura, fotografia de infraestrutura preservada e separação entre referência/demonstração |
| Definições de Operação SIN01, EN/escuro | Fontes, fórmulas, limites e mapeamento BMS em superfícies sem fundos claros rígidos |

## Limites conhecidos desta ronda

- Esta ronda não certifica uma matriz completa de browser com todos os perfis, rotas, diálogos, exportações, emails e documentos gerados.
- Também não declara um relatório Playwright/axe “a zero”: esse conjunto de testes end-to-end ainda não está configurado/executado nesta sessão. A auditoria estática de literais e os testes unitários não o substituem.
- Persistem componentes históricos fora das superfícies revistas com cores fixas; não deve ser declarada cobertura integral de dark mode até existir uma auditoria visual sistemática das rotas prioritárias.
