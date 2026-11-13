#!/usr/bin/env bash
# Wysyła /clear do agentów-pomocników (cursor, agy/antigravity) działających w sesji herdr.
# Podpięte pod skrót prefix+shift+c w ~/.config/herdr/config.toml.
# Użycie: scripts/clear-helpers.sh [cursor|agy|all]   (domyślnie all)
set -euo pipefail

WHO="${1:-all}"
case "$WHO" in cursor|agy|all) ;; *) echo "Użycie: $0 [cursor|agy|all]" >&2; exit 1 ;; esac

command -v herdr >/dev/null || { echo "Brak herdr w PATH" >&2; exit 1; }

# Adresy (pane_id) agentów, którzy pasują do WHO.
targets="$(WHO="$WHO" python3 -I -c '
import json, os, subprocess, sys
who = os.environ["WHO"]
want = {"cursor": ("cursor",), "agy": ("antigravity", "agy"), "all": ("cursor", "antigravity", "agy")}[who]
out = subprocess.run(["herdr", "agent", "list"], capture_output=True, text=True).stdout
for a in json.loads(out or "{}").get("result", {}).get("agents", []):
    kind = " ".join(str(a.get(k) or "") for k in ("agent", "kind", "display_agent", "name")).lower()
    pane = a.get("pane_id") or a.get("name") or a.get("id")
    if pane and any(w in kind for w in want):
        print(pane)
')"

[[ -n "$targets" ]] || { echo "Brak agentów ($WHO) w sesji herdr." >&2; exit 1; }

while IFS= read -r t; do
  herdr agent prompt "$t" "/clear" >/dev/null && echo "/clear -> $t"
done <<<"$targets"
