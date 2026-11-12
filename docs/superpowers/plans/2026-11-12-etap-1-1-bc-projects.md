# Etap 1-1: karta Projekty jako `contexts/bc_projects/` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karta Alt+4 „Projekty” pokazuje rejestr projektów z vaulta NEXUS i teczkę wybranego projektu (zadania, bugi, „Gdzie skończyłem”), tylko do odczytu, jako pierwszy kontekst `bc_*`.

**Architecture:** `contexts/bc_projects/` z siatką `router` / `schemas` / `models` / `services` / `repositories/` (spec struktury §4). Trasy `app/api/projects/**/route.ts` tylko re-eksportują handlery. Odczyt vaulta przy każdym żądaniu przez `lib/nexus/vault-fs` (strażnik ścieżek i `Work/`). UI w `src/features/projects/` zna tylko DTO z `schemas.ts`.

**Tech Stack:** TypeScript, Next.js 14 App Router, `yaml`, Vitest + Testing Library, React.

**Spec:** `docs/superpowers/specs/2026-11-12-etap-1-1-karta-projektu-odczyt-design.md`. **Warunek wstępny:** PR 1 „fundament” (`docs/superpowers/plans/2026-11-12-struktura-pr1-fundament.md`) zmergowany: istnieją `lib/http/apiError.ts` i `tests/unit/architecture.static.test.ts`.

**Gałąź:** `feat/etap-1-1-bc-projects` od `main` po merge PR 1.

---

## Fakty z kodu (sprawdzone 2026-11-12)

- `readVaultFile(rel, opts?) : { text, version } | null` (`lib/nexus/vault-fs.ts:201`) — `null` gdy brak pliku; `PathOutsideVaultError` (400) i `WorkAreaBlockedError` (403) dziedziczą po `DomainError`.
- `parseFrontmatter(text) : { meta, body } | null` (`lib/nexus/frontmatter.ts:13`) — `null` przy braku/zepsutym frontmatterze.
- `readList` z `yaml-store` **nie nadaje się** do rejestru: brak klucza daje `[]` bez ostrzeżenia, a nie-lista rzuca. Rejestr czytamy `readVaultFile` + `YAML.parse` (pakiet `yaml`, ten sam co w `yaml-lists`); błąd parsera opakowany jak w `yaml-store`: `Nie można odczytać pliku Projects/_registry.yaml: <powód>` i rzucony dalej (spec §3.3: „zepsuty YAML rzuca dalej”).
- `VaultConfigError` (`lib/nexus/vault-path.ts:1`) nie jest `DomainError` → `handleServiceError` daje 500 z `message`.
- Vault: `Projects/_registry.yaml` (`projects:` lista map z `id`, `name`, `status`, `priority`, `folder: Projects/<id>/`, `local_path`, opcjonalnie `deploy`, `github`); `index.md` ma frontmatter z `last_worked: 2026-05-19` (bez cudzysłowów) i `state_confidence`, sekcje `## Gdzie skończyłem` przed `## Historia sesji`.
- Testy repozytoriów używają `useTempVault()` z `tests/unit/lib/nexus/repos/helpers.ts` (ustawia `NEXUS_VAULT_PATH`, `write(rel, text)`).
- Trasy w testach: `import { GET } from "@/app/api/…/route"`, `new NextRequest("http://localhost/api/…")`, `params: Promise.resolve({ id })`.
- Karty: `CardTarget` w `src/features/cards/cards.ts:16`; `useCardNavigation` trzyma `placeholder: CardId | null`; `src/App.tsx:43` renderuje `placeholder ? <CardPlaceholder/> : home : planowanie`.

## Mapa plików

```
contexts/bc_projects/models.ts
contexts/bc_projects/repositories/markdown.ts
contexts/bc_projects/repositories/index.ts
contexts/bc_projects/services.ts
contexts/bc_projects/schemas.ts
contexts/bc_projects/router.ts
app/api/projects/route.ts
app/api/projects/[id]/route.ts
lib/errors.ts                                   (+ NotFoundError)
src/features/projects/{ProjectsView,ProjectList,ProjectDossier}.tsx, useProjects.ts, projects.css
src/features/cards/{cards.ts,useCardNavigation.ts}, src/App.tsx
tests/unit/contexts/bc_projects/{repositories.markdown,repositories,services,schemas,router}.test.ts, readonly.static.test.ts
tests/unit/features/projects/{useProjects,ProjectsView}.test.tsx
tests/unit/features/cards/{cards,useCardNavigation}.test.ts
tests/unit/{allow-work,no-firebase-client,no-model-api,no-user-id}.static.test.ts
vitest.config.ts                                (coverage include contexts/**)
```

---

### Task 1: `models.ts` i parsery `repositories/markdown.ts`

**Files:**

- Create: `contexts/bc_projects/models.ts`, `contexts/bc_projects/repositories/markdown.ts`
- Test: `tests/unit/contexts/bc_projects/repositories.markdown.test.ts`

