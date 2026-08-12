# Plataforma Ambiental — Start Campus

## Guia de Integração para Equipa de IT

Este repositório contém o código-fonte completo da Plataforma Ambiental da Start Campus.
A aplicação gere fichas de controlo ambiental semanais, KPIs de sustentabilidade, calendários de reporting, gestão de resíduos (MIRR), e relatórios RDCD.

---

## Índice

| # | Documento | Descrição |
|---|---|---|
| 1 | [01-GUIA-DEPLOYMENT.md](./01-GUIA-DEPLOYMENT.md) | Como instalar e colocar a aplicação a correr (Node.js, MySQL, Nginx, Docker) |
| 2 | [02-ENV-EXAMPLE.md](./02-ENV-EXAMPLE.md) | Documentação de todas as variáveis de ambiente |
| 3 | [03-GUIA-INTEGRACOES.md](./03-GUIA-INTEGRACOES.md) | Como ligar ao SharePoint (Microsoft Graph) e ACC (Autodesk) |
| 4 | [04-GUIA-UTILIZADOR.md](./04-GUIA-UTILIZADOR.md) | Manual para utilizadores finais |
| 5 | [05-SCHEMA-BD.md](./05-SCHEMA-BD.md) | Estrutura completa da base de dados (24+ tabelas) |
| 6 | [env-example.txt](./env-example.txt) | Ficheiro .env modelo pronto a copiar |
| 7 | [seed-data.mjs](./seed-data.mjs) | Script para carregar dados iniciais |

---

## Passos Rápidos (Resumo)

```bash
# 1. Clonar o repositório
git clone <url-do-repo>
cd plataforma-ambiental-startcampus

# 2. Instalar dependências
pnpm install

# 3. Configurar variáveis de ambiente
cp docs-it/env-example.txt .env
# Editar .env com as credenciais reais (ver docs-it/02-ENV-EXAMPLE.md)

# 4. Criar base de dados MySQL
mysql -u root -p -e "CREATE DATABASE plataforma_ambiental CHARACTER SET utf8mb4;"

# 5. Correr migrações (cria todas as tabelas)
pnpm drizzle-kit push

# 6. Carregar dados iniciais (medidas DCAPE, projetos, admins)
node docs-it/seed-data.mjs

# 7. Arrancar a aplicação
pnpm run dev          # Desenvolvimento
pnpm run build && pnpm run start  # Produção
```

---

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│         React 19 + Tailwind 4 + Recharts            │
│              (client/src/)                           │
└──────────────────────┬──────────────────────────────┘
                       │ tRPC (HTTP/JSON)
┌──────────────────────▼──────────────────────────────┐
│                    BACKEND                           │
│         Express 4 + tRPC 11 + Drizzle ORM           │
│              (server/)                               │
└───────┬──────────────┬──────────────┬───────────────┘
        │              │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │  MySQL  │   │SharePoint│   │   ACC   │
   │ (TiDB)  │   │(MS Graph)│   │(Autodesk)│
   └─────────┘   └─────────┘   └─────────┘
```

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + TypeScript | 19.x |
| Styling | Tailwind CSS | 4.x |
| Backend | Express + tRPC | 4.x / 11.x |
| ORM | Drizzle | latest |
| Base de Dados | MySQL / TiDB | 8.x |
| Autenticação | Email+Password+2FA (TOTP) | bcryptjs + otpauth |
| Gráficos | Recharts | 2.x |
| Build | Vite | 6.x |
| Runtime | Node.js | 22.x |

---

## Estrutura do Projecto

```
├── client/                 # Frontend React
│   └── src/
│       ├── pages/          # Páginas (Dashboard, KPI, MIRR, Calendario, etc.)
│       ├── components/     # Componentes reutilizáveis (AppLayout, UI)
│       └── contexts/       # Contextos React (Project, Theme)
├── server/                 # Backend Express + tRPC
│   ├── routers.ts          # Todos os endpoints da API
│   ├── db.ts               # Helpers de base de dados
│   ├── storage.ts          # Upload de ficheiros (S3)
│   └── integrations/       # SharePoint + ACC (prontos para credenciais)
├── drizzle/                # Schema e migrações
│   └── schema.ts           # Definição de todas as tabelas
├── docs-it/                # Documentação para IT (este directório)
└── shared/                 # Tipos e constantes partilhados
```

---

## Integrações Pendentes (para o IT configurar)

### 1. SharePoint (Microsoft Graph API)
- **Ficheiro**: `server/integrations/sharepoint.ts`
- **Objectivo**: Guardar todos os documentos (fichas PDF, evidências, planos) no SharePoint da Start Campus
- **Necessário**: Tenant ID, Client ID, Client Secret, Site ID, Drive ID
- **Documentação**: [03-GUIA-INTEGRACOES.md](./03-GUIA-INTEGRACOES.md#sharepoint)

### 2. Autodesk Construction Cloud (ACC)
- **Ficheiro**: `server/integrations/acc.ts`
- **Objectivo**: Enviar fichas de controlo semanais para o ACC como documentos
- **Necessário**: Client ID, Client Secret, Account ID, Project ID
- **Documentação**: [03-GUIA-INTEGRACOES.md](./03-GUIA-INTEGRACOES.md#acc)

### 3. Custom Integration no ACC (iframe)
- **Objectivo**: A aplicação aparece como tab dentro do ACC
- **Configuração**: Account Admin → Apps → Custom Integrations → Add
- **URL**: O domínio final onde a app estiver hospedada

---

## Segurança

- Autenticação por email + palavra-passe (bcrypt hash)
- 2FA obrigatório (TOTP — Google/Microsoft Authenticator)
- Sessões JWT com cookie httpOnly
- Roles: admin, dono_obra, raa, ee, rap, observador
- Registo com aprovação obrigatória do administrador
- Todas as operações sensíveis verificam permissões no backend

---

## Contacto

Para questões sobre a aplicação, contactar Nairana Aguiar (npa@startcampus.pt).
