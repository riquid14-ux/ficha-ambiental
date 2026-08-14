# Email para Equipa de IT — Plataforma Ambiental Start Campus

---

**Assunto:** Plataforma Ambiental — Apresentação, Arquitectura e Próximos Passos para Implementação

---

Boa tarde a todos,

Venho apresentar-vos a **Plataforma Ambiental** que a equipa de Sustentabilidade desenvolveu para centralizar e automatizar todas as obrigações ambientais da Start Campus. A plataforma já está funcional e em fase de testes pela nossa equipa. Precisamos agora da vossa colaboração para a integrar na infraestrutura da Start Campus.

---

## 1. O que é a Plataforma Ambiental

É uma aplicação web que gere todo o ciclo de compliance ambiental dos nossos projectos de construção e operação de data centers. Em vez de ficheiros Excel dispersos, emails e pastas partilhadas, tudo passa a estar num único local com controlo de acessos, histórico, e rastreabilidade.

**Link para experimentar:** https://ambientfich.co

Podem entrar com os emails já configurados (rmd@startcampus.pt, npa@startcampus.pt, rom@startcampus.pt). A palavra-passe inicial é `123456` — o sistema obriga a alterar no primeiro acesso.

---

## 2. Funcionalidades Principais

| Módulo | Descrição | Frequência |
|--------|-----------|-----------|
| **Ficha de Controlo Semanal** | 156 medidas DCAPE — cada EE/RAP preenche semanalmente, RAA revê e aprova/rejeita | Semanal |
| **Dashboard** | Visão de compliance por projecto, entregáveis em atraso, evolução temporal | Contínuo |
| **Calendário de Reporting** | Todos os prazos regulatórios (APA, DGEG, CCDR) com alertas automáticos | Contínuo |
| **Fases de Projecto** | Pré-Licenciamento → Licenciamento → Construção → Operação — com evidências e comentários | Por fase |
| **MIRR** (SIN01) | Gestão de resíduos — importação de e-GARs, tracking por código LER, exportação para MIRR anual | Mensal |
| **Gestão de Resíduos** (SIN02-07) | Igual ao MIRR mas com sub-projectos (ex: escavações) e WasteMap | Mensal |
| **KPIs de Sustentabilidade** | Combustível, água, trabalhadores, incidentes — com metas e 16 gráficos | Semanal |
| **RDCD** | Wizard para gerar Relatórios de Demonstração de Cumprimento (semestrais) | Semestral |
| **Certificações NEST** | LEED O&M v4.1, EED (Directiva Eficiência Energética), CELE (EU ETS) | Anual |
| **GAMMA** | Programa de investimento comunitário — candidaturas, avaliação, vencedores | Por edição |

---

## 3. Arquitectura Técnica

A aplicação funciona como um **transformador de dados** — recebe inputs dos utilizadores e encaminha para os destinos correctos:

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ Utilizador  │────▶│  App Web (Node.js)   │────▶│   SharePoint    │
│ (Browser)   │     │  Servidor Start      │     │  (Documentos)   │
└─────────────┘     └──────────────────────┘     └─────────────────┘
                              │                          │
                              │                   ┌──────┴──────┐
                              ▼                   │             │
                    ┌──────────────────┐   ┌──────▼─────┐ ┌────▼────┐
                    │   MySQL (BD)     │   │    ACC     │ │  Email  │
                    │  (Metadata)      │   │ (Fichas)   │ │(Alertas)│
                    └──────────────────┘   └────────────┘ └─────────┘
