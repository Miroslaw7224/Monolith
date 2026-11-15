# Bugi per projekt: plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pokazać w teczce projektu pełne wpisy `bugs.md` (Plik, Opis, Naprawa, Rozwiązanie, wiek, powiązanie z zadaniem) i dać agentowi komplet instrukcji dodawania i zamykania bugów, tak żeby użytkownik nie robił nic ręcznie.

**Architecture:** Tylko odczyt: `parseBugs` (repositories) czyta nowe pola, `services/bugs.ts` dopisuje pola pochodne (`ageDays`, `stale`, `task`), `schemas.ts` mapuje do DTO, nowy `ProjectBugs.tsx` je pokazuje, kompozytor paczki dla roli `debug` renderuje pełne pola. Zapis bugów robi agent według przepisu w `docs/nexus-vault-formaty-yaml.md`.

**Tech Stack:** Next.js 14, TypeScript, Vitest (`tests/unit/...`), React Testing Library, CSS w `src/features/projects/projects.css`.

**Spec:** `docs/superpowers/specs/2026-11-15-bugi-per-projekt-design.md`. Gałąź: `feat/bugi-per-projekt` (spec już na niej).

**Zasady wykonania (z `CLAUDE.md`):**

- Testy pojedynczych plików (`npx vitest run <ścieżka>`) wolno uruchamiać samemu (krótki wynik). Pełny `npx vitest run`, `npx tsc --noEmit` i `npm run lint` zleca się pomocnikowi: `scripts/ask-helper.sh --role task --approve-allowed --tier light cursor "..."` (zadanie 9).
- Test `tests/unit/architecture.static.test.ts` nie jest zmieniany. Gdy pęka, naprawia się kod.
- Aplikacja niczego nie zapisuje do `bugs.md`. Nie dodawać żadnego API zapisu bugów.
- Każdy commit kończy się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hook lint-staged uruchamia prettier przy commicie.

## Mapa plików

| Plik                                                                 | Zmiana                                                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `docs/superpowers/specs/2026-11-15-bugi-per-projekt-design.md`       | 3 poprawki (zadanie 1)                                                                               |
| `contexts/bc_projects/models.ts`                                     | `BugEntry` + pola, nowy typ `BugTaskLink`                                                            |
| `contexts/bc_projects/repositories/markdown.ts`                      | `parseBugs`: nowe pola, ciąg dalszy, ignorowanie `###` pod obcymi sekcjami                           |
| `contexts/bc_projects/services/bugs.ts` (nowy)                       | `BUG_STALE_AFTER_DAYS`, `findBugTask`, `enrichBugs` (czyste funkcje, bez I/O)                        |
| `contexts/bc_projects/services/index.ts`                             | `getProject` wywołuje `enrichBugs`                                                                   |
| `contexts/bc_projects/schemas.ts`                                    | `BugEntryDto` jawny, `toBugDto`, `toDetailDto` używa mappera                                         |
| `contexts/bc_projects/services/context-pack.ts`                      | `RoleProfile.bugDetails`, pełne bugi w roli `debug`, `BUG_CLOSE_HINT`                                |
| `src/features/projects/ProjectBugs.tsx` (nowy)                       | Sekcja Bugi: wiersze, rozwijanie, znaczki, przełącznik zamkniętych                                   |
| `src/features/projects/ProjectDossier.tsx`                           | Zamiast bloku Bugi renderuje `ProjectBugs`                                                           |
| `src/features/projects/projects.css`                                 | Style wierszy i znaczków bugów                                                                       |
| `docs/nexus-vault-formaty-yaml.md`                                   | Nowa sekcja „Bugi” z przepisem dla agenta                                                            |
| `CLAUDE.md`                                                          | Jedno zdanie o bugach w odnośniku do formatów                                                        |
| `.claude/skills/segreguj-inbox/SKILL.md`                             | Wpis `bug` → `bugs.md` + zadanie przez API                                                           |
| `../NEXUS/CLAUDE.md`, `../NEXUS/docs/_template/bugs.md` (repo NEXUS) | Reguły „Dodaj / Zamknij buga” i wskazówka w szablonie; **osobny commit w repo NEXUS**                |
| Testy (nowe)                                                         | `services.bugs.test.ts`, `schemas.bugs.test.ts`, `context-pack.bugs.test.ts`, `ProjectBugs.test.tsx` |
| Testy (rozszerzone)                                                  | `repositories.markdown.test.ts`, `services.test.ts`                                                  |

---

### Task 1: Poprawki specu

Spec pisałem przed odczytem testów: istniejący test `parseBugs` oczekuje buga z sekcją `""` (`### przed jakimkolwiek ##`), a skill `segreguj-inbox` zabrania ręcznej edycji vaulta.

**Files:**

- Modify: `docs/superpowers/specs/2026-11-15-bugi-per-projekt-design.md`

- [ ] **Step 1: Znajdź fragmenty**

Run: `grep -n "tylko\*\* pod\|Makieta:\|Skill \`segreguj-inbox\`" docs/superpowers/specs/2026-11-15-bugi-per-projekt-design.md`
Expected: trzy linie (sekcje 3, 5 i 7c).

- [ ] **Step 2: Zmień trzy fragmenty (Read pliku, potem Edit)**

1. Sekcja 3, reguła o `###`: bug rozpoznawany jest pod `## Aktywne`, pod `## Zamknięte` **albo przed pierwszym nagłówkiem `##`** (sekcja `""`, zgodnie z dotychczasowym testem). Nagłówki `###` pod innymi sekcjami są ignorowane.
2. Sekcja 5: usuń punkt „Makieta: …”; wstaw „Makieta `04-projekty.html` zostaje bez zmian (klasy `prj-bugs` już istnieją); nowe elementy używają istniejących klas `prj-badge`.”
3. Sekcja 7c: zastąp opis dopiskiem: „Skill dostaje wąski wyjątek od reguły „nie edytujesz vaulta ręcznie”: dla wpisu `bug` agent dopisuje bezpośrednio tylko `Projects/<p>/bugs.md` i `dashboard.md` (przepis z 7a). Zadanie `[ID]` tworzy i zamyka wpis Inboxu istniejące `POST /api/inbox/<id>/move` (`target: project`, `column: next`, tekst z `(patrz <ID>)`), więc `tasks.md` nadal zapisuje wyłącznie aplikacja.”

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-11-15-bugi-per-projekt-design.md
git commit -m "docs(projekty): spec bugów: sekcja pusta w parserze, wyjątek w segreguj-inbox

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Model i parser bugów

**Files:**

- Modify: `contexts/bc_projects/models.ts:72-78`
- Modify: `contexts/bc_projects/repositories/markdown.ts:15-17` (stałe) i `:69-112` (`parseBugs`)
- Test: `tests/unit/contexts/bc_projects/repositories.markdown.test.ts` (nowy `describe` na końcu pliku)

- [ ] **Step 1: Napisz testy (czerwone)**

Dopisz na końcu `tests/unit/contexts/bc_projects/repositories.markdown.test.ts` (importy `parseBugs` i `describe/it/expect` już są):