- [ ] **Step 1: `models.ts`** (same typy, bez importów)

```ts
export type Freshness = "fresh" | "stale" | "unknown";

export type RegistryEntry = {
  id: string;
  name: string;
  status: string;
  priority: string;
  /** Ścieżka katalogu projektu względem korzenia vaulta, np. `Projects/nexus/`. Pole wewnętrzne. */
  folder: string;
  localPath: string;
  deploy?: string;
  github?: string;
  owner: "personal";
};

export type ProjectIndex = {
  lastWorked?: string;
  stateConfidence?: string;
  whereIStopped: string | null;
};

export type ChecklistItem = { text: string; done: boolean };
export type ChecklistSection = { heading: string; items: ChecklistItem[] };
export type BugEntry = {
  id: string;
  title: string;
  section: string;
  priority?: string;
  status?: string;
};

export type Project = RegistryEntry & ProjectIndex & { freshness: Freshness };
export type ProjectWithContent = Project & { tasks: ChecklistSection[]; bugs: BugEntry[] };
```

- [ ] **Step 2: Testy parserów (czerwony)** — `// @vitest-environment node`, import z `@/contexts/bc_projects/repositories/markdown`

| `it`                                   | Wejście                                                                                                                                                       | Oczekiwanie                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| sekcje w kolejności pliku              | `"# T\n\n## Blokery\n_Brak aktywnych blokerów_\n\n## Next\n- [ ] A\n\n## Backlog\n- [x] B\n"`                                                                 | `parseSections(...).map(s => s.heading)` = `["Blokery", "Next", "Backlog"]`                                                                                                                |
| tekst przed pierwszym `##` pominięty   | `"# T\nwstęp\n## A\nx\n"`                                                                                                                                     | `[{ heading: "A", body: "x" }]` (`body` przycięte `trim()`)                                                                                                                                |
| `###` nie tnie                         | `"## Aktywne\n### GP-001 — Błąd\n- **Status:** otwarty\n"`                                                                                                    | jedna sekcja `Aktywne`, `body` zawiera `### GP-001`                                                                                                                                        |
| checkboxy                              | `parseChecklist("- [ ] **A** — opis\n- [x] B\n- [X] C\n  - [ ] D")`                                                                                           | `[{text:"**A** — opis",done:false},{text:"B",done:true},{text:"C",done:true},{text:"D",done:false}]`                                                                                       |
| linie bez checkboxa pominięte          | `parseChecklist("_Brak aktywnych blokerów_\n- zwykła")`                                                                                                       | `[]`                                                                                                                                                                                       |
| Gdzie skończyłem do następnego `##`    | `"## Gdzie skończyłem\nPracowałem nad X.\n\n## Historia sesji\n- 2026-05-19"` → sekcja `Gdzie skończyłem`                                                     | `body` = `"Pracowałem nad X."`                                                                                                                                                             |
| bugi z dwóch sekcji                    | `"## Aktywne\n### GP-001 — Zły eksport\n- **Priorytet:** medium\n- **Status:** otwarty\n\n## Zamknięte\n### EA-001 — Stary błąd\n- **Status:** naprawiony\n"` | `[{id:"GP-001",title:"Zły eksport",section:"Aktywne",priority:"medium",status:"otwarty"},{id:"EA-001",title:"Stary błąd",section:"Zamknięte",status:"naprawiony"}]` (`priority` nieobecne) |
| bugi: samo zdanie                      | `"Brak znanych bugów."`                                                                                                                                       | `[]`                                                                                                                                                                                       |
| bugi: tylko `## Aktywne` + ostrzeżenia | `"## Aktywne\n### A-1 — x\n### A-2 — y\n## Ostrzeżenia z builda\n- warning 1\n"`                                                                              | dwa wpisy z `section: "Aktywne"`, brak wpisów z ostrzeżeń                                                                                                                                  |
| `###` przed jakimkolwiek `##`          | `"### X-1 — z\n"`                                                                                                                                             | `[{id:"X-1",title:"z",section:""}]`                                                                                                                                                        |
| myślnik `-` zamiast `—`                | `"## Aktywne\n### X-2 - tytuł\n"`                                                                                                                             | `id: "X-2"`, `title: "tytuł"`                                                                                                                                                              |
| CRLF                                   | `"## Next\r\n- [ ] A\r\n- [x] B\r\n"`                                                                                                                         | `parseSections` → `[{heading:"Next",…}]`; `parseChecklist(body)` → `[{text:"A",done:false},{text:"B",done:true}]`                                                                          |

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.markdown.test.ts` → FAIL (brak modułu).

- [ ] **Step 3: Implementacja `repositories/markdown.ts`** (importuje tylko `import type { … } from "@/contexts/bc_projects/models"`)

Sygnatury i reguły:

```ts
export function parseSections(markdown: string): { heading: string; body: string }[];
export function parseChecklist(body: string): ChecklistItem[];
export function parseBugs(markdown: string): BugEntry[];
```

- Wszystkie trzy funkcje dzielą tekst po `/\r?\n/` (`readVaultFile` normalizuje CRLF, ale parsery są czyste i nie mogą na tym polegać).
- `parseSections`: nagłówek = `/^## (.+?)\s*$/` (dokładnie dwa `#` i spacja); `heading` = przycięty tekst; `body` = linie do następnego nagłówka, `trim()`.
- `parseChecklist`: `/^\s*[-*] \[( |x|X)\] (.*)$/`; `text` = grupa 2 `trimEnd()`; `done` = grupa 1 ≠ spacja.
- `parseBugs`: przejście liniowe; `/^## (.+?)\s*$/` ustawia bieżącą sekcję; `/^### (\S+)\s+[—–-]\s+(.+?)\s*$/` otwiera wpis; w obrębie wpisu `/^\s*- \*\*Priorytet:\*\*\s*(.+?)\s*$/` i `/^\s*- \*\*Status:\*\*\s*(.+?)\s*$/` ustawiają pola (pierwsze wystąpienie). Pola nieobecne nie są ustawiane (brak klucza, nie `undefined` jawne — `toEqual` i tak to toleruje).

