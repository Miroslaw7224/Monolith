# Etap 1-1: karta projektu, rejestr i odczyt — projekt

Data: 2026-11-12
Status: zaakceptowany (2026-11-12); poprawka warstw po analizie struktury (§3)
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

**Poza zakresem 1-1:** zapis jakiegokolwiek pliku, `state.md`, `devlog.md`, edycja zadań, mapowanie `local_path` i git, `Work/`, kamień milowy, `owner`/`type`, kafle statystyk z makiety, akcje przy nieświeżym projekcie. Porządki struktury całego repo (test architektury, typy board/mind-map poza `src/`, zmiana nazwy `lib/firestore-db.ts`, przenosiny `src/components/` do `src/features/`) idą osobnymi PR (§8).

## 2. Decyzje

| #   | Decyzja                 | Wybór                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Architektura            | Warstwy z ADR-014 i notatek vaulta (§3.0): czysty parser, repozytorium jako jedyny dostęp do plików, reguły w serwisie. Odczyt przy każdym żądaniu, bez cache i file watchera (indeks dopiero, gdy wydajność tego wymaga, zob. nadrzędny spec §7)                                                                                                                                        |
| D2  | Metryczka               | Tylko dane, które są w plikach: rejestr + frontmatter `index.md`. `owner` zawsze `personal`, `type` i kamień milowy w 1-2                                                                                                                                                                                                                                                                |
| D3  | Szczegóły               | Zadania, bugi i akapit „Gdzie skończyłem” (tymczasowy Save State do czasu `state.md` z 1-2)                                                                                                                                                                                                                                                                                              |
| D4  | Świeżość                | `last_worked` starszy niż 14 dni = `stale` (próg z `docs/mockups/karty/STAN-W-KODZIE.md`)                                                                                                                                                                                                                                                                                                |
| D5  | Kolejność listy         | Grupy: `active` → pozostałe statusy poza `done` (np. `on_hold`, `blocked`, `maintenance`) → `done` (przygaszone). W grupie malejąco po `last_worked`, brak daty na końcu grupy. `status` wyświetlany jako surowy tekst z rejestru                                                                                                                                                        |
| D6  | `local_path`            | Pokazywany jako niezmieniony tekst. Ścieżki `E:\...` nie istnieją w WSL; mapowanie na `~/projects/...` dopiero w 1-4                                                                                                                                                                                                                                                                     |
| D7  | Parsery plików projektu | Własne, lekkie (`project-sections.ts`). Nie reużywamy `parseTaskLine`: wymaga formatu inline-fieldów i `id`, a `tasks.md` projektów ma `## Blokery / Next / Backlog` i linie `- [ ] **Tytuł** — opis`. `bugs.md` ma inny format: `## Aktywne` / `## Zamknięte`, wpisy `### ID — tytuł` z polami `- **Priorytet:**`, `- **Status:**` (projekty bez bugów mają jedno zdanie bez nagłówków) |
| D8  | Typy                    | Kształty danych projektu w `types/projects.ts` (warstwa wspólna). UI importuje stamtąd tylko typy; nigdy `services/` ani `lib/nexus/`                                                                                                                                                                                                                                                    |

## 3. Moduły i warstwy

### 3.0 Warstwy

Źródła: `NEXUS/Vault/Knowledge/struktura-jako-uprzaz.md` (kierunek przepływu, „każda warstwa woła tylko następną”, testy pilnują kierunku), `struktury-projektu.md` (repozytorium jako jedyny kod rozmawiający z magazynem, reguły w serwisie, osobny kształt danych na wejściu/wyjściu), `testowanie/testy-architektoniczne-ai.md` oraz `docs/adr/014-layer-separation-and-service-layer.md`.

```
src/features/projects/   UI: widok, hook danych (apiFetch), podkomponenty
  ↓ fetch /api/projects
app/api/projects/        trasy: tylko HTTP, wołają serwis
  ↓
services/projectService  reguły: świeżość, kolejność, NotFound, błędy projektu → warnings
  ↓ przez barrel lib/firestore-db.ts (jak pozostałe serwisy)
lib/nexus/repos/projects jedyny dostęp do plików (readVaultFile), mapowanie YAML/frontmatter → typy
  ↓
lib/nexus/project-sections  czysty tekst (bez vault-fs), jak markdown-edit.ts
types/projects.ts        typy wspólne dla wszystkich warstw
```