```ts
describe("parseBugs: pola wpisu", () => {
  const FULL = [
    "# Bugs — X",
    "",
    "## Aktywne",
    "",
    "### GP-001 — Porty",
    "- **Priorytet:** medium",
    "- **Plik:** `start_v2.bat`",
    "- **Otwarto:** 2026-11-10",
    "- **Opis:** Launchery wypisują 5000,",
    "  a backend działa na 5001.",
    "- **Naprawa:** Poprawić echo.",
    "- **Status:** otwarty",
    "",
    "## Zamknięte",
    "",
    "### EA-001 — Supabase usypia",
    "- **Priorytet:** high",
    "- **Rozwiązanie (2026-05-19):** Vercel Cron.",
    "- **Status:** zamknięty",
    "",
  ].join("\n");

  it("czyta wszystkie pola, ciąg dalszy dokleja spacją", () => {
    expect(parseBugs(FULL)).toEqual([
      {
        id: "GP-001",
        title: "Porty",
        section: "Aktywne",
        priority: "medium",
        file: "`start_v2.bat`",
        opened: "2026-11-10",
        description: "Launchery wypisują 5000, a backend działa na 5001.",
        fix: "Poprawić echo.",
        status: "otwarty",
      },
      {
        id: "EA-001",
        title: "Supabase usypia",
        section: "Zamknięte",
        priority: "high",
        resolution: "Vercel Cron.",
        closedOn: "2026-05-19",
        status: "zamknięty",
      },
    ]);
  });

  it("sam nagłówek: bez żadnych pól opcjonalnych", () => {
    expect(parseBugs("## Aktywne\n### A-1 — x\n")).toEqual([
      { id: "A-1", title: "x", section: "Aktywne" },
    ]);
  });

  it("zła data Otwarto jest ignorowana (format i nieistniejący dzień)", () => {
    const md = [
      "## Aktywne",
      "### A-1 — x",
      "- **Otwarto:** wczoraj",
      "### A-2 — y",
      "- **Otwarto:** 2026-02-30",
      "",
    ].join("\n");
    const bugs = parseBugs(md);
    expect(bugs).toHaveLength(2);
    expect(bugs.every((b) => b.opened === undefined)).toBe(true);
  });

  it("Rozwiązanie z nieprawidłową datą w nawiasie: tekst jest, closedOn nie", () => {
    const md = "## Zamknięte\n### A-1 — x\n- **Rozwiązanie (kiedyś):** zrobione\n";
    expect(parseBugs(md)).toEqual([
      { id: "A-1", title: "x", section: "Zamknięte", resolution: "zrobione" },
    ]);
  });

  it("puste pole nie ustawia wartości", () => {
    expect(parseBugs("## Aktywne\n### A-1 — x\n- **Plik:**\n")).toEqual([
      { id: "A-1", title: "x", section: "Aktywne" },
    ]);
  });

  it("pusta linia kończy ciąg dalszy pola", () => {
    const md = "## Aktywne\n### A-1 — x\n- **Opis:** a\n\n  b\n";
    expect(parseBugs(md)[0].description).toBe("a");
  });

  it("### pod obcą sekcją nie jest bugiem i nie oddaje pól poprzedniemu bugowi", () => {
    const md = [
      "## Aktywne",
      "### A-1 — x",
      "## Ostrzeżenia z builda",
      "### W-1 — to nie bug",
      "- **Status:** otwarty",
      "",
    ].join("\n");
    expect(parseBugs(md)).toEqual([{ id: "A-1", title: "x", section: "Aktywne" }]);
  });

  it("pierwsza wartość pola wygrywa", () => {
    const md = "## Aktywne\n### A-1 — x\n- **Priorytet:** high\n- **Priorytet:** low\n";
    expect(parseBugs(md)[0].priority).toBe("high");
  });
});
```

- [ ] **Step 2: Uruchom testy, upewnij się, że padają**

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.markdown.test.ts`
Expected: FAIL (m.in. „czyta wszystkie pola” i „### pod obcą sekcją”); starsze testy `parseBugs` przechodzą.

- [ ] **Step 3: Rozszerz model**

W `contexts/bc_projects/models.ts` zamień `BugEntry` (linie 72-78) na:

```ts
/** Zadanie tablicy powiązane z bugiem (ID buga jako osobny token w treści zadania). */
export type BugTaskLink = { column: TaskColumn; done: boolean };

export type BugEntry = {
  id: string;
  title: string;
  section: string;
  priority?: string;
  status?: string;
  /** Pole `Plik` (surowy tekst). */
  file?: string;
  /** Pole `Otwarto`: poprawna data kalendarzowa `RRRR-MM-DD`. */
  opened?: string;
  description?: string;
  fix?: string;
  /** Treść pola `Rozwiązanie`. */
  resolution?: string;
  /** Data z nawiasu w `Rozwiązanie (RRRR-MM-DD)`. */
  closedOn?: string;
  /** Pola pochodne dopisywane w `services/bugs.ts`; parser ich nie ustawia. */
  ageDays?: number;
  stale?: boolean;
  task?: BugTaskLink;
};
```

- [ ] **Step 4: Zaimplementuj parser**

W `contexts/bc_projects/repositories/markdown.ts` zastąp stałe `PRIORITY_RE` i `STATUS_RE` (linie 16-17) tym blokiem:

```ts
const BUG_FIELD_RE = /^\s*- \*\*([^*]+?):\*\*\s*(.*?)\s*$/;
const BUG_LABEL_RE = /^([^(]+?)\s*(?:\(([^)]*)\))?$/;
const BUG_CONTINUATION_RE = /^[ \t]+\S/;
const BUG_SECTIONS = new Set(["Aktywne", "Zamknięte"]);
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

type BugTextKey = "priority" | "status" | "file" | "description" | "fix" | "resolution";
const BUG_FIELD_KEYS: Record<string, BugTextKey> = {
  priorytet: "priority",
  status: "status",
  plik: "file",
  opis: "description",
  naprawa: "fix",
  rozwiązanie: "resolution",
};

/** `RRRR-MM-DD` tylko dla istniejącej daty kalendarzowej; inaczej `undefined`. */
function validIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = ISO_DATE_RE.exec(value.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(Date.UTC(y, month - 1, d));
  const real =
    probe.getUTCFullYear() === y && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === d;
  return real ? m[0] : undefined;
}

/**
 * Zapisuje pole wpisu; pierwsza wartość wygrywa. Zwraca klucz pola tekstowego, któremu wolno
 * doklejać linie ciągu dalszego (`null`, gdy pole nie przyjmuje ciągu dalszego).
 */
function applyBugField(bug: BugEntry, label: string, value: string): BugTextKey | null {
  const parts = BUG_LABEL_RE.exec(label.trim());
  if (!parts) return null;
  const name = parts[1].trim().toLowerCase();
  if (name === "otwarto") {
    const date = validIsoDate(value);
    if (date !== undefined && bug.opened === undefined) bug.opened = date;
    return null;
  }
  const key = BUG_FIELD_KEYS[name];
  if (key === undefined) return null;
  if (key === "resolution") {
    const date = validIsoDate(parts[2]);
    if (date !== undefined && bug.closedOn === undefined) bug.closedOn = date;
  }
  if (value === "" || bug[key] !== undefined) return null;
  bug[key] = value;
  return key;
}
```

Następnie zastąp całą funkcję `parseBugs` (linie 69-112) wersją:

```ts
export function parseBugs(markdown: string): BugEntry[] {
  const bugs: BugEntry[] = [];
  let section = "";
  let current: BugEntry | null = null;
  let lastField: BugTextKey | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const sectionMatch = SECTION_RE.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      current = null;
      lastField = null;
      continue;
    }

    const bugMatch = BUG_HEADING_RE.exec(line);
    if (bugMatch) {
      lastField = null;
      // Bugi tylko pod „Aktywne”, „Zamknięte” albo przed pierwszym `##`; obce sekcje są ignorowane.
      if (section !== "" && !BUG_SECTIONS.has(section)) {
        current = null;
        continue;
      }
      current = { id: bugMatch[1], title: bugMatch[2].trim(), section };
      bugs.push(current);
      continue;
    }

    if (!current) continue;

    const field = BUG_FIELD_RE.exec(line);
    if (field) {
      lastField = applyBugField(current, field[1], field[2]);
      continue;
    }

    if (line.trim() === "") {
      lastField = null;
    } else if (lastField !== null && BUG_CONTINUATION_RE.test(line)) {
      current[lastField] = `${current[lastField]} ${line.trim()}`;
    }
  }

  return bugs;
}
```

Sprawdź, że usunięte stałe nie były używane gdzie indziej: `grep -n "PRIORITY_RE\|STATUS_RE" contexts/bc_projects/repositories/markdown.ts` (Expected: brak wyników).

- [ ] **Step 5: Uruchom testy, upewnij się, że przechodzą**

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.markdown.test.ts`
Expected: PASS (nowe i dotychczasowe testy `parseBugs`, w tym `### przed jakimkolwiek ##`).

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_projects/models.ts contexts/bc_projects/repositories/markdown.ts tests/unit/contexts/bc_projects/repositories.markdown.test.ts
git commit -m "feat(projekty): parser bugs.md czyta Plik, Otwarto, Opis, Naprawę i Rozwiązanie

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Serwis: wiek buga i powiązanie z zadaniem

