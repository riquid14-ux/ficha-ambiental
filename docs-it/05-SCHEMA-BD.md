# Schema da Base de Dados

A base de dados contém 24 tabelas. Abaixo está a estrutura principal.

## Tabelas Principais

| Tabela | Descrição |
|---|---|
| `users` | Utilizadores (email, role, empresa, 2FA, password hash) |
| `companies` | Empresas (EE, RAP, RAA, Dono de Obra, Observador) |
| `projects` | Projetos (SIN01-SIN07, Subestação 400 kV) |
| `sections` | Secções das medidas DCAPE (14 secções + fases) |
| `measures` | 156 medidas ambientais DCAPE |
| `weekly_submissions` | Fichas semanais (rascunho, submetida, aprovada, rejeitada, eliminada) |
| `measure_responses` | Respostas por medida (I/C/NC/NA + observações) |
| `evidence_images` | Fotos de evidência por medida |
| `evidence_files` | Ficheiros anexos por medida (PDF, Word, etc.) |
| `review_comments` | Comentários gerais da RAA na revisão |
| `measure_reviews` | Veredicto da RAA por medida (✓/✗ + comentário) |
| `calendar_events` | Eventos de reporting no calendário |
| `monitoring_plans` | Planos de monitorização (DCAPE) |
| `waste_egars` | Registos de e-GARs para MIRR |
| `phase_measure_statuses` | Estado das medidas por fase/projeto |
| `phase_evidence` | Evidências (comentários, fotos, ficheiros) por fase |
| `project_companies` | Associação empresa ↔ projeto |
| `project_users` | Associação utilizador ↔ projeto |
| `project_phases` | Fases atribuídas por projeto |
| `invitations` | Convites pendentes para novos utilizadores |
| `deletion_logs` | Registo de fichas eliminadas (soft-delete 21 dias) |
| `historical_pdfs` | PDFs históricos carregados manualmente |
| `app_settings` | Configurações da app (imagens, posições) |
| `user_feedback` | Feedback/melhorias submetidas pelos utilizadores |

## Diagrama de Relações Principais

```
users ──┬── companies ──── project_companies ──── projects
        │                                            │
        ├── project_users ───────────────────────────┘
        │
        └── weekly_submissions ──┬── measure_responses ──── evidence_images
                                 │                     └── evidence_files
                                 ├── review_comments
                                 └── measure_reviews

sections ──── measures ──── phase_measure_statuses
                       └── phase_evidence

projects ──── calendar_events
         └── waste_egars
```

## Campos de Segurança (tabela users)

| Campo | Tipo | Descrição |
|---|---|---|
| `passwordHash` | TEXT | Hash bcrypt da password |
| `mustChangePassword` | INT(1) | 1 = obrigado a mudar no próximo login |
| `totpSecret` | TEXT | Chave secreta TOTP (encriptada) |
| `totpEnabled` | INT(1) | 1 = 2FA ativo |
| `accountStatus` | VARCHAR | "active", "pending", "rejected" |
| `passwordResetToken` | TEXT | Token para reset de password |
| `passwordResetExpiry` | BIGINT | Timestamp de expiração do token |

## Script de Migração

Para criar todas as tabelas automaticamente:
```bash
pnpm drizzle-kit push
```

Isto lê o ficheiro `drizzle/schema.ts` e cria/atualiza as tabelas na base de dados configurada em `DATABASE_URL`.

