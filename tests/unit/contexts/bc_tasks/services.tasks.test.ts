// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
} from "@/contexts/bc_tasks/services";
import { setupTempVault } from "../../helpers/tempVault";

const FILE = "Tasks/tasks.md";
const T1 =
  "- [ ] Kurs Playwright [id:: t1] [status:: todo] [due:: 2026-08-06] [order:: 1] [created:: 2026-02-26T16:58:41.794Z]";
const T2 =
  "- [x] Review PR [id:: t2] [status:: done] [order:: 0] [created:: 2026-08-03T19:45:42.870Z]";
const T3 =
  "- [ ] Z projektem [id:: t3] [status:: todo] [order:: 2] [project:: gen-podsum-ai] [created:: 2026-09-01T10:00:00.000Z]";
const SEED = `# Zadania\n\n${T1}\n${T2}\n${T3}\n`;

const vault = setupTempVault();
const seed = () => vault.write(FILE, SEED);

describe("taskService", () => {
  describe("getTasks", () => {
    it("zwraca zadania z vaulta w kolejności order", async () => {
      seed();

      const tasks = await getTasks();

      expect(tasks.map((t) => [t.id, t.title, t.status, t.project])).toEqual([
        ["t2", "Review PR", "done", undefined],
        ["t1", "Kurs Playwright", "todo", undefined],
        ["t3", "Z projektem", "todo", "gen-podsum-ai"],
      ]);
    });

    it("bez pliku zwraca pustą listę", async () => {
      expect(await getTasks()).toEqual([]);
    });
  });

  describe("createTask", () => {
    it("zapisuje zadanie w vaulcie i da się je odczytać", async () => {
      const created = await createTask({ title: "T", description: "D" });

      expect(await getTasks()).toEqual([
        {
          id: created.id,
          title: "T",
          description: "D",
          link: "",
          status: "todo",
          due_date: null,
          priority: null,
          order: created.order,
          created_at: created.created_at,
          updated_at: created.updated_at,
        },
      ]);
    });

    it("pusty tytuł to błąd 400 i brak pliku", async () => {
      await expect(createTask({ title: "" })).rejects.toMatchObject({
        message: "title required",
        statusCode: 400,
      });
      expect(vault.read(FILE)).toBeNull();
    });
  });

  describe("updateTask", () => {
    it("zmienia status zadania, reszta zadań bez zmian", async () => {
      seed();
      const before = await getTasks();

      await updateTask("t1", { status: "done" });

      const [t2, t1, t3] = before;
      expect(await getTasks()).toEqual([
        t2,
        { ...t1, status: "done", updated_at: expect.any(String) },
        t3,
      ]);
    });
  });

  describe("deleteTask", () => {
    it("usuwa zadanie z pliku", async () => {
      seed();

      await deleteTask("t1");

      expect((await getTasks()).map((t) => t.id)).toEqual(["t2", "t3"]);
      expect(vault.read(FILE)).not.toContain("[id:: t1]");
    });
  });

  describe("reorderTasks", () => {
    it("zapisuje nową kolejność", async () => {
      seed();

      await reorderTasks(["t3", "t1", "t2"]);

      expect((await getTasks()).map((t) => [t.id, t.order])).toEqual([
        ["t3", 0],
        ["t1", 1],
        ["t2", 2],
      ]);
    });
  });

  describe("project", () => {
    it("poprawny id projektu trafia do zapisanego zadania", async () => {
      const created = await createTask({ title: "T", project: "gen-podsum-ai" });

      expect(created.project).toBe("gen-podsum-ai");
      expect(vault.read(FILE)).toContain("[project:: gen-podsum-ai]");
      expect((await getTasks())[0].project).toBe("gen-podsum-ai");
    });

    it("zły id projektu to 400 i plik bez zmian", async () => {
      seed();
      for (const bad of ["Zły Projekt", "a]b", "../x", "x".repeat(65)]) {
        await expect(createTask({ title: "T", project: bad })).rejects.toMatchObject({
          message: "invalid project",
          statusCode: 400,
        });
        await expect(updateTask("t1", { project: bad })).rejects.toMatchObject({
          message: "invalid project",
          statusCode: 400,
        });
      }

      expect(vault.read(FILE)).toBe(SEED);
    });

    it("pusty tekst i null czyszczą projekt", async () => {
      seed();

      await updateTask("t3", { project: "" });

      expect(vault.read(FILE)).not.toContain("[project::");
      expect((await getTasks()).find((t) => t.id === "t3")?.project).toBeUndefined();

      await updateTask("t3", { project: "abc" });
      await updateTask("t3", { project: null });

      expect((await getTasks()).find((t) => t.id === "t3")?.project).toBeUndefined();
    });
  });
});
