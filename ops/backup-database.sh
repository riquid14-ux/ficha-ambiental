#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/plataforma-ambiental}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_ROOT}/plataforma-${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
CLIENT_FILE="$(mktemp)"

cleanup() {
  rm -f "$CLIENT_FILE"
}
trap cleanup EXIT

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL não está definida" >&2
  exit 2
fi

command -v mysqldump >/dev/null 2>&1 || {
  echo "mysqldump não está instalado" >&2
  exit 3
}

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

node --input-type=module - "$CLIENT_FILE" <<'NODE'
import fs from "node:fs";

const target = process.argv[2];
const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL em falta");

const url = new URL(raw);
if (!/^mysql:$/i.test(url.protocol)) throw new Error("DATABASE_URL deve usar mysql://");

const values = {
  host: decodeURIComponent(url.hostname),
  port: url.port || "3306",
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.replace(/^\//, "")),
};

const optionValue = value => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

for (const [key, value] of Object.entries(values)) {
  if (!value || /[\r\n]/.test(value)) throw new Error(`Valor inválido em ${key}`);
}

fs.writeFileSync(
  target,
  `[client]\nhost=${optionValue(values.host)}\nport=${optionValue(values.port)}\nuser=${optionValue(values.user)}\npassword=${optionValue(values.password)}\ndatabase=${optionValue(values.database)}\n`,
  { mode: 0o600 },
);
NODE

DATABASE_NAME="$(node --input-type=module -e 'const u=new URL(process.env.DATABASE_URL); process.stdout.write(decodeURIComponent(u.pathname.replace(/^\//, "")))')"

mysqldump \
  --defaults-extra-file="$CLIENT_FILE" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --no-tablespaces \
  --set-gtid-purged=OFF \
  "$DATABASE_NAME" | gzip -9 > "$BACKUP_FILE"

gzip -t "$BACKUP_FILE"
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"

find "$BACKUP_ROOT" -type f \( -name 'plataforma-*.sql.gz' -o -name 'plataforma-*.sql.gz.sha256' \) \
  -mtime "+${RETENTION_DAYS}" -delete

printf '%s\n' "$BACKUP_FILE"
