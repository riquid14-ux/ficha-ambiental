# Email para IT — Plataforma Ambiental Start Campus

## Assunto: Plataforma Ambiental — Handover Tecnico e Proximos Passos

---

Boa tarde,

Venho partilhar convosco a Plataforma Ambiental que desenvolvemos para centralizar todas as obrigacoes ambientais da Start Campus. A plataforma ja esta funcional e em utilizacao pela equipa de sustentabilidade.

### O que e

Uma aplicacao web que gere:
- Fichas de controlo ambiental semanais (156 medidas DCAPE)
- Gestao de residuos (MIRR) com importacao de e-GARs
- KPIs de sustentabilidade (combustivel, agua, trabalhadores, incidentes)
- Calendario de reporting com prazos regulatorios
- Certificacoes NEST (LEED, EED, CELE)
- Programa GAMMA de investimento comunitario
- Relatorios RDCD semestrais

### Estado Atual

A plataforma esta live em ambientfich.co com todas as funcionalidades operacionais. O codigo-fonte completo esta no GitHub (link abaixo) com documentacao tecnica.

### O que precisamos do IT

1. **Curto prazo (opcional):** Apontar um dominio interno (ex: ambiental.startcampus.pt) via CNAME para o dominio atual
2. **Medio prazo:** Configurar a integracao SharePoint para armazenamento de documentos
3. **Medio prazo:** Ativar a Custom Integration no ACC (ja criada pela Ju)
4. **Longo prazo (se desejado):** Migrar para servidores proprios da Start Campus

### Repositorio GitHub

URL: https://github.com/riquid14-ux/plataforma-ambiental-startcampus

Contem:
- Codigo completo (frontend + backend + API)
- docs-it/01-GUIA-DEPLOYMENT.md — como instalar
- docs-it/02-ENV-EXAMPLE.md — variaveis de ambiente
- docs-it/03-GUIA-INTEGRACOES.md — SharePoint + ACC
- docs-it/seed-data.mjs — script de dados iniciais

### Stack

- Node.js 22 + React 19 + Express + MySQL
- Autenticacao: email + password + 2FA (Google/Microsoft Authenticator)
- 7 roles com permissoes granulares por projecto

### Dicas de Implementacao

1. Para testar localmente: clonar repo, pnpm install, configurar DATABASE_URL, correr seed, pnpm run dev
2. Para producao: Docker (Dockerfile incluido) ou PM2 + Nginx
3. A base de dados pode ser Azure Database for MySQL (ja usamos TiDB que e compativel)
4. O SharePoint precisa de: App Registration no Azure AD com permissao Sites.ReadWrite.All
5. O ACC precisa de: Custom Integration no admin.b360.autodesk.com (ja feito pela Ju)

### Seguranca

- Passwords com bcrypt (custo 10)
- 2FA TOTP obrigatorio apos 30 dias
- JWT com expiracao
- Emails nao registados sao bloqueados
- Audit log de todas as acoes admin
- Sem dados sensiveis no frontend

Qualquer duvida, estou disponivel.

Cumprimentos,
Ricardo Duarte
rmd@startcampus.pt