**Files:**

- Create: `contexts/bc_projects/services/bugs.ts`
- Modify: `contexts/bc_projects/services/index.ts` (`getProject`, ok. linii 294-312, i import)
- Test: `tests/unit/contexts/bc_projects/services.bugs.test.ts` (nowy), `tests/unit/contexts/bc_projects/services.test.ts` (jeden test)

- [ ] **Step 1: Napisz testy czystych funkcji (czerwone)**

Utwórz `tests/unit/contexts/bc_projects/services.bugs.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { BugEntry, TasksBoard } from "@/contexts/bc_projects/models";
import {
  BUG_STALE_AFTER_DAYS,
  enrichBugs,
  findBugTask,
} from "@/contexts/bc_projects/services/bugs";

const TODAY = new Date(2026, 10, 12);

const board = (p: Partial<TasksBoard> = {}): TasksBoard => ({
  blockers: [],
  now: [],
  next: [],
  icebox: [],
  version: null,
  ...p,
});
const bug = (o: Partial<BugEntry> = {}): BugEntry => ({
  id: "GP-001",
  title: "t",
  section: "Aktywne",
  ...o,
});

describe("enrichBugs: wiek", () => {
  it("próg to 14 dni", () => {
    expect(BUG_STALE_AFTER_DAYS).toBe(14);
  });

  it("14 dni: wiek bez znaczka stary", () => {
    const [r] = enrichBugs([bug({ opened: "2026-10-29" })], board(), TODAY);
    expect(r.ageDays).toBe(14);
    expect(r.stale).toBeUndefined();
  });

  it("15 dni: stary", () => {
    const [r] = enrichBugs([bug({ opened: "2026-10-28" })], board(), TODAY);
    expect(r.ageDays).toBe(15);
    expect(r.stale).toBe(true);
  });

  it("brak Otwarto: bez wieku", () => {
    const [r] = enrichBugs([bug()], board(), TODAY);
    expect("ageDays" in r).toBe(false);
    expect("stale" in r).toBe(false);
  });

  it("zamknięty bug nie ma wieku", () => {
    const [r] = enrichBugs([bug({ section: "Zamknięte", opened: "2026-01-01" })], board(), TODAY);
    expect("ageDays" in r).toBe(false);
  });

  it("data z przyszłości daje 0 dni", () => {
    const [r] = enrichBugs([bug({ opened: "2026-11-20" })], board(), TODAY);
    expect(r.ageDays).toBe(0);
  });

  it("pusta lista zwraca ten sam obiekt, a wejście nie jest mutowane", () => {
    const empty: BugEntry[] = [];
    expect(enrichBugs(empty, board(), TODAY)).toBe(empty);
    const input = bug({ opened: "2026-10-01" });
    enrichBugs([input], board(), TODAY);
    expect(input).toEqual({ id: "GP-001", title: "t", section: "Aktywne", opened: "2026-10-01" });
  });
});

describe("findBugTask: powiązanie z zadaniem", () => {
  it("brak zadania", () => {
    expect(findBugTask("GP-001", board({ next: [{ text: "coś innego", done: false }] }))).toBe(
      undefined
    );
  });

  it("niezakończone zadanie z ID w treści", () => {
    const b = board({ next: [{ text: "**Porty** — echo (patrz GP-001)", done: false }] });
    expect(findBugTask("GP-001", b)).toEqual({ column: "next", done: false });
  });

  it("tylko zakończone zadanie", () => {
    const b = board({ now: [{ text: "GP-001 zrobione", done: true }] });
    expect(findBugTask("GP-001", b)).toEqual({ column: "now", done: true });
  });

  it("niezakończone wygrywa z zakończonym, także z dalszej kolumny", () => {
    const b = board({
      now: [{ text: "GP-001 zrobione", done: true }],
      icebox: [{ text: "GP-001 jeszcze", done: false }],
    });
    expect(findBugTask("GP-001", b)).toEqual({ column: "icebox", done: false });
  });

  it("ID musi być osobnym tokenem", () => {
    const b = board({
      next: [
        { text: "naprawa GP-0011", done: false },
        { text: "XGP-001", done: false },
        { text: "NX-GP-001", done: false },
      ],
    });
    expect(findBugTask("GP-001", b)).toBe(undefined);
    const ok = board({ next: [{ text: "(GP-001), potem reszta", done: false }] });
    expect(findBugTask("GP-001", ok)).toEqual({ column: "next", done: false });
  });

  it("enrichBugs dopisuje task także zamkniętemu bugowi", () => {
    const b = board({ now: [{ text: "GP-001", done: false }] });
    const [r] = enrichBugs([bug({ section: "Zamknięte" })], b, TODAY);
    expect(r.task).toEqual({ column: "now", done: false });
  });
});
```

- [ ] **Step 2: Uruchom, upewnij się, że padają**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.bugs.test.ts`
Expected: FAIL (moduł `services/bugs` nie istnieje).

- [ ] **Step 3: Zaimplementuj `services/bugs.ts`**

Utwórz `contexts/bc_projects/services/bugs.ts`:

```ts
import {
  TASK_COLUMNS,
  type BugEntry,
  type BugTaskLink,
  type TasksBoard,
} from "@/contexts/bc_projects/models";

/** Po tylu dniach otwarty bug dostaje znaczek „stary”. Osobna stała od `STALE_AFTER_DAYS` (Save State). */
export const BUG_STALE_AFTER_DAYS = 14;

const DAY_MS = 86_400_000;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Zadanie tablicy powiązane z bugiem: ID występuje w treści jako osobny token (nie przylega do liter,
 * cyfr ani myślnika). Niezakończone zadanie ma pierwszeństwo przed zakończonym.
 */
export function findBugTask(id: string, board: TasksBoard): BugTaskLink | undefined {
  const pattern = new RegExp(`(?<![A-Za-z0-9-])${escapeRegExp(id)}(?![A-Za-z0-9-])`);
  let doneLink: BugTaskLink | undefined;
  for (const column of TASK_COLUMNS) {
    for (const task of board[column]) {
      if (!pattern.test(task.text)) continue;
      if (!task.done) return { column, done: false };
      if (doneLink === undefined) doneLink = { column, done: true };
    }
  }
  return doneLink;
}

/** Dopisuje pola pochodne (`ageDays`, `stale`, `task`); nie zmienia wejścia, pola bez wartości pomija. */
export function enrichBugs(bugs: BugEntry[], board: TasksBoard, today: Date): BugEntry[] {
  if (bugs.length === 0) return bugs;
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return bugs.map((bug) => {
    const out: BugEntry = { ...bug };
    if (bug.section !== "Zamknięte" && bug.opened !== undefined) {
      const [y, m, d] = bug.opened.split("-").map(Number);
      const age = Math.max(0, Math.round((todayUtc - Date.UTC(y, m - 1, d)) / DAY_MS));
      out.ageDays = age;
      if (age > BUG_STALE_AFTER_DAYS) out.stale = true;
    }
    const task = findBugTask(bug.id, board);
    if (task !== undefined) out.task = task;
    return out;
  });
}
```

- [ ] **Step 4: Uruchom testy czystych funkcji**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.bugs.test.ts`
Expected: PASS.

- [ ] **Step 5: Test integracyjny `getProject` (czerwony)**

W `tests/unit/contexts/bc_projects/services.test.ts` sprawdź stałą: `grep -n "const TODAY" tests/unit/contexts/bc_projects/services.test.ts` (Expected: `new Date(2026, 10, 12)`). Dopisz zaraz po teście `it("getProject", …)`:

