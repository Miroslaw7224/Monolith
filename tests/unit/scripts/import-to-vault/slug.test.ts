// @vitest-environment node
import { describe, expect, it } from "vitest";
import { allocateName, htmlFileName, slugify } from "@/scripts/import-to-vault/slug";

describe("slugify", () => {
  it("transliterates Polish letters", () => {
    expect(slugify("Zażółć gęślą jaźń")).toBe("zazolc-gesla-jazn");
  });

  it("collapses punctuation and trims", () => {
    expect(slugify("  Hello,  World!! ")).toBe("hello-world");
  });

  it("falls back to bez-tytulu for empty or non-latin input", () => {
    expect(slugify("")).toBe("bez-tytulu");
    expect(slugify("???")).toBe("bez-tytulu");
    expect(slugify("日本語")).toBe("bez-tytulu");
  });

  it("appends a dash to reserved Windows names", () => {
    expect(slugify("CON")).toBe("con-");
  });

  it("limits length to 80 and trims trailing dashes", () => {
    expect(slugify("a".repeat(100))).toHaveLength(80);
    expect(slugify("a".repeat(79) + " b")).toBe("a".repeat(79));
  });
});

describe("allocateName", () => {
  it("returns base when free", () => {
    expect(allocateName("x", () => false)).toBe("x");
  });

  it("adds numeric suffixes when taken", () => {
    expect(allocateName("x", (n) => n === "x")).toBe("x-2");
    expect(allocateName("x", (n) => ["x", "x-2"].includes(n))).toBe("x-3");
  });
});

describe("htmlFileName", () => {
  it("keeps safe ids unchanged", () => {
    expect(htmlFileName("abc_DEF-123")).toBe("abc_DEF-123");
  });

  it("sanitizes unsafe ids deterministically with a hash suffix", () => {
    const name = htmlFileName("a/b");
    expect(name).toMatch(/^a_b-[0-9a-f]{8}$/);
    expect(htmlFileName("a/b")).toBe(name);
  });

  it("does not collide for ids that sanitize to the same text", () => {
    expect(htmlFileName("a/b")).not.toBe(htmlFileName("a_b"));
  });
});
