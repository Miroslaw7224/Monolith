import { describe, expect, it } from "vitest";
import type { Task } from "@/src/components/TasksSection";
import { computeTaskOrderAfterDrop, tasksByStatus } from "@/src/components/tasks/taskOrderUtils";

const makeTask = (id: string, status: Task["status"], title = id): Task => ({
  id,
  title,
  description: "",
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

  it("moves task to in_progress before specific card", () => {
    const { orderedIds, statusChanged } = computeTaskOrderAfterDrop(tasks, "a", "in_progress", "c");
    expect(statusChanged).toBe(true);
    expect(orderedIds).toEqual(["b", "a", "c", "d"]);
  });
});

describe("tasksByStatus", () => {
  const tasks = [makeTask("1", "todo"), makeTask("2", "in_progress"), makeTask("3", "done")];

  it("filters by status", () => {
    expect(tasksByStatus(tasks, "todo").map((t) => t.id)).toEqual(["1"]);
    expect(tasksByStatus(tasks, "in_progress").map((t) => t.id)).toEqual(["2"]);
    expect(tasksByStatus(tasks, "done").map((t) => t.id)).toEqual(["3"]);
  });
});
