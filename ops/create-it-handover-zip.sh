#!/usr/bin/env bash
# Gera uma entrega reproduzível a partir de ficheiros Git versionados, sem .env,
# node_modules, builds locais, dumps, logs ou objetos de storage.
set -Eeuo pipefail
umask 077

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
COMMIT="$(git rev-parse HEAD)"
SHORT_COMMIT="$(git rev-parse --short=12 HEAD)"
AUTHOR="$(git log -1 --format='%an <%ae>')"
OUTPUT="${1:-$ROOT/../STAND_IT_HANDOVER_${SHORT_COMMIT}.zip}"
PREFIX="STAND_IT_HANDOVER_${SHORT_COMMIT}/"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "A árvore Git tem alterações. Faça commit ou reverta antes de criar a entrega." >&2
  exit 2
fi
if [[ "$AUTHOR" != "RmdRicardo <rmd@startcampus.pt>" ]]; then
  echo "O commit de entrega deve estar atribuído a RmdRicardo <rmd@startcampus.pt>; atual: $AUTHOR" >&2
  exit 3
fi
node handover/database-fresh-start/validate-baseline.mjs

# Guardrail simples: a entrega Git não pode incluir segredos típicos ou dumps.
if git ls-files | grep -E '(^|/)(\.env($|\.)|.*\.(pem|key|p12|pfx|sql\.gz|dump|bak)$|node_modules/|dist/|uploads?/|downloads?/)' >/dev/null; then
  echo "Foram encontrados ficheiros proibidos na árvore versionada; reveja antes de entregar." >&2
  exit 4
fi

mkdir -p "$(dirname "$OUTPUT")"
rm -f "$OUTPUT" "$OUTPUT.sha256"
git archive --format=zip --prefix="$PREFIX" --output="$OUTPUT" "$COMMIT"
unzip -tq "$OUTPUT" >/dev/null
sha256sum "$OUTPUT" > "$OUTPUT.sha256"

printf 'Entrega criada:\n%s\nChecksum:\n%s\nCommit: %s\nAutor: %s\n' "$OUTPUT" "$OUTPUT.sha256" "$COMMIT" "$AUTHOR"
