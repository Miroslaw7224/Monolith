# Struktura repo Monolith według vaulta NEXUS (konteksty `bc_*`) — projekt

Data: 2026-11-12
Status: szkic do przeglądu
Powiązane: `docs/adr/014-layer-separation-and-service-layer.md` (zastępowane mapowanie folderów), `docs/adr/018-feature-modules-wiedza-planowanie.md`, spec etapu 1-1 `2026-11-12-etap-1-1-karta-projektu-odczyt-design.md` (pierwszy kontekst)

## 1. Cel

Repo ma mieć jedną, powtarzalną siatkę plików, zgodną z notatkami vaulta NEXUS, tak żeby człowiek i agent AI wiedzieli, gdzie co leży, a błędy miały „adresy”. Dziś kod jednej domeny jest rozłożony na pięć katalogów (`app/api/`, `services/`, `lib/nexus/repos/`, `lib/validation/`, `types/`), serwisy importują z UI (`services/boardService.ts`, `services/mindMapService.ts` → `src/features/`), a serwisy sięgają do repozytoriów innych domen przez wspólny barrel `lib/firestore-db.ts` (np. `services/calendarService.ts:36` → `getTasks`).

## 2. Źródła

- `NEXUS/Vault/Knowledge/struktury-projektu.md` — Bounded Context jako folder z prefiksem `bc_`, w nim ten sam zestaw: `router`, `schemas`, `models`, `services`, `repositories`; rozmowa między kontekstami tylko w `services`; repozytoria i modele chronione.
- `NEXUS/Vault/Knowledge/struktura-jako-uprzaz.md` — kierunek UI → API → serwis → repozytorium → magazyn, każda warstwa woła tylko następną, testy pilnują kierunku.
- `NEXUS/Vault/Knowledge/testowanie/testy-architektoniczne-ai.md` — granice zapisane jako szybkie testy zależności.

**Pominięte celowo (decyzja użytkownika 2026-11-12):** elementy AI — `inngest_functions` / worker w tle i `struktura-komponentu-ai.md` (kontrakt, wersje, ewaluacja). Aplikacja nie ma i nie będzie miała AI.

## 3. Decyzje

| #   | Decyzja             | Wybór                                                                                                                       |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| S1  | Miejsce kontekstów  | `contexts/bc_<nazwa>/` w korzeniu repo (obok `app/`, `lib/`, `src/`). Nazwa w `snake_case` po prefiksie, np. `bc_mind_maps` |
| S2  | Siatka plików       | `router.ts`, `schemas.ts`, `models.ts`, `services.ts`, `repositories.ts` w każdym kontekście (§4)                           |
| S3  | Trasy Next.js       | `app/api/**/route.ts` zostają (wymóg App Routera), ale tylko re-eksportują handlery z `router.ts`                           |
| S4  | Infrastruktura      | Poza kontekstami: `lib/nexus/` (silnik plików vaulta), `lib/http/` (pomocniki HTTP), `lib/errors.ts`                        |
| S5  | UI                  | `src/features/<domena>/`; w `src/components/` tylko rzeczy wspólne (`layout/`, `theme/`, `brand/`)                          |
| S6  | Kolejność wdrożenia | PR 1 fundament → PR 2 etap 1-1 jako `bc_projects` → migracja istniejących domen po jednej na PR → PR sprzątający            |
| S7  | Pilnowanie          | Test architektury od PR 1; znane naruszenia starego kodu na jawnej liście wyjątków, która może tylko maleć                  |
| S8  | Dokumentacja        | ADR-021 „Struktura kontekstów wg vaulta NEXUS” (zastępuje mapowanie folderów z ADR-014; ADR-018 dostaje odnośnik)           |

## 4. Siatka kontekstu

