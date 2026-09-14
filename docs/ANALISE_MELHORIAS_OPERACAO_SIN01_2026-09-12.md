# Análise de Melhorias e Operação — SIN01/NEST

## Evidência analisada

O documento de melhorias e o relatório operacional diário de 11-09-2026 foram analisados como fontes de requisitos. O ficheiro operacional contém oito folhas, incluindo um resumo diário, detalhe do circuito de água do mar, dados de chillers, temperatura e humidade, uma tabela tratada e dados brutos de operação. A tabela tratada possui granularidade de 15 minutos e contém leituras de energia do site e edifícios, energia TI, sistema de água do mar, caudais, temperaturas, setpoints, estado de free cooling e variáveis ambientais.

> Os valores de operação reais devem manter-se separados de cenários e estimativas. Qualquer indicador calculado passa a identificar a origem, período e estado de qualidade dos dados.

## Melhorias identificadas e prioridade

| Prioridade | Área | Melhoria a implementar | Salvaguarda |
|---|---|---|---|
| 1 | Operação SIN01 | Renomear a experiência KPI para Operação no contexto do SIN01 e importar relatórios operacionais com uma estrutura validada. | Não misturar métricas de obra com leitura operacional do edifício. |
| 1 | Dashboard | Restaurar filtros por hora, dia, semana, mês, ano e projeto; criar cartões dinâmicos e comparações operacionais. | Agregação no servidor e limites de consulta para manter desempenho. |
| 1 | Qualidade de dados | Bloquear o reporte de WUE quando o cálculo for impossível ou negativo, e assinalar dados térmicos incompletos. | Nunca publicar um indicador calculado sem denominador ou balanço válido. |
| 1 | Faturas | Importar faturas de eletricidade, água, HVO e gasóleo, com origem, fornecedor, período, quantidade, custo e reconciliação com medição. | Validação de ficheiros, autorização e audit trail. |
| 1 | Resíduos | Exportar um Waste Map por LER e mês, filtrável por empresa; permitir remoção de eGAR pelo autor até 48 horas e pelo Administrador sem prazo. | Janela temporal no servidor e auditoria obrigatória. |
| 1 | Planos e Fases | Repor os planos de monitorização, prazos e alertas; permitir PDF de uma fase específica. | Manter âmbito por projeto e controlos existentes. |
| 2 | Desempenho operacional | Calcular PUE, pPUE, WUE de água doce, CUE, carga TI, energia ESW, COP de bombagem, carga térmica, caudal, temperaturas e abordagem do permutador. | Mostrar qualidade e cobertura de dados em cada visual. |
| 2 | Dashboard de mar | Criar bloco SIN01 para água do mar: captação, retorno, delta-T, eficiência de bombagem, caudal versus licença, descarga e monitorização. | Limites de licença e valores de referência configuráveis, nunca inventados. |
| 2 | Correlações | Criar vistas PUE versus temperatura do mar/carga TI, WUE versus ciclos, COP versus caudal e PUE-WUE por modo de arrefecimento. | Só disponibilizar quando houver número suficiente de leituras válidas. |
| 2 | Exportação | Exportar vistas por período, métrica, empresa e âmbito para Excel e PDF, com estrutura utilizável por Power BI. | Seleção e autorização no servidor. |
| 3 | Simulações | Criar cenários explícitos para comparação de misturas de arrefecimento, manutenção, água, energia, custo e carbono. | Identificar como estimativa, manter pressupostos versionados e nunca os agregar ao dado real. |

## Regras de qualidade descobertas no exemplo diário

O relatório diário contém uma célula WUE negativa, pelo que a operação deverá tratar este resultado como inválido, não como desempenho real. O documento também assinala que a carga térmica calculada para o mar apenas explica parte da carga TI e que campos de free cooling estão vazios. A primeira versão da operação irá expor estes sinais de qualidade e não produzir conclusões externas até que a origem de dados esteja completa.

## Dados já disponíveis no ficheiro

O resumo diário disponibiliza energia total do site e por edifício, energia TI e não-TI, ESW, PUE e consumos diários. As folhas de água do mar disponibilizam temperatura de captação e retorno, caudal, carga térmica e temperaturas de PCW. As folhas de dados tratados e brutos incluem temperatura exterior, vento, água industrial e potável, estados de free cooling, energia e caudal por equipamentos, leituras de salas, setpoints e outros sinais de BMS. Estes campos tornam viável uma primeira implementação de importação e dashboards sem esperar por integração direta ao BMS.

