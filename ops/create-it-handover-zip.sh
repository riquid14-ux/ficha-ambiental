#!/usr/bin/env bash
# Gera uma transferência organizada para IT a partir do commit Git validado.
# Não inclui segredos, dados operacionais, dumps, logs, media privado ou builds locais.
set -Eeuo pipefail
umask 077

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
COMMIT="$(git rev-parse HEAD)"
SHORT_COMMIT="$(git rev-parse --short=12 HEAD)"
AUTHOR="$(git log -1 --format='%an <%ae>')"
PACKAGE_NAME="STAND_IMPLEMENTACAO_IT_${SHORT_COMMIT}"
OUTPUT="${1:-$ROOT/../${PACKAGE_NAME}.zip}"
WORKDIR="$(mktemp -d)"
PACKAGE_ROOT="$WORKDIR/$PACKAGE_NAME"

cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

if [[ -n "$(git status --porcelain)" ]]; then
  echo "A árvore Git tem alterações. Faça commit antes de criar a entrega IT." >&2
  exit 2
fi
if [[ "$AUTHOR" != "RmdRicardo <rmd@startcampus.pt>" ]]; then
  echo "O commit de entrega deve estar atribuído a RmdRicardo <rmd@startcampus.pt>; atual: $AUTHOR" >&2
  exit 3
fi

node handover/database-fresh-start/validate-baseline.mjs

# A fonte está versionada, mas estes ficheiros nunca podem surgir no pacote.
if git ls-files | grep -E '(^|/)(\.env($|\.)|.*\.(pem|key|p12|pfx|sql\.gz|dump|bak)$|node_modules/|dist/|uploads?/|downloads?/)' >/dev/null; then
  echo "Foram encontrados ficheiros proibidos na árvore versionada; reveja antes de entregar." >&2
  exit 4
fi

mkdir -p "$PACKAGE_ROOT"

archive_paths_into() {
  local destination="$1"
  shift
  mkdir -p "$destination"
  git archive --format=tar "$COMMIT" -- "$@" | tar -xf - -C "$destination"
}

archive_tree_into() {
  local destination="$1"
  local source_tree="$2"
  mkdir -p "$destination"
  git archive --format=tar "$COMMIT:$source_tree" | tar -xf - -C "$destination"
}

export_file() {
  local source="$1"
  local destination="$2"
  mkdir -p "$(dirname "$destination")"
  git show "$COMMIT:$source" > "$destination"
}

write_file() {
  local destination="$1"
  mkdir -p "$(dirname "$destination")"
  cat > "$destination"
}

# ── 00 · Ponto de entrada ────────────────────────────────────────────────────
mkdir -p "$PACKAGE_ROOT/00_LEIA_PRIMEIRO"
export_file "docs/GUIA_IMPLEMENTACAO_IT_START_CAMPUS.docx" "$PACKAGE_ROOT/00_LEIA_PRIMEIRO/GUIA_IMPLEMENTACAO_IT_START_CAMPUS.docx"
export_file "docs/GUIA_IMPLEMENTACAO_IT_START_CAMPUS.md" "$PACKAGE_ROOT/00_LEIA_PRIMEIRO/GUIA_IMPLEMENTACAO_IT_START_CAMPUS.md"
export_file "docs/GUIA_PRATICO_FASE_1_START_CAMPUS.md" "$PACKAGE_ROOT/00_LEIA_PRIMEIRO/GUIA_PRATICO_FASE_1_START_CAMPUS.md"
export_file "handover/MANIFESTO_ENTREGA_IT.md" "$PACKAGE_ROOT/00_LEIA_PRIMEIRO/MANIFESTO_ENTREGA_IT.md"
export_file "handover/ESTRUTURA_PACOTE_IT.md" "$PACKAGE_ROOT/00_LEIA_PRIMEIRO/ESTRUTURA_PACOTE_IT.md"
write_file "$PACKAGE_ROOT/00_LEIA_PRIMEIRO/COMECE_AQUI.md" <<EOF
# STAND — entrega para implementação IT

**Commit entregue:** $COMMIT
**Autor:** $AUTHOR
**Estrutura:** organizada para a arquitetura Start Campus com Fase 1 e Fase 2 opcional.

## Ordem obrigatória

