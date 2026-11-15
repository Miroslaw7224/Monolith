# Zadania: status „Odłożone” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nowy status `deferred` („Odłożone”) zadań ogólnych: pierwsza kolumna tablicy Zadań, całkowicie wykluczana z kolejki Kokpitu, z terminów w kalendarzu i ze statystyk terminów.

**Architecture:** Status to kolejna wartość pola `status::` w linii zadania (`lib/nexus/task-line.ts`); `bc_tasks` przepuszcza go bez zmian logiki (tylko typy). Reguły „odłożone nie liczą się” są trzema jednolinijkowymi filtrami: `bc_cockpit/services` (kolejka), `bc_calendar/services` (terminy) i `taskStatsUtils` (kafelki i filtr terminów). UI dostaje piątą kolumnę, etykietę, opcję w oknie szczegółów i kropkę statusu.

**Tech Stack:** Next.js 14, TypeScript (`strict: false`), Vitest (+ Testing Library, fast-check), CSS bez Tailwinda w kartach.

**Spec:** `docs/superpowers/specs/2026-11-15-zadania-odlozone-design.md` (decyzje D1–D7). **Zasady repo:** `CLAUDE.md` (Struktura kodu); `tests/unit/architecture.static.test.ts` NIE jest zmieniany w tym planie (zmiany testu architektury zawsze osobnym commitem).

**Konwencje komend:** testy `npx vitest run <ścieżka>`, typy `npx tsc --noEmit`, lint `npm run lint`, build `npm run build`. Commity kończą się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hook `lint-staged` przeformatowuje pliki prettierem przy commicie (to normalne).

---

## Mapa plików

