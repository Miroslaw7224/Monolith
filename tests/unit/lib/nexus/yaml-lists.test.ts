// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatYamlList, parseYamlList } from "@/lib/nexus/yaml-lists";

const GEN = "import-to-vault";

describe("formatYamlList / parseYamlList", () => {
  it("pusta lista zawiera version, generated_by i pustą listę", () => {
    const text = formatYamlList("tags", [], GEN);
    expect(text).toContain("version: 1");
    expect(text).toContain("generated_by: import-to-vault");
    expect(text).toContain("tags: []");
    expect(parseYamlList(text, "tags")).toEqual({ generatedBy: GEN, items: [] });
  });

  it("round-trip rekordu z trudnymi wartościami", () => {
    const r = {
      id: "123",
      title: "yes",
      url: "https://x.y/?a=1&b=[2]::3",
      description: "linia 1\nlinia 2",
      note: " spacja",
      empty: "",
      nullish: "null",
      iso: "2026-05-01T10:00:00.000Z",
      tags: ["a: b", "# c"],
      favorite: true,
      pl: "Zażółć gęślą jaźń",
    };
    const parsed = parseYamlList(formatYamlList("resources", [r], GEN), "resources");
    expect(parsed.items[0]).toEqual(r);
  });

  it('id: "123" pozostaje tekstem po odczycie', () => {
    const parsed = parseYamlList(formatYamlList("resources", [{ id: "123" }], GEN), "resources");
    expect(typeof parsed.items[0].id).toBe("string");
    expect(parsed.items[0].id).toBe("123");
  });

  it("pole undefined jest pominięte w tekście i brak klucza po odczycie", () => {
    const text = formatYamlList("resources", [{ id: "1", missing: undefined }], GEN);
    expect(text).not.toContain("missing");
    const item = parseYamlList(text, "resources").items[0];
    expect("missing" in item).toBe(false);
  });

  it("brak generated_by daje generatedBy === null", () => {
    const text = formatYamlList("tags", [{ id: "1" }]);
    expect(text).not.toContain("generated_by");
    expect(parseYamlList(text, "tags").generatedBy).toBeNull();
  });

  it("rzuca błąd, gdy plik nie jest mapą", () => {
    expect(() => parseYamlList("- a\n- b", "x")).toThrow();
  });

  it("rzuca błąd, gdy klucz nie jest listą", () => {
    expect(() => parseYamlList("x: 5", "x")).toThrow('klucz "x" nie jest listą');
  });

  it("rzuca błąd, gdy element listy nie jest mapą", () => {
    expect(() => parseYamlList("x:\n  - 1", "x")).toThrow();
  });

  it("brak klucza listy daje pustą listę", () => {
    expect(parseYamlList("version: 1", "x").items).toEqual([]);
  });
});