Dlaczego tak, a nie `lib/nexus/registry.ts` + `project.ts`: test `tests/unit/lib/nexus/repos-static.test.ts` wymusza dokładną listę plików importujących `vault-fs` (`yaml-store.ts` + repozytoria plikowe). Nowy dostęp do plików musi więc być repozytorium w `lib/nexus/repos/` i trafić na tę listę. Świeżość i kolejność listy to reguły, więc należą do serwisu, nie do repozytorium.

### 3.1 `lib/nexus/project-sections.ts` (czysty tekst)

- `parseSections(markdown: string): { heading: string; body: string }[]` — tnie tekst po nagłówkach `##`, zachowuje kolejność pliku; sekcja kończy się na następnym `##` albo końcu pliku.
- `parseChecklist(body: string): ChecklistItem[]` (`{ text, done }`) — linie `- [ ]` i `- [x]`; tekst zachowuje markdown (np. `**Tytuł** — opis`). Linie niebędące checkboxami (np. `_Brak aktywnych blokerów_`) są pomijane. Dotyczy `tasks.md`.
- `parseBugs(markdown: string): BugEntry[]` — dla `bugs.md`. Wpis zaczyna się od nagłówka `### <ID> — <tytuł>`; `section` to najbliższy wcześniejszy nagłówek `##` (`Aktywne` lub `Zamknięte`), a `priority` i `status` pochodzą z linii `- **Priorytet:** …` i `- **Status:** …` (brak pola = `undefined`). Plik bez nagłówków `###` (np. „Brak znanych bugów.”) daje pustą listę. Pełny opis wpisu nie jest parsowany w 1-1.
- Nie importuje `vault-fs`, `node:fs` ani `process.env`.

### 3.2 `lib/nexus/repos/projects.ts` (repozytorium)

- `readRegistry(): { entries: RegistryEntry[]; warnings: string[] }` czyta `Projects/_registry.yaml`.
  - Korzeń pliku to `projects: [...]`; brak klucza lub nie-tablica daje ostrzeżenie i pustą listę. Brak pliku daje `{ entries: [], warnings: [] }`.
  - Mapowanie: `local_path` → `localPath`, `owner: "personal"` (stałe w 1-1), `deploy?`, `github?`.
  - Wpis bez `id` lub `folder` jest pomijany z ostrzeżeniem; nie przerywa listy.
  - `folder` jest już względem korzenia vaulta (np. `Projects/second-brain/`); bez dodatkowego prefiksu `Projects/`.
- `readProjectIndex(entry): ProjectIndex` — frontmatter `index.md` (`lastWorked` jako tekst, `stateConfidence` jako tekst, np. `verified`) i `whereIStopped` (sekcja `## Gdzie skończyłem` albo `null`). Brak pliku daje puste pola.
- `readProjectContent(entry): { tasks: ChecklistSection[]; bugs: BugEntry[] }` — `tasks.md` przez `parseSections` + `parseChecklist`, `bugs.md` przez `parseBugs`. Brak pliku daje puste listy.
- Ścieżki: `folder` przechodzi przez `readVaultFile` → `resolveInsideVault`; `../../x` daje `PathOutsideVaultError`, `Work/...` daje `WorkAreaBlockedError` (strażnik z 0f; repozytorium nie przekazuje `allowWork`).
- Repozytorium nie zna „dziś”, nie sortuje i nie łapie błędów: zwraca dane albo rzuca.
- Eksport przez barrel `lib/firestore-db.ts` (jak pozostałe repozytoria).

### 3.3 `services/projectService.ts` (reguły)

