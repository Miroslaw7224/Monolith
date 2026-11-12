# Struktura kontekstów — PR 1 „fundament” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przygotować repo pod konteksty `contexts/bc_*`: wspólna infrastruktura w `lib/http/`, `lib/schema/` i `lib/nexus/`, test architektury z baseline, ADR-021 i sekcja „Struktura” w `CLAUDE.md`. Bez zmian zachowania aplikacji.

**Architecture:** Przenosiny plików (bez zmiany treści poza ścieżkami importów) + nowy test statyczny `tests/unit/architecture.static.test.ts`, który skanuje importy w kodzie źródłowym i sprawdza reguły 1–9 ze specu struktury §6. Silnik reguł jest czystą funkcją testowaną na sztucznych danych (czerwona faza TDD), a ten sam silnik sprawdza prawdziwe repo z jawną listą wyjątków.

**Tech Stack:** TypeScript, Next.js 14 App Router, Vitest (`node` environment dla testów statycznych).

**Spec:** `docs/superpowers/specs/2026-11-12-struktura-kontekstow-design.md` (§5, §6, §7 „PR 1”). **Warunek wstępny:** spec ma status „zaakceptowany” (dziś „szkic do przeglądu”); przy akceptacji zmień status w specu w tym samym PR (Task 7).

**Gałąź:** `feat/struktura-pr1-fundament` od aktualnego `main` (po merge gałęzi ze specami).

---

## Mapa plików

| Akcja          | Ścieżka                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Przenieś       | `lib/{apiError,parseBody,inferHttpStatus,uploadFormFile,localGuard}.ts` → `lib/http/`                                                                                     |
| Przenieś       | `lib/validation/looseObject.ts` → `lib/schema/looseObject.ts`                                                                                                             |
| Przenieś       | `lib/nexus/repos/common.ts` → `lib/nexus/record-helpers.ts`, `lib/nexus/repos/markdown-dir.ts` → `lib/nexus/markdown-dir.ts`                                              |
| Przenieś testy | `tests/unit/lib/{apiError,parseBody,inferHttpStatus,uploadFormFile,localGuard}.test.ts` → `tests/unit/lib/http/`                                                          |
| Przenieś test  | `tests/unit/lib/nexus/repos/markdown-dir.test.ts` → `tests/unit/lib/nexus/markdown-dir.test.ts`                                                                           |
| Zmień importy  | 19 tras `app/api/**/route.ts`, `middleware.ts`, `lib/http/apiError.ts`, 5 plików `lib/validation/*.ts`, 10 plików `lib/nexus/repos/*.ts`, `tests/unit/api/upload.test.ts` |
| Zmień test     | `tests/unit/lib/nexus/repos-static.test.ts` (listy plików)                                                                                                                |
| Utwórz         | `tests/unit/architecture.static.test.ts`                                                                                                                                  |
| Utwórz         | `docs/adr/021-struktura-kontekstow-wg-vaulta-nexus.md`                                                                                                                    |
| Zmień          | `docs/adr/014-layer-separation-and-service-layer.md`, `docs/adr/018-feature-modules-wiedza-planowanie.md` (dopisek), `CLAUDE.md`                                          |

Stan importów sprawdzony 2026-11-12 (`grep`): `lib/apiError` i `lib/parseBody` importują tylko trasy `app/api/**`; `lib/uploadFormFile` — `app/api/upload/route.ts` i mock w `tests/unit/api/upload.test.ts:8`; `lib/localGuard` — `middleware.ts`; `lib/inferHttpStatus` — `lib/apiError.ts`; `looseObject` — `lib/validation/{calendarEvents,notes,tags,taskTemplates,tasks}.ts`; `./common` — wszystkie repozytoria w `lib/nexus/repos/` i `markdown-dir.ts`; `./markdown-dir` — `repos/notes.ts`, `repos/documents.ts`. `src/**` nie importuje żadnego z nich.

---

