# Archiwizacja ukończonych zadań projektu: plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** W `Projects/<id>/tasks.md` otwarte zadania leżą przed ukończonymi, akcja „Archiwizuj ukończone” przenosi ukończone zadania starsze niż N dni do `changelog.md`, a nad tablicą jest filtr Wszystkie / Otwarte / Ukończone.

**Architecture:** Reguła kolejności siedzi w `repositories/tasks-file.ts` (jeden punkt wstawienia „za ostatnim otwartym”). Archiwizacja to nowa trasa `POST /api/projects/[id]/tasks/archive` → `router` → `services` → `repositories` (kroki 0–2 ze specu §4.3). Czyste funkcje dat (`archiveDateOf`, `isArchivable`) leżą w `lib/schema/archive-date.ts`, bo wołają je i repozytorium, i UI (patrz „Odstępstwo od specu”).

**Tech Stack:** Next.js 14, TypeScript, zod, Vitest (+ Testing Library), vault Markdown (`lib/nexus/vault-fs`).

**Spec:** `docs/superpowers/specs/2026-11-14-archiwizacja-ukonczonych-zadan-design.md` (oznaczenia: N = próg w dniach, M = liczba zadań do przeniesienia, K = zadania bez żadnej daty).

---

## Odstępstwo od specu (do potwierdzenia przez wykonawcę/użytkownika)

Spec (§4.1, §5) każe trzymać `archiveDateOf` / `isArchivable` w `schemas.ts` i wołać je z `repositories/tasks-file.ts`. Test `tests/unit/architecture.static.test.ts` (`LAYER_ALLOWED`: `repositories: ["models"]`, `schemas: []`, `schemas` importuje tylko `lib/schema/**` i `import type` z `models`) tego zabrania, a CLAUDE.md mówi: pękający test naprawia się kodem, nie testem. Plan: funkcje leżą w nowym `lib/schema/archive-date.ts` (wolno je importować z `repositories` i `schemas`), a `schemas.ts` je **re-eksportuje**, więc UI nadal importuje je tylko ze `schemas` (spec §6 bez zmian). Test architektury zostaje nietknięty.

Drugie drobne odstępstwo: kopia prawdziwego `monolith/tasks.md` (§7) leży jako `*.fixture.txt`, żeby `lint-staged`/prettier nie przeformatował jej przy commicie.

## Zasady wykonania (CLAUDE.md)

- Każde zadanie: czerwony test → kod → zielony test → commit. Komendy `npx vitest run …`, `npx tsc --noEmit`, `npm run lint`, `npm run build` zleca się `cursor` (`scripts/ask-helper.sh --role task --approve-allowed cursor "<komenda>; odpowiedz: przeszło albo lista plik:linia + przyczyna"`); poniżej same komendy.
- Zmiany testu architektury: nie dotykamy go w tym planie.
- Commity kończą się linią: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Gałąź: `feat/archiwizacja-zadan` (już istnieje, drzewo czyste).

## Mapa plików

| Plik                                                           | Zmiana                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `contexts/bc_projects/repositories/tasks-file.ts`              | `taskInsertIndex`, reguła kolejności w `toggle`/`add`/`move`, `extractArchivable`                                     |
| `lib/schema/archive-date.ts` (nowy)                            | `archiveDateOf`, `isArchivable`, `daysBetween`, `isIsoDay`, `localIsoDate`                                            |
| `contexts/bc_projects/schemas.ts`                              | re-eksport z `lib/schema/archive-date`, stałe progu, `ArchiveDoneInputSchema`, `ArchiveDoneResultDto`, `toArchiveDto` |
| `contexts/bc_projects/models.ts`                               | `ArchivedBlock`, `ArchiveResult`                                                                                      |
| `contexts/bc_projects/repositories/markdown.ts`                | `mergeChangelog`                                                                                                      |
| `contexts/bc_projects/repositories/index.ts`                   | `archiveDoneTasks`                                                                                                    |
| `contexts/bc_projects/services/index.ts`                       | `archiveDone`                                                                                                         |
| `contexts/bc_projects/router.ts`                               | `postTasksArchive`                                                                                                    |
| `app/api/projects/[id]/tasks/archive/route.ts` (nowy)          | re-eksport `postTasksArchive as POST`                                                                                 |
| `contexts/bc_nexus_docs/models.ts`                             | `changelog.md` w `PROJECT_EXCLUDED_FILES`                                                                             |
| `contexts/bc_map/repositories.ts`                              | pomija `tasks.md`, `devlog.md`, `changelog.md` w katalogu projektu                                                    |
| `src/features/projects/mutation.ts`                            | `MutationResult.archived?`, `ProjectActions.archiveDone`                                                              |
| `src/features/projects/useProjects.ts`                         | wywołanie trasy, `archived` z odpowiedzi                                                                              |
| `src/features/projects/ProjectsView.tsx`, `ProjectDossier.tsx` | przekazanie akcji                                                                                                     |
| `src/features/projects/ProjectTasksBoard.tsx`, `projects.css`  | filtr, przycisk archiwizacji                                                                                          |
| testy                                                          | patrz w zadaniach                                                                                                     |

---

### Task 1: Kolejność „otwarte przed ukończonymi” (`tasks-file.ts`)

**Files:**

- Modify: `contexts/bc_projects/repositories/tasks-file.ts` (`applyTaskOp` case `toggle`, `insertBlock`, nowe `taskInsertIndex` i `reorderBlock`)
- Test: `tests/unit/contexts/bc_projects/tasks-file.test.ts`

Reguła (spec §3): blok (otwarty albo ukończony) ląduje w punkcie „tuż za ostatnim otwartym zadaniem sekcji”; gdy w sekcji są same ukończone, przed pierwszym z nich; gdy sekcja nie ma zadań, działa dotychczasowa ścieżka (pod nagłówkiem, placeholder znika). `toggle` wycina blok i wstawia go w tym punkcie, **liczonym po wycięciu**; gdy w sekcji nie ma innych zadań (jedyne zadanie), edytuje tylko linię w miejscu (zachowuje prozę i układ sekcji bajt w bajt). `move` między sekcjami i `add` korzystają z `insertBlock`, więc dostają regułę automatycznie. `move` `next` ↔ `now`, `edit`, `remove` bez zmian.

- [ ] **Step 1: Zaktualizuj dwa istniejące testy `toggle`, które zakładały edycję w miejscu**

W `tests/unit/contexts/bc_projects/tasks-file.test.ts` zamień test „toggle: ukończone → nieukończone, data znika” (Zrobione jest pierwsze w Backlogu, przed dwiema otwartymi Powtórkami, więc wraca za ostatnią otwartą):

```ts
it("toggle: ukończone → nieukończone, data znika, linia wraca za ostatnie otwarte", () => {
  const out = applyTaskOp(
    SAMPLE,
    { op: "toggle", column: "icebox", index: 0, text: "Zrobione" },
    CTX
  );
  expect(out).toBe(`${SAMPLE.replace("- [x] Zrobione — 2026-05-19\n", "")}- [ ] Zrobione\n`);
});
```

i test „toggle zadania z Teraz…” (po odhaczeniu `Drugie` ląduje za ostatnim otwartym `Next`, czyli za `Trzecie`):

```ts
it("toggle zadania z Teraz zdejmuje znacznik i przenosi je za ostatnie otwarte Następne", () => {
  const out = applyTaskOp(SAMPLE, { op: "toggle", column: "now", index: 0, text: "Drugie" }, CTX);
  expect(out).toBe(
    SAMPLE.replace("- [ ] Drugie [now::]\n", "").replace(
      "- [ ] Trzecie\n",
      "- [ ] Trzecie\n- [x] Drugie — 2026-11-13\n"
    )
  );
  const board = readBoardText(out);
  expect(board.now).toEqual([]);
  expect(board.next[2]).toEqual({ text: "Drugie", done: true, doneDate: "2026-11-13" });
});
```

- [ ] **Step 2: Dopisz nowe testy kolejności na końcu pliku**

```ts
const orderFile = (next: string[], backlog: string[]) =>
  `# Tasks — Demo\n\n## Next\n\n${next.join("\n")}\n\n## Backlog\n\n${backlog.join("\n")}\n`;

const ORDER = orderFile(
  ["- [ ] A", "- [x] B — 2026-11-01", "- [ ] C", "- [x] D — 2026-11-02"],
  ["- [ ] F", "- [x] E — 2026-10-01"]
);
// Kolumna next: A(0) B(1) C(2) D(3); icebox: F(0) E(1).

