#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY="${GITHUB_REPOSITORY:-${1:-}}"
CONFIRMATION="${2:-}"

if [[ -z "$REPOSITORY" || ! "$REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Uso: GITHUB_REPOSITORY=owner/repo $0 owner/repo --confirm" >&2
  exit 2
fi
if [[ "$CONFIRMATION" != "--confirm" ]]; then
  cat >&2 <<EOF
Este comando protege o branch main de $REPOSITORY e pode impedir pushes directos.
Execute novamente com --confirm apenas depois de o workflow CI ter corrido e existir o check 'verify'.
EOF
  exit 3
fi

command -v gh >/dev/null 2>&1 || { echo "GitHub CLI não está instalado" >&2; exit 4; }
gh auth status >/dev/null

PAYLOAD="$(mktemp)"
trap 'rm -f "$PAYLOAD"' EXIT
cat > "$PAYLOAD" <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["verify"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/${REPOSITORY}/branches/main/protection" \
  --input "$PAYLOAD"

echo "Branch main protegido em $REPOSITORY"
