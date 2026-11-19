#!/usr/bin/env bash
# Wysyła prompt do agenta-pomocnika (agy / cursor) działającego w terminalu herdr-core (hc)
# i wypisuje jego odpowiedź. Claude Code jest głównym wykonawcą; pomocnicy doradzają,
# weryfikują i robią drobne prace.
#
# Użycie: scripts/ask-helper.sh [--role review|advice|task] [--timeout S] [--target tN] <agy|cursor> "prompt"
#         scripts/ask-helper.sh --collect [--timeout S] [--target tN] <agy|cursor>
#   --role review|advice  (domyślnie) pomocnik NIE modyfikuje plików, tylko odpowiada
#   --role task           pomocnik może edytować pliki (drobne prace wskazane w prompcie)
#   --timeout S           maks. czas oczekiwania w sekundach (domyślnie 300)
#   --target tN           wymuś adres terminala hc zamiast autodetekcji
#   --max-lines N         utnij odpowiedź do N linii (domyślnie 40; 0 = bez limitu) - oszczędza tokeny Claude
#   --fresh               wyczyść rozmowę pomocnika (/clear) przed zadaniem
#   --keep                nie czyść (dopytanie / kontynuacja poprzedniego zadania)
#   (domyślnie auto: /clear przy --role review, co CLEAR_EVERY=5 zadań lub gdy kontekst >= CLEAR_PCT=40 %)
#   --approve-allowed     zatwierdzaj (jednorazowo, klawisz y) dialogi "Run this command?" WYŁĄCZNIE dla poleceń z listy zgód z CLAUDE.md
#                         (npx tsc --noEmit, npx vitest run [ścieżki], npm run lint, npm run build; opcjonalnie `cd <Monolith> && ` i ` 2>&1`);
#                         decyzję podejmuje scripts/approve-check.py; wszystko inne kończy się kodem 2. Log: $STATE_DIR/approvals.log
#   --tier light|deep|none  model pomocnika: light = tani/szybki (agy: Gemini Flash, cursor: Composer),
#                         deep = mocniejszy (agy: Gemini Argon, cursor: Auto), none = nie zmieniaj.
#                         Domyślnie auto: review -> deep, advice/task -> light.
#   --collect             nie wysyła promptu: czeka na wynik OSTATNIEGO zadania (nonce z $STATE_DIR/last-<nazwa>.json) i wypisuje go.
#                         Po kodzie 3 wywołuj --collect ponownie (nigdy nie wysyłaj tego samego zadania drugi raz). Skrypt sam zlicza próby:
#                         po trzech próbach, przy spokojnym ekranie, wysyła raz zapytanie kontrolne o wynik; potem kod 4 (raport).
#                         Decyzje: scripts/collect-decide.py (spec 3.8).
# Kody wyjścia: 0 ok, 1 błąd/nie znaleziono, 2 pomocnik czeka na zgodę (blocked), 3 timeout (przy --collect: wywołaj ponownie),
#               4 (tylko --collect) pomocnik nie odpowiedział nawet na zapytanie kontrolne: raport z ostatnich linii panelu.
set -euo pipefail

COLLECT=0; ROLE=advice; TIMEOUT=300; TARGET=""; MAXLINES=40; CLEAR_MODE=auto; TIER=auto; APPROVE=0; MAX_APPROVALS="${MAX_APPROVALS:-20}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier)    TIER="$2"; shift 2 ;;
    --collect) COLLECT=1; shift ;;
    --approve-allowed) APPROVE=1; shift ;;
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
WHO="${1:?Podaj pomocnika: agy lub cursor}"
if [[ $COLLECT -eq 1 ]]; then PROMPT=""; else PROMPT="${2:?Podaj prompt}"; fi
case "$WHO" in agy|cursor) ;; *) echo "Pomocnik musi być: agy | cursor" >&2; exit 1 ;; esac
case "$ROLE" in review|advice|task) ;; *) echo "Rola musi być: review | advice | task" >&2; exit 1 ;; esac

