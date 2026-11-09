import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NoteResourceRecord } from "../../../lib/firestore-db.js";

const mockAdd = vi.hoisted(() => vi.fn());
const mockGetAll = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/firestore-db.js", () => ({
  addResourceToFirestore: (...a: unknown[]) => mockAdd(...a),
  getResourcesFromFirestore: (...a: unknown[]) => mockGetAll(...a),
  deleteResourceFromFirestore: (...a: unknown[]) => mockDelete(...a),
  updateResourceInFirestore: (...a: unknown[]) => mockUpdate(...a),
}));

import {
  addResource,
  getResources,
  deleteResource,
  updateResource,
  searchResources,
} from "../../../services/resourceService.js";

describe("resourceService", () => {
  beforeEach(() => {
    mockAdd.mockReset();
    mockGetAll.mockReset();
    mockDelete.mockReset();
    mockUpdate.mockReset();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            `<html><head><title>Page Title</title><meta property="og:image" content="https://x/img.png" /></head></html>`,
            { status: 200, headers: { "Content-Type": "text/html" } }
          )
        )
    );
  });

  describe("addResource", () => {
    it("fetches metadata and delegates to Firestore", async () => {
      const saved = {
        id: "r1",
        userId: "u1",
        description: "d",
        url: "https://example.com",
        title: "Page Title",
        thumbnailUrl: "https://x/img.png",
        tags: ["a"],
      } as NoteResourceRecord;
      mockAdd.mockResolvedValue(saved);

      const result = await addResource("u1", {
        description: "d",
        url: "https://example.com",
        tags: ["a"],
      });

      expect(result).toEqual(saved);
      expect(mockAdd).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({
          userId: "u1",
          description: "d",
          url: "https://example.com",
          title: "Page Title",
          thumbnailUrl: "https://x/img.png",
          tags: ["a"],
        })
      );
      expect(fetch).toHaveBeenCalledWith("https://example.com", expect.any(Object));
    });

    it("uses URL as title when fetch fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
      mockAdd.mockImplementation(async (_uid: string, payload: Record<string, unknown>) => ({
        id: "r2",
        ...payload,
      }));

      await addResource("u1", { description: "x", url: "https://z.org" });

      expect(mockAdd).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({
          title: "https://z.org",
        })
      );
    });
  });

  describe("getResources / deleteResource / updateResource", () => {
    it("delegates to Firestore helpers", async () => {
      mockGetAll.mockResolvedValue([]);
      mockDelete.mockResolvedValue(undefined);
      mockUpdate.mockResolvedValue(undefined);

      await expect(getResources("u1")).resolves.toEqual([]);
      await deleteResource("u1", "r1");
      await updateResource("u1", "r1", { isFavorite: true });

      expect(mockGetAll).toHaveBeenCalledWith("u1");
      expect(mockDelete).toHaveBeenCalledWith("u1", "r1");
      expect(mockUpdate).toHaveBeenCalledWith("u1", "r1", { isFavorite: true });
    });
  });

  describe("searchResources", () => {
    const samples = [
      {
        id: "1",
        userId: "u1",
        description: "React hooks",
        url: "https://a",
        title: "Docs",
        tags: ["lib"],
      },
      {
        id: "2",
        userId: "u1",
        description: "Other",
        url: "https://b",
        title: "Vue guide",
        tags: ["framework"],
      },
    ] as NoteResourceRecord[];

    it("returns all when keywords empty", async () => {
      mockGetAll.mockResolvedValue(samples);
      const r = await searchResources("u1", []);
      expect(r).toHaveLength(2);
    });

    it("filters by keyword in description, title, or tags", async () => {
      mockGetAll.mockResolvedValue(samples);
      expect((await searchResources("u1", ["react"])).map((x) => x.id)).toEqual(["1"]);
      expect((await searchResources("u1", ["vue"])).map((x) => x.id)).toEqual(["2"]);
      expect((await searchResources("u1", ["framework"])).map((x) => x.id)).toEqual(["2"]);
    });

    it("is case-insensitive", async () => {
      mockGetAll.mockResolvedValue(samples);
      const r = await searchResources("u1", ["REACT"]);
      expect(r).toHaveLength(1);
    });
  });
});