### Task 1: Przenosiny do `lib/http/` i `lib/schema/` (mechaniczne, `cursor --role task`)

**Files:** jak w mapie (wiersze 1, 2, 4 i odpowiadające importy).

- [ ] **Step 1: Zleć przenosiny `cursor`**

```bash
scripts/ask-helper.sh --role task --fresh cursor "W repo (cwd) wykonaj przenosiny przez git mv, bez zmiany treści poza ścieżkami importów:
1) lib/apiError.ts, lib/parseBody.ts, lib/inferHttpStatus.ts, lib/uploadFormFile.ts, lib/localGuard.ts -> lib/http/<ta sama nazwa>
2) lib/validation/looseObject.ts -> lib/schema/looseObject.ts
3) tests/unit/lib/{apiError,parseBody,inferHttpStatus,uploadFormFile,localGuard}.test.ts -> tests/unit/lib/http/
Zaktualizuj importy: '@/lib/apiError' -> '@/lib/http/apiError' (analogicznie parseBody, uploadFormFile, localGuard, inferHttpStatus) w app/api/**, middleware.ts, lib/http/apiError.ts; '@/lib/validation/looseObject' -> '@/lib/schema/looseObject' w lib/validation/*.ts; vi.mock('@/lib/uploadFormFile') -> vi.mock('@/lib/http/uploadFormFile') w tests/unit/api/upload.test.ts. W przeniesionych testach zamień WSZYSTKIE importy względne na alias '@/': '../../../lib/X.js' -> '@/lib/http/X' dla pięciu przenoszonych plików, a pozostałe (np. '../../../lib/errors.js', '../../../lib/nexus/vault-path.js' w apiError.test.ts) -> '@/lib/errors', '@/lib/nexus/vault-path' itd. Nie ruszaj innych testów w tests/unit/lib/. Nie commituj. Odpowiedz: lista zmienionych plików albo problem."
```

- [ ] **Step 2: Sprawdź wynik**

Run: `git status --short && git diff --stat && grep -rnE "@/lib/(apiError|parseBody|inferHttpStatus|uploadFormFile|localGuard|validation/looseObject)\b|lib/(apiError|parseBody|uploadFormFile)\.js" app lib services src types middleware.ts tests && grep -rn "from \"\.\./" tests/unit/lib/http`
Expected: przenosiny widoczne jako `R` (rename), oba grepy puste.

- [ ] **Step 3: Testy i typy (`cursor`)**

```bash
scripts/ask-helper.sh --keep cursor "Uruchom npx tsc --noEmit oraz npx vitest run tests/unit/lib tests/unit/api tests/unit/middleware.test.ts. Odpowiedz 'przeszło' albo lista plik:linia + przyczyna."
```

Expected: „przeszło”.

- [ ] **Step 4: Commit**

```bash
git add -A lib app middleware.ts tests
git commit -m "refactor(lib): pomocniki HTTP do lib/http, looseObject do lib/schema"
```

### Task 2: Pomocniki repozytoriów do `lib/nexus/`

**Files:**

- Przenieś: `lib/nexus/repos/common.ts` → `lib/nexus/record-helpers.ts`, `lib/nexus/repos/markdown-dir.ts` → `lib/nexus/markdown-dir.ts`, `tests/unit/lib/nexus/repos/markdown-dir.test.ts` → `tests/unit/lib/nexus/markdown-dir.test.ts`
- Modify: `lib/nexus/repos/{board,calendarEvents,documents,mindMaps,notes,resources,tags,taskTemplates,tasks}.ts`, `tests/unit/lib/nexus/repos-static.test.ts`

- [ ] **Step 1: Zaktualizuj najpierw test statyczny (czerwony)** — osobny commit testu, zgodnie z §6 specu

W `tests/unit/lib/nexus/repos-static.test.ts`:

```ts
const REPOS = [
  "lib/nexus/record-helpers.ts",
  ...["tags", "taskTemplates", "resources", "notes", "documents"].map(
    (name) => `lib/nexus/repos/${name}.ts`
  ),
];
const FILE_REPOS = [
  "lib/nexus/markdown-dir.ts",
  ...["tasks", "calendarEvents", "mindMaps", "board"].map((name) => `lib/nexus/repos/${name}.ts`),
];
```

i w oczekiwanej liście importerów `vault-fs` zamień `"lib/nexus/repos/markdown-dir.ts"` na `"lib/nexus/markdown-dir.ts"`. Nazwa `describe` bez zmian.

Run: `npx vitest run tests/unit/lib/nexus/repos-static.test.ts`
Expected: FAIL w „scans existing sources” (nie istnieją `lib/nexus/record-helpers.ts` ani `lib/nexus/markdown-dir.ts`) i w teście listy importerów `vault-fs`.

```bash
git add tests/unit/lib/nexus/repos-static.test.ts
git commit -m "test(nexus): repos-static wskazuje nowe miejsca record-helpers i markdown-dir"
```

- [ ] **Step 2: Przenieś pliki**

```bash
git mv lib/nexus/repos/common.ts lib/nexus/record-helpers.ts
git mv lib/nexus/repos/markdown-dir.ts lib/nexus/markdown-dir.ts
git mv tests/unit/lib/nexus/repos/markdown-dir.test.ts tests/unit/lib/nexus/markdown-dir.test.ts
```

- [ ] **Step 3: Popraw importy**

- `lib/nexus/record-helpers.ts`: `"../yaml-lists"` → `"./yaml-lists"`, `"../yaml-store"` → `"./yaml-store"`.
- `lib/nexus/markdown-dir.ts`: `"../frontmatter"` → `"./frontmatter"`, `"../slug"` → `"./slug"`, import z `"../vault-fs"` (linie 4–11) → `"./vault-fs"`, `"./common"` → `"./record-helpers"`.
- Każdy `lib/nexus/repos/*.ts`: `from "./common"` → `from "../record-helpers"`; w `notes.ts` i `documents.ts` `from "./markdown-dir"` → `from "../markdown-dir"`.
- `tests/unit/lib/nexus/markdown-dir.test.ts`: `"@/lib/nexus/repos/markdown-dir"` → `"@/lib/nexus/markdown-dir"`; jeśli importuje `./helpers`, zmień na `./repos/helpers`.

Run: `grep -rn "repos/common\|repos/markdown-dir\|\"./common\"" lib tests`
Expected: pusto.

- [ ] **Step 4: Testy i typy**