## Validação de interface em curso

No SIN01 — NEST, a navegação passou a apresentar **Operação** e **Planos** no projeto individual. A página de Operação foi aberta no perfil administrativo e mostrou os separadores de desempenho, água do mar, faturas e reconciliação, cenários e importações. A abertura direta de `/operacao` foi também repetida: a página preserva agora a rota enquanto o projeto ativo é restaurado, sem redirecionamento incorreto para Boas-vindas.

O relatório `DailyOperationalReport_11-09-2026.xlsx` foi importado pelo fluxo autenticado. A importação reconhece resultados de fórmulas Excel e associa métricas de água do mar pelos respetivos rótulos, evitando dependência da posição de uma coluna. Foram verificados, entre outros, PUE de 1,2131, carga TI média de 12 019,11 kW, caudal de captação de 111,52 L/s e COP do circuito de mar de 22,69. A WUE negativa existente na origem foi mantida no histórico com estado **inválido**, mas excluída de indicadores e exportações de decisão.

Também foram validados na interface os comandos **Modelo de faturas** e **Importar faturas**. O modelo Excel contém uma linha por fatura e as colunas Tipo, Fornecedor, N.º da fatura, Início, Fim, Quantidade, Unidade, Custo total (EUR) e Notas. Aceita eletricidade, água potável, água industrial, HVO, gasóleo e outros; a importação é validada no servidor, tem limite de dimensão, verificação de segurança, armazenamento privado do ficheiro de origem e evita a repetição de uma fatura idêntica.

## Validação consolidada

Foram concluídas a compilação TypeScript, a regressão automatizada, a construção de produção, a auditoria de dependências e a verificação de diferenças. A regressão inclui testes específicos para leitura de fórmulas Excel, mapeamento de água do mar por rótulo, exclusão de WUE negativa, cálculo independente de cenários e importação estruturada de faturas. Não foram mantidos modelos de validação na pasta de transferências.

O dashboard validado inclui filtros de início/fim, agrupamento por hora, dia, semana, mês e ano, e seleção de métrica para a exportação. Além dos indicadores de desempenho, mostra a cobertura de dados válida — no relatório carregado, 498 das 499 leituras são válidas —, o custo de faturas quando existir no período e o estado explícito **Aguardando fator de emissão configurado pela Administração** para carbono. Assim, o sistema não converte energia em carbono sem um fator aprovado.

A exportação operacional foi gerada e inspeccionada no intervalo 2026-09-01 a 2026-09-12. A folha de indicadores identifica o projeto SIN01, o período, a seleção **Todas as métricas válidas**, o campo de custo faturado, a cobertura válida e o estado de carbono pendente. O ficheiro transitório foi removido após a inspeção.

O registo manual de fatura foi repetido no formulário da interface. Com o tipo apresentado como **Eletricidade**, foram gravados 100 kWh e 123,45 EUR; a aplicação confirmou a submissão, mostrou a linha na reconciliação e refletiu o custo no cartão operacional. A fatura QA, identificada como temporária e sem dados pessoais, foi eliminada transaccionalmente após a prova. A regressão de interface submete o mesmo formulário e confirma que o payload enviado usa `electricidade`, o código validado no servidor.

## Fecho técnico desta evolução

A verificação final voltou a concluir a compilação TypeScript, a regressão automatizada, a construção de produção, a auditoria de dependências e a verificação de diferenças. Permanecem deliberadamente fora de cálculo real apenas os fatores de emissão e limites de licença que exigem parâmetros aprovados pela Administração, assim como correlações que dependem de mais histórico operacional válido. Estes limites estão assinalados na interface para impedir que previsões ou suposições sejam apresentadas como valores medidos.

## Configuração ambiental aprovada

