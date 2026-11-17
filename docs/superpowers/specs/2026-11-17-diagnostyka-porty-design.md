# Karta Diagnostyka: porty nasłuchujące w WSL i Windows

Data: 2026-11-17. Status: projekt zatwierdzony przez użytkownika (rozmowa z 2026-11-17), po niezależnej analizie pomocników `agy` (review architektury i bezpieczeństwa) oraz `cursor` (wpływ na istniejący kod); ich uwagi zweryfikowano w kodzie.

## 1. Cel

Użytkownik chce w Monolith dziesiątą kartę „Diagnostyka” (serwis), która pokazuje, jakie porty TCP nasłuchują na komputerze i **co je zajmuje**, żeby miał pełną kontrolę nad uruchomionymi serwerami (dev 3100, prod 3101, vite, backendy, agenci). Do każdego portu karta daje gotową komendę kill do skopiowania. Aplikacja niczego sama nie zabija.

## 2. Decyzje

| ID  | Temat                     | Decyzja                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Zakres systemu            | WSL i Windows razem, w jednej liście, każdy wiersz z oznaczeniem źródła (wybór użytkownika). WSL przez `ss`, Windows przez PowerShell `Get-NetTCPConnection`.                                                                                                                                                                                                                                    |
| D2  | Co pokazujemy             | Tylko porty TCP w stanie LISTEN (wybór użytkownika: „tylko aktywne port + nazwa kto je zajmuje + kill komenda”). Bez UDP i bez połączeń ESTABLISHED.                                                                                                                                                                                                                                             |
| D3  | Akcje                     | Tylko odczyt plus przycisk „Kopiuj kill”: `kill <PID>` (WSL) i `Stop-Process -Id <PID>` (Windows). Aplikacja nie uruchamia komendy (wybór użytkownika).                                                                                                                                                                                                                                          |
| D4  | Miejsce karty             | Dziesiąta karta, po Kodeksie, skrót **Alt+0**, ikona w pasku bocznym i polecenie w palecie Ctrl+K (wybór użytkownika).                                                                                                                                                                                                                                                                           |
| D5  | Ostrzeżenia i wykluczenia | Wiersz własnego procesu Monolitha (PID serwera, tylko WSL) dostaje znacznik „uwaga”; komenda nadal się kopiuje. **Zmiana 2026-11-17 (po obejrzeniu wyniku):** procesy systemowe Windows (`System`, `lsass`, `services`, `wininit`, `svchost`, `csrss`, `smss`) są **wykluczone z listy** (użytkownik szuka serwerów, Dockera i aplikacji, nie portów samego systemu); znacznik „system” zniknął. |
| D6  | Odświeżanie               | Dane pobierane na żądanie: przy wejściu na kartę i po przycisku „Odśwież”. Bez automatycznego odświeżania i bez historii.                                                                                                                                                                                                                                                                        |
| D7  | Prywatność                | Nic nie jest zapisywane (ani do vaulta, ani na dysk). Nie dotyka `Work/` ani `owner`. Komenda procesu jest redagowana na backendzie (D8) i ucinana.                                                                                                                                                                                                                                              |
| D8  | Redakcja                  | Przed zwrotem DTO maskujemy wartości po `--token=`, `--password=`, `--secret=`, `--api-key=`, `TOKEN=`, `PASSWORD=`, `SECRET=` oraz hasła w `://user:haslo@host`; komenda ucięta do 200 znaków.                                                                                                                                                                                                  |
| D9  | Ochrona API               | Bez zmian w `middleware.ts` i `lib/http/localGuard.ts`: `Host` jest sprawdzany dla każdej metody, serwer startuje z `-H 127.0.0.1`, odpowiedź nie ma nagłówków CORS. Endpoint jest tylko `GET`.                                                                                                                                                                                                  |

### Zmiana 2026-11-17 (po obejrzeniu wyniku): istotność portów i scalanie adresów

Cel użytkownika: zobaczyć, co blokuje porty **uruchamianych przez niego aplikacji** (Monolith, TesterAI, vite, backendy, bazy, Docker) i znaleźć „artefakty” po niezamkniętych procesach, a nie wszystko, co nasłuchuje w systemie.

