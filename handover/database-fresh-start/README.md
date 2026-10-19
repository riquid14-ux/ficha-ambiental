# Base de dados STAND — fresh start

## Decisão aprovada para esta entrega

Uma base MariaDB nova é a opção mais limpa para produção: não traz utilizadores, passwords, fichas, KPI, e-GAR, relatórios, evidências, documentação, telemetria ou dados demonstrativos do ambiente de desenvolvimento.

**Não aplicar a pasta histórica `../../drizzle/` numa base nova.** O histórico de desenvolvimento tem transformações de dados e uma cadeia anterior que não deve ser usada como instalador de produção. Esta pasta contém uma nova linhagem com uma única baseline DDL do estado final.

| Ficheiro | Finalidade |
| --- | --- |
| `drizzle/0000_stand_schema_baseline.sql` | Única migration da base nova: apenas `CREATE TABLE`, índices, `UNIQUE`, enums e defaults. |
| `drizzle/meta/` | Journal e snapshot da nova linhagem Drizzle. |
| `drizzle.config.ts` | Configuração dedicada para aplicar somente esta baseline. |
| `SCHEMA_BASELINE_SHA256.txt` | Integridade SHA-256 da baseline. |
| `validate-baseline.mjs` | Verificação estática: integridade, 59 tabelas, sem DML, `DROP`, `ALTER`, utilizadores ou permissões. |
| `bootstrap-initial-admin.mjs` | Cria uma única primeira conta administrativa, sem password na linha de comando. |
| `catalogue-template-SIN02.json` | Catálogo de referência de construção: secções e medidas semanais/DCAPE, sem registos operacionais. |
| `import-catalogue-template.mjs` | Importador transacional e idempotente do modelo SIN02 opcional. |
| `EXEMPLO_ESTRUTURA_BASE_DADOS.md` | Mapa lógico e lista de grupos/tabelas para revisão com DBA e IT. |

## Pré-condições do DBA

1. O cluster Galera está em `Primary`, sincronizado e com `wsrep_ready=ON`.
2. A execução é feita **uma única vez** através do VIP de escrita, por uma conta de migração distinta da conta da aplicação.
3. A base `stand` (nome ilustrativo) foi criada vazia com `utf8mb4` e a collation aprovada pela equipa DBA.
4. Foi feito snapshot/backup da base vazia e foi registada a janela de mudança.
5. `DATABASE_URL` aponta para o VIP e é fornecida pelo cofre/shell protegido, nunca por Git ou linha de comando gravada em histórico.

Exemplo de criação, a adaptar pelo DBA:

```sql
CREATE DATABASE stand
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

## 1 — Validar a baseline antes de escrever na base

Na raiz do repositório:

```bash
node handover/database-fresh-start/validate-baseline.mjs
sha256sum -c handover/database-fresh-start/SCHEMA_BASELINE_SHA256.txt
```

O resultado obrigatório é: **59 tabelas**, sem `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE USER` ou `GRANT`.

## 2 — Aplicar a baseline uma vez

Carregar a configuração protegida da sessão apenas para este comando e executar:

```bash
export DATABASE_URL='mysql://<utilizador-migracao>:<segredo>@<vip-db>:3306/stand'
pnpm drizzle-kit migrate --config handover/database-fresh-start/drizzle.config.ts
unset DATABASE_URL
```

Não executar `pnpm db:push`, não aplicar ficheiros de `../../drizzle/` e não escrever manualmente na tabela de controlo do Drizzle. A baseline cria e regista apenas a migration `0000_stand_schema_baseline`.

Em Galera, não aplicar DDL nó a nó nem com RSU. O DBA deve usar o método de alteração de esquema aprovado para o cluster (normalmente TOI), aguardar sincronização e só depois abrir tráfego dos APP nodes.

## 3 — Confirmar a base vazia e o esquema

```sql
SELECT COUNT(*) AS tabelas
FROM information_schema.tables
WHERE table_schema = 'stand';

SHOW TABLES;
SHOW CREATE TABLE users;
SHOW CREATE TABLE weekly_submissions;
SHOW CREATE TABLE operation_readings;
SELECT COUNT(*) AS migrations FROM __drizzle_migrations;
```

O DBA deve validar: 59 tabelas, uma migration de baseline, engine/charset/collation aprovados e zero linhas em todas as tabelas de negócio. A aplicação usa relações lógicas e **não define foreign keys físicas** no estado atual; os índices e `UNIQUE` constam na baseline.

## 4 — Criar a primeira conta administrativa

A primeira conta é separada da estrutura. Executar numa sessão TTY privada, após a baseline e antes de ligar o balanceador:

```bash
export DATABASE_URL='mysql://<utilizador-app>:<segredo>@<vip-db>:3306/stand'
node handover/database-fresh-start/bootstrap-initial-admin.mjs
unset DATABASE_URL
```

O programa pede email, nome e palavra-passe sem a mostrar. Recusa executar se já existir um administrador ativo. Depois do primeiro login, ativar 2FA e criar os restantes utilizadores através de convites/administração; nunca reutilizar a palavra-passe inicial ou inseri-la em scripts.

## 5 — Configuração funcional inicial (opcional, sem dados de obra)

Uma base vazia permite entrar com a primeira conta, mas ainda não contém projetos, empresas nem catálogos. Para manter o comportamento de criação de novos projetos de construção, importar o **modelo SIN02** que contém apenas estrutura e texto de medidas aprovadas — sem submissões, evidências, pessoas ou estados:

```bash
export DATABASE_URL='mysql://<utilizador-app>:<segredo>@<vip-db>:3306/stand'
node handover/database-fresh-start/import-catalogue-template.mjs
unset DATABASE_URL
```

O importador cria unicamente o projeto-modelo `SIN02`, as secções e medidas de âmbito `weekly` e `dcape`. Recusa alterar um projeto que já tenha catálogo. Em seguida, criar os restantes projetos pela Administração: a aplicação clona os dois catálogos do SIN02 sem copiar fichas, respostas, estados, evidências ou auditoria.

O catálogo é uma referência técnica a validar pelo responsável Ambiental antes de produção. Configurar empresas, associações, utilizadores, planos, calendário, KPI, destinatários, branding e parâmetros de Operação através da administração e dos processos funcionais aprovados.

## 6 — Critérios de aceitação

| Verificação | Resultado obrigatório |
| --- | --- |
| Integridade baseline | SHA-256 válido; verificador estático passa. |
| Esquema | 59 tabelas; uma migration baseline; nenhum DML no SQL. |
| Sem dados herdados | Zero fichas, users, empresas, sessões, KPI, e-GAR, evidências, telemetria e demo. |
| Primeiro administrador | Uma conta Admin ativa; password com hash bcrypt; 2FA ativado no primeiro acesso. |
| Catálogo opcional | SIN02 tem dois âmbitos independentes (`weekly` e `dcape`); sem submissões ou respostas. |
| Aplicação | `/api/health/ready` responde após o arranque corporativo completo. |
| Segurança | Segredos apenas no cofre; conta `stand_app` usa privilégio mínimo. |

## Rollback

Antes de qualquer alteração, preservar o snapshot/backup da base vazia. Se a baseline ou bootstrap falhar, o rollback é eliminar/recriar a base de **staging** e reaplicar a baseline validada. Em produção, seguir a decisão do DBA e o runbook Galera; não tentar corrigir o estado executando subconjuntos das migrações históricas.
