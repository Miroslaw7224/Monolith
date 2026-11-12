#!/usr/bin/env bash
# Wysyła prompt do agenta-pomocnika (agy / cursor) działającego w terminalu herdr-core (hc)
# i wypisuje jego odpowiedź. Claude Code jest głównym wykonawcą; pomocnicy doradzają,
# weryfikują i robią drobne prace.
#
# Użycie: scripts/ask-helper.sh [--role review|advice|task] [--timeout S] [--target tN] <agy|cursor> "prompt"
#   --role review|advice  (domyślnie) pomocnik NIE modyfikuje plików, tylko odpowiada
#   --role task           pomocnik może edytować pliki (drobne prace wskazane w prompcie)
#   --timeout S           maks. czas oczekiwania w sekundach (domyślnie 300)
#   --target tN           wymuś adres terminala hc zamiast autodetekcji
#   --max-lines N         utnij odpowiedź do N linii (domyślnie 40; 0 = bez limitu) - oszczędza tokeny Claude
#   --fresh               wyczyść rozmowę pomocnika (/clear) przed zadaniem
#   --keep                nie czyść (dopytanie / kontynuacja poprzedniego zadania)
#   (domyślnie auto: /clear przy --role review, co CLEAR_EVERY=5 zadań lub gdy kontekst >= CLEAR_PCT=40 %)
#   --tier light|deep|none  model pomocnika: light = tani/szybki (agy: Gemini Flash, cursor: Composer),
#                         deep = mocniejszy (agy: Gemini Argon, cursor: Auto), none = nie zmieniaj.
#                         Domyślnie auto: review -> deep, advice/task -> light.
# Kody wyjścia: 0 ok, 1 błąd/nie znaleziono, 2 pomocnik czeka na zgodę (blocked), 3 timeout.
set -euo pipefail

ROLE=advice; TIMEOUT=300; TARGET=""; MAXLINES=40; CLEAR_MODE=auto; TIER=auto
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier)    TIER="$2"; shift 2 ;;
    --fresh)   CLEAR_MODE=fresh; shift ;;
    --keep)    CLEAR_MODE=keep; shift ;;
    --role)    ROLE="$2"; shift 2 ;;
    --max-lines) MAXLINES="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --target)  TARGET="$2"; shift 2 ;;
    --) shift; break ;;
    -*) echo "Nieznana opcja: $1" >&2; exit 1 ;;
    *) break ;;
  esac
done
WHO="${1:?Podaj pomocnika: agy lub cursor}"; PROMPT="${2:?Podaj prompt}"
case "$WHO" in agy|cursor) ;; *) echo "Pomocnik musi być: agy | cursor" >&2; exit 1 ;; esac
case "$ROLE" in review|advice|task) ;; *) echo "Rola musi być: review | advice | task" >&2; exit 1 ;; esac

export HC_SOCKET="${HC_SOCKET:-$HOME/.local/state/herdr-core/default/default.sock}"
command -v hc >/dev/null || { echo "Brak hc w PATH" >&2; exit 1; }

# --- znajdź terminal pomocnika ---
if [[ -z "$TARGET" ]]; then
  TARGET="$(WHO="$WHO" python3 -I - <<'PY'
import json, os, subprocess
who = os.environ["WHO"]
def hc(*a):
    return json.loads(subprocess.run(["hc", *a], capture_output=True, text=True).stdout or "{}")
for t in hc("ls").get("terminals", []):
    if who == "agy" and t.get("agent") == "antigravity":
        print(t["address"]); break
    if who == "cursor" and "cursor" in (t.get("agent") or ""):
        print(t["address"]); break
    if who == "cursor":
        info = hc("get", t["address"])
        argv = " ".join((info.get("foreground") or {}).get("argv", []))
        if "cursor-agent" in argv:
            print(t["address"]); break
PY
)"
fi
[[ -n "$TARGET" ]] || { echo "Nie znaleziono terminala dla '$WHO' w hc. Uruchom go w workspace hc i spróbuj ponownie." >&2; exit 1; }

STATUS="$(hc get "$TARGET" | python3 -I -c 'import json,sys; s=json.load(sys.stdin).get("status"); print((s.get("state") if isinstance(s,dict) else s) or "")' 2>/dev/null || true)"
APPROVAL_RE="Requesting permission|Allow this|Run this command\?|\(y/n\)"
if [[ "$STATUS" == "blocked" ]] || hc read "$TARGET" 2>/dev/null | tail -n 25 | grep -qiE "$APPROVAL_RE"; then
  echo "$WHO ($TARGET) czeka na zgodę użytkownika (blocked). Zatwierdź w jego panelu i ponów." >&2
  exit 2
