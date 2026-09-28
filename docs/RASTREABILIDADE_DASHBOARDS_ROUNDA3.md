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

## Limites conhecidos desta ronda

- Esta ronda não certifica uma matriz completa de browser com todos os perfis, rotas, diálogos, exportações, emails e documentos gerados.
- Também não declara um relatório Playwright/axe “a zero”: esse conjunto de testes end-to-end ainda não está configurado/executado nesta sessão. A auditoria estática de literais e os testes unitários não o substituem.
- Persistem componentes históricos fora das superfícies revistas com cores fixas; não deve ser declarada cobertura integral de dark mode até existir uma auditoria visual sistemática das rotas prioritárias.