| Plik              | Zawartość                                                                                                                                               | Kto może importować                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `router.ts`       | nazwane handlery (`listProjects`, `getProject`…): parsowanie żądania przez `schemas`, wywołanie `services`, mapowanie model → DTO, `handleServiceError` | tylko `app/api/**/route.ts`                                                                                                 |
| `schemas.ts`      | zod dla wejścia, typy DTO wyjścia, mapery `model → DTO` (DTO może pomijać pola wewnętrzne)                                                              | własny `router.ts`; UI (`src/**`) i `types/records.ts` (przejściowo) — także runtime, bo plik jest „bezpieczny dla klienta” |
| `models.ts`       | typy wewnętrzne domeny (kształt danych w systemie)                                                                                                      | tylko pliki własnego kontekstu                                                                                              |
| `services.ts`     | reguły domeny; jedyne miejsce, które woła inny kontekst (wyłącznie jego `services.ts`)                                                                  | własny `router.ts`, `services.ts` innych kontekstów                                                                         |
| `repositories.ts` | jedyny dostęp do vaulta (`lib/nexus/vault-fs`, `yaml-store`, `markdown-edit`…), mapowanie plik ↔ model                                                  | tylko własny `services.ts`                                                                                                  |

- **Plik → folder.** Gdy plik urośnie, staje się folderem o tej samej nazwie z `index.ts` i plikami pomocniczymi (np. `repositories/index.ts` + `repositories/markdown.ts`). Reguły importu dotyczą całego folderu tak samo jak pliku; importy wewnątrz tego samego folderu są dozwolone.
- **Kierunek wewnątrz kontekstu:** `router → services, schemas`; `services → repositories, models, services innych kontekstów`; `repositories → models, lib/nexus`; `schemas → models` (tylko `import type`), `zod`, `lib/schema/`; `models` nie importuje plików kontekstu. Każdy inny import wewnątrz kontekstu (np. `repositories → services`, `services → router`) jest błędem.
- **`schemas.ts` jest bezpieczny dla klienta:** importuje tylko `zod`, `lib/schema/**` i `import type` z własnego `models`. Dzięki temu UI może używać tych samych schematów zod w formularzach (dziś `src/components/resources/*` → `lib/validation/resources`) i typów DTO. Typy modelu potrzebne UI są re-eksportowane w `schemas.ts` jako DTO; UI nie sięga do `models`.
- **Stałe UI** (np. `DEFAULT_COL_W`, `MIN_COL_W`, `MAX_COL_W` w `src/features/mind-maps/mindMapTypes.ts`) zostają w `src/features/<domena>/`. Wartości potrzebne obu stronom (np. `EMPTY_BOARD`) trafiają do `schemas.ts`.
- **Brak pliku.** Kontekst, który czegoś nie potrzebuje (np. kontekst składający tylko dane innych kontekstów nie ma własnego `repositories`), i tak ma wszystkie pięć plików; pusty plik zawiera tylko komentarz z powodem. Siatka zostaje identyczna.
- **Trasa:** `app/api/projects/route.ts` to `export { listProjects as GET } from "@/contexts/bc_projects/router";`. Konfiguracja segmentu Next.js (`export const dynamic` itp.), gdyby była potrzebna, zostaje w `route.ts`, bo Next czyta ją statycznie (dziś żadna trasa jej nie ma).
- **Testy** odbijają drzewo: `tests/unit/contexts/bc_<nazwa>/<plik>.test.ts`; dla pliku z folderu `<plik>.<podplik>.test.ts` (np. `repositories.markdown.test.ts`); testy statyczne kontekstu `<temat>.static.test.ts`. Testy kontekstu poza komponentami: `// @vitest-environment node`.

## 5. Infrastruktura wspólna

- `lib/nexus/` — bez zmian w roli: `vault-path`, `vault-fs`, `yaml-store`, `yaml-lists`, `frontmatter`, `markdown-edit`, `task-line`, `slug`. W PR 1 dochodzą wspólne pomocniki repozytoriów przeniesione z `lib/nexus/repos/`: `common.ts` → `lib/nexus/record-helpers.ts` (używany przez wszystkie repozytoria) i `markdown-dir.ts` → `lib/nexus/markdown-dir.ts` (notatki i dokumenty). Importowany tylko przez `repositories` kontekstów, inne pliki `lib/nexus/`, `lib/workGuard.ts` (`import type`) i, do PR 10, stare `lib/nexus/repos/**`.
- `lib/http/` (nowy, PR 1): `apiError.ts`, `parseBody.ts`, `inferHttpStatus.ts`, `uploadFormFile.ts`, `localGuard.ts`. `middleware.ts` importuje `localGuard` z nowej ścieżki.
- `lib/schema/` (nowy, PR 1): `looseObject.ts` (z `lib/validation/`); bezpieczny dla klienta, bo używają go `schemas.ts`.
- `lib/workGuard.ts` zostaje poza `lib/nexus/` (test `static.test.ts` zabrania tam `child_process`); importuje z `vault-fs` tylko typ.
- `lib/errors.ts` — zostaje (`DomainError`, `ConflictError`, nowy `NotFoundError` z 1-1).
- `lib/calendarRange.ts`, `lib/dateRef.ts` — do rozstrzygnięcia przy migracji domeny, która ich używa: kod jednej domeny wchodzi do jej kontekstu, kod wspólny zostaje w `lib/`.
- `lib/markdown/html-markdown.ts` używa tylko UI (`NoteEditor.tsx`, `NotesPanel.tsx`), więc w PR 6 przechodzi do `src/lib/`.

