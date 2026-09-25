# Implementação STAND — interface, tradução e Operação SIN01

**Data:** 25 de setembro de 2026  
**Âmbito:** Renovação visual STAND, PT/EN, galeria de evidências, RDCD e extensão controlada do cockpit de Operação SIN01/NEST.

## Resultado entregue

### 1. Linguagem visual STAND

- Sistema de superfícies corporativas, tipografia, espaçamento, contraste, cartões de métrica, estados semânticos e microinterações consistentes.
- Navegação lateral organizada por contexto de trabalho: visão, conformidade, desempenho/monitorização e recursos.
- Entrada pública, boas-vindas, dashboard, formulário semanal, planos, RDCD, fases e cockpit operacional atualizados para uma hierarquia de decisão mais clara.
- Modo claro e escuro persistentes, com respeito por `prefers-reduced-motion`.

### 2. Português e inglês

- PT-PT mantém-se como idioma predefinido; inglês é uma preferência persistente no perfil.
- Criada ponte limitada a texto estático conhecido para páginas históricas.
- Criado um dicionário auditado de UI e verificação automática que impede novos textos estáticos portugueses de ficarem sem equivalência em inglês.
- A tradução não atua sobre dados submetidos, evidências, nomes de empresas/pessoas, conteúdo regulamentar de origem ou registos de auditoria.

### 3. Fotos e evidências

- Galeria de evidências de fases com filtro, ampliação, categoria editável e visualização por medida.
- A categoria está persistida no esquema e protegida pelas permissões existentes de projeto e módulo.
- As imagens e anexos continuam privados; a entrega requer autorização da aplicação.

### 4. RDCD e DCAPE

- RDCD passou a usar um fluxo de emissão mais legível, com cabeçalho, etapas e ficha técnica de controlo de emissão.
- O relatório continua a ser emitido por projeto, com dados aprovados e rastreáveis.
- O SIN01 mantém somente as fases de **Exploração** e **Desativação** no catálogo operacional, sem misturar fases de construção.
- O isolamento do catálogo DCAPE por projeto é preservado.

### 5. Operação SIN01 / NEST

- O cockpit existente de PUE, WUE, carga TI, água do mar, faturas, reconciliação, cenários e infraestrutura foi preservado.
- Foi adicionada a aba **Sustentabilidade**, sem alterar leituras BMS, faturas, fórmulas ou dados históricos.
- Esta aba permite, a perfis autorizados:
  - registar inventário físico de HVO, gasóleo e CO₂ absoluto por data;
  - manter inventário de produtos químicos, quantidade, unidade, limiar interno, localização e nota;
  - identificar valores acima do limiar configurado;
  - consultar um aviso explícito de que a ligação BMS exige validação da equipa de infraestruturas e mapeamento aprovado.
- As escritas são auditadas e limitadas a Administração, Dono de Obra e PM no âmbito autorizado do SIN01.

## Migração aplicada

`drizzle/0058_fancy_norman_osborn.sql`

Cria, sem eliminar nem alterar dados existentes:

- `operation_sustainability_snapshots`
- `operation_chemical_inventory`

Inclui índices por projeto/data e projeto/nome para consulta eficiente.

## Validação realizada

- `npx tsc --noEmit` — aprovado.
- Auditoria de cobertura PT/EN — aprovada; **995** textos estáticos identificados, **979** mapeados e uma exclusão regulamentar intencional.
- `npx vitest run` — **61 ficheiros / 541 testes aprovados**.
- `NODE_OPTIONS=--max-old-space-size=2048 npx vite build` — aprovado.
- `pnpm audit --prod` — sem vulnerabilidades conhecidas.
- `git diff --check` — aprovado.
- Revisão visual manual em PT e EN nas páginas de boas-vindas, dashboard, operação, fases e RDCD.

## Limitações conhecidas e decisão de produto

- O build assinala bundles JavaScript grandes devido a bibliotecas de Word e Excel. É um aviso de otimização, não uma falha; a aplicação já usa imports dinâmicos em alguns fluxos. Uma futura fase pode criar separação adicional de chunks, desde que seja validada cuidadosamente para não regressar os problemas anteriores de carregamento.
- Não foi ativada uma ligação BMS automática. A plataforma está preparada para mapeamento auditável de cabeçalhos, mas uma ligação real requer aprovação, credenciais e desenho técnico da infraestrutura Start Campus.
- Os dados de sustentabilidade registados nesta entrega são inventário operacional declarado; não substituem métricas calculadas nem dados medidos BMS.