describe("tasks-file: otwarte przed ukończonymi", () => {
  it("toggle otwartego: za ostatnim otwartym, na górze ogona ukończonych", () => {
    const out = applyTaskOp(ORDER, { op: "toggle", column: "next", index: 0, text: "A" }, CTX);
    expect(out).toBe(
      orderFile(
        ["- [x] B — 2026-11-01", "- [ ] C", "- [x] A — 2026-11-13", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [x] E — 2026-10-01"]
      )
    );
  });

  it("toggle ukończonego (odznaczenie): wraca za ostatnie otwarte", () => {
    const out = applyTaskOp(ORDER, { op: "toggle", column: "next", index: 1, text: "B" }, CTX);
    expect(out).toBe(
      orderFile(
        ["- [ ] A", "- [ ] C", "- [ ] B", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [x] E — 2026-10-01"]
      )
    );
  });

  it("toggle: cały blok z wciętymi liniami przenosi się razem", () => {
    const text = orderFile(["- [ ] A", "  - sub", "- [ ] C", "- [x] B — 2026-11-01"], ["- [ ] F"]);
    const out = applyTaskOp(text, { op: "toggle", column: "next", index: 0, text: "A" }, CTX);
    expect(out).toBe(
      orderFile(["- [ ] C", "- [x] A — 2026-11-13", "  - sub", "- [x] B — 2026-11-01"], ["- [ ] F"])
    );
  });

  it("toggle zadania [now::] w Next: znika z now, ląduje za ostatnim otwartym", () => {
    const text = orderFile(["- [ ] A [now::]", "- [ ] C", "- [x] B — 2026-11-01"], ["- [ ] F"]);
    const out = applyTaskOp(text, { op: "toggle", column: "now", index: 0, text: "A" }, CTX);
    expect(out).toBe(
      orderFile(["- [ ] C", "- [x] A — 2026-11-13", "- [x] B — 2026-11-01"], ["- [ ] F"])
    );
    expect(readBoardText(out).now).toEqual([]);
  });

  it("sekcja z samymi ukończonymi: odznaczone zadanie ląduje przed pierwszym z nich", () => {
    const text = "## Next\n\n- [x] A — 2026-11-01\n- [x] B — 2026-11-02\n";
    const out = applyTaskOp(text, { op: "toggle", column: "next", index: 1, text: "B" }, CTX);
    expect(out).toBe("## Next\n\n- [ ] B\n- [x] A — 2026-11-01\n");
  });

  it("jedyne zadanie sekcji: edycja w miejscu, proza i układ bajt w bajt", () => {
    const out = applyTaskOp(
      "## Next\n\n- [ ] A\n\nProza.\n\n## Backlog\n",
      { op: "toggle", column: "next", index: 0, text: "A" },
      CTX
    );
    expect(out).toBe("## Next\n\n- [x] A — 2026-11-13\n\nProza.\n\n## Backlog\n");
  });

  it("add: za ostatnim otwartym, przed ukończonymi", () => {
    const out = applyTaskOp(ORDER, { op: "add", column: "next", text: "N" }, CTX);
    expect(out).toBe(
      orderFile(
        ["- [ ] A", "- [x] B — 2026-11-01", "- [ ] C", "- [ ] N", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [x] E — 2026-10-01"]
      )
    );
  });

  it("add do sekcji z samymi ukończonymi: przed pierwszym z nich", () => {
    const out = applyTaskOp(
      "## Backlog\n\n- [x] E — 2026-10-01\n",
      { op: "add", column: "icebox", text: "N" },
      CTX
    );
    expect(out).toBe("## Backlog\n\n- [ ] N\n- [x] E — 2026-10-01\n");
  });

  it("add do sekcji bez zadań: pod nagłówkiem, placeholder znika", () => {
    const out = applyTaskOp(
      "## Blokery\n\n_Brak aktywnych blokerów_\n\n## Next\n",
      { op: "add", column: "blockers", text: "X" },
      CTX
    );
    expect(out).toBe("## Blokery\n\n- [ ] X\n\n## Next\n");
  });

  it("move otwartego do sekcji z ogonem ukończonych: za ostatnim otwartym celu", () => {
    const out = applyTaskOp(
      ORDER,
      { op: "move", column: "next", index: 0, text: "A", to: "icebox" },
      CTX
    );
    expect(out).toBe(
      orderFile(
        ["- [x] B — 2026-11-01", "- [ ] C", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [ ] A", "- [x] E — 2026-10-01"]
      )
    );
  });

  it("move ukończonego: na górę ogona ukończonych celu (data zostaje)", () => {
    const out = applyTaskOp(
      ORDER,
      { op: "move", column: "next", index: 1, text: "B", to: "icebox" },
      CTX
    );
    expect(out).toBe(
      orderFile(
        ["- [ ] A", "- [ ] C", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [x] B — 2026-11-01", "- [x] E — 2026-10-01"]
      )
    );
  });

  it("move ukończonego do sekcji wymieszanej: za ostatnim otwartym (punkt po wycięciu bloku)", () => {
    const out = applyTaskOp(
      ORDER,
      { op: "move", column: "icebox", index: 1, text: "E", to: "next" },
      CTX
    );
    expect(out).toBe(
      orderFile(
        [
          "- [ ] A",
          "- [x] B — 2026-11-01",
          "- [ ] C",
          "- [x] E — 2026-10-01",
          "- [x] D — 2026-11-02",
        ],
        ["- [ ] F"]
      )
    );
  });

  it("move next → now: bez zmiany pozycji (regresja)", () => {
    const out = applyTaskOp(
      ORDER,
      { op: "move", column: "next", index: 2, text: "C", to: "now" },
      CTX
    );
    expect(out).toBe(
      orderFile(
        ["- [ ] A", "- [x] B — 2026-11-01", "- [ ] C [now::]", "- [x] D — 2026-11-02"],
        ["- [ ] F", "- [x] E — 2026-10-01"]
      )
    );
  });
});
```

- [ ] **Step 3: Uruchom testy, upewnij się, że padają**

Run: `npx vitest run tests/unit/contexts/bc_projects/tasks-file.test.ts`
Expected: FAIL (dwa zmienione testy `toggle` i większość nowych; testy `add`/`move` z pozostawionymi otwartymi na końcu mogą już przechodzić).

- [ ] **Step 4: Zaimplementuj regułę w `tasks-file.ts`**

Zamień case `toggle` w `applyTaskOp`:

```ts
    case "toggle": {
      const scan = scanTasks(text);
      const task = locateTask(scan, op);
      const toggled = formatTaskLine(
        task.done
          ? { done: false, now: false, text: task.text }
          : { done: true, now: false, text: task.text, doneDate: ctx.today }
      );
      return reorderBlock(scan, task, [toggled, ...scan.lines.slice(task.start + 1, task.end)]);
    }
```

Dodaj pod `sectionKindOf` (przed `newFileWith`) dwie funkcje:

```ts
/**
 * Indeks w `scan.lines`, przed którym ląduje blok w sekcji z zadaniami: tuż za ostatnim otwartym zadaniem
 * (to samo miejsce jest górą „ogona” ukończonych); gdy są same ukończone, przed pierwszym z nich.
 * `null`, gdy sekcja nie ma żadnych zadań.
 */
function taskInsertIndex(scan: Scan, section: ScannedSection): number | null {
  const inSection = scan.tasks.filter((t) => t.start > section.heading && t.start < section.end);
  if (inSection.length === 0) return null;
  const open = inSection.filter((t) => !t.done);
  return open.length > 0 ? open[open.length - 1].end : inSection[0].start;
}

/**
 * `toggle`: podmienia blok zadania i ustawia go w punkcie z `taskInsertIndex` liczonym po wycięciu bloku
 * (inaczej punkt przesunąłby się o jego długość). Gdy w sekcji nie ma innych zadań, edytuje blok w miejscu.
 */
function reorderBlock(scan: Scan, task: ScannedTask, block: string[]): string {
  const cut = [...scan.lines.slice(0, task.start), ...scan.lines.slice(task.end)];
  const rest = scanTasks(cut.join("\n"));
  const section = rest.sections[sectionKindOf(task.column)];
  const at = section === undefined ? null : taskInsertIndex(rest, section);
  if (at === null) {
    scan.lines.splice(task.start, task.end - task.start, ...block);
    return scan.lines.join("\n");
  }
  rest.lines.splice(at, 0, ...block);
  return rest.lines.join("\n");
}
```

W `insertBlock` zastąp blok `const inSection = …` / `if (inSection.length > 0) {…}` (linie 249–253) i uaktualnij komentarz nad funkcją:

```ts
/**
 * Wstawia blok linii do sekcji: za ostatnim otwartym zadaniem (przed ukończonymi; same ukończone: przed
 * pierwszym); w sekcji bez zadań usuwa placeholdery `Brak…` i wstawia pod nagłówkiem (albo po ostatniej
 * niepustej linii prozy); brak sekcji dopisuje na końcu pliku.
 */
```

```ts
const at = taskInsertIndex(scan, section);
if (at !== null) {
  scan.lines.splice(at, 0, ...block);
  return scan.lines.join("\n");
}
```

- [ ] **Step 5: Uruchom testy: zielone**

Run: `npx vitest run tests/unit/contexts/bc_projects`
Expected: PASS (cały katalog: ewentualne inne testy zakładające edycję w miejscu muszą być zielone; dotyczy to `repositories.tasks.test.ts`, gdzie odhaczane `Trzecie` zostaje na miejscu, bo jest ostatnim otwartym).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: bez błędów.

- [ ] **Step 7: Commit**

```bash
git add contexts/bc_projects/repositories/tasks-file.ts tests/unit/contexts/bc_projects/tasks-file.test.ts
git commit -m "feat(projekty): tasks.md: otwarte zadania przed ukończonymi (toggle, add, move)"
```

(plus linia `Co-Authored-By` z zasad wykonania.)

---

### Task 2: Funkcje dat archiwizacji i wejście API (`lib/schema`, `schemas.ts`)

**Files:**

- Create: `lib/schema/archive-date.ts`
- Modify: `contexts/bc_projects/schemas.ts`
- Test: `tests/unit/lib/schema/archive-date.test.ts` (nowy), `tests/unit/contexts/bc_projects/schemas.archive.test.ts` (nowy)

- [ ] **Step 1: Napisz test funkcji dat**

`tests/unit/lib/schema/archive-date.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  archiveDateOf,
  daysBetween,
  isArchivable,
  isIsoDay,
  localIsoDate,
} from "@/lib/schema/archive-date";

describe("archiveDateOf", () => {
  it("doneDate z parsera ma pierwszeństwo przed datą w tekście", () => {
    expect(archiveDateOf({ text: "X — 2026-01-01; nota", doneDate: "2026-11-13" })).toBe(
      "2026-11-13"
    );
  });

  it.each([
    ["X — 2026-11-13", "2026-11-13"],
    ["X — 2026-11-13; sprawdzone ręcznie", "2026-11-13"],
    ["X — 2026-11-14: opis", "2026-11-14"],
    ["X — 2026-11-13 (nota)", "2026-11-13"],
    ["X — 2026-11-13, dalej", "2026-11-13"],
    ["X — 2026-11-13.", "2026-11-13"],
    ["(X — 2026-11-13)", "2026-11-13"],
  ])("bez doneDate: %s → %s", (text, expected) => {
    expect(archiveDateOf({ text })).toBe(expected);
  });

  it("bierze pierwsze wystąpienie „— RRRR-MM-DD”", () => {
    expect(archiveDateOf({ text: "X — 2026-11-01 i potem — 2026-11-09" })).toBe("2026-11-01");
  });

  it.each([["X"], ["X — 2026-11-13abc"], ["X 2026-11-13"], ["X — 2026-13-45"]])(
    "brak poprawnej daty: %s → null",
    (text) => {
      expect(archiveDateOf({ text })).toBeNull();
    }
  );
});

describe("daysBetween", () => {
  it("liczy dni kalendarzowe z samych dat (zmiana czasu nie przesuwa wyniku)", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-03-29", "2026-03-30")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-11-20", "2026-11-14")).toBe(-6);
  });
});

describe("isArchivable", () => {
  const TODAY = "2026-11-14";
  const done = (doneDate?: string, text = "X") =>
    doneDate === undefined ? { done: true, text } : { done: true, text, doneDate };

  it("N = 3: 2026-11-10 tak, 2026-11-11 nie", () => {
    expect(isArchivable(done("2026-11-10"), TODAY, 3)).toBe(true);
    expect(isArchivable(done("2026-11-11"), TODAY, 3)).toBe(false);
  });

  it("N = 7: 2026-11-06 tak, 2026-11-07 nie", () => {
    expect(isArchivable(done("2026-11-06"), TODAY, 7)).toBe(true);
    expect(isArchivable(done("2026-11-07"), TODAY, 7)).toBe(false);
  });

  it("zmiana czasu: dziś 2026-03-30, N = 1: 03-28 tak, 03-29 nie", () => {
    expect(isArchivable(done("2026-03-28"), "2026-03-30", 1)).toBe(true);
    expect(isArchivable(done("2026-03-29"), "2026-03-30", 1)).toBe(false);
  });

  it("ukończone bez żadnej daty: zawsze", () => {
    expect(isArchivable(done(undefined), TODAY, 30)).toBe(true);
  });

  it("data z dopiskiem po dacie podlega progowi (nie jest „bez daty”)", () => {
    expect(isArchivable(done(undefined, "X — 2026-11-13; sprawdzone"), TODAY, 3)).toBe(false);
    expect(isArchivable(done(undefined, "X — 2026-11-01; sprawdzone"), TODAY, 3)).toBe(true);
  });

  it("otwarte nigdy; data z przyszłości nie", () => {
    expect(isArchivable({ done: false, text: "X — 2026-01-01" }, TODAY, 1)).toBe(false);
    expect(isArchivable(done("2026-11-20"), TODAY, 1)).toBe(false);
  });
});

describe("isIsoDay, localIsoDate", () => {
  it("waliduje datę kalendarzową", () => {
    expect(isIsoDay("2026-02-28")).toBe(true);
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("2026-2-3")).toBe(false);
  });

  it("localIsoDate: data lokalna RRRR-MM-DD", () => {
    expect(localIsoDate(new Date(2026, 10, 4, 23, 30))).toBe("2026-11-04");
  });
});
```

- [ ] **Step 2: Test wejścia API**

`tests/unit/contexts/bc_projects/schemas.archive.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ProjectWithContent } from "@/contexts/bc_projects/models";
import {
  ARCHIVE_DAYS_OPTIONS,
  ARCHIVE_DEFAULT_DAYS,
  ArchiveDoneInputSchema,
  archiveDateOf,
  isArchivable,
  toArchiveDto,
  toDetailDto,
} from "@/contexts/bc_projects/schemas";
import * as lib from "@/lib/schema/archive-date";

const HASH = "a".repeat(64);

describe("ArchiveDoneInputSchema", () => {
  it("version null (plik ma nie istnieć) i próg", () => {
    const r = ArchiveDoneInputSchema.safeParse({ version: null, olderThanDays: 7 });
    expect(r.success && r.data).toEqual({ version: null, olderThanDays: 7 });
  });

  it("version size:hash zamieniona na obiekt", () => {
    const r = ArchiveDoneInputSchema.safeParse({ version: `7:${HASH}`, olderThanDays: 3 });
    expect(r.success && r.data.version).toEqual({ size: 7, hash: HASH });
  });

  it.each([[1], [30]])("próg %i jest poprawny", (olderThanDays) => {
    expect(ArchiveDoneInputSchema.safeParse({ version: null, olderThanDays }).success).toBe(true);
  });

  it.each([[0], [31], [1.5], ["7"], [-1]])("próg %j jest odrzucony", (olderThanDays) => {
    expect(ArchiveDoneInputSchema.safeParse({ version: null, olderThanDays }).success).toBe(false);
  });

  it("brak version albo zła wersja: odrzucone", () => {
    expect(ArchiveDoneInputSchema.safeParse({ olderThanDays: 7 }).success).toBe(false);
    expect(ArchiveDoneInputSchema.safeParse({ version: "zła", olderThanDays: 7 }).success).toBe(
      false
    );
  });
});