| Plik                                                          | Zmiana                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/nexus/task-line.ts`                                      | `TASK_STATUSES` z `deferred` na początku (parser i formatter bez innych zmian)                                                                                                                                                                   |
| `contexts/bc_tasks/models.ts`, `contexts/bc_tasks/schemas.ts` | typ `status` o `"deferred"`                                                                                                                                                                                                                      |
| `contexts/bc_cockpit/services.ts`                             | `loadQueue`: pomija też `deferred`                                                                                                                                                                                                               |
| `contexts/bc_calendar/services.ts`                            | terminy zadań: pomija też `deferred`                                                                                                                                                                                                             |
| `src/features/tasks/taskOrderUtils.ts`                        | `TASK_STATUSES` z `deferred` pierwszym                                                                                                                                                                                                           |
| `src/features/tasks/taskStatsUtils.ts`                        | `computeTaskTiles` i `getTaskDueState` pomijają `deferred`                                                                                                                                                                                       |
| `src/features/tasks/TasksSection.tsx`                         | etykieta kolumny (Task 1), `activeCount` bez odłożonych (Task 3)                                                                                                                                                                                 |
| `src/features/tasks/TaskDetailModal.tsx`                      | opcja statusu „Odłożone”                                                                                                                                                                                                                         |
| `src/features/tasks/tasks.css`                                | `.zad-dot--deferred`, siatka 5 kolumn od 1024 px                                                                                                                                                                                                 |
| `src/translations.ts`                                         | `tasksDeferred` (EN i PL), Task 1 (żeby `tsc` przechodził po każdym commicie)                                                                                                                                                                    |
| `docs/nexus-vault-formaty-yaml.md`                            | wiersz o statusach: dopisać `deferred`                                                                                                                                                                                                           |
| testy                                                         | `tests/unit/lib/nexus/task-line.test.ts`, `tests/unit/contexts/bc_cockpit/services.test.ts`, `tests/unit/contexts/bc_calendar/services.test.ts`, `tests/unit/features/tasks/{taskOrderUtils,taskStatsUtils,TaskDetailModal,TasksSection}.test.*` |

Bez zmian: `bc_tasks/router.ts`, `services.ts`, `repositories/*` (status przechodzi jak każdy inny), `TaskColumn.tsx` (klasa kropki to `zad-dot--${status}`), test architektury.

---

## Task 0: Gałąź

Gałąź `feat/zadania-odlozone` (od `main`) już istnieje i zawiera commit specu (`5faae7d`).

- [ ] **Step 1: Sprawdź gałąź**

Run: `git branch --show-current && git status --short`
Expected: `feat/zadania-odlozone`, brak zmian w drzewie.

---

## Task 1: Format i typy (`deferred` w linii zadania)

**Files:**

- Modify: `lib/nexus/task-line.ts:1`
- Modify: `contexts/bc_tasks/models.ts:7`, `contexts/bc_tasks/schemas.ts:55`
- Test: `tests/unit/lib/nexus/task-line.test.ts`

- [ ] **Step 1: Napisz czerwone testy**

W `tests/unit/lib/nexus/task-line.test.ts`, w `describe("formatTaskLine", …)` po teście „ticks the box only for done…” dopisz:

```ts
it("writes deferred with an empty checkbox and the status field", () => {
  expect(formatTaskLine(task({ status: "deferred" }))).toBe(
    "- [ ] Zadanie [id:: t1] [status:: deferred]"
  );
});
```

W `describe("parseTaskLine", …)` po teście „falls back to the checkbox…” dopisz:

```ts
it("reads status deferred from the field while the checkbox stays empty", () => {
  const parsed = parseTaskLine("- [ ] Kurs Playwright [id:: t9] [status:: deferred]");
  expect(parsed?.status).toBe("deferred");
  expect(parsed?.title).toBe("Kurs Playwright");
});
```

Test własności (`fc.constantFrom(...TASK_STATUSES)`) obejmie `deferred` automatycznie po kroku 3.

- [ ] **Step 2: Uruchom testy, upewnij się, że czerwone**

Run: `npx vitest run tests/unit/lib/nexus/task-line.test.ts`
Expected: FAIL: `reads status deferred…` rzuca `TaskLineError: nieznany status "deferred"`. (Test formatu przechodzi już teraz, bo vitest nie sprawdza typów; pilnuje go `tsc` w Step 4.)

- [ ] **Step 3: Zaimplementuj**

`lib/nexus/task-line.ts`, linia 1:

```ts
export const TASK_STATUSES = ["deferred", "todo", "in_progress", "to_review", "done"] as const;
```

`contexts/bc_tasks/models.ts:7` i `contexts/bc_tasks/schemas.ts:55`:

```ts
status: "deferred" | "todo" | "in_progress" | "to_review" | "done";
```

Rozszerzenie typu `TaskDto["status"]` psuje kompilację `columnLabels: Record<TaskStatus, string>` w `TasksSection.tsx` (`TaskStatus` pochodzi z `Task["status"]`). Żeby każdy commit przechodził `tsc`, dołóż w tym samym commicie minimum UI:

`src/translations.ts`: w bloku EN po `tasksTodo: "To do",` (linia ok. 61) dodaj `tasksDeferred: "Deferred",`; w bloku PL po `tasksTodo: "Do zrobienia",` (linia ok. 307) dodaj `tasksDeferred: "Odłożone",`.

`src/features/tasks/TasksSection.tsx`: w `labels` przed `todo:` dodaj `deferred: (t.tasksDeferred as string) ?? "Deferred",`; w `columnLabels` dodaj jako pierwszy klucz `deferred: labels.deferred,`.

- [ ] **Step 4: Testy zielone i typy**

Run: `npx vitest run tests/unit/lib/nexus/task-line.test.ts`
Expected: PASS (w tym test własności).

Run: `npx tsc --noEmit`
Expected: brak błędów. Jeśli `tsc` zgłasza coś jeszcze (np. inne `Record<TaskStatus, …>` lub porównania statusu), dopisz `deferred` w tym miejscu.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/task-line.ts contexts/bc_tasks/models.ts contexts/bc_tasks/schemas.ts src/translations.ts src/features/tasks/TasksSection.tsx tests/unit/lib/nexus/task-line.test.ts
git commit -m "feat(zadania): status deferred w formacie linii zadania, typach bc_tasks i etykiecie kolumny

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Kokpit i kalendarz pomijają odłożone

**Files:**

- Modify: `contexts/bc_cockpit/services.ts:216-217`
- Modify: `contexts/bc_calendar/services.ts:61`
- Test: `tests/unit/contexts/bc_cockpit/services.test.ts`, `tests/unit/contexts/bc_calendar/services.test.ts`

- [ ] **Step 1: Napisz czerwone testy**

`tests/unit/contexts/bc_cockpit/services.test.ts`, bezpośrednio po teście „zadania ogólne „do sprawdzenia” znikają z kolejki…” (kończy się `expect(titles).toEqual(["W toku pilne"]);` i `});`) dopisz:

```ts
it("zadania ogólne „odłożone” znikają z kolejki, także zaległe, na dziś i pilne", async () => {
  mockGetTasks.mockResolvedValue([
    task({ id: "d1", title: "Kurs Playwright", status: "deferred" }),
    task({ id: "d2", title: "Odłożone na dziś", due_date: "2026-11-13", status: "deferred" }),
    task({
      id: "d3",
      title: "Odłożone zaległe pilne",
      due_date: "2026-11-01",
      priority: 1,
      status: "deferred",
    }),
    task({ id: "a", title: "Aktualne", status: "todo" }),
  ]);

  const { queue, warnings } = await getCockpit(TODAY);
  const titles = queue.flatMap((g) => g.items.map((i) => i.title));

  expect(titles).toEqual(["Aktualne"]);
  expect(warnings.filter((w) => w.includes("Zadania ogólne"))).toEqual([]);
});
```

`tests/unit/contexts/bc_calendar/services.test.ts`, w tym samym `describe`, po teście „given a task due_date outside the requested range…” dopisz:

```ts
it("given a deferred task with a due_date in range, when getCalendarEvents is called, then does not add a task_deadline pseudo-event", async () => {
  mockGetCalendarEvents.mockResolvedValue([]);
  mockGetTasks.mockResolvedValue([
    {
      id: "t1",
      title: "Kurs Playwright",
      description: "",
      status: "deferred",
      due_date: "2025-02-20",
      priority: null,
    },
  ]);

  const result = await getCalendarEvents({
    startDate: "2025-02-01",
    endDate: "2025-02-28",
  });

  expect(result).toEqual([]);
});
```

- [ ] **Step 2: Uruchom testy, upewnij się, że czerwone**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/services.test.ts tests/unit/contexts/bc_calendar/services.test.ts`
Expected: FAIL: kolejka zawiera także „Kurs Playwright”, „Odłożone na dziś”, „Odłożone zaległe pilne”; kalendarz zwraca jeden `task_deadline`.

- [ ] **Step 3: Zaimplementuj**

`contexts/bc_cockpit/services.ts` (w `loadQueue`, pętla po `tasksServices.getTasks()`) zamień dwie linie:

```ts
// w kolejce tylko „do zrobienia” i „w toku”; „do sprawdzenia” (wysłane komuś), „odłożone” (świadomie nie teraz) i „zrobione” nie wracają do kokpitu
if (t.status === "done" || t.status === "to_review" || t.status === "deferred") continue;
```

`contexts/bc_calendar/services.ts:61`:

```ts
.filter((task) => task.due_date && task.status !== "done" && task.status !== "deferred")
```

- [ ] **Step 4: Testy zielone**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/services.test.ts tests/unit/contexts/bc_calendar/services.test.ts`
Expected: PASS (wszystkie, w tym dotychczasowe).

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_cockpit/services.ts contexts/bc_calendar/services.ts tests/unit/contexts/bc_cockpit/services.test.ts tests/unit/contexts/bc_calendar/services.test.ts
git commit -m "feat(zadania): odłożone znikają z kolejki Kokpitu i z terminów w kalendarzu

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 3: UI Zadań (kolumna, statystyki, okno szczegółów, CSS)

**Files:**

- Modify: `src/features/tasks/taskOrderUtils.ts:5`, `src/features/tasks/taskStatsUtils.ts`, `src/features/tasks/TasksSection.tsx`, `src/features/tasks/TaskDetailModal.tsx`, `src/features/tasks/tasks.css`
- Test: `tests/unit/features/tasks/taskOrderUtils.test.ts`, `taskStatsUtils.test.ts`, `TaskDetailModal.test.tsx`, `TasksSection.test.tsx`

- [ ] **Step 1: Napisz czerwone testy**

`tests/unit/features/tasks/taskOrderUtils.test.ts`, w `describe("computeTaskOrderAfterDrop", …)` po teście „moves task to to_review column” dopisz:

```ts
it("puts the deferred column first and moves a task there", () => {
  const { orderedIds, statusChanged } = computeTaskOrderAfterDrop(tasks, "d", "deferred", null);
  expect(statusChanged).toBe(true);
  expect(orderedIds).toEqual(["d", "a", "b", "c"]);
});
```

W `describe("tasksByStatus", …)` zamień tablicę `tasks` i dopisz asercję:

```ts
const tasks = [
  makeTask("0", "deferred"),
  makeTask("1", "todo"),
  makeTask("2", "in_progress"),
  makeTask("3", "to_review"),
  makeTask("4", "done"),
];

it("filters by status", () => {
  expect(tasksByStatus(tasks, "deferred").map((t) => t.id)).toEqual(["0"]);
  expect(tasksByStatus(tasks, "todo").map((t) => t.id)).toEqual(["1"]);
  expect(tasksByStatus(tasks, "in_progress").map((t) => t.id)).toEqual(["2"]);
  expect(tasksByStatus(tasks, "to_review").map((t) => t.id)).toEqual(["3"]);
  expect(tasksByStatus(tasks, "done").map((t) => t.id)).toEqual(["4"]);
});
```

`tests/unit/features/tasks/taskStatsUtils.test.ts` (`NOW` = 14.11.2026; helper `task(id, status, extra)`), w `describe("computeTaskTiles", …)` na końcu dopisz:

```ts
it("nie liczy odłożonych zadań: ani w statusach, ani w terminach", () => {
  const tiles = computeTaskTiles(
    [
      task("a", "deferred", { due_date: "2026-11-10" }),
      task("b", "deferred", { due_date: "2026-11-14" }),
      task("c", "deferred", { due_date: "2026-11-16" }),
      task("d", "todo", { due_date: "2026-11-14" }),
    ],
    NOW
  );
  expect(tiles.deadlines).toEqual({ overdue: 0, today: 1, week: 0 });
  expect(tiles.todo).toEqual({ count: 1, nextDue: "2026-11-14" });
});
```

W `describe("getTaskDueState", …)` na końcu dopisz:

```ts
it("zwraca null dla odłożonego zadania, także zaległego i na dziś", () => {
  expect(getTaskDueState(task("a", "deferred", { due_date: "2026-11-01" }), NOW)).toBeNull();
  expect(getTaskDueState(task("b", "deferred", { due_date: "2026-11-14" }), NOW)).toBeNull();
});
```

`tests/unit/features/tasks/TaskDetailModal.test.tsx`: do `fakeT` dopisz `tasksDeferred: "Odłożone",`, a po teście „allows changing status via status buttons” dopisz:

```ts
it("allows moving the task to deferred", async () => {
  const user = userEvent.setup();
  render(
    <TaskDetailModal task={fakeTask} isOpen={true} t={fakeT} onClose={onClose} onSave={onSave} />
  );

  await user.click(screen.getByRole("button", { name: "Odłożone" }));
  await user.click(screen.getByRole("button", { name: /zapisz/i }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status: "deferred" }));
});
```

`tests/unit/features/tasks/TasksSection.test.tsx` na końcu pliku dopisz (własny mock, jak w `beforeEach`, ale z odłożonym zadaniem):

```ts
test("odłożone zadanie trafia do pierwszej kolumny „Odłożone”", async () => {
  apiFetch.mockImplementation(async (url: string) => {
    if (url === "/api/tasks") {
      return {
        ok: true,
        json: async () => [
          {
            id: "a",
            title: "Alpha",
            link: "",
            description: "",
            status: "todo",
            due_date: null,
            priority: null,
          },
          {
            id: "p",
            title: "Kurs Playwright",
            link: "",
            description: "",
            status: "deferred",
            due_date: null,
            priority: null,
          },
        ],
      };
    }
    return { ok: true, json: async () => [] };
  });
  render(<TasksSection apiFetch={apiFetch} lang="pl" t={t} />);

  const deferred = await screen.findByRole("heading", { name: /Odłożone/ });
  const todo = screen.getByRole("heading", { name: /Do zrobienia/ });

  expect(deferred.parentElement).toHaveTextContent("Kurs Playwright");
  expect(deferred.parentElement).not.toHaveTextContent("Alpha");
  expect(todo.parentElement).not.toHaveTextContent("Kurs Playwright");
  const headings = screen.getAllByRole("heading").map((h) => h.textContent ?? "");
  expect(headings.findIndex((h) => /Odłożone/.test(h))).toBeLessThan(
    headings.findIndex((h) => /Do zrobienia/.test(h))
  );
  // licznik aktywnych nie liczy odłożonych (D5): tylko „Alpha”
  expect(screen.getByText(/1 zadań aktywnych/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Uruchom testy, upewnij się, że czerwone**

Run: `npx vitest run tests/unit/features/tasks`
Expected: FAIL w nowych przypadkach: `puts the deferred column first…` (TypeError: kolumna `deferred` nie istnieje w `TASK_STATUSES`), obu nowych w `taskStatsUtils`, `allows moving the task to deferred`, `odłożone zadanie trafia do pierwszej kolumny…`. Zmieniony test `tasksByStatus` przechodzi już teraz (filtr nie zależy od listy kolumn); to test charakteryzujący, nie czerwony. Dotychczasowe testy przechodzą.

- [ ] **Step 3: Zaimplementuj logikę (`taskOrderUtils`, `taskStatsUtils`)**

`src/features/tasks/taskOrderUtils.ts:5`:

```ts
export const TASK_STATUSES: TaskStatus[] = ["deferred", "todo", "in_progress", "to_review", "done"];
```

`src/features/tasks/taskStatsUtils.ts`, w pętli `for (const task of tasks)` po bloku `if (task.status === "done") { … continue; }` dodaj:

```ts
// odłożone nie wchodzą do żadnego licznika (ani statusu, ani terminów)
if (task.status === "deferred") continue;
```

oraz zamień ostatnią funkcję na:

```ts
/** Zaległe (termin przed dziś) albo na dziś; zadania zrobione, odłożone i bez terminu → `null`. */
export function getTaskDueState(task: Task, now: Date): "overdue" | "today" | null {
  if (task.status === "done" || task.status === "deferred" || !task.due_date) return null;
  const today = isoDate(now);
  if (task.due_date < today) return "overdue";
  return task.due_date === today ? "today" : null;
}
```

- [ ] **Step 4: Zaimplementuj UI**

(Tłumaczenie `tasksDeferred` i etykieta kolumny są już z Task 1.)

`src/features/tasks/TasksSection.tsx`, w `dateSubtitle`: `const activeCount = tasks.filter((x) => x.status !== "done" && x.status !== "deferred").length;`

`src/features/tasks/TaskDetailModal.tsx`, w `statusOptions` jako pierwszy element:

```ts
    { value: "deferred", label: (t.tasksDeferred as string) ?? "Deferred" },