A Administração do SIN01 inclui agora a aba **Operação**, destinada a guardar fatores de emissão de eletricidade e água, PUE máximo, limites de temperatura de descarga, caudais de captação e ΔT da água do mar. A configuração começa vazia e só é persistida por administrador, com registo de auditoria. Sem fatores ou limites aprovados, o dashboard mostra explicitamente carbono, CUE e conformidade **em validação**; não cria conversões implícitas. Quando os parâmetros forem preenchidos, os cálculos e verificações são feitos no servidor e a exportação inclui carbono, CUE e o respetivo estado.

O relatório diário contém também séries de quinze minutos. A extração passou a importar PUE calculado, carga TI, potência do site, temperatura de captação e caudal nessa granularidade, permitindo filtro horário e correlações PUE–temperatura/PUE–carga. As leituras do primeiro carregamento anterior à melhoria permanecem agregadas; o mesmo relatório será reimportado pelo fluxo normal para materializar estas novas séries sem duplicar métricas já existentes.

Durante a primeira reimportação foi identificada uma diferença de unidade na coluna `Site` do organizador operacional: a origem usa MW, enquanto a carga TI é fornecida em kW. A conversão explícita MW → kW foi aplicada antes do cálculo de PUE de quinze minutos e coberta por regressão; o relatório será reimportado uma única vez após a correção para substituir os pontos instantâneos com a unidade correta.

A persistência da primeira série foi confirmada por consulta: existem 96 pontos de quinze minutos para carga TI, PUE, temperatura de captação e caudal. Antes da conversão, a potência do site aparecia entre 13,96 e 17,66, confirmando que os MW não tinham sido convertidos para kW e justificando a substituição controlada do mesmo relatório.

A escrita do relatório é idempotente pela chave de projeto, métrica, instante, granularidade e origem. Assim, a reimportação posterior à correção substitui os 96 pontos existentes, mantendo os dados diários e o histórico de importação sem criar uma série paralela.

A reimportação final do relatório de 11 de setembro concluiu com **787 leituras importadas**. A vista de desempenho passou a apresentar as duas correlações PUE–temperatura de captação e PUE–carga TI numa escala de PUE coerente, em vez da escala milésima observada antes da conversão. A confirmação numérica da série persistida será feita antes do fecho da validação.

A confirmação de persistência mostrou PUE entre **1,1835** e **1,4265**, potência do site entre **13 962,88** e **17 655,01 kW** e carga TI entre **11 689,14** e **12 418,46 kW**. A interface passou também a aceitar e aplicar o agrupamento **Hora**, apresentando potência média de site e TI por hora sem reutilizar ou relabelar energia diária.

## Resíduos — validação QA controlada

Como não existiam e-GAR no SIN01 para a validação, foi registada pela interface uma e-GAR QA temporária, sem dados pessoais, com LER 150101, quantidade 1,250 t e destino de reciclagem. O MIRR atualizou os totais, o gráfico mensal, a lista de registos e a seleção de entidade **SC** no Waste Map. A exportação e a eliminação dentro do período autorizado são verificadas antes da limpeza transaccional deste registo.

O ficheiro `Waste_Map_SIN01_2026.xlsx` foi inspecionado: contém as folhas **Waste Map LER x Mês** e **Detalhe por Entidade**, com LER 150101, 1,250 t em setembro e o detalhe da entidade SC. Após a inspeção, o ficheiro foi removido e a e-GAR QA foi eliminada transaccionalmente, sem registos remanescentes na base de dados. A regra de 48 horas e a exclusão de IDs `QA-TEMP-` do arquivo externo são cobertas por regressão; esta última garante que validações futuras são integralmente reversíveis.

Uma segunda e-GAR QA foi criada depois da proteção de arquivo estar ativa. O registo do servidor confirmou explicitamente que o identificador `QA-TEMP-EGAR-ARQUIVO-20260912` foi mantido **fora do arquivo externo**. O registo e a respetiva auditoria foram removidos transaccionalmente de seguida; a consulta final devolveu zero registos QA remanescentes.

A validação foi reforçada com uma regressão de integração sobre o procedimento real `wasteEgars.create`: para IDs `QA-TEMP-*`, a criação é concluída sem chamar `archiveDocument`; para um ID operacional normal, a chamada de arquivo é efetuada. Assim, a proteção QA está coberta pelo mesmo fluxo que a interface utiliza, e não apenas por um helper isolado.