describe("archiwizacja: stałe i re-eksporty", () => {
  it("UI oferuje 3, 5, 7 (domyślnie 7)", () => {
    expect(ARCHIVE_DAYS_OPTIONS).toEqual([3, 5, 7]);
    expect(ARCHIVE_DEFAULT_DAYS).toBe(7);
  });

  it("schemas re-eksportuje te same funkcje co lib/schema", () => {
    expect(archiveDateOf).toBe(lib.archiveDateOf);
    expect(isArchivable).toBe(lib.isArchivable);
  });

  it("toArchiveDto: ProjectDetailDto plus archived", () => {
    const project: ProjectWithContent = {
      id: "a",
      name: "Alpha",
      status: "active",
      priority: "high",
      folder: "Projects/a/",
      localPath: "/tmp/a",
      owner: "personal",
      whereIStopped: null,
      freshness: "fresh",
      tasks: [],
      board: { blockers: [], now: [], next: [], icebox: [], version: null },
      bugs: [],
      state: null,
      stateVersion: null,
      devlog: [],
    };
    expect(toArchiveDto(project, 3)).toEqual({ ...toDetailDto(project), archived: 3 });
  });
});
```

- [ ] **Step 3: Uruchom: czerwone**

Run: `npx vitest run tests/unit/lib/schema/archive-date.test.ts tests/unit/contexts/bc_projects/schemas.archive.test.ts`
Expected: FAIL (brak modułów/eksportów).

- [ ] **Step 4: Utwórz `lib/schema/archive-date.ts`**

```ts
/**
 * Reguły dat archiwizacji zadań (spec archiwizacji §4.1). Czyste funkcje wspólne dla serwera
 * (`repositories/tasks-file`) i UI (przez re-eksport w `schemas.ts`); bez zależności od `Date` lokalnego,
 * poza `localIsoDate`.
 */

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Pierwsze „— RRRR-MM-DD” w tekście linii, po którym jest koniec linii albo ` ` `;` `:` `,` `.` `)`. */
const NOTE_DATE_RE = /\s—\s(\d{4}-\d{2}-\d{2})(?=$|[ ;:,.)])/;
const DAY_MS = 86_400_000;

export function isIsoDay(value: string): boolean {
  const m = ISO_DAY_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(Date.UTC(y, month - 1, d));
  return (
    probe.getUTCFullYear() === y && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === d
  );
}

