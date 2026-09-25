# Implementação inicial — Guia Técnico Fase 2

## Enquadramento

Esta entrega aplica o primeiro bloco seguro do guia técnico de 25 de setembro de 2026. O objetivo foi melhorar a experiência de evidências, reforçar a deteção de lacunas de tradução e corrigir duas inconsistências de navegação e de estrutura documental. Não altera quaisquer leituras, cálculos, cartões de infraestrutura ou fluxos existentes do **SIN01 — NEST**.

## Evidências fotográficas

A tabela `phase_evidence` recebeu o campo opcional `category` através da migração aditiva `0057_fair_tag.sql`. Fotografias históricas permanecem válidas porque o campo aceita `NULL`. A interface de Fases passou a apresentar miniaturas maiores numa grelha responsiva e permite abrir uma fotografia em ecrã ampliado. A navegação por teclado e pelos botões anterior/seguinte fica limitada aos itens disponíveis da mesma medida.

Quem adiciona uma fotografia pode agora indicar uma categoria livre, como “Estaleiro”, “Linha de água” ou “Acesso Norte”. A categoria é opcional e as categorias já utilizadas surgem como sugestões. O ficheiro continua a ser entregue pela rota protegida de armazenamento; o lightbox não introduz URL pública nem contorna a verificação de permissões.

Também foram reforçadas as garantias de âmbito. A criação de comentário ou ficheiro confirma que a medida pertence ao projeto autorizado. A eliminação carrega primeiro a evidência e valida o respetivo projeto e módulo Timeline. A RAA pode eliminar evidência no projeto onde tem autorização, alinhando a regra de servidor com o controlo que já era apresentado na interface.

## Tradução PT/EN

O contexto de idioma passou a avisar apenas em desenvolvimento quando uma chave de tradução não existe ou não contém o idioma ativo. Os avisos são deduplicados para manter a consola legível. Em produção, mantém-se o fallback atual para evitar bloquear uma operação por uma chave em falta.

Foi criado o comando `pnpm audit:i18n`, que percorre páginas e componentes com a API AST do TypeScript e apresenta literais JSX potencialmente em português fora de `t()`. Esta auditoria estabelece a base objetiva para a migração gradual de páginas. A tradução integral da interface, especialmente Operação, Administração, MIRR e RDCD, permanece um lote editorial próprio; documentos regulatórios e dados introduzidos pelo utilizador não são traduzidos automaticamente.

## Navegação e RDCD

O agrupamento lateral que continha Operação, KPI, Resíduos e MIRR passou a chamar-se **Desempenho e Monitorização Ambiental**. A rota e a designação do cockpit de Operação não foram alteradas.

O exportador RDCD recebeu o capítulo 9 — **Programa de Trabalhos** — entre as questões de períodos anteriores e as reclamações. O gerador atual mantém a mesma origem de dados e o mesmo modelo de emissão; a evolução para matriz colaborativa por departamento será entregue através de tabelas novas e separadas, para não interromper o processo atual.

## Validação

A migração foi aplicada depois de confirmar a existência de `referenceYear` e a ausência de `category` no ambiente. A validação integral incluiu TypeScript, build de produção, auditoria de dependências, verificação de integridade e 536 testes automatizados. Não foram detetadas vulnerabilidades conhecidas nas dependências de produção.

## Próximos blocos isolados

A continuação deve manter entregas separadas. O catálogo DCAPE corrigido será versionado apenas para **SIN02 — Data Center Sines 4.0**, preservando o catálogo de Exploração e Desativação do SIN01. O RDCD colaborativo exigirá um modelo novo de relatórios, matriz demonstrativa, contribuições e anexos, com autoria e separação explícita entre o resumo do proponente e o resultado da apreciação da APA. As extensões de sustentabilidade do SIN01 deverão ser aditivas, usando tabelas próprias para inventário de combustível, emissões absolutas e produtos químicos.

## Referências

[1]: /home/ubuntu/upload/GuiaTecnicoparaoManus-Traducao,Fotos,DCAPE,DesigneRDCD.docx "Guia Técnico para o Manus — Fase 2 de Implementação"
[2]: /home/ubuntu/ficha-ambiental/drizzle/0057_fair_tag.sql "Migração aditiva de categoria em evidências de fase"
[3]: /home/ubuntu/ficha-ambiental/scripts/audit-i18n-literals.mjs "Auditoria AST de literais de interface"