```

`src/features/tasks/tasks.css`: po regule `.zad-dot--todo { … }` dodaj

```css
.zad-dot--deferred {
  background: color-mix(in srgb, var(--muted) 40%, transparent);
}
```

a w `@media (min-width: 1024px) { .zad-board { … } }` (ok. linii 412) zmień `repeat(4, minmax(0, 1fr))` na `repeat(5, minmax(0, 1fr))`.

- [ ] **Step 5: Testy zielone i typy**

Run: `npx vitest run tests/unit/features/tasks`
Expected: PASS (nowe i dotychczasowe; jeśli dotychczasowy test pęka przez dodatkową kolumnę lub opcję, popraw jego oczekiwanie, nie logikę).

Run: `npx tsc --noEmit`
Expected: brak błędów.

- [ ] **Step 6: Commit**

```bash
git add src/features/tasks tests/unit/features/tasks
git commit -m "feat(zadania): kolumna Odłożone w tablicy, statystyki i okno szczegółów

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Dokumentacja formatu

**Files:**

- Modify: `docs/nexus-vault-formaty-yaml.md:31`

- [ ] **Step 1: Zaktualizuj wiersz statusów**

W linii 31 zamień:

```
`status`: `todo`, `in_progress`, `to_review`, `done`; pole wyboru `[x]` oznacza `done`.
```