function utcDay(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Liczba dni kalendarzowych od `from` do `to` (obie `RRRR-MM-DD`), z samych dat, więc DST nie przesuwa wyniku. */
export function daysBetween(from: string, to: string): number {
  return (utcDay(to) - utcDay(from)) / DAY_MS;
}

/** Dzień lokalny `RRRR-MM-DD` (to samo co `localDate` w serwisie). */
export function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Data ukończenia do archiwizacji: `doneDate` z parsera, a gdy go brak, pierwsze „— RRRR-MM-DD” z tekstu
 * (dopisek po dacie, np. „— 2026-11-13; sprawdzone”, wyklucza parser). `null`: brak poprawnej daty.
 */
export function archiveDateOf(task: { text: string; doneDate?: string }): string | null {
  const raw = task.doneDate ?? NOTE_DATE_RE.exec(task.text)?.[1];
  return raw !== undefined && isIsoDay(raw) ? raw : null;
}

/**
 * Ukończone zadanie do archiwizacji: bez żadnej daty zawsze; z datą, gdy wiek (dni od ukończenia do `today`)
 * jest większy niż `olderThanDays`. Otwarte nigdy.
 */
export function isArchivable(
  task: { done: boolean; text: string; doneDate?: string },
  today: string,
  olderThanDays: number
): boolean {
  if (!task.done) return false;
  const date = archiveDateOf(task);
  return date === null || daysBetween(date, today) > olderThanDays;
}
```

- [ ] **Step 5: Rozszerz `schemas.ts`**

Pod importami z `./models` (po `export type { Owner, ProjectType };`) dodaj:

```ts
export { archiveDateOf, isArchivable, localIsoDate } from "@/lib/schema/archive-date";
```

Po `TaskOpInputSchema` (przed blokiem `// Co wysyła UI`) dodaj:

```ts
/** Progi archiwizacji: UI oferuje 3, 5, 7 dni (domyślnie 7); serwer przyjmuje 1–30 (agent może użyć innego). */
export const ARCHIVE_DAYS_OPTIONS = [3, 5, 7] as const;
export const ARCHIVE_DEFAULT_DAYS = 7;

/** Wejście `POST /api/projects/[id]/tasks/archive`. `version`: wersja `tasks.md` z GET (`board.version`). */
export const ArchiveDoneInputSchema = z.object({
  version: nullableVersion,
  olderThanDays: z.number().int().min(1).max(30),
});
```

W bloku typów wejścia dopisz: `export type ArchiveDoneInputDto = z.input<typeof ArchiveDoneInputSchema>;`

Po `toDetailDto` dopisz:

```ts
/** Odpowiedź archiwizacji: szczegóły projektu jak z `postTasks` plus liczba przeniesionych zadań. */
export type ArchiveDoneResultDto = ProjectDetailDto & { archived: number };

export function toArchiveDto(p: ProjectWithContent, archived: number): ArchiveDoneResultDto {
  return { ...toDetailDto(p), archived };
}
```

- [ ] **Step 6: Zielone + testy architektury**

Run: `npx vitest run tests/unit/lib/schema tests/unit/contexts/bc_projects/schemas.archive.test.ts tests/unit/contexts/bc_projects/schemas.test.ts tests/unit/architecture.static.test.ts`
Expected: PASS (re-eksport z `lib/schema` jest dozwolony dla `schemas`).

- [ ] **Step 7: Commit**

```bash
git add lib/schema/archive-date.ts contexts/bc_projects/schemas.ts tests/unit/lib/schema/archive-date.test.ts tests/unit/contexts/bc_projects/schemas.archive.test.ts
git commit -m "feat(projekty): archiveDateOf/isArchivable (lib/schema) i wejście API archiwizacji"
```

---

### Task 3: Wybór zadań do archiwizacji (`extractArchivable`) i typy w `models.ts`

**Files:**

- Modify: `contexts/bc_projects/models.ts`, `contexts/bc_projects/repositories/tasks-file.ts`
- Create: `tests/unit/contexts/bc_projects/fixtures/monolith-tasks.fixture.txt`
- Test: `tests/unit/contexts/bc_projects/tasks-file.test.ts`

- [ ] **Step 1: Skopiuj fixture z prawdziwego pliku (tylko odczyt vaulta)**

```bash
mkdir -p tests/unit/contexts/bc_projects/fixtures
cp ../NEXUS/Vault/Projects/monolith/tasks.md tests/unit/contexts/bc_projects/fixtures/monolith-tasks.fixture.txt
```

- [ ] **Step 2: Dopisz testy do `tasks-file.test.ts`**

Na górze pliku rozszerz importy:

```ts
import fs from "node:fs";
import {
  applyTaskOp,
  extractArchivable,
  readBoardText,
  scanTasks,
  type TaskFileContext,
} from "@/contexts/bc_projects/repositories/tasks-file";
import { archiveDateOf } from "@/lib/schema/archive-date";
```

(scal z istniejącym importem `applyTaskOp, readBoardText, type TaskFileContext`.) Na końcu pliku:

```ts
const ARCH = `# Tasks — Demo

## Blokery

- [x] Blok stary — 2026-11-01

## Next

- [ ] Otwarte
- [x] Stare — 2026-11-10
  - podpunkt
- [x] Świeże — 2026-11-11
- [x] Dopisek — 2026-11-09; sprawdzone ręcznie
- [x] Bez daty

Proza.

## Backlog

- [x] Backlog stary — 2026-10-01
- [ ] Backlog otwarte
`;

describe("tasks-file: extractArchivable", () => {
  it("N = 3, dziś 2026-11-14: ukończone starsze i bez daty ze wszystkich sekcji; reszta bajt w bajt", () => {
    const { text, blocks } = extractArchivable(ARCH, "2026-11-14", 3);
    expect(blocks).toEqual([
      { date: "2026-11-01", lines: ["- [x] Blok stary — 2026-11-01"] },
      { date: "2026-11-10", lines: ["- [x] Stare — 2026-11-10", "  - podpunkt"] },
      { date: "2026-11-09", lines: ["- [x] Dopisek — 2026-11-09; sprawdzone ręcznie"] },
      { date: null, lines: ["- [x] Bez daty"] },
      { date: "2026-10-01", lines: ["- [x] Backlog stary — 2026-10-01"] },
    ]);
    expect(text).toBe(
      "# Tasks — Demo\n\n## Blokery\n\n\n## Next\n\n- [ ] Otwarte\n- [x] Świeże — 2026-11-11\n\nProza.\n\n## Backlog\n\n- [ ] Backlog otwarte\n"
    );
  });

  it("N = 7: zostają Stare (wiek 4) i Dopisek (wiek 5)", () => {
    const { text, blocks } = extractArchivable(ARCH, "2026-11-14", 7);
    expect(blocks.map((b) => b.lines[0])).toEqual([
      "- [x] Blok stary — 2026-11-01",
      "- [x] Bez daty",
      "- [x] Backlog stary — 2026-10-01",
    ]);
    expect(text).toContain("- [x] Stare — 2026-11-10\n  - podpunkt\n");
    expect(text).toContain("- [x] Dopisek — 2026-11-09; sprawdzone ręcznie\n");
  });

  it("otwarte nigdy; brak kwalifikujących się: tekst bez zmian i pusta lista", () => {
    const open = "## Next\n\n- [ ] A\n- [x] B — 2026-11-13\n";
    expect(extractArchivable(open, "2026-11-14", 3)).toEqual({ text: open, blocks: [] });
  });

  it("brak pliku (null): null i pusta lista", () => {
    expect(extractArchivable(null, "2026-11-14", 3)).toEqual({ text: null, blocks: [] });
  });

  it("kopia monolith/tasks.md: ukończone z dopiskiem po dacie nie są „bez daty”", () => {
    const real = fs.readFileSync(
      new URL("./fixtures/monolith-tasks.fixture.txt", import.meta.url),
      "utf8"
    );
    const withNote = scanTasks(real).tasks.filter(
      (t) => t.done && t.doneDate === undefined && /\s—\s\d{4}-\d{2}-\d{2}[ ;:,.)]/.test(t.text)
    );
    expect(withNote.length).toBeGreaterThan(0);
    for (const t of withNote) expect(archiveDateOf(t)).not.toBeNull();
  });
});
```

- [ ] **Step 3: Uruchom: czerwone**

Run: `npx vitest run tests/unit/contexts/bc_projects/tasks-file.test.ts`
Expected: FAIL (`extractArchivable` nie istnieje).

- [ ] **Step 4: Dodaj typy do `models.ts`**

Pod `TaskOp` w `contexts/bc_projects/models.ts`:

```ts
/** Zarchiwizowany blok zadania: linia zadania z wciętymi liniami; `date` = data ukończenia (`null` = bez daty). */
export type ArchivedBlock = { date: string | null; lines: string[] };
/** Wynik archiwizacji (lista bloków tylko wewnątrz kontekstu; DTO ma samo `archived`). */
export type ArchiveResult = { archived: number; blocks: ArchivedBlock[] };
```

- [ ] **Step 5: Zaimplementuj `extractArchivable` w `tasks-file.ts`**

Importy na górze: `import type { ArchivedBlock, BoardTask, TaskColumn, TaskOp, TasksBoard } from "@/contexts/bc_projects/models";` oraz `import { archiveDateOf, isArchivable } from "@/lib/schema/archive-date";`. Na końcu pliku:

```ts
/**
 * Wycina z `tasks.md` ukończone zadania do archiwizacji (`isArchivable`) ze wszystkich znanych sekcji.
 * Zwraca tekst bez nich (reszta bajt w bajt) i wycięte bloki w kolejności pliku; gdy nic się nie
 * kwalifikuje (albo pliku nie ma), tekst wraca bez zmian.
 */
export function extractArchivable(
  text: string | null,
  today: string,
  olderThanDays: number
): { text: string | null; blocks: ArchivedBlock[] } {
  const scan = scanTasks(text);
  const picked = scan.tasks.filter((t) => isArchivable(t, today, olderThanDays));
  if (text === null || picked.length === 0) return { text, blocks: [] };
  const blocks = picked.map((t) => ({
    date: archiveDateOf(t),
    lines: scan.lines.slice(t.start, t.end),
  }));
  for (const t of [...picked].reverse()) scan.lines.splice(t.start, t.end - t.start);
  return { text: scan.lines.join("\n"), blocks };
}
```

- [ ] **Step 6: Zielone + tsc**

Run: `npx vitest run tests/unit/contexts/bc_projects/tasks-file.test.ts && npx tsc --noEmit`
Expected: PASS, bez błędów typów.

- [ ] **Step 7: Commit**

```bash
git add contexts/bc_projects/models.ts contexts/bc_projects/repositories/tasks-file.ts tests/unit/contexts/bc_projects/tasks-file.test.ts tests/unit/contexts/bc_projects/fixtures/monolith-tasks.fixture.txt
git commit -m "feat(projekty): extractArchivable: wybór ukończonych zadań do archiwizacji"
```

---

### Task 4: Format `changelog.md` (`mergeChangelog`)

**Files:**

- Modify: `contexts/bc_projects/repositories/markdown.ts`
- Test: `tests/unit/contexts/bc_projects/repositories.markdown.test.ts`

Gramatyka (spec §4.2): `# Changelog — <nazwa>`, potem sekcje `## RRRR-MM` (najnowszy miesiąc na górze, w środku malejąco po dacie, przy równej dacie nowe za istniejącymi), `## Bez daty` zawsze na dole. Bez deduplikacji. Plik z nagłówkiem `## ` innym niż `RRRR-MM` / `Bez daty` albo z powtórzonym nagłówkiem: `DomainError` 422, nic nie jest zapisywane (funkcja czysta, więc rzuca przed jakąkolwiek zmianą; proza zostaje bajt w bajt).

- [ ] **Step 1: Dopisz testy na końcu `repositories.markdown.test.ts`**

Dodaj `mergeChangelog` do importu z `@/contexts/bc_projects/repositories/markdown` oraz `import type { ArchivedBlock } from "@/contexts/bc_projects/models";` (scal z istniejącym importem typów). Na końcu pliku:

```ts
describe("mergeChangelog", () => {
  const block = (date: string | null, text: string, ...extra: string[]): ArchivedBlock => ({
    date,
    lines: [`- [x] ${text}${date === null ? "" : ` — ${date}`}`, ...extra],
  });
  const HEAD = "# Changelog — Demo\n\n";

  it("nowy plik: nagłówek z nazwą projektu i miesiąc", () => {
    expect(mergeChangelog(null, [block("2026-11-13", "A")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n`
    );
  });

  it("istniejący miesiąc: malejąco po dacie, przy równej dacie nowe za istniejącymi", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n- [x] D — 2026-11-10\n`;
    expect(mergeChangelog(existing, [block("2026-11-12", "C")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n- [x] C — 2026-11-12\n- [x] D — 2026-11-10\n`
    );
    expect(mergeChangelog(existing, [block("2026-11-14", "E")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n- [x] E — 2026-11-14\n- [x] D — 2026-11-10\n`
    );
    expect(mergeChangelog(existing, [block("2026-11-20", "F")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] F — 2026-11-20\n- [x] B — 2026-11-14\n- [x] D — 2026-11-10\n`
    );
  });

  it("kilka bloków naraz trafia na właściwe miejsca", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n- [x] D — 2026-11-10\n`;
    expect(
      mergeChangelog(existing, [block("2026-11-12", "C"), block("2026-11-13", "G")], "Demo")
    ).toBe(
      `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n- [x] G — 2026-11-13\n- [x] C — 2026-11-12\n- [x] D — 2026-11-10\n`
    );
  });

  it("nowy, nowszy miesiąc ląduje na górze", () => {
    const existing = `${HEAD}## 2026-10\n\n- [x] X — 2026-10-29\n`;
    expect(mergeChangelog(existing, [block("2026-11-14", "N")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] N — 2026-11-14\n\n## 2026-10\n\n- [x] X — 2026-10-29\n`
    );
  });

  it("nowy, starszy miesiąc ląduje pod istniejącymi", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n`;
    expect(mergeChangelog(existing, [block("2026-10-29", "X")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n\n## 2026-10\n\n- [x] X — 2026-10-29\n`
    );
  });

  it("## Bez daty zawsze na dole: nowy miesiąc idzie nad nią, bez daty dopisuje na końcu", () => {
    const existing = `${HEAD}## Bez daty\n\n- [x] Old\n`;
    expect(mergeChangelog(existing, [block("2026-11-14", "N")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] N — 2026-11-14\n\n## Bez daty\n\n- [x] Old\n`
    );
    expect(mergeChangelog(existing, [block(null, "New")], "Demo")).toBe(
      `${HEAD}## Bez daty\n\n- [x] Old\n- [x] New\n`
    );
    expect(
      mergeChangelog(`${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n`, [block(null, "Z")], "Demo")
    ).toBe(`${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n\n## Bez daty\n\n- [x] Z\n`);
  });

  it("bez deduplikacji: identyczne linie w jednej archiwizacji i już obecne trafiają wszystkie", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n`;
    expect(
      mergeChangelog(existing, [block("2026-11-13", "A"), block("2026-11-13", "A")], "Demo")
    ).toBe(
      `${HEAD}## 2026-11\n\n- [x] A — 2026-11-13\n- [x] A — 2026-11-13\n- [x] A — 2026-11-13\n`
    );
  });

  it("blok z wciętymi liniami dopisuje się w całości, istniejący blok nie jest rozcinany", () => {
    const existing = `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n  - sub B\n- [x] D — 2026-11-10\n`;
    expect(mergeChangelog(existing, [block("2026-11-12", "C", "  - sub C")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\n- [x] B — 2026-11-14\n  - sub B\n- [x] C — 2026-11-12\n  - sub C\n- [x] D — 2026-11-10\n`
    );
  });

  it("proza poza nagłówkami i w sekcjach zostaje bajt w bajt", () => {
    const existing = `${HEAD}Notatka ręczna.\n\n## 2026-11\n\n- [x] A — 2026-11-13\n\nProza w sekcji.\n`;
    expect(mergeChangelog(existing, [block("2026-11-14", "B")], "Demo")).toBe(
      `${HEAD}Notatka ręczna.\n\n## 2026-11\n\n- [x] B — 2026-11-14\n- [x] A — 2026-11-13\n\nProza w sekcji.\n`
    );
  });

  it("pusta sekcja z prozą (bez zadań): blok po ostatniej niepustej linii", () => {
    const existing = `${HEAD}## 2026-11\n\nProza.\n\n## 2026-10\n\n- [x] X — 2026-10-29\n`;
    expect(mergeChangelog(existing, [block("2026-11-14", "B")], "Demo")).toBe(
      `${HEAD}## 2026-11\n\nProza.\n\n- [x] B — 2026-11-14\n\n## 2026-10\n\n- [x] X — 2026-10-29\n`
    );
  });

  it("nieznany nagłówek ##: DomainError 422 z nazwą pliku", () => {
    const run = () =>
      mergeChangelog(`${HEAD}## Foo\n\n- [x] a\n`, [block("2026-11-14", "B")], "Demo");
    expect(run).toThrow(DomainError);
    expect(run).toThrow(/changelog\.md ma nieznany nagłówek „Foo”/);
    try {
      run();
    } catch (err) {
      expect((err as DomainError).statusCode).toBe(422);
    }
  });

  it("powtórzony nagłówek: DomainError 422", () => {
    const dup = `${HEAD}## 2026-11\n\n- [x] a — 2026-11-01\n\n## 2026-11\n\n- [x] b — 2026-11-02\n`;
    expect(() => mergeChangelog(dup, [block("2026-11-14", "B")], "Demo")).toThrow(
      /changelog\.md ma powtórzony nagłówek „2026-11”/
    );
  });
});
```

- [ ] **Step 2: Uruchom: czerwone**

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.markdown.test.ts`
Expected: FAIL (`mergeChangelog` nie istnieje).

- [ ] **Step 3: Zaimplementuj w `markdown.ts`**

Dopisz `ArchivedBlock` do importu typów z `@/contexts/bc_projects/models` i `import { archiveDateOf } from "@/lib/schema/archive-date";`. Na końcu pliku:

```ts
// ── changelog.md (archiwizacja zadań) ───────────────────────────────────────────

const CHANGELOG_MONTH_RE = /^\d{4}-\d{2}$/;
const NO_DATE_HEADING = "Bez daty";
const BLOCK_START_RE = /^- \[( |x|X)\] (.*)$/;
const BLOCK_CONTINUATION_RE = /^[ \t]+\S/;

type ChangelogSection = { key: string; heading: number; end: number };
type ChangelogBlock = { start: number; end: number; date: string | null };

/** Sekcje `##` changelogu; nagłówek inny niż `RRRR-MM` / `Bez daty` albo powtórzony to `DomainError` 422. */
function changelogSections(lines: string[]): ChangelogSection[] {
  const heads: number[] = [];
  lines.forEach((line, i) => {
    if (SECTION_RE.test(line)) heads.push(i);
  });
  const seen = new Set<string>();
  return heads.map((heading, i) => {
    const key = SECTION_RE.exec(lines[heading])![1].trim();
    if (key !== NO_DATE_HEADING && !CHANGELOG_MONTH_RE.test(key)) {
      throw new DomainError(`changelog.md ma nieznany nagłówek „${key}”`, 422);
    }
    if (seen.has(key)) throw new DomainError(`changelog.md ma powtórzony nagłówek „${key}”`, 422);
    seen.add(key);
    return { key, heading, end: i + 1 < heads.length ? heads[i + 1] : lines.length };
  });
}

function changelogBlocks(lines: string[], section: ChangelogSection): ChangelogBlock[] {
  const blocks: ChangelogBlock[] = [];
  for (let i = section.heading + 1; i < section.end; i += 1) {
    const match = BLOCK_START_RE.exec(lines[i]);
    if (!match) continue;
    let end = i + 1;
    while (end < section.end && BLOCK_CONTINUATION_RE.test(lines[end])) end += 1;
    blocks.push({ start: i, end, date: archiveDateOf({ text: match[2] }) });
    i = end - 1;
  }
  return blocks;
}

function addChangelogSection(
  lines: string[],
  sections: ChangelogSection[],
  key: string,
  block: ArchivedBlock
): void {
  const chunk = [`## ${key}`, "", ...block.lines, ""];
  // Najnowszy miesiąc na górze: przed pierwszym starszym; w ostateczności nad `Bez daty`; `Bez daty` na dole.
  const before =
    key === NO_DATE_HEADING
      ? undefined
      : (sections.find((s) => s.key !== NO_DATE_HEADING && s.key < key) ??
        sections.find((s) => s.key === NO_DATE_HEADING));
  if (before !== undefined) {
    lines.splice(before.heading, 0, ...chunk);
    return;
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  lines.push("", ...chunk);
}

function insertChangelogBlock(lines: string[], block: ArchivedBlock): void {
  const sections = changelogSections(lines);
  const key = block.date === null ? NO_DATE_HEADING : block.date.slice(0, 7);
  const section = sections.find((s) => s.key === key);
  if (section === undefined) {
    addChangelogSection(lines, sections, key, block);
    return;
  }
  const blocks = changelogBlocks(lines, section);
  if (blocks.length > 0) {
    let at: number;
    if (block.date === null) {
      at = blocks[blocks.length - 1].end;
    } else {
      const newer = blocks.filter((b) => b.date !== null && b.date >= block.date!);
      at = newer.length > 0 ? newer[newer.length - 1].end : blocks[0].start;
    }
    lines.splice(at, 0, ...block.lines);
    return;
  }
  let lastNonBlank = -1;
  for (let i = section.heading + 1; i < section.end; i += 1) {
    if (lines[i].trim() !== "") lastNonBlank = i;
  }
  if (lastNonBlank === -1) lines.splice(section.heading + 1, 0, "", ...block.lines);
  else lines.splice(lastNonBlank + 1, 0, "", ...block.lines);
}

/**
 * Dopisuje zarchiwizowane bloki do `changelog.md` (`null` = nowy plik z nagłówkiem `# Changelog — <nazwa>`).
 * Bez deduplikacji: każdy blok trafia do pliku. Niepoprawny plik (obcy albo powtórzony nagłówek `##`)
 * to `DomainError` 422 zanim cokolwiek zostanie zmienione; reszta pliku zostaje bajt w bajt.
 */
export function mergeChangelog(
  text: string | null,
  blocks: ArchivedBlock[],
  projectName: string
): string {
  const lines =
    text === null || text.trim() === "" ? [`# Changelog — ${projectName}`] : text.split("\n");
  changelogSections(lines);
  for (const block of blocks) insertChangelogBlock(lines, block);
  return lines.join("\n");
}
```

- [ ] **Step 4: Zielone + tsc**

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.markdown.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_projects/repositories/markdown.ts tests/unit/contexts/bc_projects/repositories.markdown.test.ts
git commit -m "feat(projekty): mergeChangelog: format changelog.md i walidacja nagłówków"
```

---

### Task 5: Repozytorium: `archiveDoneTasks` (kroki 0–2)

**Files:**

- Modify: `contexts/bc_projects/repositories/index.ts`
- Test: `tests/unit/contexts/bc_projects/repositories.archive.test.ts` (nowy)

Kroki (spec §4.3): 0) odczyt `tasks.md` i porównanie wersji z `expected` (409 przed dotknięciem changelogu; brak pliku → `archived: 0`); 1) dopisanie do `changelog.md` przez `updateVaultFile` (mutacja lokalna, ponawiana); 2) zapis `tasks.md` bez tych bloków z `expected: file.version` (409, gdy plik zmienił się między krokami). Uszkodzony changelog: `mergeChangelog` rzuca w kroku 1, zanim cokolwiek zapisze.

- [ ] **Step 1: Napisz test**

`tests/unit/contexts/bc_projects/repositories.archive.test.ts`:

