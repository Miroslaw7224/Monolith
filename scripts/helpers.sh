#!/usr/bin/env bash
# Start i stop pomocników projektu (agy, cursor) jako nazwanych terminali herdr-core (hc).
# Nazwa terminala: <rola>-<projekt> (jak w open-agent i ask-helper.sh). Spec: docs/superpowers/specs/2026-11-19-pomocnicy-start-i-verify-design.md
#
# Użycie:
#   scripts/helpers.sh up [cursor|agy|all] [--dir KATALOG]
#   scripts/helpers.sh status
#   scripts/helpers.sh down [cursor|agy|all] [--idle-min N] [--force] [--dry-run]
#
#   up        uruchamia pomocników w tle (hc run --bg --outlive-parent; domyślnie all) i watchera watch-<projekt>;
#             idempotentne: działający pomocnik = "już działa"
#   watch     (wewnętrznie, startuje je `up`) co HELPERS_WATCH_SEC (60) s woła `down`; kończy się, gdy nie ma już pomocników projektu
#   status    tabela pomocników bieżącego projektu: nazwa, adres, status, bezczynność (min)
#   down      kończy (hc kill + hc rm) bezczynnych pomocników BIEŻĄCEGO projektu; decyzje liczy scripts/helpers-check.py
#             --idle-min N  próg bezczynności w minutach (domyślnie 10)
#             --force       pomija wyłącznie próg czasu; pracującego i czekającego na zgodę pomocnika nigdy nie zabija
#             --dry-run     tylko drukuje decyzje
#   Uwaga: hc nie wie, czy ktoś ogląda terminal (attach); pomocnik bezczynny 10+ min traci kontekst.
#
# Zmienne (testy): HELPERS_NOW_MS (zamiast date), HELPERS_ROOT (zamiast korzenia repo),
# HELPERS_WATCH_SEC, HELPERS_WATCH_RECHECK_SEC, HELPERS_WATCH_ONCE=1 (jedna iteracja watch).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/ask-helper"
DEFAULT_IDLE_MIN=10