```ts
it("getProject: bugi z wiekiem i powiązaniem z zadaniem", () => {
  const a = entry({ id: "a", name: "A" });
  mockReadRegistry.mockReturnValue({ entries: [a], warnings: [] });
  mockReadProjectIndex.mockReturnValue({ lastWorked: "2026-11-05", whereIStopped: "tu" });
  mockReadProjectContent.mockReturnValue({
    tasks: [],
    bugs: [{ id: "B-1", title: "x", section: "Aktywne", opened: "2026-10-01" }],
  });
  mockReadProjectBoard.mockReturnValue(board({ next: [task("Napraw (patrz B-1)")] }));

  expect(getProject("a", TODAY).bugs).toEqual([
    {
      id: "B-1",
      title: "x",
      section: "Aktywne",
      opened: "2026-10-01",
      ageDays: 42,
      stale: true,
      task: { column: "next", done: false },
    },
  ]);
});
```

Run: `npx vitest run tests/unit/contexts/bc_projects/services.test.ts -t "bugi z wiekiem"`
Expected: FAIL (brak `ageDays`).

- [ ] **Step 6: Podepnij `enrichBugs` w `getProject`**

W `contexts/bc_projects/services/index.ts` dodaj import obok `./context-pack`:

```ts
import { enrichBugs } from "./bugs";
```

i w `getProject` dopisz linię po `...content,`:

```ts
    ...content,
    bugs: enrichBugs(content.bugs, board, today),
    board,
```

- [ ] **Step 7: Uruchom testy serwisu i architektury**

Run: `npx vitest run tests/unit/contexts/bc_projects tests/unit/architecture.static.test.ts`
Expected: PASS (wszystkie istniejące testy `bc_projects` bez zmian).

- [ ] **Step 8: Commit**

```bash
git add contexts/bc_projects/services/bugs.ts contexts/bc_projects/services/index.ts tests/unit/contexts/bc_projects/services.bugs.test.ts tests/unit/contexts/bc_projects/services.test.ts
git commit -m "feat(projekty): wiek buga i powiązanie z zadaniem w szczegółach projektu

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: DTO buga

**Files:**

- Modify: `contexts/bc_projects/schemas.ts` (import `BugEntry`, linia ok. 237 `BugEntryDto`, `toDetailDto`)
- Test: `tests/unit/contexts/bc_projects/schemas.bugs.test.ts` (nowy)

- [ ] **Step 1: Napisz test (czerwony)**

Utwórz `tests/unit/contexts/bc_projects/schemas.bugs.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toBugDto } from "@/contexts/bc_projects/schemas";

describe("toBugDto", () => {
  it("kopiuje ustawione pola", () => {
    const bug = {
      id: "GP-001",
      title: "Porty",
      section: "Aktywne",
      priority: "medium",
      status: "otwarty",
      file: "start_v2.bat",
      opened: "2026-11-10",
      description: "opis",
      fix: "naprawa",
      ageDays: 5,
      stale: true,
      task: { column: "next" as const, done: false },
    };
    expect(toBugDto(bug)).toStrictEqual(bug);
  });

  it("pomija pola bez wartości (brak kluczy z undefined)", () => {
    const dto = toBugDto({ id: "A-1", title: "t", section: "Zamknięte", priority: undefined });
    expect(Object.keys(dto)).toEqual(["id", "title", "section"]);
  });

  it("zamknięty bug: Rozwiązanie z datą", () => {
    const dto = toBugDto({
      id: "EA-001",
      title: "t",
      section: "Zamknięte",
      resolution: "Cron",
      closedOn: "2026-05-19",
    });
    expect(dto.resolution).toBe("Cron");
    expect(dto.closedOn).toBe("2026-05-19");
  });
});
```

- [ ] **Step 2: Uruchom, upewnij się, że pada**

Run: `npx vitest run tests/unit/contexts/bc_projects/schemas.bugs.test.ts`
Expected: FAIL (`toBugDto` nie jest eksportem).

- [ ] **Step 3: Zaimplementuj DTO i mapper**

W `contexts/bc_projects/schemas.ts` dodaj `BugTaskLink` do importu typów z `@/contexts/bc_projects/models` (obok `BugEntry`). Zamień `export type BugEntryDto = BugEntry;` na:

```ts
export type BugTaskLinkDto = BugTaskLink;
export type BugEntryDto = {
  id: string;
  title: string;
  section: string;
  priority?: string;
  status?: string;
  file?: string;
  opened?: string;
  description?: string;
  fix?: string;
  resolution?: string;
  closedOn?: string;
  /** Pola pochodne z `services/bugs.ts`. */
  ageDays?: number;
  stale?: boolean;
  task?: BugTaskLinkDto;
};
```

Pod funkcją `toSummaryDto` dopisz mapper (styl jak `toSummaryDto`: bez kluczy z `undefined`):

```ts
export function toBugDto(b: BugEntry): BugEntryDto {
  const dto: BugEntryDto = { id: b.id, title: b.title, section: b.section };
  if (b.priority !== undefined) dto.priority = b.priority;
  if (b.status !== undefined) dto.status = b.status;
  if (b.file !== undefined) dto.file = b.file;
  if (b.opened !== undefined) dto.opened = b.opened;
  if (b.description !== undefined) dto.description = b.description;
  if (b.fix !== undefined) dto.fix = b.fix;
  if (b.resolution !== undefined) dto.resolution = b.resolution;
  if (b.closedOn !== undefined) dto.closedOn = b.closedOn;
  if (b.ageDays !== undefined) dto.ageDays = b.ageDays;
  if (b.stale !== undefined) dto.stale = b.stale;
  if (b.task !== undefined) dto.task = b.task;
  return dto;
}
```

W `toDetailDto` zamień `bugs: p.bugs,` na `bugs: p.bugs.map(toBugDto),`.

- [ ] **Step 4: Uruchom testy kontekstu**

Run: `npx vitest run tests/unit/contexts/bc_projects tests/unit/contexts/bc_cockpit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_projects/schemas.ts tests/unit/contexts/bc_projects/schemas.bugs.test.ts
git commit -m "feat(projekty): jawne DTO buga z polami opisu, wieku i powiązania z zadaniem

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Paczka kontekstu: pełne bugi w roli debug

**Files:**

- Modify: `contexts/bc_projects/services/context-pack.ts` (import typu, `RoleProfile`, `ROLE_PROFILES`, sekcja `bugs`)
- Test: `tests/unit/contexts/bc_projects/context-pack.bugs.test.ts` (nowy)

- [ ] **Step 1: Napisz testy (czerwone)**

