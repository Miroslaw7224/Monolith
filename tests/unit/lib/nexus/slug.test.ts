// @vitest-environment node
import { describe, expect, it } from "vitest";
import { allocateName, slugify } from "@/lib/nexus/slug";

describe("slugify (P3: nazwy bezpieczne dla systemu plików)", () => {
  it("removes backslashes, slashes and dot segments", () => {
    expect(slugify("a\\b/../c")).toBe("a-b-c");
    expect(slugify("..\\..\\etc")).toBe("etc");
  });
  it("falls back for names made only of separators", () => {
    expect(slugify("..")).toBe("bez-tytulu");
    expect(slugify("\\")).toBe("bez-tytulu");
    expect(slugify("  ")).toBe("bez-tytulu");
  });
  it("only ever yields [a-z0-9-]", () => {
    expect(slugify("Zażółć: gęślą/jaźń \\ 日本語 ✓")).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("allocateName (lib/nexus)", () => {
  it("appends the first free numeric suffix", () => {
    expect(allocateName("x", (n) => n === "x" || n === "x-2")).toBe("x-3");
  });
});
