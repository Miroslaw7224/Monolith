# Pomocnicy: start/stop i `/verify` (design)

Data: 2026-11-19. Status: do przeglądu użytkownika.

## 1. Cel

Usunąć dwa najczęstsze tarcia we współpracy z pomocnikami (`agy`, `cursor`):

1. **Start i stop pomocników.** Dziś trzeba ręcznie uruchomić każdego w osobnym panelu (`open-agent <rola>`), a bezczynni
   pomocnicy zajmują pamięć (idle `agy` ok. 120–240 MB na proces). Agent główny ma móc ich uruchomić, a bezczynnych
   po 10 minutach sam zakończyć.
2. **Weryfikacja kodu.** `tsc` + `vitest` + `lint` składam przy każdej delegacji ręcznie. Ma być jedna komenda `/verify`.

Poza zakresem: nowe role pomocników, `hc machine`, zmiana doboru modeli, automatyczne uruchamianie pomocnika przez
`ask-helper.sh` (zob. 3.7).

## 2. Decyzje

| ID  | Temat                    | Decyzja                                                                                                                                                                                                                                                               |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Miejsce źródeł           | `Monolith/scripts/` (wersjonowane). `open-agent` przenosimy do repo, a `~/.local/bin/open-agent` staje się dowiązaniem symbolicznym                                                                                                                                   |
| D2  | Start/stop               | Nowy `scripts/helpers.sh up\|down\|status`; `open-agent helpers` jest cienką nakładką na `up`                                                                                                                                                                         |
| D3  | Szablony `hc`            | Nie używamy (`hc templates` puste, format nieznany); wystarczy `hc run --bg`                                                                                                                                                                                          |
| D4  | Stop po bezczynności     | 10 minut (`status` `idle` lub `done`); dotyczy tylko pomocników bieżącego projektu                                                                                                                                                                                    |
| D5  | Kto liczy czas           | Mały watcher w tle (`watch-<projekt>`), startowany przez `up`, sam się kończy, gdy nie ma już pomocników projektu                                                                                                                                                     |
| D6  | Zasada „nie startuj sam" | Zmiana: agent główny może startować i kończyć pomocników **wyłącznie** przez `helpers.sh`, jako nazwane terminale `hc` (widoczne w `hc ls`, podpinane `hc attach` / `open-agent`). Zakaz dotyczy nadal ukrytych, jednorazowych procesów (`agy -p`, `cursor-agent -p`) |
| D7  | `/verify` domyślnie      | `tsc --noEmit`, `vitest run`, `lint`. `npm run build` tylko na jawny argument (zapisuje `.next/`, a na 3100 działa `npm run dev`)                                                                                                                                     |
| D8  | Zakres `/verify`         | Tylko Monolith (`.claude/commands/verify.md`), bo zależy od `ask-helper.sh` i `approve-check.py` z tego repo                                                                                                                                                          |
| D9  | Arsenał                  | Wpisy do `NEXUS/Vault/Arsenal/agents.yaml` (skrypty i preset), ręcznie, bez zmian w kodzie karty                                                                                                                                                                      |

## 3. Część A: `helpers.sh` (start/stop pomocników)

### 3.1 Pliki

- `scripts/helpers.sh`: interfejs, wywołania `hc`.
- `scripts/helpers-check.py`: czysta funkcja decyzyjna (wzór: `approve-check.py`), testowana jednostkowo.
- `scripts/open-agent`: przeniesiony z `~/.local/bin`; nowa rola `helpers` = `helpers.sh up all`.
- Dowiązanie `~/.local/bin/open-agent` → `scripts/open-agent` (zakłada je `scripts/prod`-podobny krok w opisie PR, ręcznie).
- Testy: `tests/unit/scripts/helpers/` (wzór: `tests/unit/scripts/ask-helper/`).

### 3.2 Interfejs

```text
scripts/helpers.sh up     [cursor|agy|all] [--dir KATALOG]
scripts/helpers.sh down   [cursor|agy|all] [--idle-min 10] [--force] [--dry-run]
scripts/helpers.sh status
scripts/helpers.sh watch  [--idle-min 10]        # wewnętrznie, startowane przez up
```

