# Etap 1-1: karta projektu, rejestr i odczyt — projekt

Data: 2026-11-12
Status: zaakceptowany (2026-11-12); przepisany na kontekst `contexts/bc_projects/` po decyzji o strukturze. Wykonanie czeka na akceptację specu struktury (dziś „szkic do przeglądu”) i merge jego PR 1
Nadrzędne: `2026-11-11-asystent-lokalny-nexus-design.md` (§6.1 karta projektu, §6.6 karty, §7 etap 1), `2026-11-12-struktura-kontekstow-design.md` (siatka kontekstu, reguły importów)

## 1. Cel i zakres

Etap 1 (karta projektu) dzieli się na podetapy, każdy z własnym specem, planem i PR:

| Podetap | Zakres                                                                                    |
| ------- | ----------------------------------------------------------------------------------------- |
| **1-1** | **Rejestr + karta Projekty (Alt+4) tylko do odczytu. Ten dokument.**                      |
| 1-2     | Save State (`state.md`) i dziennik decyzji (`devlog.md`) z zapisem; `type`, kamień milowy |
| 1-3     | Tablica zadań projektu (Teraz / Następne / Icebox) z edycją                               |
| 1-4     | Kontekst dla AI i paczka kontekstu (git tylko do odczytu, mapowanie `local_path`)         |
| 1-5     | `owner` (Firma/Moje), `Work/_registry.work.yaml`, strażnik `Work/`                        |

Po 1-1 karta Alt+4 przestaje być zaślepką: pokazuje rejestr projektów z NEXUS i szczegóły wybranego projektu (zadania, bugi, akapit „Gdzie skończyłem”). 1-1 jest pierwszym kontekstem `bc_*` w repo i wzorcem dla migracji pozostałych domen.

**Warunek wstępny:** PR 1 „fundament” ze specu struktury (`lib/http/`, test architektury, ADR-021) jest zmergowany.

**Poza zakresem 1-1:** zapis jakiegokolwiek pliku, `state.md`, `devlog.md`, edycja zadań, mapowanie `local_path` i git, `Work/`, kamień milowy, `owner`/`type`, kafle statystyk z makiety, akcje przy nieświeżym projekcie, migracja innych domen.

## 2. Decyzje

| #   | Decyzja                 | Wybór                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Architektura            | Kontekst `contexts/bc_projects/` z siatką `router` / `schemas` / `models` / `services` / `repositories` (spec struktury §4). Odczyt przy każdym żądaniu, bez cache i file watchera                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D2  | Metryczka               | Tylko dane, które są w plikach: rejestr + frontmatter `index.md`. `owner` zawsze `personal`, `type` i kamień milowy w 1-2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D3  | Szczegóły               | Zadania, bugi i akapit „Gdzie skończyłem” (tymczasowy Save State do czasu `state.md` z 1-2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D4  | Świeżość                | `last_worked` starszy niż 14 dni = `stale` (próg z `docs/mockups/karty/STAN-W-KODZIE.md`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D5  | Kolejność listy         | Grupy: `active` → pozostałe statusy poza `done` (np. `on_hold`, `blocked`, `maintenance`) → `done` (przygaszone). W grupie malejąco po `last_worked`, brak daty na końcu grupy; remis po `name`. `status` wyświetlany jako surowy tekst z rejestru                                                                                                                                                                                                                                                                                                                                                             |
| D6  | `local_path`            | Pokazywany jako niezmieniony tekst. Ścieżki `E:\...` nie istnieją w WSL; mapowanie na `~/projects/...` dopiero w 1-4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D7  | Parsery plików projektu | Własne, lekkie, w `repositories/markdown.ts`. Nie reużywamy `parseTaskLine`: wymaga formatu inline-fieldów i `id`, a `tasks.md` projektów ma `## Blokery / Next / Backlog` i linie `- [ ] **Tytuł** — opis`. `bugs.md` ma inny format: `## Aktywne` / `## Zamknięte`, wpisy `### ID — tytuł` z polami `- **Priorytet:**`, `- **Status:**`. W vaulcie (stan 2026-11-12) sekcje mają tylko 2 z 7 projektów: `gen-podsum-ai` ma samo `## Aktywne`, `english-agent` ma dodatkowo `## Ostrzeżenia z builda` bez wpisów `###`; pozostałe 5 to jedno zdanie bez nagłówków. Parser nie zakłada obecności żadnej sekcji |
| D8  | Dwa kształty danych     | `models` trzyma pole wewnętrzne `folder` (ścieżka w vaulcie); DTO w `schemas` go nie zwraca. UI zna tylko DTO                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 3. Kontekst `contexts/bc_projects/`

