# Przegląd tygodnia w Kokpicie — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel „Przegląd tygodnia” w Kokpicie: zestawienie z 7 dni (git, zamknięte zadania, zamknięcia dnia, review, spotkania), gotowy prompt do schowka dla agenta i zapisywany focus tygodnia (`Cockpit/weeks.yaml`).

**Architecture:** Cała logika w `contexts/bc_cockpit` (`models`, `repositories`, `services`, `schemas`, `router`), dane z gita i zadań projektów przez dwie nowe funkcje `services` kontekstu `bc_projects` oraz `commitSubjects` w `lib/git`. Dwie nowe trasy (`GET /api/cockpit/week-review`, `PUT /api/cockpit/week-focus`). UI: `src/features/home/WeekReview.tsx` plus jedna linia „Focus tygodnia” w `HomeView`. Żadnego modelu AI: aplikacja składa prompt i kopiuje go do schowka.

**Tech Stack:** Next.js 14, TypeScript, zod, Vitest (`@testing-library/react`), i18next (PL/EN), `lib/nexus/yaml-store`.

**Spec:** `docs/superpowers/specs/2026-11-16-przeglad-tygodnia-kokpit-design.md`.

**Zasady wykonania (CLAUDE.md):**

- Gałąź `feat/przeglad-tygodnia` (już istnieje, spec jest na niej zacommitowany). Commity kończą się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- `tests/unit/architecture.static.test.ts` nie zmieniamy. Pęknięty test architektury naprawia się kodem.
- Czerwony/zielony test pojedynczego pliku: `npx vitest run <ścieżka> 2>&1 | tail -30`. Pełny zestaw, `npx tsc --noEmit`, `npm run lint`, `npm run build` zleca się `cursor` (`scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "..."`), review diffa `agy` (`--role review`).
- Plik `services.ts` nie rośnie o nowy plik w kontekście (test warstwy plikowej): nowe funkcje bc_cockpit idą do istniejących pięciu plików.

---

## Mapa plików

| Plik                                                          | Zmiana                                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `lib/git/project-git.ts`                                      | + `commitSubjects`                                                                                                |
| `contexts/bc_projects/models.ts`                              | + `GitSubjects`, `DoneTasks`                                                                                      |
| `contexts/bc_projects/repositories/index.ts`                  | + `readGitSubjects`                                                                                               |
| `contexts/bc_projects/services/index.ts`                      | + `listGitSubjects`, `listDoneTasksInWindow`                                                                      |
| `contexts/bc_cockpit/models.ts`                               | + `WeekFocus`, `WeekReviewProject`, `WeekReviewClosing`, `WeekReview`; `Cockpit.weekFocus`                        |
| `contexts/bc_cockpit/repositories.ts`                         | + `readWeekFocuses`, `upsertWeekFocus` (`Cockpit/weeks.yaml`)                                                     |
| `contexts/bc_cockpit/services.ts`                             | + `weekStart`, `MAX_FOCUS_TEXT`, `setWeekFocus`, `getWeekReview`, `composeWeekPrompt`; `getCockpit` → `weekFocus` |
| `contexts/bc_cockpit/schemas.ts`                              | + `WeekFocusInputSchema`, DTO i mapery; `toCockpitDto` → `weekFocus`                                              |
| `contexts/bc_cockpit/router.ts`                               | + `getWeekReview`, `putWeekFocus`                                                                                 |
| `app/api/cockpit/week-review/route.ts`, `week-focus/route.ts` | nowe, tylko re-eksport                                                                                            |
| `src/i18n/locales/{pl,en}/home.ts`                            | + sekcja `weekReview`                                                                                             |
| `src/features/home/WeekReview.tsx`                            | nowy panel                                                                                                        |
| `src/features/home/CockpitSections.tsx`                       | panel pod `CommitHistory`, nowy prop `onWeekFocusSaved`                                                           |
| `src/features/home/HomeView.tsx`                              | linia „Focus tygodnia”, przekazanie `onWeekFocusSaved`                                                            |
| `src/features/home/home.css`                                  | klasy `kok-week*`, `kok-weekfocus`                                                                                |
| `docs/nexus-vault-formaty-yaml.md`                            | sekcja `Cockpit/weeks.yaml`                                                                                       |
| testy                                                         | zob. poszczególne zadania                                                                                         |

---

### Task 1: `lib/git` — `commitSubjects`

**Files:**

- Modify: `lib/git/project-git.ts` (po `commitsByDay`)
- Test: `tests/unit/lib/git/project-git.test.ts`

- [ ] **Step 1: Napisz test (czerwony)**

W `tests/unit/lib/git/project-git.test.ts` dopisz `commitSubjects` do importu z `@/lib/git/project-git` (obok `commitsByDay`) i na końcu pliku dodaj:

```ts
describe("commitSubjects", () => {
  it("zwraca tematy commitów z zakresu dat włącznie, najnowsze pierwsze", () => {
    const r = repos.create();
    r.write("a.txt", "1");
    r.commit("za wcześnie", "2026-11-09");
    r.write("a.txt", "2");
    r.commit("feat: dwa", "2026-11-10");
    r.write("a.txt", "3");
    r.commit("fix: trzy", "2026-11-12");
    r.write("a.txt", "4");
    r.commit("za późno", "2026-11-17");
    expect(commitSubjects(r.dir, "2026-11-10", "2026-11-16")).toEqual({
      ok: true,
      subjects: ["fix: trzy", "feat: dwa"],
    });
  });

  it("liczy commity z innych lokalnych gałęzi raz", () => {
    const r = repos.create();
    r.write("a.txt", "1");
    r.commit("c1", "2026-11-10");
    execFileSync("git", ["checkout", "-q", "-b", "feat/x"], { cwd: r.dir });
    r.write("b.txt", "2");
    r.commit("c2", "2026-11-11");
    execFileSync("git", ["checkout", "-q", "main"], { cwd: r.dir });
    expect(commitSubjects(r.dir, "2026-11-10", "2026-11-11")).toEqual({
      ok: true,
      subjects: ["c2", "c1"],
    });
  });

  it("repo bez commitów: pusto; katalog bez .git: błąd; zła data: wyjątek", () => {
    const r = repos.create();
    expect(commitSubjects(r.dir, "2026-11-01", "2026-11-13")).toEqual({ ok: true, subjects: [] });
    const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prj-plain-")));
    try {
      expect(commitSubjects(plain, "2026-11-01", "2026-11-13")).toEqual({ ok: false });
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
    expect(() => commitSubjects(r.dir, "--all", "2026-11-13")).toThrow(/data/);
    expect(() => commitSubjects(r.dir, "2026-11-01", "x")).toThrow(/data/);
    expect(() => commitSubjects(r.dir, "2026-11-13", "2026-11-01")).toThrow(/zakres/);
  });
});
```

- [ ] **Step 2: Uruchom — ma paść**

Run: `npx vitest run tests/unit/lib/git/project-git.test.ts 2>&1 | tail -30`
Expected: FAIL (`commitSubjects is not a function` lub brak eksportu).

- [ ] **Step 3: Implementacja**

W `lib/git/project-git.ts`, zaraz po funkcji `commitsByDay` (przed `const PR_MERGE`), dodaj:

```ts
/**
 * Tematy commitów (bez merge'y, lokalne gałęzie, bez duplikatów, najnowsze pierwsze) w zakresie
 * `from`–`to` włącznie (`RRRR-MM-DD`, czas lokalny). Zły format daty rzuca, jak w `commitsByDay`.
 */
export function commitSubjects(
  repoDir: string,
  from: string,
  to: string
): { ok: true; subjects: string[] } | { ok: false } {
  if (!DAY_RE.test(from)) throw new Error(`git: zła data (oczekiwano RRRR-MM-DD): ${from}`);
  if (!DAY_RE.test(to)) throw new Error(`git: zła data (oczekiwano RRRR-MM-DD): ${to}`);
  if (from > to) throw new Error(`git: zły zakres dat: ${from} > ${to}`);
  const res = execGit(repoDir, [
    "log",
    "--branches",
    "--no-merges",
    "--format=%H%x09%s",
    `--since=${from}T00:00:00`,
    `--until=${to}T23:59:59`,
  ]);
  if (res.status !== 0) return { ok: false };
  const seen = new Set<string>();
  const subjects: string[] = [];
  for (const line of res.stdout.split("\n")) {
    const [hash, ...rest] = line.split("\t");
    const subject = rest.join("\t").trim();
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    if (subject !== "") subjects.push(subject);
  }
  return { ok: true, subjects };
}
```

- [ ] **Step 4: Uruchom — ma przejść**

Run: `npx vitest run tests/unit/lib/git/project-git.test.ts 2>&1 | tail -30`
Expected: PASS (wszystkie testy pliku).

- [ ] **Step 5: Commit**

```bash
git add lib/git/project-git.ts tests/unit/lib/git/project-git.test.ts
git commit -m "feat(git): commitSubjects, tematy commitów z zakresu dat" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `bc_projects` — tematy commitów i zamknięte zadania w oknie

**Files:**

- Modify: `contexts/bc_projects/models.ts` (po `GitHistory`, ok. linii 175–181)
- Modify: `contexts/bc_projects/repositories/index.ts` (obok `readGitHistory`, ok. linii 442; import `commitSubjects`)
- Modify: `contexts/bc_projects/services/index.ts` (po `listGitHistory`, ok. linii 280–300; import `readGitSubjects`)
- Test: `tests/unit/contexts/bc_projects/services.week-review-data.test.ts` (nowy)

- [ ] **Step 1: Napisz test (czerwony)**

Utwórz `tests/unit/contexts/bc_projects/services.week-review-data.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardTask, RegistryEntry } from "@/contexts/bc_projects/models";

const mockReadRegistry = vi.hoisted(() => vi.fn());
const mockReadGitSubjects = vi.hoisted(() => vi.fn());
const mockReadProjectBoard = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/repositories", () => ({
  readRegistry: mockReadRegistry,
  readGitSubjects: mockReadGitSubjects,
  readProjectBoard: mockReadProjectBoard,
}));

import { listDoneTasksInWindow, listGitSubjects } from "@/contexts/bc_projects/services";

const entry = (id: string): RegistryEntry => ({
  id,
  name: id.toUpperCase(),
  status: "active",
  priority: "high",
  folder: `Projects/${id}/`,
  localPath: `~/projects/${id}`,
  owner: "personal",
});

type Columns = Partial<Record<"blockers" | "now" | "next" | "icebox", BoardTask[]>>;
const board = (over: Columns = {}) => ({
  blockers: [],
  now: [],
  next: [],
  icebox: [],
  version: null,
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  mockReadRegistry.mockReturnValue({ entries: [entry("a"), entry("b")], warnings: [] });
});

