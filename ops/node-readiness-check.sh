#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/plataforma-ambiental}"
APP_ENV_FILE="${APP_ENV_FILE:-/etc/plataforma-ambiental/app.env}"
BASE_URL="${APP_BASE_URL:-}"

[[ -L "$APP_ROOT/current" ]] || { echo "FALHA: symlink current em falta"; exit 1; }
[[ -r "$APP_ENV_FILE" ]] || { echo "FALHA: app.env em falta ou sem permissão"; exit 1; }
for command in node pnpm pm2 mysqldump; do command -v "$command" >/dev/null || { echo "FALHA: $command em falta"; exit 1; }; done

set -a
# shellcheck disable=SC1090
source "$APP_ENV_FILE"
set +a
node "$APP_ROOT/current/dist/index.js" >/tmp/stand-readiness-startup.log 2>&1 &
pid=$!
sleep 3
kill "$pid" 2>/dev/null || true

if grep -q 'Configuração de produção incompleta' /tmp/stand-readiness-startup.log; then
  cat /tmp/stand-readiness-startup.log >&2
  exit 1
fi
if [[ -n "$BASE_URL" ]]; then curl --fail --silent --show-error "$BASE_URL/api/health/ready"; fi
echo "OK: nó pronto para serviço."
