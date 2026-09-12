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
