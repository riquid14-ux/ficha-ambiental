# Implementação STAND, PT/EN, modo escuro e DCAPE

## Objetivo

Esta entrega aplica as recomendações do guia STAND de forma compatível com a Plataforma de Gestão Ambiental. A intervenção abrange a identidade visual, preferências persistentes de modo claro/escuro e idioma, qualidade dos dashboards e a separação segura do catálogo regulatório por projeto.

## Tema, idioma e identidade

A aplicação passa a disponibilizar preferência persistente entre modo claro e escuro, usando a chave `stand_theme`, e idioma português europeu/inglês através da chave `app_lang`. Os controlos foram integrados na área de perfil do layout. O documento HTML foi atualizado para `pt-PT`, e as páginas de acesso, boas-vindas e dashboard refletem a marca **STAND — Onde a sustentabilidade ganha posição**.

As páginas Documentação, Administração de Documentação, pedidos EEP, página 404, Operação, Definições de Operação e Dashboard de Parceiros estão ligadas ao contexto de idioma. As denominações regulatórias e os relatórios formais continuam em português quando isso é necessário para submissão e rastreabilidade perante entidades portuguesas.

## Dashboard e experiência de decisão

O dashboard recebeu um resumo executivo acima dos quadros analíticos. O resumo apresenta o âmbito ativo, a taxa de cumprimento registada, as fichas em revisão e o estado de prazos, mantendo o filtro por projeto. O cabeçalho tem uma alternativa visual em gradiente quando a imagem configurada não está disponível, evitando uma área vazia e preservando uma apresentação consistente em ambos os temas.

O cockpit de **SIN01 — NEST** calcula agora o número de medidas diretamente a partir do catálogo isolado do projeto, em vez de apresentar uma contagem fixa. A visão mostra as **19 medidas de Exploração** e separa as medidas de Desativação, sem misturar obrigações de construção.

## Revisão profunda da interface

Foi criado um pequeno sistema de componentes STAND para cabeçalhos contextuais, indicadores executivos e estados semânticos. A barra lateral passou a agrupar a navegação por contexto de trabalho — Visão, Conformidade, Operação e Recursos — e as páginas utilizam superfícies, contraste, foco e espaçamento consistentes nos temas claro e escuro.

A revisão alcança o acesso, boas-vindas, dashboard, ficha semanal, KPI, MIRR, Planos, Calendário, Timeline, Administração e Biblioteca Documental. Estes módulos foram reorganizados com hierarquia editorial, ações prioritárias, métricas de decisão, cartões de estado e controlos acessíveis. As consultas tRPC, fluxos, permissões e dados não foram alterados por esta camada visual; a mudança é deliberadamente de apresentação e usabilidade.

Em ecrãs móveis, os cabeçalhos, ações e cartões passam a empilhar de forma legível sem depender de navegação horizontal. Os campos e ações mantêm áreas de toque adequadas e os metadados essenciais ficam acima de 12 px, evitando a aparência comprimida de uma interface genérica.

## DCAPE e isolamento por projeto

As tabelas `sections` e `measures` passam a ter `projectId`, com índices de apoio a consultas por projeto. A migração `0056_conscious_multiple_man.sql` é aditiva: não elimina registos, cria cópias independentes do catálogo de construção para os projetos aplicáveis e atualiza os consumidores do catálogo no servidor, formulário semanal, revisão, histórico, fases, timeline, dashboard, RDCD e exportações PDF.

O catálogo do **SIN01 — NEST** fica restrito a **Exploração** e **Desativação (Pós-Exploração)**. Foram preservadas e remapeadas, quando aplicável, as referências operacionais existentes de estado, atualização, evidência e resposta semanal para os novos identificadores isolados. A verificação de integridade confirmou zero medidas órfãs ou com secção de outro projeto.

## Validação executada

A validação integral passou com **529 testes automatizados em 57 ficheiros**, verificação TypeScript, build de produção, auditoria de dependências de produção e `git diff --check`. Também foram validados visualmente o dashboard em modo escuro, a persistência de tema e a comutação para inglês. A auditoria de dependências não reportou vulnerabilidades conhecidas.

> Os avisos de tamanho do bundle existentes durante o build são recomendações de otimização do Vite; não impedem a compilação nem a execução. Não foi introduzida regressão de funcionalidade por esta entrega.
