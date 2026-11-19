# Pomocnicy: start/stop i `/verify` — plan wdrożenia

> **Dla wykonawcy:** REQUIRED SUB-SKILL: superpowers:executing-plans (zadanie po zadaniu, z punktami kontrolnymi).
> Zgodnie z `CLAUDE.md` nie używamy podagentów Claude: testy, lint i typecheck zlecamy cursorowi
> (`scripts/ask-helper.sh --role task --tier light --approve-allowed cursor …`), review diffa agy. Kroki mają checkboxy (`- [ ]`).

**Cel:** pomocnicy startują i kończą się z poziomu agenta głównego (`helpers.sh`, stop po 10 min bezczynności), jest komenda `/verify`
oraz ponowne odpytanie pomocnika, który nie odpowiada (`ask-helper.sh --collect`).

**Spec:** `docs/superpowers/specs/2026-11-19-pomocnicy-start-i-verify-design.md` (sekcje 3–7; sekcja 8, TUI, to osobny plan po wdrożeniu).

**Architektura:** logika decyzyjna w małych skryptach Pythona (`helpers-check.py`, `collect-decide.py`), czystych i testowanych jednostkowo
(wzór: `approve-check.py` + `tests/unit/scripts/ask-helper/approve-check.test.ts`). Powłoka (`helpers.sh`, `ask-helper.sh`) tylko zbiera dane
z `hc` i wykonuje decyzje. Testy powłoki idą przez atrapę `hc` na `PATH` (zadanie 2), więc nie dotykają żywych pomocników.

**Stack:** bash, Python 3 (`python3 -I`, bez zależności), Vitest (`// @vitest-environment node`, `spawnSync`).

**Zasady z CLAUDE.md, których pilnujemy:** kod pisany w TDD (czerwony → zielony); nie ruszamy `architecture.static.test.ts`; zmiany w NEXUS idą
od razu z pushem, w Monolith commitujemy na prośbę użytkownika (każdy commit z tego planu wykonuje się dopiero po jego zgodzie na wdrożenie planu);
nie zatwierdzamy w panelach pomocników niczego poza zgodą z `CLAUDE.md`.

---

## Mapa plików

| Plik                                                                                                          | Rola                                                                  |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `scripts/helpers-check.py` (nowy)                                                                             | czysta decyzja `KILL`/`SKIP` dla `down` (spec 3.3)                    |
| `scripts/helpers.sh` (nowy)                                                                                   | `up`, `down`, `status`, `watch` (spec 3.2, 3.4)                       |
| `scripts/open-agent` (nowy w repo, przeniesiony)                                                              | start jednego agenta z podpięciem + rola `helpers`                    |
| `scripts/collect-decide.py` (nowy)                                                                            | czysta decyzja `COLLECT`/`NUDGE`/`REPORT`/`ASK_USER` (spec 3.8)       |
| `scripts/ask-helper.sh` (zmiana)                                                                              | zapis `last-<nazwa>.json`, opcja `--collect`, komunikat kodu 1, kod 4 |
| `.claude/commands/verify.md` (nowy)                                                                           | komenda `/verify`                                                     |
| `tests/unit/scripts/helpers/hc-stub.ts` (nowy)                                                                | atrapa `hc` na `PATH` + odczyt zarejestrowanych wywołań               |
| `tests/unit/scripts/helpers/helpers-check.test.ts`                                                            | testy decyzji `down`                                                  |
| `tests/unit/scripts/helpers/helpers-sh.test.ts`                                                               | testy `helpers.sh` na atrapie `hc`                                    |
| `tests/unit/scripts/ask-helper/collect-decide.test.ts`                                                        | testy decyzji ponownego odpytania                                     |
| `tests/unit/scripts/ask-helper/collect.test.ts`                                                               | testy `ask-helper.sh --collect` na atrapie `hc`                       |
| `tests/unit/scripts/ask-helper/approve-check.test.ts` (rozszerzenie)                                          | nowe przypadki `ALLOW`/`DENY` dla `/verify`                           |
| `CLAUDE.md`, `.claude/commands/consult.md`, `~/.claude/CLAUDE.md`, `~/.claude/hooks/block-oneshot-helpers.py` | zmiana reguł (zadanie 7)                                              |
| `../NEXUS/Vault/Arsenal/agents.yaml`                                                                          | wpisy Arsenału (zadanie 8)                                            |

## Formaty współdzielone (pisane bez uruchamiania, bo małe)

**Wejście `helpers-check.py`** (stdin, JSON; wyjście: jedna linia na terminal, w kolejności wejścia):

```json
{
  "now_ms": 1795104000000,
  "idle_min": 10,
  "force": false,
  "slug": "monolith",
  "terminals": [
    {
      "address": "t5m",
      "name": "agy-monolith",
      "state": "live",
      "status": "idle",
      "idle_since_ms": 1795103340000,
      "screen_changed_ms": 1795103000000,
      "screen": "…ostatnie 25 linii ekranu…"
    }
  ]
}
```