Run: `npx tsc --noEmit && npx vitest run tests/unit/lib/nexus`
Expected: PASS (w tym `repos-static.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add -A lib/nexus tests/unit/lib/nexus
git commit -m "refactor(nexus): record-helpers i markdown-dir jako wspólne pomocniki lib/nexus"
```

### Task 3: Test architektury — silnik reguł na sztucznych danych (TDD)

**Files:**

- Create: `tests/unit/architecture.static.test.ts`

Test ma dwie części: (A) `describe("reguły na danych testowych")` — silnik `violations()` dostaje sztuczną listę importów i musi zgłosić konkretne naruszenia (to jest czerwona faza: „pęka na sztucznym naruszeniu”); (B) `describe("repo")` — Task 4.

- [ ] **Step 1: Napisz interfejsy i przypadki (czerwony)**

Typy i funkcje w pliku testu (implementacja w Step 3):

```ts
// @vitest-environment node
/** `from` i `to` zawsze znormalizowane (jak wynik `normalize`), np. `app/api/p/route`, `contexts/bc_a/services`. */
type Edge = { from: string; to: string; typeOnly: boolean };
/** Ścieżka znormalizowana: względem korzenia repo, `/`, bez rozszerzenia i bez `/index`. */
function normalize(fromFile: string, specifier: string, exists: (rel: string) => boolean): string | null;
/** Importy z tekstu: `import … from "x"`, `export … from "x"`, `import("x")`, `require("x")`. */
function extractImports(text: string): { specifier: string; typeOnly: boolean; statement: string }[];
/**
 * Zwraca listę naruszeń: `<from> → <to> (reguła N)`; dla cyklu (R8)
 * `cykl: contexts/bc_a/services → contexts/bc_b/services → contexts/bc_a/services (reguła 8)`.
 * `routeFiles`: znormalizowana ścieżka trasy (`app/api/**/route`) → treść pliku.
 */
function violations(edges: Edge[], routeFiles: Map<string, string>): string[];
```

`normalize` zwraca `null` dla pakietów (`next/server`, `zod`, `node:fs`) — nie są ścieżkami repo. Rozwiązuje `@/x`, `./x`, `../x`, ucina `.js`/`.ts`/`.tsx`, a gdy `x` jest katalogiem z `index.ts(x)` — zwraca `x` (bez `/index`); gdy `x/index` podano jawnie — też `x`. Ścieżka pliku źródłowego (`from`) jest normalizowana tak samo (`app/api/p/route.ts` → `app/api/p/route`, `contexts/bc_a/repositories/index.ts` → `contexts/bc_a/repositories`).

Przypadki (każdy jako osobny `it`, oczekiwanie = dokładna lista naruszeń):

| #   | `from`                                                                                                                                                               | `to` (po normalizacji)                                  | Oczekiwanie                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| n1  | `normalize("src/a/B.tsx", "../../lib/nexus/vault-fs.js")`                                                                                                            | —                                                       | `"lib/nexus/vault-fs"`                                                                                                                                                     |
| n2  | `normalize("app/api/x/route.ts", "@/contexts/bc_p/router")` gdy `contexts/bc_p/router/index.ts` istnieje                                                             | —                                                       | `"contexts/bc_p/router"`                                                                                                                                                   |
| n3  | `normalize("lib/a.ts", "zod")`                                                                                                                                       | —                                                       | `null`                                                                                                                                                                     |
| r1  | `src/features/x/A.tsx`                                                                                                                                               | `contexts/bc_p/services`                                | 1 naruszenie, reguła 1                                                                                                                                                     |
| r1b | `src/features/x/A.tsx`                                                                                                                                               | `contexts/bc_p/schemas`                                 | brak                                                                                                                                                                       |
| r1c | `src/features/x/A.tsx`                                                                                                                                               | `lib/http/apiError`, `services/x`, `lib/nexus/vault-fs` | 3 naruszenia, reguła 1                                                                                                                                                     |
| r2  | `contexts/bc_a/services`                                                                                                                                             | `contexts/bc_b/repositories`                            | reguła 2 (i 3)                                                                                                                                                             |
| r2b | `contexts/bc_a/services`                                                                                                                                             | `contexts/bc_b/services`                                | brak                                                                                                                                                                       |
| r2c | `contexts/bc_a/router`                                                                                                                                               | `contexts/bc_b/services`                                | reguła 2 (inny kontekst tylko z warstwy `services`)                                                                                                                        |
| r2d | `lib/x`                                                                                                                                                              | `contexts/bc_a/services`                                | reguła 3 (`services` importują tylko własny `router`, `services` innych kontekstów i stary `services/**`)                                                                  |
| r2e | `contexts/bc_a/router`                                                                                                                                               | `lib/http/apiError`, `lib/errors`                       | brak (infrastruktura spoza kontekstu)                                                                                                                                      |
| r3  | `contexts/bc_a/repositories`                                                                                                                                         | `contexts/bc_a/services`                                | reguła 3                                                                                                                                                                   |
| r3b | `contexts/bc_a/repositories/index`→ norm. `contexts/bc_a/repositories`                                                                                               | `contexts/bc_a/repositories/markdown`                   | brak (wnętrze folderu)                                                                                                                                                     |
| r3c | `contexts/bc_a/schemas`                                                                                                                                              | `contexts/bc_a/models` z `typeOnly: false`              | reguła 3 (schemas → models tylko `import type`)                                                                                                                            |
| r3d | `contexts/bc_a/schemas`                                                                                                                                              | `contexts/bc_a/models` z `typeOnly: true`               | brak                                                                                                                                                                       |
| r3e | `contexts/bc_a/router`                                                                                                                                               | `contexts/bc_a/repositories`                            | reguła 3                                                                                                                                                                   |
| r3f | `contexts/bc_a/models`                                                                                                                                               | `contexts/bc_a/schemas`                                 | reguła 3                                                                                                                                                                   |
| r3g | `contexts/bc_a/schemas`                                                                                                                                              | `lib/http/apiError`                                     | reguła 3 (`schemas` bezpieczny dla klienta: tylko `lib/schema/**` i `import type` z własnego `models`)                                                                     |
| r3h | `contexts/bc_a/schemas`                                                                                                                                              | `lib/schema/looseObject`                                | brak                                                                                                                                                                       |
| r4  | `services/x`                                                                                                                                                         | `contexts/bc_a/router`                                  | reguła 4                                                                                                                                                                   |
| r4b | krawędź `app/api/p/route → contexts/bc_a/router` + `routeFiles` `{"app/api/p/route": 'export { list as GET } from "@/contexts/bc_a/router";\nimport x from "zod";'}` | —                                                       | `["app/api/p/route → zod (reguła 4)"]` (każda instrukcja poza jednym re-eksportem routera = naruszenie, `to` = specyfikator)                                               |
| r4c | ta sama krawędź + `routeFiles` z samym re-eksportem                                                                                                                  | —                                                       | brak                                                                                                                                                                       |
| r4d | `app/api/p/route` z treścią `import { list } from "@/contexts/bc_a/router";\nexport const GET = list;`                                                               | —                                                       | reguła 4 (import zamiast re-eksportu)                                                                                                                                      |
| r5  | `services/x`                                                                                                                                                         | `lib/nexus/vault-fs`                                    | reguła 5                                                                                                                                                                   |
| r5b | `lib/workGuard`                                                                                                                                                      | `lib/nexus/vault-path`                                  | brak                                                                                                                                                                       |
| r5e | `lib/workGuard`                                                                                                                                                      | `lib/nexus/vault-fs` z `typeOnly: false`                | reguła 5 (z `vault-fs` tylko `import type`)                                                                                                                                |
| r5c | `contexts/bc_a/repositories`                                                                                                                                         | `lib/nexus/vault-fs`                                    | brak                                                                                                                                                                       |
| r5d | `lib/firestore-db`                                                                                                                                                   | `lib/nexus/repos/tags`                                  | brak (wyjątek do PR 10)                                                                                                                                                    |
| r6  | `lib/x`                                                                                                                                                              | `src/features/y`                                        | reguła 6                                                                                                                                                                   |
| r6b | `app/layout`                                                                                                                                                         | `src/components/theme/ThemeScript`                      | brak (reguła 6 dotyczy `app/api/**`)                                                                                                                                       |
| r7  | `contexts/bc_a/services`                                                                                                                                             | `lib/firestore-db`                                      | reguła 7                                                                                                                                                                   |
| r7b | `services/calendarService`                                                                                                                                           | `contexts/bc_a/services`                                | brak                                                                                                                                                                       |
| r8  | `contexts/bc_a/services → contexts/bc_b/services` i `contexts/bc_b/services → contexts/bc_a/services`                                                                | —                                                       | `["cykl: contexts/bc_a/services → contexts/bc_b/services → contexts/bc_a/services (reguła 8)"]` (cykl zaczyna się od kontekstu najmniejszego alfabetycznie, zgłaszany raz) |
| r9  | `types/records`                                                                                                                                                      | `contexts/bc_a/models`                                  | reguła 9                                                                                                                                                                   |
| r9b | `types/records`                                                                                                                                                      | `contexts/bc_a/schemas`                                 | brak                                                                                                                                                                       |

Pomocnik w teście: `const e = (from: string, to: string, typeOnly = false): Edge => ({ from, to, typeOnly, reexportOnly: false })`.

- [ ] **Step 2: Uruchom — ma pęknąć**

Run: `npx vitest run tests/unit/architecture.static.test.ts`
Expected: FAIL (funkcje rzucają `not implemented` albo zwracają `[]`).

- [ ] **Step 3: Zaimplementuj silnik**

Reguły (ścieżki znormalizowane, `ctx(p)` = `bc_x` dla `contexts/bc_x/...`, `layer(p)` = pierwszy segment po `contexts/bc_x/`, np. `services`, `repositories`; `isRoute(p)` = `app/api/**/route`):

- R1: `from` w `src/` i `to` w (`contexts/` z `layer ≠ schemas`) ∪ `services/` ∪ `lib/nexus/` ∪ `lib/http/`.
- R2: `ctx(from) ≠ ctx(to)`, oba w `contexts/`, i (`layer(to) ≠ services` lub `layer(from) ≠ services`).
- R3 (ten sam kontekst): dozwolone `router → {services, schemas}`; `services → {repositories, models}`; `repositories → models`; `schemas → models` tylko `typeOnly`; ten sam `layer` (wnętrze folderu) zawsze dozwolony; reszta = naruszenie. Spoza kontekstu: `to` z `layer = repositories` lub `models` z innego kontekstu lub spoza `contexts/` = R3; `to` z `layer = services` importowany spoza `contexts/` dozwolony tylko z `services/**` (R7 dopuszcza stary serwis), inaczej R3. `from` z `layer = schemas` może importować w repo wyłącznie własne `models` (`typeOnly`) i `lib/schema/**`; każdy inny cel w repo = R3 (pakiety, np. `zod`, nie są krawędziami). Importy innych warstw kontekstu z infrastruktury (`lib/http/**`, `lib/errors`, `lib/schema/**`) R3 nie dotyczą; `lib/nexus/**` pilnuje R5.
- R4: `layer(to) = router` i `from` nie jest `isRoute` ani wnętrzem tego samego folderu `router/`. Dla każdej trasy z `routeFiles`, która ma krawędź do `contexts/**`: `extractImports(treść)` ma mieć dokładnie jedną instrukcję i ma ona pasować do `/^export\s*\{[^}]*\}\s*from\s*["'][^"']*\/router["']/`; każda inna instrukcja daje `` `${route} → ${specifier} (reguła 4)` ``.
- R5: `to` w `lib/nexus/` i `from` nie jest: `contexts/*/repositories*`, `lib/nexus/**`, `lib/workGuard` (tylko `to = lib/nexus/vault-path` albo `to = lib/nexus/vault-fs` z `typeOnly`), `lib/firestore-db` (tylko `to` w `lib/nexus/repos/`).
- R6: `from` w `app/api/`, `services/`, `lib/`, `contexts/`, `types/` i `to` w `src/`.
- R7: `from` w `contexts/` i `to` w `services/` lub `to ∈ {types/records, lib/firestore-db}`.
- R8: DFS po krawędziach `contexts/bc_*/services* → contexts/bc_*/services*` (węzeł = kontekst); cykl → jedno naruszenie z listą kontekstów.
- R9: `from = types/records` i `to` w `contexts/` z `layer ≠ schemas`.

Format naruszenia: `` `${from} → ${to} (reguła ${n})` ``. Jedna krawędź może dać kilka reguł; zwracaj posortowaną listę bez duplikatów.

`extractImports`: wyrażenia regularne na tekście bez komentarzy (`/\/\*[\s\S]*?\*\//g`, `/^\s*\/\/.*$/gm` usunięte przed skanem):
`/^\s*(?:import|export)\s+(type\s+)?(?:[^;"'`]_?\s+from\s+)?["']([^"']+)["']/gm`(instrukcja od początku linii; środek nie może zawierać`;`ani cudzysłowów, więc`export type X = …;`czy`export const s = "…"`nie skleją się z następnym importem — repo ma średniki z prettiera),`/import\(\s_["']([^"']+)["']\s*\)/g`, `/require\(\s*["']([^"']+)["']\s\*\)/g`. `typeOnly`= jest`type`zaraz po`import`/`export` (`import { type X }`liczy się jako runtime — wersja ostrożna). Dodatkowe przypadki testowe`extractImports`: (e1) `'export type A = { a: 1 };\nimport { b } from "./models";'`→ jeden import`./models`z`typeOnly: false`; (e2) `'export const s = "x";\nimport type { T } from "./m";'`→ jeden import`./m`z`typeOnly: true`; (e3) import wieloliniowy `import {\n a,\n b\n} from "@/lib/x";`→`@/lib/x`; (e4) import w komentarzu `// import x from "y"`→ brak. Uwaga:`typeof import("@/src/…")`w`src/\*\*`daje krawędź`src → src` — dozwoloną.

