# Plataforma de Gestão Ambiental — Start Campus

Aplicação web para monitorização e compliance ambiental em projectos de construção de data centers sustentáveis em Sines, Portugal.

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + Tailwind CSS + shadcn/ui | 19 / 4 |
| Backend | Node.js + Express + tRPC | 22 / 4 / 11 |
| Base de Dados | MySQL (Drizzle ORM) | 8+ |
| Autenticação | Email + Password + 2FA (TOTP) | jose + otpauth |
| Testes | Vitest | 259/259 pass |

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
- **Segurança** — 2FA obrigatório, sanitização de ficheiros, 259 testes automatizados

## Instalação

```bash
git clone <url-do-repo>
cd Plataforma-Ambiental-V2
pnpm install
```

## Configuração

Criar ficheiro `.env` na raiz:

```env
DATABASE_URL=mysql://user:password@host:3306/plataforma_ambiental
JWT_SECRET=chave_secreta_minimo_32_caracteres
```

Ver documentação de implementação (Word) para configuração completa de SMTP, Azure OpenAI, SharePoint e ACC.

## Execução

```bash
# Desenvolvimento
pnpm dev

# Produção
pnpm build
node dist/index.js
```

## Testes

```bash
pnpm test    # 259 testes (segurança, roles, funcionalidade)
```

## Estrutura

```
client/          → Frontend React (páginas, componentes, contextos)
server/          → Backend Express + tRPC (routers, db, email, segurança)
drizzle/         → Schema da base de dados e migrações
shared/          → Tipos e constantes partilhados
```

## Contacto

Suporte: apoioamb@startcampus.pt
