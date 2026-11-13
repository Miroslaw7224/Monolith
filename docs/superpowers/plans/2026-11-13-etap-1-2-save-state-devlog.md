# Etap 1-2: Save State, devlog i typ projektu (zapis) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karta Projekty zapisuje do vaulta Save State (`state.md`), dziennik decyzji (`devlog.md`, tylko dopisywanie) i pole `type` w `index.md`; świeżość projektu liczy się też z `state.updated`.

**Architecture:** Rozszerzenie `contexts/bc_projects/` bez nowych plików poziomu kontekstu: parsery i serializery w `repositories/markdown.ts`, jedyny zapis w `repositories/index.ts` (`writeVaultFile` z wersją dla `state.md`, `updateVaultFile` z ponowieniem dla devlogu i `type`), reguły w `services.ts`, zod i DTO w `schemas.ts`, trzy nowe handlery w `router.ts` + trasy `app/api/projects/**`. UI: dwa nowe komponenty i rozszerzony `useProjects`.

**Tech Stack:** TypeScript, Next.js 14 App Router, `yaml`, `zod` 4, Vitest + Testing Library, React.

**Spec:** `docs/superpowers/specs/2026-11-13-etap-1-2-save-state-devlog-design.md`. **Warunek wstępny:** 1-1 zmergowane (PR #23).

**Gałąź:** `feat/etap-1-2-save-state-devlog` od `main`.

---

## Zasady wykonania (CLAUDE.md)

- **Plan nie zawiera pełnego kodu implementacji:** są ścieżki, sygnatury, reguły, przypadki testowe z wartościami i komendy. Kod powstaje w kroku wykonania w TDD (czerwony → zielony). Pełny kod tylko dla dwóch subtelnych funkcji tekstowych (Task 4).
- **Testy, `tsc`, lint, build** zleca się `cursor` (`scripts/ask-helper.sh --role task cursor "…"`) z prośbą „przeszło” albo lista `plik:linia + przyczyna`. Pełny output czyta się tylko, gdy podsumowanie nie wystarcza. Komendy w krokach poniżej to to, co `cursor` ma uruchomić; drobny, jednoplikowy test można też uruchomić samemu.
- **Review diffa** na końcu: `scripts/ask-helper.sh --role review agy "…"` (tier deep, działa po poprawce `d1cdb9e`). Opinie to hipotezy: weryfikuj w kodzie.
- **Test architektury** (`tests/unit/architecture.static.test.ts`) i jego baseline: zmiany tylko osobnym commitem, nigdy z kodem. Pękający test naprawia się kodem. W tym planie test architektury **nie jest zmieniany** (Task 1 zmienia tylko `readonly.static.test.ts`).
- **Stopka każdego commita:** `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hook lint-staged uruchamia prettier przy commicie; po commicie sprawdź `git status` (prettier może zmienić pliki).
- **Commity i pushe robi tylko główny wykonawca**, nie pomocnicy.

## Fakty z kodu (sprawdzone 2026-11-13)

- `lib/nexus/vault-fs.ts`: `readVaultFile(rel) → { text, version: { size, hash } } | null` (CRLF→LF, BOM usunięty); `writeVaultFile(rel, text, { expected: FileVersion | null }) → FileVersion` (niezgodność wersji → `ConflictError` 409); `updateVaultFile(rel, mutate(current: string | null) => string, { retries })` (ponawia `mutate` po konflikcie, domyślnie 3). `hash` = sha256 hex (64 znaki), `size` = bajty UTF-8.
- `lib/nexus/frontmatter.ts`: `parseFrontmatter(text) → { meta, body } | null` (`null` przy braku lub zepsutym YAML); `formatFrontmatter(meta, body)` serializuje w YAML 1.1, pomija `undefined`, kończy treść jednym `\n`.
- `lib/errors.ts`: `DomainError(message, statusCode = 400)`, `ConflictError` (409), `NotFoundError` (404). **Nie ma `ValidationError`**: błędy walidacji danych z vaulta to `new DomainError(msg, 422)`.
- `lib/http/parseBody.ts`: `parseBody(request, zodSchema) → { success: true, data } | { success: false, response }` (400 przy złym JSON lub zod). `handleServiceError(err)` mapuje `DomainError` na jego `statusCode`.
- **Reguły architektury** (`tests/unit/architecture.static.test.ts`): `models` nic nie importuje; `repositories` importują tylko `models` (+ `lib/**`); `services` tylko `repositories`, `models`; `router` tylko `services`, `schemas`; `schemas` tylko `zod`/`lib/schema/**` i **`import type`** z własnego `models`; `lib/nexus/**` wolno importować tylko z `repositories` (więc `models.ts` **nie może** importować `FileVersion` z `vault-fs`: stąd własny typ `VersionToken`); UI importuje z kontekstu tylko `schemas`.
- Obecny `services.ts`: `freshness(lastWorked, today)`, `sortProjects`, `listProjects(today)` (wyjątek pojedynczego projektu → ostrzeżenie `<id>: <msg>`), `getProject(id, today)` (nieznany `id` → `NotFoundError`).
- Obecny `useProjects(apiFetch)` zwraca `{ status, error, projects, warnings, selectedId, select, detail, detailError }`; `ProjectDossier` ma lokalny `isHttpUrl`.
- `useTempVault()` z `tests/unit/lib/nexus/repos/helpers.ts`: `{ root, write(rel, text), read(rel) }`, ustawia `NEXUS_VAULT_PATH`.
- Testy `services.test.ts` mockują `@/contexts/bc_projects/repositories` przez `vi.hoisted` + `vi.mock`; testy UI wstrzykują `apiFetch` (atrapa zwracająca `Response`).
- `NEXUS` jest repo git i ma niezwiązaną zmianę `M Vault/Tasks/tasks.md`: smoke test porównuj ze stanem wyjściowym.

## Mapa plików

```
contexts/bc_projects/models.ts                                (zmiana)
contexts/bc_projects/repositories/markdown.ts                 (zmiana: 5 funkcji)
contexts/bc_projects/repositories/index.ts                    (zmiana: odczyt state/devlog/type, 3 zapisy)
contexts/bc_projects/services.ts                              (zmiana)
contexts/bc_projects/schemas.ts                               (zmiana)
contexts/bc_projects/router.ts                                (zmiana: 3 handlery)
app/api/projects/[id]/route.ts                                (zmiana: + PATCH)
app/api/projects/[id]/state/route.ts                          (nowy: PUT)
app/api/projects/[id]/devlog/route.ts                         (nowy: POST)
src/features/projects/isHttpUrl.ts                            (nowy)
src/features/projects/ProjectSaveState.tsx                    (nowy)
src/features/projects/ProjectDevlog.tsx                       (nowy)
src/features/projects/ProjectDossier.tsx                      (zmiana)
src/features/projects/ProjectsView.tsx, useProjects.ts        (zmiana)
src/features/projects/projects.css                            (zmiana)
tests/unit/contexts/bc_projects/write-boundary.static.test.ts (zmiana nazwy z readonly.static.test.ts)
tests/unit/contexts/bc_projects/{repositories.markdown,repositories,services,schemas,router}.test.ts  (zmiana)
tests/unit/features/projects/{isHttpUrl,ProjectSaveState,ProjectDevlog}.test.tsx  (nowe)
tests/unit/features/projects/{useProjects,ProjectsView}.test.tsx                  (zmiana)
docs/mockups/karty/STAN-W-KODZIE.md, docs/superpowers/specs/2026-11-12-etap-1-1-karta-projektu-odczyt-design.md, README.md  (zmiana)
```

---

### Task 0: Gałąź

- [ ] **Step 1:** `git switch main && git pull --ff-only && git switch -c feat/etap-1-2-save-state-devlog`
- [ ] **Step 2:** `git status --short` → tylko `?? scripts/clear-helpers.sh` (nie dotykamy go).

---

### Task 1: Osobny commit samego testu (granica zapisu)

Reguła CLAUDE.md: zmiana testu osobnym commitem, przed kodem. Test z 1-1 zabraniał zapisu w całym kontekście; od 1-2 zapis wolno **tylko w `repositories/`**.

**Files:**

- Rename + modify: `tests/unit/contexts/bc_projects/readonly.static.test.ts` → `write-boundary.static.test.ts`

**Interfejs testu:** funkcja pomocnicza w pliku `findViolations(sources: Record<string, string>): string[]` (klucz = ścieżka względem korzenia repo, wartość = treść pliku; wynik = lista `"<ścieżka>: write API"` / `"<ścieżka>: fs import"`). Reguły:

- `WRITE_API` (jak dotąd: `writeVaultFile|updateVaultFile|deleteVaultFile|updateList|appendRecord|patchRecord|removeRecord`) wolno **tylko** w plikach zaczynających się od `contexts/bc_projects/repositories/`; gdzie indziej → `write API`.
- import `node:fs` / `fs` nie wolno **nigdzie** w kontekście → `fs import`.

**Przypadki (część A, dane syntetyczne) i oczekiwania:**

| Klucz → treść                                                                                                  | Wynik                                                          |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `contexts/bc_projects/repositories/index.ts` → `writeVaultFile(x)`                                             | `[]`                                                           |
| `contexts/bc_projects/services.ts` → `updateVaultFile(x)`                                                      | `["contexts/bc_projects/services.ts: write API"]`              |
| `contexts/bc_projects/router.ts` → `import fs from "node:fs"`                                                  | `["contexts/bc_projects/router.ts: fs import"]`                |
| `contexts/bc_projects/repositories/markdown.ts` → `from "fs"`                                                  | `["contexts/bc_projects/repositories/markdown.ts: fs import"]` |
| `contexts/bc_projects/schemas.ts` → `const writeVaultFileX = 1` (nazwa tylko zawiera słowo, brak granicy `\b`) | `[]`                                                           |

**Część B (prawdziwe repo):** `findViolations(<wszystkie .ts z contexts/bc_projects>)` → `[]`; plus zachowane „skanuje `repositories/index.ts` (ochrona przed pustym skanem)” i nowe „skanuje też pliki poza `repositories/` (`router.ts`, `services.ts`)”.

- [ ] **Step 1:** `git mv tests/unit/contexts/bc_projects/readonly.static.test.ts tests/unit/contexts/bc_projects/write-boundary.static.test.ts`; przepisz plik: `describe("bc_projects: granica zapisu")`, wyciągnij `findViolations`, dodaj część A i B z tabeli.
- [ ] **Step 2:** `npx vitest run tests/unit/contexts/bc_projects/write-boundary.static.test.ts` → PASS (reguła jest łagodniejsza niż poprzednia, więc czerwonego kroku nie ma; czerwień sprawdza część A: przy chwilowym wpisaniu błędnej reguły przypadek `services.ts` musi paść).
- [ ] **Step 3:** `npx vitest run tests/unit/architecture.static.test.ts` → PASS (bez zmian w tym pliku).
- [ ] **Step 4: Commit (tylko ten test):**

```bash
git add tests/unit/contexts/bc_projects/
git commit -m "test(projects): granica zapisu w bc_projects zamiast zakazu zapisu"
```

---

### Task 2: Modele i `parseState` / `serializeState`

**Files:**

- Modify: `contexts/bc_projects/models.ts`, `contexts/bc_projects/repositories/markdown.ts`
- Test: `tests/unit/contexts/bc_projects/repositories.markdown.test.ts`

**Dodatki do `models.ts`** (tylko typy i jedna stała; `ProjectWithContent` zmienia się dopiero w Task 7, żeby każdy commit się kompilował):

```ts
export type ProjectType = "etat" | "wlasny" | "biblioteka";
export const PROJECT_TYPES: readonly ProjectType[] = ["etat", "wlasny", "biblioteka"];
/** Wersja pliku (zgodna strukturalnie z `FileVersion` z `lib/nexus/vault-fs`; models nie importuje `lib/nexus`, reguła R5). */
export type VersionToken = { size: number; hash: string };
export type ProjectState = {
  branch: string;
  env: string;
  blocker: string;
  nextStep: string;
  links: string[];
  milestone: string;
  milestoneDue?: string;
  updated?: string; // YYYY-MM-DD, YYYY-MM-DDTHH:mm
  notes: string; // treść pliku pod frontmatterem
};
export type DevlogEntry = { date: string | null; title: string; why: string };
```

`ProjectIndex` dostaje `type?: ProjectType`.

**Sygnatury i reguły (`markdown.ts`):**

- `parseState(text: string, rel: string): ProjectState`:
  - tekst zaczyna się od `---` → `parseFrontmatter`; `null` → `throw new Error(`${rel}: zepsuty frontmatter`)`;
  - brak frontmattera → wszystkie pola puste, `notes` = przycięty tekst;
  - pola tekstowe przez przycięcie `String(v)` (brak/`null` → `""`); `links`: tylko elementy typu `string` (po przycięciu, niepuste), nie-tablica → `[]`; `milestoneDue` i `updated`: przycięty tekst albo `undefined` gdy pusty; `notes` = `body.trim()`.
- `serializeState(state: ProjectState): string`: `formatFrontmatter(meta, state.notes)`, klucze w kolejności `branch, env, blocker, next_step, links, milestone, milestone_due, updated`; `milestone_due` i `updated` jako `undefined`, gdy puste (formatFrontmatter je pomija).

**Przypadki testowe (`repositories.markdown.test.ts`, nowe `describe`) i oczekiwania:**

| Wejście                                                                                                                                                                                            | Oczekiwanie                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseState("---\nbranch: main\nenv: local\nblocker: X\nnext_step: Y\nlinks:\n  - https://a\nmilestone: M\nmilestone_due: 2026-12-01\nupdated: 2026-11-13T09:15\n---\n\nnotatka\n", "p/state.md")` | `{branch:"main", env:"local", blocker:"X", nextStep:"Y", links:["https://a"], milestone:"M", milestoneDue:"2026-12-01", updated:"2026-11-13T09:15", notes:"notatka"}` |
| `"---\nlinks: foo\n---\n"`                                                                                                                                                                         | `links: []`, wszystkie teksty `""`, `milestoneDue` i `updated` `undefined`, `notes: ""`                                                                               |
| `"---\nlinks: [1, \"https://b\", null]\n---\n"`                                                                                                                                                    | `links: ["https://b"]` (liczba i `null` pominięte)                                                                                                                    |
| `"---\nbranch: [\n---\n"`                                                                                                                                                                          | `toThrow(/p\/state\.md: zepsuty frontmatter/)`                                                                                                                        |
| `"luźny tekst"` (bez frontmattera)                                                                                                                                                                 | pola puste, `notes: "luźny tekst"`                                                                                                                                    |
| `""`                                                                                                                                                                                               | stan pusty, bez wyjątku                                                                                                                                               |
| `serializeState(S)` dla `S` ze wszystkimi polami i `notes: "n"`, potem `parseState(…, "x")`                                                                                                        | `toEqual(S)` (round-trip; daty wracają jako tekst mimo serializacji YAML 1.1)                                                                                         |
| `serializeState({…bez milestoneDue i updated})`                                                                                                                                                    | wynik nie zawiera `milestone_due` ani `updated`; zawiera `links: []`                                                                                                  |

- [ ] **Step 1:** dopisz typy do `models.ts` (kompiluje się: nic ich jeszcze nie używa poza testami).
- [ ] **Step 2:** napisz testy z tabeli. `npx vitest run tests/unit/contexts/bc_projects/repositories.markdown.test.ts` → FAIL („parseState is not a function”).
- [ ] **Step 3:** zaimplementuj `parseState` i `serializeState` wg reguł; importy w `markdown.ts`: `parseFrontmatter`, `formatFrontmatter` z `@/lib/nexus/frontmatter`.
- [ ] **Step 4:** ten sam test → PASS.
- [ ] **Step 5: Commit**

```bash
git add contexts/bc_projects/models.ts contexts/bc_projects/repositories/markdown.ts tests/unit/contexts/bc_projects/repositories.markdown.test.ts
git commit -m "feat(bc_projects): model i parser Save State (state.md)"
```

---

### Task 3: `parseDevlog` i `prependDevlogEntry`

**Files:**

- Modify: `contexts/bc_projects/repositories/markdown.ts`
- Test: `tests/unit/contexts/bc_projects/repositories.markdown.test.ts`

**Sygnatury i reguły:**

- `parseDevlog(text: string): DevlogEntry[]`: wpis zaczyna się od linii `## ` (dokładnie drugi poziom, początek linii), kończy na następnym `## ` lub końcu pliku (`###` i `#` nie są granicami). Nagłówek pasujący do `/^(\d{4}-\d{2}-\d{2})\s+[—–-]\s+(.+)$/` daje `date` i `title`; inny nagłówek: `date: null`, `title` = cały nagłówek (przycięty). `why` = przycięta treść do następnego `## ` (zachowuje akapity). Tekst przed pierwszym `## ` pomijany. Kolejność = kolejność pliku. Można użyć istniejącego `parseSections` (cięcie po `## `).
- `prependDevlogEntry(text: string | null, entry: { date: string; title: string; why: string }): string`:
  - blok wpisu: `why` niepuste → `## ${date} — ${title}\n\n${why}\n`, puste → `## ${date} — ${title}\n`;
  - `text` równe `null` lub same białe znaki → `"# Devlog\n\n" + blok`;
  - jest linia `## ` (wyszukaj `/^## /m`): `text.slice(0, idx) + blok + "\n" + text.slice(idx)`;
  - brak `## `: `text.replace(/\s+$/, "") + "\n\n" + blok`.

**Przypadki testowe i oczekiwania:**

| Wejście                                                                                                         | Oczekiwanie                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `parseDevlog("# Devlog\n\nwstęp\n\n## 2026-11-13 — Drugi\n\nPowód 2\n\n## 2026-11-12 - Pierwszy\n\nPowód 1\n")` | `[{date:"2026-11-13",title:"Drugi",why:"Powód 2"},{date:"2026-11-12",title:"Pierwszy",why:"Powód 1"}]` (wstęp pominięty) |
| `parseDevlog("## Notatka bez daty\n\ntekst")`                                                                   | `[{date:null,title:"Notatka bez daty",why:"tekst"}]`                                                                     |
| `parseDevlog("## 2026-11-11 – T\n\nx")` (en dash)                                                               | `date: "2026-11-11"`, `title: "T"`                                                                                       |
| `parseDevlog("## 2026-11-11 — T\n\n### pod\n\nb\n\nc")`                                                         | jeden wpis; `why` = `"### pod\n\nb\n\nc"`                                                                                |
| `parseDevlog("")`                                                                                               | `[]`                                                                                                                     |
| `prependDevlogEntry(null, {date:"2026-11-13",title:"T",why:"W"})`                                               | `"# Devlog\n\n## 2026-11-13 — T\n\nW\n"`                                                                                 |
| `prependDevlogEntry("# Devlog\n\n## 2026-11-12 — Stary\n\nS\n", {…jak wyżej})`                                  | `"# Devlog\n\n## 2026-11-13 — T\n\nW\n\n## 2026-11-12 — Stary\n\nS\n"`                                                   |
| `prependDevlogEntry("# Devlog\n\nwstęp\n", {…})`                                                                | `"# Devlog\n\nwstęp\n\n## 2026-11-13 — T\n\nW\n"`                                                                        |
| `prependDevlogEntry("", {…})`                                                                                   | jak dla `null`                                                                                                           |
| `prependDevlogEntry(null, {date:"2026-11-13",title:"T",why:""})`                                                | `"# Devlog\n\n## 2026-11-13 — T\n"`                                                                                      |
| `parseDevlog(prependDevlogEntry(X, e))[0]`                                                                      | `toEqual({date:e.date,title:e.title,why:e.why})` (round-trip)                                                            |

- [ ] **Step 1:** napisz testy. `npx vitest run tests/unit/contexts/bc_projects/repositories.markdown.test.ts` → FAIL nowych.
- [ ] **Step 2:** zaimplementuj obie funkcje wg reguł.
- [ ] **Step 3:** test → PASS.
- [ ] **Step 4: Commit**

```bash
git add contexts/bc_projects/repositories/markdown.ts tests/unit/contexts/bc_projects/repositories.markdown.test.ts
git commit -m "feat(bc_projects): parser i dopisywanie wpisów devlog.md"
```

---

### Task 4: `setFrontmatterType` (edycja jednej linii)

**Files:**

- Modify: `contexts/bc_projects/repositories/markdown.ts`
- Test: `tests/unit/contexts/bc_projects/repositories.markdown.test.ts`

Subtelna funkcja tekstowa: pełny kod (napisany bez uruchamiania; wejście jest już po normalizacji CRLF→LF przez `vault-fs`):

```ts
import { DomainError } from "@/lib/errors";
import type { ProjectType } from "@/contexts/bc_projects/models";

const FRONTMATTER_BLOCK = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;
const TYPE_LINE = /^type:[ \t]*.*$/m;

/** Zmienia tylko linię `type:` w frontmatterze (klucz w kolumnie 0); treść i pozostałe pola bez zmian. */
export function setFrontmatterType(text: string, type: ProjectType): string {
  const m = FRONTMATTER_BLOCK.exec(text);
  if (!m) {
    throw new DomainError("index.md nie ma frontmattera: nie ustawiono type", 422);
  }
  const block = m[1];
  const next = TYPE_LINE.test(block)
    ? block.replace(TYPE_LINE, `type: ${type}`)
    : `${block}\ntype: ${type}`;
  return "---\n" + next + text.slice(4 + block.length);
}
```

Uwagi: `text.slice(4 + block.length)` zaczyna się od `\n---…`, więc zamykający `---` i treść zostają bajt w bajt. Komentarz YAML w tej samej linii co `type:` jest tracony (linia zamieniana w całości); komentarze w innych liniach zostają.

**Przypadki testowe i oczekiwania:**

| Wejście (`text`, `type`)                                                            | Oczekiwanie                                                                                                     |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `"---\nname: A\ntype: etat\nstatus: active\n---\n\nTreść\n"`, `"wlasny"`            | `"---\nname: A\ntype: wlasny\nstatus: active\n---\n\nTreść\n"`                                                  |
| `"---\nname: A\nstatus: active\n---\n\nTreść\n"`, `"biblioteka"`                    | `"---\nname: A\nstatus: active\ntype: biblioteka\n---\n\nTreść\n"`                                              |
| `"---\n# komentarz\nname: \"A\"\ntype: \"etat\"\ntags: [a, b]\n---\nx"`, `"wlasny"` | `"---\n# komentarz\nname: \"A\"\ntype: wlasny\ntags: [a, b]\n---\nx"` (komentarz, cudzysłowy, lista nietknięte) |
| `"---\nname: A\n  type: nested\n---\nx"` (klucz wcięty)                             | dopisane `type: etat` na końcu bloku; wcięta linia nietknięta                                                   |
| `"---\nname: A\n---"` (bez końcowego `\n`)                                          | `"---\nname: A\ntype: etat\n---"`                                                                               |
| `"Treść bez frontmattera"`                                                          | `toThrow(DomainError)`; `statusCode === 422`                                                                    |
| `"---\n---\ntekst"` (pusty blok)                                                    | `toThrow(DomainError)` z 422                                                                                    |

- [ ] **Step 1:** napisz testy. Uruchom → FAIL.
- [ ] **Step 2:** dodaj funkcję (kod wyżej).
- [ ] **Step 3:** test → PASS.
- [ ] **Step 4: Commit**

```bash
git add contexts/bc_projects/repositories/markdown.ts tests/unit/contexts/bc_projects/repositories.markdown.test.ts
git commit -m "feat(bc_projects): zmiana pola type w index.md edycją jednej linii"
```

---

### Task 5: Repozytorium: odczyt `type`, `state.md`, `devlog.md`

**Files:**

- Modify: `contexts/bc_projects/repositories/index.ts`
- Test: `tests/unit/contexts/bc_projects/repositories.test.ts`

**Sygnatury:**

- `readProjectIndex(entry)` (istniejąca) dokłada `type`: `text(meta.type)`; tylko wartość z `PROJECT_TYPES` trafia do wyniku (inna → pole pominięte).
- `readProjectState(entry: RegistryEntry): { state: ProjectState | null; version: VersionToken | null }`: `readVaultFile(projectPath(entry.folder, "state.md"))`; brak pliku → `{ state: null, version: null }`; inaczej `{ state: parseState(file.text, rel), version: file.version }`.
- `readDevlog(entry): DevlogEntry[]`: brak pliku → `[]`, inaczej `parseDevlog(file.text)`.

**Przypadki testowe (`useTempVault`, wpis `entry({ id: "p", folder: "Projects/p/" })`):**

| Stan vaulta                                            | Oczekiwanie                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `index.md` z `type: wlasny`                            | `readProjectIndex(e).type === "wlasny"`                                   |
| `index.md` z `type: coś`                               | `type` `undefined`                                                        |
| brak `state.md`                                        | `{ state: null, version: null }`                                          |
| `state.md` z frontmatterem (jak w Task 2)              | `state.branch === "main"`, `version.size > 0`, `version.hash` ma 64 znaki |
| `state.md` z zepsutym YAML (`"---\nbranch: [\n---\n"`) | `toThrow(/Projects\/p\/state\.md: zepsuty frontmatter/)`                  |
| brak `devlog.md`                                       | `[]`                                                                      |
| `devlog.md` z dwoma wpisami                            | dwa wpisy w kolejności pliku                                              |
| `folder: "Work/x/"` przy `readProjectState`            | `WorkAreaBlockedError` (strażnik z `vault-fs`)                            |

- [ ] **Step 1:** napisz testy → FAIL. **Step 2:** zaimplementuj (importy: `PROJECT_TYPES` z `models`, `parseState`, `parseDevlog` z `./markdown`). **Step 3:** `npx vitest run tests/unit/contexts/bc_projects/repositories.test.ts` → PASS.
- [ ] **Step 4: Commit**

```bash
git add contexts/bc_projects/repositories/index.ts tests/unit/contexts/bc_projects/repositories.test.ts
git commit -m "feat(bc_projects): odczyt type, state.md i devlog.md z vaulta"
```

---

### Task 6: Repozytorium: zapisy

**Files:**

- Modify: `contexts/bc_projects/repositories/index.ts`
- Test: `tests/unit/contexts/bc_projects/repositories.test.ts`

**Sygnatury (jedyne miejsce zapisu w kontekście):**

- `writeProjectState(entry, state: ProjectState, expected: VersionToken | null): VersionToken` → `writeVaultFile(projectPath(entry.folder, "state.md"), serializeState(state), { expected })`.
- `appendDevlogEntry(entry, e: { date: string; title: string; why: string }): Promise<void>` → `updateVaultFile(rel, (cur) => prependDevlogEntry(cur, e))`.
- `writeProjectType(entry, type: ProjectType): Promise<void>` → `updateVaultFile(rel("index.md"), (cur) => { if (cur === null) throw new NotFoundError(`Brak ${rel}`); return setFrontmatterType(cur, type); })`.

**Przypadki testowe (`useTempVault`):**

| Scenariusz                                                                  | Oczekiwanie                                                                                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `writeProjectState(e, S, null)` przy braku pliku                            | `vault.read("Projects/p/state.md")` zawiera `branch: main`; zwrócona wersja równa `readProjectState(e).version` |
| zapis z wersją z ostatniego odczytu                                         | plik zaktualizowany                                                                                             |
| zapis ze starą wersją (po zmianie pliku przez `vault.write`)                | `rejects`/`toThrow(ConflictError)`; plik zawiera zmianę zewnętrzną, nie nasz zapis                              |
| zapis z `expected: null` przy istniejącym pliku                             | `ConflictError`                                                                                                 |
| zapis z `expected: {size:1,hash:"x"}` przy braku pliku                      | `ConflictError`                                                                                                 |
| `appendDevlogEntry` przy braku pliku                                        | plik = `"# Devlog\n\n## 2026-11-13 — T\n\nW\n"`                                                                 |
| `appendDevlogEntry` przy pliku ze starym wpisem                             | nowy wpis przed starym, stary bez zmian                                                                         |
| `writeProjectType` na `index.md` z komentarzem YAML, cudzysłowami i treścią | zmieniona tylko linia `type`; reszta pliku identyczna bajt w bajt (porównaj po podmianie linii)                 |
| `writeProjectType` na `index.md` z CRLF                                     | zapis w LF, treść i pola zachowane (zgodnie z normalizacją `vault-fs`)                                          |
| `writeProjectType` przy braku `index.md`                                    | `rejects.toThrow(NotFoundError)`; plik nie powstaje                                                             |
| `writeProjectType` na `index.md` bez frontmattera                           | `rejects` z `statusCode 422`; plik niezmieniony                                                                 |
| `folder: "Work/x/"` / `"../x/"` przy każdym z trzech zapisów                | `WorkAreaBlockedError` / `PathOutsideVaultError`, nic nie zapisane                                              |

- [ ] **Step 1:** testy → FAIL. **Step 2:** implementacja. **Step 3:** `npx vitest run tests/unit/contexts/bc_projects/repositories.test.ts tests/unit/contexts/bc_projects/write-boundary.static.test.ts` → PASS (granica zapisu: nowe wywołania tylko w `repositories/`).
- [ ] **Step 4: Commit**

```bash
git add contexts/bc_projects/repositories/index.ts tests/unit/contexts/bc_projects/repositories.test.ts
git commit -m "feat(bc_projects): zapis state.md, devlog.md i pola type"
```

---

### Task 7: Serwis

**Files:**

- Modify: `contexts/bc_projects/models.ts` (`ProjectWithContent`), `contexts/bc_projects/services.ts`
- Test: `tests/unit/contexts/bc_projects/services.test.ts`; uzupełnij fixture `detailProject` w `tests/unit/contexts/bc_projects/router.test.ts` (kompilacja `tsc`)

**Model:** `ProjectWithContent = Project & { tasks; bugs; state: ProjectState | null; stateVersion: VersionToken | null; devlog: DevlogEntry[] }`.

**Sygnatury i reguły (`services.ts`):**

```ts
export type StateInput = {
  branch: string;
  env: string;
  blocker: string;
  nextStep: string;
  links: string[];
  milestone: string;
  milestoneDue?: string;
  version: VersionToken | null;
};
export type DevlogInput = { title: string; why: string };
export function effectiveLastWorked(
  lastWorked: string | undefined,
  stateUpdated: string | undefined
): string | undefined;
export function getProject(id: string, today?: Date): ProjectWithContent; // rozszerzone
export function listProjects(today?: Date): { projects: Project[]; warnings: string[] }; // rozszerzone
export async function saveState(
  id: string,
  input: StateInput,
  now?: Date
): Promise<ProjectWithContent>;
export async function addDevlogEntry(
  id: string,
  input: DevlogInput,
  now?: Date
): Promise<ProjectWithContent>;
export async function setProjectType(
  id: string,
  type: ProjectType,
  today?: Date
): Promise<ProjectWithContent>;
```

- `effectiveLastWorked`: spośród dwóch dat wybiera nowszą po pierwszych 10 znakach (`YYYY-MM-DD`), pomijając daty niepoprawne (regex + istniejąca data kalendarzowa, jak w `freshness`); jedna poprawna → ona; żadna poprawna → `lastWorked` (więc `freshness` da `unknown`); zwraca oryginalny napis wybranej daty.
- `getProject`: dodatkowo `readProjectState(entry)` i `readDevlog(entry)`; `freshness(effectiveLastWorked(index.lastWorked, state?.updated), today)`. **Błąd odczytu `state.md` propaguje** (500 z komunikatem z nazwą pliku): użytkownik naprawia plik w edytorze.
- `listProjects`: wewnątrz pętli, po `readProjectIndex`, osobny `try` dla `readProjectState`: błąd → ostrzeżenie `` `${entry.id}: ${msg}` ``, projekt zostaje z danymi z `index.md` i `freshness` z samego `lastWorked`.
- `saveState`: `entry` z rejestru (nieznany `id` → `NotFoundError` **przed** jakimkolwiek zapisem); `current = readProjectState(entry).state`; zapis `writeProjectState(entry, { branch, env, blocker, nextStep, links, milestone, milestoneDue, updated: localDateTime(now), notes: current?.notes ?? "" }, input.version)`; wynik: `getProject(id, now)`. `ConflictError` z repozytorium nie jest łapany.
- `addDevlogEntry`: `appendDevlogEntry(entry, { date: localDate(now), title: input.title, why: input.why })`; wynik `getProject`.
- `setProjectType`: `writeProjectType(entry, type)`; wynik `getProject`.
- Helpery lokalne: `localDate(d) = YYYY-MM-DD`, `localDateTime(d) = YYYY-MM-DDTHH:mm` z lokalnych pól `getFullYear/getMonth/getDate/getHours/getMinutes`, zero-padding.

**Przypadki testowe (`services.test.ts`; dodaj do mocka `repositories` funkcje `readProjectState`, `readDevlog`, `writeProjectState`, `appendDevlogEntry`, `writeProjectType`; w `beforeEach` domyślnie `readProjectState → { state: null, version: null }`, `readDevlog → []`):**

| Przypadek                                                                                           | Oczekiwanie                                                                                                           |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `effectiveLastWorked("2026-10-23", "2026-11-12T09:00")`                                             | `"2026-11-12T09:00"`                                                                                                  |
| `effectiveLastWorked("2026-11-12", "2026-10-01T10:00")`                                             | `"2026-11-12"`                                                                                                        |
| `effectiveLastWorked("2026-10-01", "zła")`                                                          | `"2026-10-01"`                                                                                                        |
| `effectiveLastWorked(undefined, "2026-11-12T09:00")` / `(undefined, undefined)`                     | `"2026-11-12T09:00"` / `undefined`                                                                                    |
| `effectiveLastWorked("2026-02-30", "2026-02-31")`                                                   | `"2026-02-30"`                                                                                                        |
| `getProject`: `last_worked` 20 dni temu, `state.updated` wczoraj (`TODAY = 2026-11-12`)             | `freshness: "fresh"`; `state`, `stateVersion`, `devlog` z mocków                                                      |
| `getProject`: `readProjectState` rzuca                                                              | `toThrow` z komunikatem błędu                                                                                         |
| `listProjects`: `readProjectState` rzuca dla `a`                                                    | warning zaczyna się od `a:`; projekt `a` ma dane z indeksu i `freshness` z `lastWorked`; pozostałe projekty bez zmian |
| `saveState("a", input, new Date(2026, 10, 13, 9, 15))`, poprzedni `state.notes === "stara notatka"` | `writeProjectState` wywołane z `(entry, {…, updated: "2026-11-13T09:15", notes: "stara notatka"}, input.version)`     |
| `saveState` bez poprzedniego pliku                                                                  | `notes: ""`; `expected` = `null`                                                                                      |
| `saveState("brak", …)`                                                                              | `rejects.toThrow(NotFoundError)`; `writeProjectState` nie wywołane                                                    |
| `writeProjectState` rzuca `ConflictError`                                                           | `saveState` `rejects.toThrow(ConflictError)`                                                                          |
| `addDevlogEntry("a", {title:"T", why:"W"}, new Date(2026, 10, 13))`                                 | `appendDevlogEntry(entry, {date:"2026-11-13", title:"T", why:"W"})`; zwraca wynik `getProject`                        |
| `setProjectType("a", "wlasny")` / nieznany `id`                                                     | `writeProjectType(entry, "wlasny")`; `NotFoundError`, bez zapisu                                                      |

- [ ] **Step 1:** rozszerz mock i napisz testy → FAIL. **Step 2:** zaimplementuj; zaktualizuj `ProjectWithContent` i fixture w `router.test.ts` (`state: null, stateVersion: null, devlog: []`). **Step 3:** `npx vitest run tests/unit/contexts/bc_projects/services.test.ts tests/unit/contexts/bc_projects/router.test.ts` → PASS; `npx tsc --noEmit` → bez błędów (zlecić `cursor`).
- [ ] **Step 4: Commit**

```bash
git add contexts/bc_projects/models.ts contexts/bc_projects/services.ts tests/unit/contexts/bc_projects/services.test.ts tests/unit/contexts/bc_projects/router.test.ts
git commit -m "feat(bc_projects): serwis zapisu Save State, devlogu i type; świeżość ze state.updated"
```

---

### Task 8: Schematy zod i DTO

**Files:**

- Modify: `contexts/bc_projects/schemas.ts`
- Test: `tests/unit/contexts/bc_projects/schemas.test.ts`; uzupełnij fixture'y DTO w `tests/unit/features/projects/{useProjects,ProjectsView}.test.tsx` (pomocnik `detail()`: `state: null, stateVersion: null, devlog: []`)

`schemas.ts` importuje tylko `zod` i `import type` z `./models` (R3).

**Eksporty:**

```ts
export const ProjectTypeSchema = z.enum(["etat", "wlasny", "biblioteka"]);
export const ProjectTypeInputSchema = z.object({ type: ProjectTypeSchema });
export const StateInputSchema = z.object({
  branch,
  env,
  blocker,
  nextStep,
  links,
  milestone,
  milestoneDue,
  version,
});
export const DevlogInputSchema = z.object({ title, why });
export type StateInputDto = z.input<typeof StateInputSchema>; // version: string | null (to wysyła UI)
export type StateInput = z.output<typeof StateInputSchema>; // version: { size, hash } | null (to dostaje serwis)
export type DevlogInputDto = z.input<typeof DevlogInputSchema>;
export type ProjectStateDto = {
  branch;
  env;
  blocker;
  nextStep;
  links: string[];
  milestone;
  milestoneDue?: string;
  updated?: string;
};
export type DevlogEntryDto = { date: string | null; title: string; why: string };
export const DEVLOG_LIMIT = 50;
export type { ProjectType } from "./models"; // re-eksport typu dla UI (dozwolony: `export type … from` z własnego `models`)
```

`ProjectSummaryDto` dostaje `type?: ProjectType` (mapowane w `toSummaryDto`, gdy ustawione); `ProjectDetailDto` dostaje `state: ProjectStateDto | null`, `stateVersion: string | null`, `devlog: DevlogEntryDto[]`.

**Reguły walidacji (wszystkie pola stanu wymagane w body; puste teksty dozwolone):**

- `branch`, `env`, `milestone` ≤ 200; `blocker`, `nextStep` ≤ 500: po przycięciu, **jedna linia** (bez `\r`/`\n`);
- `links`: tablica ≤ 10, element po przycięciu ≤ 300 znaków i `/^https?:\/\/\S+$/i`;
- `milestoneDue`: opcjonalne; `""` → `undefined`; inaczej `YYYY-MM-DD` będące istniejącą datą (sprawdzenie przez `Date.UTC` i porównanie miesiąca i dnia);
- `version`: `null` albo `/^(\d+):([0-9a-f]{64})$/`; wynik transformacji `{ size: Number(m[1]), hash: m[2] }`;
- `DevlogInput.title`: po przycięciu 1–200 znaków, jedna linia, nie zaczyna się od `#`; `why`: ≤ 2000 znaków, CRLF → LF, przycięte, bez linii pasującej do `/^#{1,2}\s/m`.
- `toDetailDto`: `stateVersion = p.stateVersion ? `${size}:${hash}` : null`; `devlog = p.devlog.slice(0, DEVLOG_LIMIT)`; `state` bez pola `notes`; `folder` nadal poza DTO.

**Przypadki testowe (`schemas.test.ts`):**

| Wejście                                                                  | Oczekiwanie                                                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| poprawny `StateInput` z `version: null`, `milestoneDue: ""`              | sukces; `data.version === null`, `data.milestoneDue === undefined`                  |
| `version: "12:" + "a".repeat(64)`                                        | `data.version` = `{ size: 12, hash: "a".repeat(64) }`                               |
| `version: "abc"`                                                         | odrzucone                                                                           |
| `links: ["javascript:alert(1)"]`, `["ftp://x"]`, `["https://ok", "x"]`   | odrzucone                                                                           |
| 11 poprawnych linków                                                     | odrzucone                                                                           |
| `milestoneDue: "2026-02-30"` / `"jutro"` / `"2026-12-01"`                | odrzucone / odrzucone / sukces                                                      |
| `branch: "a\nb"`; `branch` 201 znaków                                    | odrzucone                                                                           |
| `DevlogInput`: `title: "a\nb"`, `"#x"`, `"   "`, 201 znaków              | odrzucone                                                                           |
| `why: "a\n## x"`, `"# x"`; `why` 2001 znaków                             | odrzucone                                                                           |
| `why: "a\n### x\n#hash"`; `why: "a\r\nb"`                                | sukces; drugi daje `"a\nb"`                                                         |
| `ProjectTypeInputSchema.parse({type:"etat"})`; `{type:"firma"}`          | sukces; odrzucone                                                                   |
| `PROJECT_TYPES` z `models` vs opcje `ProjectTypeSchema.options`          | równe (pilnuje zgodności dwóch list)                                                |
| `toDetailDto` z `stateVersion {size: 5, hash: "h"}` i 60 wpisami devlogu | `stateVersion === "5:h"`, `devlog.length === 50`, brak `folder`, brak `state.notes` |
| `toDetailDto` bez stanu                                                  | `state: null`, `stateVersion: null`, `devlog: []`                                   |

- [ ] **Step 1:** testy → FAIL. **Step 2:** implementacja; uzupełnij fixture'y UI (wspólny kształt: `state: null, stateVersion: null, devlog: []`). **Step 3:** `npx vitest run tests/unit/contexts/bc_projects tests/unit/features/projects` → PASS; `npx tsc --noEmit` czysto (zlecić `cursor`).
- [ ] **Step 4: Commit**

```bash
git add contexts/bc_projects/schemas.ts tests/unit/contexts/bc_projects/schemas.test.ts tests/unit/features/projects/
git commit -m "feat(bc_projects): schematy zod i DTO zapisu"
```

---

### Task 9: Router i trasy

**Files:**

- Modify: `contexts/bc_projects/router.ts`, `app/api/projects/[id]/route.ts`
- Create: `app/api/projects/[id]/state/route.ts`, `app/api/projects/[id]/devlog/route.ts`
- Test: `tests/unit/contexts/bc_projects/router.test.ts`

**Handlery (`router.ts`, ten sam wzorzec co `getProject`: `ctx: { params: Promise<{ id: string }> }`, `try/catch → handleServiceError`):**

- `patchProject(req, ctx)`: `parseBody(req, ProjectTypeInputSchema)` (porażka → `parsed.response`); `NextResponse.json(toDetailDto(await services.setProjectType(id, parsed.data.type)))`.
- `putProjectState(req, ctx)`: `parseBody(req, StateInputSchema)`; `services.saveState(id, parsed.data)`; 200 + `toDetailDto`.
- `postDevlog(req, ctx)`: `parseBody(req, DevlogInputSchema)`; `services.addDevlogEntry(id, parsed.data)`; **201** + `toDetailDto`.

**Trasy (tylko re-eksport, wymóg R4):**

```ts
// app/api/projects/[id]/route.ts
export { getProject as GET, patchProject as PATCH } from "@/contexts/bc_projects/router";
// app/api/projects/[id]/state/route.ts
export { putProjectState as PUT } from "@/contexts/bc_projects/router";
// app/api/projects/[id]/devlog/route.ts
export { postDevlog as POST } from "@/contexts/bc_projects/router";
```

**Przypadki testowe (`router.test.ts`; rozszerz mock `services` o `saveState`, `addDevlogEntry`, `setProjectType`; żądania `new NextRequest(url, { method, body: JSON.stringify(b), headers: { "content-type": "application/json" } })`, `params: Promise.resolve({ id: "a" })`):**

| Żądanie                                            | Oczekiwanie                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `PUT …/a/state` z poprawnym body (`version: null`) | 200; `saveState` wywołane z `("a", {…, version: null})`; body bez pola `folder` |
| `PUT` z `version: "x"`                             | 400; `saveState` nie wywołane                                                   |
| `PUT` z nieprawidłowym JSON                        | 400 `{ error: "Invalid JSON" }`                                                 |
| `PUT`, serwis rzuca `ConflictError("…")`           | 409 z `error` z komunikatem                                                     |
| `PUT`, serwis rzuca `NotFoundError`                | 404                                                                             |
| `POST …/a/devlog` `{title:"T", why:"W"}`           | 201; `addDevlogEntry("a", {title:"T", why:"W"})`                                |
| `POST` z `title: ""`                               | 400                                                                             |
| `PATCH …/a` `{type:"wlasny"}`                      | 200; `setProjectType("a", "wlasny")`                                            |
| `PATCH` `{type:"firma"}`                           | 400                                                                             |
| `PATCH`, serwis rzuca `DomainError("…", 422)`      | 422                                                                             |

- [ ] **Step 1:** testy → FAIL. **Step 2:** implementacja handlerów i tras. **Step 3:** `npx vitest run tests/unit/contexts/bc_projects tests/unit/architecture.static.test.ts` → PASS (trasy to czysty re-eksport, brak nowych wyjątków w baseline).
- [ ] **Step 4: Commit**

```bash
git add contexts/bc_projects/router.ts app/api/projects tests/unit/contexts/bc_projects/router.test.ts
git commit -m "feat(projects): trasy PATCH /[id], PUT /[id]/state, POST /[id]/devlog"
```

---

### Task 10: UI: `isHttpUrl` i `ProjectSaveState`

**Files:**

- Create: `src/features/projects/isHttpUrl.ts`, `src/features/projects/mutation.ts`, `src/features/projects/ProjectSaveState.tsx`
- Modify: `src/features/projects/ProjectDossier.tsx` (import `isHttpUrl` zamiast lokalnej stałej; sam komponent wpina się w Task 12), `src/features/projects/projects.css`
- Test: `tests/unit/features/projects/isHttpUrl.test.ts`, `tests/unit/features/projects/ProjectSaveState.test.tsx`

**Interfejsy:**

```ts
// isHttpUrl.ts
export function isHttpUrl(url: string): boolean; // /^https?:\/\//i

// mutation.ts (jeden wspólny typ dla ProjectSaveState, ProjectDevlog i useProjects)
export type MutationResult = { ok: true } | { ok: false; error: string; conflict: boolean };

// ProjectSaveState.tsx
export function ProjectSaveState(props: {
  project: ProjectDetailDto; // z `@/contexts/bc_projects/schemas`
  onSave: (input: StateInputDto) => Promise<MutationResult>;
  onReload: () => void;
}): React.JSX.Element;
```

`MutationResult` żyje tylko w `mutation.ts`; `ProjectDevlog` (Task 11) i `useProjects` (Task 12) importują go stamtąd (zero duplikatów).

**Zachowanie `ProjectSaveState`:**

- `project.state === null`: sekcja „Gdzie skończyłem” z `project.whereIStopped ?? "Brak wpisu"` + przycisk „Utwórz Save State”; kliknięcie otwiera pusty formularz.
- `project.state !== null`: kafle (Branch, Środowisko, Bloker, Następny krok, Linki, „Zapisano: {updated}”; puste pola jako „—”) + przycisk „Edytuj”. Linki: `<a>` tylko dla `isHttpUrl`, inne jako tekst.
- Formularz (etykiety `<label>`): Branch, Środowisko, Bloker, Następny krok, Kamień milowy, Termin kamienia (`type="date"`), Linki (`<textarea>`, jeden na linię); `maxLength` zgodne z zod; przyciski „Zapisz” i „Anuluj”.
- Submit: `onSave({ branch, env, blocker, nextStep, links: <linie przycięte, niepuste>, milestone, milestoneDue, version: project.stateVersion })`; w trakcie zapisu przyciski `disabled`.
- Sukces: formularz zamknięty. Błąd: komunikat w `role="alert"`; gdy `conflict`: tekst „state.md zmienił się poza aplikacją” + przycisk „Wczytaj aktualną wersję” (wywołuje `onReload()` i zamyka formularz; szkic jest tracony, komunikat o tym mówi).
- Stan formularza jest lokalny; rodzic montuje komponent z `key={project.id}`, więc zmiana projektu resetuje formularz.

**Przypadki testowe (`ProjectSaveState.test.tsx`, jsdom, `onSave = vi.fn()`):**

| Scenariusz                                                                                  | Oczekiwanie                                                                                                                |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `state: null`, `whereIStopped: "tu skończyłem"`                                             | widać „tu skończyłem” i przycisk „Utwórz Save State”, nie ma „Edytuj”                                                      |
| `state` z `branch: "main"`, `links: ["https://a", "javascript:x"]`                          | widać „main”; `https://a` jest `<a href>`, `javascript:x` jest tekstem bez linku                                           |
| otwórz formularz, wpisz branch `main`, linki `"https://a\n\n https://b "`, kliknij „Zapisz” | `onSave` wywołane raz z `{ branch:"main", …, links:["https://a","https://b"], version: <stateVersion> }`                   |
| tworzenie (`stateVersion: null`)                                                            | `onSave` z `version: null`                                                                                                 |
| `onSave` zwraca opóźnioną obietnicę; kliknij „Zapisz” dwa razy                              | `onSave` wywołane raz; przycisk `disabled` w trakcie                                                                       |
| `onSave` → `{ ok:false, error:"Brak NEXUS", conflict:false }`                               | `role="alert"` z „Brak NEXUS”; formularz otwarty ze szkicem                                                                |
| `onSave` → `{ ok:false, error:"x", conflict:true }`                                         | widać „state.md zmienił się poza aplikacją” i „Wczytaj aktualną wersję”; po kliknięciu `onReload` raz, formularz zamknięty |
| „Anuluj”                                                                                    | formularz zamknięty, `onSave` niewywołane                                                                                  |

`isHttpUrl.test.ts`: `https://a` → true, `HTTP://a` → true, `javascript:alert(1)` → false, `ftp://a` → false, `""` → false.

- [ ] **Step 1:** testy → FAIL. **Step 2:** implementacja + CSS (klasy z prefiksem `prj-`: `prj-savestate`, `prj-statebox`, `prj-statebox__lbl`, `prj-form`, `prj-field`, `prj-btn`, `prj-alert`; styl przepisany z `.prj-savestate`/`.prj-statebox` w `docs/mockups/karty/cards/04-projekty.html` ~linie 100–155, tokeny z `tokens.css`, bez nowych wartości na sztywno). **Step 3:** `npx vitest run tests/unit/features/projects` → PASS.
- [ ] **Step 4: Commit**

```bash
git add src/features/projects tests/unit/features/projects
git commit -m "feat(projects): kafle i formularz Save State"
```

---

### Task 11: UI: `ProjectDevlog`

**Files:**

- Create: `src/features/projects/ProjectDevlog.tsx`
- Modify: `src/features/projects/projects.css`
- Test: `tests/unit/features/projects/ProjectDevlog.test.tsx`

**Interfejs:**

```ts
export function ProjectDevlog(props: {
  entries: DevlogEntryDto[];
  onAdd: (input: DevlogInputDto) => Promise<MutationResult>;
}): React.JSX.Element;
```

**Zachowanie:** lista `<ol>` wpisów w kolejności z propsów (data lub „—”, tytuł, „Dlaczego” z `white-space: pre-wrap`); pusta lista: „Brak wpisów”. Formularz: „Tytuł” (`maxLength 200`), „Dlaczego” (`<textarea maxLength 2000>`), przycisk „Dodaj wpis” `disabled`, gdy tytuł (po przycięciu) pusty lub zapis w toku. Sukces: pola czyszczone (lista pochodzi z odpowiedzi serwera przez rodzica, bez lokalnego dopisywania). Błąd: `role="alert"` z komunikatem, pola zachowane.

**Przypadki testowe:**

| Scenariusz                                                  | Oczekiwanie                                |
| ----------------------------------------------------------- | ------------------------------------------ |
| `entries: []`                                               | „Brak wpisów”                              |
| dwa wpisy (`date` `"2026-11-13"` i `null`)                  | kolejność jak w propsach; `null` jako „—”  |
| pusty tytuł lub same spacje                                 | „Dodaj wpis” `disabled`                    |
| tytuł „T”, „Dlaczego” „W”, klik                             | `onAdd` raz z `{ title: "T", why: "W" }`   |
| podwójny klik przy opóźnionej obietnicy                     | `onAdd` raz                                |
| `onAdd` → `{ ok: true }`                                    | pola puste                                 |
| `onAdd` → `{ ok:false, error:"zły tytuł", conflict:false }` | `role="alert"` „zły tytuł”; pola zachowane |

- [ ] **Step 1:** testy → FAIL. **Step 2:** implementacja + CSS (`prj-devlog`, `prj-devlog__item`, `prj-devlog__meta`, wzór w makiecie ~linie 155–171). **Step 3:** `npx vitest run tests/unit/features/projects/ProjectDevlog.test.tsx` → PASS.
- [ ] **Step 4: Commit**

```bash
git add src/features/projects tests/unit/features/projects
git commit -m "feat(projects): dziennik decyzji w teczce projektu"
```

---

### Task 12: `useProjects`, `ProjectDossier`, `ProjectsView`

**Files:**

- Modify: `src/features/projects/useProjects.ts`, `src/features/projects/ProjectDossier.tsx`, `src/features/projects/ProjectsView.tsx`, `src/features/projects/projects.css`
- Test: `tests/unit/features/projects/useProjects.test.tsx`, `tests/unit/features/projects/ProjectsView.test.tsx`

**`useProjects` dostaje (obok dotychczasowych pól):**

```ts
saveState: (input: StateInputDto) => Promise<MutationResult>;         // PUT  /api/projects/<id>/state
addDevlogEntry: (input: DevlogInputDto) => Promise<MutationResult>;   // POST /api/projects/<id>/devlog
setType: (type: ProjectType) => Promise<MutationResult>;              // PATCH /api/projects/<id> body {type}
reloadDetail: () => void;                                             // ponowny GET szczegółów wybranego projektu
```

Reguły wspólnej funkcji `mutate(method, url, body)`:

- zapamiętuje `id` wybranego projektu na starcie; `res.ok` → parsuje `ProjectDetailDto`; jeśli `selectedIdRef.current === id`, `setDetail(body)`; aktualizuje element listy o `freshness` i `type` z odpowiedzi (`setProjects(ps => ps.map(...))`); zwraca `{ ok: true }`;
- `!res.ok` → `{ ok: false, error: <komunikat z body.error lub "HTTP <status>">, conflict: res.status === 409 }`; wyjątek sieci → `{ ok: false, error: <message>, conflict: false }`;
- odpowiedź dla projektu, który już nie jest wybrany, nie zmienia `detail` (ochrona przed spóźnioną odpowiedzią).
- `selectedIdRef` aktualizowany przy każdej zmianie `selectedId`.

**`ProjectDossier`:** props `{ project, actions: { saveState, addDevlogEntry, setType, reloadDetail } }`. Układ: metryczka (nazwa, status · priorytet, linki, `localPath`, `<select aria-label="Typ projektu">` z opcjami „Nie ustawiono” (value `""`, `disabled`), „Etat”, „Własny”, „Biblioteka”; błąd zmiany typu w `role="alert"`; gdy `project.state?.milestone`: wiersz „Kamień milowy: {nazwa}” + „ · do {milestoneDue}”, bez paska) → `<ProjectSaveState key={project.id} …>` zamiast dawnej sekcji „Gdzie skończyłem” → Zadania (sekcja bez pozycji pokazuje „Brak”) → Bugi → `<ProjectDevlog entries={project.devlog} onAdd={actions.addDevlogEntry} />`. `ProjectsView` przekazuje akcje z hooka.

**Przypadki testowe:**

`useProjects.test.tsx`:

| Scenariusz                                                                                | Oczekiwanie                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saveState(input)` przy wybranym `a`, atrapa zwraca 200 z `detail` o nowym `stateVersion` | `apiFetch` wołane z `("/api/projects/a/state", { method: "PUT", body: JSON.stringify(input), headers: {"content-type":"application/json"} })`; `result.current.detail` = odpowiedź; wynik `{ ok: true }` |
| po `saveState` odpowiedź ma `freshness: "fresh"`, lista miała `stale`                     | element listy `a` ma `freshness: "fresh"`                                                                                                                                                                |
| 409 z `{ error: "Plik zmienił się" }`                                                     | `{ ok:false, error:"Plik zmienił się", conflict:true }`; `detail` bez zmian                                                                                                                              |
| 500 bez JSON                                                                              | `{ ok:false, error:"HTTP 500", conflict:false }`                                                                                                                                                         |
| `saveState` startuje dla `a`, potem `select("b")`, dopiero potem odpowiedź dla `a`        | `detail` pozostaje szczegółami `b`                                                                                                                                                                       |
| `addDevlogEntry({title:"T", why:"W"})`; `setType("wlasny")`                               | wywołania `POST …/devlog` i `PATCH …/a` z `{"type":"wlasny"}`; `detail` z odpowiedzi                                                                                                                     |
| `reloadDetail()`                                                                          | kolejny `GET /api/projects/a`; `detail` z nowej odpowiedzi                                                                                                                                               |

`ProjectsView.test.tsx`:

| Scenariusz                                                          | Oczekiwanie                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| projekt bez `state`                                                 | „Gdzie skończyłem”, „Utwórz Save State”, „Brak wpisów” w devlogu                  |
| projekt ze `state` i `milestone: "M"`, `milestoneDue: "2026-12-01"` | kafle Save State; „Kamień milowy: M” i „do 2026-12-01”; brak `role="progressbar"` |
| zmiana selecta „Typ projektu” na `wlasny`                           | `PATCH` z `{"type":"wlasny"}`; select pokazuje wartość z odpowiedzi               |
| `PATCH` zwraca 422 z `{ error: "index.md nie ma frontmattera…" }`   | `role="alert"` z komunikatem                                                      |
| pełny przepływ: „Utwórz Save State” → wypełnij → „Zapisz”           | `PUT` z `version: null`; po odpowiedzi widać kafle z nowymi wartościami           |
| dopisanie wpisu devlogu                                             | `POST`; lista pokazuje wpis z odpowiedzi serwera                                  |
| zadania: sekcja `Blokery` bez pozycji                               | w sekcji widać „Brak”                                                             |
| link `javascript:` w `state.links`                                  | tekst, bez `<a>`                                                                  |

- [ ] **Step 1:** testy → FAIL. **Step 2:** implementacja hooka, `ProjectDossier`, `ProjectsView`, CSS (`prj-milestone`, `prj-type-select`, `prj-task-empty`). **Step 3:** `npx vitest run tests/unit/features/projects` → PASS.
- [ ] **Step 4: Commit**

```bash
git add src/features/projects tests/unit/features/projects
git commit -m "feat(projects): zapis Save State, devlogu i typu z karty Projekty"
```

---

### Task 13: Dokumentacja

**Files:**

- Modify: `docs/mockups/karty/STAN-W-KODZIE.md` (§4), `docs/superpowers/specs/2026-11-12-etap-1-1-karta-projektu-odczyt-design.md` (tabela podetapów), `docs/superpowers/specs/2026-11-13-etap-1-2-save-state-devlog-design.md` (status), `README.md` (linie ok. 40–44)

- [ ] **Step 1: `STAN-W-KODZIE.md` §4:** akapit o 1-2 zrobionym (Save State, devlog, `type`, świeżość ze `state.updated`); w tabeli: „Save State” i „Devlog” → JEST (`ProjectSaveState`, `ProjectDevlog`, `bc_projects`), „Kamień milowy” → CZĘŚCIOWO („nazwa i termin, bez paska”), `Teraz/Następne/Icebox` zostaje BRAK (1-3), „Owner” BRAK (1-5).
- [ ] **Step 2: spec 1-1:** w tabeli podetapów przy 1-2 dopisz „wykonany (2026-11-13)”; w spec 1-2 `Status: wykonany (<data>)`.
- [ ] **Step 3: `README.md`:** „API projektów (tylko GET)” → opis pięciu tras (GET lista, GET `[id]`, PATCH `[id]`, PUT `[id]/state`, POST `[id]/devlog`); karta Projekty: „rejestr, teczka, Save State, devlog (zapis do vaulta)”; kontekst `bc_projects` nie jest już „tylko do odczytu”.
- [ ] **Step 4:** `npx prettier --check docs README.md` (zlecić `cursor`) → czysto.
- [ ] **Step 5: Commit**

```bash
git add docs README.md
git commit -m "docs: etap 1-2 w STAN-W-KODZIE, README i specach"
```

---

### Task 14: Bramka, smoke test, review, PR

- [ ] **Step 1: Bramka (zlecić `cursor`, „przeszło” albo `plik:linia + przyczyna`):** `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Oczekiwane: wszystko zielone; liczba testów większa niż 1017 z 1-1.
- [ ] **Step 2: Review diffa:** `scripts/ask-helper.sh --role review --max-lines 60 agy "Review diffa gałęzi feat/etap-1-2-save-state-devlog względem main (git diff main...HEAD). Spec: docs/superpowers/specs/2026-11-13-etap-1-2-save-state-devlog-design.md. Szukaj: gubienia danych w index.md/state.md przy zapisie, wyścigów i konfliktów wersji, ucieczki ścieżki poza Projects/<id>/, przepuszczonych wejść (## w tytule, linki nie-http), braków w testach. Format: plik:linia + problem + sugestia."`. Każdą uwagę zweryfikuj w kodzie, zanim cokolwiek zmienisz; poprawki osobnymi commitami `fix(…)`.
- [ ] **Step 3: Smoke test na prawdziwym vaulcie** (stan wyjściowy: `git -C ../NEXUS status --short` pokazuje tylko niezwiązane `M Vault/Tasks/tasks.md`):
  1. `npm run dev` (port 3100), otwórz `/dashboard#projekty`, wybierz **Monolith**.
  2. „Utwórz Save State”: wpisz branch `feat/etap-1-2-save-state-devlog`, następny krok, link `https://github.com/Miroslaw7224/Monolith`, kamień milowy; zapisz. Oczekiwane: kafle, odznaka świeżości „fresh”.
  3. Dopisz wpis devlogu „Smoke 1-2” z „Dlaczego”. Oczekiwane: wpis na górze listy.
  4. Zmień `type` na „Własny”.
  5. Zmień `state.md` w edytorze, wróć do karty i zapisz formularz bez odświeżenia: oczekiwany komunikat 409 i działający przycisk „Wczytaj aktualną wersję”.
  6. `git -C ../NEXUS status --short` i `git -C ../NEXUS diff Vault/Projects/monolith/index.md`: **nowe** `Vault/Projects/monolith/state.md` i `devlog.md`, w `index.md` zmieniona wyłącznie linia `type:` (jedna linia w diffie); nic poza `Projects/monolith/` oprócz dawnej zmiany `Tasks/tasks.md`.
  7. Sprzątanie danych testowych wg decyzji użytkownika (zostawić jako prawdziwy Save State albo usunąć `state.md`, `devlog.md` i cofnąć `type`).
- [ ] **Step 4: Vault:** w `NEXUS/Vault/Projects/monolith/tasks.md` odhacz „Kolejne etapy karty projektu” jako „Etap 1-2 … — <data>” i dodaj w Next „Etap 1-3: tablica zadań projektu (Teraz / Następne / Icebox)”; commit w repo NEXUS osobno, po potwierdzeniu użytkownika.
- [ ] **Step 5: PR:** `git push -u origin feat/etap-1-2-save-state-devlog` i `gh pr create` z opisem (zakres, decyzje D1–D11 ze specu, wynik bramki i smoke testu) zakończonym `🤖 Generated with [Claude Code](https://claude.com/claude-code)`; push i PR dopiero po potwierdzeniu użytkownika.
