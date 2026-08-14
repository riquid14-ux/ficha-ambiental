# Plataforma Ambiental — Start Campus

Plataforma web para gestao integrada de compliance ambiental em projectos de construcao e operacao de data centers.

## Visao Geral

A Plataforma Ambiental centraliza todas as obrigacoes ambientais da Start Campus num unico sistema: fichas de controlo semanal (DCAPE), gestao de residuos (MIRR), certificacoes (LEED/EED/CELE), KPIs de sustentabilidade, calendario de reporting, RDCD, e programa GAMMA de investimento comunitario.

## Stack Tecnologica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Tailwind CSS 4 + shadcn/ui |
| Backend | Express 4 + tRPC 11 |
| Base de Dados | MySQL 8 / TiDB (Drizzle ORM) |
| Autenticacao | Email + Password + 2FA (TOTP) |
| Integracoes | SharePoint (Microsoft Graph) + ACC (Autodesk) |

## Funcionalidades

- **Ficha de Controlo Semanal** - 156 medidas DCAPE, submissao por EE/RAP, revisao por RAA
- **Dashboard** - compliance por projecto, entregaveis, prazos
- **Calendario** - prazos regulatorios e internos, 4 estados coloridos
- **Fases** - Pre-Licenciamento, Licenciamento, Construcao, Operacao
- **MIRR / Gestao de Residuos** - e-GAR, tracking LER, Excel
- **KPIs** - submissao semanal, 16 graficos, metas
- **RDCD** - wizard 4 passos para relatorios de cumprimento
- **Certificacoes NEST** - LEED O&M v4.1, EED, CELE
- **GAMMA** - investimento comunitario, candidaturas, avaliacao
- **7 Roles** - admin, dono_obra, pm, raa, ee, rap, observador
- **Seguranca** - 2FA obrigatorio, password sempre pedida
- **Traducao** - toggle EN/PT

## Quick Start

```bash
git clone <repo-url>
cd plataforma-ambiental
pnpm install
# Configurar variaveis de ambiente (ver docs-it/env-example.txt)
node docs-it/seed-data.mjs
pnpm run dev
```

## Documentacao IT

Consultar docs-it/ para guias detalhados de deployment, integracoes e schema.

## Contacto

Suporte: apoioamb@startcampus.pt
