# Plataforma de Gestão Ambiental — Start Campus

Aplicação web para monitorização e compliance ambiental em projectos de construção de data centers sustentáveis em Sines, Portugal.

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + Tailwind CSS + shadcn/ui | 19 / 4 |
| Backend | Node.js + Express + tRPC | 22 / 4 / 11 |
| Base de Dados | MySQL (Drizzle ORM) | 8+ |
| Autenticação | Email + Password + 2FA (TOTP) | jose + otpauth |
| Testes | Vitest | Segurança, roles, funcionalidade e resiliência |

## Funcionalidades

- **Fichas de Controlo Semanais** — 156 medidas DCAPE, submissão por EE/RAP, revisão e aprovação por RAA
- **Dashboard** — cumprimento ambiental por projecto com gráficos e filtros por ano
- **Matriz de Acompanhamento** — estado das fichas por empresa e semana
- **RDCD** — Relatório de Demonstração de Cumprimento (exportação Word com fotos)
- **KPIs Ambientais** — submissão semanal, metas anuais, exportação Excel
- **Gestão de Resíduos** — eGARs, MIRR, Wastemap
- **Certificações** — LEED O&M, EED, CELE
- **GAMMA** — Programa comunitário com candidaturas e avaliações
- **Timeline** — Fases de projecto (Pré-licenciamento → Operação)
- **Calendário** — Prazos regulatórios e internos de reporting
- **Importação PDF** — Fichas históricas com extracção automática via LLM
- **7 Roles** — admin, dono_obra, pm, raa, ee, rap, observador
- **Segurança** — 2FA obrigatório, sanitização de ficheiros, 292 testes automatizados
- **Resiliência operacional** — health checks, vigia PM2, backup pré-deployment, alertas redundantes e rollback automático

## Instalação

```bash
git clone <url-do-repo>
cd Plataforma-Ambiental-V2
pnpm install
```

## Configuração

Criar ficheiro `.env` na raiz:

```env
DATABASE_URL=mysql://<utilizador>:<palavra-passe>@<servidor>:3306/plataforma_ambiental
JWT_SECRET=<segredo-aleatorio-com-pelo-menos-32-caracteres>
```

Ver documentação de implementação (Word) para configuração completa de SMTP, Azure OpenAI, SharePoint e ACC.

Para instalar a protecção de crash-loops, CI/CD, aprovação humana e rollback no servidor Start Campus, consultar [`docs/OPERATIONS-RESILIENCE.md`](docs/OPERATIONS-RESILIENCE.md).

## Execução

```bash
# Desenvolvimento
pnpm dev

# Produção
pnpm build
pm2 startOrReload ecosystem.config.cjs --env production
```

## Testes

```bash
pnpm test    # segurança, roles, funcionalidade e resiliência operacional
```

## Estrutura

```
client/          → Frontend React (páginas, componentes, contextos)
server/          → Backend Express + tRPC (routers, db, email, segurança)
drizzle/         → Schema da base de dados e migrações
shared/          → Tipos e constantes partilhados
ops/             → Backup, vigia PM2, deployment e rollback
.github/         → CI, triagem de incidentes e deployment protegido
```

## Contacto

Suporte: apoioamb@startcampus.pt