Utwórz `tests/unit/contexts/bc_projects/context-pack.bugs.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { BugEntry, ContextPackRole, ProjectWithContent } from "@/contexts/bc_projects/models";
import {
  composeContextPack,
  type ContextPackInput,
} from "@/contexts/bc_projects/services/context-pack";

const BIG = 1_000_000;

const OPEN_BUG: BugEntry = {
  id: "GP-001",
  title: "Porty",
  section: "Aktywne",
  priority: "medium",
  status: "otwarty",
  file: "`start_v2.bat`",
  description: "Launchery wypisują 5000.",
  fix: "Poprawić echo.",
  ageDays: 23,
};
const CLOSED_BUG: BugEntry = { id: "EA-001", title: "Stary", section: "Zamknięte" };

function project(bugs: BugEntry[]): ProjectWithContent {
  return {
    id: "a",
    name: "Alpha",
    status: "active",
    priority: "high",
    folder: "Projects/a/",
    localPath: "~/projects/a",
    owner: "personal",
    whereIStopped: null,
    freshness: "fresh",
    tasks: [],
    board: { blockers: [], now: [], next: [], icebox: [], version: null },
    bugs,
    state: null,
    stateVersion: null,
    devlog: [],
  };
}

function pack(role: ContextPackRole, bugs: BugEntry[]): string {
  const input: ContextPackInput = {
    project: project(bugs),
    lastWorked: "2026-11-10",
    rules: null,
    git: { ok: true, snapshot: { status: "## main", log: "aaaaaaa c1", diffStat: "" } },
    warnings: [],
    role,
  };
  return composeContextPack(input, BIG).markdown;
}

describe("paczka kontekstu: bugi", () => {
  it("debug: pełne pola, wiek i instrukcja zamknięcia; bez zamkniętych", () => {
    const md = pack("debug", [OPEN_BUG, CLOSED_BUG]);
    expect(md).toContain("## Bugi (otwarte)");
    expect(md).toContain("- GP-001: Porty [medium] (otwarty) · otwarty 23 d");
    expect(md).toContain("  Plik: `start_v2.bat`");
    expect(md).toContain("  Opis: Launchery wypisują 5000.");
    expect(md).toContain("  Naprawa: Poprawić echo.");
    expect(md).toContain("Po naprawie zamknij bug w `Projects/<projekt>/bugs.md`");
    expect(md).toContain("docs/nexus-vault-formaty-yaml.md");
    expect(md).not.toContain("EA-001");
  });

  it("debug: bug bez pól opcjonalnych to sama linia nagłówkowa", () => {
    const md = pack("debug", [{ id: "A-1", title: "x", section: "Aktywne" }]);
    expect(md).toContain("- A-1: x");
    expect(md).not.toContain("Plik:");
    expect(md).not.toContain("Opis:");
  });

  it("debug bez otwartych bugów: brak sekcji i instrukcji", () => {
    const md = pack("debug", [CLOSED_BUG]);
    expect(md).not.toContain("## Bugi (otwarte)");
    expect(md).not.toContain("Po naprawie zamknij bug");
  });

  it.each(["full", "implementation"] as const)("%s: jedna linia na bug, jak dotąd", (role) => {
    const md = pack(role, [OPEN_BUG]);
    expect(md).toContain("- GP-001: Porty [medium] (otwarty)");
    expect(md).not.toContain("otwarty 23 d");
    expect(md).not.toContain("Plik:");
    expect(md).not.toContain("Po naprawie zamknij bug");
  });
});
```

- [ ] **Step 2: Uruchom, upewnij się, że padają**

Run: `npx vitest run tests/unit/contexts/bc_projects/context-pack.bugs.test.ts`
Expected: FAIL (debug nie ma pełnych pól); testy `full/implementation` już przechodzą.

- [ ] **Step 3: Zaimplementuj**

W `contexts/bc_projects/services/context-pack.ts`:

1. Dodaj `BugEntry` do importu typów z `@/contexts/bc_projects/models` (alfabetycznie przed `ContextPack`).
2. Do `RoleProfile` dopisz pole:

```ts
/** Rola debug: sekcja „Bugi” z polami Plik/Opis/Naprawa, wiekiem i instrukcją zamknięcia. */
bugDetails: boolean;
```

3. W `ROLE_PROFILES` dopisz `bugDetails: false,` do `full`, `review`, `implementation` oraz `bugDetails: true,` do `debug`.
4. Nad `ROLE_PROFILES` (po definicji `RoleProfile`) dopisz:

```ts
export const BUG_CLOSE_HINT =
  "Po naprawie zamknij bug w `Projects/<projekt>/bugs.md` według przepisu „Bugi” w docs/nexus-vault-formaty-yaml.md (Monolith).";

function bugLine(b: BugEntry): string {
  return `- ${b.id}: ${b.title}${b.priority ? ` [${b.priority}]` : ""}${b.status ? ` (${b.status})` : ""}`;
}

function bugBlock(b: BugEntry): string {
  const lines = [bugLine(b) + (b.ageDays !== undefined ? ` · otwarty ${b.ageDays} d` : "")];
  if (b.file) lines.push(`  Plik: ${b.file}`);
  if (b.description) lines.push(`  Opis: ${b.description}`);
  if (b.fix) lines.push(`  Naprawa: ${b.fix}`);
  return lines.join("\n");
}
```

5. Zastąp funkcję `bugs: () => { … }` (ok. linii 223-231) wersją:

```ts
    bugs: () => {
      const open = project.bugs.filter((b) => b.section !== "Zamknięte");
      if (open.length === 0) return null;
      if (!profile.bugDetails) {
        return `## Bugi (otwarte)\n\n${open.map(bugLine).join("\n")}`;
      }
      return `## Bugi (otwarte)\n\n${open.map(bugBlock).join("\n")}\n\n${BUG_CLOSE_HINT}`;
    },
```

- [ ] **Step 4: Uruchom testy paczki**

Run: `npx vitest run tests/unit/contexts/bc_projects/context-pack.bugs.test.ts tests/unit/contexts/bc_projects/context-pack.roles.test.ts tests/unit/contexts/bc_projects/context-pack.compose.test.ts tests/unit/contexts/bc_projects/services.context-pack.test.ts`
Expected: PASS (dotychczasowe asercje `- BUG-1: Pierwszy [P1] (open)` bez zmian).

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_projects/services/context-pack.ts tests/unit/contexts/bc_projects/context-pack.bugs.test.ts
git commit -m "feat(projekty): paczka kontekstu w roli debug z pełnymi polami bugów i instrukcją zamknięcia

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: UI: sekcja Bugi w teczce

**Files:**

- Create: `src/features/projects/ProjectBugs.tsx`
- Modify: `src/features/projects/ProjectDossier.tsx` (import, linie 50-51, blok `<article>` Bugi ok. 134-158)
- Modify: `src/features/projects/projects.css` (po `.prj-bugs-closed`, ok. linii 543)
- Test: `tests/unit/features/projects/ProjectBugs.test.tsx` (nowy)

Istniejące testy w `ProjectsView.test.tsx` muszą zostać zielone: tekst `Zamknięte: 1`, brak `EA-001` przed rozwinięciem, brak `ul.prj-bugs` przy samych zamkniętych, tekst „Brak bugów”.

- [ ] **Step 1: Napisz testy komponentu (czerwone)**

Utwórz `tests/unit/features/projects/ProjectBugs.test.tsx`:

```tsx
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { BugEntryDto } from "@/contexts/bc_projects/schemas";
import { ProjectBugs } from "@/src/features/projects/ProjectBugs";

afterEach(() => cleanup());

const open = (o: Partial<BugEntryDto> = {}): BugEntryDto => ({
  id: "GP-001",
  title: "Porty",
  section: "Aktywne",
  ...o,
});
const closed = (o: Partial<BugEntryDto> = {}): BugEntryDto => ({
  id: "EA-001",
  title: "Stary",
  section: "Zamknięte",
  ...o,
});