1. Ler GUIA_PRATICO_FASE_1_START_CAMPUS.md e confirmar DNS, WAF, VIPs, Galera, Synology e Valkey.
2. Ler GUIA_IMPLEMENTACAO_IT_START_CAMPUS.docx para os passos funcionais, ACC, SharePoint, email e segurança.
3. Aplicar apenas a baseline em 03_BASE_DE_DADOS_FRESH_START/ numa base vazia; **não** aplicar o histórico em 01_CODIGO_FONTE_COMPLETO/STAND/drizzle/ a uma base nova.
4. Instalar os artefactos de 02_FASE_1_INFRAESTRUTURA/ nos nós definidos pelo diagrama.
5. Só depois da aceitação da Fase 1, analisar 04_FASE_2_OPERACAO_BMS/ com Operação, BMS e Segurança.

## Segurança e dados

O pacote não contém segredos, passwords, sessões, utilizadores, documentos, evidências, fotografias privadas, dados de produção ou dumps. Os valores reais residem no cofre corporativo e nos ambientes aprovados.

O código completo, compilável e testável está em 01_CODIGO_FONTE_COMPLETO/STAND/. As pastas de Fase 1 e Fase 2 são uma navegação operacional e incluem mapas para os módulos relevantes desse código.
EOF

# ── 01 · Código completo — fonte canónica ─────────────────────────────────────
SOURCE_ROOT="$PACKAGE_ROOT/01_CODIGO_FONTE_COMPLETO/STAND"
archive_paths_into "$SOURCE_ROOT" \
  client server shared drizzle scripts patches \
  package.json pnpm-lock.yaml tsconfig.json vite.config.ts vitest.config.ts drizzle.config.ts \
  ecosystem.config.cjs components.json .gitignore .prettierignore .prettierrc \
  README.md SECURITY.md CONTRIBUTING.md LICENSE CLAUDE.md
# Artefacto de debugging do ambiente de desenvolvimento não é necessário ao IT.
rm -rf "$SOURCE_ROOT/client/public/__manus__"
write_file "$PACKAGE_ROOT/01_CODIGO_FONTE_COMPLETO/README_CODIGO_FONTE.md" <<'EOF'
# Código-fonte completo da STAND

Esta é a fonte canónica para compilar a aplicação. Contém frontend React, backend Express/tRPC, esquema Drizzle, testes, scripts de documentação e configuração de processo PM2.

## Instalação de referência

