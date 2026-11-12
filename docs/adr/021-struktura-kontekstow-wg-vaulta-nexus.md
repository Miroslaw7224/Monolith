# ADR-021: Struktura kontekstów wg vaulta NEXUS

## Status

Zaakceptowany (2026-11-12). Zastępuje mapowanie folderów z ADR-014; uzupełnia ADR-018.

## Kontekst

Repo ma mieć jedną, powtarzalną siatkę plików, zgodną z notatkami vaulta NEXUS, tak żeby człowiek i agent AI wiedzieli, gdzie co leży, a błędy miały „adresy”. Dziś kod jednej domeny jest rozłożony na pięć katalogów (`app/api/`, `services/`, `lib/nexus/repos/`, `lib/validation/`, `types/`), serwisy importują z UI (`services/boardService.ts`, `services/mindMapService.ts` → `src/features/`), a serwisy sięgają do repozytoriów innych domen przez wspólny barrel `lib/firestore-db.ts`.

Źródła z vaulta:

- `NEXUS/Vault/Knowledge/struktury-projektu.md` — Bounded Context jako folder z prefiksem `bc_`, w nim ten sam zestaw: `router`, `schemas`, `models`, `services`, `repositories`; rozmowa między kontekstami tylko w `services`; repozytoria i modele chronione.
- `NEXUS/Vault/Knowledge/struktura-jako-uprzaz.md` — kierunek UI → API → serwis → repozytorium → magazyn, każda warstwa woła tylko następną, testy pilnują kierunku.
- `NEXUS/Vault/Knowledge/testowanie/testy-architektoniczne-ai.md` — granice zapisane jako szybkie testy zależności.

Pominięte celowo (decyzja użytkownika 2026-11-12): elementy AI — `inngest_functions` / worker w tle i `struktura-komponentu-ai.md` (kontrakt, wersje, ewaluacja). Aplikacja nie ma i nie będzie miała AI.

## Decyzja

| #   | Decyzja             | Wybór                                                                                                                       |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| S1  | Miejsce kontekstów  | `contexts/bc_<nazwa>/` w korzeniu repo (obok `app/`, `lib/`, `src/`). Nazwa w `snake_case` po prefiksie, np. `bc_mind_maps` |
| S2  | Siatka plików       | `router.ts`, `schemas.ts`, `models.ts`, `services.ts`, `repositories.ts` w każdym kontekście                                |
| S3  | Trasy Next.js       | `app/api/**/route.ts` zostają (wymóg App Routera), ale tylko re-eksportują handlery z `router.ts`                           |
| S4  | Infrastruktura      | Poza kontekstami: `lib/nexus/` (silnik plików vaulta), `lib/http/` (pomocniki HTTP), `lib/errors.ts`                        |
| S5  | UI                  | `src/features/<domena>/`; w `src/components/` tylko rzeczy wspólne (`layout/`, `theme/`, `brand/`)                          |
| S6  | Kolejność wdrożenia | PR 1 fundament → PR 2 etap 1-1 jako `bc_projects` → migracja istniejących domen po jednej na PR → PR sprzątający            |
| S7  | Pilnowanie          | Test architektury od PR 1; znane naruszenia starego kodu na jawnej liście wyjątków, która może tylko maleć                  |
| S8  | Dokumentacja        | ADR-021 „Struktura kontekstów wg vaulta NEXUS” (zastępuje mapowanie folderów z ADR-014; ADR-018 dostaje odnośnik)           |

### Siatka kontekstu

| Plik              | Zawartość                                                                                                                                               | Kto może importować                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `router.ts`       | nazwane handlery (`listProjects`, `getProject`…): parsowanie żądania przez `schemas`, wywołanie `services`, mapowanie model → DTO, `handleServiceError` | tylko `app/api/**/route.ts`                                                                                                 |
| `schemas.ts`      | zod dla wejścia, typy DTO wyjścia, mapery `model → DTO` (DTO może pomijać pola wewnętrzne)                                                              | własny `router.ts`; UI (`src/**`) i `types/records.ts` (przejściowo) — także runtime, bo plik jest „bezpieczny dla klienta” |
| `models.ts`       | typy wewnętrzne domeny (kształt danych w systemie)                                                                                                      | tylko pliki własnego kontekstu                                                                                              |
| `services.ts`     | reguły domeny; jedyne miejsce, które woła inny kontekst (wyłącznie jego `services.ts`)                                                                  | własny `router.ts`, `services.ts` innych kontekstów                                                                         |
| `repositories.ts` | jedyny dostęp do vaulta (`lib/nexus/vault-fs`, `yaml-store`, `markdown-edit`…), mapowanie plik ↔ model                                                  | tylko własny `services.ts`                                                                                                  |