Run: `npx vitest run tests/unit/architecture.static.test.ts`
Expected: PASS wszystkich przypadków n1–r9b.

- [ ] **Step 4: Commit (sam test)**

```bash
git add tests/unit/architecture.static.test.ts
git commit -m "test(arch): silnik reguł importów ze specu struktury §6"
```

### Task 4: Test architektury — skan repo i baseline

**Files:** Modify: `tests/unit/architecture.static.test.ts`

- [ ] **Step 1: Dodaj skan i baseline**

```ts
const SCAN = ["app", "contexts", "lib", "services", "src", "types"]; // + plik middleware.ts
const BASELINE: readonly string[] = [
  "services/boardService → src/features/board/boardTypes",
  "services/boardService → src/features/board/boardSchema",
  "services/mindMapService → src/features/mind-maps/mindMapTypes",
  "app/api/board/route → src/features/board/boardSchema",
  "app/api/mind-maps/[id]/route → src/features/mind-maps/mindMapTypes",
];
```

Katalog nieistniejący (dziś `contexts/`) jest pomijany. Pliki `*.ts`, `*.tsx`; pomiń `node_modules`, `.next`. Klucz wyjątku = `from → to` bez numeru reguły (wyjątek pokrywa wszystkie reguły tej krawędzi).

Przypadki w `describe("repo")`:

- `it("skanuje kod źródłowy")` — liczba plików > 100 i zawiera `middleware.ts`, `lib/http/apiError.ts`.
- `it("brak naruszeń poza baseline")` — `violations(...)` po odfiltrowaniu kluczy z `BASELINE` = `[]`.
- `it("każdy wyjątek z baseline nadal występuje")` — każdy wpis `BASELINE` jest wśród krawędzi z naruszeniem (wyjątek nieużywany = błąd, lista może tylko maleć).

- [ ] **Step 2: Uruchom**

Run: `npx vitest run tests/unit/architecture.static.test.ts`
Expected: PASS. Jeśli pojawi się naruszenie spoza baseline — to błąd w silniku albo nieznany dług; zatrzymaj się i zgłoś (nie dopisuj do baseline bez decyzji; baseline jest zamknięty specem).

- [ ] **Step 3: Sprawdzenie ręczne „pęka na naruszeniu”**

Tymczasowo dopisz do `src/App.tsx` linię `import "@/lib/nexus/vault-path";`, uruchom test → FAIL z `src/App → lib/nexus/vault-path (reguła 1)`. Cofnij: `git checkout src/App.tsx`.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/architecture.static.test.ts
git commit -m "test(arch): skan repo z baseline znanych naruszeń"
```

### Task 5: ADR-021 i dopiski w ADR-014 / ADR-018

**Files:**

- Create: `docs/adr/021-struktura-kontekstow-wg-vaulta-nexus.md`
- Modify: `docs/adr/014-layer-separation-and-service-layer.md`, `docs/adr/018-feature-modules-wiedza-planowanie.md`

- [ ] **Step 1: Napisz ADR-021** w formacie ADR-020 (`# ADR-021: …`, `## Status`, `## Kontekst`, `## Decyzja`, `## Konsekwencje`):