```
app/api/projects/route.ts          export { listProjects as GET } from "@/contexts/bc_projects/router"
app/api/projects/[id]/route.ts     export { getProject as GET } from "@/contexts/bc_projects/router"
contexts/bc_projects/
  router.ts                        handlery HTTP
  schemas.ts                       DTO wyjścia + mapery model → DTO (brak wejścia: same GET)
  models.ts                        typy wewnętrzne
  services.ts                      reguły
  repositories/index.ts            odczyt vaulta, mapowanie plik → model
  repositories/markdown.ts         czyste parsery tekstu tasks.md / bugs.md / index.md
```

### 3.1 `models.ts`

`RegistryEntry` (`id`, `name`, `status`, `priority`, `folder`, `localPath`, `deploy?`, `github?`, `owner: "personal"`), `ProjectIndex` (`lastWorked?`, `stateConfidence?`, `whereIStopped: string | null`), `ChecklistItem` (`text`, `done`), `ChecklistSection` (`heading`, `items`), `BugEntry` (`id`, `title`, `section`, `priority?`, `status?`), `Freshness` (`"fresh" | "stale" | "unknown"`), `Project` (wpis + indeks + `freshness`), `ProjectWithContent` (`Project` + `tasks`, `bugs`).

### 3.2 `repositories/markdown.ts` (czysty tekst)

- `parseSections(markdown): { heading; body }[]` — tnie po nagłówkach dokładnie drugiego poziomu (`## `), zachowuje kolejność; sekcja kończy się na następnym `## ` albo końcu pliku. `#` i `###` nie są granicami sekcji (nagłówki `###` wpisów bugów zostają w `body`).
- `parseChecklist(body): ChecklistItem[]` — linie `- [ ]` i `- [x]`; tekst zachowuje markdown. Linie niebędące checkboxami (np. `_Brak aktywnych blokerów_`) są pomijane.
- `parseBugs(markdown): BugEntry[]` — wpis od nagłówka `### <ID> — <tytuł>`; `section` = najbliższy wcześniejszy `##`; `priority` i `status` z linii `- **Priorytet:** …` / `- **Status:** …` (brak = `undefined`). Plik bez `###` daje pustą listę. Opis wpisu nie jest parsowany.
- Nie importuje `vault-fs`, `node:fs` ani `process.env`.

### 3.3 `repositories/index.ts` (jedyny dostęp do vaulta)

- `readRegistry(): { entries: RegistryEntry[]; warnings: string[] }` — `Projects/_registry.yaml`, korzeń `projects: [...]`; brak klucza lub nie-tablica daje ostrzeżenie i pustą listę; brak pliku daje pustą listę z ostrzeżeniem `Brak Projects/_registry.yaml w vaulcie` (żeby zły `NEXUS_VAULT_PATH` nie wyglądał jak pusty rejestr); zepsuty YAML rzuca dalej (błąd parsera z `yaml-store`), nie jest zamieniany na ostrzeżenie; `local_path` → `localPath`; wpis bez `id` lub `folder` pominięty z ostrzeżeniem. `folder` jest względem korzenia vaulta (np. `Projects/second-brain/`), bez dodatkowego prefiksu.
- `readProjectIndex(entry): ProjectIndex` — frontmatter `index.md` (`last_worked`, `state_confidence` rzutowane na tekst przez `String(...)`, bo `yaml` może zwrócić inny typ) i sekcja `## Gdzie skończyłem` (w vaulcie zawsze przed `## Historia sesji`). Brak pliku daje puste pola.
- `readProjectContent(entry): { tasks: ChecklistSection[]; bugs: BugEntry[] }` — brak pliku daje puste listy.
- Ścieżki przez `readVaultFile` → `resolveInsideVault`: `folder: ../../x` daje `PathOutsideVaultError`, `Work/...` daje `WorkAreaBlockedError` (strażnik 0f; bez `allowWork`).
- Nie zna „dziś”, nie sortuje i nie łapie błędów.