fi

# --- polityka czyszczenia kontekstu pomocnika (/clear przed zadaniem) ---
# auto: czyść przy --role review (niezależna opinia), co CLEAR_EVERY zadań
#       albo gdy pasek pokazuje zajętość kontekstu >= CLEAR_PCT % (Cursor: "Auto · 6%")
CLEAR_EVERY="${CLEAR_EVERY:-5}"; CLEAR_PCT="${CLEAR_PCT:-40}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/ask-helper"; mkdir -p "$STATE_DIR"
COUNT_FILE="$STATE_DIR/$WHO-$TARGET.count"
count="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
pct="$(hc read "$TARGET" 2>/dev/null | tail -n 6 | grep -oE '· *[0-9]+(\.[0-9]+)?%' | grep -oE '[0-9]+' | head -1 || true)"
do_clear=0; why=""
case "$CLEAR_MODE" in
  fresh) do_clear=1; why="--fresh" ;;
  keep)  do_clear=0 ;;
  auto)
    if [[ "$ROLE" == "review" ]]; then do_clear=1; why="review"
    elif [[ "$count" -ge "$CLEAR_EVERY" ]]; then do_clear=1; why="$count zadań"
    elif [[ -n "$pct" && "$pct" -ge "$CLEAR_PCT" ]]; then do_clear=1; why="kontekst ${pct}%"
    fi ;;
esac
if [[ $do_clear -eq 1 ]]; then
  hc send "$TARGET" "/clear" >/dev/null
  sleep 3
  echo "[ask-helper] /clear w $WHO ($why)" >&2
  count=0
fi
echo $((count + 1)) > "$COUNT_FILE"

# --- poziom modelu pomocnika (/model <id> tylko gdy pasek pokazuje inny) ---
# auto: review -> deep, advice/task -> light. Modele można nadpisać zmiennymi środowiskowymi.
AGY_LIGHT="${AGY_LIGHT:-gemini-3.8-flash-medium}";   AGY_LIGHT_TAG="${AGY_LIGHT_TAG:-Flash}"
AGY_DEEP="${AGY_DEEP:-gemini-4-argon-medium}";       AGY_DEEP_TAG="${AGY_DEEP_TAG:-Argon}"
CURSOR_LIGHT="${CURSOR_LIGHT:-composer-2.5}";        CURSOR_LIGHT_TAG="${CURSOR_LIGHT_TAG:-Composer}"
CURSOR_DEEP="${CURSOR_DEEP:-auto}";                  CURSOR_DEEP_TAG="${CURSOR_DEEP_TAG:-Auto}"
if [[ "$TIER" == "auto" ]]; then [[ "$ROLE" == "review" ]] && TIER=deep || TIER=light; fi
if [[ "$TIER" != "none" ]]; then
  key="$(tr a-z A-Z <<<"${WHO}_${TIER}")"; model_var="$key"; tag_var="${key}_TAG"
  model="${!model_var}"; tag="${!tag_var}"
  if ! hc read "$TARGET" 2>/dev/null | tail -n 6 | grep -q "$tag"; then
    hc send "$TARGET" "/model $model" >/dev/null
    sleep 3
    echo "[ask-helper] /model $model w $WHO ($TIER)" >&2
  fi
fi

# --- zbuduj prompt ---
NONCE="ref:$(head -c6 /dev/urandom | od -An -tx1 | tr -d ' \n')"
if [[ "$ROLE" == "task" ]]; then
  PREFIX="[Rola: pomocnik Claude Code. Wykonaj dokładnie opisane drobne zadanie, nie wychodź poza wskazane pliki, nie rób git commit/push.]"
else
  PREFIX="[Rola: doradca/weryfikator Claude Code. Tryb tylko do odczytu: czytaj pliki i diffy (cat, grep, ls, git show/diff/log). Nie uruchamiaj kodu ani testów (node, npx, tsx, ts-node, vitest, npm), nie twórz skryptów ani plików tymczasowych, nie modyfikuj żadnych plików. Wnioski wyciągaj z czytania kodu; jeśli czegoś nie da się stwierdzić bez uruchomienia, napisz to w odpowiedzi zamiast uruchamiać. Odpowiadaj zwięźle i konkretnie, wskaż pliki/linie.]"
