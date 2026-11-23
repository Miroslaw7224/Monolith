// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatYamlList } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  getTaskTemplates,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
} from "@/contexts/bc_tasks/services";
import { setupTempVault } from "../../helpers/tempVault";

const FILE = "Tasks/templates.yaml";
const STORED = [
  {
    id: "tpl1",
    label: "Review PR",
    title: "Review PR",
    link: "",
    created: "2026-08-01T10:00:00.000Z",
  },
];

const vault = setupTempVault();
const seed = () => vault.write(FILE, formatYamlList("templates", STORED));

describe("taskTemplateService", () => {
  describe("getTaskTemplates", () => {
    it("zwraca szablony zapisane w vaulcie", async () => {
      seed();

      expect(await getTaskTemplates()).toEqual([
        {
          id: "tpl1",
          label: "Review PR",
          title: "Review PR",
          link: "",
          created_at: "2026-08-01T10:00:00.000Z",
        },
      ]);
    });

    it("bez pliku zwraca pustą listę", async () => {
      expect(await getTaskTemplates()).toEqual([]);
    });
  });

  describe("createTaskTemplate", () => {
    it("zapisuje szablon w vaulcie", async () => {
      const created = await createTaskTemplate({
        label: "Review PR",
        title: "Review PR",
        link: "",
      });

      expect(readList(FILE, "templates")).toEqual([
        {
          id: created.id,
          label: "Review PR",
          title: "Review PR",
          link: "",
          created: created.created_at,
        },
      ]);
    });

    it("pusta etykieta albo tytuł to błąd 400 i brak pliku", async () => {
      await expect(createTaskTemplate({ label: " ", title: "y" })).rejects.toMatchObject({
        message: "label required",
        statusCode: 400,
      });
      await expect(createTaskTemplate({ label: "x", title: "" })).rejects.toMatchObject({
        message: "title required",
        statusCode: 400,
      });
      expect(vault.read(FILE)).toBeNull();
    });
  });

  describe("updateTaskTemplate", () => {
    it("zmienia tytuł, reszta rekordu bez zmian", async () => {
      seed();

      await updateTaskTemplate("tpl1", { title: "New Title" });

      expect(readList(FILE, "templates")).toEqual([{ ...STORED[0], title: "New Title" }]);
    });

    it("nieistniejące id to błąd 404 i plik bez zmian", async () => {
      seed();
      const before = vault.read(FILE);

      await expect(updateTaskTemplate("brak", { label: "x" })).rejects.toMatchObject({
        message: "Template not found",
        statusCode: 404,
      });
      expect(vault.read(FILE)).toBe(before);
    });
  });

  describe("deleteTaskTemplate", () => {
    it("usuwa szablon z pliku", async () => {
      seed();

      await deleteTaskTemplate("tpl1");

      expect(readList(FILE, "templates")).toEqual([]);
    });
  });
});
