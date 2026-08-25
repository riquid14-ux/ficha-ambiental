#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Execute com sudo" >&2
  exit 2
fi

install -d -m 700 -o plataforma -g plataforma /var/lib/plataforma-watchdog
install -d -m 700 -o plataforma -g plataforma /var/lib/plataforma-watchdog/incidents
install -d -m 700 -o plataforma -g plataforma /var/backups/plataforma-ambiental
install -d -m 700 -o root -g root /etc/plataforma-ambiental

if [[ ! -f /etc/plataforma-ambiental/watchdog.env ]]; then
  install -m 600 -o root -g root ops/watchdog.env.example /etc/plataforma-ambiental/watchdog.env
  echo "Preencha /etc/plataforma-ambiental/watchdog.env antes de iniciar o serviço" >&2
fi

install -m 644 ops/systemd/plataforma-watchdog.service /etc/systemd/system/plataforma-watchdog.service
systemctl daemon-reload
systemctl enable plataforma-watchdog.service

echo "Instalação preparada. Depois de preencher o env: sudo systemctl start plataforma-watchdog"