describe("listGitSubjects", () => {
  it("pyta repozytorium o zakres dat i pomija projekty bez dostępnego repo", () => {
    mockReadGitSubjects.mockImplementation((e: RegistryEntry) =>
      e.id === "b" ? { ok: false } : { ok: true, subjects: ["feat: x", "fix: y"] }
    );
    expect(listGitSubjects("2026-11-10", "2026-11-16")).toEqual([
      { projectId: "a", name: "A", subjects: ["feat: x", "fix: y"] },
    ]);
    expect(mockReadGitSubjects).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a" }),
      "2026-11-10",
      "2026-11-16"
    );
  });

  it("wyjątek z repozytorium jednego projektu nie psuje reszty", () => {
    mockReadGitSubjects.mockImplementation((e: RegistryEntry) => {
      if (e.id === "a") throw new Error("boom");
      return { ok: true, subjects: ["c"] };
    });
    expect(listGitSubjects("2026-11-10", "2026-11-16").map((s) => s.projectId)).toEqual(["b"]);
  });
});

describe("listDoneTasksInWindow", () => {
  const FROM = "2026-11-10";
  const TO = "2026-11-16";

  it("bierze zamknięte zadania z `doneDate` w oknie (granice włącznie) ze wszystkich kolumn", () => {
    mockReadProjectBoard.mockImplementation((e: RegistryEntry) =>
      e.id === "a"
        ? board({
            blockers: [{ text: "z blokerów", done: true, doneDate: "2026-11-10" }],
            now: [{ text: "z teraz", done: true, doneDate: "2026-11-16" }],
            next: [
              { text: "za wcześnie", done: true, doneDate: "2026-11-09" },
              { text: "bez daty", done: true },
              { text: "otwarte", done: false },
            ],
            icebox: [{ text: "z lodówki", done: true, doneDate: "2026-11-12" }],
          })
        : board()
    );
    expect(listDoneTasksInWindow(FROM, TO)).toEqual([
      { projectId: "a", name: "A", tasks: ["z blokerów", "z teraz", "z lodówki"] },
    ]);
  });

  it("wyjątek przy tablicy jednego projektu nie psuje reszty", () => {
    mockReadProjectBoard.mockImplementation((e: RegistryEntry) => {
      if (e.id === "a") throw new Error("boom");
      return board({ now: [{ text: "ok", done: true, doneDate: "2026-11-11" }] });
    });
    expect(listDoneTasksInWindow(FROM, TO).map((d) => d.projectId)).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Uruchom — ma paść**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.week-review-data.test.ts 2>&1 | tail -30`
Expected: FAIL (`listGitSubjects` / `listDoneTasksInWindow` nie istnieją).

- [ ] **Step 3: Implementacja**

`contexts/bc_projects/models.ts`, bezpośrednio po typie `GitHistory`:

```ts
/** Tematy commitów projektu z zakresu dat (najnowsze pierwsze). */
export type GitSubjects = { projectId: string; name: string; subjects: string[] };

/** Zadania `done` projektu z `doneDate` w zakresie dat (kolejność kolumn tablicy). */
export type DoneTasks = { projectId: string; name: string; tasks: string[] };
```

`contexts/bc_projects/repositories/index.ts`: dopisz `commitSubjects` do istniejącego importu z `@/lib/git/project-git` (obok `commitsByDay`, `mergedPrsByDay`) i pod `readGitHistory` dodaj:

```ts
/** Tematy commitów projektu z zakresu `from`–`to` (`RRRR-MM-DD`); brak repo albo błąd gita to `ok: false`. */
export function readGitSubjects(
  entry: RegistryEntry,
  from: string,
  to: string
): { ok: true; subjects: string[] } | { ok: false } {
  const repo = resolveRepoPath(entry.localPath);
  if (repo.ok === false) return { ok: false };
  return commitSubjects(repo.path, from, to);
}
```

`contexts/bc_projects/services/index.ts`: dopisz `readGitSubjects` do listy importów z `../repositories` (obok `readGitHistory`), typy `DoneTasks` i `GitSubjects` do importu typów z `../models`, a pod `listGitHistory` dodaj:

```ts
/**
 * Tematy commitów po projektach (zakres `from`–`to` włącznie) z dostępnym repozytorium.
 * Błąd jednego projektu go pomija; błąd rejestru leci wyżej.
 */
export function listGitSubjects(from: string, to: string): GitSubjects[] {
  const result: GitSubjects[] = [];
  for (const entry of readRegistry().entries) {
    try {
      const res = readGitSubjects(entry, from, to);
      if (res.ok) result.push({ projectId: entry.id, name: entry.name, subjects: res.subjects });
    } catch {
      // jeden zepsuty projekt nie wyłącza pozostałych
    }
  }
  return result;
}

/**
 * Zamknięte zadania (`done` z `doneDate` w `from`–`to` włącznie) ze wszystkich czterech kolumn
 * tablicy projektu. Zadanie bez końcowej daty ` — RRRR-MM-DD` nie ma `doneDate`, więc go nie ma.
 */
export function listDoneTasksInWindow(from: string, to: string): DoneTasks[] {
  const result: DoneTasks[] = [];
  for (const entry of readRegistry().entries) {
    try {
      const board = readProjectBoard(entry);
      const tasks = [...board.blockers, ...board.now, ...board.next, ...board.icebox]
        .filter((t) => t.done && t.doneDate !== undefined && t.doneDate >= from && t.doneDate <= to)
        .map((t) => t.text);
      if (tasks.length > 0) result.push({ projectId: entry.id, name: entry.name, tasks });
    } catch {
      // jeden zepsuty projekt nie wyłącza pozostałych
    }
  }
  return result;
}
```

- [ ] **Step 4: Uruchom — ma przejść, plus sąsiednie testy projektów**

Run: `npx vitest run tests/unit/contexts/bc_projects 2>&1 | tail -30`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_projects tests/unit/contexts/bc_projects/services.week-review-data.test.ts
git commit -m "feat(projects): listGitSubjects i listDoneTasksInWindow dla przeglądu tygodnia" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `bc_cockpit` — modele i `Cockpit/weeks.yaml`

**Files:**

- Modify: `contexts/bc_cockpit/models.ts`
- Modify: `contexts/bc_cockpit/repositories.ts`
- Test: `tests/unit/contexts/bc_cockpit/repositories.test.ts`

- [ ] **Step 1: Modele**

W `contexts/bc_cockpit/models.ts` dopisz na końcu pliku:

```ts
/** Focus tygodnia: jedno zdanie z `Cockpit/weeks.yaml`; `weekStart` to poniedziałek tygodnia ISO (`RRRR-MM-DD`). */
export type WeekFocus = { weekStart: string; text: string };

/** Projekt w przeglądzie tygodnia; dla danych firmy (`work: true`) `subjects` i `doneTasks` są puste. */
export type WeekReviewProject = {
  projectId: string;
  name: string;
  work: boolean;
  commits: number;
  prs: number;
  subjects: string[];
  doneTasks: string[];
};

/** Zamknięcie dnia w przeglądzie; `text: null` dla projektu z danymi firmy. */
export type WeekReviewClosing = { date: string; text: string | null; projectId: string | null };

/** Zestawienie ostatnich 7 dni (`from`–`to`) i gotowy prompt dla agenta (nic nie jest wysyłane). */
export type WeekReview = {
  from: string;
  to: string;
  /** Poniedziałek tygodnia, w którym jest `to`. */
  weekStart: string;
  git: { available: boolean; commits: number; prs: number };
  projects: WeekReviewProject[];
  closings: WeekReviewClosing[];
  reviews: { available: boolean; approved: number; comments: number; prs: number };
  meetings: { count: number; minutes: number };
  /** Jest projekt albo zamknięcie dnia z danymi firmy (do ostrzeżenia przy kopiowaniu). */
  containsWork: boolean;
  prompt: string;
};
```

- [ ] **Step 2: Napisz test repozytorium (czerwony)**

W `tests/unit/contexts/bc_cockpit/repositories.test.ts` dopisz `readWeekFocuses` i `upsertWeekFocus` do importu z `@/contexts/bc_cockpit/repositories` i na końcu pliku dodaj:

```ts
describe("weeks.yaml", () => {
  const WEEKS = "Cockpit/weeks.yaml";

  it("brak pliku to pusta lista", () => {
    expect(readWeekFocuses()).toEqual([]);
  });

  it("zapis i odczyt: jeden rekord na tydzień, rosnąco po week_start", async () => {
    await upsertWeekFocus({ weekStart: "2026-11-16", text: "Domknąć tagi" });
    await upsertWeekFocus({ weekStart: "2026-11-09", text: "Kokpit" });
    await upsertWeekFocus({ weekStart: "2026-11-16", text: "Przegląd tygodnia" });
    expect(readWeekFocuses()).toEqual([
      { weekStart: "2026-11-09", text: "Kokpit" },
      { weekStart: "2026-11-16", text: "Przegląd tygodnia" },
    ]);
  });

  it("pomija wpisy bez poprawnego week_start lub tekstu (ręczna edycja)", () => {
    vault.write(
      WEEKS,
      formatYamlList("weeks", [
        { week_start: "2026-11-16", text: "Dobry" },
        { week_start: "jutro", text: "Zła data" },
        { week_start: "2026-11-09", text: " " },
        { text: "Bez daty" },
      ])
    );
    expect(readWeekFocuses()).toEqual([{ weekStart: "2026-11-16", text: "Dobry" }]);
  });

  it("uszkodzony YAML to błąd (serwis zamienia go na ostrzeżenie)", () => {
    vault.write(WEEKS, "weeks: [unclosed\n");
    expect(() => readWeekFocuses()).toThrow();
  });
});
```

- [ ] **Step 3: Uruchom — ma paść**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/repositories.test.ts 2>&1 | tail -30`
Expected: FAIL (brak eksportów).

- [ ] **Step 4: Implementacja**

W `contexts/bc_cockpit/repositories.ts` dopisz `WeekFocus` do importu typów z `./models` i po `upsertClosing` dodaj:

```ts
const WEEKS_FILE = "Cockpit/weeks.yaml";
const WEEKS_KEY = "weeks";

/** Wpisy rosnąco po `week_start`; wpisy bez poprawnej daty lub tekstu (ręczna edycja) są pomijane. */
export function readWeekFocuses(): WeekFocus[] {
  const result: WeekFocus[] = [];
  for (const item of readList(WEEKS_FILE, WEEKS_KEY)) {
    const weekStart = text(item.week_start);
    const body = text(item.text);
    if (!DAY_RE.test(weekStart) || body === "") continue;
    result.push({ weekStart, text: body });
  }
  return result.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** Jeden wpis na tydzień: ten sam `week_start` nadpisuje poprzedni. Plik, który się nie parsuje, nie jest nadpisywany. */
export async function upsertWeekFocus(focus: WeekFocus): Promise<void> {
  await updateList(WEEKS_FILE, WEEKS_KEY, (items) => {
    const kept = items.filter((i) => text(i.week_start) !== focus.weekStart);
    return [...kept, { week_start: focus.weekStart, text: focus.text }].sort((a, b) =>
      text(a.week_start).localeCompare(text(b.week_start))
    );
  });
}
```

- [ ] **Step 5: Uruchom — ma przejść**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/repositories.test.ts 2>&1 | tail -30`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_cockpit/models.ts contexts/bc_cockpit/repositories.ts tests/unit/contexts/bc_cockpit/repositories.test.ts
git commit -m "feat(cockpit): modele przeglądu tygodnia i Cockpit/weeks.yaml" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `services` — `weekStart`, `setWeekFocus`, `weekFocus` w `getCockpit`

**Files:**

- Modify: `contexts/bc_cockpit/services.ts`
- Modify: `contexts/bc_cockpit/schemas.ts` (`toCockpitDto`, DTO focusu)
- Test: `tests/unit/contexts/bc_cockpit/services.test.ts`, `tests/unit/contexts/bc_cockpit/schemas.test.ts`
- Fixtury: `tests/unit/contexts/bc_cockpit/router.test.ts`, `tests/unit/features/home/HomeView.test.tsx`, `tests/unit/features/home/HomeView.en.test.tsx` (dopisanie `weekFocus: null`)

- [ ] **Step 1: Rozszerz mocki w `services.test.ts`**

W `tests/unit/contexts/bc_cockpit/services.test.ts`:

1. Pod `const mockLoadMyReviews = ...` dodaj:

```ts
const mockReadWeekFocuses = vi.hoisted(() => vi.fn());
const mockUpsertWeekFocus = vi.hoisted(() => vi.fn());
const mockListGitSubjects = vi.hoisted(() => vi.fn());
const mockListDoneTasks = vi.hoisted(() => vi.fn());
```

2. W fabryce `vi.mock("@/contexts/bc_cockpit/repositories", ...)` dopisz:

```ts
  readWeekFocuses: mockReadWeekFocuses,
  upsertWeekFocus: mockUpsertWeekFocus,
```

3. W fabryce `vi.mock("@/contexts/bc_projects/services", ...)` dopisz:

```ts
  listGitSubjects: mockListGitSubjects,
  listDoneTasksInWindow: mockListDoneTasks,
```

4. W `beforeEach`, po `mockUpsertClosing.mockResolvedValue(undefined);`, dopisz:

```ts
mockReadWeekFocuses.mockReturnValue([]);
mockUpsertWeekFocus.mockResolvedValue(undefined);
mockListGitSubjects.mockReturnValue([]);
mockListDoneTasks.mockReturnValue([]);
```

5. Do importu z `@/contexts/bc_cockpit/services` dopisz: `MAX_FOCUS_TEXT`, `setWeekFocus`, `weekStart`.

- [ ] **Step 2: Napisz testy (czerwone)**

Na końcu `services.test.ts` dodaj:

```ts
describe("weekStart", () => {
  it.each([
    ["2026-11-16", "2026-11-16"], // poniedziałek
    ["2026-11-22", "2026-11-16"], // niedziela
    ["2026-11-23", "2026-11-23"], // następny poniedziałek
    ["2027-01-01", "2026-12-28"], // piątek, przez przełom roku
  ])("%s → %s", (day, expected) => {
    expect(weekStart(day)).toBe(expected);
  });
});

describe("setWeekFocus", () => {
  it("zapisuje przycięte zdanie pod poniedziałkiem bieżącego tygodnia", async () => {
    const focus = await setWeekFocus({ text: "  Domknąć   słownik tagów " }, TODAY);
    expect(focus).toEqual({ weekStart: "2026-11-09", text: "Domknąć słownik tagów" });
    expect(mockUpsertWeekFocus).toHaveBeenCalledWith(focus);
  });

  it("pusty tekst i same spacje to DomainError", async () => {
    await expect(setWeekFocus({ text: "" }, TODAY)).rejects.toThrow(DomainError);
    await expect(setWeekFocus({ text: "   " }, TODAY)).rejects.toThrow(DomainError);
    expect(mockUpsertWeekFocus).not.toHaveBeenCalled();
  });

  it("300 znaków przechodzi, 301 to DomainError", async () => {
    expect(MAX_FOCUS_TEXT).toBe(300);
    await expect(setWeekFocus({ text: "a".repeat(300) }, TODAY)).resolves.toBeDefined();
    await expect(setWeekFocus({ text: "a".repeat(301) }, TODAY)).rejects.toThrow(DomainError);
  });
});

describe("getCockpit: weekFocus", () => {
  it("zwraca focus bieżącego tygodnia (TODAY = piątek 2026-11-13, poniedziałek 2026-11-09)", async () => {
    mockReadWeekFocuses.mockReturnValue([
      { weekStart: "2026-11-02", text: "Poprzedni" },
      { weekStart: "2026-11-09", text: "Bieżący" },
    ]);
    const cockpit = await getCockpit(TODAY);
    expect(cockpit.weekFocus).toEqual({ weekStart: "2026-11-09", text: "Bieżący" });
    expect(cockpit.warnings).toEqual([]);
  });

  it("focus z poprzedniego tygodnia nie jest pokazywany", async () => {
    mockReadWeekFocuses.mockReturnValue([{ weekStart: "2026-11-02", text: "Poprzedni" }]);
    expect((await getCockpit(TODAY)).weekFocus).toBeNull();
  });

  it("uszkodzony plik to ostrzeżenie i `null`, nie wyjątek", async () => {
    mockReadWeekFocuses.mockImplementation(() => {
      throw new Error("weeks.yaml: zły YAML");
    });
    const cockpit = await getCockpit(TODAY);
    expect(cockpit.weekFocus).toBeNull();
    expect(cockpit.warnings).toContain("Focus tygodnia: weeks.yaml: zły YAML");
  });
});
```

W `tests/unit/contexts/bc_cockpit/schemas.test.ts`: w obiekcie `model` (przed `warnings: ["uwaga"],`) dopisz `weekFocus: { weekStart: "2026-11-16", text: "Domknąć tagi" },`, a w oczekiwanej liście kluczy `Object.keys(dto).sort()` dopisz `"weekFocus",` między `"warnings"` a `"windows"` (kolejność alfabetyczna po `.sort()`).

W fixturach `router.test.ts`, `HomeView.test.tsx`, `HomeView.en.test.tsx` w każdym literale `Cockpit`/`CockpitDto` (miejsca z `closing: {` ... `warnings`) dopisz `weekFocus: null,` przed `warnings`.

- [ ] **Step 3: Uruchom — ma paść**

Run: `npx vitest run tests/unit/contexts/bc_cockpit 2>&1 | tail -40`
Expected: FAIL (brak `weekStart`, `setWeekFocus`, `MAX_FOCUS_TEXT`, pole `weekFocus`).

- [ ] **Step 4a: Pole `weekFocus` w modelu `Cockpit`**

W `contexts/bc_cockpit/models.ts`, w typie `Cockpit`, tuż przed `warnings: string[];` dodaj linie (zmiana jest w tym zadaniu, a nie w Task 3, żeby każdy commit przechodził `tsc`):

```
  /** Focus bieżącego tygodnia ISO z `Cockpit/weeks.yaml`; `null`, gdy go nie zapisano. */
  weekFocus: WeekFocus | null;
```

- [ ] **Step 4b: Implementacja w `services.ts`**

W `contexts/bc_cockpit/services.ts`: dopisz `type WeekFocus` do importu z `./models`. Pod sekcją „zamknięcie dnia” (po `loadClosing`) dodaj:

```ts
// ── focus tygodnia ─────────────────────────────────────────────────────────────

export const MAX_FOCUS_TEXT = 300;

/** Przesuwa dzień `RRRR-MM-DD` o `delta` dni (kalendarz lokalny, odporne na zmianę czasu). */
function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + delta));
}

/** Poniedziałek tygodnia ISO, w którym jest dzień `RRRR-MM-DD`. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const sinceMonday = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return shiftDay(day, -sinceMonday);
}

function loadWeekFocus(date: string, warnings: string[]): WeekFocus | null {
  try {
    const start = weekStart(date);
    return repositories.readWeekFocuses().find((w) => w.weekStart === start) ?? null;
  } catch (err) {
    warnings.push(`Focus tygodnia: ${reason(err)}`);
    return null;
  }
}
```

W `getCockpit`, po `const closing = loadClosing(date, warnings);` dodaj `const weekFocus = loadWeekFocus(date, warnings);`, a do zwracanego obiektu dopisz `weekFocus,` przed `warnings,`.

Pod `closeDay` dodaj:

```ts
/** Zapisuje focus bieżącego tygodnia ISO (nadpisuje wcześniejszy z tego samego tygodnia). */
export async function setWeekFocus(
  input: { text: string },
  today: Date = new Date()
): Promise<WeekFocus> {
  const text = input.text.replace(/\s+/g, " ").trim();
  if (text === "") throw new DomainError("Wpisz jedno zdanie");
  if (text.length > MAX_FOCUS_TEXT) throw new DomainError(`Maksymalnie ${MAX_FOCUS_TEXT} znaków`);
  const focus: WeekFocus = { weekStart: weekStart(localDate(today)), text };
  await repositories.upsertWeekFocus(focus);
  return focus;
}
```

- [ ] **Step 5: Implementacja w `schemas.ts`**

W `contexts/bc_cockpit/schemas.ts`: dopisz `WeekFocus` do importu typów z `./models`; po `ClosingInputSchema` dodaj:

```ts
/** Limit 300 znaków = `MAX_FOCUS_TEXT` z services (zgodność pilnuje test). */
export const WeekFocusInputSchema = looseObject({
  text: z.string().trim().min(1, "text required").max(300, "Maksymalnie 300 znaków"),
});
```

Pod `export type ClosingDto = Closing;` dodaj `export type WeekFocusDto = WeekFocus;`. W `toCockpitDto`, przed `warnings: [...c.warnings],`, dopisz:

```ts
    weekFocus: c.weekFocus ? toWeekFocusDto(c.weekFocus) : null,
```

Pod `toClosingDto` dodaj:

```ts
export function toWeekFocusDto(w: WeekFocus): WeekFocusDto {
  return { weekStart: w.weekStart, text: w.text };
}
```

- [ ] **Step 6: Uruchom — ma przejść, potem tsc**

Run: `npx vitest run tests/unit/contexts/bc_cockpit tests/unit/features/home 2>&1 | tail -40`
Expected: PASS.
Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: bez błędów (jeśli któraś fixtura `Cockpit` nadal nie ma `weekFocus`, dopisz i powtórz).

- [ ] **Step 7: Commit**

```bash
git add contexts/bc_cockpit tests/unit
git commit -m "feat(cockpit): focus tygodnia (weekStart, setWeekFocus, weekFocus w Kokpicie)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `services` — `getWeekReview` i `composeWeekPrompt`

**Files:**

- Modify: `contexts/bc_cockpit/services.ts`
- Test: `tests/unit/contexts/bc_cockpit/services.test.ts`

- [ ] **Step 1: Napisz testy (czerwone)**

W `services.test.ts` dopisz `composeWeekPrompt`, `getWeekReview`, `MAX_WEEK_SUBJECTS` do importu z `@/contexts/bc_cockpit/services` oraz typ `WeekReview` (`import type { WeekReview } from "@/contexts/bc_cockpit/models";` pod istniejącymi importami). Na końcu pliku dodaj:

```ts
const MONDAY = new Date(2026, 10, 16, 12, 0); // okno 2026-11-10 … 2026-11-16

const meeting = (id: string, date: string, type = "meeting") => ({
  id,
  date,
  start_minutes: 600,
  duration_minutes: 60,
  title: `Spotkanie ${id}`,
  tags: [],
  color: "#fff",
  type,
});

describe("getWeekReview", () => {
  beforeEach(() => {
    mockListProjects.mockReturnValue({
      projects: [
        { id: "monolith", name: "Monolith", owner: "personal", type: undefined },
        { id: "firma", name: "Firma", owner: "work", type: undefined },
      ],
      warnings: [],
    });
    mockListGitHistory.mockReturnValue([
      {
        projectId: "monolith",
        name: "Monolith",
        days: { "2026-11-12": 3, "2026-11-14": 2 },
        prs: { "2026-11-14": 1 },
      },
      { projectId: "firma", name: "Firma", days: { "2026-11-11": 10 }, prs: {} },
    ]);
    mockListGitSubjects.mockReturnValue([
      { projectId: "monolith", name: "Monolith", subjects: ["feat: a", "fix: b"] },
      { projectId: "firma", name: "Firma", subjects: ["tajny temat"] },
    ]);
    mockListDoneTasks.mockReturnValue([
      { projectId: "monolith", name: "Monolith", tasks: ["Zrobione zadanie"] },
      { projectId: "firma", name: "Firma", tasks: ["Tajne zadanie"] },
    ]);
    mockReadClosings.mockReturnValue([
      { date: "2026-11-09", text: "za wcześnie", projectId: null, commits: 1 },
      { date: "2026-11-12", text: "Zaczep Monolith", projectId: "monolith", commits: 2 },
      { date: "2026-11-13", text: "Tajne zamknięcie", projectId: "firma", commits: 1 },
    ]);
    mockGetCalendarEvents.mockResolvedValue([
      meeting("1", "2026-11-11"),
      meeting("2", "2026-11-12"),
      meeting("3", "2026-11-13"),
      meeting("4", "2026-11-13", "work"),
      meeting("5", "2026-11-14", "task_deadline"),
    ]);
    const submittedAt = new Date(2026, 10, 12, 10, 0).toISOString();
    mockLoadMyReviews.mockResolvedValue({
      available: true,
      reviews: [
        { repo: "o/r", number: 1, state: "APPROVED", submittedAt },
        { repo: "o/r", number: 2, state: "COMMENTED", submittedAt },
      ],
    });
  });

  it("zbiera dane z okna 7 dni i liczy sumy", async () => {
    const review = await getWeekReview(MONDAY);
    expect(review.from).toBe("2026-11-10");
    expect(review.to).toBe("2026-11-16");
    expect(review.weekStart).toBe("2026-11-16");
    expect(mockListGitHistory).toHaveBeenCalledWith("2026-11-10", "2026-11-16");
    expect(mockGetCalendarEvents).toHaveBeenCalledWith({
      startDate: "2026-11-10",
      endDate: "2026-11-16",
    });
    expect(review.git).toEqual({ available: true, commits: 15, prs: 1 });
    expect(review.reviews).toEqual({ available: true, approved: 1, comments: 1, prs: 2 });
    expect(review.meetings).toEqual({ count: 3, minutes: 180 });
    expect(review.closings.map((c) => c.date)).toEqual(["2026-11-12", "2026-11-13"]);
  });

  it("projekty: malejąco po commitach; zwykły ma tematy i zadania", async () => {
    const review = await getWeekReview(MONDAY);
    expect(review.projects.map((p) => p.projectId)).toEqual(["firma", "monolith"]);
    expect(review.projects[1]).toEqual({
      projectId: "monolith",
      name: "Monolith",
      work: false,
      commits: 5,
      prs: 1,
      subjects: ["feat: a", "fix: b"],
      doneTasks: ["Zrobione zadanie"],
    });
  });

  it("dane firmy: tylko nazwa i liczby; zamknięcie dnia bez treści; w prompcie nie ma sekretów", async () => {
    const review = await getWeekReview(MONDAY);
    expect(review.projects[0]).toEqual({
      projectId: "firma",
      name: "Firma",
      work: true,
      commits: 10,
      prs: 0,
      subjects: [],
      doneTasks: [],
    });
    expect(review.closings[1]).toEqual({ date: "2026-11-13", text: null, projectId: "firma" });
    expect(review.containsWork).toBe(true);
    expect(review.prompt).toContain("Firma (dane z firmy) — commity: 10, PR: 0");
    expect(review.prompt).toContain("Zaczep Monolith");
    expect(review.prompt).toContain("feat: a");
    expect(review.prompt).toContain("Zrobione zadanie");
    for (const secret of ["tajny temat", "Tajne zadanie", "Tajne zamknięcie"]) {
      expect(review.prompt).not.toContain(secret);
    }
  });

  it("projekt `type: etat` też jest maskowany (hasCompanyData)", async () => {
    mockListProjects.mockReturnValue({
      projects: [
        { id: "monolith", name: "Monolith", owner: "personal", type: "etat" },
        { id: "firma", name: "Firma", owner: "work", type: undefined },
      ],
      warnings: [],
    });
    const review = await getWeekReview(MONDAY);
    const monolith = review.projects.find((p) => p.projectId === "monolith");
    expect(monolith?.work).toBe(true);
    expect(monolith?.subjects).toEqual([]);
    expect(review.prompt).not.toContain("feat: a");
  });

  it("bez gita i gh: sekcje niedostępne, bez wyjątku", async () => {
    mockListGitHistory.mockReturnValue([]);
    mockListGitSubjects.mockReturnValue([]);
    mockListDoneTasks.mockReturnValue([]);
    mockLoadMyReviews.mockResolvedValue({ available: false, reviews: [] });
    const review = await getWeekReview(MONDAY);
    expect(review.git).toEqual({ available: false, commits: 0, prs: 0 });
    expect(review.reviews.available).toBe(false);
    expect(review.projects).toEqual([]);
    expect(review.prompt).toContain("Dane z gita niedostępne.");
    expect(review.prompt).not.toContain("## Review");
  });

  it("awaria zamknięć dnia albo kalendarza nie przerywa przeglądu", async () => {
    mockReadClosings.mockImplementation(() => {
      throw new Error("closing.yaml");
    });
    mockGetCalendarEvents.mockRejectedValue(new Error("kalendarz"));
    const review = await getWeekReview(MONDAY);
    expect(review.closings).toEqual([]);
    expect(review.meetings).toEqual({ count: 0, minutes: 0 });
  });
});

describe("composeWeekPrompt", () => {
  const base = (over: Partial<Omit<WeekReview, "prompt">> = {}): Omit<WeekReview, "prompt"> => ({
    from: "2026-11-10",
    to: "2026-11-16",
    weekStart: "2026-11-16",
    git: { available: true, commits: 20, prs: 0 },
    projects: [],
    closings: [],
    reviews: { available: false, approved: 0, comments: 0, prs: 0 },
    meetings: { count: 0, minutes: 0 },
    containsWork: false,
    ...over,
  });

  it("nagłówek i instrukcja dla agenta", () => {
    const prompt = composeWeekPrompt(base());
    expect(prompt).toContain("# Przegląd tygodnia 2026-11-10 – 2026-11-16");
    expect(prompt).toContain("Zaproponuj 1–3 tematy focusu na tydzień od 2026-11-16");
  });

  it("20 tematów commitów: wypisuje 15 i „… i 5 więcej”", () => {
    const subjects = Array.from({ length: 20 }, (_, i) => `temat ${i + 1}`);
    const prompt = composeWeekPrompt(
      base({
        projects: [
          {
            projectId: "m",
            name: "Monolith",
            work: false,
            commits: 20,
            prs: 2,
            subjects,
            doneTasks: [],
          },
        ],
      })
    );
    expect(MAX_WEEK_SUBJECTS).toBe(15);
    expect(prompt).toContain("- Monolith — commity: 20, PR: 2");
    expect(prompt).toContain("  - temat 15");
    expect(prompt).not.toContain("  - temat 16");
    expect(prompt).toContain("  - … i 5 więcej");
  });

  it("sekcje bez danych są pomijane, z danymi pojawiają się w kolejności", () => {
    const empty = composeWeekPrompt(base());
    for (const heading of [
      "## Zamknięte zadania",
      "## Zamknięcia dnia",
      "## Review",
      "## Spotkania",
    ]) {
      expect(empty).not.toContain(heading);
    }
    expect(empty).not.toContain("Uwaga:");
    const full = composeWeekPrompt(
      base({
        projects: [
          {
            projectId: "m",
            name: "M",
            work: false,
            commits: 1,
            prs: 0,
            subjects: [],
            doneTasks: ["Z1"],
          },
        ],
        closings: [
          { date: "2026-11-12", text: "Zaczep", projectId: null },
          { date: "2026-11-13", text: null, projectId: "f" },
        ],
        reviews: { available: true, approved: 2, comments: 1, prs: 3 },
        meetings: { count: 2, minutes: 90 },
        containsWork: true,
      })
    );
    const order = [
      "## Commity i PR-y",
      "## Zamknięte zadania (przybliżenie)",
      "## Zamknięcia dnia",
      "## Review",
      "## Spotkania",
      "Uwaga:",
    ].map((h) => full.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(full).toContain("- 2026-11-12: Zaczep");
    expect(full).toContain("- 2026-11-13: (dane z firmy, treść pominięta)");
    expect(full).toContain("Zatwierdzone: 2, komentarze: 1, PR-y: 3");
    expect(full).toContain("Spotkań: 2, łącznie 90 min");
  });
});
```

- [ ] **Step 2: Uruchom — ma paść**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/services.test.ts 2>&1 | tail -40`
Expected: FAIL (brak `getWeekReview`, `composeWeekPrompt`, `MAX_WEEK_SUBJECTS`).

- [ ] **Step 3: Implementacja**

W `contexts/bc_cockpit/services.ts` dopisz do importu typów z `./models`: `type WeekReview`, `type WeekReviewClosing`, `type WeekReviewProject`. Na końcu pliku (po sekcji „prośby o review”, przed `withEnergy` albo na samym końcu) dodaj:

```ts
// ── przegląd tygodnia ──────────────────────────────────────────────────────────

export const WEEK_REVIEW_DAYS = 7;
export const MAX_WEEK_SUBJECTS = 15;

/**
 * Prompt dla agenta (Markdown, zawsze po polsku). Sekcje bez danych są pomijane. Nic nie jest
 * wysyłane: tekst trafia do schowka użytkownika. Dane firmy są tu już zamaskowane przez `getWeekReview`.
 */
export function composeWeekPrompt(r: Omit<WeekReview, "prompt">): string {
  const head = [
    `# Przegląd tygodnia ${r.from} – ${r.to}`,
    "",
    "Zrób retrospektywę: co zostało domknięte, co wisi bez ruchu, na czym straciłem czas.",
    `Zaproponuj 1–3 tematy focusu na tydzień od ${r.weekStart} (jedno zdanie każdy).`,
    "Dane pochodzą z mojego vaulta i gita; lista zamkniętych zadań to przybliżenie (liczą się tylko wpisy z datą na końcu).",
  ];
  const sections: string[][] = [];

  const commits = ["## Commity i PR-y"];
  const active = r.projects.filter((p) => p.commits > 0 || p.prs > 0);
  if (!r.git.available) commits.push("Dane z gita niedostępne.");
  else if (active.length === 0) commits.push("Brak commitów w tym oknie.");
  for (const p of active) {
    commits.push(
      `- ${p.name}${p.work ? " (dane z firmy)" : ""} — commity: ${p.commits}, PR: ${p.prs}`
    );
    const shown = p.subjects.slice(0, MAX_WEEK_SUBJECTS);
    for (const subject of shown) commits.push(`  - ${subject}`);
    if (p.subjects.length > shown.length) {
      commits.push(`  - … i ${p.subjects.length - shown.length} więcej`);
    }
  }
  sections.push(commits);

  const done = r.projects.filter((p) => p.doneTasks.length > 0);
  if (done.length > 0) {
    const lines = ["## Zamknięte zadania (przybliżenie)"];
    for (const p of done) {
      lines.push(`- ${p.name}`);
      for (const task of p.doneTasks) lines.push(`  - ${task}`);
    }
    sections.push(lines);
  }

  if (r.closings.length > 0) {
    sections.push([
      "## Zamknięcia dnia",
      ...r.closings.map((c) => `- ${c.date}: ${c.text ?? "(dane z firmy, treść pominięta)"}`),
    ]);
  }

  if (r.reviews.available) {
    sections.push([
      "## Review",
      `Zatwierdzone: ${r.reviews.approved}, komentarze: ${r.reviews.comments}, PR-y: ${r.reviews.prs}`,
    ]);
  }

  if (r.meetings.count > 0) {
    sections.push([
      "## Spotkania",
      `Spotkań: ${r.meetings.count}, łącznie ${r.meetings.minutes} min`,
    ]);
  }

  if (r.containsWork) sections.push(["Uwaga: projekty z danymi firmy są tylko jako liczby."]);

  return [head.join("\n"), ...sections.map((s) => s.join("\n"))].join("\n\n");
}

/**
 * Zestawienie ostatnich 7 dni (łącznie z dziś) i prompt dla agenta. Każde źródło osobno: brak gita,
 * `gh`, kalendarza albo zamknięć dnia daje pustą sekcję, nie wyjątek (błąd rejestru projektów leci wyżej).
 * Projekty z danymi firmy (`hasCompanyData`) trafiają tylko jako nazwa i liczby.
 */
export async function getWeekReview(today: Date = new Date()): Promise<WeekReview> {
  const to = localDate(today);
  const from = shiftDay(to, -(WEEK_REVIEW_DAYS - 1));
  const company = new Map(
    projectsServices
      .listProjects()
      .projects.map((p) => [p.id, projectsServices.hasCompanyData(p.owner, p.type)] as const)
  );
  const isCompany = (id: string | null) => id !== null && company.get(id) === true;

  const history = projectsServices.listGitHistory(from, to);
  const sum = (record: Record<string, number>) =>
    Object.values(record).reduce((total, n) => total + n, 0);
  const rows = new Map<string, WeekReviewProject>();
  const ensure = (projectId: string, name: string): WeekReviewProject => {
    let row = rows.get(projectId);
    if (!row) {
      row = {
        projectId,
        name,
        work: isCompany(projectId),
        commits: 0,
        prs: 0,
        subjects: [],
        doneTasks: [],
      };
      rows.set(projectId, row);
    }
    return row;
  };
  for (const h of history) {
    const commits = sum(h.days);
    const prs = sum(h.prs);
    if (commits === 0 && prs === 0) continue;
    const row = ensure(h.projectId, h.name);
    row.commits = commits;
    row.prs = prs;
  }
  for (const s of projectsServices.listGitSubjects(from, to)) {
    const row = rows.get(s.projectId);
    if (row && !row.work) row.subjects = s.subjects;
  }
  for (const d of projectsServices.listDoneTasksInWindow(from, to)) {
    if (isCompany(d.projectId) || d.tasks.length === 0) continue;
    ensure(d.projectId, d.name).doneTasks = d.tasks;
  }
  const projects = [...rows.values()].sort(
    (a, b) => b.commits - a.commits || a.name.localeCompare(b.name, "pl")
  );

  let closings: WeekReviewClosing[] = [];
  try {
    closings = repositories
      .readClosings()
      .filter((c) => c.date >= from && c.date <= to)
      .map((c) => ({
        date: c.date,
        text: isCompany(c.projectId) ? null : c.text,
        projectId: c.projectId,
      }));
  } catch {
    closings = [];
  }

  let meetings = { count: 0, minutes: 0 };
  try {
    const entries = await calendarServices.getCalendarEvents({ startDate: from, endDate: to });
    const own = entries.filter((e) => e.type === "meeting" && e.date >= from && e.date <= to);
    meetings = {
      count: own.length,
      minutes: own.reduce((total, e) => total + e.duration_minutes, 0),
    };
  } catch {
    meetings = { count: 0, minutes: 0 };
  }

  const reviewHistory = await getReviewHistory(WEEK_REVIEW_DAYS, today);

  const review: Omit<WeekReview, "prompt"> = {
    from,
    to,
    weekStart: weekStart(to),
    git: {
      available: history.length > 0,
      commits: projects.reduce((total, p) => total + p.commits, 0),
      prs: projects.reduce((total, p) => total + p.prs, 0),
    },
    projects,
    closings,
    reviews: {
      available: reviewHistory.available,
      approved: reviewHistory.approved,
      comments: reviewHistory.comments,
      prs: reviewHistory.prs,
    },
    meetings,
    containsWork: projects.some((p) => p.work) || closings.some((c) => c.text === null),
  };
  return { ...review, prompt: composeWeekPrompt(review) };
}
```

- [ ] **Step 4: Uruchom — ma przejść**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/services.test.ts 2>&1 | tail -40`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_cockpit/services.ts tests/unit/contexts/bc_cockpit/services.test.ts
git commit -m "feat(cockpit): getWeekReview i prompt dla agenta (dane firmy tylko jako liczby)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: schematy, router i trasy

**Files:**

- Modify: `contexts/bc_cockpit/schemas.ts`, `contexts/bc_cockpit/router.ts`
- Create: `app/api/cockpit/week-review/route.ts`, `app/api/cockpit/week-focus/route.ts`
- Test: `tests/unit/contexts/bc_cockpit/schemas.test.ts`, `tests/unit/contexts/bc_cockpit/router.test.ts`

- [ ] **Step 1: Napisz testy (czerwone)**

`schemas.test.ts`: dopisz `WeekFocusInputSchema`, `toWeekReviewDto` do importu ze `@/contexts/bc_cockpit/schemas` i `MAX_FOCUS_TEXT` do importu z `@/contexts/bc_cockpit/services` (dodaj ten import, jeśli pliku nie ma; test nie mockuje services, a import jest tylko stałej). Dopisz:

```ts
describe("WeekFocusInputSchema", () => {
  it("limit znaków zgadza się z MAX_FOCUS_TEXT", () => {
    expect(WeekFocusInputSchema.safeParse({ text: "a".repeat(MAX_FOCUS_TEXT) }).success).toBe(true);
    expect(WeekFocusInputSchema.safeParse({ text: "a".repeat(MAX_FOCUS_TEXT + 1) }).success).toBe(
      false
    );
  });

  it("pusty tekst i brak pola to błąd; spacje są przycinane", () => {
    expect(WeekFocusInputSchema.safeParse({ text: "   " }).success).toBe(false);
    expect(WeekFocusInputSchema.safeParse({}).success).toBe(false);
    const ok = WeekFocusInputSchema.safeParse({ text: "  Tagi " });
    expect(ok.success && ok.data.text).toBe("Tagi");
  });
});

describe("toWeekReviewDto", () => {
  it("kopiuje kształt i nie wpuszcza dodatkowych pól", () => {
    const review = {
      from: "2026-11-10",
      to: "2026-11-16",
      weekStart: "2026-11-16",
      git: { available: true, commits: 5, prs: 1 },
      projects: [
        {
          projectId: "m",
          name: "Monolith",
          work: false,
          commits: 5,
          prs: 1,
          subjects: ["feat: a"],
          doneTasks: ["Z"],
        },
      ],
      closings: [{ date: "2026-11-12", text: null, projectId: "f" }],
      reviews: { available: true, approved: 1, comments: 2, prs: 3 },
      meetings: { count: 2, minutes: 90 },
      containsWork: true,
      prompt: "# P",
    };
    expect(toWeekReviewDto({ ...review, extra: "x" } as typeof review)).toEqual(review);
  });
});
```

`router.test.ts`: w fabryce mocka services dopisz `getWeekReview: mockGetWeekReview, setWeekFocus: mockSetWeekFocus,` (z odpowiednimi `vi.hoisted(() => vi.fn())` pod istniejącymi), do importu z routera dopisz `getWeekReview, putWeekFocus` (alias, np. `getWeekReview as getWeekReviewRoute`, jeśli koliduje z mockiem — mocki mają prefiks `mock`, więc nazwy nie kolidują) i dodaj:

```ts
describe("getWeekReview", () => {
  it("200 z zestawieniem", async () => {
    mockGetWeekReview.mockResolvedValue({
      from: "2026-11-10",
      to: "2026-11-16",
      weekStart: "2026-11-16",
      git: { available: false, commits: 0, prs: 0 },
      projects: [],
      closings: [],
      reviews: { available: false, approved: 0, comments: 0, prs: 0 },
      meetings: { count: 0, minutes: 0 },
      containsWork: false,
      prompt: "# P",
    });
    const res = await getWeekReview();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.git.available).toBe(false);
    expect(body.prompt).toBe("# P");
  });

  it("błąd serwisu przechodzi przez handleServiceError", async () => {
    mockGetWeekReview.mockRejectedValue(new ConflictError("x"));
    expect((await getWeekReview()).status).toBe(409);
  });
});

describe("putWeekFocus", () => {
  it("zapisuje focus i zwraca go", async () => {
    mockSetWeekFocus.mockResolvedValue({ weekStart: "2026-11-16", text: "Tagi" });
    const res = await putWeekFocus(put({ text: "Tagi" }));
    expect(res.status).toBe(200);
    expect(mockSetWeekFocus).toHaveBeenCalledWith({ text: "Tagi" });
    expect(await res.json()).toEqual({ weekStart: "2026-11-16", text: "Tagi" });
  });

  it("puste ciało i pusty tekst to 400", async () => {
    expect((await putWeekFocus(put({}))).status).toBe(400);
    expect((await putWeekFocus(put({ text: "  " }))).status).toBe(400);
    expect(mockSetWeekFocus).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Uruchom — ma paść**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/schemas.test.ts tests/unit/contexts/bc_cockpit/router.test.ts 2>&1 | tail -40`
Expected: FAIL.

- [ ] **Step 3: Implementacja `schemas.ts`**

Dopisz `WeekReview` do importu typów z `./models`. Pod `export type WeekFocusDto = WeekFocus;` dodaj `export type WeekReviewDto = WeekReview;`. Na końcu pliku:

```ts
export function toWeekReviewDto(r: WeekReview): WeekReviewDto {
  return {
    from: r.from,
    to: r.to,
    weekStart: r.weekStart,
    git: { available: r.git.available, commits: r.git.commits, prs: r.git.prs },
    projects: r.projects.map((p) => ({
      projectId: p.projectId,
      name: p.name,
      work: p.work,
      commits: p.commits,
      prs: p.prs,
      subjects: [...p.subjects],
      doneTasks: [...p.doneTasks],
    })),
    closings: r.closings.map((c) => ({ date: c.date, text: c.text, projectId: c.projectId })),
    reviews: {
      available: r.reviews.available,
      approved: r.reviews.approved,
      comments: r.reviews.comments,
      prs: r.reviews.prs,
    },
    meetings: { count: r.meetings.count, minutes: r.meetings.minutes },
    containsWork: r.containsWork,
    prompt: r.prompt,
  };
}
```

- [ ] **Step 4: Implementacja `router.ts`**

Dopisz `WeekFocusInputSchema`, `toWeekFocusDto`, `toWeekReviewDto` do importu z `./schemas`. Pod `putClosing` dodaj:

```ts
export async function getWeekReview(): Promise<NextResponse> {
  try {
    return NextResponse.json(toWeekReviewDto(await services.getWeekReview()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putWeekFocus(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, WeekFocusInputSchema, { details: false });
  if (parsed.success === false) return parsed.response;
  try {
    const focus = await services.setWeekFocus({ text: parsed.data.text });
    return NextResponse.json(toWeekFocusDto(focus));
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 5: Trasy**

`app/api/cockpit/week-review/route.ts`:

```ts
export { getWeekReview as GET } from "@/contexts/bc_cockpit/router";

export const dynamic = "force-dynamic";
```

`app/api/cockpit/week-focus/route.ts`:

```ts
export { putWeekFocus as PUT } from "@/contexts/bc_cockpit/router";

export const dynamic = "force-dynamic";
```

- [ ] **Step 6: Uruchom — ma przejść, plus test architektury i middleware**

Run: `npx vitest run tests/unit/contexts/bc_cockpit tests/unit/architecture.static.test.ts tests/unit/middleware.test.ts 2>&1 | tail -40`
Expected: PASS (bez zmian w teście architektury).

- [ ] **Step 7: Commit**

```bash
git add contexts/bc_cockpit app/api/cockpit tests/unit/contexts/bc_cockpit
git commit -m "feat(cockpit): trasy week-review i week-focus" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: i18n (PL i EN)

**Files:**

- Modify: `src/i18n/locales/pl/home.ts`, `src/i18n/locales/en/home.ts`
- Test: istniejący test parytetu kluczy (`tests/unit/i18n/`), bez nowego pliku

- [ ] **Step 1: Klucze PL**

W `src/i18n/locales/pl/home.ts`, obok sekcji `reviewHistory`, dodaj:

```ts
  weekReview: {
    aria: "Przegląd tygodnia",
    title: "Przegląd tygodnia",
    show: "Pokaż",
    hide: "Ukryj",
    loading: "Wczytuję…",
    error: "Nie udało się wczytać przeglądu",
    gitUnavailable: "Dane z gita niedostępne",
    noActivity: "Brak commitów w tym oknie",
    companyData: "Dane z firmy",
    projectLine: "commity {{commits}} · PR {{prs}}",
    doneTasks: "zamknięte zadania: {{count}}",
    closingsTitle: "Zamknięcia dnia",
    closingHidden: "treść pominięta (dane z firmy)",
    reviews: "Review: zatwierdzone {{approved}}, komentarze {{comments}}, PR {{prs}}",
    meetings: "Spotkania: {{count}} ({{minutes}} min)",
    copyPrompt: "Kopiuj prompt dla agenta",
    copyOk: "Skopiowano",
    copyError: "Nie udało się skopiować",
    workWarning: "Dane z firmy: sprawdź, gdzie wklejasz.",
    focusLabel: "Focus na ten tydzień",
    focusPlaceholder: "Jedno zdanie",
    focusSave: "Zapisz",
    saveFailed: "Nie udało się zapisać",
    changeActive: "Zmień aktywne tematy",
    focusLine: "Focus tygodnia: {{text}}",
  },
```

- [ ] **Step 2: Klucze EN**

W `src/i18n/locales/en/home.ts` w tym samym miejscu:

```ts
  weekReview: {
    aria: "Week review",
    title: "Week review",
    show: "Show",
    hide: "Hide",
    loading: "Loading…",
    error: "Could not load the review",
    gitUnavailable: "Git data unavailable",
    noActivity: "No commits in this window",
    companyData: "Company data",
    projectLine: "commits {{commits}} · PRs {{prs}}",
    doneTasks: "closed tasks: {{count}}",
    closingsTitle: "Day closings",
    closingHidden: "text hidden (company data)",
    reviews: "Reviews: approved {{approved}}, comments {{comments}}, PRs {{prs}}",
    meetings: "Meetings: {{count}} ({{minutes}} min)",
    copyPrompt: "Copy prompt for agent",
    copyOk: "Copied",
    copyError: "Could not copy",
    workWarning: "Company data: check where you paste it.",
    focusLabel: "Focus for this week",
    focusPlaceholder: "One sentence",
    focusSave: "Save",
    saveFailed: "Could not save",
    changeActive: "Change active topics",
    focusLine: "Week focus: {{text}}",
  },
```

- [ ] **Step 3: Uruchom test parytetu**

Run: `npx vitest run tests/unit/i18n 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales
git commit -m "feat(i18n): teksty panelu Przegląd tygodnia (PL, EN)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: UI — panel `WeekReview`, linia focusu, podpięcie

**Files:**

- Create: `src/features/home/WeekReview.tsx`
- Modify: `src/features/home/CockpitSections.tsx`, `src/features/home/HomeView.tsx`, `src/features/home/home.css`
- Test: `tests/unit/features/home/WeekReview.test.tsx`, `tests/unit/features/home/WeekReview.en.test.tsx`, `tests/unit/features/home/HomeView.test.tsx`

- [ ] **Step 1: Napisz testy panelu (czerwone)**

`tests/unit/features/home/WeekReview.test.tsx`:

```tsx
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { WeekReview } from "@/src/features/home/WeekReview";
import type { WeekReviewDto } from "@/contexts/bc_cockpit/schemas";

const REVIEW: WeekReviewDto = {
  from: "2026-11-10",
  to: "2026-11-16",
  weekStart: "2026-11-16",
  git: { available: true, commits: 15, prs: 1 },
  projects: [
    {
      projectId: "monolith",
      name: "Monolith",
      work: false,
      commits: 5,
      prs: 1,
      subjects: ["feat: a"],
      doneTasks: ["Z"],
    },
  ],
  closings: [{ date: "2026-11-12", text: "Zaczep Monolith", projectId: "monolith" }],
  reviews: { available: true, approved: 1, comments: 1, prs: 2 },
  meetings: { count: 3, minutes: 180 },
  containsWork: false,
  prompt: "# Przegląd tygodnia 2026-11-10 – 2026-11-16",
};

const ok = (body: unknown) => ({ ok: true, json: async () => body });

const mount = (over: Partial<React.ComponentProps<typeof WeekReview>> = {}) => {
  const props = {
    apiFetch: vi.fn().mockResolvedValue(ok(REVIEW)),
    focus: null,
    onChangeActive: vi.fn(),
    onFocusSaved: vi.fn(),
    ...over,
  };
  render(<WeekReview {...props} />);
  return props;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WeekReview", () => {
  test("zwinięty panel nie pobiera danych; rozwinięcie pobiera raz", async () => {
    const { apiFetch } = mount();
    expect(screen.getByText("Przegląd tygodnia")).toBeTruthy();
    expect(apiFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(await screen.findByText("Monolith")).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith("/api/cockpit/week-review");
    fireEvent.click(screen.getByRole("button", { name: "Ukryj" }));
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  test("pokazuje projekty, zamknięcia dnia, review i spotkania", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(await screen.findByText("commity 5 · PR 1")).toBeTruthy();
    expect(screen.getByText("Zaczep Monolith", { exact: false })).toBeTruthy();
    expect(screen.getByText("Review: zatwierdzone 1, komentarze 1, PR 2")).toBeTruthy();
    expect(screen.getByText("Spotkania: 3 (180 min)")).toBeTruthy();
  });

  test("ostrzeżenie o danych firmy tylko przy containsWork", async () => {
    const first = mount();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    await screen.findByText("Monolith");
    expect(screen.queryByText("Dane z firmy: sprawdź, gdzie wklejasz.")).toBeNull();
    cleanup();
    first.apiFetch.mockResolvedValue(
      ok({
        ...REVIEW,
        containsWork: true,
        projects: [
          { ...REVIEW.projects[0], name: "Firma", work: true, subjects: [], doneTasks: [] },
        ],
      })
    );
    render(<WeekReview {...first} />);
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(await screen.findByText("Dane z firmy: sprawdź, gdzie wklejasz.")).toBeTruthy();
  });

  test("„Kopiuj prompt dla agenta” kopiuje prompt do schowka", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    fireEvent.click(await screen.findByRole("button", { name: "Kopiuj prompt dla agenta" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(REVIEW.prompt));
    expect(await screen.findByText("Skopiowano")).toBeTruthy();
  });

  test("zapis focusu wysyła PUT i woła onFocusSaved; pole jest wstępnie wypełnione", async () => {
    const apiFetch = vi.fn((url: string) =>
      Promise.resolve(url === "/api/cockpit/week-focus" ? ok({}) : ok(REVIEW))
    );
    const { onFocusSaved } = mount({
      apiFetch,
      focus: { weekStart: "2026-11-16", text: "Stary focus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    const input = (await screen.findByLabelText("Focus na ten tydzień")) as HTMLInputElement;
    expect(input.value).toBe("Stary focus");
    fireEvent.change(input, { target: { value: "Domknąć słownik tagów" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(onFocusSaved).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith("/api/cockpit/week-focus", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Domknąć słownik tagów" }),
    });
  });

  test("pusty focus blokuje „Zapisz”; błąd zapisu pokazuje komunikat", async () => {
    const apiFetch = vi.fn((url: string) =>
      Promise.resolve(
        url === "/api/cockpit/week-focus"
          ? { ok: false, status: 500, json: async () => ({}) }
          : ok(REVIEW)
      )
    );
    const { onFocusSaved } = mount({ apiFetch });
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    const save = (await screen.findByRole("button", { name: "Zapisz" })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Focus na ten tydzień"), { target: { value: "X" } });
    fireEvent.click(save);
    expect(await screen.findByText("Nie udało się zapisać")).toBeTruthy();
    expect(onFocusSaved).not.toHaveBeenCalled();
  });

  test("„Zmień aktywne tematy” woła onChangeActive", async () => {
    const { onChangeActive } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    fireEvent.click(await screen.findByRole("button", { name: "Zmień aktywne tematy" }));
    expect(onChangeActive).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["HTTP 500", () => ({ ok: false, status: 500, json: async () => ({}) })],
    ["odpowiedź bez projects", () => ok({ git: {} })],
  ])("błąd pobierania: %s pokazuje komunikat", async (_name, response) => {
    mount({ apiFetch: vi.fn().mockResolvedValue(response()) });
    fireEvent.click(screen.getByRole("button", { name: "Pokaż" }));
    expect(await screen.findByText("Nie udało się wczytać przeglądu")).toBeTruthy();
  });
});
```

`tests/unit/features/home/WeekReview.en.test.tsx`:

```tsx
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { setLanguage } from "@/src/i18n";
import { WeekReview } from "@/src/features/home/WeekReview";

const REVIEW = {
  from: "2026-11-10",
  to: "2026-11-16",
  weekStart: "2026-11-16",
  git: { available: true, commits: 5, prs: 1 },
  projects: [
    {
      projectId: "m",
      name: "Monolith",
      work: false,
      commits: 5,
      prs: 1,
      subjects: [],
      doneTasks: [],
    },
  ],
  closings: [],
  reviews: { available: true, approved: 1, comments: 1, prs: 2 },
  meetings: { count: 3, minutes: 180 },
  containsWork: false,
  prompt: "# P",
};

describe("WeekReview po angielsku", () => {
  afterEach(async () => {
    cleanup();
    await act(async () => {
      await setLanguage("pl");
    });
  });

  test("tytuł, przyciski i podsumowania po angielsku", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const apiFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => REVIEW });
    render(
      <WeekReview
        apiFetch={apiFetch}
        focus={null}
        onChangeActive={vi.fn()}
        onFocusSaved={vi.fn()}
      />
    );
    expect(screen.getByText("Week review")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(await screen.findByText("commits 5 · PRs 1")).toBeTruthy();
    expect(screen.getByText("Reviews: approved 1, comments 1, PRs 2")).toBeTruthy();
    expect(screen.getByText("Meetings: 3 (180 min)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy prompt for agent" })).toBeTruthy();
    expect(screen.getByLabelText("Focus for this week")).toBeTruthy();
  });
});
```

Test `HomeView.test.tsx` — dopisz na końcu pliku:

```tsx
test("pokazuje focus tygodnia u góry Kokpitu; bez focusu nie ma linii", async () => {
  respond({ ...EMPTY, weekFocus: { weekStart: "2026-11-09", text: "Domknąć słownik tagów" } });
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("Focus tygodnia: Domknąć słownik tagów")).toBeInTheDocument();
  cleanup();
  respond(EMPTY);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("Przypnij projekty");
  expect(screen.queryByText(/Focus tygodnia:/)).toBeNull();
});

test("panel Przegląd tygodnia jest w Kokpicie, zwinięty, i nie pobiera danych", async () => {
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByRole("button", { name: "Pokaż" })).toBeInTheDocument();
  expect(mockApiFetch).not.toHaveBeenCalledWith("/api/cockpit/week-review");
});
```

(Uwaga: w `HomeView` może być więcej przycisków „Pokaż”; jeśli `findByRole` zgłosi wiele dopasowań, zawęź do `within(screen.getByRole("region", { name: "Przegląd tygodnia" }))` — sekcja ma `aria-label`.)

- [ ] **Step 2: Uruchom — ma paść**

Run: `npx vitest run tests/unit/features/home/WeekReview.test.tsx tests/unit/features/home/WeekReview.en.test.tsx tests/unit/features/home/HomeView.test.tsx 2>&1 | tail -40`
Expected: FAIL (brak komponentu).

- [ ] **Step 3: Komponent**

`src/features/home/WeekReview.tsx`:

```tsx
import React, { useEffect, useRef, useState } from "react";
import type { WeekFocusDto, WeekReviewDto } from "@/contexts/bc_cockpit/schemas";
import { useT } from "@/src/i18n/useT";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;
type CopyState = "idle" | "ok" | "error";

/** Zgodne z `MAX_FOCUS_TEXT` w services (UI nie importuje wartości z kontekstu poza schemas). */
const MAX_FOCUS = 300;

/**
 * Przegląd ostatnich 7 dni: zestawienie, przycisk kopiujący prompt dla agenta i focus tygodnia.
 * Zwinięty nie pobiera danych; aplikacja niczego nie wysyła do modelu.
 */
export function WeekReview({
  apiFetch,
  focus,
  onChangeActive,
  onFocusSaved,
}: {
  apiFetch: ApiFetch;
  focus: WeekFocusDto | null;
  onChangeActive: () => void;
  onFocusSaved: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<WeekReviewDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [copy, setCopy] = useState<CopyState>("idle");
  const [text, setText] = useState(focus?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    apiFetch("/api/cockpit/week-review")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: WeekReviewDto) => {
        if (data && Array.isArray(data.projects)) setReview(data);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [open, apiFetch]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copyPrompt = async () => {
    if (!review) return;
    try {
      await navigator.clipboard.writeText(review.prompt);
      setCopy("ok");
    } catch {
      setCopy("error");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopy("idle"), 2000);
  };

  const trimmed = text.trim();
  const saveFocus = async () => {
    setSaving(true);
    setSaveFailed(false);
    try {
      const res = await apiFetch("/api/cockpit/week-focus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onFocusSaved();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="kok-panel kok-week" aria-label={t("home:weekReview.aria")}>
      <div className="kok-panel__head">
        <h3 className="kok-panel__title">
          <b>{t("home:weekReview.title")}</b>
        </h3>
        <div className="kok-panel__tools">
          <button
            type="button"
            className="kok-btn kok-btn--sm"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t("home:weekReview.hide") : t("home:weekReview.show")}
          </button>
        </div>
      </div>

      {open ? (
        <div className="kok-week__body">
          {failed ? (
            <p className="kok-state kok-state--error">{t("home:weekReview.error")}</p>
          ) : review === null ? (
            <p className="kok-state">{t("home:weekReview.loading")}</p>
          ) : (
            <>
              {!review.git.available ? (
                <p className="kok-empty-msg">{t("home:weekReview.gitUnavailable")}</p>
              ) : review.projects.length === 0 ? (
                <p className="kok-empty-msg">{t("home:weekReview.noActivity")}</p>
              ) : (
                <ul className="kok-week__list">
                  {review.projects.map((p) => (
                    <li key={p.projectId} className="kok-week__row">
                      <span className="kok-week__name">{p.name}</span>
                      {p.work ? (
                        <span className="kok-chip">{t("home:weekReview.companyData")}</span>
                      ) : null}
                      <span className="kok-week__meta">
                        {t("home:weekReview.projectLine", { commits: p.commits, prs: p.prs })}
                      </span>
                      {p.doneTasks.length > 0 ? (
                        <span className="kok-week__meta">
                          {t("home:weekReview.doneTasks", { count: p.doneTasks.length })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {review.closings.length > 0 ? (
                <>
                  <h4 className="kok-week__sub">{t("home:weekReview.closingsTitle")}</h4>
                  <ul className="kok-week__list">
                    {review.closings.map((c) => (
                      <li key={c.date}>
                        {c.date}: {c.text ?? t("home:weekReview.closingHidden")}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {review.reviews.available ? (
                <p className="kok-week__line">
                  {t("home:weekReview.reviews", {
                    approved: review.reviews.approved,
                    comments: review.reviews.comments,
                    prs: review.reviews.prs,
                  })}
                </p>
              ) : null}
              {review.meetings.count > 0 ? (
                <p className="kok-week__line">
                  {t("home:weekReview.meetings", {
                    count: review.meetings.count,
                    minutes: review.meetings.minutes,
                  })}
                </p>
              ) : null}

              <div className="kok-week__actions">
                <button type="button" className="kok-btn kok-btn--sm" onClick={copyPrompt}>
                  {copy === "ok"
                    ? t("home:weekReview.copyOk")
                    : copy === "error"
                      ? t("home:weekReview.copyError")
                      : t("home:weekReview.copyPrompt")}
                </button>
              </div>
              {review.containsWork ? (
                <p className="kok-week__warn">{t("home:weekReview.workWarning")}</p>
              ) : null}
            </>
          )}

          <div className="kok-week__focus">
            <label htmlFor="kok-week-focus" className="kok-week__sub">
              {t("home:weekReview.focusLabel")}
            </label>
            <input
              id="kok-week-focus"
              type="text"
              className="kok-week__input"
              maxLength={MAX_FOCUS}
              placeholder={t("home:weekReview.focusPlaceholder")}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="kok-week__actions">
              <button
                type="button"
                className="kok-btn kok-btn--sm kok-btn--primary"
                disabled={trimmed === "" || saving}
                onClick={saveFocus}
              >
                {t("home:weekReview.focusSave")}
              </button>
              <button type="button" className="kok-btn kok-btn--sm" onClick={onChangeActive}>
                {t("home:weekReview.changeActive")}
              </button>
            </div>
            {saveFailed ? (
              <p className="kok-state kok-state--error" role="alert">
                {t("home:weekReview.saveFailed")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
```

Uwaga do testów: etykieta `label` ma klasę `kok-week__sub`, a nagłówek zamknięć `h4` tę samą klasę — to tylko styl. Test „Zaczep Monolith” używa `exact: false`, bo `<li>` zawiera `data: tekst`.

- [ ] **Step 4: Podpięcie w `CockpitSections.tsx`**

1. Import: `import { WeekReview } from "./WeekReview";` (obok `CommitHistory`).
2. Do destrukturyzacji propsów i typu dopisz `onWeekFocusSaved` (`onWeekFocusSaved: () => void;`).
3. Pod `<CommitHistory apiFetch={apiFetch} day={data.date} />` dodaj:

```tsx
<WeekReview
  key={data.date}
  apiFetch={apiFetch}
  focus={data.weekFocus}
  onChangeActive={onChangeActive}
  onFocusSaved={onWeekFocusSaved}
/>
```

- [ ] **Step 5: `HomeView.tsx`**

1. W `<CockpitSections ... />` dopisz `onWeekFocusSaved={() => void loadCockpit()}` (po `onQueueChanged`).
2. Pod `</header>` (przed blokiem `{loading && cockpit === null ? ...`) dodaj fragment JSX (blok bez znacznika języka, bo prettier zamienia samotny `{ ... }` w instrukcję):

```
        {cockpit?.weekFocus ? (
          <p className="kok-weekfocus">
            {t("home:weekReview.focusLine", { text: cockpit.weekFocus.text })}
          </p>
        ) : null}
```

- [ ] **Step 6: CSS**

Na końcu `src/features/home/home.css` dopisz (tokeny `--muted`, `--s-*`, `--fs-*`, `--r-sm` istnieją w tym pliku):

```css
/* ---------- Przegląd tygodnia ---------- */
.kok-weekfocus {
  font: 500 var(--fs-sm) / 1.4 var(--font-body);
  color: var(--muted);
  margin: 0 0 var(--s-3);
}

.kok-week__body {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}

.kok-week__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.kok-week__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2) var(--s-3);
}

.kok-week__name {
  font-weight: 600;
}

.kok-week__meta,
.kok-week__line {
  font: 500 var(--fs-xs) / 1.4 var(--font-mono);
  color: var(--muted);
  margin: 0;
}

.kok-week__sub {
  font: 600 var(--fs-xs) / 1.4 var(--font-mono);
  color: var(--muted);
  margin: 0;
}

.kok-week__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.kok-week__warn {
  font: 500 var(--fs-xs) / 1.4 var(--font-mono);
  color: var(--muted);
  margin: 0;
}

.kok-week__focus {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.kok-week__input {
  width: 100%;
  padding: var(--s-2) var(--s-3);
  border-radius: var(--r-sm);
  border: 1px solid var(--border, currentColor);
  background: transparent;
  color: inherit;
  font: inherit;
}
```

- [ ] **Step 7: Uruchom — ma przejść**

Run: `npx vitest run tests/unit/features/home 2>&1 | tail -40`
Expected: PASS. Jeśli `findByRole("button", { name: "Pokaż" })` w HomeView znajduje kilka przycisków, zawęź jak w uwadze do kroku 1.

- [ ] **Step 8: Commit**

```bash
git add src/features/home src/i18n tests/unit/features/home
git commit -m "feat(home): panel Przegląd tygodnia i linia focusu tygodnia w Kokpicie" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: dokumentacja formatu i pełna weryfikacja

**Files:**

- Modify: `docs/nexus-vault-formaty-yaml.md`

- [ ] **Step 1: Format `Cockpit/weeks.yaml`**

W `docs/nexus-vault-formaty-yaml.md` dodaj nową sekcję (np. po sekcji „Kalendarz”, przed „Notatki”):

````markdown
## Focus tygodnia: `Cockpit/weeks.yaml`

Jedno zdanie na tydzień, zapisywane z panelu „Przegląd tygodnia” w Kokpicie. Plik zapisuje aplikacja.

```yaml
version: 1
weeks:
  - week_start: "2026-11-16" # poniedziałek tygodnia ISO
    text: Domknąć słownik tagów
```

- Jeden rekord na `week_start`; ponowny zapis w tym samym tygodniu nadpisuje wpis.
- Kokpit pokazuje tylko rekord bieżącego tygodnia; starsze zostają w pliku.
- Wpisy bez poprawnej daty `RRRR-MM-DD` albo bez tekstu są pomijane.
````

- [ ] **Step 2: Commit dokumentacji**

```bash
git add docs/nexus-vault-formaty-yaml.md
git commit -m "docs: format Cockpit/weeks.yaml" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Pełna weryfikacja przez `cursor`**

Run (osobno każde zlecenie; oczekiwana odpowiedź: „przeszło” albo lista `plik:linia + przyczyna`):

```bash
scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "Uruchom npx tsc --noEmit (bez flag, bez pipe). Odpowiedz: 'przeszło' albo lista plik:linia + przyczyna. Nie edytuj plików."
scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "Uruchom npm run lint (bez flag, bez pipe). Odpowiedz: 'przeszło' albo lista plik:linia + przyczyna. Nie edytuj plików."
scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "Uruchom npx vitest run (bez flag, bez pipe). Odpowiedz: 'przeszło (N testów)' albo lista plik:linia + przyczyna. Nie edytuj plików."
scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "Uruchom npm run build (bez flag, bez pipe). Odpowiedz: 'przeszło' albo lista plik:linia + przyczyna. Nie edytuj plików."
```

Expected: cztery razy „przeszło” (testy: liczba większa niż 3085). Pełny output czytam tylko, gdy podsumowanie nie wystarcza.

- [ ] **Step 4: Review diffa przez `agy`**

```bash
scripts/ask-helper.sh --role review --fresh agy "Zrób review diffa gałęzi feat/przeglad-tygodnia względem main (git diff main...HEAD). Spec: docs/superpowers/specs/2026-11-16-przeglad-tygodnia-kokpit-design.md. Sprawdź: (1) zgodność ze specem, (2) czy dane projektów z hasCompanyData nigdy nie trafiają do promptu ani DTO poza nazwą i liczbami, (3) reguły ADR-021 (warstwy, import z kontekstu tylko schemas w UI), (4) przypadki brzegowe weekStart i okna dat. Odpowiedz listą plik:linia + problem; bez zmian w plikach."
```

Opinie traktuj jak hipotezy: weryfikuj w kodzie, zanim cokolwiek zmienisz.

- [ ] **Step 5: Oględziny w przeglądarce na kopii vaulta (jeśli użytkownik chce)**

Uruchom aplikację na kopii vaulta (`NEXUS_VAULT_PATH`, port ≠ 3000), otwórz Kokpit: panel zwinięty, po „Pokaż” zestawienie, „Kopiuj prompt dla agenta” (wklej do edytora), zapis focusu i linia „Focus tygodnia” u góry po odświeżeniu, „Zmień aktywne tematy” otwiera okno wyboru. Prawdziwego vaulta nie ruszać.

- [ ] **Step 6: Zamknięcie w NEXUS (po merge'u PR)**

W `NEXUS/Vault/Projects/monolith/tasks.md`: wpis Backlog „Kokpit, reszta §6.2 …” zamienić na dwa: przegląd tygodnia `[x]` (PR #…, spec, plan) i „Action items po spotkaniu” `[ ]` jako osobny cykl. Commit i push w NEXUS od razu.

---

## Self-review (autor planu)

**Pokrycie specu:** §3 źródła — git (Task 1, 2, 5), zamknięte zadania (Task 2, 5), zamknięcia dnia (Task 5), review (Task 5, przez istniejące `getReviewHistory`), spotkania (Task 5); §4 kod — `lib/git` (T1), `bc_projects` (T2), `bc_cockpit` pięć plików (T3–T6), trasy (T6); §5 UI i i18n (T7, T8); §6 prompt (T5); §8 testy (rozpisane w T1–T8); D6 maskowanie przez `hasCompanyData` (T5). Poza zakresem (§7) nic nie jest implementowane.

**Placeholdery:** brak „TBD”; każdy krok kodu ma kod.

**Spójność typów:** `WeekFocus`, `WeekReview*` (T3) ↔ `services` (T4–T5) ↔ `schemas` (T4, T6) ↔ komponent (T8); `listGitSubjects`/`listDoneTasksInWindow` (T2) ↔ mocki i wywołania (T5); `MAX_FOCUS_TEXT`=300 ↔ schema 300 ↔ `MAX_FOCUS` w UI; `MAX_WEEK_SUBJECTS`=15 ↔ test T5; klucze i18n (T7) ↔ użycie (T8); `onWeekFocusSaved` (T8) ↔ `HomeView`.

**Odchylenia od specu (zatwierdzone przy pisaniu planu):** `doneDate` z parsera tablicy zamiast skanowania tekstu; przycisk „Zmień aktywne tematy” obok pola, a nie po zapisie; brak chipa przy zwiniętym panelu (nic nie jest pobrane); maskowanie wg `hasCompanyData`, nie samego `owner`. Spec został odpowiednio poprawiony.