Run: test → PASS.

- [ ] **Step 4: Commit**

```bash
git add contexts/bc_projects tests/unit/contexts/bc_projects
git commit -m "feat(bc_projects): modele i parsery tasks/bugs/index"
```

### Task 2: `NotFoundError` i `repositories/index.ts`

**Files:**

- Modify: `lib/errors.ts`; Test: `tests/unit/lib/errors.test.ts`
- Create: `contexts/bc_projects/repositories/index.ts`; Test: `tests/unit/contexts/bc_projects/repositories.test.ts`

- [ ] **Step 1: Test `NotFoundError` (czerwony)** — w `tests/unit/lib/errors.test.ts`:

```ts
it("NotFoundError to DomainError z kodem 404", () => {
  const err = new NotFoundError("Nie ma projektu x");
  expect(err).toBeInstanceOf(DomainError);
  expect(err.statusCode).toBe(404);
  expect(err.name).toBe("NotFoundError");
});
```

- [ ] **Step 2: Implementacja** w `lib/errors.ts`:

```ts
export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}
```

Run: `npx vitest run tests/unit/lib/errors.test.ts` → PASS. Commit `feat(errors): NotFoundError (404)`.

- [ ] **Step 3: Testy repozytorium (czerwony)** — `// @vitest-environment node`, `const vault = useTempVault()` z `../../lib/nexus/repos/helpers`.

Sygnatury:

```ts
export function readRegistry(): { entries: RegistryEntry[]; warnings: string[] };
export function readProjectIndex(entry: RegistryEntry): ProjectIndex;
export function readProjectContent(entry: RegistryEntry): {
  tasks: ChecklistSection[];
  bugs: BugEntry[];
};
```

| `it`                                   | Przygotowanie                                                                                                                                                                | Oczekiwanie                                                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| brak `_registry.yaml`                  | —                                                                                                                                                                            | `{ entries: [], warnings: ["Brak Projects/_registry.yaml w vaulcie"] }`                                                                                                  |
| brak klucza `projects`                 | `"inne: 1\n"`                                                                                                                                                                | `entries: []`, `warnings.length === 1`                                                                                                                                   |
| `projects` nie jest listą              | `"projects: tekst\n"`                                                                                                                                                        | `entries: []`, `warnings.length === 1`                                                                                                                                   |
| zepsuty YAML                           | `"projects: [\n"`                                                                                                                                                            | `toThrow(/Nie można odczytać pliku Projects\/_registry.yaml/)`                                                                                                           |
| mapowanie pól                          | wpis `{id: nexus, name: NEXUS, status: active, priority: high, folder: Projects/nexus/, local_path: 'E:\x', github: https://g}`                                              | `entries[0]` = `{id:"nexus",name:"NEXUS",status:"active",priority:"high",folder:"Projects/nexus/",localPath:"E:\\x",github:"https://g",owner:"personal"}` (bez `deploy`) |
| wpis bez `id` / bez `folder`           | dwa złe wpisy + jeden dobry                                                                                                                                                  | jeden wpis, dwa ostrzeżenia                                                                                                                                              |
| element listy nie-mapą                 | `projects: [ "x" ]`                                                                                                                                                          | pominięty z ostrzeżeniem                                                                                                                                                 |
| `name` brak                            | wpis bez `name`                                                                                                                                                              | `name === id`                                                                                                                                                            |
| `deploy: ""`                           | pusty string                                                                                                                                                                 | brak pola `deploy`                                                                                                                                                       |
| index: frontmatter + sekcja            | `Projects/p/index.md` = `"---\nlast_worked: 2026-05-19\nstate_confidence: verified\n---\n\n## O projekcie\nx\n\n## Gdzie skończyłem\nKoniec X.\n\n## Historia sesji\n- y\n"` | `{ lastWorked: "2026-05-19", stateConfidence: "verified", whereIStopped: "Koniec X." }`                                                                                  |
| index: liczba w frontmatterze          | `state_confidence: 80`                                                                                                                                                       | `stateConfidence === "80"`                                                                                                                                               |
| index: zepsuty frontmatter             | `"---\n: [\n---\n## Gdzie skończyłem\nA\n"`                                                                                                                                  | rzuca `Error` z `index.md` w komunikacie (serwis zamieni na ostrzeżenie)                                                                                                 |
| brak `index.md`, `tasks.md`, `bugs.md` | tylko rejestr                                                                                                                                                                | `{ whereIStopped: null }` (bez `lastWorked`); `{ tasks: [], bugs: [] }`                                                                                                  |
| `tasks.md` z trzema sekcjami           | `"## Blokery\n_Brak_\n## Next\n- [ ] A\n## Backlog\n- [x] B\n"`                                                                                                              | `tasks` = trzy sekcje, `Blokery` z `items: []`                                                                                                                           |
| `folder: ../../x`                      | wpis z tym folderem                                                                                                                                                          | `readProjectIndex` rzuca `PathOutsideVaultError`                                                                                                                         |
| `folder: Work/x/`                      | wpis z tym folderem                                                                                                                                                          | `readProjectIndex` rzuca `WorkAreaBlockedError`                                                                                                                          |