- Nazwa terminala: `<rola>-<slug>` jak w `open-agent` i `ask-helper.sh` (slug z korzenia repo, małe litery, `[^a-z0-9_-]` → `-`;
  limit 32 znaków dotyczy **całej nazwy** `<rola>-<slug>`, nie samego sluga). Nazwę liczą dziś trzy miejsca; test sprawdza,
  że dają ten sam wynik dla `Monolith` i `Monolith-prod`.
- `up` jest idempotentne: sesja `live` o tej nazwie → „już działa", kod 0.
- `up` używa pełnej ścieżki programu (`command -v`), bo rdzeń `hc` ma własny `PATH`:
  `hc run --bg --name <nazwa> --outlive-parent --cwd <katalog> <ścieżka>`. Bez `--keep` (nie chcemy powłoki w miejscu agenta).
- Po starcie `up` czeka na gotowość (zob. E1), nie przez `hc wait` (wisi dla Cursora).
- `status`: tabela `nazwa, adres, status, bezczynność (min)` dla pomocników bieżącego projektu.

### 3.3 Reguły `down` (`helpers-check.py`)

Wejście: JSON z `hc ls --json` i `hc get --json` kandydatów, `now_ms`, slug projektu, `--idle-min`, `--force`, ekran panelu
oraz `idle_since_ms` (liczy je `helpers.sh`, zob. niżej). Wyjście: dla każdego terminala `KILL <nazwa>` albo `SKIP <nazwa>: <powód>`.

**Źródło czasu bezczynności.** `agy` raportuje `status` (`idle`/`done`/`working`) i `status_ms`. **Cursor nie raportuje `status`**
(`hc get` daje `None`; `ask-helper.sh` ocenia go po ekranie), więc dla niego `status_ms` nie istnieje. Dlatego `helpers.sh` trzyma
w `$STATE_DIR/helpers-<slug>.json` dla każdego pomocnika skrót ekranu i czas jego ostatniej zmiany; `idle_since_ms` =
`status_ms` (gdy `status` jest raportowany) albo czas ostatniej zmiany skrótu ekranu (gdy nie jest). Pierwszy odczyt bez historii
liczy się od teraz (Cursor nigdy nie ginie od razu); wyjątek: gdy `status` jest raportowany (agy), brak historii ekranu
przyjmuje `status_ms`, bo agent bezczynny od N minut nie zmieniał ekranu (inaczej pierwszy `down` po starcie zawsze trafiałby w osłonę z warunku 6).

`KILL` tylko gdy **wszystkie** warunki są spełnione:

1. nazwa ma postać `<agy|cursor>-<slug projektu>` (nigdy `claude-*`, nigdy inny projekt, nigdy terminal bez nazwy);
2. `state` = `live`;
3. pomocnik nie pracuje: `status.state` ∈ {`idle`, `done`} albo (gdy `status` brak) w ostatnich 12 liniach ekranu nie ma
   `Running|ctrl+c to stop|esc to cancel` (te same wskaźniki co w `ask-helper.sh`);
4. ekran nie pasuje do pełnego `APPROVAL_RE` z `ask-helper.sh` (`Requesting permission|Allow this|Run this command\?|\(y/n\)`),
   a `status.state` nie jest `blocked` (pomocnik nie czeka na zgodę ani na okno zaufania);
5. `(now_ms - idle_since_ms) / 60000 >= idle-min` (równo 10 min wystarcza);
6. ekran nie zmienił się w ostatniej minucie (osłona okna między `hc send` a zmianą `status` na `working`).

`--force` pomija **wyłącznie** warunek 5 (próg czasu); warunki 1–4 i 6 obowiązują zawsze, więc `--force` nigdy nie zabije
pomocnika, który pracuje albo czeka na zgodę. Po `hc kill` skrypt robi `hc rm`, żeby `hc ls --all` nie puchło.

`hc` nie udostępnia informacji, czy ktoś ogląda terminal (`attach`). Pomocnik oglądany przez ponad 10 minut bez aktywności też zostanie
zakończony; kosztem jest utrata jego kontekstu, a `ask-helper.sh` i tak go czyści. Akceptujemy, opisujemy w `--help`.

### 3.4 Watcher

`up` startuje (jeśli nie działa) terminal `watch-<slug>` **po** tym, jak pomocnik jest `live`:
`hc run --bg --name watch-<slug> --outlive-parent …` (jak pomocnicy, żeby nie zginął z sesją wołającą `up`). Pętla `bash` co 60 s
wywołuje `helpers.sh down`. Zasady:

