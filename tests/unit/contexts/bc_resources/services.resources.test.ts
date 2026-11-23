// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { formatYamlList } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import type * as NexusDocsServices from "@/contexts/bc_nexus_docs/services";
import type * as TagsServices from "@/contexts/bc_tags/services";
import { setupTempVault } from "../../helpers/tempVault";

const mockLinkIndex = vi.hoisted(() => vi.fn<typeof NexusDocsServices.buildKnowledgeLinkIndex>());
const mockResolveTags = vi.hoisted(() => vi.fn<typeof TagsServices.resolveTags>());

vi.mock("@/contexts/bc_nexus_docs/services", async (importOriginal) => {
  const actual = await importOriginal<typeof NexusDocsServices>();
  return {
    buildKnowledgeLinkIndex: mockLinkIndex,
    normalizeHost: actual.normalizeHost,
  } satisfies Partial<typeof NexusDocsServices>;
});

vi.mock(
  "@/contexts/bc_tags/services",
  () => ({ resolveTags: mockResolveTags }) satisfies Partial<typeof TagsServices>
);

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

const vault = setupTempVault();
const FILE = "Resources/resources.yaml";

type Stored = {
  id: string;
  title?: string;
  url?: string;
  description?: string;
  tags?: string[];
  favorite?: boolean;
  note_id?: string;
};

/** Zapisuje zasoby w pliku tak, jak robi to repozytorium. */
const seed = (...records: Stored[]) =>
  vault.write(
    FILE,
    formatYamlList(
      "resources",
      records.map((r) => ({
        title: "",
        url: "",
        description: "",
        tags: [] as string[],
        favorite: false,
        ...r,
      }))
    )
  );
const stored = () => readList(FILE, "resources");

describe("bc_resources services (resources)", () => {
  beforeEach(() => {
    mockLinkIndex.mockReset();
    mockResolveTags.mockReset();
    mockResolveTags.mockImplementation(async (names) =>
      Array.isArray(names) ? names.map(String) : []
    );
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
    it("pobiera metadane strony i zapisuje zasób w vaulcie", async () => {
      const result = await addResource({
        description: "d",
        url: "https://example.com",
        tags: ["a"],
      });

      expect(stored()).toEqual([
        {
          id: result.id,
          title: "Page Title",
          url: "https://example.com",
          description: "d",
          tags: ["a"],
          favorite: false,
          thumbnail_url: "https://x/img.png",
          created: result.createdAt,
          updated: result.updatedAt,
        },
      ]);
      expect(fetch).toHaveBeenCalledWith("https://example.com", expect.any(Object));
    });

    it("uses URL as title when fetch fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

      await addResource({ description: "x", url: "https://z.org" });

      expect(stored().map((r) => r.title)).toEqual(["https://z.org"]);
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

      await addResource({ description: "x", url: "https://www.example.com/page" });

      expect(stored().map((r) => r.title)).toEqual(["example.com"]);
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

      await addResource({ description: "x", url: "https://qa.example" });

      expect(stored().map((r) => r.title)).toEqual(["Q&A – Docs"]);
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

      await addResource({ description: "x", url: "https://x.test/page" });

      expect(stored().map((r) => r.thumbnail_url)).toEqual(["https://x.test/og?a=1&b=2"]);
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

      await addResource({ description: "x", url: "https://nbsp.example" });

      expect(stored().map((r) => r.title)).toEqual(["https://nbsp.example"]);
    });
  });

  describe("getResources / deleteResource / updateResource", () => {
    it("getResources zwraca [] dla pustego vaulta", async () => {
      await expect(getResources()).resolves.toEqual([]);
    });

    it("deleteResource usuwa zasób z pliku i zostawia pozostałe", async () => {
      seed({ id: "r1" }, { id: "r2" });

      await deleteResource("r1");

      expect(stored().map((r) => r.id)).toEqual(["r2"]);
    });

    it("updateResource zmienia tylko podane pole", async () => {
      seed({ id: "r1", title: "T" });

      await updateResource("r1", { isFavorite: true });

      expect(stored().map((r) => [r.id, r.title, r.favorite])).toEqual([["r1", "T", true]]);
    });
  });

  describe("searchResources", () => {
    beforeEach(() => {
      seed(
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
        }
      );
    });

    it("returns all when keywords empty", async () => {
      const r = await searchResources([]);
      expect(r.map((x) => x.id).sort()).toEqual(["1", "2"]);
    });

    it("filters by keyword in description, title, or tags", async () => {
      expect((await searchResources(["react"])).map((x) => x.id)).toEqual(["1"]);
      expect((await searchResources(["vue"])).map((x) => x.id)).toEqual(["2"]);
      expect((await searchResources(["framework"])).map((x) => x.id)).toEqual(["2"]);
    });

    it("is case-insensitive", async () => {
      const r = await searchResources(["REACT"]);
      expect(r).toHaveLength(1);
    });
  });

  describe("tagi w addResource/updateResource", () => {
    it("addResource zapisuje tagi zwrócone przez resolveTags", async () => {
      mockResolveTags.mockResolvedValue(["Learning"]);

      await addResource({ description: "d", url: "https://example.com", tags: ["kurs", "nauka"] });

      expect(mockResolveTags).toHaveBeenCalledWith(["kurs", "nauka"]);
      expect(stored().map((r) => r.tags)).toEqual([["Learning"]]);
    });

    it("addResource bez tagów zapisuje pustą listę", async () => {
      await addResource({ description: "d", url: "https://example.com" });

      expect(stored().map((r) => r.tags)).toEqual([[]]);
    });

    it("updateResource scala tagi przez resolveTags, a bez tagów ich nie dotyka", async () => {
      seed({ id: "r1", tags: ["stary"] });
      mockResolveTags.mockResolvedValue(["Learning"]);

      await updateResource("r1", { tags: ["Kursy", "kurs"] });
      expect(stored().map((r) => r.tags)).toEqual([["Learning"]]);

      mockResolveTags.mockClear();
      await updateResource("r1", { isFavorite: true });

      expect(mockResolveTags).not.toHaveBeenCalled();
      expect(stored().map((r) => [r.tags, r.favorite])).toEqual([[["Learning"], true]]);
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
  const index = {
    hostToPath: new Map([["github.com", "Knowledge/gh.md"]]),
    paths: new Set(["Knowledge/gh.md", "Knowledge/own.md"]),
  };

  beforeEach(() => {
    mockLinkIndex.mockReset();
  });

  it("noteId wskazujący widoczny dokument wygrywa nad hostem", async () => {
    mockLinkIndex.mockReturnValue(index);
    seed({ id: "1", url: "https://github.com/a", note_id: "Knowledge/own.md" });
    expect((await getResources())[0].notePath).toBe("Knowledge/own.md");
  });

  it("noteId spoza listy jest ignorowany i działa host", async () => {
    mockLinkIndex.mockReturnValue(index);
    seed({ id: "1", url: "https://www.github.com/a", note_id: "Knowledge/nie-ma.md" });
    expect((await getResources())[0].notePath).toBe("Knowledge/gh.md");
  });

  it("brak trafienia: brak notePath", async () => {
    mockLinkIndex.mockReturnValue(index);
    seed({ id: "1", url: "https://nigdzie.example" });
    expect((await getResources())[0].notePath).toBeUndefined();
  });

  it("błąd budowy indeksu nie psuje listy", async () => {
    mockLinkIndex.mockImplementation(() => {
      throw new Error("vault");
    });
    seed({ id: "1", url: "https://github.com/a" });
    const result = await getResources();
    expect(result).toHaveLength(1);
    expect(result[0].notePath).toBeUndefined();
  });
});
