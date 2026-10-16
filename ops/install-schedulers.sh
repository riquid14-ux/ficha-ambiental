#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Execute com sudo" >&2
  exit 2
fi

install -d -m 750 -o root -g plataforma /etc/plataforma-ambiental
if [[ ! -f /etc/plataforma-ambiental/scheduler.env ]]; then
  install -m 640 -o root -g plataforma ops/scheduler.env.example /etc/plataforma-ambiental/scheduler.env
  echo "Preencha /etc/plataforma-ambiental/scheduler.env antes de iniciar os timers" >&2
fi

for unit in \
  plataforma-weekly-reminder.service \
  plataforma-weekly-reminder.timer \
  plataforma-deadline-reminder.service \
  plataforma-deadline-reminder.timer; do
  install -m 644 "ops/systemd/${unit}" "/etc/systemd/system/${unit}"
done

systemctl daemon-reload
systemctl enable --now plataforma-weekly-reminder.timer plataforma-deadline-reminder.timer
systemctl list-timers 'plataforma-*-reminder.timer'