- [ ] **Step 4: Implementacja `repositories/index.ts`**

Reguły:

- `REGISTRY = "Projects/_registry.yaml"`; `readVaultFile(REGISTRY)` → `null` = ostrzeżenie „Brak Projects/\_registry.yaml w vaulcie”.
- `YAML.parse` w `try`; błąd → `throw new Error(\`Nie można odczytać pliku ${REGISTRY}: ${reason}\`)`.
- Dokument nie-mapa, brak `projects` albo `projects` nie-tablica → `warnings.push("Projects/_registry.yaml: brak listy 'projects'")`, `entries: []`.
- Wpis: element nie-mapa → ostrzeżenie `Projects/_registry.yaml: pozycja <n> nie jest mapą`; brak `id` lub `folder` (po `String(...).trim()` pusty) → ostrzeżenie `Projects/_registry.yaml: pozycja <n> bez id lub folder`. Pomocnik `text(v) = v === undefined || v === null ? "" : String(v).trim()`; `name` = `text(raw.name)` albo `id`, gdy puste; `status`, `priority` = `text(...)`; `localPath` = `text(raw.local_path)`; `deploy`/`github` dodawane tylko gdy niepuste; `owner: "personal"`.
- Ścieżka pliku projektu: `join(folder, name)` = `folder.replace(/\/?$/, "/") + name`.
- `readProjectIndex`: `readVaultFile(<folder>/index.md)`; `null` → `{ whereIStopped: null }`. Gdy tekst zaczyna się od `---` a `parseFrontmatter` zwraca `null` → `throw new Error(\`${folder}index.md: zepsuty frontmatter\`)`; gdy nie zaczyna się od `---`→ meta`{}`, body = cały tekst. `lastWorked`/`stateConfidence`=`text(meta.x)`albo pominięte, gdy puste.`whereIStopped`=`body`sekcji`Gdzie skończyłem`z`parseSections`albo`null`(pusty`body`też`null`).
- `readProjectContent`: `tasks` = `parseSections(tasks.md).map(s => ({ heading: s.heading, items: parseChecklist(s.body) }))`; `bugs` = `parseBugs(bugs.md)`; brak pliku = `[]`.
- Nie łapie błędów `readVaultFile`, nie sortuje, nie zna „dziś”.