# Gniazda core nie ustawiamy na sztywno: położenie zależy od XDG_RUNTIME_DIR i zmienia się po restarcie core.
# hc sam znajduje właściwe (HC_TERMINAL_SOCKET w terminalu hc); HC_SOCKET z otoczenia nadal działa jako nadpisanie.
# dialog polecenia na ekranie (bez pipe'ów: `set -o pipefail` + `grep -q` bywa zwodnicze)
has_run_dialog() { local tail25; tail25="$(tail -n 25 <<<"$1")"; [[ "$tail25" == *"Run this command?"* ]]; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
command -v hc >/dev/null || { echo "Brak hc w PATH" >&2; exit 1; }
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/ask-helper"; mkdir -p "$STATE_DIR"
START_WAIT="${ASK_HELPER_START_WAIT:-3}"; POLL_SEC="${ASK_HELPER_POLL_SEC:-2}"  # testy skracają czekanie

# --- znajdź terminal pomocnika ---
if [[ -z "$TARGET" ]]; then
  # Tylko pomocnik z PROJEKTU wołającego (katalog roboczy skryptu), nigdy z cudzego repozytorium:
  # 1) terminal o nazwie <pomocnik>-<projekt> (open-agent, start-workspace z ~/.local/bin),
  # 2) inaczej terminal tego pomocnika, którego cwd należy do tego samego repozytorium (panele bez nazwy).
  TARGET="$(WHO="$WHO" CALLER_DIR="$PWD" python3 -I - <<'PY'
import json, os, re, subprocess
who, caller = os.environ["WHO"], os.environ["CALLER_DIR"]
def hc(*a):
    return json.loads(subprocess.run(["hc", *a], capture_output=True, text=True).stdout or "{}")
def repo(path):
    r = subprocess.run(["git", "-C", path, "rev-parse", "--path-format=absolute", "--git-common-dir"],
                       capture_output=True, text=True)
    return os.path.dirname(r.stdout.strip()) if r.returncode == 0 and r.stdout.strip() else os.path.realpath(path)
root = repo(caller)
slug = re.sub(r"[^a-z0-9_-]", "-", os.path.basename(root).lower())
name = f"{who}-{slug}"[:32]
terms = hc("ls").get("terminals", [])
for t in terms:
    if hc("get", t["address"]).get("name") == name:
        print(t["address"]); raise SystemExit
for t in terms:
    if repo(t.get("cwd") or "/") != root:
        continue
    if who == "agy" and t.get("agent") == "antigravity":
        print(t["address"]); break
    if who == "cursor":
        if "cursor" in (t.get("agent") or ""):
            print(t["address"]); break
        argv = " ".join((hc("get", t["address"]).get("foreground") or {}).get("argv", []))
        if "cursor-agent" in argv:
            print(t["address"]); break
PY
)"
fi
[[ -n "$TARGET" ]] || { echo "Nie znaleziono terminala '$WHO' dla projektu w $PWD. Uruchom go: scripts/helpers.sh up $WHO (albo open-agent $WHO w panelu w katalogu projektu) lub podaj --target tN." >&2; exit 1; }

# plik ostatniego zadania (dla --collect): last-<nazwa terminala albo adres>.json
TNAME="$(hc get "$TARGET" 2>/dev/null | python3 -I -c 'import json,sys; print(json.load(sys.stdin).get("name") or "")' 2>/dev/null || true)"
LAST_FILE="$STATE_DIR/last-${TNAME:-$TARGET}.json"
last_update() { # klucz=wartość-JSON ...
  LAST_FILE="$LAST_FILE" python3 -I -c 'import json, os, sys
p = os.environ["LAST_FILE"]
try:
    d = json.load(open(p))
except (OSError, ValueError):
    d = {}
for kv in sys.argv[1:]:
    k, _, v = kv.partition("=")
    d[k] = json.loads(v)
tmp = p + ".tmp"
json.dump(d, open(tmp, "w"))
os.replace(tmp, p)' "$@"
}
last_get() { # klucz -> wartość (napisy bez cudzysłowów)
  LAST_FILE="$LAST_FILE" python3 -I -c 'import json, os, sys
try:
    v = json.load(open(os.environ["LAST_FILE"])).get(sys.argv[1], "")
except (OSError, ValueError):
    v = ""
print(v if isinstance(v, str) else json.dumps(v))' "$1"
}

