# PR 9: `bc_mind_maps` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przenieść domenę map myśli (`MindMaps/*.json`, trasy `/api/mind-maps`) do `contexts/bc_mind_maps/` i przepiąć UI (`src/features/mind-maps/`) na `contexts/bc_mind_maps/schemas`, bez zmiany zachowania. Koniec dwóch wyjątków `mind-maps` w baseline testu architektury, a przy okazji koniec starej warstwy (`services/`, `lib/nexus/repos/`, `lib/firestore-db.ts`, `types/`).

**Architecture:** Wzór: PR 3–8 (zwłaszcza `bc_board`, `bc_tags`). Kierunek `app/api/mind-maps/**/route.ts` (re-eksport) → `router` → `services` → `repositories` → `lib/nexus/vault-fs`. Typy domeny (`MindMap`, `MindMapNode`) przechodzą z `types/records.ts` do `models`, DTO i schematy zod (dziś inline w trasie `[id]`) do `schemas`.

**Tech Stack:** Next.js 14, TypeScript, zod 4, vitest, `lib/nexus` (vault).

Spec: `docs/superpowers/specs/2026-11-12-struktura-kontekstow-design.md` (§7 wiersz PR 9). Osobnego specu PR nie ma: kontekst jest mały (5 funkcji, 2 pliki tras), decyzje poniżej.

## Stan wyjściowy (zweryfikowany odczytem)

- Backend: `services/mindMapService.ts` (48 l.), `lib/nexus/repos/mindMaps.ts` (125 l., jedyny plik w `lib/nexus/repos/`), `app/api/mind-maps/route.ts` (GET, POST), `app/api/mind-maps/[id]/route.ts` (GET, PATCH, DELETE), barrel `lib/firestore-db.ts` (eksportuje już **tylko** 5 funkcji map), `types/records.ts` (20 l., tylko `MindMap`, `MindMapNode`), `types/index.ts` (1 linia re-eksportu).
- UI jest już w `src/features/mind-maps/` (10 komponentów, hooki, `mindMapLayout/Nav/History/Autosave/Export*`), plus `src/lib/mindMapUtils.ts`. Typy i stałe UI siedzą w `src/features/mind-maps/mindMapTypes.ts` (re-eksport z `@/types/records` + `DEFAULT_COL_W`, `MIN_COL_W`, `MAX_COL_W`). Importuje je 18 plików UI i 8 testów.
- Baseline (`tests/unit/architecture.static.test.ts:474-475`): `services/mindMapService → src/features/mind-maps/mindMapTypes`, `app/api/mind-maps/[id]/route → src/features/mind-maps/mindMapTypes`.
- Poza `lib/firestore-db.ts` nikt (kod produkcyjny) poza `services/mindMapService.ts` nie importuje barrela; w testach: `tests/unit/services/mindMapService.test.ts` (mock), `repos-static.test.ts`, `no-user-id.static.test.ts` (`FILES = ["lib/firestore-db.ts"]`).

## Decyzje projektowe

