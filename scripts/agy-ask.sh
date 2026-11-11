#!/usr/bin/env bash
# Wysyła prompt do agenta `agy` działającego w innym panelu herdr i wypisuje odpowiedź.
# Użycie: scripts/agy-ask.sh [--timeout MS] [--target PANE_LUB_NAZWA] "prompt"
# Domyślnie szuka żywego agenta rodzaju "agy" w bieżącej sesji herdr.
set -euo pipefail

TIMEOUT=300000
TARGET="${AGY_TARGET:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --target)  TARGET="$2";  shift 2 ;;
    --) shift; break ;;
    *) break ;;
  esac
done
PROMPT="${1:?Podaj prompt jako argument}"

command -v herdr >/dev/null || { echo "Brak herdr w PATH" >&2; exit 1; }

if [[ -z "$TARGET" ]]; then
  TARGET="$(herdr agent list | python3 -c '
import json, sys
agents = json.load(sys.stdin)["result"]["agents"]
found = [a["pane_id"] for a in agents if a.get("agent") == "agy"]
print(found[0] if found else "")
')"
fi
[[ -n "$TARGET" ]] || { echo "Nie znaleziono agenta agy w herdr. Uruchom go w sąsiednim panelu (agy) i spróbuj ponownie." >&2; exit 1; }

STATUS="$(herdr agent get "$TARGET" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["agent"]["agent_status"])')"
if [[ "$STATUS" == "blocked" ]]; then
  echo "agy ($TARGET) czeka na zgodę/odpowiedź użytkownika (blocked). Zatwierdź w jego panelu i ponów." >&2
  exit 2
fi

herdr agent prompt "$TARGET" "$PROMPT" --wait --timeout "$TIMEOUT" >/dev/null

# Zwróć tylko odpowiedź na ten prompt (od ostatniego wystąpienia jego pierwszej linii).
herdr agent read "$TARGET" --source recent-unwrapped --lines 300 | PROMPT="$PROMPT" python3 -c '
import json, os, sys
raw = sys.stdin.read()
try:
    raw = json.loads(raw)["result"]["read"]["text"]
except Exception:
    pass
first = os.environ["PROMPT"].splitlines()[0][:60]
i = raw.rfind(first)
out = raw[i:] if i >= 0 else raw
lines = out.splitlines()
if i >= 0:
    # pomiń echo promptu (do pierwszej pustej linii)
    while lines and lines[0].strip():
        lines.pop(0)
# odetnij pusty prompt i stopkę na końcu
while lines and (not lines[-1].strip() or set(lines[-1].strip()) <= set("─> ") or "for shortcuts" in lines[-1]):
    lines.pop()
print("\n".join(lines).strip())
'