STATUS="$(hc get "$TARGET" | python3 -I -c 'import json,sys; s=json.load(sys.stdin).get("status"); print((s.get("state") if isinstance(s,dict) else s) or "")' 2>/dev/null || true)"
APPROVAL_RE="Requesting permission|Allow this|Run this command\?|\(y/n\)"
if [[ "$STATUS" == "blocked" ]] || hc read "$TARGET" 2>/dev/null | tail -n 25 | grep -qiE "$APPROVAL_RE"; then
  echo "$WHO ($TARGET) czeka na zgodę użytkownika (blocked). Zatwierdź w jego panelu i ponów." >&2
  exit 2
fi

if [[ $COLLECT -eq 1 ]]; then
  [[ -f "$LAST_FILE" && "$(last_get target)" == "$TARGET" ]] || { echo "brak zadania do odebrania dla $WHO ($TARGET): najpierw zleć zadanie bez --collect." >&2; exit 1; }
  NONCE="$(last_get nonce)"; COLLECTS0="$(last_get collects)"; NUDGED="$(last_get nudged)"
  cur0="$(hc read --lines 500 "$TARGET" 2>/dev/null || true)"
  grep -qF -- "$NONCE" <<<"$cur0" || { echo "wynik niedostępny na ekranie ($NONCE nie występuje; po /clear zadanie trzeba zlecić ponownie)." >&2; exit 1; }