Run: `npx vitest run tests/unit/contexts/bc_projects` → PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_projects tests/unit/contexts/bc_projects
git commit -m "feat(bc_projects): odczyt rejestru i plików projektu z vaulta"
```

### Task 3: `services.ts`

**Files:** Create: `contexts/bc_projects/services.ts`; Test: `tests/unit/contexts/bc_projects/services.test.ts` (`vi.mock("@/contexts/bc_projects/repositories", …)`)

Sygnatury:

```ts
export const STALE_AFTER_DAYS = 14;
export function freshness(lastWorked: string | undefined, today: Date): Freshness;
export function sortProjects(projects: Project[]): Project[];
export function listProjects(today?: Date): { projects: Project[]; warnings: string[] };
export function getProject(id: string, today?: Date): ProjectWithContent;
```

- [ ] **Step 1: Testy (czerwony)** — `const TODAY = new Date(2026, 10, 12)` (12 listopada, czas lokalny).

| `it`                                      | Wejście                                                                                                                                                                | Oczekiwanie                                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| freshness 14 dni                          | `"2026-10-29"`                                                                                                                                                         | `"fresh"`                                                                                                                                  |
| freshness 15 dni                          | `"2026-10-28"`                                                                                                                                                         | `"stale"`                                                                                                                                  |
| freshness brak / `"abc"` / `"2026-13-45"` | —                                                                                                                                                                      | `"unknown"`                                                                                                                                |
| freshness data z przyszłości              | `"2026-11-20"`                                                                                                                                                         | `"fresh"`                                                                                                                                  |
| kolejność D5                              | `done/2026-11-10`, `on_hold/2026-11-01`, `active/brak`, `active/2026-10-01`, `active/2026-11-05`, `maintenance/2026-11-11`, `active` remis `2026-11-05` z nazwą „Alfa” | ids w kolejności: active 11-05 „Alfa”, active 11-05 (druga nazwa), active 10-01, active brak, maintenance 11-11, on_hold 11-01, done 11-10 |
| ostrzeżenie projektu                      | `readProjectIndex` rzuca `new Error("boom")` dla `id: "b"`                                                                                                             | `warnings` = `["b: boom"]`; projekt `b` z `freshness: "unknown"`, `whereIStopped: null`, dane rejestru zachowane; pozostałe bez zmian      |
| ostrzeżenia rejestru                      | `readRegistry` zwraca `warnings: ["w1"]`                                                                                                                               | `warnings[0] === "w1"`                                                                                                                     |
| błąd rejestru leci dalej                  | `readRegistry` rzuca                                                                                                                                                   | `listProjects` rzuca ten sam błąd                                                                                                          |
| getProject                                | `id: "a"` istnieje                                                                                                                                                     | wynik z `tasks`, `bugs` z `readProjectContent` i `freshness`                                                                               |
| getProject nieznany                       | `"zzz"`                                                                                                                                                                | `toThrow(NotFoundError)`                                                                                                                   |
| getProject błąd odczytu                   | `readProjectContent` rzuca                                                                                                                                             | rzuca dalej (bez ostrzeżeń)                                                                                                                |

- [ ] **Step 2: Implementacja** — reguły:

- `freshness`: brak → `unknown`; `/^(\d{4})-(\d{2})-(\d{2})/` na początku tekstu; budowa `Date.UTC(y, m-1, d)` i odrzucenie, gdy `getUTCMonth()/getUTCDate()` się nie zgadzają (np. `2026-13-45`) → `unknown`; dni = `(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - utc) / 86_400_000`; `≤ STALE_AFTER_DAYS` → `fresh`, inaczej `stale`.
- `sortProjects`: ranga `active` = 0, `done` = 2, reszta = 1; w randze `lastWorked` malejąco (porównanie tekstowe `YYYY-MM-DD`), brak daty na końcu; remis `name.localeCompare(other.name, "pl")`. Nie mutuje wejścia.
- `listProjects`: `readRegistry()`; dla każdego wpisu `try { readProjectIndex }` → `catch (err)` dodaje `` `${entry.id}: ${err instanceof Error ? err.message : String(err)}` `` i używa `{ whereIStopped: null }`, `freshness: "unknown"`; ostrzeżenia rejestru przed ostrzeżeniami projektów; wynik przez `sortProjects`.
- `getProject`: `readRegistry().entries.find(e => e.id === id)`; brak → `throw new NotFoundError(\`Nie ma projektu o id ${id}\`)`; potem `readProjectIndex`i`readProjectContent` bez łapania.

Run: test → PASS. Commit `feat(bc_projects): świeżość, kolejność i ostrzeżenia`.

### Task 4: `schemas.ts`, `router.ts`, trasy

**Files:**

- Create: `contexts/bc_projects/schemas.ts`, `contexts/bc_projects/router.ts`, `app/api/projects/route.ts`, `app/api/projects/[id]/route.ts`
- Test: `tests/unit/contexts/bc_projects/schemas.test.ts`, `tests/unit/contexts/bc_projects/router.test.ts`

- [ ] **Step 1: Testy (czerwony)**

`schemas.test.ts`: `toSummaryDto(project)` → `"folder" in dto === false`, zawiera `id`, `localPath`, `freshness`, `lastWorked`, **nie** zawiera `whereIStopped`; `toDetailDto(projectWithContent)` → bez `folder`, z `tasks`, `bugs`, `whereIStopped`.

`router.test.ts` (`vi.mock("@/contexts/bc_projects/services")`, import tras `@/app/api/projects/route` i `@/app/api/projects/[id]/route` — testuje też re-eksport):

| `it`                | Mock                                                                 | Oczekiwanie                                                                                               |
| ------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| lista               | `listProjects` → 1 projekt, `warnings: ["w"]`                        | 200, body `{ projects: [dto bez folder], warnings: ["w"] }`                                               |
| szczegóły           | `getProject("a")` → projekt                                          | 200, `body.id === "a"`, brak `folder`                                                                     |
| nieznany            | `getProject` rzuca `new NotFoundError("x")`                          | 404, `{ error: "x" }`                                                                                     |
| konfiguracja vaulta | `listProjects` rzuca `new VaultConfigError("Brak NEXUS_VAULT_PATH")` | 500, `body.error` zawiera `NEXUS_VAULT_PATH` (komunikat konstruktora sprawdź w `lib/nexus/vault-path.ts`) |

- [ ] **Step 2: Implementacja**

`schemas.ts` (importuje tylko `import type` z `./models`; komentarz na górze: „Same GET: brak schematów zod wejścia.”):

```ts
export type ChecklistItemDto = ChecklistItem;
export type ChecklistSectionDto = ChecklistSection;
export type BugEntryDto = BugEntry;
export type FreshnessDto = Freshness;
export type ProjectSummaryDto = {
  id: string;
  name: string;
  status: string;
  priority: string;
  localPath: string;
  deploy?: string;
  github?: string;
  owner: "personal";
  lastWorked?: string;
  stateConfidence?: string;
  freshness: FreshnessDto;
};
export type ProjectDetailDto = ProjectSummaryDto & {
  tasks: ChecklistSectionDto[];
  bugs: BugEntryDto[];
  whereIStopped: string | null;
};
export function toSummaryDto(p: Project): ProjectSummaryDto; // jawne kopiowanie pól, pola opcjonalne tylko gdy zdefiniowane
export function toDetailDto(p: ProjectWithContent): ProjectDetailDto;
```

`router.ts`:

```ts
export async function listProjects(): Promise<NextResponse>;
export async function getProject(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse>;
```

Oba w `try { … } catch (err) { return handleServiceError(err); }` z `@/lib/http/apiError`; importuje `./services` i `./schemas`.

Trasy (całe pliki):

```ts
// app/api/projects/route.ts
export { listProjects as GET } from "@/contexts/bc_projects/router";
```

```ts
// app/api/projects/[id]/route.ts
export { getProject as GET } from "@/contexts/bc_projects/router";
```

- [ ] **Step 3: Testy + architektura**

Run: `npx vitest run tests/unit/contexts/bc_projects tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS, test architektury bez nowych wyjątków. Uwaga: `npm run build` (Task 7) potwierdzi, że Next akceptuje re-eksport `GET` w `route.ts`.

- [ ] **Step 4: Commit** `feat(bc_projects): DTO, router i trasy /api/projects`.

### Task 5: UI `src/features/projects/`

**Files:** Create: `useProjects.ts`, `ProjectsView.tsx`, `ProjectList.tsx`, `ProjectDossier.tsx`, `projects.css`; Test: `tests/unit/features/projects/useProjects.test.tsx`, `tests/unit/features/projects/ProjectsView.test.tsx`

Wzorzec wizualny: `docs/mockups/karty/cards/04-projekty.html` + `docs/mockups/karty/tokens.css` (czytaj przy implementacji; klasy z prefiksem `.prj-`, kolory tylko przez tokeny `var(--…)`). UI importuje z kontekstu wyłącznie `import type { … } from "@/contexts/bc_projects/schemas"`.

Interfejsy:

```ts
type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;
export function useProjects(apiFetch: ApiFetch): {
  status: "loading" | "error" | "ready";
  error: string | null;
  projects: ProjectSummaryDto[];
  warnings: string[];
  selectedId: string | null;
  select: (id: string) => void;
  detail: ProjectDetailDto | null;
  detailError: string | null;
};
export function ProjectsView(props: { apiFetch: ApiFetch }): JSX.Element;
export function ProjectList(props: {
  projects: ProjectSummaryDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element;
export function ProjectDossier(props: { project: ProjectDetailDto }): JSX.Element;
```

Stany teczki: `detail === null && detailError === null` przy wybranym projekcie → „Ładowanie projektu…”; `detailError` → komunikat błędu w prawej kolumnie (lista zostaje). Wybrany element listy ma klasę `prj-item--sel` (jak w makiecie) i `aria-current="true"`.

Reguły: `useProjects` pobiera `/api/projects`; nie-OK → `error` = `body.error` albo `HTTP <status>`; po liście `selectedId` = pierwszy `id` (kolejność z serwera); zmiana `selectedId` pobiera `/api/projects/<encodeURIComponent(id)>`, ignorując odpowiedzi nieaktualne (flaga `cancelled` w efekcie). Lista: `<ul>` z `<button>`; wybrany ma `aria-current="true"`; `freshness === "stale"` → klasa `prj-item--stale`; `status === "done"` → `prj-item--done`; odznaki `status`, `priority`; `lastWorked`, `stateConfidence` jako tekst. Teczka: metryczka (linki `github`, `deploy` z `target="_blank" rel="noreferrer"`; `localPath` jako `<code>`), „Gdzie skończyłem” (`whereIStopped` albo „Brak wpisu”), sekcje zadań (`tasks` w kolejności, checkboxy `disabled`), bugi: aktywne = `section !== "Zamknięte"` (lista z odznakami `priority`/`status`, gdy są), zamknięte = licznik „Zamknięte: N”; brak bugów → „Brak bugów”. `warnings` → pasek `role="status"` nad listą. Pusta lista → „Brak projektów w rejestrze”.

- [ ] **Step 1: Testy (czerwony)** — atrapa `apiFetch = vi.fn(async (url) => new Response(JSON.stringify(...), { status }))`. Podział: `useProjects.test.tsx` (`renderHook`) — przypadki „błąd” (sprawdza `status`/`error`), „domyślny wybór i przełączanie” (sprawdza `selectedId` i wywołania `apiFetch`), „błąd szczegółów” i „nieaktualna odpowiedź”; `ProjectsView.test.tsx` (`render`) — pozostałe, czyli wszystko, co sprawdza tekst i klasy w DOM.

| `it`                          | Atrapa                                                                             | Oczekiwanie                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ładowanie                     | obietnica nierozwiązana                                                            | tekst „Ładowanie…”                                                                          |
| błąd                          | `/api/projects` → 500 `{ error: "Brak NEXUS_VAULT_PATH" }`                         | widoczny tekst `Brak NEXUS_VAULT_PATH`                                                      |
| pusto                         | `{ projects: [], warnings: [] }`                                                   | „Brak projektów w rejestrze”                                                                |
| ostrzeżenia                   | `warnings: ["b: boom"]`                                                            | `getByRole("status")` zawiera `b: boom`                                                     |
| domyślny wybór i przełączanie | dwa projekty `a`, `b` + szczegóły                                                  | przycisk `a` ma `aria-current`; klik `b` → wywołanie `/api/projects/b`, teczka pokazuje `b` |
| stale i done                  | `a` stale, `c` done (ostatni z serwera)                                            | element `a` ma klasę `prj-item--stale`; ostatni `li` to `c` z `prj-item--done`              |
| bugi                          | szczegóły z `{section:"Aktywne",id:"GP-001"}`, `{section:"Zamknięte",id:"EA-001"}` | widoczne `GP-001`, nie widać `EA-001`, tekst „Zamknięte: 1”                                 |
| brak bugów                    | `bugs: []`                                                                         | „Brak bugów”                                                                                |
| Gdzie skończyłem              | `whereIStopped: "Koniec X."`                                                       | widoczny „Koniec X.”                                                                        |
| błąd szczegółów               | lista OK, `/api/projects/a` → 404 `{ error: "Nie ma projektu o id a" }`            | `detailError === "Nie ma projektu o id a"`; w widoku lista nadal widoczna                   |
| nieaktualna odpowiedź         | szczegóły `a` rozwiązane po kliknięciu `b`                                         | `detail.id === "b"` (odpowiedź `a` zignorowana)                                             |
| wybrany element               | dwa projekty                                                                       | przycisk `a` ma klasę `prj-item--sel`                                                       |

- [ ] **Step 2: Implementacja** wg reguł powyżej. `ProjectsView.tsx` z `"use client"`, importuje `./projects.css`.

- [ ] **Step 3:** `npx vitest run tests/unit/features/projects tests/unit/architecture.static.test.ts` → PASS. Commit `feat(projects): karta Projekty — rejestr i teczka (odczyt)`.

### Task 6: Podpięcie karty, testy statyczne, dokumentacja

**Files:** Modify: `src/features/cards/cards.ts`, `src/features/cards/useCardNavigation.ts`, `src/App.tsx`, `tests/unit/features/cards/cards.test.ts`, `tests/unit/features/cards/useCardNavigation.test.ts`, 4 testy statyczne, `vitest.config.ts`; Create: `tests/unit/contexts/bc_projects/readonly.static.test.ts`

- [ ] **Step 1: Testy kart (czerwony)**

- `cards.test.ts`: test „projekty, mapa i kodeks to zaślepki” → „mapa i kodeks to zaślepki” (bez `projekty`) + nowy `expect(getCard("projekty").target).toEqual({ kind: "projects" })`.
- `useCardNavigation.test.ts`: w miejscach z `selectCard("projekty")` (linie ~38 i ~73) oczekuj `result.current.placeholder === null`, `result.current.projectsOpen === true`, `activeCard === "projekty"`; nowy `it`: `selectCard("projekty")` potem `selectCard("zadania")` → `projectsOpen === false`, `activeCard === "zadania"`; hash `#projekty` przy starcie → `projectsOpen === true`.

- [ ] **Step 2: Implementacja**

- `cards.ts`: `CardTarget` dostaje `| { kind: "projects" }`; wpis `projekty` → `target: { kind: "projects" }`.
- `useCardNavigation.ts`: stan `placeholder` zamieniony na `standalone: CardId | null` (karta poza `appMode`); eksport `placeholder` = `standalone` gdy jej `target.kind === "placeholder"`, inaczej `null`; nowe pole `projectsOpen: boolean` = `standalone === "projekty"`; `selectCard`: `kind` `placeholder` lub `projects` → `setStandalone(id)`; `setAppMode`/`setPlanningTab`/inne cele czyszczą `standalone`; `activeCard = standalone ?? cardForView(...)`. Interfejs `CardNavigation` z polem `projectsOpen`.
- `App.tsx`: dopisz `projectsOpen` do destrukturyzacji `useCardNavigation()` (linia 23); render `projectsOpen ? <ProjectsView apiFetch={apiFetch} /> : placeholder ? … : …` (import `ProjectsView` z `@/src/features/projects/ProjectsView`).

Run: `npx vitest run tests/unit/features/cards` → PASS. Commit `feat(cards): Alt+4 otwiera kartę Projekty`.

- [ ] **Step 3: Testy statyczne (osobny commit testów)**

- `readonly.static.test.ts` (`// @vitest-environment node`): rekurencyjnie wszystkie `.ts` w `contexts/bc_projects/`; żaden nie zawiera `/\b(writeVaultFile|updateVaultFile|deleteVaultFile|updateList|appendRecord|patchRecord|removeRecord)\b/` ani `/from\s+["'](?:node:)?fs/`; plus `it` sprawdzający, że lista plików zawiera `contexts/bc_projects/repositories/index.ts` (ochrona przed pustym skanem).
- Dopisz `"contexts"` do `DIRS` / `SCAN_DIRS` w `tests/unit/allow-work.static.test.ts`, `no-firebase-client.static.test.ts`, `no-model-api.static.test.ts`, `no-user-id.static.test.ts`.
- `vitest.config.ts`: `coverage.include` + `"contexts/**/*.ts"`.

Run: `npx vitest run tests/unit/*.static.test.ts tests/unit/contexts` → PASS.

```bash
git add tests/unit vitest.config.ts
git commit -m "test(static): kontekst bc_projects tylko do odczytu; contexts w skanach"
```

- [ ] **Step 4: Dokumentacja** — `docs/mockups/karty/STAN-W-KODZIE.md` (karta Projekty: zrobione 1-1, czego brakuje z makiety: kafle statystyk, `owner`, kamień milowy), `README.md` (endpointy `/api/projects`, katalog `contexts/`), spec 1-1 `Status:` „wykonany (data)”. Commit `docs: etap 1-1 w STAN-W-KODZIE, README i specu`.

### Task 7: Bramka, review, smoke test

- [ ] **Step 1: Bramka (`cursor`)**

```bash
scripts/ask-helper.sh --fresh --timeout 900 cursor "Uruchom kolejno: npx vitest run; npx tsc --noEmit; npm run lint; npm run build. Dla każdej komendy 'przeszło' albo lista plik:linia + przyczyna."
```

- [ ] **Step 2: Review (`agy`)**

```bash
scripts/ask-helper.sh --role review agy "Review git diff main...HEAD. Spec: docs/superpowers/specs/2026-11-12-etap-1-1-karta-projektu-odczyt-design.md, struktura: docs/superpowers/specs/2026-11-12-struktura-kontekstow-design.md §4. Sprawdź: zgodność z D1-D8, kierunek importów w contexts/bc_projects, brak zapisu do vaulta, obsługę błędów (ostrzeżenie vs 500 vs 404), podział bugów po section w UI. Odpowiedz listą plik:linia, problem, waga."
```

- [ ] **Step 3: Smoke test na prawdziwym vaulcie**

```bash
NEXUS_VAULT_PATH=~/projects/Brain_7224/NEXUS/Vault npm run dev   # w tle
curl -s localhost:3000/api/projects | jq '.projects | map({id,status,lastWorked,freshness}), .warnings'
curl -s localhost:3000/api/projects/gen-podsum-ai | jq '.bugs, .whereIStopped'
curl -s localhost:3000/api/projects/english-agent | jq '.bugs'
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/projects/nie-ma
```

Oczekiwania wynikają ze stanu vaulta z 2026-11-12; jeśli vault się zmienił, sprawdź rozjazd w plikach vaulta, zanim uznasz go za błąd kodu.
Expected: 7 projektów, `warnings: []`, każdy z niepustym `whereIStopped` (sprawdź drugim `jq` w pętli po id), `code-sensei` (`done`) ostatni; `gen-podsum-ai` bugi z `section: "Aktywne"`; `english-agent` ma `EA-001` z `section: "Zamknięte"`; nieznany id → `404`. W przeglądarce `localhost:3000/dashboard#projekty`: lista, wybór projektu, teczka.

- [ ] **Step 4: PR** — po zgodzie użytkownika: push, `gh pr create` z zakresem, wynikiem bramki i smoke testu.