### 5.1 UI wspólne

Reguła: kod UI używany przez jeden moduł leży w `src/features/<moduł>/`; używany przez więcej niż jeden — w `src/components/<temat>/` (komponenty) albo `src/lib/` (funkcje, stałe). `src/features/A` nie importuje `src/features/B` (wyjątek: istniejące `planowanie` i `cards`, które składają widoki — opisane w ADR-021).

| Element                                                     | Używają                                   | Miejsce docelowe               |
| ----------------------------------------------------------- | ----------------------------------------- | ------------------------------ |
| `NoteEditor*`, `noteEditorExtensions`                       | notatki, mapy myśli (`MindMapNotesPanel`) | `src/components/note-editor/`  |
| `ActivityLog`, `StartSessionModal`, `src/lib/activeSession` | Home, Planowanie, kalendarz               | `src/components/sessions/`     |
| `calendarConstants`                                         | tagi, kalendarz                           | `src/lib/calendarConstants.ts` |

## 6. Reguły importów (test architektury)

`tests/unit/architecture.static.test.ts` skanuje importy (`from "…"`, `import("…")`, `require("…")`) i sprawdza:

Test skanuje kod źródłowy: `app/`, `contexts/`, `lib/`, `services/`, `src/`, `types/` i `middleware.ts`. Katalog `tests/` jest pominięty (testy celowo importują warstwy niższe, np. `vault-fs.test.ts`). Ścieżki są normalizowane przed sprawdzeniem (alias `@/`, ścieżki względne `./`, `../`, z `index.ts` i bez rozszerzenia), więc reguł nie da się obejść zapisem importu.

1. `src/**` nie importuje `contexts/**` poza `contexts/*/schemas*`, ani `services/**`, `lib/nexus/**`, `lib/http/**`.
2. `contexts/bc_A/**` importuje z `contexts/bc_B/**` (B ≠ A) wyłącznie `contexts/bc_B/services*`.
3. Kierunek wewnątrz kontekstu zgodnie z §4 („Kierunek wewnątrz kontekstu”); `repositories*` importowany tylko przez własny `services*` i wnętrze własnego folderu `repositories/`; `models*` tylko w obrębie kontekstu.
4. `contexts/*/router*` importowany tylko przez `app/api/**/route.ts` i wnętrze własnego folderu `router/`. `route.ts`, który importuje kontekst, ma tylko re-eksport z jednego `router` (żadnych innych importów).
5. `lib/nexus/**` importowany tylko przez `contexts/*/repositories*`, inne pliki `lib/nexus/**`, `lib/workGuard.ts` (`import type`) oraz, do PR 10, `lib/nexus/repos/**` i `lib/firestore-db.ts`.
6. `app/api/**`, `services/**`, `lib/**`, `contexts/**`, `types/**` nie importują `src/**`.
7. `contexts/**` nie importuje `services/**`, `types/records` ani `lib/firestore-db` (nowy kod nie opiera się na starej warstwie). Odwrotnie wolno: stary `services/**` może wołać `contexts/*/services*` w trakcie migracji.
8. Graf `contexts/bc_*/services*` → `contexts/bc_*/services*` jest acykliczny (zakaz cykli między kontekstami).
9. `types/records.ts` re-eksportuje z kontekstów wyłącznie `contexts/*/schemas*` (nie `models`).