else
# --- polityka czyszczenia kontekstu pomocnika (/clear przed zadaniem) ---
# auto: czyść przy --role review (niezależna opinia), co CLEAR_EVERY zadań
#       albo gdy pasek pokazuje zajętość kontekstu >= CLEAR_PCT % (Cursor: "Auto · 6%")
CLEAR_EVERY="${CLEAR_EVERY:-5}"; CLEAR_PCT="${CLEAR_PCT:-40}"
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
# agy: `hc send` opakowuje tekst w <hc from=...>, więc agy traktuje "/clear" i "/model" jako zwykłą wiadomość do LLM
# (nic się nie zmienia, a model "potwierdza" zmianę z głowy). Komendy slash wpisujemy więc klawiszami (`hc keys`).
keys_text() { # litery, cyfry, spacje i "/" jako osobne klawisze
  local s="$1" i c; local -a out=()
  for ((i = 0; i < ${#s}; i++)); do c="${s:i:1}"; [[ "$c" == " " ]] && out+=(space) || out+=("$c"); done
  hc keys "$TARGET" "${out[@]}" >/dev/null
}
if [[ $do_clear -eq 1 ]]; then
  if [[ "$WHO" == "agy" ]]; then
    keys_text "/clear"; sleep 1; hc keys "$TARGET" enter >/dev/null
  else
    hc send "$TARGET" "/clear" >/dev/null
  fi
  sleep 3
  echo "[ask-helper] /clear w $WHO ($why)" >&2
  count=0
fi
echo $((count + 1)) > "$COUNT_FILE"

# --- poziom modelu pomocnika (/model <id> tylko gdy pasek pokazuje inny) ---
# auto: review -> deep, advice/task -> light. Modele można nadpisać zmiennymi środowiskowymi.
# Dla agy liczy się *_TAG (małymi literami wpisywany w wyszukiwarkę pickera, np. Argon, Opus, Flash); *_LIGHT/*_DEEP to ID tylko dla cursora.
AGY_LIGHT="${AGY_LIGHT:-gemini-3.8-flash-medium}";   AGY_LIGHT_TAG="${AGY_LIGHT_TAG:-Flash}"
AGY_DEEP="${AGY_DEEP:-gemini-4-argon-medium}";       AGY_DEEP_TAG="${AGY_DEEP_TAG:-Argon}"
CURSOR_LIGHT="${CURSOR_LIGHT:-composer-2.5}";        CURSOR_LIGHT_TAG="${CURSOR_LIGHT_TAG:-Composer}"
CURSOR_DEEP="${CURSOR_DEEP:-auto}";                  CURSOR_DEEP_TAG="${CURSOR_DEEP_TAG:-Auto}"
if [[ "$TIER" == "auto" ]]; then [[ "$ROLE" == "review" ]] && TIER=deep || TIER=light; fi
if [[ "$TIER" != "none" ]]; then
  key="$(tr a-z A-Z <<<"${WHO}_${TIER}")"; model_var="$key"; tag_var="${key}_TAG"
  model="${!model_var}"; tag="${!tag_var}"
  if ! hc read "$TARGET" 2>/dev/null | tail -n 6 | grep -q "$tag"; then
    if [[ "$WHO" == "agy" ]]; then
      # picker /model: wyszukiwarka filtruje po nazwie, pierwsza pozycja jest zaznaczona; effort zostaje bez zmian
      keys_text "/model"; sleep 1; hc keys "$TARGET" enter >/dev/null; sleep 1
      keys_text "$(tr A-Z a-z <<<"$tag")"; sleep 1; hc keys "$TARGET" enter >/dev/null
    else
      hc send "$TARGET" "/model $model" >/dev/null
    fi
    sleep 3
    echo "[ask-helper] /model $model w $WHO ($TIER)" >&2
    hc read "$TARGET" 2>/dev/null | tail -n 6 | grep -q "$tag" \
      || echo "[ask-helper] UWAGA: pasek $WHO nie pokazuje '$tag'; model mógł się nie zmienić" >&2
  fi
fi

# --- zbuduj prompt ---
NONCE="ref:$(head -c6 /dev/urandom | od -An -tx1 | tr -d ' \n')"
if [[ "$ROLE" == "task" ]]; then
  PREFIX="[Rola: pomocnik Claude Code. Wykonaj dokładnie opisane drobne zadanie, nie wychodź poza wskazane pliki, nie rób git commit/push. Katalog roboczy to już Monolith: uruchamiaj polecenia bez prefiksu cd (np. samo npx tsc --noEmit), bo złożone cd … && … wymusza dodatkowe zgody.]"
else
  PREFIX="[Rola: doradca/weryfikator Claude Code. Tryb tylko do odczytu: czytaj pliki i diffy (cat, grep, ls, git show/diff/log). Nie uruchamiaj kodu ani testów (node, npx, tsx, ts-node, vitest, npm), nie twórz skryptów ani plików tymczasowych, nie modyfikuj żadnych plików. Wnioski wyciągaj z czytania kodu; jeśli czegoś nie da się stwierdzić bez uruchomienia, napisz to w odpowiedzi zamiast uruchamiać. Odpowiadaj zwięźle i konkretnie, wskaż pliki/linie.]"
fi
BREVITY="[Format: końcową odpowiedź zacznij od osobnej linii === WYNIK === ; potem maks. 15 linii, tylko wnioski i ścieżki:linie, bez wstępów.]"
FULL="$PREFIX $BREVITY $PROMPT ($NONCE)"

hc send "$TARGET" "$FULL" >/dev/null
last_update target="\"$TARGET\"" nonce="\"$NONCE\"" sent_ms="$(date +%s%3N)" role="\"$ROLE\"" collects=0 nudged=false screen_hash='""'
fi

# --- czekaj na koniec tury: ekran stabilny przez kilka odczytów ---
deadline=$(( $(date +%s) + TIMEOUT ))
prev=""; stable=0; started=$(date +%s); seen_working=""; approvals=0; sleep "$START_WAIT"
while :; do
  cur="$(hc read --lines 500 "$TARGET" 2>/dev/null || true)"
  # --approve-allowed: dialog polecenia z listy zgód zatwierdzamy klawiszem y, resztę zostawiamy człowiekowi
  if [[ $APPROVE -eq 1 ]] && has_run_dialog "$cur"; then
    verdict="$(python3 -I "$SCRIPT_DIR/approve-check.py" "$ROOT" <<<"$(tail -n 25 <<<"$cur")")"
    if [[ "$verdict" == ALLOW\ * && $approvals -lt $MAX_APPROVALS ]]; then
      hc keys "$TARGET" y >/dev/null
      approvals=$((approvals + 1))
      printf '%s %s\n' "$(date -Is)" "${verdict#ALLOW }" >> "$STATE_DIR/approvals.log"
      echo "[ask-helper] zatwierdzono ($approvals): ${verdict#ALLOW }" >&2
      # czekaj, aż dialog zniknie albo zmieni się na inne polecenie
      for _ in $(seq 1 15); do
        sleep 1
        now="$(hc read --lines 500 "$TARGET" 2>/dev/null || true)"
        has_run_dialog "$now" || break
        [[ "$(python3 -I "$SCRIPT_DIR/approve-check.py" "$ROOT" <<<"$(tail -n 25 <<<"$now")")" != "$verdict" ]] && break
      done
      stable=0; prev=""
      continue
    fi
    if [[ "$verdict" == ALLOW\ * ]]; then
      echo "[ask-helper] limit $MAX_APPROVALS automatycznych zatwierdzeń; reszta w panelu $WHO ($TARGET)." >&2
    else
      echo "[ask-helper] $WHO ($TARGET) czeka na zgodę na polecenie spoza listy: ${verdict#DENY }. Zatwierdź/odrzuć w panelu." >&2
    fi
    exit 2
  fi
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
    # agent bez raportów (np. cursor; `hc wait` też nie ma tu sygnału i wisi): koniec oceniamy po ekranie.
    # 1) wskaźnik pracy w stopce ("Running", "ctrl+c to stop") = tura trwa, nawet gdy ekran stoi (np. długi build);
    # 2) po wskaźniku: linia "=== WYNIK ===" PO nonce (w echu promptu też jest to hasło, stąd "po nonce") + 2 równe odczyty;
    # 3) bez linii wyniku (pomocnik zignorował format): 5 równych odczytów (~10 s) bez wskaźnika pracy.
    if tail -n 12 <<<"$cur" | grep -qE "Running|ctrl\+c to stop"; then
      stable=0
    else
      if [[ "$cur" == "$prev" ]]; then stable=$((stable+1)); else stable=0; fi
      if awk -v n="$NONCE" '/\[Pasted text/ {own=0} /^[[:space:]]*=== WYNIK ===[[:space:]]*$/ {own=1} f && /=== WYNIK ===/ {ok=1} index($0, n) {f=1} END {exit !(ok || own)}' <<<"$cur"; then
        need=2
      elif [[ $COLLECT -eq 1 ]]; then
        need=999999   # --collect: spokojny ekran bez linii wyniku nie jest wynikiem; o dalszych krokach decyduje collect-decide.py
      else
        need=5
      fi
      [[ $stable -ge $need ]] && break
    fi
  fi
  prev="$cur"
  if [[ $(date +%s) -ge $deadline ]]; then
    if [[ $COLLECT -eq 0 ]]; then echo "Timeout (${TIMEOUT}s) czekając na $WHO." >&2; exit 3; fi
    tail25="$(tail -n 25 <<<"$cur")"
    screen_hash="$(sha1sum <<<"$tail25" | cut -c1-40)"
    screen_prev=""; [[ "$screen_hash" == "$(last_get screen_hash)" ]] && screen_prev="$tail25"
    action="$(COLLECTS="$COLLECTS0" NUDGED="$NUDGED" SCREEN="$tail25" PREV="$screen_prev" python3 -I -c 'import json, os
print(json.dumps({"collects": int(os.environ["COLLECTS"] or 0), "nudged": os.environ["NUDGED"] == "true",
                  "screen": os.environ["SCREEN"], "screen_prev": os.environ["PREV"]}))' | python3 -I "$SCRIPT_DIR/collect-decide.py")"
    last_update collects="$((COLLECTS0 + 1))" screen_hash="\"$screen_hash\""
    case "$action" in
      ASK_USER)
        echo "$WHO ($TARGET) czeka na zgodę użytkownika w swoim panelu. Zatwierdź/odrzuć i wywołaj --collect ponownie." >&2
        exit 2 ;;
      NUDGE)
        hc send "$TARGET" "Podaj wynik poprzedniego zadania; zakończ linią GOTOWE: albo UTKNĄŁEM:" >/dev/null
        NUDGED=true; last_update nudged=true
        echo "[ask-helper] zapytanie kontrolne wysłane do $WHO; czekam jeszcze ${TIMEOUT}s." >&2
        deadline=$(( $(date +%s) + TIMEOUT )); stable=0; prev=""
        continue ;;
      REPORT)
        echo "$WHO ($TARGET) nie odpowiedział nawet na zapytanie kontrolne. Ostatnie linie panelu:" >&2
        tail -n 15 <<<"$cur" >&2
        exit 4 ;;
      *)
        echo "Timeout (${TIMEOUT}s) czekając na $WHO (próba $((COLLECTS0 + 1))); wywołaj --collect ponownie." >&2
        exit 3 ;;
    esac
  fi
  sleep "$POLL_SEC"
