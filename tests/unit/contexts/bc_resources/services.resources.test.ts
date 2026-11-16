import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Resource } from "@/contexts/bc_resources/models";

const mockAdd = vi.hoisted(() => vi.fn());
const mockGetAll = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockLinkIndex = vi.hoisted(() => vi.fn());
const mockResolveTags = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_resources/repositories", () => ({
  addResource: (...a: unknown[]) => mockAdd(...a),
  getResources: (...a: unknown[]) => mockGetAll(...a),
  deleteResource: (...a: unknown[]) => mockDelete(...a),
  updateResource: (...a: unknown[]) => mockUpdate(...a),
}));

vi.mock("@/contexts/bc_nexus_docs/services", () => ({
  buildKnowledgeLinkIndex: (...a: unknown[]) => mockLinkIndex(...a),
  normalizeHost: (url: string) => {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return null;
    }
  },
}));

vi.mock("@/contexts/bc_tags/services", () => ({
  resolveTags: (...a: unknown[]) => mockResolveTags(...a),
}));

import {
  addResource,
  getResources,
  deleteResource,
  updateResource,
  searchResources,
  decodeHtmlEntities,
  hostTitle,
  isBlockedTitle,
} from "@/contexts/bc_resources/services";

describe("bc_resources services (resources)", () => {
  beforeEach(() => {
    mockAdd.mockReset();
    mockGetAll.mockReset();
    mockDelete.mockReset();
    mockUpdate.mockReset();
    mockLinkIndex.mockReset();
    mockResolveTags.mockReset();
    mockResolveTags.mockImplementation(async (names: string[]) => names);
    mockLinkIndex.mockReturnValue({ hostToPath: new Map(), paths: new Set() });
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

    it("zastępuje tytuł Cloudflare nazwą domeny", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response("<html><head><title>Just a moment...</title></head></html>", {
            status: 200,
          })
        )
      );
      mockAdd.mockImplementation(async (payload: Record<string, unknown>) => ({
        id: "r3",
        ...payload,
      }));

      await addResource({ description: "x", url: "https://www.example.com/page" });

      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ title: "example.com" }));
    });

    it("dekoduje encje HTML w tytule", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response("<html><head><title>Q&amp;A &#8211; Docs</title></head></html>", {
            status: 200,
          })
        )
      );
      mockAdd.mockImplementation(async (payload: Record<string, unknown>) => ({
        id: "r4",
        ...payload,
      }));

      await addResource({ description: "x", url: "https://qa.example" });

      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ title: "Q&A \u2013 Docs" }));
    });

    it("dekoduje encje HTML w og:image (thumbnailUrl)", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              `<html><head><title>OG</title><meta property="og:image" content="https://x.test/og?a=1&amp;b=2"></head></html>`,
              { status: 200 }
            )
          )
      );
      mockAdd.mockImplementation(async (payload: Record<string, unknown>) => ({
        id: "r-og",
        ...payload,
      }));

      await addResource({ description: "x", url: "https://x.test/page" });

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ thumbnailUrl: "https://x.test/og?a=1&b=2" })
      );
    });

    it("tytuł złożony z samych encji białych znaków wraca do URL", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response("<html><head><title>&nbsp;</title></head></html>", { status: 200 })
          )
      );
      mockAdd.mockImplementation(async (payload: Record<string, unknown>) => ({
        id: "r5",
        ...payload,
      }));

      await addResource({ description: "x", url: "https://nbsp.example" });

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: "https://nbsp.example" })
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

  describe("tagi w addResource/updateResource", () => {
    it("addResource zapisuje tagi zwrócone przez resolveTags", async () => {
      mockResolveTags.mockResolvedValue(["Learning"]);
      mockAdd.mockImplementation(async (p: Record<string, unknown>) => ({ id: "r5", ...p }));
      await addResource({ description: "d", url: "https://example.com", tags: ["kurs", "nauka"] });
      expect(mockResolveTags).toHaveBeenCalledWith(["kurs", "nauka"]);
      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ tags: ["Learning"] }));
    });
    it("addResource bez tagów woła resolveTags z pustą listą", async () => {
      mockAdd.mockImplementation(async (p: Record<string, unknown>) => ({ id: "r6", ...p }));
      await addResource({ description: "d", url: "https://example.com" });
      expect(mockResolveTags).toHaveBeenCalledWith([]);
    });
    it("updateResource scala tagi przez resolveTags, a bez tagów ich nie dotyka", async () => {
      mockUpdate.mockResolvedValue(undefined);
      mockResolveTags.mockResolvedValue(["Learning"]);
      await updateResource("r1", { tags: ["Kursy", "kurs"] });
      expect(mockUpdate).toHaveBeenCalledWith("r1", { tags: ["Learning"] });
      mockResolveTags.mockClear();
      await updateResource("r1", { isFavorite: true });
      expect(mockResolveTags).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenLastCalledWith("r1", { isFavorite: true });
    });
  });
});