- **Dwa równoległe `up`:** błąd „nazwa zajęta" z `hc run` przy starcie watchera jest ignorowany (kod 0, „już działa"); drugi watcher nie powstaje.
- **Wyścig z kończącym się watcherem:** watcher przed wyjściem ponownie liczy pomocników projektu; jeśli jakiś jest, wraca do pętli.
  Gdy mimo to wyjdzie tuż przed nowym `up`, kolejne `up` (idempotentne) uruchomi go znowu.
- **Zabity watcher:** `status` pokazuje wiersz `watch: nie działa`, a `up` wznawia go przy następnym wywołaniu.
- Koszt: jeden `sleep` + kilka wywołań `hc` na minutę.

### 3.5 Przypadki testowe `helpers-check.py` (`now` = 12:00, `--idle-min 10`, slug `monolith`)

| #   | Terminal                                                                        | Wynik                                         |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | `agy-monolith`, `idle` od 11:49                                                 | `KILL`                                        |
| 2   | `cursor-monolith`, `idle` od 11:51                                              | `SKIP: bezczynny 9 min < 10`                  |
| 3   | `agy-career-guide`, `idle` od 11:00                                             | `SKIP: inny projekt`                          |
| 4   | `claude-monolith`, `idle` od 11:00                                              | `SKIP: nie pomocnik`                          |
| 5   | `cursor-monolith`, `working`                                                    | `SKIP: pracuje`                               |
| 6   | `cursor-monolith`, `idle` od 11:00, ekran z „Run this command?"                 | `SKIP: czeka na zgodę`                        |
| 7   | terminal bez nazwy, `agent: antigravity`, `idle` od 11:00                       | `SKIP: bez nazwy`                             |
| 8   | `agy-monolith`, `state` = `finished`                                            | `SKIP: nie działa`                            |
| 9   | `agy-monolith`, `done` od 11:30                                                 | `KILL`                                        |
| 10  | `--force`, `agy-monolith`, `idle` od 11:59                                      | `KILL`                                        |
| 11  | `--force`, `agy-career-guide`, `idle` od 11:00                                  | `SKIP: inny projekt`                          |
| 12  | `--force`, `cursor-monolith`, ekran z „Run this command?"                       | `SKIP: czeka na zgodę`                        |
| 13  | `agy-monolith`, `idle` od 11:50 (równo 10 min)                                  | `KILL`                                        |
| 14  | `--force`, `agy-monolith`, `working`                                            | `SKIP: pracuje`                               |
| 15  | `agy-monolith`, `status.state` = `blocked`, `idle` od 11:00                     | `SKIP: czeka na zgodę`                        |
| 16  | `cursor-monolith`, ekran z „Allow this", ekran bez zmian od 11:00               | `SKIP: czeka na zgodę`                        |
| 17  | `cursor-monolith`, brak `status`, ekran bez zmian od 11:40, bez wskaźnika pracy | `KILL`                                        |
| 18  | `agy-monolith`, `idle` od 11:00, ekran zmienił się 11:59:30                     | `SKIP: ekran zmienił się w ostatniej minucie` |
| 19  | `cursor-monolith`, brak `status`, ekran bez zmian od 11:00, w stopce „Running"  | `SKIP: pracuje`                               |
| 20  | `cursor-monolith`, brak `status`, pierwszy odczyt (brak historii skrótu)        | `SKIP: bezczynny 0 min < 10`                  |

### 3.6 Zmiany w regułach

