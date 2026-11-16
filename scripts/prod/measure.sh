#!/usr/bin/env bash
# Pomiar wczytywania wersji produkcyjnej: czas builda, rozmiary tras, zimny start, TTFB.
# Buduje do .next-measure i startuje na porcie 3199, więc nie rusza dev (:3100) ani ikony (:3101).
# Użycie (z repozytorium): bash scripts/prod/measure.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

DIST=".next-measure"
PORT=3199
URL="http://127.0.0.1:$PORT"
LOG="$(mktemp)"
now_ms() { echo $(( $(date +%s%N) / 1000000 )); }

rm -rf "$DIST"
t0=$(now_ms)
if ! NEXT_DIST_DIR="$DIST" node_modules/.bin/next build >"$LOG" 2>&1; then
  echo "build nie powiódł się; koniec logu:"
  tail -20 "$LOG"
  rm -rf "$DIST" "$LOG"
  exit 1
fi
t1=$(now_ms)
echo "build: $(( (t1 - t0) / 1000 )) s"
echo "--- trasy (bez /api) ---"
sed -n '/^Route (app)/,$p' "$LOG" | grep -v ' /api/' | head -40

NEXT_DIST_DIR="$DIST" node_modules/.bin/next start -p "$PORT" -H 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null; rm -rf "$DIST" "$LOG"' EXIT

t2=$(now_ms)
until curl -s -o /dev/null -m 2 "$URL/dashboard"; do
  kill -0 "$SERVER" 2>/dev/null || { echo "serwer zakończył się przy starcie"; exit 1; }
  sleep 0.1
done
t3=$(now_ms)
echo "zimny start do pierwszej odpowiedzi /dashboard: $(( t3 - t2 )) ms"
for i in 1 2 3; do
  printf 'GET /api/cockpit #%s: %s s (TTFB)\n' "$i" \
    "$(curl -s -o /dev/null -w '%{time_starttransfer}' "$URL/api/cockpit")"
done
printf 'GET /dashboard (rozgrzany): %s s (TTFB)\n' \
  "$(curl -s -o /dev/null -w '%{time_starttransfer}' "$URL/dashboard")"