describe("pomocnicze tytułu", () => {
  it("isBlockedTitle rozpoznaje strony Cloudflare", () => {
    expect(isBlockedTitle("Just a moment...")).toBe(true);
    expect(isBlockedTitle("Just a moment\u2026")).toBe(true);
    expect(isBlockedTitle("  attention required! | Cloudflare")).toBe(true);
    expect(isBlockedTitle("Moment of truth")).toBe(false);
  });
  it("hostTitle zwraca host bez www i URL przy błędnym adresie", () => {
    expect(hostTitle("https://www.example.com/a?b=1")).toBe("example.com");
    expect(hostTitle("nie-url")).toBe("nie-url");
  });
  it("decodeHtmlEntities", () => {
    expect(decodeHtmlEntities("A &lt;b&gt; &quot;c&quot; &#39;d&#39; &#x27;e&#x27; &nbsp;f")).toBe(
      "A <b> \"c\" 'd' 'e'  f"
    );
  });
  it("decodeHtmlEntities dekoduje w jednym przebiegu i nie rzuca dla kodu poza zakresem", () => {
    expect(decodeHtmlEntities("&amp;#39;")).toBe("&#39;");
    expect(() => decodeHtmlEntities("&#99999999;")).not.toThrow();
    expect(decodeHtmlEntities("&#99999999; &#x110000;")).toBe("&#99999999; &#x110000;");
  });
});

describe("getResources: notePath", () => {
  const base = { description: "", title: "T", tags: [] as string[] };
  const index = {
    hostToPath: new Map([["github.com", "Knowledge/gh.md"]]),
    paths: new Set(["Knowledge/gh.md", "Knowledge/own.md"]),
  };

  beforeEach(() => {
    mockGetAll.mockReset();
    mockLinkIndex.mockReset();
  });

  it("noteId wskazujący widoczny dokument wygrywa nad hostem", async () => {
    mockLinkIndex.mockReturnValue(index);
    mockGetAll.mockResolvedValue([
      { id: "1", url: "https://github.com/a", noteId: "Knowledge/own.md", ...base },
    ]);
    expect((await getResources())[0].notePath).toBe("Knowledge/own.md");
  });

  it("noteId spoza listy jest ignorowany i działa host", async () => {
    mockLinkIndex.mockReturnValue(index);
    mockGetAll.mockResolvedValue([
      { id: "1", url: "https://www.github.com/a", noteId: "Knowledge/nie-ma.md", ...base },
    ]);
    expect((await getResources())[0].notePath).toBe("Knowledge/gh.md");
  });

  it("brak trafienia: brak notePath", async () => {
    mockLinkIndex.mockReturnValue(index);
    mockGetAll.mockResolvedValue([{ id: "1", url: "https://nigdzie.example", ...base }]);
    expect((await getResources())[0].notePath).toBeUndefined();
  });

  it("błąd budowy indeksu nie psuje listy", async () => {
    mockLinkIndex.mockImplementation(() => {
      throw new Error("vault");
    });
    mockGetAll.mockResolvedValue([{ id: "1", url: "https://github.com/a", ...base }]);
    const result = await getResources();
    expect(result).toHaveLength(1);
    expect(result[0].notePath).toBeUndefined();
  });
});
