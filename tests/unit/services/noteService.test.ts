import { describe, it, expect, beforeEach, vi } from "vitest";
import { listNotes, createNote, updateNote, deleteNote } from "../../../services/noteService.js";

const mockGetNotes = vi.hoisted(() => vi.fn());
const mockCreateNote = vi.hoisted(() => vi.fn());
const mockUpdateNote = vi.hoisted(() => vi.fn());
const mockDeleteNote = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/firestore-db.js", () => ({
  getNotes: (...args: unknown[]) => mockGetNotes(...args),
  createNote: (...args: unknown[]) => mockCreateNote(...args),
  updateNote: (...args: unknown[]) => mockUpdateNote(...args),
  deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
}));

describe("noteService", () => {
  beforeEach(() => {
    mockGetNotes.mockReset();
    mockCreateNote.mockReset();
    mockUpdateNote.mockReset();
    mockDeleteNote.mockReset();
  });

  describe("listNotes", () => {
    it("given Firestore returns notes, when listNotes is called, then returns the list (happy path)", async () => {
      const notes = [{ id: "n1", title: "Note 1", content: "Content" }];
      mockGetNotes.mockResolvedValue(notes);

      const result = await listNotes();

      expect(result).toEqual(notes);
    });

    it("given getNotes throws, when listNotes is called, then propagates the error", async () => {
      mockGetNotes.mockRejectedValue(new Error("DB error"));

      await expect(listNotes()).rejects.toThrow("DB error");
    });
  });

  describe("createNote", () => {
    it("given valid data, when createNote is called, then returns created note (happy path)", async () => {
      mockCreateNote.mockResolvedValue({ id: "n1", title: "T", content: "C" });

      const result = await createNote({ title: "T", content: "C" });

      expect(result).toEqual({ id: "n1", title: "T", content: "C" });
    });

    it("given createNote throws, when createNote is called, then propagates the error", async () => {
      mockCreateNote.mockRejectedValue(new Error("Create failed"));

      await expect(createNote({ title: "T", content: "C" })).rejects.toThrow("Create failed");
    });
  });

  describe("updateNote", () => {
    it("given valid id and data, when updateNote is called, then delegates to firestore (happy path)", async () => {
      mockUpdateNote.mockResolvedValue(undefined);

      await updateNote("n1", { title: "T2", content: "C2" });

      expect(mockUpdateNote).toHaveBeenCalledWith("n1", {
        title: "T2",
        content: "C2",
      });
    });

    it("given updateNote throws, when updateNote is called, then propagates the error", async () => {
      mockUpdateNote.mockRejectedValue(new Error("Update failed"));

      await expect(updateNote("n1", { title: "T", content: "C" })).rejects.toThrow("Update failed");
    });
  });

  describe("deleteNote", () => {
    it("given valid id, when deleteNote is called, then delegates to firestore (happy path)", async () => {
      mockDeleteNote.mockResolvedValue(undefined);

      await deleteNote("n1");

      expect(mockDeleteNote).toHaveBeenCalledWith("n1");
    });

    it("given deleteNote throws, when deleteNote is called, then propagates the error", async () => {
      mockDeleteNote.mockRejectedValue(new Error("Delete failed"));

      await expect(deleteNote("n1")).rejects.toThrow("Delete failed");
    });
  });
});