- **D10 (istotność).** `services` oznacza wiersz `relevant: true`, gdy: nazwa procesu zaczyna się od prefiksu z listy dev (`node`, `next-server`, `vite`, `python`, `java`, `dotnet`, `postgres`, `redis`, `nginx`, `docker`, `com.docker` itd.; stała w `services.ts`), albo to serwer Monolitha (`self`), albo proces bez nazwy na porcie ≥1024 (np. root-owy `docker-proxy` bez PID). Reszta (Discord, Steam, NVIDIA, VPN, `agy`, SSH i DNS bez PID) ma `relevant: false`. Widok domyślnie ukrywa wiersze nieistotne i pokazuje „Ukryto: N”; checkbox „Pokaż wszystkie porty” je odsłania. Dotyczy obu źródeł (WSL i Windows).
- **D11 (scalanie).** Jeden wiersz = (źródło, PID, port); adresy IPv4/IPv6 trafiają do `addresses: string[]` (posortowane, bez powtórek), `exposure` = `network`, jeśli którykolwiek adres jest nie-lokalny. Zastępuje to deduplikację po `(source, pid, port, address)`.
- **D12 (projekt procesu).** Spec pierwotnie wyłączał „mapowanie portów na projekty”; na prośbę użytkownika jest wdrożone dla WSL. `lib/ports/wsl.ts` dopisuje `cwd` z `/proc/<pid>/cwd`, a `services` dopasowuje je do `localPath` projektów z vaulta (`bc_projects/services`, prefiks na granicy segmentu, najdłuższy wygrywa, `~` rozwijane). Wynik: `project: { id, name } | null` w modelu i DTO; widok pokazuje „Projekt · proces”, a filtr szuka też po nazwie projektu. Projekty etatowe (`owner: work`) są pomijane (D7), a błąd odczytu vaulta zostawia `project: null` bez psucia listy. `cwd` nie trafia do DTO. Windows nie ma `cwd`, więc tam projektu nie ustalamy. Worktree produkcyjny `<localPath>-prod` (np. `Monolith-prod`, skąd startuje ikona pulpitu) jest przypisywany do tego samego projektu.
- Procesy systemowe Windows (D5) pozostają wykluczone z listy całkowicie.
- Wpływ na typy: `PortListener.address` → `addresses`, nowe pole `relevant`; ten sam kształt w `PortListenerDto`.

## 3. Zmiany w kodzie (ADR-021)

### 3.1 `lib/ports/` (nowa infrastruktura wspólna)

Tylko tu wolno `child_process` i `fs`. Wzorce: `lib/github/gh.ts` (async `execFile`, bez wyjątków) i `lib/herdr/hc-ls.ts` (czysty parser osobno od procesu).

- `types.ts`: `RawListener = { port: number; address: string; pid: number | null; process: string | null; path: string | null; commandLine: string | null }`; `SourceResult = { ok: true; listeners: RawListener[] } | { ok: false; reason: "missing" | "timeout" | "error" }`.
- `parse-ss.ts`: czysty `parseSs(raw: string): RawListener[]`. Obsługuje kolumny `LISTEN Recv-Q Send-Q Local Peer users:(…)`; adres i port dzieli po **ostatnim** `:`, zdejmuje `[...]` i `%iface`; z `users:((…),(…))` bierze pierwszy proces jako właściciela (nazwa i PID), a wiersz bez `users:` ma `pid: null` (np. gniazdo innego użytkownika).
- `parse-windows.ts`: czysty `parseWindowsJson(raw: string): RawListener[]`. Wejście to tablica obiektów `{ LocalAddress, LocalPort, OwningProcess, Name, Path, CommandLine }`; pojedynczy obiekt (PowerShell) traktuje jak tablicę jednoelementową; `null` w `Path` i `CommandLine` zostaje `null`.
- `wsl.ts`: `listWslListeners(): Promise<SourceResult>`: `execFile("ss", ["-ltnpH"])` z limitem 8 s; dla każdego PID dopisuje `commandLine` z `/proc/<pid>/cmdline` (separator `\0` → spacja), błąd odczytu → `null`.
- `windows.ts`: `listWindowsListeners(): Promise<SourceResult>`: `execFile("/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", SCRIPT])` z limitem 8 s; `SCRIPT` to stała (bez danych od użytkownika), kończy się `@(...) | ConvertTo-Json -Compress`, bo jeden obiekt nie byłby tablicą. Brak pliku → `missing`.

