import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Resource } from "@/contexts/bc_resources/models";

const mockAdd = vi.hoisted(() => vi.fn());
const mockGetAll = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_resources/repositories", () => ({
  addResource: (...a: unknown[]) => mockAdd(...a),
  getResources: (...a: unknown[]) => mockGetAll(...a),
  deleteResource: (...a: unknown[]) => mockDelete(...a),
  updateResource: (...a: unknown[]) => mockUpdate(...a),
}));

import {
  addResource,
  getResources,
  deleteResource,
  updateResource,
  searchResources,
} from "@/contexts/bc_resources/services";

describe("bc_resources services (resources)", () => {
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
        description: "d",
        url: "https://example.com",
        title: "Page Title",
        thumbnailUrl: "https://x/img.png",
        tags: ["a"],
      } as Resource;
      mockAdd.mockResolvedValue(saved);

      const result = await addResource({
        description: "d",
        url: "https://example.com",
        tags: ["a"],
      });

      expect(result).toEqual(saved);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
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
      mockAdd.mockImplementation(async (payload: Record<string, unknown>) => ({
        id: "r2",
        ...payload,
      }));

      await addResource({ description: "x", url: "https://z.org" });

      expect(mockAdd).toHaveBeenCalledWith(
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

      await expect(getResources()).resolves.toEqual([]);
      await deleteResource("r1");
      await updateResource("r1", { isFavorite: true });

      expect(mockGetAll).toHaveBeenCalledWith();
      expect(mockDelete).toHaveBeenCalledWith("r1");
      expect(mockUpdate).toHaveBeenCalledWith("r1", { isFavorite: true });
    });
  });

  describe("searchResources", () => {
    const samples = [
      {
        id: "1",
        description: "React hooks",
        url: "https://a",
        title: "Docs",
        tags: ["lib"],
      },
      {
        id: "2",
        description: "Other",
        url: "https://b",
        title: "Vue guide",
        tags: ["framework"],
      },
    ] as Resource[];

    it("returns all when keywords empty", async () => {
      mockGetAll.mockResolvedValue(samples);
      const r = await searchResources([]);
      expect(r).toHaveLength(2);
    });

    it("filters by keyword in description, title, or tags", async () => {
      mockGetAll.mockResolvedValue(samples);
      expect((await searchResources(["react"])).map((x) => x.id)).toEqual(["1"]);
      expect((await searchResources(["vue"])).map((x) => x.id)).toEqual(["2"]);
      expect((await searchResources(["framework"])).map((x) => x.id)).toEqual(["2"]);
    });

    it("is case-insensitive", async () => {
      mockGetAll.mockResolvedValue(samples);
      const r = await searchResources(["REACT"]);
      expect(r).toHaveLength(1);
    });
  });
});