1. **Reguły domeny zostają w `services`** (są realne, w odróżnieniu od `bc_board`): `createMindMap` (pusty tytuł → „Nowa mapa”, korzeń `id: "root"`), `getMindMaps` (sort po `updatedAt` malejąco), `getMindMap` (brak → `DomainError(…, 404)`), `saveMindMap` (sprawdza istnienie, `trim` tytułu, składa patch), `deleteMindMap` (sprawdza istnienie). Przenosiny 1:1, tylko źródło danych zmienia się z `firestoreDb` na `repositories`.
2. **Walidacja wejścia w `router`/`schemas`.** `MindMapNodeSchema` (rekurencyjny `z.lazy`), `CreateMindMapBodySchema`, `SaveMindMapBodySchema` przechodzą z tras do `schemas.ts`. `parseBody` z domyślnymi opcjami (bez `{ details: false }`), żeby odpowiedzi 400 były identyczne jak dziś.
3. **DTO** `MindMapDto`, `MindMapNodeDto` (ten sam kształt co modele); `toMindMapDto(map: MindMap)` zwraca dokładnie te same klucze co dziś (`id, title, rootNode, colWidths, createdAt?, updatedAt?`), więc JSON odpowiedzi jest bez zmian.
4. **UI: jedna zmiana zamiast 26.** `src/features/mind-maps/mindMapTypes.ts` zastępuje dotychczasowy re-eksport z `@/types/records` aliasami DTO: `export type { MindMapDto as MindMap, MindMapNodeDto as MindMapNode } from "@/contexts/bc_mind_maps/schemas";` i zachowuje trzy stałe `*_COL_W`. Importy w komponentach i testach UI nie zmieniają się. (Alternatywa jak w PR 8, czyli aliasowanie w każdym pliku, daje 26 zmian bez zysku.) Reguła „UI importuje z kontekstu tylko `schemas`” jest spełniona.
5. **Repozytorium to jeden plik** `repositories.ts` (przenosiny 1:1; zmiana: typy z `./models`, importy `@/lib/nexus/vault-fs` i `@/lib/nexus/record-helpers` zamiast względnych `../`).
6. **Koniec starej warstwy już w tym PR (odstępstwo od §7, który zostawia to PR 10).** Po przeniesieniu `lib/firestore-db.ts` nie ma żadnych eksportów, `services/` i `lib/nexus/repos/` są puste, a `types/records.ts` traci obie definicje. Puste pliki-widma nie mają sensu, więc `git rm` tych czterech obiektów (`services/`, `lib/nexus/repos/`, `lib/firestore-db.ts`, `types/`) wchodzi tutaj. PR 10 zostaje z: regułami w teście architektury (R5 wyjątek, R7/R9 martwe), scaleniem `repos-static` z testem architektury, README, `STAN-W-KODZIE.md`. Zmiany w samym teście architektury tylko w osobnym commicie (CLAUDE.md).
7. **Test integracyjny** `tests/integration/services/mindMapService.integration.test.ts` jest z czasów Firestore (opis „when Firestore is available”) i po wyjęciu `services/` przestaje się kompilować; uruchomiony z `RUN_INTEGRATION_TESTS=1` pisałby do prawdziwego vaulta. Usuwam go (`git rm`); pokrycie przejmują `services.test.ts` i `repositories.test.ts` (tempowy vault). Reszta `tests/integration/` (skrypty eksportu Firestore) poza zakresem.

**Poza zakresem:** format plików `MindMaps/*.json`, zachowanie UI, stałe `*_COL_W` (zostają w UI), `README.md`/`STAN-W-KODZIE.md` (PR 10), reguły w teście architektury (PR 10), zmiana `looseObject`/`strict`.

## Zasady wykonania

- Komendy z `~/projects/Brain_7224/Monolith`, gałąź `feat/pr-9-bc-mind-maps` (od `main`; plan jest jej pierwszym commitem).
- **Testów, lintu, tsc i builda nie uruchamiam w swoim kontekście**: `scripts/ask-helper.sh --role task --approve-allowed cursor "Uruchom jedno polecenie, dokładnie: <polecenie> (bez pipe, bez przekierowań, bez cd, bez innych flag). Odpowiedz: przeszło albo lista plik:linia + przyczyna."`. Kod wyjścia 2 = zgoda w panelu (CLAUDE.md; nigdy `-u`/`--update`: w `tests/unit/features/mind-maps/__snapshots__/` leży snapshot HTML eksportu).
- Stan po zadaniach 1–4 ma celowo czerwone testy; **jeden commit kodu po zadaniu 5** (backend + UI + usunięcie starej warstwy atomowo), potem **osobny commit baseline** (zadanie 6): test architektury jest między nimi czerwony tylko w „każdy wyjątek z baseline nadal występuje”.
- Testy kontekstu (`tests/unit/contexts/**`) mają `// @vitest-environment node`. Przenosimy przez `git mv` (historia). Kod usuwamy w całości (`git rm`).
- `router` importuje tylko `services` i `schemas` (R3), typy bierze ze `schemas`; `schemas` importuje `models` wyłącznie jako `import type`.

## Mapa plików

Tworzone: `contexts/bc_mind_maps/{models,schemas,services,router}.ts`, `tests/unit/contexts/bc_mind_maps/{schemas,router}.test.ts`.

Przenoszone (`git mv`): `lib/nexus/repos/mindMaps.ts` → `contexts/bc_mind_maps/repositories.ts`; `tests/unit/lib/nexus/repos/mindMaps.test.ts` → `tests/unit/contexts/bc_mind_maps/repositories.test.ts`; `tests/unit/services/mindMapService.test.ts` → `tests/unit/contexts/bc_mind_maps/services.test.ts`.

Usuwane: `services/mindMapService.ts`, `lib/firestore-db.ts`, `types/records.ts`, `types/index.ts`, `tests/integration/services/mindMapService.integration.test.ts`.

Modyfikowane: `app/api/mind-maps/route.ts`, `app/api/mind-maps/[id]/route.ts`, `src/features/mind-maps/mindMapTypes.ts`, `tests/unit/lib/nexus/repos-static.test.ts`, `tests/unit/no-user-id.static.test.ts`; w osobnym commicie `tests/unit/architecture.static.test.ts`.

