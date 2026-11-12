import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listDocuments,
  ingestDocument,
  deleteDocument,
} from "../../../services/documentService.js";

const mockGetDocuments = vi.hoisted(() => vi.fn());
const mockCreateDocument = vi.hoisted(() => vi.fn());
const mockDeleteDocument = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/firestore-db.js", () => ({
  getDocuments: (...args: unknown[]) => mockGetDocuments(...args),
  createDocument: (...args: unknown[]) => mockCreateDocument(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
}));

describe("documentService", () => {
  beforeEach(() => {
    mockGetDocuments.mockReset();
    mockCreateDocument.mockReset();
    mockDeleteDocument.mockReset();
  });

  describe("listDocuments", () => {
    it("given Firestore returns documents, when listDocuments is called, then returns the list (happy path)", async () => {
      const docs = [{ id: "d1", name: "Doc 1", content: "x", type: "text" }];
      mockGetDocuments.mockResolvedValue(docs);

      const result = await listDocuments("user-1");

      expect(result).toEqual(docs);
    });

    it("given getDocuments throws, when listDocuments is called, then propagates the error", async () => {
      mockGetDocuments.mockRejectedValue(new Error("DB error"));

      await expect(listDocuments("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("ingestDocument", () => {
    it("given valid data, when ingestDocument is called, then creates the document and returns id and name (happy path)", async () => {
      mockCreateDocument.mockResolvedValue({ id: "doc-1", name: "My Doc" });

      const result = await ingestDocument("user-1", {
        name: "My Doc",
        content: "Para one\n\nPara two",
        type: "text",
      });

      expect(result).toEqual({ id: "doc-1", name: "My Doc" });
      expect(mockCreateDocument).toHaveBeenCalledWith("user-1", {
        name: "My Doc",
        content: "Para one\n\nPara two",
        type: "text",
      });
    });

    it("given createDocument throws, when ingestDocument is called, then propagates the error", async () => {
      mockCreateDocument.mockRejectedValue(new Error("Create failed"));

      await expect(
        ingestDocument("user-1", { name: "X", content: "Y", type: "text" })
      ).rejects.toThrow("Create failed");
    });
  });

  describe("deleteDocument", () => {
    it("given valid id, when deleteDocument is called, then calls firestore delete (happy path)", async () => {
      mockDeleteDocument.mockResolvedValue(undefined);

      await deleteDocument("user-1", "doc-1");

      expect(mockDeleteDocument).toHaveBeenCalledWith("user-1", "doc-1");
    });

    it("given deleteDocument throws, when deleteDocument is called, then propagates the error", async () => {
      mockDeleteDocument.mockRejectedValue(new Error("Delete failed"));

      await expect(deleteDocument("user-1", "doc-1")).rejects.toThrow("Delete failed");
    });
  });
});