- `listProjects(today = new Date()): { projects: ProjectSummary[]; warnings: string[] }`
  - dla każdego wpisu `readProjectIndex`; wyjątek pojedynczego projektu (`PathOutsideVaultError`, `WorkAreaBlockedError`, I/O, zepsuty frontmatter) trafia do `warnings` jako `<id>: <komunikat>`, a projekt zostaje z danymi z rejestru i `freshness: "unknown"`;
  - `VaultConfigError` nie jest łapany (dotyczy całości, nie projektu);
  - kolejność wg D5.
- `getProject(id, today = new Date()): ProjectDetail` — nieznany `id` rzuca `NotFoundError` (nowa klasa w `lib/errors.ts`, `extends DomainError`, kod 404); błędy odczytu są rzucane dalej.
- `freshness(lastWorked: string | undefined, today: Date): Freshness` — `"fresh"` (≤ 14 dni), `"stale"` (> 14 dni), `"unknown"` (brak lub błędna data). Stała `STALE_AFTER_DAYS = 14`, eksportowana do testów.
- `id` z URL służy wyłącznie do wyszukania wpisu w rejestrze; ścieżkę zawsze buduje `folder` z rejestru.

### 3.4 `types/projects.ts`

`RegistryEntry`, `ProjectIndex`, `ChecklistItem`, `ChecklistSection` (`{ heading, items }`), `BugEntry` (`{ id, title, section, priority?, status? }`), `Freshness`, `ProjectSummary` (wpis + `lastWorked?`, `stateConfidence?`, `freshness`), `ProjectDetail` (summary + `tasks`, `bugs`, `whereIStopped`). Same typy, bez kodu.

### 3.5 Reguły wspólne

- Zero zapisów. Brak `NEXUS_VAULT_PATH` rzuca `VaultConfigError` (jak w pozostałych repozytoriach).
- Kierunek importów: `src/features/projects` → (`types/`, `src/lib/apiFetch`); trasy → serwis; serwis → barrel + `lib/errors`; repozytorium → `vault-fs`, `frontmatter`, `project-sections`, `types/`. Pilnuje tego test statyczny (§6).

## 4. API

Wzorzec: `route.ts` → `services/projectService.ts`, błędy przez `handleServiceError`. Tylko `GET`, bez body, więc bez schematów walidacji.

- `GET /api/projects` (`app/api/projects/route.ts`) → `{ projects: ProjectSummary[], warnings: string[] }`, kolejność wg D5.
- `GET /api/projects/[id]` (`app/api/projects/[id]/route.ts`) → `ProjectDetail`; nieznany `id` daje 404.
- **Prefiks tras:** istniejące trasy (`app/api/notes`, `tasks`, `tags`…) nie mają prefiksu `nexus`, więc nowe też go nie dostają. Nadrzędny spec §4.1 mówił o `/api/nexus/*`; ta nazwa nie została przyjęta w 0c–0d i 1-1 trzyma się praktyki z kodu.
- **Błędy konfiguracji:** `VaultConfigError` nie jest `DomainError`, więc `handleServiceError` zwraca 500 z `message`. UI pokazuje komunikat z body odpowiedzi (nie rozpoznaje typu błędu po stronie klienta).

## 5. UI (`src/features/projects/`)

Wzorzec wizualny: `docs/mockups/karty/cards/04-projekty.html`, tokeny z `tokens.css`.

**Siatka plików modułu** (wzorzec dla kolejnych kart, zob. §8):

| Plik                 | Rola                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `ProjectsView.tsx`   | wejście karty: układ dwóch kolumn, stany `loading` / `error` / `empty` |
| `useProjects.ts`     | dane: lista i szczegóły przez wstrzykiwane `apiFetch`, wybrany `id`    |
| `ProjectList.tsx`    | rejestr (lewa kolumna)                                                 |
| `ProjectDossier.tsx` | teczka wybranego projektu (prawa kolumna)                              |
| `projects.css`       | style z prefiksem `.prj-` (jak `cards.css`)                            |

