# Etap 1-1: karta projektu, rejestr i odczyt — projekt

Data: 2026-11-12
Status: szkic do przeglądu
Nadrzędny spec: `2026-11-11-asystent-lokalny-nexus-design.md` (§6.1 karta projektu, §6.6 karty, §7 etap 1)

## 1. Cel i zakres

Etap 1 (karta projektu) jest za duży na jeden spec i dzieli się na podetapy, każdy z własnym specem, planem i PR:

| Podetap | Zakres                                                                                    |
| ------- | ----------------------------------------------------------------------------------------- |
| **1-1** | **Rejestr + karta Projekty (Alt+4) tylko do odczytu. Ten dokument.**                      |
| 1-2     | Save State (`state.md`) i dziennik decyzji (`devlog.md`) z zapisem; `type`, kamień milowy |
| 1-3     | Tablica zadań projektu (Teraz / Następne / Icebox) z edycją                               |
| 1-4     | Kontekst dla AI i paczka kontekstu (git tylko do odczytu, mapowanie `local_path`)         |
| 1-5     | `owner` (Firma/Moje), `Work/_registry.work.yaml`, strażnik `Work/`                        |

Po 1-1 karta Alt+4 przestaje być zaślepką: pokazuje rejestr projektów z NEXUS i szczegóły wybranego projektu. Rozwiązuje to problem „powrót do projektu po kilku dniach” w wersji do odczytu (zadania, bugi, akapit „Gdzie skończyłem”).

**Poza zakresem 1-1:** zapis jakiegokolwiek pliku, `state.md`, `devlog.md`, edycja zadań, mapowanie `local_path` i git, `Work/`, kamień milowy, `owner`/`type`, kafle statystyk z makiety, akcje przy nieświeżym projekcie.

## 2. Decyzje

| #   | Decyzja                 | Wybór                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Architektura            | Czyste moduły w `lib/nexus/`, odczyt przy każdym żądaniu, bez cache i file watchera (indeks dopiero, gdy wydajność tego wymaga, zob. nadrzędny spec §7)                                                                                                                                                                                                                                  |
| D2  | Metryczka               | Tylko dane, które są w plikach: rejestr + frontmatter `index.md`. `owner` zawsze `personal`, `type` i kamień milowy w 1-2                                                                                                                                                                                                                                                                |
| D3  | Szczegóły               | Zadania, bugi i akapit „Gdzie skończyłem” (tymczasowy Save State do czasu `state.md` z 1-2)                                                                                                                                                                                                                                                                                              |
| D4  | Świeżość                | `last_worked` starszy niż 14 dni = `stale` (próg z `docs/mockups/karty/STAN-W-KODZIE.md`)                                                                                                                                                                                                                                                                                                |
| D5  | Kolejność listy         | Grupy: `active` → pozostałe statusy poza `done` (np. `on_hold`, `blocked`, `maintenance`) → `done` (przygaszone). W grupie malejąco po `last_worked`, brak daty na końcu grupy. `status` wyświetlany jako surowy tekst z rejestru                                                                                                                                                        |
| D6  | `local_path`            | Pokazywany jako niezmieniony tekst. Ścieżki `E:\...` nie istnieją w WSL; mapowanie na `~/projects/...` dopiero w 1-4                                                                                                                                                                                                                                                                     |
| D7  | Parsery plików projektu | Własne, lekkie (`project-sections.ts`). Nie reużywamy `parseTaskLine`: wymaga formatu inline-fieldów i `id`, a `tasks.md` projektów ma `## Blokery / Next / Backlog` i linie `- [ ] **Tytuł** — opis`. `bugs.md` ma inny format: `## Aktywne` / `## Zamknięte`, wpisy `### ID — tytuł` z polami `- **Priorytet:**`, `- **Status:**` (projekty bez bugów mają jedno zdanie bez nagłówków) |

## 3. Moduły (`lib/nexus/`)

Odczyt przez `readVaultFile` i `parseFrontmatter` (`vault-fs.ts`, `frontmatter.ts`). 1-1 nie dotyka `Work/`.

