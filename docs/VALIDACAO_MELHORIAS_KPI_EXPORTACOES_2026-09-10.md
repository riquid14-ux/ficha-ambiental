# Validação fim-a-fim — KPI e relatórios por projeto

**Data:** 10 de setembro de 2026  
**Ambiente:** desenvolvimento HTTPS autenticado  
**Projeto validado:** SIN02

## Exportações KPI

Foi descarregado e inspeccionado o modelo de importação `Modelo_Importacao_KPI_SIN02_S1-S37_2026.xlsx`. O ficheiro contém instruções e as colunas **Ano**, **Semana**, **ID da métrica**, **Métrica**, **Unidade** e **Valor**.

Foi também exportado um relatório de intervalo e confirmada a presença de título, projeto e período correcto. A validação de uma semana única foi repetida com início e fim em S13: o ficheiro `Relatorio_KPI_SIN02_S13-S13_2026.xlsx` identificou explicitamente **Projeto: SIN02 — SIN02** e **Período: S13 a S13 · 2026**. Os ficheiros transitórios foram removidos da pasta de transferências após a inspeção.

## Relatório PDF de Fases

Com o perfil PM autorizado e SIN02 seleccionado, o botão **Relatório PDF** da Timeline gerou `Fases_SIN02.pdf`. A verificação técnica confirmou um PDF válido de 12 páginas, produzido por PDFKit.

O texto extraído comprova o título **RELATÓRIO DE FASES**, o projeto **SIN02 — SIN02**, e, por ponto, o estado, responsável e suporte. Quando existe, o PDF inclui a última atualização com autor e data; por exemplo, a medida PC-17 apresenta a atualização registada.

A validação foi repetida depois de alinhar as chaves de fase do relatório com as da Timeline e de incluir as evidências auditáveis. No ficheiro final `Fases_SIN02 (3).pdf`, o texto extraído confirmou, na mesma medida PL-1, uma **Última atualização** e o bloco **Evidências do ponto (1)**, ambos com autor e data, sem URL de storage. Os registos QA transitórios foram removidos transaccionalmente; a verificação confirmou **0 atualizações QA** e **0 evidências QA** remanescentes.

## Relatório PDF de Planos

Após disponibilizar a página de Planos no menu de projeto individual para Admin, Dono de Obra, PM e RAA, foi gerado `Planos_SIN02 (1).pdf` com SIN02 selecionado. A verificação técnica confirmou um PDF válido de 2 páginas. O texto extraído comprova o título **RELATÓRIO DE PLANOS DE MONITORIZAÇÃO**, o projeto **SIN02 — SIN02**, estados, entrega em português, periodicidade, responsável, suporte, datas de reporting e uma **Última atualização** com texto, autor e data no plano P-01. A atualização QA transitória foi removida transaccionalmente e a verificação confirmou **0 atualizações QA remanescentes**.

## Fecho da validação

Todos os ficheiros PDF transitórios de Fases e Planos foram removidos da pasta de transferências após a inspeção. A versão permanece pendente apenas da validação técnica consolidada e do checkpoint de publicação.
