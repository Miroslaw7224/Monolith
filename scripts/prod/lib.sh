#!/usr/bin/env bash
# Funkcje pomocnicze start-prod.sh (do `source`). Wczytanie pliku nie ma skutków ubocznych.

# Nazwa katalogu builda dla bieżącego commita: .next-<12 znaków HEAD>.
prod_dist_name() {
  local head
  head="$(git -C "$1" rev-parse HEAD)" || return 1
  echo ".next-${head:0:12}"
}

# Kod 0, gdy build dla bieżącego commita jest potrzebny (brak znacznika .monolith-ok).
prod_needs_build() {
  local dist
  dist="$(prod_dist_name "$1")" || return 0
  [[ ! -f "$1/$dist/.monolith-ok" ]]
}

# Nazwa najnowszego udanego katalogu .next-* (wg mtime znacznika) albo pusty wynik.
prod_latest_ok_dist() {
  local marker
  marker="$(ls -1t "$1"/.next-*/.monolith-ok 2>/dev/null | head -n 1)"
  [[ -n "$marker" ]] || return 0
  basename "$(dirname "$marker")"
}

# Zostawia <n> najnowszych udanych katalogów .next-*, usuwa resztę (także nieudane).
prod_prune_dists() {
  local root="$1" keep="$2" marker d i keepit
  local -a ok=()
  while IFS= read -r marker; do
    ok+=("$(basename "$(dirname "$marker")")")
  done < <(ls -1t "$root"/.next-*/.monolith-ok 2>/dev/null)
  for d in "$root"/.next-*/; do
    [[ -d "$d" ]] || continue
    d="$(basename "$d")"
    keepit=0
    for ((i = 0; i < keep && i < ${#ok[@]}; i++)); do
      [[ "${ok[$i]}" == "$d" ]] && keepit=1
    done
    [[ $keepit -eq 1 ]] || rm -rf "${root:?}/$d"
  done
  return 0
}

prod_lock_hash() { sha1sum "$1/package-lock.json" | cut -d' ' -f1; }

# Kod 0, gdy trzeba zrobić `npm ci` (brak oznaczenia albo zmienił się package-lock.json).
prod_needs_install() {
  local f="$1/node_modules/.monolith-lock-hash"
  [[ ! -f "$f" ]] || [[ "$(cat "$f")" != "$(prod_lock_hash "$1")" ]]
}

# Zapisuje hash package-lock.json po udanym `npm ci`.
prod_mark_installed() { prod_lock_hash "$1" >"$1/node_modules/.monolith-lock-hash"; }

# free | monolith | busy dla 127.0.0.1:<port>.
prod_port_state() {
  local port="$1" body rc=0
  body="$(curl -s -m 3 "http://127.0.0.1:$port/dashboard")" || rc=$?
  case "$rc" in
    0) if [[ "$body" == *"<title>Monolith"* ]]; then echo monolith; else echo busy; fi ;;
    7) echo free ;;
    *) echo busy ;;
  esac
}

# Ref, z którego ma działać prod. Najpierw `git fetch origin main` (limit 10 s, bez pytań o hasło;
# brak sieci albo origin nie przeszkadza), potem `origin/main`, gdy lokalny `main` jest jego przodkiem
# (merge na GitHubie bez `git pull`), a w pozostałych przypadkach lokalny `main` (np. commity tylko lokalne).
prod_sync_ref() {
  local root="$1"
  GIT_TERMINAL_PROMPT=0 timeout 10 git -C "$root" fetch -q origin main 2>/dev/null || true
  if git -C "$root" rev-parse -q --verify refs/remotes/origin/main >/dev/null 2>&1 &&
    git -C "$root" merge-base --is-ancestor main origin/main 2>/dev/null; then
    echo origin/main
  else
    echo main
  fi
}

# PID procesu nasłuchującego na porcie <port> (pierwszy) albo pusty wynik.
prod_listener_pid() {
  ss -ltnpH sport = ":$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -n 1 | cut -d= -f2
}

# Kod 0, gdy <pid> to `next-server` uruchomiony z katalogu <root> (nigdy cudzy proces ani inny katalog).
prod_is_own_server() {
  local root="$1" pid="$2" title
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  [[ "/proc/$pid/cwd" -ef "$root" ]] || return 1
  title="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null)" || return 1
  [[ "$title" == next-server* ]]
}

# Katalog builda, z którego działa proces <pid> (NEXT_DIST_DIR z jego środowiska) albo pusty wynik.
prod_running_dist() {
  tr '\0' '\n' <"/proc/$1/environ" 2>/dev/null | sed -n 's/^NEXT_DIST_DIR=//p' | head -n 1
}

# Zatrzymuje serwer na <port>, gdy jest NASZ (`prod_is_own_server`) i działa z innego builda niż <dist>.
# Tylko SIGTERM, czeka do 10 s, nigdy SIGKILL. Kody: 0 zatrzymano, 1 nic do zrobienia
# (port wolny, cudzy proces albo aktualny build), 2 nie udało się zatrzymać w 10 s.
prod_stop_stale() {
  local root="$1" port="$2" dist="$3" pid running i
  pid="$(prod_listener_pid "$port")"
  [[ -n "$pid" ]] || return 1
  prod_is_own_server "$root" "$pid" || return 1
  running="$(prod_running_dist "$pid")"
  [[ -n "$running" && "$running" != "$dist" ]] || return 1
  kill "$pid" 2>/dev/null || return 1
  for i in $(seq 1 50); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.2
  done
  return 2
}