Como prova adicional reproduzível, o procedimento devolve `archiveStatus: excluido_qa` quando o ID é temporário e `archiveStatus: arquivado` para uma e-GAR operacional normal. A regressão de integração confirma ambos os resultados e verifica a invocação — ou ausência dela — do arquivo externo simulado.

## PDF de fase específica

O PDF da fase **Exploração** do SIN01 foi gerado pela interface, inspecionado e removido de seguida. A primeira inspeção revelou que o cabeçalho usava valores antigos da fase (0% / Não iniciado), apesar de as medidas apresentarem 1/15 concluída. O relatório foi corrigido para calcular a percentagem e o estado diretamente a partir das medidas atuais. A exportação repetida confirmou **Fase de Exploração · 7%**, **Estado: Em curso**, **Pontos concluídos: 1/15**, medidas EX-1 a EX-15, responsáveis, suporte e atualizações — sem incluir a fase Desativação.

## Encerramento da validação QA de resíduos

A confirmação nativa do browser para eliminar e-GAR foi substituída por um diálogo acessível da aplicação, que apresenta o identificador, o carácter irreversível da ação e a auditoria associada. A regressão verifica a ausência de `confirm()` e a atualização do Waste Map depois da eliminação; a compilação e os testes de resíduos passaram. A validação QA foi encerrada sem criar mais registos: a verificação final devolveu **0 e-GAR QA remanescentes**.

## Validações de contrato sem repetição QA

Para evitar novo ciclo de criação e remoção de dados transitórios, a reconciliação de faturas foi validada através do procedimento autorizado real: leituras dentro de ±5% devolvem **conforme** e a ausência de leituras válidas devolve **incompleta**, em vez de um falso desvio. O procedimento real de eliminação de e-GAR foi igualmente coberto para a entidade autora dentro das 48 horas, confirmando a remoção e a auditoria, e para a recusa após 48 horas. Estas regressões não criam dados persistentes nem recorrem ao browser.

As duas apresentações críticas também foram cobertas em ambiente de interface: a aba **Faturas e reconciliação** mostra explicitamente os estados **Conforme**, **Incompleta** e **Sem medição** devolvidos pelo contrato autorizado; o diálogo de e-GAR apresenta a confirmação acessível, recebe a decisão de eliminação e atualiza tanto a lista como a consulta do **Waste Map**. Estes testes usam dados simulados em memória e não criam registos QA persistentes.

## Demonstração configurável de carbono e limites

Na Administração do SIN01/NEST, o Administrador pode agora carregar valores ilustrativos, ajustá-los campo a campo e guardá-los em **Modo de demonstração**. A configuração fica auditada, mas os cálculos devolvem explicitamente o estado **Demonstração — não aprovado**: não geram alertas, desvio, conformidade ou conclusões de licença. O Administrador pode mudar para **Valores aprovados** apenas quando os fatores e limites forem formalmente confirmados; só nesse modo o dashboard ativa a avaliação real de carbono, CUE e limites. A exportação operacional também inclui o modo de parâmetros para impedir reutilização indevida de estimativas.

As correlações de PUE com carga TI e temperatura de água do mar já usam as leituras válidas de quinze minutos e consolidam automaticamente os períodos que forem importados. Com o relatório atualmente carregado, a análise é deliberadamente apresentada como uma leitura de um único dia; a capacidade de comparação entre dias, semanas ou meses cresce sem alteração de código à medida que novos relatórios válidos entram no histórico.

## Correlações WUE–ciclos e COP–caudal

O importador passou a reconhecer, com data e hora, os ciclos de arrefecimento (`Total_FC`) e o WUE da folha `AUX`, preservando a granularidade de quinze minutos e excluindo WUE negativo da origem. A interface apresenta as áreas de **WUE versus ciclos de arrefecimento** e **COP versus caudal de captação**, mas exige pelo menos dois pares válidos antes de desenhar uma curva. A validação visual do único relatório carregado confirmou a sinalização correta: o WUE de origem permanece inválido e existe apenas um par diário COP–caudal, pelo que o dashboard não sugere uma correlação que os dados ainda não suportam.

As regressões cobrem a extração de WUE e ciclos, o emparelhamento por instante e granularidade, e a passagem de dois pares válidos a cada gráfico. Em particular, o dataset COP–caudal é testado com dois dias válidos e uma terceira leitura inválida, que é corretamente excluída. Assim, a interface só recebe pontos de origem válida e com período coincidente.