```ts
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { RegistryEntry } from "@/contexts/bc_projects/models";
import {
  archiveDoneTasks,
  readAiContext,
  readDevlog,
  readIndexRules,
  readProjectBoard,
  readProjectContent,
  readProjectIndex,
} from "@/contexts/bc_projects/repositories";
import { ConflictError, DomainError } from "@/lib/errors";
import { WorkAreaBlockedError } from "@/lib/nexus/vault-fs";
import { setupTempVault } from "../../helpers/tempVault";

/** Hak po zapisie changelogu (przed zapisem tasks.md): pozwala zasymulować zmianę pliku między krokami. */
const hook = vi.hoisted(() => ({ afterChangelog: null as null | (() => void) }));
vi.mock("@/lib/nexus/vault-fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/nexus/vault-fs")>();
  return {
    ...real,
    updateVaultFile: async (...args: Parameters<typeof real.updateVaultFile>) => {
      const result = await real.updateVaultFile(...args);
      hook.afterChangelog?.();
      return result;
    },
  };
});

const vault = setupTempVault();
const TASKS = "Projects/demo/tasks.md";
const CHANGELOG = "Projects/demo/changelog.md";
const CTX = { today: "2026-11-14", olderThanDays: 3 };

const SAMPLE = `# Tasks — Demo

## Next

- [ ] Otwarte
- [x] Stare — 2026-11-10
- [x] Świeże — 2026-11-13

## Backlog

- [x] Bez daty
`;

function entry(folder = "Projects/demo/"): RegistryEntry {
  return {
    id: "demo",
    name: "Demo",
    status: "",
    priority: "",
    folder,
    localPath: "",
    owner: "personal",
  };
}

const version = () => readProjectBoard(entry()).version;

describe("bc_projects repositories: archiveDoneTasks", () => {
  it("przenosi ukończone do nowego changelog.md i usuwa je z tasks.md", async () => {
    vault.write(TASKS, SAMPLE);
    const result = await archiveDoneTasks(entry(), version(), CTX);
    expect(result.archived).toBe(2);
    expect(vault.read(CHANGELOG)).toBe(
      "# Changelog — Demo\n\n## 2026-11\n\n- [x] Stare — 2026-11-10\n\n## Bez daty\n\n- [x] Bez daty\n"
    );
    expect(vault.read(TASKS)).toBe(
      "# Tasks — Demo\n\n## Next\n\n- [ ] Otwarte\n- [x] Świeże — 2026-11-13\n\n## Backlog\n\n"
    );
  });

  it("dopisuje do istniejącego changelog.md (bez deduplikacji)", async () => {
    vault.write(TASKS, SAMPLE);
    vault.write(CHANGELOG, "# Changelog — Demo\n\n## 2026-11\n\n- [x] Stare — 2026-11-10\n");
    await archiveDoneTasks(entry(), version(), CTX);
    expect(vault.read(CHANGELOG)).toContain(
      "## 2026-11\n\n- [x] Stare — 2026-11-10\n- [x] Stare — 2026-11-10\n"
    );
  });

  it("brak kwalifikujących się zadań: archived 0, żaden plik nie powstaje ani nie zmienia się", async () => {
    const open = "## Next\n\n- [ ] A\n- [x] B — 2026-11-13\n";
    vault.write(TASKS, open);
    const result = await archiveDoneTasks(entry(), version(), CTX);
    expect(result).toEqual({ archived: 0, blocks: [] });
    expect(vault.read(TASKS)).toBe(open);
    expect(vault.read(CHANGELOG)).toBeNull();
  });

  it("brak tasks.md (version null): archived 0 bez zapisu", async () => {
    expect(await archiveDoneTasks(entry(), null, CTX)).toEqual({ archived: 0, blocks: [] });
    expect(vault.read(CHANGELOG)).toBeNull();
  });

  it("zła wersja: ConflictError przed dotknięciem changelog.md", async () => {
    vault.write(TASKS, SAMPLE);
    await expect(
      archiveDoneTasks(entry(), { size: 1, hash: "0".repeat(64) }, CTX)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(vault.read(CHANGELOG)).toBeNull();
    expect(vault.read(TASKS)).toBe(SAMPLE);
  });

  it("zmiana tasks.md między krokami: ConflictError, changelog już zapisany, tasks.md nietknięty", async () => {
    vault.write(TASKS, SAMPLE);
    const v = version();
    const changed = `${SAMPLE}- [ ] Dopisane z zewnątrz\n`;
    hook.afterChangelog = () => fs.writeFileSync(path.join(vault.root, TASKS), changed, "utf8");
    try {
      await expect(archiveDoneTasks(entry(), v, CTX)).rejects.toBeInstanceOf(ConflictError);
    } finally {
      hook.afterChangelog = null;
    }
    expect(vault.read(CHANGELOG)).toContain("- [x] Stare — 2026-11-10");
    expect(vault.read(TASKS)).toBe(changed);
  });

  it("uszkodzony changelog.md: DomainError 422, żaden plik nie zmieniony", async () => {
    const bad = "# Changelog — Demo\n\n## Foo\n\n- [x] a\n";
    vault.write(TASKS, SAMPLE);
    vault.write(CHANGELOG, bad);
    try {
      await archiveDoneTasks(entry(), version(), CTX);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).statusCode).toBe(422);
      expect((err as DomainError).message).toMatch(/changelog\.md/);
    }
    expect(vault.read(CHANGELOG)).toBe(bad);
    expect(vault.read(TASKS)).toBe(SAMPLE);
  });

  it("strażnik zapisu: Work/ odrzucone", async () => {
    await expect(archiveDoneTasks(entry("Work/x/"), null, CTX)).rejects.toBeInstanceOf(
      WorkAreaBlockedError
    );
  });

  it("folder spoza Projects/<id>/: 422", async () => {
    await expect(archiveDoneTasks(entry("Notes/x/"), null, CTX)).rejects.toMatchObject({
      statusCode: 422,
    });
  });
});

describe("changelog.md poza czytnikami kontekstu agenta", () => {
  it("żaden czytnik projektu nie zwraca treści changelog.md", () => {
    vault.write(TASKS, "## Next\n\n- [ ] A\n");
    vault.write("Projects/demo/index.md", "# Demo\n");
    vault.write(
      CHANGELOG,
      "# Changelog — Demo\n\n## 2026-11\n\n- [x] SENTINEL-CHANGELOG — 2026-11-01\n"
    );
    const e = entry();
    const everything = JSON.stringify([
      readProjectContent(e),
      readProjectBoard(e),
      readDevlog(e),
      readProjectIndex(e),
      readAiContext(e),
      readIndexRules(e),
    ]);
    expect(everything).not.toContain("SENTINEL-CHANGELOG");
  });
});
```

- [ ] **Step 2: Uruchom: czerwone**

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.archive.test.ts`
Expected: FAIL (`archiveDoneTasks` nie istnieje).

- [ ] **Step 3: Zaimplementuj w `repositories/index.ts`**

W importach typów z models dopisz `type ArchiveResult,`; zmień importy: `import { mergeChangelog, parseBugs, …` (dodaj `mergeChangelog` do listy z `./markdown`) i `import { applyTaskOp, extractArchivable, readBoardText } from "./tasks-file";`. Pod `writeProjectTasks` dopisz:

```ts
/**
 * Archiwizacja ukończonych zadań do `changelog.md` (spec archiwizacji §4.3).
 * Krok 0: wersja `tasks.md` musi zgadzać się z `expected` (`ConflictError` przed dotknięciem changelogu);
 * brak `tasks.md` albo nic do przeniesienia → `archived: 0` bez zapisu.
 * Krok 1: dopisanie do `changelog.md` (zmiana lokalna, ponawiana po konflikcie; uszkodzony plik to 422).
 * Krok 2: usunięcie tych samych bloków z `tasks.md` z kontrolą wersji (zmiana między krokami to 409).
 * Awaria po kroku 1 zostawia duplikaty w changelogu, nigdy utratę zadań.
 */
export async function archiveDoneTasks(
  entry: RegistryEntry,
  expected: VersionToken | null,
  ctx: { today: string; olderThanDays: number }
): Promise<ArchiveResult> {
  const tasksRel = projectPath(entry.folder, "tasks.md");
  const changelogRel = projectPath(entry.folder, "changelog.md");
  assertWritable(entry, tasksRel);
  assertWritable(entry, changelogRel);
  const file = readVaultFile(tasksRel);
  if (!sameVersion(file?.version ?? null, expected)) {
    throw new ConflictError(`Plik zmienił się w międzyczasie: ${tasksRel}`);
  }
  if (file === null) return { archived: 0, blocks: [] };
  const extracted = extractArchivable(file.text, ctx.today, ctx.olderThanDays);
  if (extracted.text === null || extracted.blocks.length === 0) return { archived: 0, blocks: [] };
  await updateVaultFile(changelogRel, (current) =>
    mergeChangelog(current, extracted.blocks, entry.name)
  );
  writeVaultFile(tasksRel, extracted.text, { expected: file.version });
  return { archived: extracted.blocks.length, blocks: extracted.blocks };
}
```

- [ ] **Step 4: Zielone + tsc + architektura**

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.archive.test.ts tests/unit/contexts/bc_projects/write-boundary.static.test.ts tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS. Jeśli `write-boundary.static.test.ts` wylicza dozwolone pliki zapisu: `changelog.md` leży w `Projects/<id>/` w `repositories/index.ts`, więc nic nie powinno pęknąć; gdyby pękło, napraw kodem (nie testem).

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_projects/repositories/index.ts tests/unit/contexts/bc_projects/repositories.archive.test.ts
git commit -m "feat(projekty): archiveDoneTasks: changelog.md przed tasks.md, kontrola wersji"
```

---

### Task 6: Serwis, router, trasa API, wykluczenie z Notatek

**Files:**

- Modify: `contexts/bc_projects/services/index.ts`, `contexts/bc_projects/router.ts`, `contexts/bc_nexus_docs/models.ts`
- Create: `app/api/projects/[id]/tasks/archive/route.ts`
- Test: `tests/unit/contexts/bc_projects/services.archive.test.ts` (nowy), `tests/unit/contexts/bc_projects/router.archive.test.ts` (nowy), `tests/unit/contexts/bc_projects/services.context-pack.changelog.test.ts` (nowy), `tests/unit/contexts/bc_nexus_docs/services.test.ts` (jedna linia)

- [ ] **Step 1: Test serwisu**

`tests/unit/contexts/bc_projects/services.archive.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistryEntry } from "@/contexts/bc_projects/models";
import { ConflictError, NotFoundError } from "@/lib/errors";

const mockReadRegistry = vi.hoisted(() => vi.fn());
const mockReadProjectIndex = vi.hoisted(() => vi.fn());
const mockReadProjectContent = vi.hoisted(() => vi.fn());
const mockReadProjectState = vi.hoisted(() => vi.fn());
const mockReadDevlog = vi.hoisted(() => vi.fn());
const mockReadProjectBoard = vi.hoisted(() => vi.fn());
const mockArchiveDoneTasks = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/repositories", () => ({
  readRegistry: mockReadRegistry,
  readProjectIndex: mockReadProjectIndex,
  readProjectContent: mockReadProjectContent,
  readProjectState: mockReadProjectState,
  readDevlog: mockReadDevlog,
  readProjectBoard: mockReadProjectBoard,
  archiveDoneTasks: mockArchiveDoneTasks,
}));

import { archiveDone } from "@/contexts/bc_projects/services";

const NOW = new Date(2026, 10, 13, 12, 0);
const VERSION = { size: 12, hash: "a".repeat(64) };
const a: RegistryEntry = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "/tmp/a",
  owner: "personal",
};

describe("bc_projects services: archiveDone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadRegistry.mockReturnValue({ entries: [a], warnings: [] });
    mockReadProjectIndex.mockReturnValue({ whereIStopped: null });
    mockReadProjectContent.mockReturnValue({ tasks: [], bugs: [] });
    mockReadProjectState.mockReturnValue({ state: null, version: null });
    mockReadDevlog.mockReturnValue([]);
    mockReadProjectBoard.mockReturnValue({
      blockers: [],
      now: [],
      next: [],
      icebox: [],
      version: null,
    });
    mockArchiveDoneTasks.mockResolvedValue({ archived: 2, blocks: [] });
  });

  it("woła repozytorium z wersją, dniem serwera i progiem; zwraca świeży projekt i liczbę", async () => {
    const result = await archiveDone("a", VERSION, 3, NOW);
    expect(mockArchiveDoneTasks).toHaveBeenCalledWith(a, VERSION, {
      today: "2026-11-13",
      olderThanDays: 3,
    });
    expect(result.archived).toBe(2);
    expect(result.project.id).toBe("a");
  });

  it("błąd repozytorium (409) przechodzi dalej", async () => {
    mockArchiveDoneTasks.mockRejectedValue(new ConflictError("x"));
    await expect(archiveDone("a", VERSION, 7, NOW)).rejects.toBeInstanceOf(ConflictError);
  });

  it("nieznany projekt: NotFoundError, repozytorium nietknięte", async () => {
    await expect(archiveDone("nie-ma", VERSION, 7, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(mockArchiveDoneTasks).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Test routera**

`tests/unit/contexts/bc_projects/router.archive.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, DomainError } from "@/lib/errors";
import type { ProjectWithContent } from "@/contexts/bc_projects/models";

