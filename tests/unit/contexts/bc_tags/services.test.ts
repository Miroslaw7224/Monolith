// @vitest-environment node
import { describe, it, expect } from "vitest";
import { DomainError } from "@/lib/errors";
import { formatYamlList } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  getUserTags,
  createUserTag,
  updateUserTag,
  deleteUserTag,
} from "@/contexts/bc_tags/services";
import { setupTempVault } from "../../helpers/tempVault";

const FILE = "Resources/tags.yaml";
const STORED = [{ id: "tag1", tag: "work", title: "Work", created: "2026-03-01T10:00:00.000Z" }];

const vault = setupTempVault();
const seed = () => vault.write(FILE, formatYamlList("tags", STORED));

describe("bc_tags services", () => {
  describe("getUserTags", () => {
    it("zwraca tagi zapisane w vaulcie", async () => {
      seed();

      expect(await getUserTags()).toEqual([
        { id: "tag1", tag: "work", title: "Work", created_at: "2026-03-01T10:00:00.000Z" },
      ]);
    });

    it("bez pliku zwraca pustą listę", async () => {
      expect(await getUserTags()).toEqual([]);
    });
  });

  describe("createUserTag", () => {
    it("zapisuje tag z kolorem w vaulcie", async () => {
      const created = await createUserTag({ tag: "work", title: "Work", color: "#FF0000" });

      expect(readList(FILE, "tags")).toEqual([
        {
          id: created.id,
          tag: "work",
          title: "Work",
          color: "#FF0000",
          created: created.created_at,
        },
      ]);
    });

    it("tag bez koloru nie zapisuje klucza color", async () => {
      const created = await createUserTag({ tag: "work", title: "Work" });

      expect(readList(FILE, "tags")).toEqual([
        { id: created.id, tag: "work", title: "Work", created: created.created_at },
      ]);
    });

    it("pusty tag odrzuca bez zapisu pliku", async () => {
      await expect(createUserTag({ tag: "  ", title: "y" })).rejects.toMatchObject({
        message: "tag required",
        statusCode: 400,
      });
      expect(vault.read(FILE)).toBeNull();
    });
  });

  describe("updateUserTag", () => {
    it("zmienia tytuł i zostawia resztę rekordu", async () => {
      seed();

      await updateUserTag("tag1", { title: "New Title" });

      expect(readList(FILE, "tags")).toEqual([{ ...STORED[0], title: "New Title" }]);
    });

    it("zapisuje kolor", async () => {
      seed();

      await updateUserTag("tag1", { color: "#00FF00" });

      expect(readList(FILE, "tags")).toEqual([{ ...STORED[0], color: "#00FF00" }]);
    });

    it("kolor null usuwa klucz color", async () => {
      vault.write(FILE, formatYamlList("tags", [{ ...STORED[0], color: "#00FF00" }]));

      await updateUserTag("tag1", { color: null });

      expect(readList(FILE, "tags")).toEqual(STORED);
    });

    it("nieistniejące id to DomainError 404 i plik bez zmian", async () => {
      seed();
      const before = vault.read(FILE);

      await expect(updateUserTag("brak", { tag: "x" })).rejects.toMatchObject({
        message: "Tag not found",
        statusCode: 404,
      });
      await expect(updateUserTag("brak", { tag: "x" })).rejects.toBeInstanceOf(DomainError);
      expect(vault.read(FILE)).toBe(before);
    });
  });

  describe("deleteUserTag", () => {
    it("usuwa tag z pliku", async () => {
      seed();

      await deleteUserTag("tag1");

      expect(readList(FILE, "tags")).toEqual([]);
    });
  });
});