- Status: „Zaakceptowany (data akceptacji). Zastępuje mapowanie folderów z ADR-014; uzupełnia ADR-018.”
- Kontekst: §1 i §2 specu (źródła vaulta, pominięte elementy AI).
- Decyzja: tabela S1–S8, tabela siatki §4 z kolumną „Kto może importować”, kierunek wewnątrz kontekstu, „Plik → folder”, „Brak pliku”, reguły 1–9 z §6, baseline, zasada „zmiany testu architektury osobnym commitem”, UI wspólne §5.1 z wyjątkami `planowanie`, `cards`, `home` (konwencja review).
- Konsekwencje: kolejność PR 2–10 (§7), ryzyka §8, `looseObject`/`strict` jako osobna decyzja po PR 10.
- Odnośnik do specu `docs/superpowers/specs/2026-11-12-struktura-kontekstow-design.md`.

- [ ] **Step 2: Dopiski** — na końcu sekcji `## Status` w ADR-014 i ADR-018 linia: „Mapowanie folderów zastąpione przez ADR-021 (2026-11-12).”

- [ ] **Step 3: Commit**

```bash
git add docs/adr
git commit -m "docs(adr): ADR-021 struktura kontekstów wg vaulta NEXUS"
```

### Task 6: Sekcja „Struktura” w `CLAUDE.md`