- `ProjectsView.tsx` zastępuje zaślepkę w karcie Alt+4. `CardTarget` (`src/features/cards/cards.ts`) ma dziś tylko `home | planning | placeholder`, więc dochodzi nowy rodzaj celu `projects`. Pliki do zmiany: `cards.ts` (typ i wpis `projekty`), `useCardNavigation.ts` (`selectCard` i stan aktywnego widoku), `src/App.tsx` (render widoku), testy `tests/unit/features/cards/cards.test.ts` i `useCardNavigation.test.ts` (przypadki dla `projekty` przestają oczekiwać `placeholder`).
- `useProjects.ts`: `apiFetch` z `src/lib/apiFetch.ts` (jak w pozostałych widokach; w testach atrapa); wybrany `id` w stanie, domyślnie pierwszy z listy.
- **Rejestr:** nazwa, odznaki (status, priorytet), `last_worked`, `state_confidence` (tekst, np. „verified”; w makiecie jest procent, ale dane mają tylko tekst). Projekt `stale` ma ramkę ostrzegawczą (`.prj-item--stale`), `done` jest przygaszony i na końcu.
- **Teczka:** nagłówek z metryczką i linkami (repo, deploy, `local_path` jako tekst); blok „Gdzie skończyłem”; trzy kolumny zadań (tylko odczyt); lista bugów (aktywne w całości, zamknięte jako licznik).
- Błędy: komunikat z body odpowiedzi (np. o `NEXUS_VAULT_PATH`); pusty rejestr → „Brak projektów w rejestrze”; `warnings` jako dyskretny pasek nad listą.
- Dostępność: lista to `<ul>` z przyciskami, wybrany element ma `aria-current`.

## 6. Testy

Zasada: testy powstają w kroku wykonania (czerwony → zielony). Układ testów odbija układ kodu. Domyślne środowisko vitest to `jsdom` (`vitest.config.ts`), więc testy parsera, repozytorium, serwisu i tras API dostają pragmę `// @vitest-environment node`. Testy komponentów zostają w `jsdom`.

| Plik testu                                         | Przypadek                                                                                                                               | Oczekiwanie                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `tests/unit/lib/nexus/project-sections.test.ts`    | `## Blokery`, `## Next`, `## Backlog`                                                                                                   | trzy sekcje w kolejności pliku                                                    |
| 〃                                                 | `- [ ] **A** — opis` i `- [x] B`                                                                                                        | `{text:"**A** — opis", done:false}`, `{text:"B", done:true}`                      |
| 〃                                                 | `_Brak aktywnych blokerów_`                                                                                                             | sekcja pusta                                                                      |
| 〃                                                 | `## Gdzie skończyłem` przed `## Historia sesji`                                                                                         | tekst tylko do następnego nagłówka `##`                                           |
| 〃                                                 | `parseBugs`: `## Aktywne` + `### GP-001 — …` z `**Priorytet:** medium`, `**Status:** otwarty`; `## Zamknięte` + `### EA-001 — …`        | dwa wpisy z `section`, `priority`, `status`                                       |
| 〃                                                 | `parseBugs`: „Brak znanych bugów.” bez nagłówków                                                                                        | pusta lista                                                                       |
| `tests/unit/lib/nexus/repos/projects.test.ts`      | brak `_registry.yaml`                                                                                                                   | `entries: []`                                                                     |
| 〃                                                 | wpis bez `id`; brak klucza `projects`                                                                                                   | pominięty z jednym ostrzeżeniem; ostrzeżenie i pusta lista                        |
| 〃                                                 | `local_path`                                                                                                                            | pole `localPath`                                                                  |
| 〃                                                 | `folder: ../../x` / `folder: Work/x/`                                                                                                   | `PathOutsideVaultError` / `WorkAreaBlockedError`                                  |
| 〃                                                 | brak `tasks.md`, `bugs.md`, `index.md`                                                                                                  | puste listy i pola, bez błędu                                                     |
| `tests/unit/services/projectService.test.ts`       | `freshness`: 14 dni / 15 dni / brak / `"abc"`                                                                                           | `fresh` / `stale` / `unknown` / `unknown`                                         |
| 〃                                                 | lista z `active`, `on_hold`, `done` i różnymi datami                                                                                    | kolejność wg D5                                                                   |
| 〃                                                 | `readProjectIndex` rzuca dla jednego projektu                                                                                           | ostrzeżenie `<id>: …`, pozostałe projekty bez zmian, ten z `freshness: "unknown"` |
| 〃                                                 | nieznany `id`                                                                                                                           | `NotFoundError`                                                                   |
| `tests/unit/api/projects.test.ts`                  | lista / `[id]` istniejący / nieznany                                                                                                    | 200 / 200 / 404                                                                   |
| 〃                                                 | serwis rzuca `VaultConfigError`                                                                                                         | 500 z komunikatem o `NEXUS_VAULT_PATH` w body                                     |
| `tests/unit/features/projects/*.test.tsx`          | ładowanie, błąd, pusta lista                                                                                                            | odpowiednie stany                                                                 |
| 〃                                                 | wybór projektu; `stale`; `done`                                                                                                         | przełącza teczkę; klasa ostrzegawcza; `done` ostatni                              |
| `tests/unit/lib/nexus/repos-static.test.ts` (zm.)  | `repos/projects.ts` na liście importerów `vault-fs`; `project-sections.ts` bez `vault-fs`                                               | test przechodzi z nową listą                                                      |
| `tests/unit/projects-layers.static.test.ts` (nowy) | pliki 1-1 importują `writeVaultFile`/`updateVaultFile`/`deleteVaultFile`; `src/features/projects` importuje `services/` lub `lib/nexus` | żaden (karta tylko do odczytu, UI tylko przez API)                                |