- `name` może być `null` (terminal bez nazwy); `status` może być `null` (Cursor); `idle_since_ms` = `status_ms`, a gdy `status` brak,
  czas ostatniej zmiany skrótu ekranu; `screen_changed_ms` z pliku stanu (pierwszy odczyt bez historii = `now_ms`; wyjątek: gdy `status` jest raportowany, przyjmujemy `status_ms`, bo agent raportujący `idle` od N minut nie zmieniał ekranu, a inaczej pierwszy `down` po starcie zawsze trafiałby w osłonę ekranu).
- Wyjście: `KILL <nazwa>` albo `SKIP <nazwa-lub-adres>: <powód>`. Powody (dokładne teksty): `bez nazwy`, `nie pomocnik`, `inny projekt`,
  `nie działa`, `czeka na zgodę`, `pracuje`, `bezczynny N min < M` (N = pełne minuty, zaokrąglone w dół), `ekran zmienił się w ostatniej minucie`.
- **Kolejność reguł:** (1) nazwa: `null` → `bez nazwy`; prefiks inny niż `agy-`/`cursor-` → `nie pomocnik`; inny slug → `inny projekt`;
  (2) `state` ≠ `live` → `nie działa`; (3) `status` = `blocked` albo ekran (ostatnie 25 linii) pasuje do
  `Requesting permission|Allow this|Run this command\?|\(y/n\)` → `czeka na zgodę`; (4) `status` = `working` albo (gdy `status` brak) w ostatnich
  12 liniach ekranu jest `Running|ctrl\+c to stop|esc to cancel` → `pracuje`; (5) bez `--force`: `(now − idle_since)/60000 < idle_min` →
  `bezczynny N min < M`; (6) `now − screen_changed_ms < 60000` → `ekran zmienił się w ostatniej minucie`; inaczej `KILL`.
  `--force` pomija wyłącznie regułę 5.

**Plik stanu `helpers.sh`:** `$STATE_DIR/helpers-<slug>.json`, `{"<nazwa>": {"hash": "<sha1 ekranu>", "changed_ms": <int>}}`; `STATE_DIR` jak w
`ask-helper.sh` (`${XDG_STATE_HOME:-$HOME/.local/state}/ask-helper`).

**Plik zadania `ask-helper.sh`:** `$STATE_DIR/last-<nazwa>.json` (nazwa terminala; bez nazwy → adres):
`{"target": "t5n", "nonce": "ref:ab12cd34ef56", "sent_ms": <int>, "role": "task", "collects": 0, "nudged": false, "screen_hash": ""}`.

**Atrapa `hc` (`hc-stub.ts`):** funkcja `makeHcStub(fixtures)` tworzy w katalogu tymczasowym wykonywalny skrypt `hc` (Python) i zwraca
`{ dir, env, calls() }`. Fixtures: `{ ls: {terminals: […]}, get: {"<adres lub nazwa>": {…}}, read: {"<adres lub nazwa>": "ekran"}, failRun?: "tekst błędu" }`.
Zachowanie: `hc ls` (z `--json` lub bez) drukuje `ls`; `hc get X` drukuje `get[X]` (adres albo nazwa; brak → kod 1); `hc read X [--lines N]` drukuje
`read[X]`; `hc run|kill|rm|send|keys|attach` dopisują linię `argv` do pliku `calls.log` i kończą kodem 0, a `hc run` z `failRun` drukuje go na
stderr i kończy kodem 1. `calls()` zwraca tablicę wywołań (każde to tablica argumentów). `env` = `{...process.env, PATH: "<dir>:" + PATH, XDG_STATE_HOME: "<tmp>"}`.

---

### Zadanie 0: Gałąź i commit specu

**Pliki:** `docs/superpowers/specs/2026-11-19-pomocnicy-start-i-verify-design.md`, ten plan.

