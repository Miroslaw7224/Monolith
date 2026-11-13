import { describe, it, expect } from "vitest";
import {
  getFaviconUrl,
  parseBlockFormat,
  parseMultipleBlocks,
} from "@/src/features/resources/resourceParsing";

describe("resourceParsing", () => {
  describe("getFaviconUrl", () => {
    it("returns favicon URL for valid URL", () => {
      const url = "https://example.com/page";
      expect(getFaviconUrl(url)).toBe(
        "https://www.google.com/s2/favicons?domain=example.com&sz=48"
      );
    });

    it("returns empty string for invalid URL", () => {
      expect(getFaviconUrl("not-a-url")).toBe("");
      expect(getFaviconUrl("")).toBe("");
    });
  });

  describe("parseBlockFormat", () => {
    it("parses single block with Opis/URL/Tagi", () => {
      const text = `Opis: Color picker for project
URL: https://example.com
Tagi: design, tools`;
      const result = parseBlockFormat(text);
      expect(result).toEqual({
        description: "Color picker for project",
        url: "https://example.com",
        tags: ["design", "tools"],
      });
    });

    it("parses single block with Description/URL/Tags", () => {
      const text = `Description: My tool
URL: https://foo.org
Tags: a, b`;
      const result = parseBlockFormat(text);
      expect(result).toEqual({
        description: "My tool",
        url: "https://foo.org",
        tags: ["a", "b"],
      });
    });

    it("returns null when URL is missing", () => {
      const text = `Opis: Something
Tagi: x`;
      expect(parseBlockFormat(text)).toBeNull();
    });

    it("returns null for empty or whitespace-only text", () => {
      expect(parseBlockFormat("")).toBeNull();
      expect(parseBlockFormat("   \n  ")).toBeNull();
    });

    it("uses url as description when description is missing", () => {
      const text = `URL: https://example.com`;
      const result = parseBlockFormat(text);
      expect(result).toEqual({
        description: "https://example.com",
        url: "https://example.com",
        tags: [],
      });
    });

    it("parses tags with comma and semicolon separators", () => {
      const text = `Opis: X
URL: https://x.com
Tagi: a, b; c`;
      const result = parseBlockFormat(text);
      expect(result?.tags).toEqual(["a", "b", "c"]);
    });
  });

  describe("parseMultipleBlocks", () => {
    it("returns empty array for empty text", () => {
      expect(parseMultipleBlocks("")).toEqual([]);
      expect(parseMultipleBlocks("   ")).toEqual([]);
    });

    it("parses multiple blocks separated by Opis:", () => {
      const text = `Opis: First
URL: https://one.com
Tagi: a

Opis: Second
URL: https://two.com
Tagi: b`;
      const result = parseMultipleBlocks(text);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        description: "First",
        url: "https://one.com",
        tags: ["a"],
      });
      expect(result[1]).toEqual({
        description: "Second",
        url: "https://two.com",
        tags: ["b"],
      });
    });

    it("parses multiple blocks separated by Description:", () => {
      const text = `Description: Block A
URL: https://a.com

Description: Block B
URL: https://b.com`;
      const result = parseMultipleBlocks(text);
      expect(result).toHaveLength(2);
      expect(result[0].url).toBe("https://a.com");
      expect(result[1].url).toBe("https://b.com");
    });

    it("skips blocks that do not parse (e.g. no URL)", () => {
      const text = `Opis: No URL here
Tagi: x

Opis: Valid
URL: https://valid.com`;
      const result = parseMultipleBlocks(text);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://valid.com");
    });
  });
});