### 3.1 `project-sections.ts`

- `parseSections(markdown: string): { heading: string; body: string }[]` — tnie tekst po nagłówkach `##`, zachowuje kolejność pliku.
- `parseChecklist(body: string): { text: string; done: boolean }[]` — linie `- [ ]` i `- [x]`; tekst zachowuje markdown (np. `**Tytuł** — opis`). Linie niebędące checkboxami (np. `_Brak aktywnych blokerów_`) są pomijane. Dotyczy `tasks.md`.
- `parseBugs(markdown: string): BugEntry[]` — dla `bugs.md`. Wpis zaczyna się od nagłówka `### <ID> — <tytuł>`; `section` to najbliższy wcześniejszy nagłówek `##` (`Aktywne` lub `Zamknięte`), a `priority` i `status` pochodzą z linii `- **Priorytet:** …` i `- **Status:** …` (brak pola = `undefined`). Plik bez nagłówków `###` (np. „Brak znanych bugów.”) daje pustą listę. Pełny opis wpisu nie jest parsowany w 1-1.

### 3.2 `registry.ts`

- `readRegistry(opts?): { entries: RegistryEntry[]; warnings: string[] }` czyta `Projects/_registry.yaml`.
- Struktura pliku: korzeń `projects: [...]` (nie lista w korzeniu); brak klucza lub nie-tablica daje ostrzeżenie i pustą listę.
- `RegistryEntry`: `id`, `name`, `status`, `priority`, `folder`, `localPath` (z klucza `local_path`), `deploy?`, `github?`, `owner: "personal"`.
- `folder` w rejestrze jest już względem korzenia vaulta (np. `Projects/second-brain/`, z końcowym ukośnikiem); moduły używają go bez dodatkowego prefiksu `Projects/`.
- Brak pliku daje `{ entries: [], warnings: [] }`.
- Wpis bez `id` lub `folder` jest pomijany z ostrzeżeniem; nie przerywa listy.

### 3.3 `project.ts`

- `readProjectSummary(entry, today: Date)`: wpis + `lastWorked`, `stateConfidence` (tekst, np. `verified`; nie procent) z frontmattera `index.md` + `freshness`.
- `freshness`: `"fresh"` (≤ 14 dni), `"stale"` (> 14 dni), `"unknown"` (brak lub błędna data `last_worked`). Stała `STALE_AFTER_DAYS = 14`; „dziś” przekazuje wywołujący.
- `readProjectDetail(id, today)`: summary + `tasks` (sekcje `{ heading, items }`), `bugs` (`BugEntry[]`), `whereIStopped` (tekst sekcji `## Gdzie skończyłem` z `index.md` do następnego nagłówka `##` (np. `## Historia sesji`), albo `null`).
- Nieznany `id` rzuca `NotFoundError` (nowa klasa w `lib/errors.ts`, `extends DomainError`, kod 404).
- Brak `tasks.md`, `bugs.md` lub sekcji daje puste pola, nie błąd.

### 3.4 Reguły

- Zero zapisów. Brak `NEXUS_VAULT_PATH` rzuca `VaultConfigError` (jak w pozostałych repozytoriach).
- **Błędy pojedynczego projektu nie psują listy.** W `readProjectSummary` (lista) wyjątek odczytu (`PathOutsideVaultError`, `WorkAreaBlockedError`, błąd I/O, zepsuty frontmatter) trafia do `warnings` w postaci `<id>: <komunikat>`, a projekt pokazuje się z danymi z rejestru i `freshness: "unknown"`. W `readProjectDetail` te same błędy są rzucane i `handleServiceError` mapuje je na ich kody (oba błędy dziedziczą po `DomainError`).
- `folder` z rejestru przechodzi przez `resolveInsideVault(vaultRoot, rel, opts?)`; wpis w rodzaju `../../x` kończy się `PathOutsideVaultError`, nie odczytem spoza vaulta. Wpis wskazujący na `Work/` kończy się `WorkAreaBlockedError` (strażnik z 0f; 1-1 nie przekazuje `allowWork`).
- `id` z URL służy wyłącznie do wyszukania wpisu w rejestrze; ścieżkę zawsze buduje `folder` z rejestru.