```

**O que cada componente guarda:**

| Componente | O que guarda | Porquê |
|-----------|-------------|--------|
| **MySQL** | Utilizadores, permissões, estados das fichas, KPIs, logs de auditoria | Queries rápidas, relações, filtros |
| **SharePoint** | PDFs, fotos, Word, Excel, evidências, planos, e-GARs | Arquivo documental, acessível fora da app |
| **ACC** | Fichas de controlo de construção | Visível dentro do Autodesk para as EE |
| **App** | Nada permanente — apenas transforma e encaminha | Stateless, fácil de escalar |

---

## 4. Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + Tailwind CSS + shadcn/ui | 19 / 4 |
| Backend | Node.js + Express + tRPC | 22 / 4 / 11 |
| ORM | Drizzle ORM | 0.30+ |
| Base de Dados | MySQL 8 (compatível TiDB) | 8.0+ |
| Autenticação | bcrypt + TOTP (2FA) + JWT | — |
| Integrações | Microsoft Graph API (SharePoint) + Autodesk Data Management API (ACC) | — |

---

## 5. Segurança

- **Autenticação:** Email + Password (bcrypt, custo 10) + 2FA obrigatório (TOTP via Google/Microsoft Authenticator)
- **Autorização:** 7 roles com permissões granulares por projecto (admin, dono_obra, pm, raa, ee, rap, observador)
- **Sessões:** JWT com expiração, password verificada em cada sessão
- **Emails desconhecidos:** Bloqueados automaticamente, ficam em fila de "Pedidos de Acesso" para aprovação admin
- **Audit log:** Todas as ações administrativas ficam registadas (quem, quando, o quê)
- **Dados sensíveis:** Hash de passwords e segredos TOTP nunca expostos ao frontend

---

## 6. O que Precisamos do IT

### 6.1 Curto Prazo (1-2 dias)

1. **Domínio interno** — Apontar um subdomínio (ex: `ambiental.startcampus.pt`) via CNAME para `ambientfich.co` (temporário, enquanto não migram)
2. **Testar a plataforma** — Aceder a https://ambientfich.co e verificar que tudo funciona

### 6.2 Médio Prazo (1-2 semanas)

3. **Provisionar servidor** — VM ou container com Node.js 22 + Nginx (ou Azure App Service)
4. **Criar MySQL** — Azure Database for MySQL ou MySQL 8 no servidor
5. **Clonar o repositório** — `git clone` + `pnpm install` + configurar variáveis + `pnpm run dev`
6. **Configurar SharePoint** — App Registration no Azure AD:
   - Permissão: `Sites.ReadWrite.All`
   - Fornecer-nos: Tenant ID, Client ID, Client Secret, Site ID, Drive ID
   - Estrutura de pastas sugerida: `Start Campus / Ambiente / {Projecto} / {Módulo} / {Ano}`

### 6.3 Médio-Longo Prazo

7. **Activar ACC** — A Custom Integration já foi criada pela Ju no admin.b360.autodesk.com. Só precisam de actualizar o URL para o novo domínio Start quando estiver pronto.
8. **SSL/TLS** — Certificado Let's Encrypt ou certificado corporativo para HTTPS
9. **Backups** — Configurar backup diário do MySQL (mysqldump ou snapshot)

---

## 7. Repositório GitHub

**URL:** https://github.com/riquid14-ux/plataforma-ambiental-startcampus

**Estrutura:**
```
├── client/          → Frontend React (páginas, componentes, estilos)
├── server/          → Backend Express + tRPC (API, autenticação, integrações)
│   └── integrations/
│       ├── sharepoint.ts   → Módulo SharePoint (Microsoft Graph API)
│       ├── acc.ts          → Módulo ACC (Autodesk Data Management API)
│       └── index.ts        → Hub de routing de documentos
├── drizzle/         → Schema da base de dados + migrações
├── docs-it/         → Documentação técnica completa
│   ├── 01-GUIA-DEPLOYMENT.md
│   ├── 02-ENV-EXAMPLE.md
│   ├── 03-GUIA-INTEGRACOES.md
│   ├── 04-GUIA-UTILIZADOR.md
│   ├── 05-SCHEMA-BD.md
│   └── seed-data.mjs       → Script de dados iniciais
└── README.md        → Visão geral
```

---

## 8. Variáveis de Ambiente Necessárias

| Variável | Descrição | Quem fornece |
|----------|-----------|-------------|
| `DATABASE_URL` | Connection string MySQL | IT |
| `JWT_SECRET` | Segredo para assinar tokens (gerar aleatório) | IT |
| `SHAREPOINT_TENANT_ID` | Azure AD Tenant ID | IT |
| `SHAREPOINT_CLIENT_ID` | App Registration Client ID | IT |
| `SHAREPOINT_CLIENT_SECRET` | App Registration Secret | IT |
| `SHAREPOINT_SITE_ID` | ID do site SharePoint | IT |
| `SHAREPOINT_DRIVE_ID` | ID do drive/biblioteca | IT |
| `ACC_CLIENT_ID` | Autodesk App Client ID | Já temos |
| `ACC_CLIENT_SECRET` | Autodesk App Client Secret | Já temos |
| `ACC_ACCOUNT_ID` | ID da conta Autodesk | Já temos |

---

## 9. Passos para Pôr a Correr (Quick Start)

```bash
# 1. Clonar
git clone https://github.com/riquid14-ux/plataforma-ambiental-startcampus.git
cd plataforma-ambiental-startcampus