const mockArchiveDone = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/services", () => ({ archiveDone: mockArchiveDone }));

import { POST as archivePOST } from "@/app/api/projects/[id]/tasks/archive/route";

const HASH = "a".repeat(64);
const project: ProjectWithContent = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "/tmp/a",
  owner: "personal",
  whereIStopped: null,
  freshness: "fresh",
  tasks: [],
  board: { blockers: [], now: [], next: [], icebox: [], version: null },
  bugs: [],
  state: null,
  stateVersion: null,
  devlog: [],
};

const post = (body: unknown) =>
  archivePOST(
    new NextRequest("http://localhost/api/projects/a/tasks/archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "a" }) }
  );

describe("bc_projects router: POST tasks/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArchiveDone.mockResolvedValue({ project, archived: 4 });
  });

  it("200: ProjectDetailDto plus archived, serwis dostaje wersję jako obiekt i próg", async () => {
    const res = await post({ version: `7:${HASH}`, olderThanDays: 5 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("a");
    expect(body.archived).toBe(4);
    expect("folder" in body).toBe(false);
    expect(mockArchiveDone).toHaveBeenCalledWith("a", { size: 7, hash: HASH }, 5);
  });

  it("version null jest przekazane jako null", async () => {
    await post({ version: null, olderThanDays: 7 });
    expect(mockArchiveDone).toHaveBeenCalledWith("a", null, 7);
  });

  it.each([[0], [31]])("olderThanDays %i: 400 bez wywołania serwisu", async (olderThanDays) => {
    const res = await post({ version: null, olderThanDays });
    expect(res.status).toBe(400);
    expect(mockArchiveDone).not.toHaveBeenCalled();
  });

  it("ConflictError → 409, DomainError → jego status", async () => {
    mockArchiveDone.mockRejectedValueOnce(new ConflictError("zmiana"));
    expect((await post({ version: null, olderThanDays: 7 })).status).toBe(409);
    mockArchiveDone.mockRejectedValueOnce(
      new DomainError("changelog.md ma nieznany nagłówek", 422)
    );
    expect((await post({ version: null, olderThanDays: 7 })).status).toBe(422);
  });
});
```

- [ ] **Step 3: Test izolacji paczki kontekstu (prawdziwy vault)**

`tests/unit/contexts/bc_projects/services.context-pack.changelog.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildContextPack } from "@/contexts/bc_projects/services";
import { setupTempVault } from "../../helpers/tempVault";

const vault = setupTempVault();
const TODAY = new Date(2026, 10, 14, 12, 0);

describe("paczka kontekstu a changelog.md", () => {
  it("jest identyczna z changelog.md i bez niego", () => {
    vault.write(
      "Projects/_registry.yaml",
      "projects:\n  - id: demo\n    name: Demo\n    status: active\n    priority: high\n    folder: Projects/demo/\n    local_path: /nonexistent/demo\n"
    );
    vault.write("Projects/demo/index.md", "# Demo\n");
    vault.write("Projects/demo/tasks.md", "## Next\n\n- [ ] Otwarte [now::]\n");
    const without = buildContextPack("demo", TODAY);
    vault.write(
      "Projects/demo/changelog.md",
      "# Changelog — Demo\n\n## 2026-11\n\n- [x] SENTINEL-CHANGELOG — 2026-11-01\n"
    );
    const withChangelog = buildContextPack("demo", TODAY);
    expect(withChangelog).toEqual(without);
    expect(withChangelog.markdown).not.toContain("SENTINEL-CHANGELOG");
  });
});
```

- [ ] **Step 4: Dopisz wiersz do testu Notatek**

W `tests/unit/contexts/bc_nexus_docs/services.test.ts` w tablicy `cases` pod `["Projects/p/devlog.md", false],` dodaj:

```ts
    ["Projects/p/changelog.md", false],
```

- [ ] **Step 5: Uruchom: czerwone**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.archive.test.ts tests/unit/contexts/bc_projects/router.archive.test.ts tests/unit/contexts/bc_projects/services.context-pack.changelog.test.ts tests/unit/contexts/bc_nexus_docs/services.test.ts`
Expected: FAIL (brak `archiveDone`, trasy, wpisu w `PROJECT_EXCLUDED_FILES`). Test paczki może już przechodzić (czytniki nie otwierają changelogu); to oczekiwane: pilnuje regresji.

- [ ] **Step 6: Serwis**

W `services/index.ts` dopisz `archiveDoneTasks` do importu z `@/contexts/bc_projects/repositories` (obok `writeProjectTasks`). Po `applyTaskOp` na końcu pliku:

```ts
/**
 * Archiwizuje ukończone zadania starsze niż `olderThanDays` do `Projects/<id>/changelog.md`
 * (kroki i błędy: `archiveDoneTasks`). Dzień odniesienia to dzień serwera z `now`.
 * Zwraca świeży stan projektu i liczbę przeniesionych zadań (0 = nic się nie zmieniło).
 */
export async function archiveDone(
  id: string,
  version: VersionToken | null,
  olderThanDays: number,
  now: Date = new Date()
): Promise<{ project: ProjectWithContent; archived: number }> {
  const entry = findEntry(id);
  const result = await archiveDoneTasks(entry, version, {
    today: localDate(now),
    olderThanDays,
  });
  return { project: getProject(id, now), archived: result.archived };
}
```

- [ ] **Step 7: Router i trasa**

W `router.ts` dopisz `ArchiveDoneInputSchema` i `toArchiveDto` do importu ze `./schemas` (alfabetycznie: `ArchiveDoneInputSchema` na początku, `toArchiveDto` przed `toContextPackDto`) i po `postTasks`:

```ts
export async function postTasksArchive(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const parsed = await parseBody(req, ArchiveDoneInputSchema);
    if (parsed.success === false) return parsed.response;
    const { id } = await ctx.params;
    // `strict: false` jak w `postTasks`: jawne domknięcie null.
    const { project, archived } = await services.archiveDone(
      id,
      parsed.data.version ?? null,
      parsed.data.olderThanDays
    );
    return NextResponse.json(toArchiveDto(project, archived));
  } catch (err) {
    return handleServiceError(err);
  }
}
```

Nowy plik `app/api/projects/[id]/tasks/archive/route.ts`:

```ts
export { postTasksArchive as POST } from "@/contexts/bc_projects/router";
```

- [ ] **Step 8: Wykluczenie z Notatek**

W `contexts/bc_nexus_docs/models.ts` do `PROJECT_EXCLUDED_FILES` dopisz po `"devlog.md",`:

```ts
  "changelog.md",
```

- [ ] **Step 9: Zielone, tsc, architektura**

Run: `npx vitest run tests/unit/contexts tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add contexts/bc_projects/services/index.ts contexts/bc_projects/router.ts contexts/bc_nexus_docs/models.ts "app/api/projects/[id]/tasks/archive/route.ts" tests/unit/contexts
git commit -m "feat(projekty): POST /api/projects/[id]/tasks/archive, changelog.md poza Notatkami"
```

---

### Task 7: UI: filtr Wszystkie / Otwarte / Ukończone

**Files:**

- Modify: `src/features/projects/ProjectTasksBoard.tsx`, `src/features/projects/projects.css`
- Test: `tests/unit/features/projects/ProjectTasksBoard.test.tsx`

Filtr jest stanem lokalnym (wraca do „Wszystkie” po zmianie projektu, bo `ProjectDossier` montuje tablicę z `key={project.id}`). Filtr tylko ukrywa wiersze: **indeksy zostają oryginalne** (liczone z pełnej kolumny).

- [ ] **Step 1: Napisz testy**

Na końcu `ProjectTasksBoard.test.tsx` dopisz (`findColumn`, `column`, `posts`, `dragTo`, `makeApi`, `detail`, `board`, `json`, `V` już są w pliku):

```tsx
const mixedBoard = () =>
  board({
    now: [{ text: "Teraz1", done: false }],
    next: [
      { text: "N-otwarte", done: false },
      { text: "N-gotowe", done: true, doneDate: "2026-11-12" },
      { text: "N-za-gotowym", done: false },
    ],
    icebox: [{ text: "I-gotowe", done: true, doneDate: "2026-11-01" }],
  });

describe("ProjectTasksBoard: filtr otwarte / ukończone", () => {
  const renderMixed = async (onPost?: Parameters<typeof makeApi>[1]) => {
    const api = makeApi(detail(mixedBoard()), onPost);
    render(<ProjectsView apiFetch={api} />);
    await findColumn("Następne");
    return api;
  };
  const pick = (name: string) => userEvent.setup().click(screen.getByRole("button", { name }));

  it("„Otwarte” ukrywa ukończone, „Ukończone” ukrywa otwarte, „Wszystkie” pokazuje oba", async () => {
    await renderMixed();
    const next = () => within(column("Następne"));
    expect(next().getByText("N-gotowe")).toBeInTheDocument();
    await pick("Otwarte");
    expect(next().queryByText("N-gotowe")).not.toBeInTheDocument();
    expect(next().getByText("N-otwarte")).toBeInTheDocument();
    expect(next().getByText("N-za-gotowym")).toBeInTheDocument();
    await pick("Ukończone");
    expect(next().getByText("N-gotowe")).toBeInTheDocument();
    expect(next().queryByText("N-otwarte")).not.toBeInTheDocument();
    await pick("Wszystkie");
    expect(next().getByText("N-otwarte")).toBeInTheDocument();
    expect(next().getByText("N-gotowe")).toBeInTheDocument();
  });

  it("pusta kolumna w widoku filtrowanym: „Brak otwartych” / „Brak ukończonych”", async () => {
    await renderMixed();
    await pick("Otwarte");
    expect(within(column("Icebox")).getByText("Brak otwartych")).toBeInTheDocument();
    await pick("Ukończone");
    expect(within(column("Teraz")).getByText("Brak ukończonych")).toBeInTheDocument();
    expect(within(column("Blokery")).getByText("Brak ukończonych")).toBeInTheDocument();
  });

  it("licznik kolumny pokazuje widoczne zadania, a n/NOW_LIMIT w Teraz zostaje z pełnych danych", async () => {
    await renderMixed();
    expect(within(column("Następne")).getByText("3 zadania")).toBeInTheDocument();
    await pick("Otwarte");
    expect(within(column("Następne")).getByText("2 zadania")).toBeInTheDocument();
    await pick("Ukończone");
    expect(within(column("Następne")).getByText("1 zadanie")).toBeInTheDocument();
    expect(within(column("Teraz")).getByText("1/3")).toBeInTheDocument();
  });

  it("„Ukończone” ukrywa formularze dodawania, pozostałe filtry je zostawiają", async () => {
    await renderMixed();
    await pick("Otwarte");
    expect(screen.getByLabelText("Dodaj zadanie: Następne")).toBeInTheDocument();
    await pick("Ukończone");
    expect(screen.queryByLabelText("Dodaj zadanie: Następne")).not.toBeInTheDocument();
  });

  it("pod filtrem „Otwarte” toggle, edit, remove i move wysyłają ORYGINALNY indeks", async () => {
    const user = userEvent.setup();
    const api = await renderMixed();
    await user.click(screen.getByRole("button", { name: "Otwarte" }));

    await user.click(within(column("Następne")).getByRole("checkbox", { name: "N-za-gotowym" }));
    await user.click(screen.getByRole("button", { name: "Edytuj: N-za-gotowym" }));
    const input = screen.getByLabelText("Edytuj zadanie");
    await user.clear(input);
    await user.type(input, "Nowy");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await user.click(screen.getByRole("button", { name: "Usuń: N-za-gotowym" }));
    await user.click(screen.getByRole("button", { name: "Potwierdź usunięcie: N-za-gotowym" }));
    // Przeciąganie jest zablokowane, dopóki trwa mutacja (`busy`): czekamy, aż uchwyt znów jest aktywny.
    await waitFor(() => expect(handle("N-za-gotowym")).toHaveAttribute("draggable", "true"));
    dragTo("N-za-gotowym", "Icebox");

    await waitFor(() => expect(posts(api)).toHaveLength(4));
    expect(posts(api)).toEqual([
      { op: "toggle", column: "next", index: 2, text: "N-za-gotowym", version: V },
      { op: "edit", column: "next", index: 2, text: "N-za-gotowym", newText: "Nowy", version: V },
      { op: "remove", column: "next", index: 2, text: "N-za-gotowym", version: V },
      { op: "move", column: "next", index: 2, text: "N-za-gotowym", to: "icebox", version: V },
    ]);
  });

  it("zmiana filtra zamyka otwartą edycję i potwierdzenie usunięcia", async () => {
    const user = userEvent.setup();
    await renderMixed();
    await user.click(screen.getByRole("button", { name: "Edytuj: N-otwarte" }));
    expect(screen.getByLabelText("Edytuj zadanie")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Otwarte" }));
    expect(screen.queryByLabelText("Edytuj zadanie")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Usuń: N-otwarte" }));
    expect(
      screen.getByRole("button", { name: "Potwierdź usunięcie: N-otwarte" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wszystkie" }));
    expect(
      screen.queryByRole("button", { name: "Potwierdź usunięcie: N-otwarte" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usuń: N-otwarte" })).toBeInTheDocument();
  });
});
```