describe("ProjectBugs", () => {
  it("brak bugów", () => {
    render(<ProjectBugs bugs={[]} />);
    expect(screen.getByText("Brak bugów")).toBeInTheDocument();
  });

  it("wiek: zwykły znaczek, a przy stale ostrzegawczy; bez Otwarto brak znaczka", () => {
    render(
      <ProjectBugs
        bugs={[
          open({ id: "A-1", ageDays: 3 }),
          open({ id: "A-2", ageDays: 23, stale: true }),
          open({ id: "A-3" }),
        ]}
      />
    );
    expect(screen.getByText("otwarty 3 d")).not.toHaveClass("prj-badge--warn");
    expect(screen.getByText("otwarty 23 d")).toHaveClass("prj-badge--warn");
    expect(screen.getAllByText(/^otwarty \d+ d$/)).toHaveLength(2);
  });

  it("szczegóły ukryte do kliknięcia", async () => {
    const user = userEvent.setup();
    render(
      <ProjectBugs
        bugs={[open({ file: "start_v2.bat", description: "Opis buga", fix: "Popraw echo" })]}
      />
    );
    expect(screen.queryByText("Opis buga")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Szczegóły GP-001" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("start_v2.bat")).toBeInTheDocument();
    expect(screen.getByText("Opis buga")).toBeInTheDocument();
    expect(screen.getByText("Popraw echo")).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByText("Opis buga")).not.toBeInTheDocument();
  });

  it("bug bez pól szczegółowych nie ma przycisku", () => {
    render(<ProjectBugs bugs={[open()]} />);
    expect(screen.queryByRole("button", { name: /Szczegóły/ })).not.toBeInTheDocument();
  });

  it("znaczniki zgodności bugu z zadaniem", () => {
    render(
      <ProjectBugs
        bugs={[
          open({ id: "A-1", task: { column: "now", done: false } }),
          open({ id: "A-2", task: { column: "next", done: true } }),
          closed({ id: "Z-1", task: { column: "next", done: false } }),
          closed({ id: "Z-2", task: { column: "next", done: true } }),
        ]}
      />
    );
    expect(screen.getByText("w zadaniach: Teraz")).toBeInTheDocument();
    expect(screen.getByText("zadanie zrobione, bug nadal otwarty")).toBeInTheDocument();
    expect(screen.queryByText("bug zamknięty, zadanie nadal otwarte")).not.toBeInTheDocument();
  });

  it("zamknięte pod przełącznikiem: tytuł, data zamknięcia, rozwiązanie, znacznik zgodności", async () => {
    const user = userEvent.setup();
    render(
      <ProjectBugs
        bugs={[
          closed({
            resolution: "Vercel Cron",
            closedOn: "2026-05-19",
            task: { column: "next", done: false },
          }),
        ]}
      />
    );
    expect(screen.queryByText("EA-001")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Zamknięte: 1" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByText("EA-001")).toBeInTheDocument();
    expect(screen.getByText("zamknięto 2026-05-19")).toBeInTheDocument();
    expect(screen.getByText("bug zamknięty, zadanie nadal otwarte")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Szczegóły EA-001" }));
    expect(screen.getByText("Vercel Cron")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Uruchom, upewnij się, że padają**

Run: `npx vitest run tests/unit/features/projects/ProjectBugs.test.tsx`
Expected: FAIL (brak modułu `ProjectBugs`).

- [ ] **Step 3: Zaimplementuj komponent**

Utwórz `src/features/projects/ProjectBugs.tsx`:

```tsx
import React, { useState } from "react";
import type { BugEntryDto } from "@/contexts/bc_projects/schemas";

const COLUMN_LABEL: Record<string, string> = {
  blockers: "Blokery",
  now: "Teraz",
  next: "Następne",
  icebox: "Icebox",
};

/** Znacznik rozjazdu lub powiązania bugu z zadaniem; `null`, gdy nie ma czego pokazać. */
function taskHint(bug: BugEntryDto, isClosed: boolean): string | null {
  const task = bug.task;
  if (!task) return null;
  if (isClosed) return task.done ? null : "bug zamknięty, zadanie nadal otwarte";
  return task.done
    ? "zadanie zrobione, bug nadal otwarty"
    : `w zadaniach: ${COLUMN_LABEL[task.column] ?? task.column}`;
}

function BugRow(props: { bug: BugEntryDto; isClosed: boolean }): React.JSX.Element {
  const { bug, isClosed } = props;
  const [expanded, setExpanded] = useState(false);
  const hint = taskHint(bug, isClosed);
  const hasDetails = Boolean(bug.file || bug.description || bug.fix || bug.resolution);

  return (
    <li className="prj-bug">
      <div className="prj-bug__row">
        <span className="prj-badge">{bug.id}</span>
        <span>{bug.title}</span>
        {bug.priority ? <span className="prj-badge">{bug.priority}</span> : null}
        {bug.status ? <span className="prj-badge">{bug.status}</span> : null}
        {!isClosed && bug.ageDays !== undefined ? (
          <span className={bug.stale ? "prj-badge prj-badge--warn" : "prj-badge"}>
            otwarty {bug.ageDays} d
          </span>
        ) : null}
        {isClosed && bug.closedOn ? (
          <span className="prj-badge">zamknięto {bug.closedOn}</span>
        ) : null}
        {hint ? <span className="prj-badge prj-badge--warn">{hint}</span> : null}
        {hasDetails ? (
          <button
            type="button"
            className="prj-bug__toggle"
            aria-expanded={expanded}
            aria-label={`Szczegóły ${bug.id}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Zwiń" : "Szczegóły"}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <dl className="prj-bug__details">
          {bug.file ? (
            <>
              <dt>Plik</dt>
              <dd>{bug.file}</dd>
            </>
          ) : null}
          {bug.description ? (
            <>
              <dt>Opis</dt>
              <dd>{bug.description}</dd>
            </>
          ) : null}
          {bug.fix ? (
            <>
              <dt>Naprawa</dt>
              <dd>{bug.fix}</dd>
            </>
          ) : null}
          {bug.resolution ? (
            <>
              <dt>Rozwiązanie</dt>
              <dd>{bug.resolution}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}

/** Sekcja „Bugi” teczki projektu (tylko odczyt `bugs.md`). */
export function ProjectBugs(props: { bugs: BugEntryDto[] }): React.JSX.Element {
  const [closedOpen, setClosedOpen] = useState(false);
  const active = props.bugs.filter((b) => b.section !== "Zamknięte");
  const closed = props.bugs.filter((b) => b.section === "Zamknięte");

  return (
    <article className="prj-card">
      <h3 className="prj-section-title">Bugi</h3>
      {props.bugs.length === 0 ? (
        <p>Brak bugów</p>
      ) : (
        <>
          {active.length > 0 ? (
            <ul className="prj-bugs">
              {active.map((bug) => (
                <BugRow key={bug.id} bug={bug} isClosed={false} />
              ))}
            </ul>
          ) : null}
          {closed.length > 0 ? (
            <>
              <button
                type="button"
                className="prj-bugs-closed"
                aria-expanded={closedOpen}
                onClick={() => setClosedOpen((v) => !v)}
              >
                Zamknięte: {closed.length}
              </button>
              {closedOpen ? (
                <ul className="prj-bugs-list">
                  {closed.map((bug) => (
                    <BugRow key={bug.id} bug={bug} isClosed />
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Podepnij w teczce**

W `src/features/projects/ProjectDossier.tsx`:

1. Dodaj import obok pozostałych: `import { ProjectBugs } from "./ProjectBugs";` (po `ProjectContextPack`, alfabetycznie).
2. Usuń dwie linie z `activeBugs` i `closedBugs` (ok. linii 50-51).
3. Zastąp cały blok `<article className="prj-card">` z `<h3 className="prj-section-title">Bugi</h3>` (do jego zamykającego `</article>`) jednym elementem:

```tsx
<ProjectBugs key={`${project.id}-bugs`} bugs={project.bugs} />
```

Sprawdź brak martwych odwołań: `grep -n "activeBugs\|closedBugs" src/features/projects/ProjectDossier.tsx` (Expected: brak wyników).

- [ ] **Step 5: Style**

W `src/features/projects/projects.css` zamień regułę `.prj-bugs li` (ok. linii 535-541) i `.prj-bugs-closed` (ok. 543-547) na:

```css
.prj-bugs li,
.prj-bugs-list li {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  font: 500 var(--fs-xs) / 1.35 var(--font-mono);
  color: var(--text);
}

.prj-bugs-list {
  list-style: none;
  margin: var(--s-2) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.prj-bug__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
}

.prj-bug__toggle,
.prj-bugs-closed {
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  font: 500 var(--fs-xs) / 1.3 var(--font-mono);
  color: var(--muted);
}

.prj-bugs-closed {
  margin: var(--s-3) 0 0;
}

.prj-bug__details {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--s-1, 4px) var(--s-3);
  margin: 0;
  color: var(--muted);
}

.prj-bug__details dt {
  font-weight: 600;
}

.prj-bug__details dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.prj-badge--warn {
  border-color: var(--warn);
  color: var(--warn);
}
```

(Reguła `.prj-bugs` z `display:flex; flex-direction:column` zostaje bez zmian.)

- [ ] **Step 6: Uruchom testy UI**

Run: `npx vitest run tests/unit/features/projects`
Expected: PASS (nowe `ProjectBugs.test.tsx` i dotychczasowe `ProjectsView.test.tsx`, `projectTiles.test.ts` bez zmian).

- [ ] **Step 7: Commit**

```bash
git add src/features/projects/ProjectBugs.tsx src/features/projects/ProjectDossier.tsx src/features/projects/projects.css tests/unit/features/projects/ProjectBugs.test.tsx
git commit -m "feat(projekty): sekcja Bugi w teczce: szczegóły, wiek, zgodność z zadaniami

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Instrukcje dla agenta w Monolith

**Files:**

- Modify: `docs/nexus-vault-formaty-yaml.md` (nowa sekcja na końcu)
- Modify: `CLAUDE.md:7-8`
- Modify: `.claude/skills/segreguj-inbox/SKILL.md` (reguły, krok 3, krok 5)

Brak testów (dokumenty). Weryfikacja: czytanie i `npx prettier --check` na zmienionych plikach.

> **Zmiana wykonawcza (decyzja użytkownika 2026-11-15):** zamiast wąskiego wyjątku w `segreguj-inbox` (krok 3) powstał osobny skill `.claude/skills/bug-projektu/SKILL.md` z przepisem „dodaj / zamknij bug” (w tym tryb „z Inboxu”), a `segreguj-inbox` dostał tylko odnośnik (krok 5a) i nadal zabrania ręcznej edycji vaulta. Spec poprawiono w zadaniu 1 odpowiednio.

- [ ] **Step 1: Dopisz sekcję „Bugi” na końcu `docs/nexus-vault-formaty-yaml.md`**

````markdown
## Bugi: `Projects/<projekt>/bugs.md`

Aplikacja **tylko czyta** ten plik (karta Projekty, paczka kontekstu); bugi dodaje i zamyka agent według przepisu poniżej. Pole `Otwarto` daje w UI wiek buga i znaczek „stary” po 14 dniach.

```
## Aktywne

### GP-001 — Tytuł buga
- **Priorytet:** medium
- **Plik:** `ścieżka/do/pliku`
- **Otwarto:** 2026-11-10
- **Opis:** Co się dzieje. Kolejne linie wcięte o 2 spacje należą do tego samego pola.
- **Naprawa:** Plan naprawy (opcjonalnie).
- **Status:** otwarty

## Zamknięte

### EA-001 — Tytuł buga
- **Priorytet:** high
- **Opis:** …
- **Rozwiązanie (2026-05-19):** Co zrobiono.
- **Status:** zamknięty
```

Reguły formatu:

- Bug to `### <ID> — <tytuł>` (myślnik, półpauza lub pauza) pod `## Aktywne` albo `## Zamknięte`. `###` pod inną sekcją (np. „Ostrzeżenia z builda”) nie jest bugiem.
- ID to `XX-NNN` (prefiks projektu z `NEXUS/CLAUDE.md` § Format ID bugów, numer o 1 większy od największego w pliku, w obu sekcjach).
- Pole to linia `- **Etykieta:** wartość`. Znane etykiety: `Priorytet`, `Plik`, `Otwarto`, `Opis`, `Naprawa`, `Rozwiązanie`, `Status`. Data w `Otwarto` i w nawiasie `Rozwiązanie (…)` musi mieć dokładnie postać `RRRR-MM-DD` (inna jest ignorowana). Wszystko poza nagłówkiem jest opcjonalne.
- Nie wpisuj przykładów `### …` w komentarzach HTML od początku linii: parser czyta linie.
- Gdy plik ma tylko zdanie „Brak znanych bugów.” (nowy projekt), zastąp je sekcjami `## Aktywne` i `## Zamknięte`.

**Dodaj bug** (polecenie „Dodaj buga do X”, ustalenie podczas pracy, wpis z Inboxu typu `bug`):

1. Wpis pod `## Aktywne` według formatu; `Otwarto: <dziś>` (dla wpisu z Inboxu: data wpisu), `Status: otwarty`.
2. Wiersz w tabeli „Bugi” w `Vault/dashboard.md` oraz ID w kolumnie „Bugi” tabeli „Projekty — przegląd”.
3. Zadanie w `Projects/<projekt>/tasks.md` pod `## Next`: `- [ ] **Tytuł** — krótki opis (patrz <ID>)`. ID musi być w treści (aplikacja po nim łączy bug z zadaniem). Dla `Priorytet: high` dopisz na końcu linii ` [now::]`, o ile w „Teraz” jest mniej niż 3 niezakończone zadania; inaczej bez znacznika.

**Zamknij bug** (polecenie „Zamknij buga X w projekcie Y”, naprawa w trakcie pracy):

1. Przenieś cały wpis pod `## Zamknięte`, ustaw `Status: zamknięty`, dodaj `- **Rozwiązanie (RRRR-MM-DD):** co zrobiono` (data = dziś).
2. Usuń lub przekreśl wiersz w tabeli „Bugi” w `Vault/dashboard.md` i zaktualizuj kolumnę „Bugi” w przeglądzie projektów.
3. Odhacz zadanie z tym ID w `tasks.md`: `- [x] … — RRRR-MM-DD` (data zakończenia na końcu linii). Gdy zadania nie ma, nic nie dodawaj.

Rozjazdy (zadanie zrobione, a bug nadal aktywny, albo bug zamknięty, a zadanie otwarte) aplikacja sygnalizuje przy wpisie w karcie Projekty; popraw wtedy brakującą stronę według powyższych kroków.
````

- [ ] **Step 2: Zaktualizuj odnośnik w `CLAUDE.md`**

W `CLAUDE.md` (linie 7-8) zamień:

`Formaty plików vaulta (kalendarz, zadania, notatki, tagi…) i to, jak agent ma dodawać wydarzenia kalendarza przez API:`

na:

`Formaty plików vaulta (kalendarz, zadania, notatki, tagi…), to, jak agent ma dodawać wydarzenia kalendarza przez API, oraz przepis dodawania i zamykania bugów (`bugs.md`):`

- [ ] **Step 3: Zmień skill `segreguj-inbox`**

W `.claude/skills/segreguj-inbox/SKILL.md`:

1. W sekcji „Reguły” zamień ostatni punkt `- Nie ruszaj `Projects/\_registry.yaml`, `tasks.md` ani innych plików bezpośrednio.` na:

```markdown
- Nie ruszaj `Projects/_registry.yaml`, `tasks.md` ani innych plików bezpośrednio. **Jedyny wyjątek: wpis `bug`** (krok 5a): wolno Ci wtedy bezpośrednio dopisać `Projects/<id>/bugs.md` i `dashboard.md` (pliki, których API inboxu nie dotyka). Zadanie `[ID]` nadal tworzy `move`.
```

2. W kroku 3 zamień zdanie o `bug` (`…`bug` to zwykle zadanie w projekcie, którego dotyczy…`) na: `` `bug` to bug w projekcie, którego dotyczy (cel „bug projektu”: `projectId`, tytuł do 120 znaków, opis, priorytet low/medium/high; pole `Otwarto` = data wpisu `at`) ``. W liście celów dopisz: `- **bug projektu**: bug trafia do `bugs.md` projektu (nie tylko jako zadanie); tabela z kroku 4 pokazuje go jako „bug projektu”, projekt, tytuł.`
3. Przed krokiem 6 wstaw nowy punkt:

```markdown
5a. Dla zatwierdzonego wiersza „bug projektu” (zamiast samego `move` z kroku 5):

1.  Odczytaj `NEXUS/Vault/Projects/<id projektu>/bugs.md` (ścieżka względem katalogu NEXUS, dostępnego jako katalog dodatkowy) i wyznacz kolejne ID (`XX-NNN`, o 1 większe od największego w obu sekcjach; prefiks z istniejących ID projektu albo z tabeli w `NEXUS/CLAUDE.md`).
2.  Dopisz wpis pod `## Aktywne` według przepisu „Bugi” z `docs/nexus-vault-formaty-yaml.md` (`Otwarto` = data wpisu `at`, `Status: otwarty`) oraz wiersz w tabeli „Bugi” i ID w przeglądzie projektów w `NEXUS/Vault/dashboard.md`.
3.  Wywołaj `move` z `{"target":"project","projectId":"<id>","column":"next","text":"**<tytuł>** — <krótki opis> (patrz <ID>)"}` (limit 300 znaków, bez `[now::]`, do „Teraz” nigdy). To tworzy zadanie i zamyka wpis inboxu.
4.  Błąd `move` po zapisie bugu: **nie dopisuj bugu drugi raz** (powstałby duplikat); `409` ponów raz, inny kod zgłoś użytkownikowi razem z ID już zapisanego bugu.
```

- [ ] **Step 4: Sprawdź formatowanie**

Run: `npx prettier --check docs/nexus-vault-formaty-yaml.md CLAUDE.md`
Expected: „All matched files use Prettier code style!” (jeśli nie: `npx prettier --write` na tych dwóch plikach).

- [ ] **Step 5: Commit**

```bash
git add docs/nexus-vault-formaty-yaml.md CLAUDE.md .claude/skills/segreguj-inbox/SKILL.md
git commit -m "docs(agent): przepis dodawania i zamykania bugów, bug z Inboxu do bugs.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Instrukcje w repo NEXUS (osobny commit)

Repo `~/projects/Brain_7224/NEXUS` (gałąź `main`, czysta). Pracuj na osobnej gałęzi; nie wypychaj i nie scalaj bez zgody użytkownika.

**Files:**

- Modify: `../NEXUS/CLAUDE.md:140-141`
- Modify: `../NEXUS/docs/_template/bugs.md`

- [ ] **Step 1: Gałąź**

Run: `git -C ../NEXUS checkout -b docs/bugi-przepis-agenta`

- [ ] **Step 2: Zmień reguły w `NEXUS/CLAUDE.md`**

Zamień dwie linie:

```
- "Dodaj buga do X" → dopisz do `Vault/Projects/x/bugs.md` i dodaj wiersz w tabeli Bugi w `dashboard.md`
- "Zamknij buga X w projekcie Y" → oznacz w `bugs.md`, usuń lub przekreśl wiersz w `dashboard.md`
```

na:

```
- "Dodaj buga do X" → przepis „Bugi” w `~/projects/Brain_7224/Monolith/docs/nexus-vault-formaty-yaml.md`: wpis w `Vault/Projects/x/bugs.md` z `Otwarto: <dziś>`, wiersz w tabeli Bugi i ID w przeglądzie projektów w `dashboard.md`, zadanie z ID w `tasks.md`
- "Zamknij buga X w projekcie Y" → ten sam przepis: wpis pod `## Zamknięte` z `Rozwiązanie (data)`, odhaczone zadanie z ID, zaktualizowany `dashboard.md`
```

- [ ] **Step 3: Zmień szablon `docs/_template/bugs.md`**

Zamień zawartość od linii `Brak znanych bugów.` do końca pliku na (nawigację z pierwszej linii i nagłówek `# Bugs — Nazwa Projektu` zostaw):

```
## Aktywne

Brak aktywnych bugów.

## Zamknięte

Brak zamkniętych bugów.

<!-- Format ID: XX-001, gdzie XX = prefix projektu (EA, GP, SB, TA, PF, CS, NX). -->
<!-- Wzór wpisu (pola Otwarto, Opis, Naprawa, Rozwiązanie) i przepis dodawania/zamykania: Monolith/docs/nexus-vault-formaty-yaml.md, sekcja „Bugi”. -->
```

(Nie wpisuj w komentarzach linii zaczynających się od `###`.)

- [ ] **Step 4: Commit w repo NEXUS**

```bash
git -C ../NEXUS add CLAUDE.md docs/_template/bugs.md
git -C ../NEXUS commit -m "docs(bugi): agent dodaje i zamyka bugi według przepisu z Monolith (Otwarto, zadanie z ID)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Weryfikacja i review

**Files:** brak zmian (chyba że review wykaże błąd).

- [ ] **Step 1: Pełne sprawdzenie przez pomocnika (cursor, `--tier light`)**

Run:

```bash
scripts/ask-helper.sh --role task --approve-allowed --tier light cursor "W katalogu Monolith uruchom kolejno: npx tsc --noEmit, npx vitest run, npm run lint. Odpowiedz 'przeszło' albo listą plik:linia + przyczyna dla każdego błędu. Niczego nie edytuj."
```

Expected: „przeszło” dla trzech poleceń. Błędy napraw w kodzie (nie w `architecture.static.test.ts`), powtórz.

- [ ] **Step 2: Niezależny review diffa (agy)**

Run:

```bash
scripts/ask-helper.sh --role review agy "Review diffa gałęzi feat/bugi-per-projekt względem main (git diff main...HEAD). Zgodność ze specem docs/superpowers/specs/2026-11-15-bugi-per-projekt-design.md i regułami z CLAUDE.md (warstwy bc_*, brak zapisu bugs.md z aplikacji). Szukaj: błędów parsera bugs.md (ciąg dalszy pól, daty), regresji w paczce kontekstu dla ról innych niż debug, rozjazdów DTO. Zwróć listę plik:linia + problem, najważniejsze pierwsze."
```

Opinie traktuj jak hipotezy: zweryfikuj w kodzie, zanim cokolwiek zmienisz.

- [ ] **Step 3: Test na prawdziwych danych (odczyt)**

Run: `npx tsx -e "import { parseBugs } from './contexts/bc_projects/repositories/markdown'; import { readFileSync } from 'node:fs'; for (const p of ['gen-podsum-ai','english-agent','monolith']) console.log(p, JSON.stringify(parseBugs(readFileSync('../NEXUS/Vault/Projects/'+p+'/bugs.md','utf8')), null, 1));"`
Expected: `gen-podsum-ai` zwraca GP-001 (z `file`, `description`, `fix`) i GP-002; `english-agent` zwraca EA-001 z `resolution` i `closedOn: "2026-05-19"` (bez „Ostrzeżeń z builda”); `monolith` zwraca `[]`. (Skrypt jednorazowy, nic nie zapisuje; jeśli `tsx` niedostępne, pomiń krok, bo te same dane pokrywają testy z zadania 2.)

- [ ] **Step 4: Podsumowanie dla użytkownika**

Zgłoś: wynik tsc/vitest/lint, uwagi z review (zaakceptowane/odrzucone z powodem), commit w repo NEXUS (osobna gałąź `docs/bugi-przepis-agenta`, niescalona). Dalej: skill `finishing-a-development-branch` (PR z opisem: lista „przekazane dalej” ze specu, sekcja 11).

---

## Samokontrola planu względem specu

- Sekcja 3 (format, parser): zadanie 2. Sekcja 4 (model, serwis, DTO): zadania 2-4. Sekcja 5 (UI): zadanie 6. Sekcja 6 (paczka): zadanie 5. Sekcja 7a-c (instrukcje): zadania 7-8. Sekcja 8 (testy): w każdym zadaniu. Sekcja 9 (prywatność): brak zapisu z aplikacji, nic do zrobienia. Sekcja 11 (poza zakresem): trafia do opisu PR (zadanie 9, krok 4).
- Typy spójne między zadaniami: `BugEntry`, `BugTaskLink` (zadanie 2) → `enrichBugs`, `findBugTask`, `BUG_STALE_AFTER_DAYS` (zadanie 3) → `BugEntryDto`, `toBugDto` (zadanie 4) → `bugBlock`, `BUG_CLOSE_HINT`, `RoleProfile.bugDetails` (zadanie 5) → `ProjectBugs` (zadanie 6).
- Istniejące testy zachowane: `### przed jakimkolwiek ##` (sekcja `""` dopuszczona), `Zamknięte: 1`, `ul.prj-bugs` tylko dla aktywnych, jednoliniowe bugi w rolach innych niż debug.