# 2. Instalar dependências
pnpm install

# 3. Configurar variáveis de ambiente
# Copiar docs-it/env-example.txt e preencher com os valores reais

# 4. Carregar dados iniciais (156 medidas, projectos, admins)
node docs-it/seed-data.mjs

# 5. Arrancar em desenvolvimento
pnpm run dev

# 6. Para produção
pnpm run build
pm2 start dist/server/index.js --name plataforma-ambiental
```

---

## 10. Projectos Configurados

| Código | Nome | Tipo | Módulos Específicos |
|--------|------|------|-------------------|
| SIN01-NEST | NEST Data Center | Operação | MIRR, Certificações (LEED/EED/CELE), Fases Exploração |
| SIN02 | Sintra Site 2 | Construção | Ficha Semanal, KPIs, Gestão Resíduos |
| SIN03 | Sintra Site 3 | Construção | Ficha Semanal, KPIs, Gestão Resíduos |
| SIN04 | Sintra Site 4 | Construção | Ficha Semanal, KPIs, Gestão Resíduos |
| SIN05 | Sintra Site 5 | Construção | Ficha Semanal, KPIs, Gestão Resíduos |
| SIN06 | Sintra Site 6 | Construção | Ficha Semanal, KPIs, Gestão Resíduos |
| SIN07 | Sintra Site 7 | Construção | Ficha Semanal, KPIs, Gestão Resíduos |
| SUB400 | Subestação 400 kV | Construção | Ficha Semanal, KPIs, Gestão Resíduos |

---

## 11. Dicas de Implementação

1. **Docker** — O repositório pode ser containerizado facilmente. Um Dockerfile simples com `node:22-alpine` + `pnpm install` + `pnpm run build` é suficiente.
2. **Nginx** — Usar como reverse proxy com SSL termination. Configurar `proxy_pass http://localhost:3000;`
3. **MySQL** — Recomendamos Azure Database for MySQL (Flexible Server) pela facilidade de backups e escalabilidade.
4. **SharePoint** — A estrutura de pastas no SharePoint deve espelhar a organização da app: `/Ambiente/SIN02/Fichas Semanais/2026/Semana 33/`
5. **Monitorização** — PM2 já fornece logs e restart automático. Para alertas, podem integrar com o vosso sistema de monitoring existente.
6. **Actualizações** — Futuras actualizações são feitas via `git pull` + `pnpm install` + `pnpm run build` + restart do PM2.

---

## 12. Questões Frequentes

**P: A app guarda ficheiros localmente?**
R: Não. Actualmente usa S3 temporário. Quando configurarem o SharePoint, todos os ficheiros passam a ir directamente para lá. O código já está preparado — só falta preencher as credenciais.

**P: E se quisermos mudar algo na interface?**
R: O código é vosso. Qualquer developer com experiência em React/Node.js pode fazer alterações. A documentação em `docs-it/` explica a estrutura.

**P: Quanto custa manter?**
R: Apenas o custo do servidor (VM ou App Service) + MySQL. Não há licenças de software — tudo é open-source.

**P: É seguro para dados sensíveis?**
R: Sim. Passwords com bcrypt, 2FA obrigatório, JWT com expiração, audit log, emails desconhecidos bloqueados. Recomendamos adicionar WAF e rate limiting no Nginx.

**P: Posso testar sem instalar nada?**
R: Sim! Acedam a https://ambientfich.co com os emails configurados (password: 123456).

---

Estou disponível para uma call de esclarecimento ou para vos ajudar com qualquer passo da implementação. O ideal seria agendarmos uma sessão de 30 minutos para alinhar prioridades e timeline.

Cumprimentos,
Ricardo Duarte
Equipa de Sustentabilidade
rmd@startcampus.pt