done

# --- wypisz tylko odpowiedź (po linii z nonce) ---
NONCE="$NONCE" MAXLINES="$MAXLINES" python3 -I -c '
import os, re, sys
text = sys.stdin.read()
all_lines = text.splitlines()
nonce = os.environ["NONCE"]
def footer(l):
    s = l.strip()
    return (not s or set(s) <= set("─▄▀> →-") or "for shortcuts" in s
            or "Add a follow-up" in s or "esc to cancel" in s
            or s.startswith("Auto") or s.startswith("~/") or s.startswith("[hc]")
            or re.search(r"·\s*[\d.]+%(\s*·.*)?$", s) is not None
            or re.search(r"·\s*(low|medium|high)\s*$", s) is not None)
def clean(lines):
    # usuń powtórzony nonce z treści odpowiedzi i stopkę panelu
    lines = [re.sub(r"\s*\(?" + re.escape(nonce) + r"\)?", "", l) for l in lines]
    while lines and footer(lines[-1]): lines.pop()
    while lines and not lines[0].strip(): lines.pop(0)
    return lines
# pierwsze wystąpienie nonce = koniec echa promptu (pomocnik bywa, że powtarza nonce na końcu odpowiedzi)
idx = next((i for i, l in enumerate(all_lines) if nonce in l), -1)
lines = all_lines[idx + 1:] if idx >= 0 else all_lines
mark = max((i for i, l in enumerate(lines) if "=== WYNIK ===" in l), default=-1)
if mark >= 0:
    lines = lines[mark + 1:]
lines = clean(lines)
if not lines:
    # Cursor zwija długi prompt do "[Pasted text]": nonce występuje wtedy dopiero w odpowiedzi, a echo nie ma go wcale.
    # Wtedy wynik to to, co następuje po ostatniej linii zawierającej wyłącznie === WYNIK ===, o ile leży za ostatnim [Pasted text.
    paste = max((i for i, l in enumerate(all_lines) if "[Pasted text" in l), default=-1)
    own = [i for i, l in enumerate(all_lines) if i > paste and l.strip() == "=== WYNIK ==="]
    if own:
        lines = clean(all_lines[own[-1] + 1:])
limit = int(os.environ.get("MAXLINES") or 0)
if limit and len(lines) > limit:
    cut = len(lines) - limit
    lines = lines[:limit] + [f"[ucięto {cut} linii; pełna odpowiedź: hc read <terminal> albo --max-lines 0]"]
print("\n".join(lines))
' <<<"$cur"