- `CLAUDE.md` (Monolith): akapit o Cursorze („nie startuj go sam") zastąpić: brak sesji → `scripts/helpers.sh up <rola>`;
  koniec pracy → `scripts/helpers.sh down` (watcher robi to po 10 min); nadal zakaz `agy -p` / `cursor-agent -p`.
- `~/.claude/CLAUDE.md` (globalny): punkt „Brak sesji pomocnika: poproś użytkownika" → „uruchom `helpers.sh up <rola>`
  w projekcie, który ma ten skrypt; w pozostałych poproś użytkownika o `open-agent <rola>`".
- Komunikat hooka `~/.claude/hooks/block-oneshot-helpers.py` i komunikat kodu 1 w `ask-helper.sh`: dopisać `helpers.sh up`.

### 3.7 Czego nie robimy

`ask-helper.sh` **nie** startuje pomocnika sam przy kodzie 1. Start pozostaje jawnym krokiem agenta głównego, żeby nie
uruchamiać procesów jako efektu ubocznego zlecenia. Do ponownej oceny po tygodniu użycia.

### 3.8 Brak odpowiedzi pomocnika: ponowne odpytanie

Dziś `ask-helper.sh` po timeoucie (kod 3) kończy, a agent główny nie wie, czy pomocnik jeszcze pracuje, czy utknął. Cursor nie raportuje
`status`, więc o stanie decyduje ekran. Reguły dla agenta głównego (dotyczą obu pomocników, ale Cursora najbardziej):

1. **Nigdy nie wysyłamy ponownie tego samego zadania.** Ponowny `ask-helper.sh` z tym samym promptem dublowałby pracę, a przy `--role task`
   mógłby podwójnie edytować pliki. Odpytujemy o wynik poprzedniego zadania.
2. **Nowa opcja `ask-helper.sh --collect [--timeout S] <agy|cursor>`:** nie wysyła promptu, tylko czeka na wynik ostatniego zadania
   i wypisuje go tak jak zwykłe wywołanie. Wymaga zapisu w `$STATE_DIR/last-<nazwa>.json` (nazwa terminala, `nonce`, czas wysłania, rola,
   licznik prób `collects`, flaga `nudged`, skrót ekranu); brak pliku lub inny terminal → kod 1 „brak zadania do odebrania".
   `--collect` **sam zlicza próby**: agent po prostu wywołuje go w pętli, a decyzję podejmuje `collect-decide.py`.
3. **Harmonogram po kodzie 3:** kod 3 z `--collect` znaczy „wywołaj `--collect` ponownie" (do trzech prób z `--timeout 120`; czekanie jest
   w skrypcie, więc agent nie używa `sleep`). Jeśli w trakcie pojawi się dialog zgody (`APPROVAL_RE`), `--collect` kończy się kodem 2 i agent pyta użytkownika.
4. **Zapytanie kontrolne (raz):** przy **czwartym** wywołaniu z rzędu, gdy ekran nie ma wskaźnika pracy (`Running|ctrl+c to stop|esc to cancel`)
   i jest identyczny jak na końcu poprzedniego `--collect`, skrypt sam wysyła jedno `hc send <nazwa> "Podaj wynik poprzedniego zadania; zakończ linią GOTOWE: albo UTKNĄŁEM:"`
   (bez `/clear`), ustawia `nudged: true` i czeka jeszcze jedną rundę. Zapytanie pomijamy przy statusie `blocked` lub dialogu zgody.
5. **Dalej nic (kod 4 = raport):** agent mówi użytkownikowi „pomocnik nie odpowiedział po ok. 8 minutach" i podaje ostatnie linie panelu (`hc read --lines 15`). Nie zabija
   go sam; bezczynnego zakończy zwykły `down` po 10 minutach (3.3). Pracujący (wskaźnik pracy) nie jest zabijany, a agent może wrócić do `--collect` później.