**Files:** Modify: `CLAUDE.md` (nowa sekcja `## Struktura kodu` przed `## Współpraca wielu agentów`)

- [ ] **Step 1: Dopisz sekcję** (maks. ~20 linii): `contexts/bc_<nazwa>/` z pięcioma plikami i jednym zdaniem roli każdego; kierunek `route.ts → router → services → repositories → lib/nexus`; „inny kontekst tylko przez jego `services`”; „UI (`src/**`) importuje z kontekstu tylko `schemas`”; infrastruktura `lib/nexus/`, `lib/http/`, `lib/schema/`, `lib/errors.ts`; „Test `tests/unit/architecture.static.test.ts` pilnuje reguł; zmiany testu i baseline zawsze osobnym commitem, nigdy razem z kodem”; odnośnik do ADR-021.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): sekcja Struktura kodu (skrót ADR-021)"
```

### Task 7: Bramka weryfikacji i review

- [ ] **Step 1: Status specu** — w `docs/superpowers/specs/2026-11-12-struktura-kontekstow-design.md` zmień `Status:` na „zaakceptowany (data)” (tylko gdy użytkownik zaakceptował). Commit `docs(spec): akceptacja struktury kontekstów`.

- [ ] **Step 2: Pełna bramka (`cursor`)**

```bash
scripts/ask-helper.sh --fresh --timeout 900 cursor "Uruchom kolejno: npx vitest run; npx tsc --noEmit; npm run lint; npm run build. Odpowiedz dla każdej komendy 'przeszło' albo lista plik:linia + przyczyna."
```

Expected: wszystkie „przeszło”.

- [ ] **Step 3: Review diffa (`agy`)**

```bash
scripts/ask-helper.sh --role review agy "Review diffa git diff main...HEAD w repo. Kontekst: PR 1 'fundament' ze specu docs/superpowers/specs/2026-11-12-struktura-kontekstow-design.md (§5-§7). Sprawdź: (1) przenosiny bez zmian treści poza importami, (2) czy tests/unit/architecture.static.test.ts poprawnie realizuje reguły 1-9 z §6 i czy normalizacja ścieżek da się obejść, (3) czy baseline zawiera dokładnie 5 par ze specu. Odpowiedz listą: plik:linia, problem, waga (blokujące/drobne)."
```

Uwagi traktuj jak hipotezy: sprawdź w kodzie, popraw, zmiany testu architektury osobnym commitem.

- [ ] **Step 4: PR** — po zgodzie użytkownika: push i `gh pr create` z opisem (zakres, kryterium z §7 PR 1, wynik bramki).