### 3.2 `contexts/bc_diagnostics/` (pięć plików)

- `models.ts`: `PortListener = { source: "wsl" | "windows"; port: number; address: string; exposure: "local" | "network"; pid: number | null; process: string; path: string | null; commandLine: string | null; warning: "self" | null }`.
- `repositories.ts`: woła `lib/ports/wsl` i `windows`, mapuje `RawListener` na `PortListener` (bez reguł domeny).
- `services.ts`: `Promise.allSettled` na obu źródłach (awaria jednego nie psuje drugiego); klasyfikacja `exposure` (`local`: `127.0.0.0/8`, `::1`, `::ffff:127.*`; `network`: `0.0.0.0`, `::`, `*`, reszta); `warning` (`self` dla PID serwera Monolitha, `process.pid`, tylko w źródle WSL, bo PID-y Windows to osobna numeracja; procesy systemowe Windows z D5 są pomijane przed klasyfikacją); redakcja i ucięcie komendy (D8); deduplikacja po `(source, pid, port, address)`; sortowanie po porcie, potem źródle; budowa komendy kill (3.4).
- `schemas.ts` (bezpieczny dla klienta): zod i DTO `PortListenerDto` (pola z `models.ts` plus `killCommand: string | null`), `PortsResponseDto = { generatedAt: string; sources: { wsl: SourceStatusDto; windows: SourceStatusDto }; ports: PortListenerDto[] }`, `SourceStatusDto = { ok: true } | { ok: false; reason: "missing" | "timeout" | "error" }`.
- `router.ts`: `GET` → `services` → mapowanie na DTO, `handleServiceError`.
- `app/api/diagnostics/ports/route.ts`: tylko re-eksport handlera.

### 3.3 Komenda kill

`killCommand` powstaje **wyłącznie** z całkowitego dodatniego PID-a (`Number.isInteger(pid) && pid > 0`): `kill ${pid}` dla WSL, `Stop-Process -Id ${pid}` dla Windows. Nigdy z nazwy, ścieżki ani komendy procesu. Przy `pid === null` pole ma wartość `null`, a przycisk jest nieaktywny.

### 3.4 UI i rejestracja karty

- `src/features/diagnostics/`: `DiagnosticsView.tsx` (tabela, filtr po porcie i nazwie procesu, sortowanie, przycisk „Odśwież”, przycisk „Kopiuj kill” w wierszu, znaczniki `local`/`network`, `uwaga`, komunikaty o źródle, które zawiodło), `useDiagnostics.ts` (pobranie i odświeżenie). Importuje z kontekstu tylko `schemas`.
- `src/features/cards/cards.ts`: `CardId` + `"diagnostyka"`, `{ id: "diagnostyka", hotkey: 0, target: { kind: "diagnostics" } }` po Kodeksie, nowy wariant `CardTarget`.
- `src/features/cards/useCardHotkeys.ts`: regex `Digit([1-9])` → `Digit([0-9])`.
- `src/features/cards/useCardNavigation.ts` i `src/App.tsx`: `diagnosticsOpen` i gałąź widoku, wzorem Kodeksu (`codexOpen`), w tym `!diagnosticsOpen` przy warunku Kokpitu.
- i18n: klucze `shell:cards.diagnostyka` (PL i EN), nowy namespace `diagnostics` w `src/i18n/resources.ts`, podpowiedzi „Alt+1…9” → „Alt+0…9” (w tym `statusBar`); test parytetu kluczy ma przejść.
- `src/features/cards/cards.css`: token koloru `--c-diagnostyka` (jak pozostałe karty); `tests/unit/features/cards/cardsCss.test.ts` iteruje po `CARDS`.
- Makieta: `docs/mockups/karty/cards/10-diagnostyka.html` i dziesiąty kafelek w `docs/mockups/karty/index.html`; w `shell.js` przełącznik „źródła danych” przenosimy z Alt+0 na inny klawisz (Alt+0 jest w makiecie zajęty, w aplikacji nie).
- `CLAUDE.md`: dopisać `lib/ports/` do listy infrastruktury wspólnej.