## 4. API

Wzorzec: `route.ts` → `services/projectService.ts` → `lib/nexus/`, błędy przez `handleServiceError`. Tylko `GET`, bez body, więc bez schematów walidacji.

- `GET /api/projects` → `{ projects: ProjectSummary[], warnings: string[] }`, kolejność wg D5.
- `GET /api/projects/[id]` → `ProjectDetail`; nieznany `id` daje 404.
- `projectService` dodaje tylko `new Date()` jako „dziś”.
- **Prefiks tras:** istniejące trasy (`app/api/notes`, `tasks`, `tags`…) nie mają prefiksu `nexus`, więc nowe też go nie dostają. Nadrzędny spec §4.1 mówił o `/api/nexus/*`; ta nazwa nie została przyjęta w 0c–0d i 1-1 trzyma się praktyki z kodu.
- **Błędy konfiguracji:** `VaultConfigError` nie jest `DomainError`, więc `handleServiceError` zwraca 500 z `message`. UI pokazuje komunikat z body odpowiedzi (nie rozpoznaje typu błędu po stronie klienta).

## 5. UI (`src/features/projects/`)

Wzorzec wizualny: `docs/mockups/karty/cards/04-projekty.html`, tokeny z `tokens.css`.

- `ProjectsView.tsx` zastępuje zaślepkę w karcie Alt+4. `CardTarget` (`src/features/cards/cards.ts`) ma dziś tylko `home | planning | placeholder`, więc dochodzi nowy rodzaj celu `projects`. Pliki do zmiany: `cards.ts` (typ i wpis `projekty`), `useCardNavigation.ts` (`selectCard` i stan aktywnego widoku), `src/App.tsx` (render widoku), testy `tests/unit/features/cards/cards.test.ts` i `useCardNavigation.test.ts` (przypadki dla `projekty` przestają oczekiwać `placeholder`).
- `useProjects.ts`: pobiera listę i szczegóły przez wstrzykiwane `apiFetch` (`src/lib/apiFetch.ts`, jak w pozostałych widokach; w testach podmieniane atrapą), stany `loading` / `error` / `empty`; wybrany `id` w stanie komponentu, domyślnie pierwszy z listy.
- **Rejestr (lewa kolumna):** nazwa, odznaki (status, priorytet), `last_worked`, `state_confidence` (tekst, np. „verified”; w makiecie jest procent, ale dane mają tylko tekst). Projekt `stale` ma ramkę ostrzegawczą (`.prj-item--stale`), `done` jest przygaszony i na końcu.
- **Teczka (prawa kolumna):** nagłówek z metryczką i linkami (repo, deploy, `local_path` jako tekst); blok „Gdzie skończyłem”; trzy kolumny zadań (tylko odczyt); lista bugów (aktywne w całości, zamknięte jako licznik).
- Błędy: `VaultConfigError` → komunikat „Ustaw NEXUS_VAULT_PATH”; pusty rejestr → „Brak projektów w rejestrze”; `warnings` jako dyskretny pasek nad listą.
- Dostępność: lista to `<ul>` z przyciskami, wybrany element ma `aria-current`.

## 6. Testy

Zasada: testy powstają w kroku wykonania (czerwony → zielony). Domyślne środowisko vitest to `jsdom` (`vitest.config.ts`), więc testy `lib/nexus`, serwisu i tras API dostają pragmę `// @vitest-environment node` (tymczasowy vault, jak w istniejących testach). Testy komponentów zostają w `jsdom`.

