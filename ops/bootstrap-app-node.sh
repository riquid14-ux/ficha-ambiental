#!/usr/bin/env bash
set -Eeuo pipefail

# Executar em cada nó da zona APP-SERVICES como root, após a equipa IT validar
# a imagem base Ubuntu 24.04 e os repositórios internos.
APP_USER="plataforma"
APP_ROOT="/opt/plataforma-ambiental"
REPOSITORY_URL="${1:-}"
RELEASE_REF="${2:-main}"

if [[ $EUID -ne 0 ]]; then echo "Execute com sudo" >&2; exit 2; fi
if [[ -z "$REPOSITORY_URL" ]]; then echo "Uso: sudo $0 <url-repositorio-interno> [release-ref]" >&2; exit 2; fi

apt-get update
apt-get install -y --no-install-recommends ca-certificates curl git gnupg unzip mysql-client
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@10.4.1 --activate
npm install -g pm2@5

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$APP_USER" --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$APP_ROOT" "$APP_ROOT/releases" "$APP_ROOT/incoming"
install -d -o root -g "$APP_USER" -m 750 /etc/plataforma-ambiental
install -d -o "$APP_USER" -g "$APP_USER" -m 700 /var/lib/plataforma-watchdog /var/backups/plataforma-ambiental

su -s /bin/bash "$APP_USER" -c "git clone --branch '$RELEASE_REF' --depth 1 '$REPOSITORY_URL' '$APP_ROOT/releases/bootstrap'"
ln -sfn "$APP_ROOT/releases/bootstrap" "$APP_ROOT/current"
chown -h "$APP_USER:$APP_USER" "$APP_ROOT/current"

install -m 640 -o root -g "$APP_USER" "$APP_ROOT/current/ops/app.env.example" /etc/plataforma-ambiental/app.env
install -m 640 -o root -g "$APP_USER" "$APP_ROOT/current/ops/watchdog.env.example" /etc/plataforma-ambiental/watchdog.env
install -m 640 -o root -g "$APP_USER" "$APP_ROOT/current/ops/scheduler.env.example" /etc/plataforma-ambiental/scheduler.env

echo "Base instalada. Antes de iniciar serviços, preencher os três ficheiros /etc/plataforma-ambiental/*.env com segredos reais do cofre."