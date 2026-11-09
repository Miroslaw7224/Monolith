import { describe, it, expect, vi } from "vitest";

const mockGetTasks = vi.hoisted(() => vi.fn());
const mockCreateTask = vi.hoisted(() => vi.fn());
const mockUpdateTask = vi.hoisted(() => vi.fn());
const mockDeleteTask = vi.hoisted(() => vi.fn());

vi.mock("@/services/taskService", () => ({
  getTasks: mockGetTasks,
  createTask: mockCreateTask,
  updateTask: mockUpdateTask,
  deleteTask: mockDeleteTask,
}));

import { executeTool } from "@/lib/agent/tools";
import { taskTools } from "@/services/agent/taskTools";

const task = (over = {}) => ({
  id: "t1",
  title: "Napisz raport",
  link: "",
  description: "opis",
  status: "todo",
  due_date: null,
  priority: null,
  ...over,
});

describe("taskTools", () => {
  it("list_tasks filters by status", async () => {
    mockGetTasks.mockResolvedValue([task(), task({ id: "t2", status: "done" })]);
    const res = await executeTool(taskTools, "u1", "list_tasks", { status: "done" });
    expect(res.ok && (res.data as { id: string }[]).map((t) => t.id)).toEqual(["t2"]);
  });

  it("create_task applies defaults and reports the tasks area as changed", async () => {
    mockCreateTask.mockResolvedValue(task({ id: "new" }));
    const res = await executeTool(taskTools, "u1", "create_task", { title: "Napisz raport" });
    expect(mockCreateTask).toHaveBeenCalledWith("u1", {
      title: "Napisz raport",
      description: "",
      status: "todo",
      due_date: null,
    });
    expect(res.ok && res.changed).toBe("tasks");
  });

  it("create_task rejects a malformed due_date", async () => {
    const res = await executeTool(taskTools, "u1", "create_task", {
      title: "x",
      due_date: "jutro",
    });
    expect(res.ok).toBe(false);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("update_task fails when the task does not exist", async () => {
    mockGetTasks.mockResolvedValue([]);
    const res = await executeTool(taskTools, "u1", "update_task", { id: "zz", status: "done" });
    expect(res).toEqual({ ok: false, error: "Task not found: zz" });
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("update_task sends only provided fields", async () => {
    mockGetTasks.mockResolvedValue([task()]);
    await executeTool(taskTools, "u1", "update_task", { id: "t1", status: "in_progress" });
    expect(mockUpdateTask).toHaveBeenCalledWith("u1", "t1", { status: "in_progress" });
  });

  it("update_task with no fields is an error", async () => {
    mockGetTasks.mockResolvedValue([task()]);
    const res = await executeTool(taskTools, "u1", "update_task", { id: "t1" });
    expect(res.ok).toBe(false);
  });

  it("delete_task is destructive and describes the target by title", async () => {
    mockGetTasks.mockResolvedValue([task()]);
    const tool = taskTools.find((t) => t.name === "delete_task")!;
    expect(tool.destructive).toBe(true);
    expect(await tool.describe!("u1", { id: "t1" })).toContain("Napisz raport");
  });

  it("delete_task describe throws when the task does not exist", async () => {
    mockGetTasks.mockResolvedValue([]);
    const tool = taskTools.find((t) => t.name === "delete_task")!;
    await expect(tool.describe!("u1", { id: "zz" })).rejects.toThrow("Task not found");
  });
});
