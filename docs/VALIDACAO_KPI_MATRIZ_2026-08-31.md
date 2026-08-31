# Validação de KPI e Matriz — 31 de agosto de 2026

## Âmbito e método

Foi validada uma sessão administrativa, em HTTPS, no projecto **SIN02**, sem gravar KPI nem alterar métricas através da interface. A verificação de dados usou consultas apenas de leitura, salvo duas submissões de QA explicitamente marcadas e removidas depois da observação visual da Matriz.

## Evidência KPI

- Os oito indicadores adicionados a partir de `Catalogo_KPIs_Ambientais.docx` existem **uma única vez**, estão activos e têm um evento `kpi_catalog_metric_added` por indicador.
- O formulário administrativo apresenta as categorias **Geradores** e **Qualidade do Ar e Ruído** em português.
- O formulário de submissão apresenta os quatro KPI de Geradores e os dois KPI de Qualidade do Ar e Ruído, com unidade, meta quando aplicável e contexto de projecto, empresa e semana.
- No grupo **Água**, `Água reutilizada` permanece no bloco operacional. O capítulo **Águas Afluentes** contém apenas `Águas Residuais`, `Águas residuais WCs Químicos Portáteis`, `Águas residuais WCs Químicos Contentores` e `Limpezas da Fossa`.

## Evidência Matriz

- A legenda da Matriz apresenta **Em Revisão** em azul e **Aprovada** em verde.
- Foram observadas células azuis de revisão e verdes de aprovação na grelha de SIN02; o contador apresentado é **Aprovadas**, não `Entregues`.
- A filtragem de empresas exclui `ee_partner` antes de construir a grelha de Fichas Semanais.

## Salvaguardas QA

As submissões temporárias usaram o marcador `QA_MATRIX_APPROVAL_20260831`, sem endereços de correio electrónico ou credenciais. Foram eliminadas por transacção; a consulta de confirmação devolveu `qa_remaining = 0` e uma recarga posterior da Matriz deixou de apresentar essas células temporárias.
