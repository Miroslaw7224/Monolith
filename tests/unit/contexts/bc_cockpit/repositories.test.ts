// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readPinned, writePinned } from "@/contexts/bc_cockpit/repositories";
import { formatYamlList } from "@/lib/nexus/yaml-lists";
import { useTempVault } from "../../helpers/tempVault";

const REL = "Cockpit/pinned.yaml";
const vault = useTempVault();

describe("readPinned", () => {
  it("brak pliku to pusta lista", () => {
    expect(readPinned()).toEqual({ ids: [] });
  });

  it("czyta `projects: [{id}]` w kolejności z pliku", () => {
    vault.write(REL, formatYamlList("projects", [{ id: "nexus" }, { id: "monolith" }]));
    expect(readPinned()).toEqual({ ids: ["nexus", "monolith"] });
  });

  it("pomija wpisy bez tekstowego id i duplikaty (ręcznie edytowany plik)", () => {
    vault.write(
      REL,
      formatYamlList("projects", [
        { id: "a" },
        { name: "bez id" },
        { id: 5 },
        { id: " " },
        { id: "a" },
      ])
    );
    expect(readPinned()).toEqual({ ids: ["a"] });
  });

  it("uszkodzony YAML to błąd z nazwą pliku (serwis zamienia go na ostrzeżenie)", () => {
    vault.write(REL, "projects: [unclosed\n");
    expect(() => readPinned()).toThrow(REL);
  });
});

describe("writePinned", () => {
  it("tworzy plik w formacie yaml-lists (version 1, bez generated_by) i da się go odczytać", async () => {
    await writePinned(["nexus", "monolith"]);
    expect(vault.read(REL)).toBe(formatYamlList("projects", [{ id: "nexus" }, { id: "monolith" }]));
    expect(readPinned()).toEqual({ ids: ["nexus", "monolith"] });
  });

  it("zastępuje całą listę, także pustą", async () => {
    await writePinned(["a", "b"]);
    await writePinned([]);
    expect(readPinned()).toEqual({ ids: [] });
  });

  it("nigdy nie nadpisuje pliku, który się nie parsuje", async () => {
    const broken = "projects: [unclosed\n";
    vault.write(REL, broken);
    await expect(writePinned(["a"])).rejects.toThrow(REL);
    expect(vault.read(REL)).toBe(broken);
  });
});