Uwaga: `pick` w pierwszych testach tworzy nowe `userEvent.setup()` przy każdym kliknięciu, co jest dopuszczalne; w testach z wieloma krokami używany jest jeden `user`.

- [ ] **Step 2: Uruchom: czerwone**

Run: `npx vitest run tests/unit/features/projects/ProjectTasksBoard.test.tsx`
Expected: FAIL (brak przycisków filtra).

- [ ] **Step 3: Zaimplementuj filtr w `ProjectTasksBoard.tsx`**

Pod `COLUMNS` dodaj:

```tsx
type Filter = "all" | "open" | "done";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Wszystkie" },
  { key: "open", label: "Otwarte" },
  { key: "done", label: "Ukończone" },
];

const EMPTY_TEXT: Record<Filter, string> = {
  all: "Brak",
  open: "Brak otwartych",
  done: "Brak ukończonych",
};

const matchesFilter = (filter: Filter, task: BoardTaskDto) =>
  filter === "all" || (filter === "done") === task.done;
```

W komponencie, pod `drafts`:

```tsx
const [filter, setFilter] = useState<Filter>("all");

/** Zmiana filtra zamyka edycję i potwierdzenie usunięcia (trzymane po pozycji). */
const changeFilter = (next: Filter) => {
  setFilter(next);
  setEditing(null);
  setConfirming(null);
};
```

W `return`, pod blokiem `{error ? … : null}` a nad `COLUMNS.map`, dodaj:

```tsx
<div className="prj-board__toolbar">
  <div className="prj-board__filter" role="group" aria-label="Filtr zadań">
    {FILTERS.map(({ key, label }) => (
      <button
        key={key}
        type="button"
        className={filter === key ? "prj-btn prj-btn--primary" : "prj-btn"}
        aria-pressed={filter === key}
        onClick={() => changeFilter(key)}
      >
        {label}
      </button>
    ))}
  </div>
</div>
```

W `COLUMNS.map` zastąp `const tasks = board[key];` przez:

```tsx
const tasks = board[key];
// Indeksy zostają oryginalne (z pełnej kolumny): filtr tylko ukrywa wiersze.
const visible = tasks
  .map((task, index) => ({ task, index }))
  .filter(({ task }) => matchesFilter(filter, task));
```

Licznik: `{countLabel(key, tasks.length)}` → `{countLabel(key, visible.length)}` (licznik `n/NOW_LIMIT` w `Teraz` zostaje z `board.now.length`). Pusta kolumna i lista:

```tsx
{
  visible.length === 0 ? <p className="prj-task-empty">{EMPTY_TEXT[filter]}</p> : null;
}
<ul className="prj-task-list">{visible.map(({ task, index }) => renderTask(key, task, index))}</ul>;
```

Formularz dodawania owiń warunkiem: `{filter === "done" ? null : (<form className="prj-board__add" …>…</form>)}` (treść formularza bez zmian).

- [ ] **Step 4: CSS**

W `projects.css` pod `.prj-board__alert` dopisz:

```css
.prj-board__toolbar {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
}

.prj-board__filter {
  display: inline-flex;
  gap: var(--s-1);
}
```

- [ ] **Step 5: Zielone + tsc + lint**

Run: `npx vitest run tests/unit/features/projects && npx tsc --noEmit && npm run lint`
Expected: PASS (istniejące testy tablicy bez zmian: domyślnie „Wszystkie”, „Brak” dla pustej kolumny).

- [ ] **Step 6: Commit**

```bash
git add src/features/projects/ProjectTasksBoard.tsx src/features/projects/projects.css tests/unit/features/projects/ProjectTasksBoard.test.tsx
git commit -m "feat(projekty): filtr zadań Wszystkie / Otwarte / Ukończone na tablicy"
```

---

### Task 8: UI: „Archiwizuj ukończone”

**Files:**

- Modify: `src/features/projects/mutation.ts`, `src/features/projects/useProjects.ts`, `src/features/projects/ProjectsView.tsx`, `src/features/projects/ProjectDossier.tsx`, `src/features/projects/ProjectTasksBoard.tsx`, `src/features/projects/projects.css`
- Test: `tests/unit/features/projects/ProjectTasksBoard.test.tsx`

- [ ] **Step 1: Rozszerz `makeApi` w teście o trasę archiwizacji**

W `makeApi` (`ProjectTasksBoard.test.tsx`) **przed** gałęzią `/api/projects/a/tasks` dodaj:

```tsx
if (url === "/api/projects/a/tasks/archive" && options?.method === "POST") {
  const body = JSON.parse(String(options.body));
  return onPost ? onPost(body) : json({ ...initial, archived: 0 });
}
```

- [ ] **Step 2: Napisz testy**

Na końcu pliku. Data „dziś” jest sztywna (`2026-11-14`) przez fałszywy `Date` (timery zostają prawdziwe):

```tsx
describe("ProjectTasksBoard: archiwizacja ukończonych", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 14, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  // Dziś 2026-11-14. N = 7: M = 1 (tylko „Bez daty”); N = 3: M = 2 (Stare 11-10 i „Bez daty”), K = 1.
  const archBoard = () =>
    board({
      now: [],
      next: [
        { text: "Otwarte", done: false },
        { text: "Stare", done: true, doneDate: "2026-11-10" },
        { text: "Świeże", done: true, doneDate: "2026-11-12" },
      ],
      icebox: [{ text: "Bez daty", done: true }],
    });
  const BTN = (m: number) => ({ name: `Archiwizuj ukończone (${m})` });
  const setDays = (user: ReturnType<typeof userEvent.setup>, days: string) =>
    user.selectOptions(screen.getByLabelText("Archiwizuj starsze niż"), days);

  it("przycisk ukryty przy M = 0 (same otwarte)", async () => {
    render(
      <ProjectsView
        apiFetch={makeApi(detail(board({ icebox: [], next: [{ text: "A", done: false }] })))}
      />
    );
    await findColumn("Następne");
    expect(screen.queryByRole("button", { name: /Archiwizuj ukończone/ })).not.toBeInTheDocument();
  });

  it("M zmienia się z progiem; przy M = 0 dla progu przycisk wraca po zmianie progu", async () => {
    const user = userEvent.setup();
    render(<ProjectsView apiFetch={makeApi(detail(archBoard()))} />);
    expect(await screen.findByRole("button", BTN(1))).toBeInTheDocument();
    await setDays(user, "3");
    expect(screen.getByRole("button", BTN(2))).toBeInTheDocument();

    cleanup();
    const only = board({
      now: [],
      icebox: [],
      next: [{ text: "Stare", done: true, doneDate: "2026-11-10" }],
    });
    render(<ProjectsView apiFetch={makeApi(detail(only))} />);
    await findColumn("Następne");
    expect(screen.queryByRole("button", { name: /Archiwizuj ukończone/ })).not.toBeInTheDocument();
    await setDays(userEvent.setup(), "3");
    expect(screen.getByRole("button", BTN(1))).toBeInTheDocument();
  });

  it("potwierdzenie: „(w tym K bez daty)” tylko gdy K > 0", async () => {
    const user = userEvent.setup();
    render(<ProjectsView apiFetch={makeApi(detail(archBoard()))} />);
    await user.click(await screen.findByRole("button", BTN(1)));
    expect(
      screen.getByText("Przenieść 1 zadań do changelog.md (w tym 1 bez daty)?")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anuluj archiwizację" }));
    expect(screen.queryByText(/Przenieść/)).not.toBeInTheDocument();

    cleanup();
    const dated = board({
      now: [],
      icebox: [],
      next: [{ text: "Stare", done: true, doneDate: "2026-11-10" }],
    });
    render(<ProjectsView apiFetch={makeApi(detail(dated))} />);
    await findColumn("Następne");
    await setDays(userEvent.setup(), "3");
    await userEvent.setup().click(screen.getByRole("button", BTN(1)));
    expect(screen.getByText("Przenieść 1 zadań do changelog.md?")).toBeInTheDocument();
  });

  it("potwierdzenie → POST /tasks/archive z wersją i progiem; komunikat z archived z odpowiedzi", async () => {
    const user = userEvent.setup();
    const after = board({ now: [], icebox: [], next: [{ text: "Otwarte", done: false }] });
    const api = makeApi(detail(archBoard()), () => json({ ...detail(after), archived: 2 }));
    render(<ProjectsView apiFetch={api} />);
    await findColumn("Następne");
    await setDays(user, "3");
    await user.click(screen.getByRole("button", BTN(2)));
    await user.click(screen.getByRole("button", { name: "Potwierdź archiwizację" }));
    expect(posts(api)).toEqual([{ version: V, olderThanDays: 3 }]);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Przeniesiono 2 zadań do changelog.md"
    );
    expect(screen.queryByRole("button", { name: /Archiwizuj ukończone/ })).not.toBeInTheDocument();
  });

  it("konflikt 409: komunikat i ponowne pobranie szczegółów", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(archBoard()), () =>
      json({ error: "Plik zadań zmienił się w międzyczasie" }, 409)
    );
    render(<ProjectsView apiFetch={api} />);
    await user.click(await screen.findByRole("button", BTN(1)));
    await user.click(screen.getByRole("button", { name: "Potwierdź archiwizację" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/zmienił się|odświeżono/i);
    await waitFor(() =>
      expect(
        api.mock.calls.filter((c) => c[0] === "/api/projects/a").length
      ).toBeGreaterThanOrEqual(2)
    );
  });

  it("M nie zmienia się po przełączeniu filtra (liczony z pełnej tablicy)", async () => {
    const user = userEvent.setup();
    render(<ProjectsView apiFetch={makeApi(detail(archBoard()))} />);
    await screen.findByRole("button", BTN(1));
    await user.click(screen.getByRole("button", { name: "Otwarte" }));
    expect(screen.getByRole("button", BTN(1))).toBeInTheDocument();
  });
});
```

Dopisz do importów testu `beforeEach` z `vitest` (`import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";`).

- [ ] **Step 3: Uruchom: czerwone**

Run: `npx vitest run tests/unit/features/projects/ProjectTasksBoard.test.tsx`
Expected: FAIL (brak select/przycisku).

- [ ] **Step 4: `mutation.ts`**

```ts
/** Wynik zapisu z karty Projekty (Save State, devlog, typ); wspólny dla komponentów i `useProjects`.
 * `archived`: liczba przeniesionych zadań (tylko odpowiedź archiwizacji). */
export type MutationResult =
  | { ok: true; archived?: number }
  | { ok: false; error: string; conflict: boolean };
```

W `ProjectActions` pod `tasksOp`:

```ts
/** Archiwizacja ukończonych zadań starszych niż N dni do `changelog.md` (`version`: `board.version`). */
archiveDone: (version: string | null, olderThanDays: number) => Promise<MutationResult>;
```

- [ ] **Step 5: `useProjects.ts`**

W `mutateProject`: `const updated = (await res.json()) as ProjectDetailDto & { archived?: number };` i zamiast `return { ok: true };`:

```ts
return typeof updated.archived === "number"
  ? { ok: true, archived: updated.archived }
  : { ok: true };
```

Pod `tasksOp`:

```ts
const archiveDone = useCallback(
  (version: string | null, olderThanDays: number) =>
    mutate("POST", "/tasks/archive", { version, olderThanDays }),
  [mutate]
);
```

oraz dodaj `archiveDone` do obiektu zwracanego z hooka (obok `tasksOp`, linia ~272) i — jeśli hook ma jawny typ zwrotu — do tego typu.

- [ ] **Step 6: `ProjectsView.tsx` i `ProjectDossier.tsx`**

W `ProjectsView.tsx`: w destrukturyzacji `useProjects()` dopisz `archiveDone`, a w `actions={{ … }}` dopisz `archiveDone,` (po `tasksOp,`). W `ProjectDossier.tsx` w `<ProjectTasksBoard … />` dodaj `onArchive={actions.archiveDone}` (po `onOp`).

- [ ] **Step 7: `ProjectTasksBoard.tsx`**

Importy: `ARCHIVE_DAYS_OPTIONS, ARCHIVE_DEFAULT_DAYS, archiveDateOf, isArchivable, localIsoDate` dopisz do importu ze `@/contexts/bc_projects/schemas`. Prop: `onArchive: (version: string | null, olderThanDays: number) => Promise<MutationResult>;`, destrukturyzacja `const { board, onOp, onArchive, onReload } = props;`.

Stany (pod `filter`):

```tsx
const [days, setDays] = useState<number>(ARCHIVE_DEFAULT_DAYS);
const [confirmingArchive, setConfirmingArchive] = useState(false);
const [notice, setNotice] = useState<string | null>(null);
```