### 3.4 `services.ts` (reguły)

- `listProjects(today = new Date()): { projects: Project[]; warnings: string[] }` — dla każdego wpisu `readProjectIndex`; wyjątek pojedynczego projektu (`PathOutsideVaultError`, `WorkAreaBlockedError`, I/O, zepsuty frontmatter) trafia do `warnings` jako `<id>: <komunikat>`, projekt zostaje z danymi z rejestru i `freshness: "unknown"`. Błędy samego `readRegistry` (zepsuty YAML) i `VaultConfigError` nie są łapane: lecą do routera i dają 500 z komunikatem. Kolejność wg D5.
- `getProject(id, today = new Date()): ProjectWithContent` — nieznany `id` rzuca `NotFoundError` (nowa klasa w `lib/errors.ts`, `extends DomainError`, kod 404); błędy odczytu lecą dalej. `id` służy tylko do wyszukania wpisu; ścieżkę buduje `folder` z rejestru.
- `freshness(lastWorked: string | undefined, today: Date): Freshness` — ≤ 14 dni `fresh`, > 14 `stale`, brak lub błędna data `unknown`. Stała `STALE_AFTER_DAYS = 14` (eksport do testów).

### 3.5 `schemas.ts`

- `ProjectSummaryDto` (`id`, `name`, `status`, `priority`, `localPath`, `deploy?`, `github?`, `owner`, `lastWorked?`, `stateConfidence?`, `freshness`) i `ProjectDetailDto` (summary + `tasks`, `bugs`, `whereIStopped`). Bez `folder`.
- `toSummaryDto(project)`, `toDetailDto(project)`.
- Re-eksport typów potrzebnych UI jako DTO: `ChecklistItemDto`, `ChecklistSectionDto`, `BugEntryDto`, `FreshnessDto` (`export type … = …` z `import type` z `models`). UI nie importuje `models`.
- Brak schematów zod wejścia (same `GET`); komentarz w pliku to odnotowuje.

### 3.6 `router.ts`

- `listProjects()` → `NextResponse.json({ projects: projects.map(toSummaryDto), warnings })`.
- `getProject(request, { params })` → `toDetailDto(...)`; `params` jako `Promise<{ id: string }>` jak w istniejących trasach.
- Błędy przez `handleServiceError` z `lib/http/apiError`. `VaultConfigError` nie jest `DomainError`, więc daje 500 z `message`; UI pokazuje komunikat z body.
- Prefiks tras bez `nexus` (`/api/projects`), zgodnie z praktyką w kodzie; nadrzędny spec §4.1 mówił o `/api/nexus/*`, ta nazwa nie została przyjęta.

## 4. UI (`src/features/projects/`)

Wzorzec wizualny: `docs/mockups/karty/cards/04-projekty.html`, tokeny z `tokens.css`. UI importuje z kontekstu wyłącznie `schemas.ts` (tu tylko typy DTO).

| Plik                 | Rola                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `ProjectsView.tsx`   | wejście karty: układ dwóch kolumn, stany `loading` / `error` / `empty` |
| `useProjects.ts`     | dane: lista i szczegóły przez wstrzykiwane `apiFetch`, wybrany `id`    |
| `ProjectList.tsx`    | rejestr (lewa kolumna)                                                 |
| `ProjectDossier.tsx` | teczka wybranego projektu (prawa kolumna)                              |
| `projects.css`       | style z prefiksem `.prj-` (jak `cards.css`)                            |