6. Zapytanie kontrolne zmienia ekran, więc przesuwa też licznik bezczynności z 3.3 (osłona „ekran zmienił się w ostatniej minucie").

**Przypadki testowe** (`tests/unit/scripts/ask-helper/`, funkcje wybierające akcję na podstawie ekranów i licznika prób):

| #   | Sytuacja                                                          | Oczekiwana akcja                                        |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | kod 3, ekran ze wskaźnikiem pracy                                 | `COLLECT` (kolejna próba)                               |
| 2   | kod 3, 3 próby wyczerpane, ekran bez wskaźnika, dwa równe odczyty | `NUDGE` (jedno zapytanie kontrolne)                     |
| 3   | po `NUDGE` brak wyniku                                            | `REPORT` (raport do użytkownika), bez kolejnego `NUDGE` |
| 4   | kod 3, w ekranie „Run this command?"                              | `ASK_USER` (kod 2), bez `NUDGE`                         |
| 5   | `--collect` bez pliku `last-<nazwa>.json`                         | kod 1                                                   |
| 6   | `--collect` po wyniku z `=== WYNIK ===` za `nonce`                | wypisuje wynik, kod 0                                   |
| 7   | `--collect` z `nonce` innego zadania niż ostatnie w ekranie       | kod 1 (nie myli wyników)                                |

## 4. Część B: `/verify`

### 4.1 Plik i argumenty

`.claude/commands/verify.md`, `allowed-tools: Bash(scripts/ask-helper.sh *), Bash(scripts/helpers.sh *)`.
Argumenty (`$ARGUMENTS`): puste → trzy sprawdzenia; `build` → dodatkowo `npm run build` (z ostrzeżeniem o `.next/` i serwerze 3100);
ścieżki testów → `vitest run <ścieżki>` zamiast pełnego `vitest run` (`tsc` i `lint` zostają).

### 4.2 Wywołanie

```bash
scripts/ask-helper.sh --role task --tier light --fresh --approve-allowed --timeout 600 cursor "<prompt>"
```

Prompt każe cursorowi uruchomić **osobno** (bez pipe, flag i przekierowań poza `2>&1`, bo `approve-check.py` zatwierdza tylko dokładne polecenia).
Bez prefiksu `cd`: `--role task` w `ask-helper.sh` (linia z `PREFIX`) mówi pomocnikowi, że katalog roboczy to już Monolith, a złożone
`cd … && …` wymusza dodatkowe zgody. `approve-check.py` akceptuje oba warianty, więc to tylko kwestia zgodności z promptem skryptu:

```text
npx tsc --noEmit 2>&1
npx vitest run [ścieżki] 2>&1
npm run lint 2>&1
npm run build 2>&1            # tylko z argumentem build
```

Zakaz dla pomocnika: nie edytować plików, nie naprawiać błędów, nie uruchamiać nic poza listą. Format odpowiedzi:
`PRZESZŁO: tsc, vitest (N testów), lint` albo lista `plik:linia — przyczyna` (maks. 30), na końcu `GOTOWE: …` / `UTKNĄŁEM: …`.

### 4.3 Obsługa wyników

| Kod `ask-helper.sh` | Zachowanie komendy                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 0                   | Zdać relację z wyniku. „Przeszło" tylko, gdy wszystkie trzy pozycje są w `PRZESZŁO`; inaczej czytać panel                   |
| 1                   | `scripts/helpers.sh up cursor`, ponowić raz                                                                                 |
| 2                   | Powiedzieć użytkownikowi, że cursor czeka na zgodę; niczego nie zatwierdzać ręcznie                                         |
| 3                   | Nie uznawać za zielone. Zastosować 3.8: do trzech `ask-helper.sh --collect cursor`, jedno zapytanie kontrolne, potem raport |

Przy `/verify` `--timeout 600` pokrywa typowy `vitest`, a ponowne odpytanie (3.8) łapie przypadki wolniejsze od tego limitu.

`/verify` uzupełnia skill `verification-before-completion` (dostarcza dowód), nie zastępuje go.

### 4.4 Testy

Rozszerzyć `tests/unit/scripts/ask-helper/` o przypadki `approve-check.py`: `ALLOW` dla czterech poleceń z 4.2
(z `2>&1`, bez `cd`) oraz `DENY` dla `npx vitest run --coverage`, `npx vitest run tests/a.test.ts --watch` (flaga po ścieżce),
`npm run lint -- --fix`, `npm run build | tail`, `cd /inny/katalog && npx tsc --noEmit`.

## 5. Arsenał (D9)

W `NEXUS/Vault/Arsenal/agents.yaml`, po scaleniu kodu:

- **Skrypty:** `helpers.sh` (`scripts/helpers.sh`, przykład `up all`, `down`, `status`), `open-agent` (`scripts/open-agent`).
- **Presety:** „Weryfikacja: tsc + vitest + lint" z szablonem `scripts/ask-helper.sh --role task --tier light --fresh --approve-allowed cursor "…"`.
- **Kto do czego:** w wierszu Cursora dopisać „uruchamiany przez `helpers.sh up`".

Zmiany w NEXUS: commit i push od razu (zasada użytkownika), ale dopiero gdy skrypty są na `main`.

## 6. Otwarte pytania (do sprawdzenia przy wdrożeniu, nie teraz)

- **E1 Gotowość po `up`.** Czy `cursor-agent` i `agy` startowane `--bg` pokazują okno zaufania do workspace, którego nie ma kto zatwierdzić? Jak rozpoznać
  gotowość (pasek, pole `status`)? Jeśli okno się pojawia, `up` kończy się kodem 2 i informacją „podepnij `hc attach <nazwa>`".
- **E2 Sieroty.** Czy `hc kill` zostawia procesy potomne (agy twierdzi tak, nieweryfikowane)? Test: `ps` przed i po `down` na jednym pomocniku. Jeśli tak, `down` dobija grupę procesów.
- **E3 Znaczenie `status_ms`.** Zakładamy: czas ostatniej zmiany `status` w ms od epoki (dla `agy`; Cursor go nie ma, zob. 3.3). Test: dwa odczyty `hc get` przed i po zleceniu zadania.
- **E4 `clear-helpers.sh`.** Używa starej sesji `herdr`, nie `hc`; do osobnej decyzji (usunięcie albo przepisanie), poza tym specem.

- **E5 Wymuszenie statusu u Cursora (sprawdzone 2026-11-19: nie działa).** `herdr integration install cursor` instaluje tylko hook
  `sessionStart`, który wysyła do gniazda `herdr` **identyfikator sesji** (`pane.report_agent_session`), i to wyłącznie gdy ustawione są
  `HERDR_ENV=1` i `HERDR_PANE_ID` (panele `herdr`, nie terminale `hc`). Stanu `idle`/`working` nie raportuje wcale. Test na żywym
  `cursor-monolith` po instalacji: podczas całej tury (`/clear`, `/model`, odpowiedź) `hc get` zwracał `status: None`, `status_ms: None`.
  Integrację odinstalowano, `~/.cursor/hooks.json` wrócił do `{"hooks": {}}`. **Wniosek:** dla Cursora zostaje liczenie bezczynności
  ze skrótu ekranu (3.3); nie planujemy hooków własnych (możliwe tylko po stronie Cursora, poza zakresem).

## 7. Kolejność wdrożenia

1. `helpers-check.py` + testy (czerwone → zielone), potem `helpers.sh up|down|status`, sprawdzenie E1–E3 na żywych pomocnikach.
2. Przeniesienie `open-agent`, rola `helpers`, dowiązanie.
3. `watch` i test całości (start, 10 min bezczynności, samoczynny stop).
   3a. `ask-helper.sh --collect` i zapis `last-<nazwa>.json` (3.8) z testami.
4. `/verify` + rozszerzenie testów `approve-check.py`.
5. Zmiany reguł (3.6) i wpisy Arsenału (5).

## 8. Opcjonalnie: karta „Pomocnicy" (TUI w zakładce herdr)

Etap po wdrożeniu części A; nie blokuje reszty.

**Możliwości herdr (z `herdr --help`):** `herdr tab create --label --cwd`, `herdr pane run|split`, skróty `[[keys.command]]` w
`~/.config/herdr/config.toml` (typ `shell`, jak dzisiejszy `prefix+backspace`), `herdr notification show`, `herdr pane report-metadata`.
Brak wtyczek i widżetów z własnym interfejsem, więc „karta" to zakładka z panelem, w którym działa mały program terminalowy.

**Zakres:**

- `scripts/helpers-tui.py` (Python `curses`, bez nowych zależności): tabela z `helpers.sh status` (pomocnik, status, minuty bezczynności,
  pamięć), odświeżanie co 5 s.
- Klawisze: `u` start (`helpers.sh up`), `d` stop zaznaczonego, `D` stop wszystkich, `a` podpięcie (`hc attach`), `q` wyjście.
  TUI **tylko wywołuje `helpers.sh`**; reguły `KILL` (3.3) zostają w jednym miejscu.
- Skrót `prefix+h` w `config.toml` otwiera lub aktywuje zakładkę `Pomocnicy` (`herdr tab create --label Pomocnicy`, potem `pane run`).
- Poza zakresem: karta w aplikacji webowej Monolith. Wymagałaby endpointu uruchamiającego i zabijającego procesy, co łamie zasadę
  „zapisy aplikacji idą wyłącznie do `Vault/`".

**Warunek wejścia:** `helpers.sh status --json` (stabilny format) oraz zielone testy `helpers-check.py`.
**Do sprawdzenia:** czy `hc attach` działa z poziomu panelu `herdr` (zagnieżdżenie terminali); jeśli nie, `a` wypisuje polecenie do skopiowania.