---

### Task 1: Modele i repozytorium

- [ ] **Step 1:** `contexts/bc_mind_maps/models.ts`: `MindMapNode` (`id, label, note, collapsed, children: MindMapNode[]`) i `MindMap` (`id, title, rootNode, colWidths: Record<number, number>, createdAt?, updatedAt?`), skopiowane z `types/records.ts` razem z komentarzami.
- [ ] **Step 2:** `git mv lib/nexus/repos/mindMaps.ts contexts/bc_mind_maps/repositories.ts`. Zmień importy na `import type { MindMap, MindMapNode } from "./models";`, `@/lib/nexus/vault-fs`, `@/lib/nexus/record-helpers`, zostaw `@/lib/errors`. Reszta pliku bez zmian.
- [ ] **Step 3:** `git mv tests/unit/lib/nexus/repos/mindMaps.test.ts tests/unit/contexts/bc_mind_maps/repositories.test.ts`; zamień importy na `@/contexts/bc_mind_maps/repositories` i `@/contexts/bc_mind_maps/models` (typ `MindMapNode`), a `./helpers` na `../../lib/nexus/repos/helpers` (jak w `tests/unit/contexts/bc_board/repositories.test.ts`). Treść testów bez zmian.

### Task 2: `schemas.ts` (TDD)

- [ ] **Step 1: czerwony test** `tests/unit/contexts/bc_mind_maps/schemas.test.ts`:
  - `MindMapNodeSchema` przyjmuje drzewo z zagnieżdżonymi `children`; odrzuca węzeł bez `note`, z `collapsed: "yes"` i zagnieżdżony węzeł z błędnym polem.
  - `SaveMindMapBodySchema` przyjmuje `{}`; `colWidths: { "1": "200" }` daje `{ "1": 200 }` (coerce); odrzuca `colWidths: { "1": "abc" }`.
  - `CreateMindMapBodySchema` przyjmuje `{}` i `{ title: "X" }`, odrzuca `{ title: 1 }`.
  - `toMindMapDto({ id: "a", title: "T", rootNode, colWidths: {}, createdAt, updatedAt })` zwraca obiekt o dokładnie tych kluczach; bez `createdAt/updatedAt` w modelu `JSON.stringify` nie zawiera tych pól.
- [ ] **Step 2:** `contexts/bc_mind_maps/schemas.ts`: `MindMapNodeSchema` (przeniesiony z trasy `[id]`, typ `z.ZodType<MindMapNode>` z `import type` z `./models`), `CreateMindMapBodySchema` (`{ title: z.string().optional() }`), `SaveMindMapBodySchema` (jak dziś: `title?`, `rootNode?`, `colWidths: z.record(z.string(), z.coerce.number()).optional()`), interfejsy `MindMapNodeDto`, `MindMapDto`, funkcja `toMindMapDto`.
- [ ] **Step 3:** uruchom `npx vitest run tests/unit/contexts/bc_mind_maps/schemas.test.ts` (przez cursora): zielone.

### Task 3: `services.ts` (TDD)

- [ ] **Step 1:** `git mv tests/unit/services/mindMapService.test.ts tests/unit/contexts/bc_mind_maps/services.test.ts`. Zamień: `vi.mock("../../../lib/firestore-db.js", () => repo)` na `vi.mock("@/contexts/bc_mind_maps/repositories", () => repo)`, importy serwisu na `@/contexts/bc_mind_maps/services`, typ na `@/contexts/bc_mind_maps/models`, `DomainError` na `@/lib/errors`; dodaj `// @vitest-environment node`. Treść przypadków bez zmian (domyślny tytuł „Nowa mapa”, sort malejący po `updatedAt`, 404 dla brakującej mapy, `trim` tytułu, `saveMindMap` składa patch tylko z podanych pól, `deleteMindMap` sprawdza istnienie).
- [ ] **Step 2:** `contexts/bc_mind_maps/services.ts` = `services/mindMapService.ts` z `import * as repositories from "./repositories"` zamiast `firestoreDb` i typami z `./models`. Sygnatury bez zmian (`saveMindMap(mapId, data)` z `Promise<void>`).

### Task 4: `router.ts` i trasy (TDD)