## 4. Testy (Vitest, `tests/unit/…`)

Fixture'y to prawdziwe zrzuty z tej maszyny.

- `parseSs`: linia `LISTEN 0 511 127.0.0.1:3101 0.0.0.0:* users:(("next-server (v1",pid=2562323,fd=22))` → `{ port: 3101, address: "127.0.0.1", pid: 2562323, process: "next-server (v1" }`; linia `LISTEN 0 4096 *:5434 *:*` → `{ port: 5434, address: "*", pid: null }`; linia `[::]:22` → port 22, adres `::`; `[fe80::1%eth0]:8080` → adres `fe80::1`; `users:(("a",pid=1,fd=3),("b",pid=2,fd=4))` → właściciel `a`, PID 1; pusty wynik → `[]`.
- `parseWindowsJson`: tablica z `{"LocalAddress":"::1","LocalPort":42050,"OwningProcess":59140,"Name":"OneDrive.Sync.Service","Path":"C:\\...","CommandLine":null}` → port 42050, `commandLine: null`; pojedynczy obiekt (nie tablica) → jeden element; niepoprawny JSON → wyjątek obsłużony jako `error` w źródle.
- `services`: źródło Windows `{ ok: false, reason: "missing" }` → lista zawiera porty WSL, `sources.windows.ok === false`; ten sam port 3000 z różnymi PID-ami w WSL i Windows → dwa wiersze; ten sam `(source, pid, port, address)` dwa razy → jeden; `127.0.0.1`, `::1`, `::ffff:127.0.0.1` → `local`, `0.0.0.0`, `::`, `*`, `10.255.255.254` → `network`; PID serwera Monolitha w WSL → `warning: "self"` (taki sam numer w Windows → `null`); Windows `lsass`, `svchost`, `System` → pominięte w liście (D5).
- Komenda kill: PID 2562323 → `kill 2562323` (WSL) i `Stop-Process -Id 2562323` (Windows); `null`, `0`, `-5`, `1.5` → `killCommand: null`; nazwa procesu `x; rm -rf ~` nie występuje w komendzie.
- Redakcja: `node app.js --token=abc123 --port 80` → `node app.js --token=*** --port 80`; `postgres://user:haslo@host/db` → `postgres://user:***@host/db`; komenda 500 znaków → 200.
- Karty: aktualizacja testów liczących 9 kart (`cards.test.ts`, `CardRail.test.tsx`, `cardCommands.test.ts`, `useCardHotkeys.test.ts`, `statusBar.test.tsx`, `useCardNavigation.test.ts`): Alt+9 = Kodeks, Alt+0 = Diagnostyka, dziesiąta karta w palecie.
- Parytet i18n PL/EN dla `diagnostics` i `shell:cards.diagnostyka`.
- Test statyczny architektury (`tests/unit/architecture.static.test.ts`) przechodzi **bez zmian**; gdyby wymagał edycji, idzie ona osobnym commitem.

## 5. Weryfikacja przy implementacji

Czerwony test przed zielonym. Poza testami jednostkowymi trzeba sprawdzić ręcznie w działającej aplikacji (nie da się tego zasymulować w fixture'ach): jak `Get-NetTCPConnection` i `ss` zachowują się razem przy `networkingMode=mirrored` (czy ten sam port nie pojawia się dwa razy z tym samym procesem) oraz czas odpowiedzi PowerShella przez interop WSL.

## 6. Poza zakresem

UDP, połączenia ESTABLISHED, zabijanie procesu z aplikacji, automatyczne odświeżanie, historia, mapowanie portów na projekty, zapis czegokolwiek do vaulta.