**Bramka:** `npx vitest`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (zlecane `cursor`: „przeszło” albo `plik:linia + przyczyna`), review diffa przez `agy --role review`, smoke test na prawdziwym vaulcie (7 projektów z rejestru, `second-brain` ma sekcję „Gdzie skończyłem”).

## 7. Zadania planu

Kolejność = commity, każdy się kompiluje.

1. `types/projects.ts` i `lib/nexus/project-sections.ts` + testy.
2. `NotFoundError` w `lib/errors.ts`; `lib/nexus/repos/projects.ts`, eksport w barrelu, aktualizacja `repos-static.test.ts` + testy repozytorium.
3. `services/projectService.ts` (świeżość, kolejność, ostrzeżenia, NotFound) + testy.
4. Dwie trasy API + testy.
5. `src/features/projects/` (siatka z §5) + testy komponentów.
6. Nowy cel karty `projects` (`cards.ts`, `useCardNavigation.ts`, `App.tsx` + ich testy), `projects-layers.static.test.ts`, aktualizacja `STAN-W-KODZIE.md`, README i speców.
7. Bramka weryfikacji, review `agy`, smoke test.

## 8. Porządki struktury poza 1-1 (osobne PR)

Wynik analizy repo względem notatek vaulta (§3.0). Nie wchodzą do 1-1, żeby nie mieszać przenosin z nową funkcją.

- **PR „warstwy” (przed implementacją 1-1, mały):** typy i schemat board/mind-map z `src/features/` do `types/` i `lib/validation/` (dziś `services/boardService.ts` i `mindMapService.ts` importują z UI); globalny `tests/unit/architecture.static.test.ts` (`src/` ↛ `services/`, `lib/nexus`; `app/api/` ↛ `lib/nexus`; `services/`, `lib/` ↛ `src/`); zmiana nazwy `lib/firestore-db.ts` → `lib/nexus/repos/index.ts` i funkcji `*Firestore` w zasobach. Jeśli wejdzie przed 1-1, zadanie 2 eksportuje repozytorium przez nowy barrel.
- **PR „moduły” (po 1-1, mechaniczny):** `src/components/` → `src/features/{calendar,tasks,resources,tags,notes,sessions}` według siatki z §5; w `src/components/` zostają `layout/`, `theme/`, `brand/`; `src/lib/mindMapUtils.ts` → `src/features/mind-maps/`; testy przeniesione lustrzanie; ADR o siatce modułu.
- **Przy okazji:** `lib/http/` dla pomocników HTTP (`apiError`, `parseBody`, `inferHttpStatus`, `uploadFormFile`, `localGuard`).
