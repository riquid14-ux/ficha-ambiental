# Fase 1 — Fotografias institucionais e cabeçalhos corporativos

**Data:** 28 de setembro de 2026  
**Âmbito:** identidade visual, gestão segura de fotografias e coerência dos cabeçalhos principais.

## Resultado entregue

A plataforma passa a aplicar fotografias institucionais Start Campus de forma coerente, com uma imagem por superfície e sem criar uma faixa repetida antes do conteúdo.

Os cabeçalhos agora são apresentados como uma única peça editorial: imagem, gradiente de legibilidade, contexto do projeto, título, descrição e ações da página.

## Páginas abrangidas

| Área | Página | Chave de imagem |
|---|---|---|
| Visão | Dashboard | `image_dashboard` |
| Conformidade | Calendário, Timeline, Ficha semanal, Planos, Fases, RDCD, Histórico, Matriz | chaves dedicadas por página |
| Recursos | KPI, MIRR, Biblioteca documental | chaves dedicadas por página |
| Operação | Cockpit NEST / SIN01 | `image_operacao` |
| Conta | Perfil e segurança | `image_perfil` |
| Certificações | Certificações SIN01 | `image_certificacoes` |

A página de boas-vindas mantém o vídeo institucional e a fotografia de contexto. Não houve remoção de vídeo ou de conteúdo multimédia existente.

## Gestão administrativa de imagens

A secção **Administração → Imagens institucionais** permite:

- rever a imagem atribuída a cada superfície;
- manter as fotografias oficiais como referência inicial;
- substituir uma imagem por carregamento seguro ou URL HTTPS;
- definir enquadramento e o modo de composição;
- eliminar uma atribuição, incluindo as definições de posição, modo e página associadas.

O carregamento é limitado a JPEG, PNG ou WebP até 5 MB, passa pelo sanitizador existente, fica auditado e requer perfil Administrativo ou Dono de Obra.

## Implementação técnica

- `client/src/lib/brand-images.ts` mantém um catálogo central de imagens e fallback por página.
- `BrandImageProvider` faz uma só leitura cacheada das definições por sessão de aplicação.
- `useBrandImage` resolve a imagem de cada página e mantém fallback institucional quando o componente é testado isoladamente.
- `StandPageHeader` suporta composição com imagem de fundo ou imagem lateral, com gradiente para acessibilidade de contraste.
- O mecanismo `next-themes` e o ficheiro legado `dark-mode.css` foram removidos; a aplicação utiliza apenas o `ThemeContext` institucional, incluindo as notificações.

## Proveniência

As fotografias foram selecionadas da biblioteca de marca Start Campus e publicadas no armazenamento web da aplicação. A relação de ficheiros e origem está em [`FONTES_IMAGENS_START_CAMPUS_2026-09-28.md`](FONTES_IMAGENS_START_CAMPUS_2026-09-28.md).

## Validação

- TypeScript: aprovado (`pnpm check`)
- Regressões: aprovado (`pnpm test`)
- Build de produção: aprovado (`pnpm build`)
- Auditoria de dependências de produção: sem vulnerabilidades conhecidas
- Integridade do diff: aprovada (`git diff --check`)
- Fotografias institucionais: 18 rotas verificadas com resposta HTTP 200 após redirecionamento controlado
- Revisão visual: Dashboard e Calendário confirmados com os novos cabeçalhos fotográficos; Boas-vindas confirmada com o vídeo institucional preservado.

## Limites desta fase

Esta fase não altera o esquema de dados de negócio, permissões funcionais, nem fluxos de submissão. As melhorias previstas para os módulos de operação, navegação, tabelas, RDCD e dados de demonstração ficam deliberadamente fora desta primeira entrega, para permitir validação visual antes de avançar.