| Moduł (plik testu)                                        | Przypadek                                                                                                                        | Oczekiwanie                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `project-sections` (`tests/unit/lib/nexus/`)              | `## Blokery`, `## Next`, `## Backlog`                                                                                            | trzy sekcje w kolejności pliku                                                                                           |
| `project-sections`                                        | `- [ ] **A** — opis` i `- [x] B`                                                                                                 | `{text:"**A** — opis", done:false}`, `{text:"B", done:true}`                                                             |
| `project-sections`                                        | `_Brak aktywnych blokerów_`                                                                                                      | sekcja pusta                                                                                                             |
| `project-sections`                                        | `## Gdzie skończyłem` przed `## Historia sesji`                                                                                  | tekst tylko do następnego nagłówka `##`                                                                                  |
| `project-sections`                                        | `parseBugs`: `## Aktywne` + `### GP-001 — …` z `**Priorytet:** medium`, `**Status:** otwarty`; `## Zamknięte` + `### EA-001 — …` | dwa wpisy z `section`, `priority`, `status`                                                                              |
| `project-sections`                                        | `parseBugs`: „Brak znanych bugów.” bez nagłówków                                                                                 | pusta lista                                                                                                              |
| `registry`                                                | brak pliku                                                                                                                       | `entries: []`                                                                                                            |
| `registry`                                                | wpis bez `id`                                                                                                                    | pominięty, jedno ostrzeżenie                                                                                             |
| `registry`                                                | `projects:` zamiast listy w korzeniu; brak klucza                                                                                | wpisy odczytane; brak klucza daje ostrzeżenie                                                                            |
| `registry`                                                | `local_path`                                                                                                                     | pole `localPath`                                                                                                         |
| `project`                                                 | `folder: ../../x` / `folder: Work/x/`                                                                                            | szczegóły: `PathOutsideVaultError` / `WorkAreaBlockedError`; lista: ostrzeżenie w `warnings`, reszta projektów bez zmian |
| `project`                                                 | `last_worked` 14 dni / 15 dni / brak                                                                                             | `fresh` / `stale` / `unknown`                                                                                            |
| `project`                                                 | brak `tasks.md` i `bugs.md`                                                                                                      | puste listy, bez błędu                                                                                                   |
| `project`                                                 | nieznany `id`                                                                                                                    | `NotFoundError`                                                                                                          |
| API (`tests/unit/api/projects.test.ts`)                   | lista                                                                                                                            | 200, kolejność wg D5 (`active`, pozostałe, `done`)                                                                       |
| API                                                       | `[id]`: istniejący / nieznany                                                                                                    | 200 / 404                                                                                                                |
| API                                                       | brak `NEXUS_VAULT_PATH`                                                                                                          | 500 z komunikatem o `NEXUS_VAULT_PATH` w body                                                                            |
| Komponent (`tests/unit/features/projects/`)               | ładowanie, błąd, pusta lista                                                                                                     | odpowiednie stany                                                                                                        |
| Komponent                                                 | wybór projektu; `stale`; `done`                                                                                                  | przełącza teczkę; klasa ostrzegawcza; `done` ostatni                                                                     |
| Statyczny (`tests/unit/projects-readonly.static.test.ts`) | moduły 1-1 importują `writeVaultFile`/`updateVaultFile`/`deleteVaultFile`                                                        | żaden nie importuje (karta tylko do odczytu)                                                                             |

**Bramka:** `npx vitest`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (zlecane `cursor`: „przeszło” albo `plik:linia + przyczyna`), review diffa przez `agy --role review`, smoke test na prawdziwym vaulcie (7 projektów z rejestru, `second-brain` ma sekcję „Gdzie skończyłem”).

## 7. Zadania planu

Kolejność = commity, każdy się kompiluje.

1. `project-sections.ts` (sekcje, checklisty, `parseBugs`) + testy.
2. `NotFoundError` w `lib/errors.ts`, `registry.ts` + testy.
3. `project.ts` (summary, detail, świeżość) + testy.
4. `projectService.ts` i dwie trasy API + testy.
5. `useProjects.ts` (z `apiFetch`) i `ProjectsView.tsx` + testy komponentu.
6. Nowy cel karty `projects` (`cards.ts`, `useCardNavigation.ts`, `App.tsx` + ich testy), test statyczny read-only, aktualizacja `STAN-W-KODZIE.md`, README i speców.
7. Bramka weryfikacji, review `agy`, smoke test.
