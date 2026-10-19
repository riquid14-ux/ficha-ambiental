# STAND — pacote de transferência para IT

**Finalidade:** este diretório organiza os recursos necessários para instalar a STAND na arquitetura aprovada da Start Campus: VIP/HAProxy/BunkerWeb, dois nós APP, MariaDB Galera, Synology S3 e Valkey.

**Regra de segurança:** o pacote não contém palavras-passe, chaves, tokens, dados reais, evidências, utilizadores, fotografias internas nem dumps de produção. Os valores reais residem exclusivamente no cofre e nos servidores corporativos.

## Ordem de utilização

| Ordem | Localização | O que contém | Quem executa |
| ---: | --- | --- | --- |
| 1 | `../docs/GUIA_PRATICO_FASE_1_START_CAMPUS.md` | Runbook por zona do diagrama e sequência de go-live | Infraestruturas + IT |
| 2 | `../docs/GUIA_IMPLEMENTACAO_IT_START_CAMPUS.docx` | Guia formatado, pronto a partilhar com a equipa | IT + Segurança + Ambiente |
| 3 | `database-fresh-start/` | Baseline vazia e imutável do esquema final, validações e catálogo-modelo opcional | DBA + Administrador STAND |
| 4 | `../ops/` | Bootstrap dos APP nodes, ambiente, PM2, backup, deploy, watchdog, rollback e systemd | Infraestruturas / DevOps |
| 5 | `../.github/` | CI, CodeQL, Dependabot, triagem e deployment aprovado | DevOps / Segurança |
| 6 | `../docs/INTEGRACAO_BMS_FASE_2.md` | Contrato BMS opcional e isolado para SIN01/NEST | Operação + BMS + Segurança |

## Base de dados — fresh start

A decisão de iniciar com uma base de dados nova é recomendada para esta entrega, desde que se use exclusivamente a baseline em `database-fresh-start/` e **não** as 70 migrações históricas do desenvolvimento. A baseline tem 59 tabelas, índices, `UNIQUE`, enums e defaults do estado final; não contém qualquer linha de dados.

A criação da primeira conta de administrador e a importação opcional do catálogo de referência SIN02 são passos separados, transparentes e auditáveis. Ler primeiro [`database-fresh-start/README.md`](./database-fresh-start/README.md).

## Conteúdo excluído intencionalmente

- `.env`, cofre de segredos, certificados TLS, chaves SSH e credenciais de GitHub/ACC/Graph/BMS/SMTP/S3;
- dumps de base de dados, utilizadores, hashes de palavra-passe, sessões, logs e incidentes;
- submissões, KPI, resíduos/e-GAR, RDCD, documentos, evidências, ficheiros e imagens de projetos;
- fotografias institucionais: devem ser obtidas junto da equipa de Marca e carregadas de forma privada com `ops/migrate-brand-assets.mjs`.

## Verificação do pacote

Antes de transferir para a cópia interna, executar na raiz do repositório:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm audit --prod
node handover/database-fresh-start/validate-baseline.mjs
```

O repositório de referência é público apenas para transferência de código. O IT deve criar uma cópia interna protegida antes de inserir qualquer configuração corporativa.
