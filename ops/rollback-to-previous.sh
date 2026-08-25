#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/plataforma-ambiental}"
CURRENT_LINK="${APP_ROOT}/current"
PREVIOUS_FILE="${APP_ROOT}/previous-stable-release"
SHARED_ENV="${APP_ENV_FILE:-/etc/plataforma-ambiental/app.env}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-https://ambientfich.co/api/health/ready}"

[[ -L "$CURRENT_LINK" ]] || { echo "Symlink current inexistente" >&2; exit 2; }
[[ -f "$PREVIOUS_FILE" ]] || { echo "Não existe release anterior registada" >&2; exit 3; }
[[ -f "$SHARED_ENV" ]] || { echo "Ficheiro de ambiente inexistente: $SHARED_ENV" >&2; exit 6; }

CURRENT_RELEASE="$(readlink -f "$CURRENT_LINK")"
PREVIOUS_RELEASE="$(cat "$PREVIOUS_FILE")"
RELEASES_ROOT="$(readlink -f "${APP_ROOT}/releases")"
PREVIOUS_REAL="$(readlink -f "$PREVIOUS_RELEASE" 2>/dev/null || true)"

if [[ -z "$PREVIOUS_REAL" || ! -d "$PREVIOUS_REAL" || "$PREVIOUS_REAL" != "$RELEASES_ROOT"/* ]]; then
  echo "Release anterior inválida ou fora do directório autorizado" >&2
  exit 4
fi
if [[ "$PREVIOUS_REAL" == "$CURRENT_RELEASE" ]]; then
  echo "A release anterior é igual à actual" >&2
  exit 5
fi

if [[ "${ROLLBACK_SKIP_BACKUP:-false}" != "true" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SHARED_ENV"
  set +a
  bash "$CURRENT_LINK/ops/backup-database.sh" >/dev/null
fi

restore_current() {
  ln -sfn "$CURRENT_RELEASE" "${CURRENT_LINK}.failed-rollback"
  mv -Tf "${CURRENT_LINK}.failed-rollback" "$CURRENT_LINK"
  APP_CURRENT_PATH="$CURRENT_LINK" APP_ENV_FILE="$SHARED_ENV" \
    pm2 startOrReload "$CURRENT_LINK/ecosystem.config.cjs" --env production --update-env || true
}
trap restore_current ERR

ln -sfn "$PREVIOUS_REAL" "${CURRENT_LINK}.rollback"
mv -Tf "${CURRENT_LINK}.rollback" "$CURRENT_LINK"
APP_CURRENT_PATH="$CURRENT_LINK" APP_ENV_FILE="$SHARED_ENV" \
  pm2 startOrReload "$CURRENT_LINK/ecosystem.config.cjs" --env production --update-env
pm2 save
DEPLOY_HEALTH_URL="$HEALTH_URL" "$CURRENT_LINK/ops/verify-health.sh" "$HEALTH_URL"

printf '%s\n' "$PREVIOUS_REAL" > "${APP_ROOT}/last-stable-release"
printf '%s\n' "$CURRENT_RELEASE" > "$PREVIOUS_FILE"
trap - ERR
echo "Rollback concluído: $PREVIOUS_REAL"