**Lista wyjątków (baseline)** w teście, jako jawne pary `plik → import` (stan z 2026-11-12):

- `services/boardService.ts → src/features/board/boardTypes`, `→ src/features/board/boardSchema`,
- `services/mindMapService.ts → src/features/mind-maps/mindMapTypes`,
- `app/api/board/route.ts → src/features/board/boardSchema`,
- `app/api/mind-maps/[id]/route.ts → src/features/mind-maps/mindMapTypes`.

`src/components/resources/*` importuje dziś runtime'owo `lib/validation/resources`; reguła 1 tego nie zabrania, a PR 7 przepina te importy na `contexts/bc_resources/schemas`.

Test sprawdza też, że każdy wyjątek nadal występuje (wyjątek nieużywany = błąd), więc lista może tylko maleć. Usunięcie wyjątku należy do PR migrującego daną domenę.

**Zmiany testu architektury i baseline idą osobnym commitem**, przed albo po commicie z kodem, nigdy razem z nim (pułapka z `struktura-jako-uprzaz.md`: agent „naprawia” pękający test, zmieniając test).

Istniejące testy statyczne (`tests/unit/lib/nexus/repos-static.test.ts`, `static.test.ts`, `allow-work.static.test.ts`) zostają do PR sprzątającego; migracje aktualizują w nich ścieżki.

## 7. Etapy

### PR 1: fundament

1. ADR-021 (S8) z tabelą §4, regułami §6 i pominięciami §2; w ADR-014 i ADR-018 dopisek „mapowanie folderów zastąpione przez ADR-021”.
2. Przenosiny do `lib/http/` i `lib/schema/` z aktualizacją importów w `app/api/**`, `middleware.ts`, `services/**`, `lib/validation/**` i testach. Do `tests/unit/lib/http/` przechodzą tylko testy tych plików (`apiError`, `parseBody`, `inferHttpStatus`, `uploadFormFile`, `localGuard`); pozostałe testy `tests/unit/lib/*` zostają. Ścieżki w `vi.mock` też się zmieniają (np. `tests/unit/api/upload.test.ts:8` mockuje `uploadFormFile`). Zadanie mechaniczne (`cursor --role task`), kontrola `git diff --stat` i testy.
3. Przenosiny `lib/nexus/repos/common.ts` → `lib/nexus/record-helpers.ts` i `lib/nexus/repos/markdown-dir.ts` → `lib/nexus/markdown-dir.ts`; aktualizacja list w `tests/unit/lib/nexus/repos-static.test.ts`.
4. `tests/unit/architecture.static.test.ts` z regułami §6 i baseline (osobny commit).
5. Sekcja „Struktura” w `CLAUDE.md` (skrót §4 i §6 z odnośnikiem do ADR-021): notatka vaulta wymaga zapisania struktury w instrukcjach agenta, nie tylko w testach.
6. Katalog `contexts/` powstaje dopiero w PR 2 (git nie śledzi pustych katalogów).

Kryterium: testy, `tsc`, lint i build przechodzą; test architektury przechodzi na obecnym kodzie z baseline i pęka na sztucznym naruszeniu (sprawdzone w czerwonej fazie TDD).

### PR 2: etap 1-1 jako `contexts/bc_projects/`

Według specu `2026-11-12-etap-1-1-karta-projektu-odczyt-design.md`. Pierwszy kontekst jest wzorcem dla migracji. W tym PR testy statyczne skanujące katalogi (`allow-work`, `no-firebase-client`, `no-model-api`, `no-user-id`) dostają `contexts` na listę skanowanych katalogów.

### PR 3…9: migracja domen (po jednej na PR, backend i UI razem)

