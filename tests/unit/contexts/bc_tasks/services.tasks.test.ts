// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import type * as TasksRepo from "@/contexts/bc_tasks/repositories";
import type { Task } from "@/contexts/bc_tasks/models";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
} from "@/contexts/bc_tasks/services";

function taskFixture(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "T",
    description: "D",
    link: "",
    status: "todo",
    due_date: null,
    priority: null,
    ...overrides,
  };
}

const mockGetTasks = vi.hoisted(() => vi.fn<typeof TasksRepo.getTasks>());
const mockCreateTask = vi.hoisted(() => vi.fn<typeof TasksRepo.createTask>());
const mockUpdateTask = vi.hoisted(() => vi.fn<typeof TasksRepo.updateTask>());
const mockDeleteTask = vi.hoisted(() => vi.fn<typeof TasksRepo.deleteTask>());
const mockReorderTasks = vi.hoisted(() => vi.fn<typeof TasksRepo.reorderTasks>());

vi.mock(
  "@/contexts/bc_tasks/repositories",
  () =>
    ({
      getTasks: mockGetTasks,
      createTask: mockCreateTask,
      updateTask: mockUpdateTask,
      deleteTask: mockDeleteTask,
      reorderTasks: mockReorderTasks,
    }) satisfies Partial<typeof TasksRepo>
);

describe("taskService", () => {
  beforeEach(() => {
    mockGetTasks.mockReset();
    mockCreateTask.mockReset();
    mockUpdateTask.mockReset();
    mockDeleteTask.mockReset();
    mockReorderTasks.mockReset();
  });

  describe("getTasks", () => {
    it("given Firestore returns tasks, when getTasks is called, then returns the list (happy path)", async () => {
      const tasks = [
        {
          id: "t1",
          title: "Task 1",
          description: "",
          link: "",
          status: "todo" as const,
          due_date: null,
          priority: null,
        },
      ];
      mockGetTasks.mockResolvedValue(tasks);

      const result = await getTasks();

      expect(result).toEqual(tasks);
    });

    it("given getTasks throws, when getTasks is called, then propagates the error", async () => {
      mockGetTasks.mockRejectedValue(new Error("DB error"));

      await expect(getTasks()).rejects.toThrow("DB error");
    });
  });

  describe("createTask", () => {
    it("given valid data, when createTask is called, then returns created task (happy path)", async () => {
      const task = {
        id: "t1",
        title: "T",
        description: "D",
        link: "",
        status: "todo" as const,
        due_date: null,
        priority: null,
      };
      mockCreateTask.mockResolvedValue(task);

      const result = await createTask({ title: "T", description: "D" });

      expect(result).toEqual(task);
    });

    it("given createTask throws, when createTask is called, then propagates the error", async () => {
      mockCreateTask.mockRejectedValue(new Error("Create failed"));

      await expect(createTask({ title: "T" })).rejects.toThrow("Create failed");
    });
  });

  describe("updateTask", () => {
    it("given valid id and data, when updateTask is called, then delegates to firestore (happy path)", async () => {
      mockUpdateTask.mockResolvedValue(undefined);

      await updateTask("t1", { status: "done" });

      expect(mockUpdateTask).toHaveBeenCalledWith("t1", { status: "done" });
    });

    it("given updateTask throws, when updateTask is called, then propagates the error", async () => {
      mockUpdateTask.mockRejectedValue(new Error("Update failed"));

      await expect(updateTask("t1", { title: "X" })).rejects.toThrow("Update failed");
    });
  });

  describe("deleteTask", () => {
    it("given valid id, when deleteTask is called, then delegates to firestore (happy path)", async () => {
      mockDeleteTask.mockResolvedValue(undefined);

      await deleteTask("t1");

      expect(mockDeleteTask).toHaveBeenCalledWith("t1");
    });

    it("given deleteTask throws, when deleteTask is called, then propagates the error", async () => {
      mockDeleteTask.mockRejectedValue(new Error("Delete failed"));

      await expect(deleteTask("t1")).rejects.toThrow("Delete failed");
    });
  });

  describe("reorderTasks", () => {
    it("given taskIds, when reorderTasks is called, then delegates to firestore", async () => {
      mockReorderTasks.mockResolvedValue(undefined);

      await reorderTasks(["t1", "t2", "t3"]);

      expect(mockReorderTasks).toHaveBeenCalledWith(["t1", "t2", "t3"]);
    });

    it("given reorderTasks throws, when reorderTasks is called, then propagates the error", async () => {
      mockReorderTasks.mockRejectedValue(new Error("Reorder failed"));

      await expect(reorderTasks(["t1"])).rejects.toThrow("Reorder failed");
    });
  });
  describe("project", () => {
    it("given a valid project id, when createTask is called, then passes it to the repository", async () => {
      mockCreateTask.mockResolvedValue(taskFixture());

      await createTask({ title: "T", project: "gen-podsum-ai" });

      expect(mockCreateTask).toHaveBeenCalledWith({ title: "T", project: "gen-podsum-ai" });
    });

    it("given a malformed project id, when createTask or updateTask is called, then rejects with 400 and does not write", async () => {
      for (const bad of ["Zły Projekt", "a]b", "../x", "x".repeat(65)]) {
        await expect(createTask({ title: "T", project: bad })).rejects.toMatchObject({
          statusCode: 400,
        });
        await expect(updateTask("t1", { project: bad })).rejects.toMatchObject({
          statusCode: 400,
        });
      }
      expect(mockCreateTask).not.toHaveBeenCalled();
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it("given an empty project, when updateTask is called, then clears it with null", async () => {
      mockUpdateTask.mockResolvedValue(undefined);

      await updateTask("t1", { project: "" });
      await updateTask("t1", { project: null });

      expect(mockUpdateTask).toHaveBeenNthCalledWith(1, "t1", { project: null });
      expect(mockUpdateTask).toHaveBeenNthCalledWith(2, "t1", { project: null });
    });
  });
});