usage() { sed -n '2,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; }
die() { echo "$*" >&2; exit 1; }

now_ms() { if [[ -n "${HELPERS_NOW_MS:-}" ]]; then echo "$HELPERS_NOW_MS"; else date +%s%3N; fi; }

# slug projektu: korzeń repo (także z worktree), małe litery, [^a-z0-9_-] -> '-'
project_slug() {
  local repo common dir="${1:-$PWD}"
  if [[ -n "${HELPERS_ROOT:-}" ]]; then
    repo="$(basename "$HELPERS_ROOT")"
  elif common="$(git -C "$dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"; then
    repo="$(basename "$(dirname "$common")")"
  else
    repo="$(basename "$dir")"
  fi
  printf '%s' "$repo" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g'
}

# Zbiera terminale pomocników (agy-*, cursor-*) z hc i drukuje wejście dla helpers-check.py (JSON).
# Aktualizuje plik stanu helpers-<slug>.json (skrót ekranu i czas jego ostatniej zmiany).
# $1 = slug, $2 = idle_min, $3 = force (0|1), $4 = rola (agy|cursor|all)
collect_json() {
  mkdir -p "$STATE_DIR"
  SLUG="$1" IDLE_MIN="$2" FORCE="$3" ROLE="$4" NOW_MS="$(now_ms)" STATE_FILE="$STATE_DIR/helpers-$1.json" \
    python3 -I - <<'PY'
import hashlib, json, os, subprocess

slug, role = os.environ["SLUG"], os.environ["ROLE"]
now = int(os.environ["NOW_MS"])
state_file = os.environ["STATE_FILE"]

def hc(*args):
    r = subprocess.run(["hc", *args], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""

def hc_json(*args):
    out = hc(*args)
    return json.loads(out) if out.strip() else {}

try:
    history = json.load(open(state_file))
except (OSError, ValueError):
    history = {}

roles = ("agy", "cursor") if role == "all" else (role,)
mine = {f"{r}-{slug}"[:32] for r in ("agy", "cursor")}
new_state, terminals = {}, []
for t in hc_json("ls", "--json").get("terminals", []):
    name = t.get("name")
    if not name or not any(name.startswith(r + "-") for r in roles):
        continue
    got = hc_json("get", t["address"])
    status = got.get("status")
    status = status.get("state") if isinstance(status, dict) else status
    screen = "\n".join(hc("read", t["address"], "--lines", "25").splitlines()[-25:])
    digest = hashlib.sha1(screen.encode()).hexdigest()
    status_ms = got.get("status_ms")
    prev = history.get(name)
    if prev and prev.get("hash") == digest:
        changed = int(prev["changed_ms"])
    elif prev:
        changed = now
    else:
        # brak historii: gdy status jest raportowany, ekran nie zmieniał się co najmniej od jego zmiany
        changed = int(status_ms) if (status and status_ms) else now
    idle_since = int(status_ms) if (status and status_ms) else changed
    if name in mine:
        new_state[name] = {"hash": digest, "changed_ms": changed}
    terminals.append({
        "address": t["address"], "name": name, "state": got.get("state", t.get("state")),
        "status": status or None, "idle_since_ms": idle_since,
        "screen_changed_ms": changed, "screen": screen,
    })

tmp = state_file + ".tmp"
with open(tmp, "w") as f:
    json.dump(new_state, f)
os.replace(tmp, state_file)
print(json.dumps({
    "now_ms": now, "idle_min": int(os.environ["IDLE_MIN"]),
    "force": os.environ["FORCE"] == "1", "slug": slug, "terminals": terminals,
}))
PY
}

cmd_status() {
  [[ $# -eq 0 ]] || die "Nieznana opcja: $1"
  local slug; slug="$(project_slug)"
  collect_json "$slug" "$DEFAULT_IDLE_MIN" 0 all | SLUG="$slug" python3 -I -c "$(cat <<'PY'
import json, os, sys
d = json.load(sys.stdin)
mine = {f"{r}-{os.environ['SLUG']}"[:32] for r in ("agy", "cursor")}
rows = [t for t in d["terminals"] if t["name"] in mine]
print(f"{'nazwa':<24}{'adres':<8}{'status':<10}bezczynność (min)")
for t in rows:
    idle = max(0, (d["now_ms"] - t["idle_since_ms"]) // 60000)
    print(f"{t['name']:<24}{t['address']:<8}{(t['status'] or '-'):<10}{idle}")
if not rows:
    print("(brak pomocników tego projektu)")
PY
)"
}

cmd_down() {
  local role=all idle_min="$DEFAULT_IDLE_MIN" force=0 dry=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      cursor|agy|all) role="$1"; shift ;;
      --idle-min) idle_min="${2:?--idle-min wymaga liczby}"; shift 2 ;;
      --force) force=1; shift ;;
      --dry-run) dry=1; shift ;;
      *) die "Nieznana opcja: $1" ;;
    esac
  done
  [[ "$idle_min" =~ ^[0-9]+$ ]] || die "--idle-min musi być liczbą całkowitą"
  local slug decisions line name
  slug="$(project_slug)"
  decisions="$(collect_json "$slug" "$idle_min" "$force" "$role" | python3 -I "$SCRIPT_DIR/helpers-check.py")"
  [[ -n "$decisions" ]] && printf '%s\n' "$decisions"
  [[ $dry -eq 1 ]] && return 0
  while IFS= read -r line; do
    [[ "$line" == KILL\ * ]] || continue
    name="${line#KILL }"
    hc kill "$name" >/dev/null 2>&1 || echo "[helpers] hc kill $name nie powiodło się" >&2
    # terminal znika z listy chwilę po kill; rm tylko dla zakończonych
    for _ in 1 2 3 4 5; do hc rm "$name" >/dev/null 2>&1 && break; sleep 0.5; done
    echo "[helpers] zakończono $name" >&2
  done <<<"$decisions"
}