```bash
cd STAND
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

A instalação corporativa deve seguir a Fase 1. Não crie ficheiros `.env` nesta pasta; o ambiente é carregado pelo gestor de segredos e por `/etc/plataforma-ambiental/app.env` no servidor.

O diretório `drizzle/` contém o histórico de desenvolvimento e serve para referência. Para uma base vazia, usar exclusivamente `03_BASE_DE_DADOS_FRESH_START/`.
EOF

# ── 02 · Fase 1 — infraestrutura e operação de aplicação ─────────────────────
PHASE1="$PACKAGE_ROOT/02_FASE_1_INFRAESTRUTURA"
archive_paths_into "$PHASE1/RECURSOS_DE_DEPLOY" ops .github ecosystem.config.cjs
export_file "docs/GUIA_PRATICO_FASE_1_START_CAMPUS.md" "$PHASE1/GUIA_PRATICO_FASE_1_START_CAMPUS.md"
export_file "docs/AVALIACAO_ARQUITETURA_FASE_1_STAND.docx" "$PHASE1/AVALIACAO_ARQUITETURA_FASE_1_STAND.docx"
write_file "$PHASE1/MAPA_CODIGO_FASE_1.md" <<'EOF'
# Mapa de código — Fase 1

Os ficheiros abaixo estão na fonte canónica em `../01_CODIGO_FONTE_COMPLETO/STAND/`. Este mapa evita duplicação e indica ao IT onde cada responsabilidade é implementada.

| Responsabilidade | Caminhos canónicos |
| --- | --- |
| Arranque, headers de confiança, health checks e rota BMS | `server/_core/index.ts`, `server/health.ts`, `server/runtime-config.ts` |
| Sessões locais, autenticação, 2FA e rate limiting distribuído | `server/auth/session.ts`, `server/_core/mfa.ts`, `server/auth-rate-limit.ts`, `server/routers.ts`, `shared/two-factor-policy.ts` |
| Armazenamento S3 autorizado e media institucional | `server/storage.ts`, `server/storage-authorization.ts`, `server/_core/storageProxy.ts`, `server/brand-media.ts` |
| ACC, SharePoint/arquivo e email | `server/autodesk.ts`, `server/archive-provider.ts`, `server/email.ts`, `server/document-library.ts` |
| Base de dados e schema de aplicação | `drizzle/schema.ts`, `drizzle/relations.ts`, `server/db.ts` |
| PM2, release, backup, watchdog, rollback e systemd | `RECURSOS_DE_DEPLOY/ops/` |
| CI/CD, CodeQL, Dependabot e incident triage | `RECURSOS_DE_DEPLOY/.github/` |

A configuração real deve ser criada a partir de `RECURSOS_DE_DEPLOY/ops/app.env.example`, guardada fora do Git e carregada apenas pelo serviço no nó APP.
EOF
write_file "$PHASE1/README_FASE_1.md" <<'EOF'
# Fase 1 — infraestrutura Start Campus

Esta pasta contém apenas o que a equipa de Infraestruturas/DevOps necessita para ligar o código à arquitetura do diagrama: HAProxy/BunkerWeb, APP node 1 e 2, Galera, Synology S3, Valkey, SMTP, ACC e SharePoint.

1. Usar o guia prático nesta pasta.
2. Instalar `RECURSOS_DE_DEPLOY/ops/bootstrap-app-node.sh` em cada nó APP.
3. Preencher `app.env` no cofre/servidor, nunca no Git.
4. Executar a baseline da base de dados da pasta 03 através do VIP Galera.
5. Iniciar o primeiro nó, validar `/api/health/ready`, depois o segundo nó e, finalmente, colocá-los no balanceador.

A Fase 2 permanece bloqueada e não é requisito de go-live da Fase 1.
EOF

# ── 03 · Fresh start — baseline vazia e exemplo do modelo ─────────────────────
DATABASE="$PACKAGE_ROOT/03_BASE_DE_DADOS_FRESH_START"
archive_tree_into "$DATABASE" "handover/database-fresh-start"
write_file "$DATABASE/LEIA_PRIMEIRO.md" <<'EOF'
# Base de dados — Fresh Start

Esta é a única pasta autorizada para instalar uma base nova. A baseline tem 59 tabelas e apenas DDL: não cria pessoas, passwords, empresas, projetos, dados de demonstração, submissões, documentos ou telemetria.

1. Confirmar Galera, quorum e VIP DB.
2. Verificar `SCHEMA_BASELINE_SHA256.txt` com `validate-baseline.mjs`.
3. Aplicar a baseline **uma vez**, pelo DBA, através do VIP.
4. Criar o primeiro administrador de forma interativa.
5. Importar o catálogo-modelo SIN02 apenas se for validado pela equipa Ambiental.

`EXEMPLO_ESTRUTURA_BASE_DADOS.md` é o mapa lógico pedido pelo IT. Não é uma exportação de dados reais.
EOF

# ── 04 · Fase 2 — Operação SIN01/NEST e BMS ───────────────────────────────────
PHASE2="$PACKAGE_ROOT/04_FASE_2_OPERACAO_BMS"
export_file "docs/INTEGRACAO_BMS_FASE_2.md" "$PHASE2/INTEGRACAO_BMS_FASE_2.md"
export_file "docs/IMPLEMENTACAO_STAND_OPERACAO_2026-09-25.md" "$PHASE2/IMPLEMENTACAO_STAND_OPERACAO.md"
export_file "docs/ANALISE_MELHORIAS_OPERACAO_SIN01_2026-09-12.md" "$PHASE2/ANALISE_OPERACAO_SIN01.md"
archive_paths_into "$PHASE2/CODIGO_FASE_2" \
  server/bms-ingest.ts server/bms-ingest.test.ts server/operation-media.ts \
  server/operation-digital-twin.test.ts server/operation-infrastructure.test.ts \
  server/operation-invoice-form.test.ts server/operation-invoice-type.test.ts \
  server/operation-reconciliation.integration.test.ts server/operation-report.test.ts \
  server/operation-sustainability.test.ts server/operation-time-series.test.ts \
  client/src/pages/Operation.tsx client/src/pages/OperationSettingsAdmin.tsx \
  client/src/components/InfrastructureDashboard.tsx client/src/components/InfrastructureSettingsSection.tsx \
  client/src/components/OperationImportMappingSettings.tsx \
  client/src/lib/operation-invoices.ts client/src/lib/operation-time-series.ts
write_file "$PHASE2/README_FASE_2.md" <<'EOF'
# Fase 2 — Operação NEST / BMS

A Fase 2 está implementada, mas **inativa por defeito**. Não deve ser ativada durante o go-live da Fase 1.

O gateway BMS corporativo é o único componente que comunica com a rede OT. A STAND recebe apenas eventos HTTPS assinados com HMAC, com timestamp, lista de métricas autorizadas, limite de lote e `eventId` idempotente. A aplicação não abre ligações ao BMS e não envia comandos ao edifício.

Usar primeiro `INTEGRACAO_BMS_FASE_2.md`. A subpasta `CODIGO_FASE_2/` é uma cópia focada dos módulos de Operação/BMS; a fonte completa permanece em `01_CODIGO_FONTE_COMPLETO/STAND/`.
EOF

# ── 05 · Documentação funcional para ambiente/negócio ─────────────────────────
FUNCTIONAL="$PACKAGE_ROOT/05_DOCUMENTACAO_FUNCIONAL"
archive_paths_into "$FUNCTIONAL" \
  docs/FICHA_SEMANAL_E_DCAPE_SEPARACAO_2026-10-07.md \
  docs/RDCD_IMPLEMENTACAO_2026-09-30.md \
  docs/RDCD_TEMPLATE_SIN02_MAPPING.md \
  docs/AUDITORIA_SEGURANCA_E_USABILIDADE_2026-10-05.md \
  docs/CATALOGO_KPI_AMBIENTAIS_MAPPING_2026-08-31.md \
  docs/VALIDACAO_CENTRAL_DOCUMENTOS_2026-09-10.md \
  docs/FERRAMENTAS_FUTURAS.md
write_file "$FUNCTIONAL/README_DOCUMENTACAO_FUNCIONAL.md" <<'EOF'
# Documentação funcional e de fronteiras

Esta pasta ajuda a equipa IT a configurar sem alterar regras de negócio:

- `FICHA_SEMANAL_E_DCAPE...`: separação obrigatória entre ficha semanal de construção, Timeline/DCAPE e RDCD.
- `RDCD...`: origem, seleção e limites da emissão de relatórios.
- `CATALOGO_KPI...`: contexto e definição de indicadores.
- `AUDITORIA...`: controlos de acesso, segurança e usabilidade já verificados.
- `FERRAMENTAS_FUTURAS...`: itens deliberadamente fora do âmbito ativo.
EOF

# ── 06 · Governação e evidência de qualidade ──────────────────────────────────
GOVERNANCE="$PACKAGE_ROOT/06_GOVERNANCA_E_VALIDACAO"
archive_paths_into "$GOVERNANCE" SECURITY.md CONTRIBUTING.md LICENSE
export_file "docs/OPERATIONS-RESILIENCE.md" "$GOVERNANCE/OPERATIONS_RESILIENCE.md"
export_file "docs/SEGURANCA_PRE_LANCAMENTO_2026-09-10.md" "$GOVERNANCE/SEGURANCA_PRE_LANCAMENTO.md"
write_file "$GOVERNANCE/README_GOVERNANCA.md" <<'EOF'
# Governação e validação

Antes de produção, a equipa IT deve executar os critérios de aceitação dos guias, armazenar evidências no seu repositório interno e proteger a branch de produção. Não há segredos neste pacote; a gestão de credenciais, rotação, certificados e controlos de rede pertence ao ambiente corporativo.
EOF

# Inventário do conteúdo e checksums para controlo após cópia interna.
(
  cd "$PACKAGE_ROOT"
  find . -type f ! -name "SHA256SUMS.txt" -print0 | sort -z | xargs -0 sha256sum
) > "$PACKAGE_ROOT/SHA256SUMS.txt"

if find "$PACKAGE_ROOT" -type f \( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' -o -name '*.dump' -o -name '*.bak' \) -print -quit | grep -q .; then
  echo "O pacote preparado contém um ficheiro sensível proibido." >&2
  exit 5
fi

mkdir -p "$(dirname "$OUTPUT")"
rm -f "$OUTPUT" "$OUTPUT.sha256"
(
  cd "$WORKDIR"
  zip -qr "$OUTPUT" "$PACKAGE_NAME"
)
unzip -tq "$OUTPUT" >/dev/null
sha256sum "$OUTPUT" > "$OUTPUT.sha256"

printf 'Entrega organizada criada:\n%s\nChecksum:\n%s\nCommit: %s\nAutor: %s\nEstrutura: 00 leitura · 01 código · 02 Fase 1 · 03 base de dados · 04 Fase 2 · 05 funcional · 06 governação\n' \
  "$OUTPUT" "$OUTPUT.sha256" "$COMMIT" "$AUTHOR"
