# Guia de Deployment — Plataforma Ambiental Start Campus

## Visão Geral

A Plataforma Ambiental é uma aplicação web (React + Node.js/Express) que gere fichas de controlo ambiental semanais, fases de projeto, calendário de reporting, gestão de resíduos (MIRR) e geração de relatórios RDCD.

---

## Requisitos do Servidor

| Componente | Requisito Mínimo |
|---|---|
| **Node.js** | v18+ (recomendado v22 LTS) |
| **Base de Dados** | MySQL 8.0+ ou TiDB (compatível MySQL) |
| **RAM** | 1 GB mínimo, 2 GB recomendado |
| **Disco** | 10 GB (app + logs) |
| **SO** | Linux (Ubuntu 22.04+), Windows Server 2019+, ou container Docker |
| **Portas** | 3000 (app) ou configurável via PORT env |

---

## Passo 1: Clonar o Repositório

```bash
git clone <URL_DO_REPOSITORIO> plataforma-ambiental
cd plataforma-ambiental
```

---

## Passo 2: Instalar Dependências

```bash
npm install -g pnpm
pnpm install
```

---

## Passo 3: Configurar Variáveis de Ambiente

Copiar o ficheiro `.env.example` para `.env` e preencher:

```bash
cp .env.example .env
```

Editar `.env` com os valores reais (ver ficheiro `02-ENV-EXAMPLE.md` para detalhes de cada variável).

---

## Passo 4: Criar a Base de Dados

1. Criar a base de dados MySQL:
```sql
CREATE DATABASE plataforma_ambiental CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'plataforma'@'%' IDENTIFIED BY '<PASSWORD_SEGURA>';
GRANT ALL PRIVILEGES ON plataforma_ambiental.* TO 'plataforma'@'%';
FLUSH PRIVILEGES;
```

2. Executar as migrações (cria todas as tabelas):
```bash
pnpm drizzle-kit push
```

3. Executar o script de seed (carrega dados iniciais):
```bash
node docs-it/seed-data.mjs
```

---

## Passo 5: Build de Produção

```bash
pnpm run build
```

---

## Passo 6: Iniciar o Servidor

```bash
NODE_ENV=production node dist/server/index.js
```

Ou com PM2 (recomendado para produção):
```bash
npm install -g pm2
pm2 start dist/server/index.js --name "plataforma-ambiental"
pm2 save
pm2 startup
```

---

## Passo 7: Configurar Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name plataforma.startcampus.pt;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Opção Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
```

```bash
docker build -t plataforma-ambiental .
docker run -d -p 3000:3000 --env-file .env --name plataforma plataforma-ambiental
```

---

## Verificação

Após iniciar, aceder a `https://<DOMINIO>/login`. Deve aparecer a página de login com o logo Start Campus.

Credenciais iniciais dos administradores:
- **Email**: rmd@startcampus.pt / rom@startcampus.pt / npa@startcampus.pt
- **Password**: `123456` (será obrigado a alterar no primeiro acesso)
- **2FA**: Obrigatório após 7 dias — configurar com Google/Microsoft Authenticator

---

## Manutenção

| Tarefa | Comando |
|---|---|
| Ver logs | `pm2 logs plataforma-ambiental` |
| Reiniciar | `pm2 restart plataforma-ambiental` |
| Atualizar código | `git pull && pnpm install && pnpm run build && pm2 restart plataforma-ambiental` |
| Backup DB | `mysqldump -u plataforma -p plataforma_ambiental > backup.sql` |

