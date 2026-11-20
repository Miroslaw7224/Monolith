// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import type * as TasksRepo from "@/contexts/bc_tasks/repositories";
import {
  getTaskTemplates,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
} from "@/contexts/bc_tasks/services";

const mockGetTaskTemplates = vi.hoisted(() => vi.fn<typeof TasksRepo.getTaskTemplates>());
const mockCreateTaskTemplate = vi.hoisted(() => vi.fn<typeof TasksRepo.createTaskTemplate>());
const mockUpdateTaskTemplate = vi.hoisted(() => vi.fn<typeof TasksRepo.updateTaskTemplate>());
const mockDeleteTaskTemplate = vi.hoisted(() => vi.fn<typeof TasksRepo.deleteTaskTemplate>());

vi.mock(
  "@/contexts/bc_tasks/repositories",
  () =>
    ({
      getTaskTemplates: mockGetTaskTemplates,
      createTaskTemplate: mockCreateTaskTemplate,
      updateTaskTemplate: mockUpdateTaskTemplate,
      deleteTaskTemplate: mockDeleteTaskTemplate,
    }) satisfies Partial<typeof TasksRepo>
);

describe("taskTemplateService", () => {
  beforeEach(() => {
    mockGetTaskTemplates.mockReset();
    mockCreateTaskTemplate.mockReset();
    mockUpdateTaskTemplate.mockReset();
    mockDeleteTaskTemplate.mockReset();
  });

  describe("getTaskTemplates", () => {
    it("given Firestore returns templates, when getTaskTemplates is called, then returns the list", async () => {
      const templates = [{ id: "tpl1", label: "Review PR", title: "Review PR", link: "" }];
      mockGetTaskTemplates.mockResolvedValue(templates);

      const result = await getTaskTemplates();

      expect(result).toEqual(templates);
    });

    it("given getTaskTemplates throws, when getTaskTemplates is called, then propagates the error", async () => {
      mockGetTaskTemplates.mockRejectedValue(new Error("DB error"));

      await expect(getTaskTemplates()).rejects.toThrow("DB error");
    });
  });

  describe("createTaskTemplate", () => {
    it("given valid data, when createTaskTemplate is called, then returns created template", async () => {
      mockCreateTaskTemplate.mockResolvedValue({
        id: "tpl1",
        label: "Review PR",
        title: "Review PR",
        link: "",
      });

      const result = await createTaskTemplate({
        label: "Review PR",
        title: "Review PR",
        link: "",
      });

      expect(result).toEqual({
        id: "tpl1",
        label: "Review PR",
        title: "Review PR",
        link: "",
      });
      expect(mockCreateTaskTemplate).toHaveBeenCalledWith({
        label: "Review PR",
        title: "Review PR",
        link: "",
      });
    });

    it("given createTaskTemplate throws, when createTaskTemplate is called, then propagates the error", async () => {
      mockCreateTaskTemplate.mockRejectedValue(new Error("Create failed"));

      await expect(createTaskTemplate({ label: "x", title: "y" })).rejects.toThrow("Create failed");
    });
  });

  describe("updateTaskTemplate", () => {
    it("given valid id and data, when updateTaskTemplate is called, then delegates to firestore", async () => {
      mockUpdateTaskTemplate.mockResolvedValue(undefined);

      await updateTaskTemplate("tpl1", { title: "New Title" });

      expect(mockUpdateTaskTemplate).toHaveBeenCalledWith("tpl1", {
        title: "New Title",
      });
    });

    it("given updateTaskTemplate throws, when updateTaskTemplate is called, then propagates the error", async () => {
      mockUpdateTaskTemplate.mockRejectedValue(new Error("Update failed"));

      await expect(updateTaskTemplate("tpl1", { label: "x" })).rejects.toThrow("Update failed");
    });
  });

  describe("deleteTaskTemplate", () => {
    it("given valid id, when deleteTaskTemplate is called, then delegates to firestore", async () => {
      mockDeleteTaskTemplate.mockResolvedValue(undefined);

      await deleteTaskTemplate("tpl1");

      expect(mockDeleteTaskTemplate).toHaveBeenCalledWith("tpl1");
    });

    it("given deleteTaskTemplate throws, when deleteTaskTemplate is called, then propagates the error", async () => {
      mockDeleteTaskTemplate.mockRejectedValue(new Error("Delete failed"));

      await expect(deleteTaskTemplate("tpl1")).rejects.toThrow("Delete failed");
    });
  });
});