| Kolejność | Kontekst       | Backend (skąd)                                                                                                                                                       | UI (dokąd)                                                                                 |
| --------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 3         | `bc_tags`      | `services/tagService.ts`, `lib/nexus/repos/tags.ts`, `lib/validation/tags.ts`, `app/api/tags/**`                                                                     | `src/components/TagsSection.tsx` → `src/features/tags/`                                    |
| 4         | `bc_tasks`     | `taskService`, `taskTemplateService`, repos `tasks`, `taskTemplates`, walidacje, `app/api/tasks/**`, `task-templates/**`                                             | `src/components/tasks/`, `TasksSection`, modale zadań → `src/features/tasks/`              |
| 5         | `bc_calendar`  | `calendarService` (zadania przez `bc_tasks/services`), repo `calendarEvents`, `app/api/calendar/**`                                                                  | `CalendarView`, `calendar/`, `CalendarEventForm`, `ActivityLog` → `src/features/calendar/` |
| 6         | `bc_notes`     | `noteService`, repo `notes`, walidacja, `app/api/notes/**`                                                                                                           | `NoteEditor*`, `noteEditorExtensions` → `src/features/notes/`                              |
| 7         | `bc_resources` | `resourceService`, `documentService`, repos `resources`, `documents`, `app/api/resources/**`, `documents/**`, `upload`                                               | `ResourceSection`, `resources/` → `src/features/resources/`                                |
| 8         | `bc_board`     | `boardService`, repo `board`, `app/api/board`; `boardTypes`/`boardSchema` → `models`/`schemas`, `EMPTY_BOARD` w `schemas` (koniec wyjątków board w baseline)         | `src/features/board/` (bez typów domeny)                                                   |
| 9         | `bc_mind_maps` | `mindMapService`, repo `mindMaps`, `app/api/mind-maps/**`; typy domeny z `mindMapTypes` → `models` + DTO w `schemas`, stałe `*_COL_W` zostają w UI (koniec baseline) | `src/features/mind-maps/` + `src/lib/mindMapUtils.ts`                                      |

Każdy PR: przeniesienie testów lustrzanie, aktualizacja `repos-static.test.ts` i list plików w pozostałych testach statycznych (np. ścieżki zaszyte w `no-user-id.static.test.ts`), test architektury zielony, brak zmian zachowania (te same testy przechodzą po przeniesieniu). Typy z `types/records.ts` wędrują do `models`/`schemas` kontekstu; dopóki inne miejsca ich używają, `types/records.ts` re-eksportuje je wyłącznie z `schemas` (reguła 9).

**Zależność kalendarz → zadania (PR 4):** po migracji `bc_tasks` stary `services/calendarService.ts` (migrowany w PR 5) przestaje brać `getTasks` z barrelu i woła `contexts/bc_tasks/services` (reguła 7 dopuszcza ten kierunek); barrel `lib/firestore-db.ts` traci eksport zadań w tym samym PR.

UI wspólne (§5.1) przenosi PR domeny, która pierwsza go dotyka: `src/lib/calendarConstants.ts` w PR 3, `src/components/sessions/` w PR 5, `src/components/note-editor/` w PR 6. W tabeli powyżej `ActivityLog` należy do `src/components/sessions/`, nie do `src/features/calendar/`.

### PR 10: sprzątanie

Usunięcie `services/`, `lib/nexus/repos/`, `lib/validation/`, `types/records.ts`, `lib/firestore-db.ts` (barrel), pustego baseline; reguła 5 bez wyjątku dla `lib/nexus/repos/**`; `repos-static.test.ts` scalony z testem architektury; README i `STAN-W-KODZIE.md` z nowym drzewem.

## 8. Ryzyka

- **Duże przenosiny = konflikty.** Jedna domena na PR, bez równoległych PR dotykających tych samych plików; migracje po zmergowaniu 1-1.
- **Mocki w testach** (`vi.mock("…/lib/firestore-db.js")`) zmieniają cel przy każdej migracji; testy serwisu mockują `repositories` własnego kontekstu.
- **Plan 0e** (usunięcie Firebase) dotyka `lib/firebase-admin.ts`, skryptów i konfiguracji, nie domen; nie koliduje, ale jego Task 6 trzeba wykonać na aktualnym `main`.
- **Rozmiar `router.ts`** przy kontekście z wieloma trasami (np. `bc_tasks`): wtedy folder `router/` (§4).
- **`looseObject` przepuszcza nieznane pola** (`passthrough`), a notatka vaulta zaleca jawny błąd dla nieznanych pól (odpowiednik `extra='forbid'`). Zmiana na `strict` zmienia zachowanie API, więc nie wchodzi do migracji (która ma być bez zmian zachowania); osobna decyzja po PR 10.