na:

```
`status`: `deferred` (odłożone: nie trafia do kolejki Kokpitu, terminów w kalendarzu ani liczników terminów), `todo`, `in_progress`, `to_review`, `done`; pole wyboru `[x]` oznacza `done`, a `deferred` ma `[ ]`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/nexus-vault-formaty-yaml.md
git commit -m "docs(formaty): status deferred zadań ogólnych

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Weryfikacja końcowa i PR

- [ ] **Step 1: Pełna weryfikacja (deleguj do `cursor`, `--tier light`)**

Run: `scripts/ask-helper.sh --role task --approve-allowed --tier light cursor "W katalogu Monolith uruchom po kolei: npx tsc --noEmit; npx vitest run; npm run lint; npm run build. Odpowiedz 'przeszło' albo listą plik:linia + przyczyna dla każdego błędu. Niczego nie edytuj."`
Expected: „przeszło” dla czterech poleceń. Przy błędach: napraw kodem (nie testem architektury) i powtórz.

- [ ] **Step 2: Oględziny w przeglądarce (opcjonalnie, na kopii vaulta)**

Skopiuj `../NEXUS/Vault/Tasks/tasks.md` do katalogu w scratchpadzie jako fałszywy vault (`NEXUS_VAULT_PATH`), uruchom aplikację na wolnym porcie (jak w PR #61: 3177), w karcie Zadania przenieś jedno zadanie do „Odłożone” (okno szczegółów i przeciągnięcie), sprawdź: pierwsza kolumna, kropka, brak zadania w kolejce Kokpitu (Alt+1), brak terminu w Kalendarzu. Nie dotykaj prawdziwego `Tasks/tasks.md`. Jeśli pominięte, napisz to w opisie PR.

- [ ] **Step 3: Wypchnij gałąź i otwórz PR**

Run: `git push -u origin feat/zadania-odlozone` i `gh pr create --base main --title "feat(zadania): status Odłożone (kolumna, Kokpit, kalendarz)"` z opisem: streszczenie, D1–D7 (link do specu), „Poza zakresem” ze specu §6, wyniki weryfikacji (tsc, vitest, lint, build, oględziny). Opis kończy się linią `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 4: Po merge’u zaktualizuj `tasks.md` w NEXUS**