- [ ] **Step 1: czerwony test** `tests/unit/contexts/bc_mind_maps/router.test.ts` (wzór: `tests/unit/contexts/bc_board/router.test.ts`: `vi.mock("@/contexts/bc_mind_maps/services", …)`, `NextRequest`):
  - `listMindMaps`: 200 i tablica DTO z mocka serwisu; błąd serwisu → status z `handleServiceError`.
  - `createMindMap`: body `{}` → serwis wołany z `""`, status 201; body `{ "title": 1 }` → 400 i serwis niewołany.
  - `getMindMap`: 200 + DTO; `DomainError(…, 404)` z serwisu → 404.
  - `saveMindMap` (PATCH): poprawny body → serwis wołany z `(id, { title, rootNode, colWidths })`, odpowiedź `{ success: true }`; zły `rootNode` → 400, serwis niewołany; `ConflictError` z serwisu → 409.
  - `deleteMindMap`: `{ success: true }`; błąd serwisu → mapowany status.
- [ ] **Step 2:** `contexts/bc_mind_maps/router.ts`: `listMindMaps`, `createMindMap`, `getMindMap`, `saveMindMap`, `deleteMindMap` (typ `RouteContext = { params: Promise<{ id: string }> }` jak w `bc_tags/router.ts`; `try/catch` → `handleServiceError`; mapowanie `toMindMapDto`). Logika dokładnie z dzisiejszych tras.
- [ ] **Step 3:** `app/api/mind-maps/route.ts` → `export { listMindMaps as GET, createMindMap as POST } from "@/contexts/bc_mind_maps/router";`; `app/api/mind-maps/[id]/route.ts` → `export { getMindMap as GET, saveMindMap as PATCH, deleteMindMap as DELETE } from "@/contexts/bc_mind_maps/router";`.

### Task 5: Przepięcie UI, sprzątanie starej warstwy, jeden commit kodu

- [ ] **Step 1:** `src/features/mind-maps/mindMapTypes.ts` → treść:

```ts
export type {
  MindMapDto as MindMap,
  MindMapNodeDto as MindMapNode,
} from "@/contexts/bc_mind_maps/schemas";

export const DEFAULT_COL_W = 150;
export const MIN_COL_W = 80;
export const MAX_COL_W = 300;
```

- [ ] **Step 2:** `git rm services/mindMapService.ts lib/firestore-db.ts types/records.ts types/index.ts tests/integration/services/mindMapService.integration.test.ts`; sprawdź `ls services lib/nexus/repos types` (katalogi puste lub nieistniejące; puste usuń `rmdir`).
- [ ] **Step 3:** `tests/unit/lib/nexus/repos-static.test.ts`: w `FILE_REPOS` zamień `"lib/nexus/repos/mindMaps.ts"` na `"contexts/bc_mind_maps/repositories.ts"`; w teście importerów `vault-fs` usuń `"lib/nexus/repos/mindMaps.ts"` z oczekiwanej listy (zostają `STORE` i `lib/nexus/markdown-dir.ts`); usuń test „the barrel points every collection at lib/nexus/repos”. Zachowaj resztę.
- [ ] **Step 4:** `tests/unit/no-user-id.static.test.ts`: `FILES` nie może wskazywać nieistniejącego `lib/firestore-db.ts` (usuń wpis); z `DIRS` usuń `"services"` i `"types"`, jeśli test nie toleruje nieistniejących katalogów (sprawdź `existsSync` w kodzie testu).
- [ ] **Step 5: weryfikacja (cursor, każde osobno):** `npx tsc --noEmit`, `npm run lint`, `npx vitest run`. Oczekiwane: `tsc` i lint zielone; `vitest` zielony poza jednym testem architektury „każdy wyjątek z baseline nadal występuje” (2 klucze `mind-maps`).
- [ ] **Step 6: commit kodu:** `refactor(bc_mind_maps): migracja map myśli do contexts/bc_mind_maps (PR 9)`; sprawdź `git diff --stat` (brak zmian poza mapą plików) i `git status` (brak śladów po `-u`).

### Task 6: Osobny commit baseline

- [ ] **Step 1:** w `tests/unit/architecture.static.test.ts` usuń dwa wpisy `mind-maps` z `BASELINE` (zostaje `[]`). Nic poza tym (reguły i fixtury to PR 10).
- [ ] **Step 2:** cursor: `npx vitest run tests/unit/architecture.static.test.ts` → przeszło. Commit: `test(arch): usunięcie wyjątków mind-maps z baseline (PR 9)`.

### Task 7: Zamknięcie

- [ ] `npm run build` (cursor) → przeszło; `git status` czysty.
- [ ] Review diffa przez pomocnika (`--role review agy`, sprawdza: zgodność odpowiedzi HTTP z dawnymi trasami, brak zmian kluczy JSON, brak martwych importów). Opinie weryfikuję w kodzie.
- [ ] Push, PR (opis: zakres, odstępstwo §7 z decyzji 6, usunięty test integracyjny z decyzji 7).
