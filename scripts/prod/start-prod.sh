#!/usr/bin/env bash
# Uruchamia Monolith z tego katalogu (worktree prod na main): w razie potrzeby instaluje zależności
# i buduje, startuje `next start`, otwiera okno Edge (--app) i po jego zamknięciu zatrzymuje serwer.
# Zmienne: MONOLITH_PORT (domyślnie 3101), MONOLITH_NO_WINDOW=1 (bez okna, serwer do Ctrl+C),
#          MONOLITH_BUILD_ONLY=1 (tylko install + build).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/prod/lib.sh
source "$ROOT/scripts/prod/lib.sh"

PORT="${MONOLITH_PORT:-3101}"
URL="http://127.0.0.1:$PORT"
PS="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
NEXT="$ROOT/node_modules/.bin/next"
cd "$ROOT" || exit 1

log() { printf '[monolith] %s\n' "$*"; }
die() {
  log "BŁĄD: $*"
  if [[ "${MONOLITH_NO_WINDOW:-0}" == "1" || "${MONOLITH_BUILD_ONLY:-0}" == "1" || ! -x "$PS" ]]; then
    read -r -n 1 -p "Naciśnij dowolny klawisz, aby zamknąć… " _ || true
  else
    # Konsola ze skrótu startuje zminimalizowana, więc błąd pokazujemy w oknie Windows.
    local msg="${*//\'/\'\'}"
    "$PS" -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.MessageBox]::Show('$msg (szczegóły w konsoli na pasku zadań)', 'Monolith', 'OK', 'Error')" || true
  fi
  exit 1
}

command -v node >/dev/null || die "brak node w PATH (skrót woła bash -lc; sprawdź ~/.profile)"

# Blokada: drugie kliknięcie ikony czeka, aż pierwsze skończy checkout/install/build/start serwera,
# a potem widzi działający serwer (state=monolith) i tylko otwiera okno.
exec 9>"$ROOT/.monolith-start.lock"
flock 9

# Worktree prod zawsze na aktualnym main (po `fetch`: merge na GitHubie bez `git pull` też trafia do ikony,
# zob. `prod_sync_ref`). Skrypt może się przy tym zmienić na dysku, więc po
# checkoutcie uruchamiamy go od nowa (bash czyta skrypty w trakcie wykonywania); fd 9 z blokadą przechodzi dalej.
if [[ -z "${MONOLITH_SYNCED:-}" ]]; then
  # Zabezpieczenie: `checkout -f` kasuje lokalne zmiany, więc tylko w worktree prod (nigdy w katalogu dev).
  [[ "$(basename "$ROOT")" == "Monolith-prod" ]] || die "start-prod.sh działa tylko w katalogu Monolith-prod (checkout -f)"
  git -C "$ROOT" checkout -q -f --detach "$(prod_sync_ref "$ROOT")" || die "git checkout main nie powiódł się"
  MONOLITH_SYNCED=1 exec bash "$ROOT/scripts/prod/start-prod.sh" "$@"
fi

# Tryb samego builda (setup-prod.sh) nie patrzy na port: ma zbudować także, gdy serwer już działa.
state="free"
if [[ "${MONOLITH_BUILD_ONLY:-0}" != "1" ]]; then
  state="$(prod_port_state "$PORT")"
  [[ "$state" == "busy" ]] && die "port $PORT jest zajęty przez inny program"
fi

SERVER_PID=""
if [[ "$state" == "free" ]]; then
  if prod_needs_install "$ROOT"; then
    log "Instaluję zależności (npm ci)…"
    npm ci --ignore-scripts || die "npm ci nie powiodło się"
    prod_mark_installed "$ROOT"
  fi

  DIST="$(prod_dist_name "$ROOT")" || die "nie mogę odczytać HEAD"
  if prod_needs_build "$ROOT"; then
    log "Buduję wersję $DIST (to potrwa)…"
    rm -rf "${ROOT:?}/$DIST"
    if NEXT_DIST_DIR="$DIST" "$NEXT" build; then
      touch "$ROOT/$DIST/.monolith-ok"
      prod_prune_dists "$ROOT" 2
    else
      rm -rf "${ROOT:?}/$DIST"
      [[ "${MONOLITH_BUILD_ONLY:-0}" == "1" ]] && die "build nie powiódł się"
      DIST="$(prod_latest_ok_dist "$ROOT")"
      [[ -n "$DIST" ]] || die "build nie powiódł się i nie ma poprzedniej wersji"
      log "OSTRZEŻENIE: build nie powiódł się, uruchamiam poprzednią wersję ($DIST)."
      log "Uwaga: node_modules i pliki worktree są już z nowego main, więc możliwy rozjazd ze starym buildem."
    fi
  fi
  [[ "${MONOLITH_BUILD_ONLY:-0}" == "1" ]] && { log "Build gotowy ($DIST)."; exit 0; }

  log "Startuję serwer: $URL"
  # 9>&-: serwer nie dziedziczy blokady (inaczej trzymałby ją przez cały czas działania)
  NEXT_DIST_DIR="$DIST" "$NEXT" start -p "$PORT" -H 127.0.0.1 9>&- &
  SERVER_PID=$!
  trap 'kill "$SERVER_PID" 2>/dev/null' EXIT

  ready=0
  for _ in $(seq 1 120); do
    kill -0 "$SERVER_PID" 2>/dev/null || die "serwer zakończył się przy starcie"
    if curl -s -o /dev/null -m 2 "$URL/dashboard"; then ready=1; break; fi
    sleep 0.5
  done
  [[ $ready -eq 1 ]] || die "serwer nie odpowiedział w 60 s"
  curl -s -o /dev/null -m 30 "$URL/api/cockpit" || true # prewarm
fi
exec 9>&- # zwolnij blokadę: kolejne kliknięcie ma tylko otworzyć okno

if [[ "${MONOLITH_NO_WINDOW:-0}" == "1" ]]; then
  log "Serwer działa: $URL (Ctrl+C kończy)"
  [[ -n "$SERVER_PID" ]] && wait "$SERVER_PID"
  exit 0
fi

log "Otwieram okno Monolith…"
LAD="$("$PS" -NoProfile -Command '[Environment]::GetFolderPath("LocalApplicationData")' | tr -d '\r')"
PROFILE_ARG="\"--user-data-dir=${LAD}\\Monolith\\edge\""
"$PS" -NoProfile -Command "Start-Process msedge -ArgumentList '--app=$URL','$PROFILE_ARG' -Wait"
log "Okno zamknięte."
# trap EXIT zatrzymuje serwer uruchomiony przez ten skrypt
