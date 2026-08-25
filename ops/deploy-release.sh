#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

ARCHIVE="${1:-}"
RELEASE_ID="${2:-}"
APP_ROOT="${APP_ROOT:-/opt/plataforma-ambiental}"
CURRENT_LINK="${APP_ROOT}/current"
RELEASES_DIR="${APP_ROOT}/releases"
INCOMING_DIR="${APP_ROOT}/incoming"
SHARED_ENV="${APP_ENV_FILE:-/etc/plataforma-ambiental/app.env}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-https://ambientfich.co/api/health/ready}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

if [[ -z "$ARCHIVE" || -z "$RELEASE_ID" ]]; then
  echo "Uso: deploy-release.sh <release.tar.gz> <release-id>" >&2
  exit 2
fi
if [[ ! -f "$ARCHIVE" ]]; then
  echo "Artefacto inexistente: $ARCHIVE" >&2
  exit 3
fi
if [[ ! "$RELEASE_ID" =~ ^[A-Za-z0-9._-]{7,80}$ ]]; then
  echo "Identificador de release inválido" >&2
  exit 4
fi
if [[ ! -f "$SHARED_ENV" ]]; then
  echo "Ficheiro de ambiente inexistente: $SHARED_ENV" >&2
  exit 5
fi

if tar -tzf "$ARCHIVE" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo "Artefacto rejeitado: contém caminhos fora da release" >&2
  exit 9
fi

command -v pm2 >/dev/null 2>&1 || { echo "pm2 não está instalado" >&2; exit 6; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm não está instalado" >&2; exit 7; }

mkdir -p "$RELEASES_DIR" "$INCOMING_DIR"
PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
NEW_RELEASE="${RELEASES_DIR}/${RELEASE_ID}"
BACKUP_FILE=""
SWITCHED=0

rollback() {
  local exit_code=$?
  if [[ $SWITCHED -eq 1 && -n "$PREVIOUS_RELEASE" && -d "$PREVIOUS_RELEASE" ]]; then
    echo "Deployment falhou; a repor ${PREVIOUS_RELEASE}" >&2
    ln -sfn "$PREVIOUS_RELEASE" "${CURRENT_LINK}.rollback"
    mv -Tf "${CURRENT_LINK}.rollback" "$CURRENT_LINK"
    APP_CURRENT_PATH="$CURRENT_LINK" APP_ENV_FILE="$SHARED_ENV" \
      pm2 startOrReload "$CURRENT_LINK/ecosystem.config.cjs" --env production --update-env || true
    DEPLOY_HEALTH_URL="$HEALTH_URL" "$CURRENT_LINK/ops/verify-health.sh" "$HEALTH_URL" || true
  fi
  exit "$exit_code"
}
trap rollback ERR

echo "A criar backup obrigatório antes do deployment"
BACKUP_FILE="$(APP_ROOT="$APP_ROOT" bash "$CURRENT_LINK/ops/backup-database.sh")"
echo "Backup validado: $BACKUP_FILE"

rm -rf "$NEW_RELEASE"
mkdir -p "$NEW_RELEASE"
tar -xzf "$ARCHIVE" -C "$NEW_RELEASE"

for required in dist/index.js package.json pnpm-lock.yaml ecosystem.config.cjs ops/verify-health.sh; do
  [[ -e "$NEW_RELEASE/$required" ]] || { echo "Artefacto incompleto: $required" >&2; exit 8; }
done

chmod +x "$NEW_RELEASE"/ops/*.sh
cd "$NEW_RELEASE"
pnpm install --prod --frozen-lockfile --ignore-scripts

ln -sfn "$NEW_RELEASE" "${CURRENT_LINK}.new"
mv -Tf "${CURRENT_LINK}.new" "$CURRENT_LINK"
SWITCHED=1

if [[ -n "$PREVIOUS_RELEASE" && -d "$PREVIOUS_RELEASE" ]]; then
  printf '%s\n' "$PREVIOUS_RELEASE" > "${APP_ROOT}/previous-stable-release"
fi

APP_CURRENT_PATH="$CURRENT_LINK" APP_ENV_FILE="$SHARED_ENV" \
  pm2 startOrReload "$CURRENT_LINK/ecosystem.config.cjs" --env production --update-env
pm2 save

DEPLOY_HEALTH_URL="$HEALTH_URL" "$CURRENT_LINK/ops/verify-health.sh" "$HEALTH_URL"

printf '%s\n' "$NEW_RELEASE" > "${APP_ROOT}/last-stable-release"
SWITCHED=0
rm -f "$ARCHIVE"

find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr | tail -n "+$((KEEP_RELEASES + 1))" | cut -d' ' -f2- \
  | while IFS= read -r old_release; do
      [[ -n "$old_release" && "$old_release" != "$NEW_RELEASE" && "$old_release" != "$PREVIOUS_RELEASE" ]] \
        && rm -rf "$old_release"
    done

echo "Deployment aprovado: ${RELEASE_ID}"
