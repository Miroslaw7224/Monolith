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
