// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import { parseFrontmatter } from "@/lib/nexus/frontmatter";
import { listNotes, createNote, updateNote, deleteNote } from "@/contexts/bc_notes/services";
import { setupTempVault } from "../../helpers/tempVault";

const NOW = "2026-11-12T10:00:00.000Z";
const vault = setupTempVault();

afterEach(() => vi.useRealTimers());
const freeze = () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
};

const seed = (file: string, id: string, title: string, body: string) =>
  vault.write(
    `Notes/${file}.md`,
    `---\nid: ${id}\ntitle: ${title}\ncreated: "2026-03-02T10:00:00.000Z"\nupdated: "2026-03-02T10:00:00.000Z"\n---\n\n${body}\n`
  );

describe("bc_notes services", () => {
  describe("listNotes", () => {
    it("zwraca notatki zapisane w vaulcie", async () => {
      seed("note-1", "n1", "Note 1", "Content");

      await expect(listNotes()).resolves.toEqual([
        {
          id: "n1",
          title: "Note 1",
          content: "Content",
          created_at: "2026-03-02T10:00:00.000Z",
          updated_at: "2026-03-02T10:00:00.000Z",
        },
      ]);
    });

    it("pusty vault daje pustą listę", async () => {
      await expect(listNotes()).resolves.toEqual([]);
    });
  });

  describe("createNote", () => {
    it("zapisuje plik notatki i zwraca ją z nowym id", async () => {
      freeze();

      const result = await createNote({ title: "T", content: "C" });

      expect(result).toEqual({ id: result.id, title: "T", content: "C" });
      const file = parseFrontmatter(vault.read("Notes/t.md")!);
      expect(file?.meta).toEqual({ id: result.id, title: "T", created: NOW, updated: NOW });
      expect(file?.body.trim()).toBe("C");
    });
  });

  describe("updateNote", () => {
    it("zmienia tytuł i treść w pliku notatki", async () => {
      freeze();
      seed("note-1", "n1", "T", "C");

      await updateNote("n1", { title: "T2", content: "C2" });

      const file = parseFrontmatter(vault.read("Notes/note-1.md")!);
      expect(file?.meta).toEqual({
        id: "n1",
        title: "T2",
        created: "2026-03-02T10:00:00.000Z",
        updated: NOW,
      });
      expect(file?.body.trim()).toBe("C2");
    });

    it("nieznane id to DomainError 404 i brak nowego pliku", async () => {
      const error = await updateNote("nope", { title: "T", content: "C" }).catch(
        (err: unknown) => err
      );

      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).statusCode).toBe(404);
      expect(vault.read("Notes/t.md")).toBeNull();
    });
  });

  describe("deleteNote", () => {
    it("usuwa plik notatki i zostawia pozostałe", async () => {
      seed("note-1", "n1", "T", "C");
      seed("note-2", "n2", "U", "D");

      await deleteNote("n1");

      expect(vault.read("Notes/note-1.md")).toBeNull();
      expect(vault.read("Notes/note-2.md")).not.toBeNull();
    });
  });
});