M i K liczone z **pełnej** tablicy (nie z widoku), tymi samymi funkcjami co serwer:

```tsx
const allTasks = COLUMNS.flatMap(({ key }) => board[key]);
const today = localIsoDate(new Date());
const archivable = allTasks.filter((t) => isArchivable(t, today, days));
const archiveCount = archivable.length;
const archiveNoDate = archivable.filter((t) => archiveDateOf(t) === null).length;
const hasDone = allTasks.some((t) => t.done);
```

Zamień `run` na wersję opartą o wspólne `exec`:

```tsx
/** Jedna mutacja naraz (wspólny `busy`/`error`/konflikt); wersję pliku dopisuje wywołujący. */
const exec = async (call: () => Promise<MutationResult>): Promise<MutationResult> => {
  setBusy(true);
  setError(null);
  setNotice(null);
  const result = await call();
  setBusy(false);
  // Indeksy zadań zmieniają się po każdej udanej mutacji, więc otwarta edycja i potwierdzenie
  // usunięcia (trzymane po indeksie) przestałyby wskazywać to samo zadanie.
  if (result.ok === true) {
    setEditing(null);
    setConfirming(null);
  }
  // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
  if (result.ok === false) {
    setError(result.conflict ? CONFLICT_MESSAGE : result.error);
    if (result.conflict) {
      setEditing(null);
      setConfirming(null);
      onReload();
    }
  }
  return result;
};

const run = async (input: TaskOpInputDto): Promise<boolean> =>
  (await exec(() => onOp(input))).ok === true;

const confirmArchive = async () => {
  if (busy) return;
  const result = await exec(() => onArchive(board.version, days));
  setConfirmingArchive(false);
  if (result.ok === true) {
    setNotice(`Przeniesiono ${result.archived ?? 0} zadań do changelog.md`);
  }
};
```

W `changeFilter` nic nie zmieniaj. W toolbarze, po grupie filtra, dodaj:

```tsx
{
  hasDone ? (
    <div className="prj-board__archive">
      <span>starsze niż</span>
      <select
        aria-label="Archiwizuj starsze niż"
        value={days}
        disabled={busy}
        onChange={(e) => {
          setDays(Number(e.target.value));
          setConfirmingArchive(false);
        }}
      >
        {ARCHIVE_DAYS_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {d} dni
          </option>
        ))}
      </select>
      {archiveCount === 0 ? null : confirmingArchive ? (
        <>
          <span>
            {`Przenieść ${archiveCount} zadań do changelog.md${
              archiveNoDate > 0 ? ` (w tym ${archiveNoDate} bez daty)` : ""
            }?`}
          </span>
          <button
            type="button"
            className="prj-btn prj-btn--danger"
            aria-label="Potwierdź archiwizację"
            disabled={busy}
            onClick={confirmArchive}
          >
            Tak
          </button>
          <button
            type="button"
            className="prj-btn"
            aria-label="Anuluj archiwizację"
            disabled={busy}
            onClick={() => setConfirmingArchive(false)}
          >
            Anuluj
          </button>
        </>
      ) : (
        <button
          type="button"
          className="prj-btn"
          disabled={busy}
          onClick={() => setConfirmingArchive(true)}
        >
          {`Archiwizuj ukończone (${archiveCount})`}
        </button>
      )}
    </div>
  ) : null;
}
```

Komunikat sukcesu, pod blokiem `{error ? … : null}`:

```tsx
{
  notice ? (
    <p className="prj-board__notice" role="status">
      {notice}
    </p>
  ) : null;
}
```

- [ ] **Step 8: CSS**

W `projects.css` pod `.prj-board__filter`:

```css
.prj-board__archive {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
  margin-left: auto;
  font: 500 var(--fs-xs) / 1.4 var(--font-mono);
  color: var(--muted);
}

.prj-board__notice {
  grid-column: 1 / -1;
  margin: 0;
  font: 500 var(--fs-xs) / 1.4 var(--font-mono);
  color: var(--muted);
}
```

- [ ] **Step 9: Zielone + tsc + lint**

Run: `npx vitest run tests/unit/features/projects tests/unit/architecture.static.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS. Typ `MutationResult` jest używany też w innych komponentach (`ProjectSaveState`, dziennik): rozszerzenie o opcjonalne pole niczego nie psuje; gdyby `tsc` zgłosił błąd w teście `useProjects`, popraw kodem produkcyjnym.

- [ ] **Step 10: Commit**

```bash
git add src/features/projects tests/unit/features/projects
git commit -m "feat(projekty): przycisk „Archiwizuj ukończone” z progiem 3/5/7 dni i potwierdzeniem"
```

---

### Task 9: Mapa pomija `tasks.md`, `devlog.md`, `changelog.md`

**Files:**

- Modify: `contexts/bc_map/repositories.ts`
- Test: `tests/unit/contexts/bc_map/repositories.test.ts`

Decyzja użytkownika (2026-11-14): pliki robocze projektu (zadania, dziennik, changelog) nie są potrzebne w grafie Mapy. `bc_map` nie może importować `PROJECT_EXCLUDED_FILES` z `bc_nexus_docs` (reguła R2: inny kontekst tylko przez `services`), więc ma własną, małą stałą. Skutek uboczny (zamierzony): znikają węzły tych plików i krawędzie z ich wikilinków (np. `tasks → index`, `tasks → bugs`), więc zmieniają się liczniki linków `index`/`bugs`. Pliki w podkatalogach projektu (`Projects/<id>/sub/tasks.md`) zostają, wykluczamy tylko pliki bezpośrednio w katalogu projektu.

- [ ] **Step 1: Napisz test**

W `tests/unit/contexts/bc_map/repositories.test.ts` dopisz test w tym samym `describe` co „czyta notatki trzech obszarów” (obok niego):

```ts
it("pomija pliki robocze projektu (tasks, devlog, changelog), zostawia resztę i podkatalogi", () => {
  vault.write("Projects/nexus/index.md", "i");
  vault.write("Projects/nexus/nexus.md", "n");
  vault.write("Projects/nexus/tasks.md", "- [[nexus/index|Info]]");
  vault.write("Projects/nexus/devlog.md", "d");
  vault.write("Projects/nexus/changelog.md", "c");
  vault.write("Projects/nexus/sub/tasks.md", "zostaje");
  expect(readMapSources().notes.map((n) => n.path)).toEqual([
    "Projects/nexus/index",
    "Projects/nexus/nexus",
    "Projects/nexus/sub/tasks",
  ]);
});
```

- [ ] **Step 2: Uruchom: czerwone**

Run: `npx vitest run tests/unit/contexts/bc_map/repositories.test.ts`
Expected: FAIL (w liście są `tasks`, `devlog`, `changelog`).

- [ ] **Step 3: Zaimplementuj**

W `contexts/bc_map/repositories.ts` pod `const AREAS = [...] as const;` dodaj:

```ts
/** Pliki robocze projektu (bezpośrednio w `Projects/<id>/`), niepotrzebne w grafie. */
const PROJECT_WORK_FILES: readonly string[] = ["tasks.md", "devlog.md", "changelog.md"];
```

a w pętli po `if (area === "project" && segments.length < 3) continue;` dopisz:

```ts
if (area === "project" && segments.length === 3 && PROJECT_WORK_FILES.includes(file)) continue;
```

- [ ] **Step 4: Zielone, cały kontekst Mapy, architektura, tsc**

Run: `npx vitest run tests/unit/contexts/bc_map tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_map/repositories.ts tests/unit/contexts/bc_map/repositories.test.ts
git commit -m "feat(mapa): graf pomija tasks.md, devlog.md i changelog.md projektu"
```

---

### Task 10: Weryfikacja końcowa

- [ ] **Step 1: Pełny przebieg** (przez `cursor`, odpowiedź: „przeszło” albo lista `plik:linia + przyczyna`)

Run: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npm run build`
Expected: wszystko zielone. Flaky `ProjectTasksBoard` (pierwsze renderowanie) ma już limit 5 s.

- [ ] **Step 2: Review diffa przez pomocnika** (CLAUDE.md: po większej zmianie z zapisem do vaulta)

```bash
scripts/ask-helper.sh --role review agy "Zrób niezależny review diffa gałęzi feat/archiwizacja-zadan względem main (git diff main...HEAD). Spec: docs/superpowers/specs/2026-11-14-archiwizacja-ukonczonych-zadan-design.md. Szukaj: błędów w kolejności zadań w tasks-file.ts, utraty zadań przy archiwizacji, ścieżek zapisu poza Projects/<id>/, niezgodności ze specem. Odpowiedz listą plik:linia + problem; bez pochwał."
```

Opinie traktuj jak hipotezy: zweryfikuj w kodzie przed zmianą.

- [ ] **Step 3: Ręczna weryfikacja w przeglądarce** (spec §8)

Uruchom aplikację (`npm run dev`), karta Projekty → projekt `monolith`: próg 3 dni, przycisk „Archiwizuj ukończone (M)” pokazuje M zgodne z `tasks.md` (K „bez daty” w potwierdzeniu), potwierdzenie, odświeżenie tablicy, komunikat „Przeniesiono M zadań do changelog.md”, plik `../NEXUS/Vault/Projects/monolith/changelog.md` (miesiące malejąco, `## Bez daty` na dole, zadania z dopiskiem po dacie w swoim miesiącu). Sprawdź też, że `changelog.md` nie pojawia się w panelu Notatki. **Uwaga:** to prawdziwy vault; przed próbą zrób kopię `tasks.md` (`cp` do scratchpadu) albo użyj kopii projektu.

- [ ] **Step 4: Dokończ gałąź**

Użyj `superpowers:finishing-a-development-branch` (PR do `main`). Gałęzie `docs/kalendarz-format-vault` i `feat/kalendarz-scroll-do-teraz` czekają na wypchnięcie (poza zakresem tego planu).

---

## Self-review (spec ↔ plan)

| Wymóg specu                                                                                                                               | Zadanie                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| §3 kolejność (toggle/add/move, punkt po wycięciu bloku, sekcje: wymieszana / same ukończone / bez zadań, `next`↔`now` bez zmian)          | Task 1                                                  |
| §4.1 `archiveDateOf` (dopisek po dacie), wiek z dat UTC, DST, K bez daty, otwarte nigdy                                                   | Task 2 (funkcje), Task 3 (`extractArchivable`, fixture) |
| §4.1 próg 1–30 w zod, UI 3/5/7 domyślnie 7                                                                                                | Task 2 (`ArchiveDoneInputSchema`, stałe), Task 8        |
| §4.2 format (miesiące malejąco, `Bez daty` na dole, bez deduplikacji, uszkodzony plik 422, proza bajt w bajt)                             | Task 4                                                  |
| §4.3 kroki 0–2, 409 przed changelogiem, brak pliku → 0, `assertWritable` / `Work/`                                                        | Task 5                                                  |
| §4.4 izolacja: czytniki, Notatki (`PROJECT_EXCLUDED_FILES`), paczka identyczna; Mapa bez zmian                                            | Task 5 (czytniki), Task 6 (paczka, Notatki)             |
| §5 trasa, router, serwis, odpowiedź `ProjectDetailDto` + `archived`                                                                       | Task 2 (`toArchiveDto`), Task 6                         |
| §6 UI: przycisk, select, potwierdzenie z K, `onArchive`, `busy`/konflikt, komunikat                                                       | Task 8                                                  |
| §6.1 filtr (indeksy oryginalne, liczniki z pełnych danych, „Ukończone” ukrywa formularze, „Brak otwartych/ukończonych”, zamykanie edycji) | Task 7 (+ M niezależne od filtra: Task 8)               |
| §4.4 Mapa (decyzja użytkownika: pliki robocze poza grafem)                                                                                | Task 9                                                  |
| §7 błędy i testy, §8 kolejność commitów                                                                                                   | Taski 1–9, Task 10                                      |

Spójność nazw: `taskInsertIndex`/`reorderBlock` (Task 1), `extractArchivable` → `{ text, blocks }` (Task 3) używane w `archiveDoneTasks` (Task 5), `ArchivedBlock`/`ArchiveResult` (Task 3) w `mergeChangelog` (Task 4) i repozytorium, `archiveDone(id, version, olderThanDays, now)` (Task 6) wołane z routera, `ProjectActions.archiveDone(version, olderThanDays)` (Task 8) = `onArchive`.

Świadome luki: (1) spec §3 mówi o `completeNowTask` z Kokpitu: idzie przez `toggle`, więc dziedziczy regułę bez zmian kodu (pokrywa to test `toggle zadania [now::]`); (2) decyzja o Mapie zmieniona względem specu §4.4 (Task 9: wykluczamy, zamiast zostawiać w grafie); (3) zmiana skilla `nexus-session` w repo NEXUS jest poza zakresem (spec §2).
