#!/usr/bin/env bash
set -Eeuo pipefail

HEALTH_URL="${1:-${DEPLOY_HEALTH_URL:-}}"
ATTEMPTS="${HEALTH_ATTEMPTS:-12}"
INTERVAL="${HEALTH_INTERVAL_SECONDS:-5}"

if [[ -z "$HEALTH_URL" ]]; then
  echo "Defina DEPLOY_HEALTH_URL ou passe o URL como primeiro argumento" >&2
  exit 2
fi

for ((attempt = 1; attempt <= ATTEMPTS; attempt += 1)); do
  if curl --fail --silent --show-error --max-time 10 "$HEALTH_URL" >/dev/null; then
    echo "Health check aprovado na tentativa ${attempt}: ${HEALTH_URL}"
    exit 0
  fi
  echo "Health check falhou (${attempt}/${ATTEMPTS}); nova tentativa em ${INTERVAL}s" >&2
  sleep "$INTERVAL"
done

echo "Health check não recuperou: ${HEALTH_URL}" >&2
exit 1