fi
BREVITY="[Format: końcową odpowiedź zacznij od osobnej linii === WYNIK === ; potem maks. 15 linii, tylko wnioski i ścieżki:linie, bez wstępów.]"
FULL="$PREFIX $BREVITY $PROMPT ($NONCE)"

hc send "$TARGET" "$FULL" >/dev/null

# --- czekaj na koniec tury: ekran stabilny przez kilka odczytów ---
deadline=$(( $(date +%s) + TIMEOUT ))
prev=""; stable=0; started=$(date +%s); seen_working=""; sleep 3
while :; do
  cur="$(hc read "$TARGET" 2>/dev/null || true)"
  st="$(hc get "$TARGET" | python3 -I -c 'import json,sys; s=json.load(sys.stdin).get("status"); print((s.get("state") if isinstance(s,dict) else s) or "")' 2>/dev/null || true)"
  if [[ "$st" == "blocked" ]]; then
    echo "$WHO ($TARGET) zablokował się na prośbie o zgodę. Zatwierdź w jego panelu." >&2
    exit 2
  fi
  # prośba o zgodę widoczna na ekranie (agent nie zawsze raportuje 'blocked')
  if tail -n 25 <<<"$cur" | grep -qiE "Requesting permission|Allow this|Run this command\?|\(y/n\)"; then
    echo "$WHO ($TARGET) czeka na zgodę użytkownika w swoim panelu. Zatwierdź/odrzuć i ponów." >&2
    exit 2
  fi
  if [[ -n "$st" ]]; then
    # agent raportuje stan: koniec dopiero przy idle/done (po starcie tury)
    [[ "$st" == "working" ]] && seen_working=1
    # status z poprzedniej tury: czekaj na 'working', chyba że minęło 20 s (bardzo szybka odpowiedź)
    if [[ -n "${seen_working:-}" || $(( $(date +%s) - started )) -ge 20 ]]; then
      [[ "$st" == "idle" || "$st" == "done" ]] && stable=$((stable+1)) || stable=0
      [[ $stable -ge 2 ]] && break
    fi
  else
    # agent bez raportów (np. cursor): koniec, gdy ekran stabilny przez kilka odczytów
    if [[ "$cur" == "$prev" ]]; then stable=$((stable+1)); else stable=0; fi
    [[ $stable -ge 3 ]] && break
  fi
  prev="$cur"
  if [[ $(date +%s) -ge $deadline ]]; then echo "Timeout (${TIMEOUT}s) czekając na $WHO." >&2; exit 3; fi
  sleep 2
done

# --- wypisz tylko odpowiedź (po linii z nonce) ---
NONCE="$NONCE" MAXLINES="$MAXLINES" python3 -I -c '
import os, re, sys
text = sys.stdin.read()
lines = text.splitlines()
nonce = os.environ["NONCE"]
# pierwsze wystąpienie nonce = koniec echa promptu (pomocnik bywa, że powtarza nonce na końcu odpowiedzi)
idx = next((i for i, l in enumerate(lines) if nonce in l), -1)
lines = lines[idx + 1:] if idx >= 0 else lines
mark = max((i for i, l in enumerate(lines) if "=== WYNIK ===" in l), default=-1)
if mark >= 0:
    lines = lines[mark + 1:]
# usuń powtórzony nonce z treści odpowiedzi
lines = [re.sub(r"\s*\(?" + re.escape(nonce) + r"\)?", "", l) for l in lines]
def footer(l):
    s = l.strip()
    return (not s or set(s) <= set("─▄▀> →-") or "for shortcuts" in s
            or "Add a follow-up" in s or "esc to cancel" in s
            or s.startswith("Auto") or s.startswith("~/")
            or re.search(r"·\s*[\d.]+%(\s*·.*)?$", s) is not None
            or re.search(r"·\s*(low|medium|high)\s*$", s) is not None)
while lines and footer(lines[-1]): lines.pop()
while lines and not lines[0].strip(): lines.pop(0)
limit = int(os.environ.get("MAXLINES") or 0)
if limit and len(lines) > limit:
    cut = len(lines) - limit
    lines = lines[:limit] + [f"[ucięto {cut} linii; pełna odpowiedź: hc read <terminal> albo --max-lines 0]"]
print("\n".join(lines))
' <<<"$cur"