## Cockpit premium NEST/SIN01

A Operação foi redesenhada como um cockpit de decisão. O topo reúne PUE, WUE, COP do circuito de água do mar, carga TI e custo do período com um **gémeo digital do edifício**: Rede → Hall TI → Circuito de água do mar. O painel executivo seguinte torna visíveis eficiência TI, uso de água, ΔT/caudal, carbono/CUE e confiança do dado, sem apresentar demonstrações como conformidade.

O gráfico **WUE versus PUE** passou a ocupar uma posição central. Quando existe água medida no mesmo dia da energia TI, desenha pares medidos; quando ainda não existe, apresenta apenas a projeção configurável de demonstração, identificada explicitamente. O registo diário de água é auditável e fica no estado contextual do gráfico. Custos, metas, previsão e estratégia-base são administrados no painel Operação do SIN01.

## Faturas, cenários e Administração premium

A área de faturas foi organizada como **Centro de reconciliação**, mostrando fontes no período, custo com evidência, comparações sem desvio e casos a analisar antes da tabela detalhada. O utilizador pode descarregar um modelo, importar lote ou abrir o registo individual sem confundir estes fluxos com indicadores medidos.

As Definições de Operação são agora um centro de controlo por módulos: Eficiência, Água do mar, Custos e previsão e Sistema-base. As duas modalidades — Demonstração ilustrativa e Valores aprovados — ficam visíveis no topo. A aba **Previsões e cenários** é apresentada como Laboratório de decisão e mantém PUE, WUE, manutenção, energia, água, carbono, custos e mistura de arrefecimento separados do histórico medido.

Na inspeção visual do SIN01, o cockpit apresentou o gémeo digital, os cartões executivos, o painel sustentável e a relação WUE versus PUE em modo de demonstração, com identificação explícita. A previsão automática mostra **0/3** tendências ativas porque existe apenas um dia válido no histórico, informando o mínimo de sete dias necessário e não fabricando uma tendência até que novos relatórios sejam importados.

## Infraestrutura visual estática NEST — implementação e validação

O pedido não recupera o antigo módulo de mapas nem introduz navegação cartográfica. Foi implementado em **Operação** um **dashboard estático de infraestrutura**, assente numa fotografia de drone fixa do NEST. Cada bolinha abre um cartão contextual com título, descrição, métricas recentes, tendência simples, documento e nota técnica; o conteúdo de cada cartão é configurável pela Administração e não altera telemetria nem cálculos medidos.

O PDF de referência foi reinterpretado para preservar a fotografia limpa, os pontos distribuídos pelas infraestruturas e os cartões associados. A zona antes vermelha passou a uma área violeta tracejada de **Planeamento futuro**, sem semântica de alerta, risco ou não conformidade. O cartão de expansão tem estado de planeamento e é explicitamente separado dos pontos operacionais.

Na validação autenticada em SIN01 — NEST, um Administrador abriu o novo atalho com ícone de roldana **Definições de Operação**, acedeu ao Centro de controlo, abriu a aba **Infraestrutura** e aplicou o modelo auditável de seis pontos: captação de água do mar, circuito de água do mar, subestação e rede, Hall TI, edifício NEST e expansão futura. Ao regressar ao cockpit, o indicador de modelo de referência deixou de ser apresentado, confirmando que os pontos persistidos passaram a alimentar a fotografia. As regressões verificam o ponto futuro, a sanitização de códigos de métricas e a abertura do cartão Hall TI sem criar dados transitórios.

## Previsões automáticas e cenários manuais

O servidor calcula tendências lineares de PUE, WUE e custo apenas após reunir pelo menos sete dias medidos da métrica correspondente. O horizonte vem das Definições de Operação, está limitado para impedir projeções excessivas e apresenta linhas medidas e previstas separadas. O custo requer, adicionalmente, um preço de eletricidade configurado; em modo ilustrativo, esse preço continua identificado como demonstração. A interface apresenta um estado vazio explícito quando ainda não existe histórico suficiente e mantém o **Laboratório de decisão** separado para cenários manuais auditáveis.
