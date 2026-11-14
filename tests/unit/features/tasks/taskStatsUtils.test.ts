import { describe, expect, it } from "vitest";
import type { Task } from "@/src/features/tasks/TasksSection";
import { computeTaskTiles, getTaskDueState } from "@/src/features/tasks/taskStatsUtils";

// sobota, 14 listopada 2026; tydzień zaczyna się w poniedziałek 9.11
const NOW = new Date(2026, 10, 14, 12, 0, 0);

const task = (id: string, status: Task["status"], extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  description: "",
  link: "",
  status,
  due_date: null,
  priority: null,
  ...extra,
});

describe("computeTaskTiles", () => {
  it("zwraca zera dla pustej listy", () => {
    expect(computeTaskTiles([], NOW)).toEqual({
      inProgress: { count: 0, deep: 0, quick: 0 },
      todo: { count: 0, nextDue: null },
      deadlines: { overdue: 0, today: 0, week: 0 },
      doneWeek: { count: 0, prevCount: 0 },
    });
  });

  it("liczy zadania w toku z podziałem na deep i quick", () => {
    const tiles = computeTaskTiles(
      [
        task("a", "in_progress", { title: "A #deep" }),
        task("b", "in_progress", { title: "B #deep" }),
        task("c", "in_progress", { title: "C #quick" }),
        task("d", "in_progress", { title: "D" }),
        task("e", "todo", { title: "E #deep" }),
      ],
      NOW
    );
    expect(tiles.inProgress).toEqual({ count: 4, deep: 2, quick: 1 });
  });

  it("w „do zrobienia” podaje najwcześniejszy termin", () => {
    const tiles = computeTaskTiles(
      [
        task("a", "todo", { due_date: "2026-11-20" }),
        task("b", "todo", { due_date: "2026-11-16" }),
        task("c", "todo"),
        task("d", "in_progress", { due_date: "2026-11-15" }),
      ],
      NOW
    );
    expect(tiles.todo).toEqual({ count: 3, nextDue: "2026-11-16" });
  });

  it("terminy: po terminie, dziś i w 7 dni liczy tylko aktywne zadania", () => {
    const tiles = computeTaskTiles(
      [
        task("a", "todo", { due_date: "2026-11-13" }),
        task("b", "in_progress", { due_date: "2026-11-14" }),
        task("c", "to_review", { due_date: "2026-11-15" }),
        task("d", "todo", { due_date: "2026-11-20" }),
        task("e", "todo", { due_date: "2026-11-21" }),
        task("f", "done", { due_date: "2026-11-01" }),
        task("g", "todo"),
      ],
      NOW
    );
    expect(tiles.deadlines).toEqual({ overdue: 1, today: 1, week: 2 });
  });

  it("zrobione: bieżący tydzień od poniedziałku i poprzedni tydzień", () => {
    const tiles = computeTaskTiles(
      [
        task("a", "done", { updated_at: "2026-11-09T08:00:00" }),
        task("b", "done", { updated_at: "2026-11-13T22:00:00" }),
        task("c", "done", { updated_at: "2026-11-08T23:00:00" }),
        task("d", "done", { updated_at: "2026-11-02T00:30:00" }),
        task("e", "done", { updated_at: "2026-11-01T10:00:00" }),
        task("f", "done"),
        task("g", "todo", { updated_at: "2026-11-10T10:00:00" }),
      ],
      NOW
    );
    expect(tiles.doneWeek).toEqual({ count: 2, prevCount: 2 });
  });
});

describe("getTaskDueState", () => {
  it("rozróżnia zaległe, dzisiejsze i pozostałe zadania; zrobione nigdy nie są zaległe", () => {
    expect(getTaskDueState(task("a", "todo", { due_date: "2026-11-13" }), NOW)).toBe("overdue");
    expect(getTaskDueState(task("b", "in_progress", { due_date: "2026-11-14" }), NOW)).toBe(
      "today"
    );
    expect(getTaskDueState(task("c", "todo", { due_date: "2026-11-15" }), NOW)).toBeNull();
    expect(getTaskDueState(task("d", "todo"), NOW)).toBeNull();
    expect(getTaskDueState(task("e", "done", { due_date: "2026-11-01" }), NOW)).toBeNull();
  });
});