Odhacz wpis o statusie „Odłożone” (PR #NN, data) w `../NEXUS/Vault/Projects/monolith/tasks.md`. Commit tylko tego pliku, za zgodą użytkownika; `index.md` zostaje poza commitem (ma cudzą, niezacommitowaną zmianę `type`). Użytkownik sam przenosi istniejące zadania (np. kurs Playwright) do „Odłożone”; migracji danych nie ma.

---

## Self-review (autor planu)

- **Pokrycie specu:** D1 (status `deferred`) i D2 (kolejność kolumn): T1, T3; D3 (Kokpit): T2; D4 (kalendarz): T2; D5 (statystyki, licznik aktywnych): T3 (`computeTaskTiles`, `getTaskDueState`, `activeCount`); D6 (tylko zadania ogólne): brak zmian w `bc_projects` (świadomie); D7 (prywatność): brak zmian w zapisie, tylko typy; dokumentacja formatu: T4; weryfikacja i oględziny: T5.
- **Placeholdery:** brak „TBD”; jedyne miejsca zależne od stanu repo (dodatkowe `Record<TaskStatus, …>` w T1 Step 4, dotychczasowy test pękający przez 5. kolumnę w T3 Step 5) mają jawną regułę naprawy.
- **Spójność typów:** wartość `"deferred"` identyczna w `task-line.ts` (T1), `bc_tasks` (T1), filtrach (T2), `taskOrderUtils` i UI (T3); klucz tłumaczenia `tasksDeferred` ten sam w `translations.ts`, `TasksSection` i `TaskDetailModal`; klasa kropki `zad-dot--deferred` odpowiada `zad-dot--${status}` w `TaskColumn.tsx`.
