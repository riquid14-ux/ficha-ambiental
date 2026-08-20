# Plataforma de Gestão Ambiental — Start Campus

**Versão 2.0 — Agosto 2026**

---

## 1. O que é a Plataforma de Gestão Ambiental

A Plataforma de Gestão Ambiental é uma aplicação web desenvolvida para a Start Campus, destinada à monitorização e compliance ambiental dos projectos de construção sustentável em Sines, Portugal. A plataforma centraliza a gestão de fichas de controlo semanais, KPIs de sustentabilidade, planos de monitorização, calendário de reporting, certificações ambientais e o programa comunitário GAMMA.

**Link de acesso:** [ambientfich.co](https://ambientfich.co)

**Contas de teste:**

| Email | Password | Role |
|-------|----------|------|
| htp@startcampus.pt | 123456 | Administrador |
| ppc@startcampus.pt | 123456 | Administrador |
| fnm@startcampus.pt | 123456 | Administrador |
| npa@startcampus.pt | 123456 | Administrador |

---

## 2. Novas Funcionalidades (V2)

A V2 introduz melhorias significativas em segurança, usabilidade e funcionalidades em relação à V1. Abaixo estão todas as funcionalidades organizadas por módulo.

### 2.1 Página de Entrada (Landing Page)

Página de acesso confidencial e profissional. Não expõe informação interna da plataforma — apenas o logo Start Campus, o título "Plataforma de Gestão Ambiental" e o subtítulo "Delivering Sustainable AI-Scale Data Centers".

![Landing Page](/manus-storage/01-landing_9bbc8a95.png)

### 2.2 Página de Boas-Vindas

Após login, o utilizador é redirecionado para a página de boas-vindas personalizada por role e projecto. Inclui vídeo do YouTube da Start Campus, citação inspiracional, cards de funcionalidades disponíveis, diagrama de workflow com legenda de entidades (EE, RAP, RAA, DO), e dicas de utilização.

![Página de Boas-Vindas](/manus-storage/02-welcome_445694db.png)

### 2.3 Dashboard Global

Visão geral do cumprimento ambiental de todos os projectos. Inclui banner com imagem Start Campus, cards de KPIs (fichas aprovadas, em revisão, rascunhos, projectos activos, em incumprimento), entregáveis e prazos por fase, eventos validados/atrasados, mini-calendário e timeline de fases.

![Dashboard](/manus-storage/03-dashboard_222ba730.png)

### 2.4 Ficha de Controlo Semanal

Módulo principal da plataforma. Organizado em 6 tabs: Nova Ficha, Rascunhos, Matriz, Histórico, Revisão e Importar Fichas. Cada ficha contém as 156 medidas DCAPE de construção, filtradas por responsável (EE/RAP/DO). Suporta upload de fotos e ficheiros como evidência por medida.

![Ficha Semanal](/manus-storage/04-ficha_96165ff0.png)

**Novidades V2:**
- Importação de fichas históricas via PDF (extracção automática por LLM Gemini)
- Tabs reorganizadas (Submissões removida — era duplicada da Revisão)
- Criador e aprovador visíveis no histórico
- Admin pode eliminar fichas de qualquer estado (com confirmação por escrito)
- Email de notificação automática ao submeter, aprovar, rejeitar ou eliminar

### 2.5 RDCD — Relatório de Demonstração de Cumprimento da DCAPE

Wizard de 4 passos para gerar relatórios Word (.docx) com compilação automática de medidas, respostas, observações e evidências fotográficas embebidas. Permite seleccionar projecto, período (semanas), medidas específicas e planos de monitorização a incluir.

![RDCD](/manus-storage/05-rdcd_eb12eba5.png)

**Novidades V2:**
- Evidências fotográficas embebidas directamente no Word (não apenas links)
- Fetch em bulk de respostas e evidências (novo procedimento backend)
- Secção de anexo fotográfico no final do documento
- Selector de ano para períodos multi-anuais

### 2.6 Calendário de Reporting

Calendário duplo (mês actual + próximo) com eventos de reporting por projecto. Legenda de cores: amarelo (prazo regulatório), roxo (prazo interno), azul (submetido), verde (validado), vermelho (em incumprimento). Inclui Control Room para gestão de eventos (criar, editar, eliminar, atribuir responsável).

![Calendário](/manus-storage/06-calendario_6ff62348.png)

### 2.7 Timeline de Projectos

Visão temporal de todas as fases de cada projecto com progresso real. Inclui sub-tab "Fases" para gestão detalhada de medidas por fase. Admin pode definir datas, ocultar fases e adicionar/editar medidas via rodinha de definições.

![Timeline](/manus-storage/07-timeline_dd46d823.png)

### 2.8 Administração

Painel completo de gestão: utilizadores (com paginação, pesquisa por nome/email, filtros por role/projecto/empresa), empresas (criar, editar, desactivar, eliminar), configuração SMTP, pedidos de acesso, e gestão de imagens.

![Administração](/manus-storage/08-admin_b24c739f.png)

**Novidades V2:**
- Paginação (20 utilizadores por página) para escalar a centenas de utilizadores
- Filtro por empresa adicionado
- Admin badge destacado (vermelho) para identificar rapidamente administradores
- Eliminação de utilizadores com confirmação (escrever nome)
- Eliminação de empresas (apenas admin)
- Configuração SMTP em tab dedicada (Email)

### 2.9 KPIs de Sustentabilidade

Disponível para projectos SIN02-SIN07 e Subestação. Submissão semanal de dados por EE (trabalhadores, combustível, água, electricidade, incidentes). Cálculos automáticos de conversão (L→KgCO2e). Dashboard com 16 gráficos organizados por categoria (Energia e CO2, Água, Trabalhadores, Incidentes). Metas mensais/anuais definíveis pelo admin. Registo de incidentes com links.

![KPIs](/manus-storage/09-kpi_34925995.png)

### 2.10 Planos de Monitorização

20 planos extraídos da DCAPE (7 programas + 13 planos). Cada plano com periodicidade, datas de último e próximo reporting, upload de documentos, e confirmação de entrega à entidade competente. Ordenados por urgência de entrega.

![Planos](/manus-storage/10-planos_f5c4bad7.png)

### 2.11 GAMMA — Sustentabilidade Comunitária

Programa comunitário com 5 pilares (Educação, Saúde Mental e Bem-Estar, Inclusão Social e Integração, Sustentabilidade, Inovação e Abordagem). 9 tabs: Portefólio, Candidatura, Avaliação, Necessidades, Scorecard, Vencedores, Plano de Apoio, Definições. Admin pode criar novas edições e gerir todo o ciclo.

![GAMMA](/manus-storage/11-gamma_d3e317e9.png)

### 2.12 Matriz de Acompanhamento

Visão agregada por empresa e semana do estado de entrega das fichas. Cores: verde (entregue), azul (em revisão), amarelo (rascunho), vermelho (rejeitada), roxo (parcialmente entregue). Contadores resumo no rodapé.

![Matriz](/manus-storage/12-matriz_a55a90ba.png)

### 2.13 Certificações (NEST — SIN01)

Gestão de certificações LEED O&M v4.1, EED e CELE com submissão de evidências por secção. Campos estáticos (preenchidos uma vez) e campos periódicos (anuais). Prazos automaticamente ligados ao calendário.

### 2.14 MIRR / Gestão de Resíduos

MIRR em SIN01-NEST: gestão de e-GARs, códigos LER, tracking mensal, WasteMap e exportação MIRR anual em Excel. Gestão de Resíduos em SIN02-SIN07: sub-projectos de resíduos com WasteMap por sub-projecto.

### 2.15 Sistema de Email

5 templates de email (submissão, aprovação/rejeição, convite, acesso negado, eliminação). SMTP configurável pelo admin em Administração > Email. Compatível com Office 365.

### 2.16 Importação de Fichas Históricas (PDF)

Upload de PDFs de fichas de controlo passadas. Extracção automática de texto e matching de medidas via LLM (Gemini). Pré-visualização antes de guardar. Associação automática de entidade e empresa.

---

## 3. Arquitectura Técnica

A aplicação segue uma arquitectura stateless, focada na transformação de inputs e encaminhamento para fontes externas (SharePoint, ACC, Email).

| Componente | Tecnologia | Descrição |
|-----------|-----------|-----------|
| Frontend | React 19 + Tailwind CSS 4 + shadcn/ui | SPA com routing client-side |
| Backend | Node.js 22 + Express 4 + tRPC 11 | API type-safe end-to-end |
| ORM | Drizzle ORM 0.30+ | Queries parameterizadas (zero SQL injection) |
| Base de Dados | MySQL 8 (TiDB compatible) | 20+ tabelas, foreign keys, indexes |
| Autenticação | bcrypt (10 rounds) + TOTP (2FA) + JWT | Sessões de 30 dias |
| Ficheiros | S3 (storage cloud) | Upload de evidências e documentos |
| Email | Nodemailer | 5 templates, SMTP configurável |
| LLM | Gemini (via API) | Extracção de texto de PDFs |
| Segurança | Helmet + express-rate-limit | Headers HTTP + rate limiting |

**Fluxo de dados:**

```
Utilizador → React SPA → tRPC API → Drizzle ORM → MySQL
                                   → S3 (ficheiros)
                                   → Nodemailer (emails)
                                   → SharePoint (IT configura)
                                   → ACC (IT configura)
```

---

## 4. Segurança (V2 — Auditoria Completa)

A V2 inclui uma auditoria de segurança completa com as seguintes medidas implementadas:

| Categoria | Medida | Estado |
|-----------|--------|--------|
| Autenticação | bcrypt 10 rounds + TOTP 2FA obrigatório (30 dias grace) | Implementado |
| Autorização | 101 procedures protegidas, 96 admin checks, 63 role checks | Implementado |
| SQL Injection | Zero — 336 queries via Drizzle ORM (parameterizadas) | Verificado |
| XSS | Zero — React auto-escape, zero dangerouslySetInnerHTML | Verificado |
| Rate Limiting | 10 tentativas/15min em login, registo, 2FA, reset password | Implementado |
| Headers HTTP | Helmet (HSTS, X-Content-Type-Options, X-Frame-Options) | Implementado |
| File Uploads | Whitelist MIME + limite 10MB | Implementado |
| Passwords | Mínimo 8 caracteres, bcrypt hash | Implementado |
| Sessões | JWT com expiração de 30 dias (era 365) | Corrigido V2 |
| Enumeração de contas | Mensagens genéricas no registo/login | Corrigido V2 |
| Bypass de login | emailLogin removido (permitia login sem password) | Corrigido V2 |
| Referrer-Policy | strict-origin-when-cross-origin (permite YouTube embeds) | Implementado |

**Roles e Permissões (7 roles):**

| Role | Fichas | Dashboard | Admin | KPIs | RDCD | Certificações |
|------|--------|-----------|-------|------|------|---------------|
| admin | Tudo | Sim | Sim | Sim | Sim | Sim |
| dono_obra | Tudo | Sim | Parcial | Sim | Sim | Sim |
| pm | Ver | Sim | Não | Ver | Ver | Ver |
| raa | Revisar | Não | Não | Não | Não | Não |
| ee | Criar (próprias) | Não | Não | Submeter | Não | Não |
| rap | Criar (próprias) | Não | Não | Não | Não | Não |
| observador | Ver | Não | Não | Ver | Ver | Ver |

---

## 5. Oportunidades de Melhoria

### 5.1 Dark Mode

Foi tentada a implementação de um modo escuro (dark mode) através de múltiplas abordagens:

1. **Filtro CSS `invert(1) hue-rotate(180deg)`** — Aplicado ao elemento `#root` via JavaScript. Funcionava parcialmente mas os títulos e textos em tons de cinzento ficavam ilegíveis (baixo contraste após inversão). Tentou-se corrigir com regras CSS `!important` usando valores invertidos, mas a complexidade de manter centenas de overrides tornou a abordagem insustentável.

2. **Variáveis CSS nativas** — Removeu-se o filtro e tentou-se usar apenas variáveis CSS (`:root.dark`) com overrides para classes Tailwind. Esta abordagem quebrou o light mode porque as variáveis OKLCH do Tailwind 4 conflituavam com os overrides manuais.

3. **Overrides universais** — Tentou-se `html.dark #root * { color: #0a0a0a !important }` mas causou lentidão significativa (centenas de regras `!important` aplicadas a todos os elementos DOM).

**Decisão:** O dark mode foi removido da V2 para garantir performance e estabilidade. Recomenda-se que o IT implemente dark mode nativo usando `dark:` variants do Tailwind directamente nos componentes, o que requer modificar cada componente individualmente mas garante controlo total das cores.

### 5.2 Tradução para Inglês

Foi implementado um sistema de tradução com 1076 chaves PT/EN no `LanguageContext`. No entanto, a cobertura nunca atingiu 100% porque:

1. **Dados da BD** — Os nomes das medidas, secções e fases são dados armazenados em português na base de dados. Traduzir estes dados requer campos `description_en` em cada tabela ou um sistema de tradução dinâmica.

2. **Componentes dinâmicos** — Gráficos (Recharts), calendários, e labels gerados dinamicamente nem sempre passavam pelo sistema `t()`.

3. **Strings em objectos constantes** — Labels definidos fora de componentes React (ex: `const STATUS_LABELS = {...}`) não têm acesso ao hook `useLanguage()`, requerendo wrapping no momento do render.

**Decisão:** O toggle de inglês foi removido da V2. A plataforma opera 100% em português. Se necessário no futuro, recomenda-se usar uma biblioteca i18n completa (ex: `react-i18next`) com ficheiros de tradução separados e suporte a pluralização.

### 5.3 Outras Oportunidades

- **Testes E2E** — Adicionar Playwright ou Cypress para testes de fluxo completo (login → criar ficha → submeter → aprovar)
- **Backup automático da BD** — Configurar cron job com mysqldump diário
- **WAF** — Adicionar Web Application Firewall no reverse proxy (Nginx/Cloudflare)
- **Monitorização** — Integrar Datadog, Grafana ou Prometheus para alertas de performance
- **PWA** — Converter para Progressive Web App para acesso offline às fichas

---

## 6. Próximos Passos para IT

| Passo | Descrição | Estimativa |
|-------|-----------|------------|
| 1 | Provisionar servidor (VM/container com Node.js 22 + Nginx) | 2h |
| 2 | Criar base de dados MySQL 8 (Azure Database for MySQL ou equivalente) | 1h |
| 3 | Clonar repositório: `git clone` + `pnpm install` + configurar `.env` | 1h |
| 4 | Executar migrações da BD: `pnpm drizzle-kit generate` + aplicar SQL | 1h |
| 5 | Configurar SharePoint (App Registration Azure AD, `Sites.ReadWrite.All`) | 4h |
| 6 | Activar ACC (Custom Integration em `admin.b360.autodesk.com`) | 2h |
| 7 | SSL/TLS (Let's Encrypt ou certificado corporativo) | 1h |
| 8 | Configurar SMTP (Office 365) em Administração > Email | 30min |
| 9 | Configurar domínio DNS (apontar para o novo servidor) | 1h |
| 10 | Backups automáticos (cron + mysqldump diário) | 1h |

**Tempo total estimado: 2 dias (IT sénior)**

---

## 7. Repositório GitHub

**URL:** A definir pelo IT (repositório privado)

**Estrutura do repositório:**

```
├── client/                 # Frontend React 19
│   ├── src/
│   │   ├── pages/          # 25 páginas (Dashboard, WeeklyForm, RDCD, KPI, etc.)
│   │   ├── components/     # Componentes reutilizáveis (AppLayout, UI)
│   │   ├── contexts/       # ThemeContext, LanguageContext
│   │   └── App.tsx          # Rotas e navegação
│   └── index.html          # Entry point
├── server/                 # Backend Express + tRPC
│   ├── routers.ts          # 101 procedures protegidas
│   ├── db.ts               # Query helpers (Drizzle ORM)
│   ├── email.ts            # 5 templates de email (nodemailer)
│   └── _core/              # Framework (OAuth, context, middleware)
├── drizzle/                # Schema e migrações
│   ├── schema.ts           # 20+ tabelas
│   └── migrations/         # SQL de migração
├── shared/                 # Tipos e constantes partilhados
├── docs-it/                # Documentação para IT
└── README.md               # Guia de instalação
```

---

## 8. Variáveis de Ambiente Necessárias

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| DATABASE_URL | Connection string MySQL (mysql://user:pass@host:port/db) | Sim |
| JWT_SECRET | Segredo para assinar tokens JWT (min 32 chars) | Sim |
| SMTP_HOST | Servidor SMTP (ex: smtp.office365.com) | Para emails |
| SMTP_PORT | Porta SMTP (ex: 587) | Para emails |
| SMTP_USER | Email do remetente | Para emails |
| SMTP_PASS | Password do email remetente | Para emails |
| SHAREPOINT_TENANT_ID | Azure AD Tenant ID | Para SharePoint |
| SHAREPOINT_CLIENT_ID | Azure AD App Client ID | Para SharePoint |
| SHAREPOINT_CLIENT_SECRET | Azure AD App Client Secret | Para SharePoint |
| SHAREPOINT_SITE_ID | ID do site SharePoint | Para SharePoint |
| ADS_CLIENT_ID | Autodesk Client ID | Para ACC |
| ADS_CLIENT_SECRET | Autodesk Client Secret | Para ACC |

---

**Documento preparado pela Equipa de Sustentabilidade, Start Campus**
**Versão 2.0 — Agosto 2026**
