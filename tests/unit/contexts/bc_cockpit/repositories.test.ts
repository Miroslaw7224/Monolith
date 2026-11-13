// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  readClosings,
  readPinned,
  upsertClosing,
  writePinned,
} from "@/contexts/bc_cockpit/repositories";
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

const CLOSING = "Cockpit/closing.yaml";

describe("readClosings / upsertClosing", () => {
  it("brak pliku to pusta lista", () => {
    expect(readClosings()).toEqual([]);
  });

  it("zapisuje wpis w formacie yaml-lists (klucz days) i odczytuje go", async () => {
    await upsertClosing({
      date: "2026-11-12",
      text: "Zacząć od K6",
      projectId: "nexus",
      commits: 4,
    });
    expect(vault.read(CLOSING)).toBe(
      formatYamlList("days", [
        { date: "2026-11-12", text: "Zacząć od K6", project: "nexus", commits: 4 },
      ])
    );
    expect(readClosings()).toEqual([
      { date: "2026-11-12", text: "Zacząć od K6", projectId: "nexus", commits: 4 },
    ]);
  });

  it("pola puste nie trafiają do pliku i wracają jako null", async () => {
    await upsertClosing({ date: "2026-11-12", text: "x", projectId: null, commits: null });
    expect(vault.read(CLOSING)).toBe(formatYamlList("days", [{ date: "2026-11-12", text: "x" }]));
    expect(readClosings()).toEqual([
      { date: "2026-11-12", text: "x", projectId: null, commits: null },
    ]);
  });

  it("ten sam dzień nadpisuje wpis, a lista jest posortowana rosnąco po dacie", async () => {
    await upsertClosing({ date: "2026-11-13", text: "b", projectId: null, commits: null });
    await upsertClosing({ date: "2026-11-11", text: "a", projectId: null, commits: null });
    await upsertClosing({ date: "2026-11-13", text: "b2", projectId: null, commits: 2 });
    expect(readClosings().map((c) => [c.date, c.text])).toEqual([
      ["2026-11-11", "a"],
      ["2026-11-13", "b2"],
    ]);
  });

  it("pomija wpisy bez poprawnej daty lub tekstu (plik edytowany ręcznie)", () => {
    vault.write(
      CLOSING,
      formatYamlList("days", [
        { date: "2026-11-10", text: "ok" },
        { date: "jutro", text: "zła data" },
        { date: "2026-11-09", text: " " },
        { text: "bez daty" },
        { date: "2026-11-08", text: "zły commits", commits: "dużo" },
      ])
    );
    expect(readClosings()).toEqual([
      { date: "2026-11-08", text: "zły commits", projectId: null, commits: null },
      { date: "2026-11-10", text: "ok", projectId: null, commits: null },
    ]);
  });

  it("nigdy nie nadpisuje pliku, który się nie parsuje", async () => {
    const broken = "days: [unclosed\n";
    vault.write(CLOSING, broken);
    await expect(
      upsertClosing({ date: "2026-11-12", text: "x", projectId: null, commits: null })
    ).rejects.toThrow(CLOSING);
    expect(vault.read(CLOSING)).toBe(broken);
  });
});
