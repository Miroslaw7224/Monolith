#!/usr/bin/env bash
# Jednorazowa instalacja ikony Monolith (uruchom z głównego katalogu Monolith PO merge'u do main):
# worktree prod na main, dowiązanie .env, npm ci, pierwszy build, skrót na pulpicie.
# Idempotentny: ponowne uruchomienie odświeża worktree, build i skrót.
set -euo pipefail

MAIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROD="$(dirname "$MAIN")/Monolith-prod"

[[ -f "$MAIN/.env" ]] || { echo "Brak $MAIN/.env (potrzebny NEXUS_VAULT_PATH)" >&2; exit 1; }
grep -q '^NEXUS_VAULT_PATH=' "$MAIN/.env" || { echo "W .env brak NEXUS_VAULT_PATH" >&2; exit 1; }

if [[ ! -e "$PROD/.git" ]]; then # nie -d: pusty katalog po przerwanym setupie też wymaga `worktree add`
  git -C "$MAIN" worktree add --detach "$PROD" main
fi
[[ -e "$PROD/.env" ]] || ln -s "$MAIN/.env" "$PROD/.env"
git -C "$PROD" checkout -q -f --detach main

MONOLITH_BUILD_ONLY=1 bash "$PROD/scripts/prod/start-prod.sh"
bash "$PROD/scripts/prod/install-shortcut.sh"
echo "Gotowe: ikona Monolith na pulpicie, katalog $PROD"