- Podpięcie karty: `CardTarget` (`src/features/cards/cards.ts`) ma dziś `home | planning | placeholder`; dochodzi `projects`. Zmiany: `cards.ts` (typ i wpis `projekty`), `useCardNavigation.ts` (`selectCard`, stan aktywnego widoku), `src/App.tsx` (render), testy `tests/unit/features/cards/cards.test.ts` i `useCardNavigation.test.ts` (dla `projekty` przestają oczekiwać `placeholder`).
- `useProjects.ts`: `apiFetch` z `src/lib/apiFetch.ts` (w testach atrapa); wybrany `id` w stanie, domyślnie pierwszy z listy.
- Rejestr: nazwa, odznaki (status, priorytet), `last_worked`, `state_confidence` (tekst, nie procent jak w makiecie). `stale` → `.prj-item--stale`; `done` przygaszony i na końcu.
- Teczka: metryczka z linkami (repo, deploy, `local_path` jako tekst), „Gdzie skończyłem”, trzy kolumny zadań (tylko odczyt), bugi. Podział bugów wyłącznie po `section`: `section === "Zamknięte"` to zamknięte (tylko licznik), każdy inny `section` to aktywne (w całości, z odznakami `priority` i `status`, gdy są). Pole `status` nie wpływa na podział. Brak wpisów → „Brak bugów”.
- Błędy: komunikat z body odpowiedzi; pusty rejestr → „Brak projektów w rejestrze”; `warnings` jako dyskretny pasek nad listą.
- Dostępność: lista to `<ul>` z przyciskami, wybrany element ma `aria-current`.

## 5. Testy

Testy powstają w kroku wykonania (czerwony → zielony). Środowisko `node` (pragma) dla kontekstu i tras, `jsdom` dla komponentów.