- **Plik → folder.** Gdy plik urośnie, staje się folderem o tej samej nazwie z `index.ts` i plikami pomocniczymi (np. `repositories/index.ts` + `repositories/markdown.ts`). Reguły importu dotyczą całego folderu tak samo jak pliku; importy wewnątrz tego samego folderu są dozwolone.
- **Kierunek wewnątrz kontekstu:** `router → services, schemas`; `services → repositories, models, services innych kontekstów`; `repositories → models, lib/nexus`; `schemas → models` (tylko `import type`), `zod`, `lib/schema/`; `models` nie importuje plików kontekstu. Każdy inny import wewnątrz kontekstu (np. `repositories → services`, `services → router`) jest błędem.
- **`schemas.ts` jest bezpieczny dla klienta:** importuje tylko `zod`, `lib/schema/**` i `import type` z własnego `models`. Dzięki temu UI może używać tych samych schematów zod w formularzach i typów DTO. Typy modelu potrzebne UI są re-eksportowane w `schemas.ts` jako DTO; UI nie sięga do `models`.
- **Brak pliku.** Kontekst, który czegoś nie potrzebuje (np. kontekst składający tylko dane innych kontekstów nie ma własnego `repositories`), i tak ma wszystkie pięć plików; pusty plik zawiera tylko komentarz z powodem. Siatka zostaje identyczna.

### Infrastruktura wspólna

- `lib/nexus/` — silnik plików vaulta (`vault-path`, `vault-fs`, `yaml-store`, `yaml-lists`, `frontmatter`, `markdown-edit`, `task-line`, `slug`); wspólne pomocniki repozytoriów: `record-helpers.ts`, `markdown-dir.ts`. Importowany tylko przez `repositories` kontekstów (oraz wyjątki z reguły 5).
- `lib/http/` — `apiError.ts`, `parseBody.ts`, `inferHttpStatus.ts`, `uploadFormFile.ts`, `localGuard.ts`.
- `lib/schema/` — `looseObject.ts`; bezpieczny dla klienta, bo używają go `schemas.ts`.
- `lib/errors.ts` — `DomainError`, `ConflictError`, `NotFoundError`.

### UI wspólne

Kod UI używany przez jeden moduł leży w `src/features/<moduł>/`; używany przez więcej niż jeden — w `src/components/<temat>/` (komponenty) albo `src/lib/` (funkcje, stałe). `src/features/A` nie importuje `src/features/B`. Wyjątki to moduły składające widoki: `planowanie` (importuje `mind-maps`, `board`, `notes`), `cards` i `home` (importują `planowanie`) — konwencja sprawdzana w review, nie reguła testu architektury.

### Reguły importów (test architektury)

1. `src/**` nie importuje `contexts/**` poza `contexts/*/schemas*`, ani `services/**`, `lib/nexus/**`, `lib/http/**`.
2. `contexts/bc_A/**` importuje z `contexts/bc_B/**` (B ≠ A) wyłącznie `contexts/bc_B/services*`.
3. Kierunek wewnątrz kontekstu zgodnie z siatką powyżej; `repositories*` importowany tylko przez własny `services*` i wnętrze własnego folderu `repositories/`; `models*` tylko w obrębie kontekstu.
4. `contexts/*/router*` importowany tylko przez `app/api/**/route.ts` i wnętrze własnego folderu `router/`. `route.ts`, który importuje kontekst, ma tylko re-eksport z jednego `router` (żadnych innych importów).
5. `lib/nexus/**` importowany tylko przez `contexts/*/repositories*`, inne pliki `lib/nexus/**`, `lib/workGuard.ts` (dziś: `import type` z `vault-fs` i `getVaultRoot` z `vault-path`) oraz, do PR 10, `lib/nexus/repos/**` i `lib/firestore-db.ts`. `scripts/**` nie jest skanowany.
6. `app/api/**`, `services/**`, `lib/**`, `contexts/**`, `types/**` nie importują `src/**`.
7. `contexts/**` nie importuje `services/**`, `types/records` ani `lib/firestore-db` (nowy kod nie opiera się na starej warstwie). Odwrotnie wolno: stary `services/**` może wołać `contexts/*/services*` w trakcie migracji.
8. Graf `contexts/bc_*/services*` → `contexts/bc_*/services*` jest acykliczny (zakaz cykli między kontekstami).
9. `types/records.ts` re-eksportuje z kontekstów wyłącznie `contexts/*/schemas*` (nie `models`).

**Baseline** (5 par `plik → import`, stan z 2026-11-12):

- `services/boardService.ts → src/features/board/boardTypes`, `→ src/features/board/boardSchema`,
- `services/mindMapService.ts → src/features/mind-maps/mindMapTypes`,
- `app/api/board/route.ts → src/features/board/boardSchema`,
- `app/api/mind-maps/[id]/route.ts → src/features/mind-maps/mindMapTypes`.

Zmiany testu architektury i baseline idą osobnym commitem, przed albo po commicie z kodem, nigdy razem z nim.

## Konsekwencje

- Kolejność wdrożenia: PR 2 = `bc_projects` (wzorzec); PR 3–9 = migracja domen po jednej (`bc_tags`, `bc_tasks`, `bc_calendar`, `bc_notes`, `bc_resources`, `bc_board`, `bc_mind_maps`); PR 10 = sprzątanie starej warstwy. Szczegółowa tabela migracji: §7 specu.
- Ryzyka: duże przenosiny = konflikty (jedna domena na PR); mocki w testach zmieniają cel przy każdej migracji; Plan 0e nie koliduje z migracjami domen; rozmiar `router.ts` → folder `router/`; `looseObject` przepuszcza nieznane pola.
- Zamiana `looseObject` na `strict` to osobna decyzja po PR 10 (zmienia zachowanie API; nie wchodzi do migracji bez zmian zachowania).

## Powiązane dokumenty

- `docs/superpowers/specs/2026-11-12-struktura-kontekstow-design.md`
- `docs/superpowers/plans/2026-11-12-struktura-pr1-fundament.md`
