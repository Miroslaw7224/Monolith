import { describe, expect, it } from "vitest";
import { formatTokens, packSections } from "@/src/features/projects/packSections";

describe("formatTokens", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [3850, "3 850"],
    [1234567, "1 234 567"],
  ])("%i → %s", (n, text) => {
    expect(formatTokens(n)).toBe(text);
  });
});

describe("packSections", () => {
  it("nagłówek i sekcje ## z szacunkiem 4 znaki na token", () => {
    const md = ["# P", "", "## A", "x".repeat(40), "", "## B", "y".repeat(80)].join("\n");
    expect(packSections(md)).toEqual([
      { name: "Nagłówek", tokens: 1 },
      { name: "A", tokens: 12 },
      { name: "B", tokens: 22 },
    ]);
  });

  it("## w bloku kodu nie otwiera sekcji", () => {
    const md = "# P\n\n## Kod (git)\n\n```\n## main...origin/main\n```\n";
    expect(packSections(md).map((s) => s.name)).toEqual(["Nagłówek", "Kod (git)"]);
  });

  it("pusty markdown: brak sekcji", () => {
    expect(packSections("")).toEqual([]);
  });
});