- [ ] **Krok 1:** `git switch -c feat/pomocnicy-start-i-verify`
- [ ] **Krok 2:** poprawki specu wynikające z planu (mała edycja tekstu):
  - 3.5, wiersz 18: zamienić na `agy-monolith`, `status` `idle` od 11:00, `screen_changed` 11:59:30 → `SKIP: ekran zmienił się w ostatniej minucie`
    (dla Cursora bez statusu ta reguła pokrywa się z progiem czasu, więc test musi używać pomocnika ze statusem).
  - 3.8, punkty 2–4: `--collect` sam zlicza próby w `last-<nazwa>.json`; **czwarte wywołanie z rzędu** wykonuje zapytanie kontrolne (gdy ekran
    jest identyczny jak na końcu poprzedniego `--collect`, a nie „30 s od siebie"); **kod 4** = raport (brak odpowiedzi po zapytaniu kontrolnym);
    kod 3 = „wywołaj `--collect` ponownie". Tabela testów 3.8 mapuje się na `collect-decide.py` (zadanie 5).
- [ ] **Krok 3:** `npx prettier --write docs/superpowers/specs/2026-11-19-pomocnicy-start-i-verify-design.md docs/superpowers/plans/2026-11-19-pomocnicy-start-i-verify.md`
- [ ] **Krok 4:** commit (po zgodzie użytkownika): `git add docs/superpowers && git commit -m "docs: spec i plan pomocników (start/stop, /verify, collect)"`

### Zadanie 1: `helpers-check.py` (decyzja `down`)

**Pliki:** utworzyć `scripts/helpers-check.py`, `tests/unit/scripts/helpers/helpers-check.test.ts`.

**Interfejs:** `python3 -I scripts/helpers-check.py < wejście.json` → linie `KILL …`/`SKIP …` (format i reguły powyżej). Kod wyjścia 0; niepoprawny JSON → kod 2 i komunikat na stderr.

- [ ] **Krok 1: czerwony test.** W pliku testu helper `term(over)` buduje terminal z domyślnymi `name: "agy-monolith"`, `state: "live"`, `status: "idle"`,
      `idle_since_ms: NOW − 11 min`, `screen_changed_ms: NOW − 30 min`, `screen: ""`; helper `run(input)` woła skrypt przez `spawnSync("python3", ["-I", SCRIPT])`
      z `input` na stdin i zwraca linie. `NOW` = 12:00:00 dowolnego dnia w ms, `idle_min` 10. Przypadki (`it.each`):

| #   | Wejście (różnice względem domyślnego)                                                          | Oczekiwana linia                                           |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | domyślny (idle od 11:49)                                                                       | `KILL agy-monolith`                                        |
| 2   | `cursor-monolith`, `status: null`, `idle_since` 11:51, ekran bez wskaźników                    | `SKIP cursor-monolith: bezczynny 9 min < 10`               |
| 3   | `agy-career-guide`, idle od 11:00                                                              | `SKIP agy-career-guide: inny projekt`                      |
| 4   | `claude-monolith`, idle od 11:00                                                               | `SKIP claude-monolith: nie pomocnik`                       |
| 5   | `cursor-monolith`, `status: "working"`                                                         | `SKIP cursor-monolith: pracuje`                            |
| 6   | `cursor-monolith`, idle od 11:00, ekran z `Run this command?`                                  | `SKIP cursor-monolith: czeka na zgodę`                     |
| 7   | `name: null`, `address: "t40"`, idle od 11:00                                                  | `SKIP t40: bez nazwy`                                      |
| 8   | `state: "finished"`                                                                            | `SKIP agy-monolith: nie działa`                            |
| 9   | `status: "done"`, `idle_since` 11:30                                                           | `KILL agy-monolith`                                        |
| 10  | `force: true`, `idle_since` 11:59                                                              | `KILL agy-monolith`                                        |
| 11  | `force: true`, `agy-career-guide`                                                              | `SKIP agy-career-guide: inny projekt`                      |
| 12  | `force: true`, `cursor-monolith`, ekran z `Run this command?`                                  | `SKIP cursor-monolith: czeka na zgodę`                     |
| 13  | `idle_since` 11:50 (równo 10 min)                                                              | `KILL agy-monolith`                                        |
| 14  | `force: true`, `status: "working"`                                                             | `SKIP agy-monolith: pracuje`                               |
| 15  | `status: "blocked"`, idle od 11:00                                                             | `SKIP agy-monolith: czeka na zgodę`                        |
| 16  | `cursor-monolith`, `status: null`, ekran z `Allow this`, idle od 11:00                         | `SKIP cursor-monolith: czeka na zgodę`                     |
| 17  | `cursor-monolith`, `status: null`, `idle_since` = `screen_changed` 11:40, ekran bez wskaźników | `KILL cursor-monolith`                                     |
| 18  | `screen_changed_ms` 11:59:30, `idle_since` 11:00 (agy, `idle`)                                 | `SKIP agy-monolith: ekran zmienił się w ostatniej minucie` |
| 19  | `cursor-monolith`, `status: null`, idle od 11:00, ostatnie linie ekranu zawierają `Running`    | `SKIP cursor-monolith: pracuje`                            |
| 20  | `cursor-monolith`, `status: null`, `idle_since` = `screen_changed` = `NOW`                     | `SKIP cursor-monolith: bezczynny 0 min < 10`               |

Dodatkowo: wiele terminali w jednym wejściu daje linie w kolejności wejścia (1 + 3 + 4 → trzy linie); niepoprawny JSON → status 2.

- [ ] **Krok 2:** `npx vitest run tests/unit/scripts/helpers/helpers-check.test.ts` → oczekiwane: FAIL (brak skryptu; `spawnSync` zwraca status ≠ 0).
- [ ] **Krok 3:** napisać `scripts/helpers-check.py` według „Kolejności reguł" (jedna funkcja `decide(term, cfg) -> str`, `main()` czyta stdin).
- [ ] **Krok 4:** ten sam `vitest run` → oczekiwane: 20 przypadków + 2 dodatkowe PASS.
- [ ] **Krok 5:** commit: `git add scripts/helpers-check.py tests/unit/scripts/helpers && git commit -m "feat(scripts): decyzja KILL/SKIP dla zatrzymywania pomocników"`

### Zadanie 2: atrapa `hc` i `helpers.sh` (`status`, `down`)

**Pliki:** utworzyć `tests/unit/scripts/helpers/hc-stub.ts`, `tests/unit/scripts/helpers/helpers-sh.test.ts`, `scripts/helpers.sh`.

**Interfejs `helpers.sh`:** zob. spec 3.2. W tym zadaniu: `status`, `down [rola|all] [--idle-min N] [--force] [--dry-run]`, wspólne funkcje:
`project_slug` (korzeń repo z `git rev-parse --path-format=absolute --git-common-dir`, jak `open-agent`; nazwa `<rola>-<slug>` obcięta do 32 znaków) i `collect_json` (łączy `hc ls --json`, `hc get`, `hc read --lines 25`, plik stanu → wejście `helpers-check.py`).
Zmienne testowe: `HELPERS_NOW_MS` (nadpisuje `date`), `HELPERS_ROOT` (nadpisuje korzeń repo, bo w teście nie chcemy zależeć od nazwy katalogu).
`down` wywołuje `hc kill <nazwa>` i `hc rm <nazwa>` tylko dla linii `KILL`; `--dry-run` tylko drukuje decyzje. Pomocnicy z `claude-*` nie są nigdy kandydatami.

- [ ] **Krok 1:** napisać `hc-stub.ts` według kontraktu atrapy powyżej (bez testów własnych; sprawdza go test z kroku 2).
- [ ] **Krok 2: czerwone testy** w `helpers-sh.test.ts` (wszystkie z `HELPERS_ROOT=/x/Monolith`, `HELPERS_NOW_MS` = 12:00, `XDG_STATE_HOME` tymczasowy):
  1. `down --dry-run` przy `agy-monolith` (`status: {state: "idle"}`, `status_ms` 11:49, ekran spokojny) i `agy-career-guide` (idle od 11:00): stdout zawiera `KILL agy-monolith` i `SKIP agy-career-guide: inny projekt`; `calls()` nie zawiera `kill`.
  2. `down` (bez `--dry-run`) w tej samej sytuacji: `calls()` zawiera `["kill","agy-monolith"]` i `["rm","agy-monolith"]`, a nie zawiera żadnego wywołania z `agy-career-guide`.
  3. `down` dla `cursor-monolith` bez `status` przy **pierwszym** odczycie: `SKIP … bezczynny 0 min < 10`, a w `helpers-monolith.json` powstaje wpis z `changed_ms` = `HELPERS_NOW_MS`; przy drugim wywołaniu 11 min później (`HELPERS_NOW_MS` +11 min) i tym samym ekranie: `KILL cursor-monolith`; przy innym ekranie: ponownie `SKIP`.
  4. `status`: wypisuje wiersz dla każdego pomocnika projektu (`nazwa`, `adres`, `status` lub `-`, minuty bezczynności); `claude-monolith` i cudze projekty pominięte.
  5. `down` z nieznaną opcją → kod 1 i komunikat na stderr.
- [ ] **Krok 3:** `npx vitest run tests/unit/scripts/helpers/helpers-sh.test.ts` → FAIL (brak `scripts/helpers.sh`).
- [ ] **Krok 4:** napisać `scripts/helpers.sh` (`set -euo pipefail`, nagłówek z użyciem jak w `ask-helper.sh`; dane do `helpers-check.py` budowane `python3 -I`, bez `jq`).
- [ ] **Krok 5:** ten sam `vitest run` → PASS.
- [ ] **Krok 6:** commit: `git commit -m "feat(scripts): helpers.sh status i down z atrapą hc w testach"`

### Zadanie 3: `up`, `watch`, `open-agent` w repo

**Pliki:** zmienić `scripts/helpers.sh`, `tests/unit/scripts/helpers/helpers-sh.test.ts`; utworzyć `scripts/open-agent` (kopia `~/.local/bin/open-agent` + zmiany).

**Reguły `up [cursor|agy|all] [--dir D]`:** domyślnie `all`; dla każdej roli, jeśli `hc get <nazwa>` zwraca `"state":"live"` → „już działa" (kod 0, bez `hc run`);
inaczej `hc run --bg --name <nazwa> --outlive-parent --cwd <katalog> <pełna ścieżka programu z command -v>` (bez `--keep`). Po starcie pomocnika (i tylko wtedy,
gdy jakiś pomocnik jest `live`) startuje `watch`: `hc run --bg --name watch-<slug> --outlive-parent --cwd <katalog> bash <ścieżka>/helpers.sh watch`;
błąd `hc run` przy watcherze (nazwa zajęta) jest ignorowany. Programy: `cursor` → `cursor-agent`, `agy` → `agy`.
**`watch`:** pętla `while :; do helpers.sh down; sleep "${HELPERS_WATCH_SEC:-60}"; done`; przed wyjściem, gdy `down` nie zostawia żadnego pomocnika projektu,
ponownie liczy pomocników i wychodzi dopiero gdy nadal nie ma żadnego (wyścig z nowym `up`, spec 3.4). `HELPERS_WATCH_ONCE=1` wykonuje jedną iterację (dla testów).

- [ ] **Krok 1: czerwone testy** (atrapa `hc`):
  1. `up cursor`, gdy `hc get cursor-monolith` zwraca `live` → `calls()` bez `run`, stdout „już działa".
  2. `up cursor`, gdy `get` brak: `calls()` ma `["run","--bg","--name","cursor-monolith","--outlive-parent","--cwd","/x/Monolith", "<ścieżka cursor-agent z PATH atrapy>"]`; potem drugi `run` z `--name watch-monolith`.
  3. `up all`: dwa `run` pomocników (agy i cursor) i **jeden** `run` watchera.
  4. `failRun: "name already in use"` dla `run … watch-monolith` → kod wyjścia 0 mimo błędu.
  5. `up` z nieznaną rolą → kod 1.
  6. `watch` z `HELPERS_WATCH_ONCE=1` wywołuje decyzję `down` raz (w `calls()` widać `kill` dla pomocnika spełniającego warunki).
  7. `watch` przy braku pomocników projektu kończy się kodem 0 bez `sleep`.
- [ ] **Krok 2:** `vitest run` pliku → FAIL na nowych przypadkach.
- [ ] **Krok 3:** zaimplementować `up` i `watch` w `scripts/helpers.sh`.
- [ ] **Krok 4:** `vitest run` pliku → PASS.
- [ ] **Krok 5:** `scripts/open-agent`: skopiować `~/.local/bin/open-agent`, dodać rolę `helpers` (`exec "$(dirname "$0")/helpers.sh" up all`; bez `attach`), zaktualizować komunikat użycia. Sprawdzić: `bash scripts/open-agent --dry-run cursor` (oczekiwane: linia `[dry-run] hc run --bg --name cursor-monolith …`), `bash scripts/open-agent bogus` (kod 1).
- [ ] **Krok 6:** commit: `git add scripts tests && git commit -m "feat(scripts): helpers.sh up i watch, open-agent w repo z rolą helpers"`
- [ ] **Krok 7 (po merge'u do `main`, ręcznie):** `ln -sf ~/projects/Brain_7224/Monolith/scripts/open-agent ~/.local/bin/open-agent`; sprawdzić `open-agent cursor --dry-run`.

### Zadanie 4: sprawdzenia na żywo E1–E3 (bez kodu, wyniki do specu)

Wykonuje agent główny z użytkownikiem; **zabija i uruchamia żywych pomocników** (uprzedzić użytkownika; po teście `scripts/helpers.sh up all`).

- [ ] **E1 (okno zaufania/gotowość):** `hc kill agy-monolith && hc rm agy-monolith`, potem `scripts/helpers.sh up agy`; `hc read agy-monolith` po 10 s. Sprawdzić, czy agy czeka na dialog i po czym poznać gotowość (pasek). To samo dla `cursor`. Zapisać wniosek: jeśli jest dialog, `up` ma kończyć się kodem 2 z komunikatem „podepnij `hc attach <nazwa>`" (dopisać zadanie 3a w tym planie).
- [ ] **E2 (sieroty):** `ps -eo pid,ppid,rss,args | grep -E 'agy|cursor-agent' | grep -v grep > przed.txt`, `scripts/helpers.sh down --force agy`, ten sam `ps` do `po.txt`, `diff przed.txt po.txt`. Pozostałe procesy `agy` z `ppid` 1 = sieroty → dopisać dobijanie grupy procesów w `down` (osobny test na atrapie: po `kill` wywołanie `["kill", …]` nie wystarcza, więc potrzebny kontrakt dla `pkill -g`; zaprojektować po wyniku).
- [ ] **E3 (`status_ms`):** zapisać `hc get agy-monolith` (pole `status_ms`) przed i po zleceniu prostego zadania przez `ask-helper.sh`; oczekiwane: `status_ms` rośnie i jest ≥ czasu zlecenia.
- [ ] **Krok końcowy:** wpisać wyniki do sekcji 6 specu (jak E5) i, jeśli E1/E2 zmieniają kontrakt, poprawić zadania 2–3 przed dalszą pracą. Commit: `git commit -m "docs: wyniki sprawdzeń E1–E3 pomocników"`.

### Zadanie 5: `ask-helper.sh --collect` i `collect-decide.py`

**Pliki:** utworzyć `scripts/collect-decide.py`, `tests/unit/scripts/ask-helper/collect-decide.test.ts`, `tests/unit/scripts/ask-helper/collect.test.ts`; zmienić `scripts/ask-helper.sh`.

**`collect-decide.py`** — stdin JSON `{"collects": int, "nudged": bool, "screen": str, "screen_prev": str}` → jedno słowo:

1. ekran (ostatnie 25 linii) pasuje do `APPROVAL_RE` → `ASK_USER`;
2. w ostatnich 12 liniach jest `Running|ctrl\+c to stop|esc to cancel` → `COLLECT` (pracuje, nie raportujemy ani nie pytamy);
3. `nudged` (zapytanie kontrolne już poszło, wyniku brak) → `REPORT`;
4. `collects < 3` → `COLLECT`;
5. `screen == screen_prev` (ekran bez zmian od końca poprzedniego `--collect`) → `NUDGE`;
6. w pozostałych przypadkach (ekran się zmienia) → `COLLECT`.

**Zmiany `ask-helper.sh`:**

- Po `hc send "$TARGET" "$FULL"` zapisać `last-<nazwa>.json` (format powyżej; `nazwa` z `hc get "$TARGET"`, a gdy pusta — adres); `collects: 0`, `nudged: false`.
- Nowa flaga `--collect` (bez promptu: `WHO` jest jedynym argumentem pozycyjnym). Przepływ: znajdź terminal (jak dotąd, `--target` działa); wczytaj `last-<nazwa>.json` (brak pliku lub inny `target` → kod 1, „brak zadania do odebrania"); pomiń `/clear`, `/model`, budowanie i wysyłanie promptu; ustaw `NONCE` z pliku; wejdź w istniejącą pętlę oczekiwania z `TIMEOUT`.
  Po wyjściu z pętli kodem timeoutu: zwiększ `collects`, zapisz `screen_hash`, wywołaj `collect-decide.py`: `COLLECT` → kod 3 („wywołaj `--collect` ponownie"); `NUDGE` → `hc send "$TARGET" "Podaj wynik poprzedniego zadania; zakończ linią GOTOWE: albo UTKNĄŁEM:"`, `nudged: true`, jeszcze jedna runda oczekiwania; `REPORT` → kod 4 i ostatnie 15 linii panelu na stderr; `ASK_USER` → kod 2 (jak istniejący komunikat).
  Gdy `NONCE` z pliku nie występuje na ekranie (po `/clear`) → kod 1, „wynik niedostępny na ekranie".
- Komunikat kodu 1 „Nie znaleziono terminala…": dopisać `albo scripts/helpers.sh up <rola>`. Nagłówek skryptu: opisać `--collect` i kod 4.

- [ ] **Krok 1: czerwone testy `collect-decide.test.ts`** (`spawnSync("python3", ["-I", SCRIPT])`):

| #   | Wejście                                                                       | Oczekiwanie |
| --- | ----------------------------------------------------------------------------- | ----------- |
| 1   | `collects: 1`, ekran ze `Running` w ostatnich liniach                         | `COLLECT`   |
| 2   | `collects: 3`, ekran bez wskaźników, `screen == screen_prev`, `nudged: false` | `NUDGE`     |
| 3   | `collects: 4`, `nudged: true`, ekran bez wskaźników                           | `REPORT`    |
| 4   | `collects: 3`, ekran z `Run this command?`                                    | `ASK_USER`  |
| 5   | `collects: 3`, `screen != screen_prev`, `nudged: false`                       | `COLLECT`   |
| 6   | `collects: 0`, ekran spokojny                                                 | `COLLECT`   |
| 7   | `nudged: true`, ekran ze `ctrl+c to stop`                                     | `COLLECT`   |

- [ ] **Krok 2: czerwone testy `collect.test.ts`** (atrapa `hc`, `--target t1`, `XDG_STATE_HOME` tymczasowy, `--timeout 1`):
  1. brak pliku zadania → kod 1, na stderr „brak zadania do odebrania";
  2. plik z `nonce: "ref:aaa111bbb222"`, ekran: linia z nonce, `=== WYNIK ===`, `ok`, bez wskaźników pracy → kod 0, stdout `ok`;
  3. plik z innym nonce niż na ekranie → kod 1, „wynik niedostępny na ekranie";
  4. ekran ze `Running` w stopce, brak wyniku, `--timeout 1` → kod 3, a w pliku `collects` = 1;
  5. po trzech wywołaniach jak w 4. i ekranie bez wskaźników, bez zmian → czwarte wywołanie robi `hc send` z tekstem „Podaj wynik poprzedniego zadania" (w `calls()`), plik ma `nudged: true`; piąte → kod 4;
  6. ekran z `Run this command?` → kod 2, bez `send`.
     Zwykłe wywołanie (z promptem) zapisuje `last-<nazwa>.json` z `collects: 0` — test z atrapą, w której `read` od razu zwraca nonce + `=== WYNIK ===`.
- [ ] **Krok 3:** `npx vitest run tests/unit/scripts/ask-helper` → FAIL na nowych plikach, `approve-check.test.ts` nadal PASS.
- [ ] **Krok 4:** napisać `collect-decide.py` i zmiany w `ask-helper.sh`.
- [ ] **Krok 5:** `npx vitest run tests/unit/scripts` → PASS. Dodatkowo ręcznie `bash -n scripts/ask-helper.sh` (składnia).
- [ ] **Krok 6:** commit: `git commit -m "feat(scripts): ask-helper --collect, ponowne odpytanie pomocnika"`

### Zadanie 6: `/verify`

**Pliki:** utworzyć `.claude/commands/verify.md`; rozszerzyć `tests/unit/scripts/ask-helper/approve-check.test.ts`.

- [ ] **Krok 1: testy `approve-check`** (dodać do istniejących `it.each`; najpierw sprawdzić, że `ALLOW` bez `cd` działa dziś — jeśli nie, to osobny, mały commit poprawki `approve-check.py`):
      `ALLOW`: `npx tsc --noEmit 2>&1`, `npx vitest run 2>&1`, `npx vitest run tests/unit/scripts 2>&1`, `npm run lint 2>&1`, `npm run build 2>&1`.
      `DENY`: `npx vitest run --coverage`, `npx vitest run tests/a.test.ts --watch`, `npm run lint -- --fix`, `npm run build | tail`, `cd /inny/katalog && npx tsc --noEmit`.
      (W teście dialogu użyć helpera `dialog([...])` z pliku; komendy bez `cd`: argument `commandLines`.)
- [ ] **Krok 2:** `npx vitest run tests/unit/scripts/ask-helper/approve-check.test.ts` → PASS (ALLOW/DENY ustalone przez istniejący regex; jeśli któryś przypadek pęka, napraw `approve-check.py`, nie test).
- [ ] **Krok 3: `.claude/commands/verify.md`.** Frontmatter: `description: Zweryfikuj zmiany: tsc + vitest + lint przez cursora`, `argument-hint: [build] [ścieżki testów]`,
      `allowed-tools: Bash(scripts/ask-helper.sh *), Bash(scripts/helpers.sh *)`. Treść (po polsku, jak `consult.md`): argumenty (`build`, ścieżki), polecenie
      `scripts/ask-helper.sh --role task --tier light --fresh --approve-allowed --timeout 600 cursor "<prompt>"`, treść promptu z spec 4.2 (cztery polecenia bez `cd`, bez flag i pipe, zakaz
      edycji i naprawiania, format `PRZESZŁO: …` / lista `plik:linia — przyczyna` (maks. 30), `GOTOWE:`/`UTKNĄŁEM:`), tabela kodów: 0 → relacja (zielone tylko gdy w `PRZESZŁO` są
      wszystkie trzy), 1 → `scripts/helpers.sh up cursor` i raz ponowić, 2 → powiedzieć użytkownikowi, nie zatwierdzać, 3 → `scripts/ask-helper.sh --collect cursor` aż do kodu ≠ 3 (nie
      więcej niż 6 wywołań), 4 → raport z ostatnich linii panelu. Ostrzeżenie: `build` zapisuje `.next/` obok `npm run dev` na 3100.
- [ ] **Krok 4: próba na żywo** (z użytkownikiem): w sesji Claude uruchomić `/verify tests/unit/scripts`. Oczekiwane: `PRZESZŁO: tsc, vitest (N testów), lint` w ≤ ok. 5 minut, w `~/.local/state/ask-helper/approvals.log` nowe wpisy z poleceniami bez `cd`.
- [ ] **Krok 5:** commit: `git add .claude/commands/verify.md tests/unit/scripts/ask-helper && git commit -m "feat(commands): /verify przez cursora z auto-zgodą"`

### Zadanie 7: zmiana reguł

**Pliki:** `CLAUDE.md` (Monolith), `.claude/commands/consult.md`, `~/.claude/CLAUDE.md`, `~/.claude/hooks/block-oneshot-helpers.py`. **Pliki globalne tylko po wyraźnej zgodzie użytkownika w tym kroku** (to jego prywatne ustawienia).

- [ ] **Krok 1:** `CLAUDE.md`, akapit o Cursorze („Kod 1 … nie startuj go sam"): zastąpić regułą z spec 3.6: brak sesji → `scripts/helpers.sh up <rola>`; koniec pracy → `scripts/helpers.sh down` (watcher robi to po 10 min); zakaz `agy -p`/`cursor-agent -p` zostaje; zasada: pomocnik jest zawsze nazwanym terminalem `hc` (`hc ls`, `hc attach`). Dodać wiersz o `--collect` (kod 3 → `--collect`, kod 4 → raport) i `/verify` w tabeli „Kiedy delegować". W opisie kodów wyjścia `ask-helper.sh` dopisać kod 4.
- [ ] **Krok 2:** `.claude/commands/consult.md`: w zasadach dopisać `--collect` przy kodzie 3 i `helpers.sh up` przy kodzie 1.
- [ ] **Krok 3 (po zgodzie):** `~/.claude/CLAUDE.md`: punkt „Brak sesji pomocnika" → „w projekcie ze `scripts/helpers.sh` uruchom `scripts/helpers.sh up <rola>`; w innych poproś użytkownika o `open-agent <rola>`". `~/.claude/hooks/block-oneshot-helpers.py`: w `MSG` dopisać `scripts/helpers.sh up <rola>`. Sprawdzić hook: `echo '{"tool_name":"Bash","tool_input":{"command":"agy -p x"}}' | python3 ~/.claude/hooks/block-oneshot-helpers.py; echo $?` → `2` i nowy komunikat.
- [ ] **Krok 4:** `npx prettier --write CLAUDE.md .claude/commands/consult.md`, commit (tylko pliki repo): `git commit -m "docs: reguły startu/stopu pomocników i ponownego odpytania"`.

### Zadanie 8: Arsenał (NEXUS)

**Plik:** `../NEXUS/Vault/Arsenal/agents.yaml`. Wykonać **po merge'u do `main`**. Format wpisów: `docs/nexus-vault-formaty-yaml.md` (czytać, nie zgadywać z kodu).

- [ ] **Krok 1:** w sekcji skryptów dodać wpisy `helpers.sh` (`scripts/helpers.sh`, przykład `scripts/helpers.sh up all`, `down`, `status`) i `open-agent` (`scripts/open-agent`); w presetach „Weryfikacja: tsc + vitest + lint" z szablonem `scripts/ask-helper.sh --role task --tier light --fresh --approve-allowed cursor "…"`; w wierszu Cursora dopisać „uruchamiany przez `helpers.sh up`".
- [ ] **Krok 2:** sprawdzić, że karta Arsenał czyta plik: `cd ~/projects/Brain_7224/Monolith && npx vitest run tests/unit` (zadanie `cursor`, wynik „przeszło") i otworzyć Alt+7 → Agenci i polecenia (użytkownik).
- [ ] **Krok 3:** commit i push w NEXUS od razu (zasada użytkownika): `cd ../NEXUS && git add Vault/Arsenal/agents.yaml && git commit -m "feat(arsenal): helpers.sh, open-agent i preset weryfikacji" && git push`.

### Zadanie 9: weryfikacja końcowa i PR

- [ ] **Krok 1:** pełna weryfikacja przez cursora: `scripts/ask-helper.sh --role task --tier light --fresh --approve-allowed --timeout 600 cursor "…tsc, vitest run, lint…"` (albo `/verify` po zadaniu 6); oczekiwane `PRZESZŁO` dla trzech.
- [ ] **Krok 2:** review diffa przez agy: `scripts/ask-helper.sh --role review agy "Review git diff main...HEAD (scripts/, tests/unit/scripts, .claude/commands, CLAUDE.md); szukaj błędów w regułach KILL (czy może zabić pracującego pomocnika lub cudzą sesję), wyścigów watchera, kodów wyjścia --collect"`. Opinie weryfikować w kodzie.
- [ ] **Krok 3:** test całości na żywo: `scripts/helpers.sh up all`, zlecić pomocnikom proste zadanie, odczekać 10 min bez ruchu, `scripts/helpers.sh status` → oczekiwane: pomocnicy zakończeni, `watch-monolith` też zniknął z `hc ls`.
- [ ] **Krok 4:** `git push -u origin feat/pomocnicy-start-i-verify` i PR (opis z celu planu, listą zmian i wynikiem E1–E3) — na prośbę użytkownika.

---

## Samoprzegląd planu względem specu

| Wymaganie specu                                             | Zadanie                                                         |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| 3.1–3.3 pliki, interfejs, reguły `down`                     | 1, 2                                                            |
| 3.4 watcher (outlive-parent, duplikaty, wyścig, wznowienie) | 3 (`up` wznawia watcher; wyścig w `watch`)                      |
| 3.5 przypadki testowe                                       | 1 (tabela 1–20)                                                 |
| 3.6 zmiany reguł                                            | 7                                                               |
| 3.7 brak auto-startu w `ask-helper.sh`                      | bez zadania (celowo; komunikat kodu 1 wskazuje `helpers.sh up`) |
| 3.8 ponowne odpytanie                                       | 5                                                               |
| 4 `/verify`, 4.4 testy                                      | 6                                                               |
| 5 Arsenał                                                   | 8                                                               |
| 6 E1–E5                                                     | 4 (E1–E3); E4 poza planem; E5 zamknięte w specu                 |
| 8 TUI                                                       | poza planem (osobny plan po wdrożeniu A)                        |

Uwagi: (1) zadanie 4 może dodać zadanie 3a (obsługa okna zaufania i sieroty), bo to dane z żywego systemu, których nie wolno zgadywać w planie;
(2) wiersz „`status` `blocked`" Cursora nie wystąpi, bo Cursor nie raportuje statusu, więc `ASK_USER` dla niego opiera się wyłącznie na `APPROVAL_RE`.