| Plik testu                                                               | Przypadek                                                                                                                        | Oczekiwanie                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `tests/unit/contexts/bc_projects/repositories.markdown.test.ts`          | `## Blokery`, `## Next`, `## Backlog`                                                                                            | trzy sekcje w kolejności pliku                                                |
| 〃                                                                       | `- [ ] **A** — opis` i `- [x] B`                                                                                                 | `{text:"**A** — opis", done:false}`, `{text:"B", done:true}`                  |
| 〃                                                                       | `_Brak aktywnych blokerów_`                                                                                                      | sekcja pusta                                                                  |
| 〃                                                                       | `## Gdzie skończyłem` przed `## Historia sesji`                                                                                  | tekst tylko do następnego `##`                                                |
| 〃                                                                       | `parseBugs`: `## Aktywne` + `### GP-001 — …` z `**Priorytet:** medium`, `**Status:** otwarty`; `## Zamknięte` + `### EA-001 — …` | dwa wpisy z `section`, `priority`, `status`                                   |
| 〃                                                                       | `parseBugs`: „Brak znanych bugów.” bez nagłówków                                                                                 | pusta lista                                                                   |
| 〃                                                                       | `parseBugs`: samo `## Aktywne` z dwoma `###` (bez `## Zamknięte`); `## Ostrzeżenia z builda` z listą bez `###`                   | dwa wpisy `section: "Aktywne"`; sekcja ostrzeżeń nie daje wpisów              |
| 〃                                                                       | `parseSections`: `## Aktywne` z `### GP-001` w środku                                                                            | jedna sekcja, `###` w `body`                                                  |
| `tests/unit/contexts/bc_projects/repositories.test.ts`                   | brak `_registry.yaml`                                                                                                            | `entries: []` i jedno ostrzeżenie                                             |
| 〃                                                                       | wpis bez `id`; brak klucza `projects`                                                                                            | pominięty z jednym ostrzeżeniem; ostrzeżenie i pusta lista                    |
| 〃                                                                       | `local_path`                                                                                                                     | pole `localPath`                                                              |
| 〃                                                                       | `folder: ../../x` / `folder: Work/x/`                                                                                            | `PathOutsideVaultError` / `WorkAreaBlockedError`                              |
| 〃                                                                       | brak `tasks.md`, `bugs.md`, `index.md`                                                                                           | puste listy i pola, bez błędu                                                 |
| `tests/unit/contexts/bc_projects/services.test.ts` (mock `repositories`) | `freshness`: 14 dni / 15 dni / brak / `"abc"`                                                                                    | `fresh` / `stale` / `unknown` / `unknown`                                     |
| 〃                                                                       | `active`, `on_hold`, `done` z różnymi datami i bez daty                                                                          | kolejność wg D5                                                               |
| 〃                                                                       | `readProjectIndex` rzuca dla jednego projektu                                                                                    | ostrzeżenie `<id>: …`, ten projekt z `freshness: "unknown"`, reszta bez zmian |
| 〃                                                                       | nieznany `id`                                                                                                                    | `NotFoundError`                                                               |
| `tests/unit/contexts/bc_projects/schemas.test.ts`                        | `toSummaryDto`, `toDetailDto`                                                                                                    | brak pola `folder` w wyniku                                                   |
| `tests/unit/contexts/bc_projects/router.test.ts` (mock `services`)       | lista / `[id]` istniejący / nieznany                                                                                             | 200 / 200 / 404                                                               |
| 〃                                                                       | serwis rzuca `VaultConfigError`                                                                                                  | 500 z komunikatem o `NEXUS_VAULT_PATH` w body                                 |
| `tests/unit/features/projects/*.test.tsx`                                | ładowanie, błąd, pusta lista                                                                                                     | odpowiednie stany                                                             |
| 〃                                                                       | wybór projektu; `stale`; `done`                                                                                                  | przełącza teczkę; klasa ostrzegawcza; `done` ostatni                          |
| 〃                                                                       | bugi: `section: "Aktywne"` i `"Zamknięte"`                                                                                       | aktywne w całości, zamknięte jako licznik                                     |
| `tests/unit/contexts/bc_projects/readonly.static.test.ts`                | pliki kontekstu importują `writeVaultFile` / `updateVaultFile` / `deleteVaultFile`                                               | żaden (karta tylko do odczytu)                                                |
| `tests/unit/architecture.static.test.ts` (z PR 1)                        | nowy kontekst i `src/features/projects`                                                                                          | przechodzi bez nowych wyjątków                                                |

**Bramka:** `npx vitest`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (zlecane `cursor`: „przeszło” albo `plik:linia + przyczyna`), review diffa przez `agy --role review`, smoke test na prawdziwym vaulcie (7 projektów z rejestru, każdy z akapitem „Gdzie skończyłem”, `code-sensei` jako `done` na końcu, bugi `gen-podsum-ai` jako aktywne, `EA-001` w `english-agent` jako zamknięty).

## 6. Zadania planu

Kolejność = commity, każdy się kompiluje.

1. `contexts/bc_projects/models.ts` i `repositories/markdown.ts` + testy.
2. `NotFoundError` w `lib/errors.ts`; `repositories/index.ts` + testy.
3. `services.ts` (świeżość, kolejność, ostrzeżenia, NotFound) + testy.
4. `schemas.ts`, `router.ts`, dwie trasy `app/api/projects/**` + testy.
5. `src/features/projects/` (siatka z §4) + testy komponentów.
6. Nowy cel karty `projects` (`cards.ts`, `useCardNavigation.ts`, `App.tsx` + ich testy), `readonly.static.test.ts`, `contexts` na liście skanowanych katalogów w `allow-work`, `no-firebase-client`, `no-model-api`, `no-user-id` (osobny commit testów), aktualizacja `STAN-W-KODZIE.md`, README i speców.
7. Bramka weryfikacji, review `agy`, smoke test.