# czy terminal o tej nazwie działa (state=live); `hc get` na nieistniejącym kończy się błędem
is_live() { hc get "$1" 2>/dev/null | python3 -I -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("state") == "live" else 1)' 2>/dev/null; }

# liczba działających pomocników projektu (agy-<slug>, cursor-<slug>)
count_helpers() {
  SLUG="$1" python3 -I -c "$(cat <<'PY'
import json, os, subprocess
slug = os.environ["SLUG"]
mine = {f"{r}-{slug}"[:32] for r in ("agy", "cursor")}
out = subprocess.run(["hc", "ls", "--json"], capture_output=True, text=True).stdout
terms = json.loads(out).get("terminals", []) if out.strip() else []
print(sum(1 for t in terms if t.get("name") in mine and t.get("state", "live") == "live"))
PY
)"
}

cmd_up() {
  local role=all dir="" slug name prog prog_path watch_name any_live=0 r
  while [[ $# -gt 0 ]]; do
    case "$1" in
      cursor|agy|all) role="$1"; shift ;;
      --dir) dir="${2:?--dir wymaga katalogu}"; shift 2 ;;
      *) die "Nieznana opcja lub rola: $1 (rola: cursor | agy | all)" ;;
    esac
  done
  if [[ -z "$dir" ]]; then
    dir="${HELPERS_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
  fi
  slug="$(project_slug "$dir")"
  local roles=(agy cursor); [[ "$role" == all ]] || roles=("$role")
  for r in "${roles[@]}"; do
    name="${r}-${slug}"; name="${name:0:32}"
    if is_live "$name"; then
      echo "$name już działa"; any_live=1; continue
    fi
    case "$r" in cursor) prog=cursor-agent ;; agy) prog=agy ;; esac
    # rdzeń hc ma własny PATH (bez ~/.local/bin), więc podajemy pełną ścieżkę programu
    prog_path="$(command -v "$prog")" || die "Brak programu '$prog' w PATH."
    hc run --bg --name "$name" --outlive-parent --cwd "$dir" "$prog_path" >/dev/null \
      || die "hc run nie uruchomił $name"
    echo "Uruchomiono $name"; any_live=1
  done
  # watcher: tylko gdy jest jakiś pomocnik; "nazwa zajęta" (drugi równoległy up) jest bez znaczenia
  if [[ $any_live -eq 1 ]]; then
    watch_name="watch-${slug}"; watch_name="${watch_name:0:32}"
    if ! is_live "$watch_name"; then
      hc run --bg --name "$watch_name" --outlive-parent --cwd "$dir" bash "$SCRIPT_DIR/helpers.sh" watch >/dev/null 2>&1 \
        || echo "[helpers] watcher $watch_name już istnieje albo nie wystartował (ignoruję)" >&2
    fi
  fi
}

cmd_watch() {
  local slug sec="${HELPERS_WATCH_SEC:-60}" recheck="${HELPERS_WATCH_RECHECK_SEC:-2}"
  slug="$(project_slug)"
  while :; do
    cmd_down --idle-min "$DEFAULT_IDLE_MIN" || true
    if [[ "$(count_helpers "$slug")" -eq 0 ]]; then
      # wyścig z nowym `up`: policz jeszcze raz, zanim wyjdziemy
      sleep "$recheck"
      [[ "$(count_helpers "$slug")" -eq 0 ]] && exit 0
    fi
    [[ -n "${HELPERS_WATCH_ONCE:-}" ]] && exit 0
    sleep "$sec"
  done
}

command -v hc >/dev/null || die "Brak hc w PATH"
SUB="${1:-}"; [[ $# -gt 0 ]] && shift
case "$SUB" in
  up)     cmd_up "$@" ;;
  watch)  cmd_watch "$@" ;;
  status) cmd_status "$@" ;;
  down)   cmd_down "$@" ;;
  -h|--help|"") usage; [[ -n "$SUB" ]] || exit 1 ;;
  *) usage; die "Nieznane polecenie: $SUB" ;;
esac
