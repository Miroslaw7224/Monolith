import { describe, expect, it } from "vitest";
import type { Task } from "@/src/components/TasksSection";
import {
  computeTaskOrderAfterDrop,
  getVisibleColumnTasks,
  sortTasksByNewest,
  TASK_COLUMN_VISIBLE_LIMIT,
  tasksByStatus,
} from "@/src/components/tasks/taskOrderUtils";

const makeTask = (id: string, status: Task["status"], title = id): Task => ({
  id,
  title,
  description: "",
  link: "",
  status,
  due_date: null,
  priority: null,
});

describe("computeTaskOrderAfterDrop", () => {
  const tasks = [
    makeTask("a", "todo", "A"),
    makeTask("b", "todo", "B"),
    makeTask("c", "in_progress", "C"),
    makeTask("d", "done", "D"),
  ];

  it("moves task to another column at the end", () => {
    const { orderedIds, statusChanged } = computeTaskOrderAfterDrop(tasks, "a", "done", null);
    expect(statusChanged).toBe(true);
    expect(orderedIds).toEqual(["b", "c", "d", "a"]);
  });

  it("inserts before target task in same column", () => {
    const { orderedIds, statusChanged } = computeTaskOrderAfterDrop(tasks, "b", "todo", "a");
    expect(statusChanged).toBe(false);
    expect(orderedIds).toEqual(["b", "a", "c", "d"]);
  });

  it("moves task to to_review column", () => {
    const { orderedIds, statusChanged } = computeTaskOrderAfterDrop(tasks, "c", "to_review", null);
    expect(statusChanged).toBe(true);
    expect(orderedIds).toEqual(["a", "b", "c", "d"]);
  });
});

describe("tasksByStatus", () => {
  const tasks = [
    makeTask("1", "todo"),
    makeTask("2", "in_progress"),
    makeTask("3", "to_review"),
    makeTask("4", "done"),
  ];

  it("filters by status", () => {
    expect(tasksByStatus(tasks, "todo").map((t) => t.id)).toEqual(["1"]);
    expect(tasksByStatus(tasks, "in_progress").map((t) => t.id)).toEqual(["2"]);
    expect(tasksByStatus(tasks, "to_review").map((t) => t.id)).toEqual(["3"]);
    expect(tasksByStatus(tasks, "done").map((t) => t.id)).toEqual(["4"]);
  });
});

describe("sortTasksByNewest", () => {
  it("orders tasks by created_at descending", () => {
    const tasks = [makeTask("old", "todo"), makeTask("new", "todo"), makeTask("mid", "todo")];
    tasks[0].created_at = "2026-01-01T00:00:00.000Z";
    tasks[1].created_at = "2026-03-01T00:00:00.000Z";
    tasks[2].created_at = "2026-02-01T00:00:00.000Z";

    expect(sortTasksByNewest(tasks).map((t) => t.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("getVisibleColumnTasks", () => {
  it("returns all tasks when count is within limit", () => {
    const tasks = Array.from({ length: TASK_COLUMN_VISIBLE_LIMIT }, (_, i) =>
      makeTask(String(i), "todo")
    );
    const result = getVisibleColumnTasks(tasks, false, true);
    expect(result.visibleTasks).toHaveLength(TASK_COLUMN_VISIBLE_LIMIT);
    expect(result.hiddenCount).toBe(0);
    expect(result.isCollapsed).toBe(false);
    expect(result.canCollapse).toBe(false);
  });

  it("returns only newest tasks when collapsed", () => {
    const tasks = Array.from({ length: TASK_COLUMN_VISIBLE_LIMIT + 3 }, (_, i) => {
      const task = makeTask(String(i), "todo");
      task.created_at = `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`;
      return task;
    });
    const result = getVisibleColumnTasks(tasks, false, true);
    expect(result.visibleTasks).toHaveLength(TASK_COLUMN_VISIBLE_LIMIT);
    expect(result.hiddenCount).toBe(3);
    expect(result.isCollapsed).toBe(true);
    expect(result.canCollapse).toBe(true);
    expect(result.visibleTasks[0].id).toBe(String(TASK_COLUMN_VISIBLE_LIMIT + 2));
  });

  it("returns all tasks when expanded", () => {
    const tasks = Array.from({ length: TASK_COLUMN_VISIBLE_LIMIT + 3 }, (_, i) =>
      makeTask(String(i), "todo")
    );
    const result = getVisibleColumnTasks(tasks, true, true);
    expect(result.visibleTasks).toHaveLength(TASK_COLUMN_VISIBLE_LIMIT + 3);
    expect(result.hiddenCount).toBe(0);
    expect(result.isCollapsed).toBe(false);
    expect(result.canCollapse).toBe(true);
  });

  it("does not collapse while searching", () => {
    const tasks = Array.from({ length: TASK_COLUMN_VISIBLE_LIMIT + 3 }, (_, i) =>
      makeTask(String(i), "todo")
    );
    const result = getVisibleColumnTasks(tasks, false, false);
    expect(result.visibleTasks).toHaveLength(TASK_COLUMN_VISIBLE_LIMIT + 3);
    expect(result.isCollapsed).toBe(false);
    expect(result.canCollapse).toBe(false);
  });
});
