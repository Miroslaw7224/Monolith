// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseYamlList } from "@/lib/nexus/yaml-lists";
import {
  deleteAgentEntry,
  insertAgentEntry,
  readAgentEntries,
  replaceAgentEntry,
} from "@/contexts/bc_arsenal/repositories";
import { setupTempVault } from "../../helpers/tempVault";

const FILE = "Arsenal/agents.yaml";
const vault = setupTempVault();

const HAND_WRITTEN = `version: 1
items:
  - id: a1
    kind: agent
    name: agy
    role: Review i wyszukiwanie
    model: Gemini Flash
    when: Pytania o kod
    x_extra: zostaje
  - id: p1
    kind: preset
    name: Review diffa
    command: scripts/ask-helper.sh --role review agy "<co sprawdzić>"
  - id: s1
    kind: script
    name: ask-helper
    path: scripts/ask-helper.sh
    description: Wysyła prompt do pomocnika
    example: scripts/ask-helper.sh agy "pytanie"
  - id: b1
    kind: agent
    name: Bez roli
  - id: b2
    kind: nieznany
    name: X
  - name: Bez id
    kind: preset
    command: x
`;

const stored = () => parseYamlList(vault.read(FILE)!, "items").items;

describe("readAgentEntries", () => {
  it("brak pliku = pusta lista", () => {
    expect(readAgentEntries()).toEqual({ entries: [], skipped: 0 });
  });

  it("mapuje trzy rodzaje w kolejności pliku i liczy pominięte", () => {
    vault.write(FILE, HAND_WRITTEN);
    const { entries, skipped } = readAgentEntries();
    expect(skipped).toBe(3);
    expect(entries).toEqual([
      {
        kind: "agent",
        id: "a1",
        name: "agy",
        role: "Review i wyszukiwanie",
        model: "Gemini Flash",
        when: "Pytania o kod",
      },
      {
        kind: "preset",
        id: "p1",
        name: "Review diffa",
        command: 'scripts/ask-helper.sh --role review agy "<co sprawdzić>"',
      },
      {
        kind: "script",
        id: "s1",
        name: "ask-helper",
        path: "scripts/ask-helper.sh",
        description: "Wysyła prompt do pomocnika",
        example: 'scripts/ask-helper.sh agy "pytanie"',
      },
    ]);
  });
});

describe("insertAgentEntry", () => {
  it("dopisuje wpis z id i z kluczami w kolejności kind, name, pola; bez pustych", async () => {
    const entry = await insertAgentEntry({ kind: "preset", name: "P", command: "cmd" });
    expect(entry.id).toMatch(/^[A-Za-z0-9]{20}$/);
    const [item] = stored();
    expect(Object.keys(item)).toEqual(["id", "kind", "name", "command"]);
  });
});

describe("replaceAgentEntry", () => {
  it("zmiana rodzaju czyści pola poprzedniego rodzaju, nieznane klucze zostają", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await replaceAgentEntry("a1", { kind: "preset", name: "Z agenta", command: "cmd" });
    const item = stored().find((i) => i.id === "a1")!;
    expect(item).toMatchObject({
      kind: "preset",
      name: "Z agenta",
      command: "cmd",
      x_extra: "zostaje",
    });
    for (const key of ["role", "model", "when"]) expect(key in item).toBe(false);
    expect(stored()).toHaveLength(6); // pominięte wpisy przeżywają zapis
  });

  it("puste pola opcjonalne kasują klucze", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await replaceAgentEntry("s1", {
      kind: "script",
      name: "ask-helper",
      path: "scripts/ask-helper.sh",
    });
    const item = stored().find((i) => i.id === "s1")!;
    expect("description" in item).toBe(false);
    expect("example" in item).toBe(false);
  });

  it("nieistniejące id to błąd 404", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await expect(
      replaceAgentEntry("brak", { kind: "agent", name: "x", role: "r" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("deleteAgentEntry", () => {
  it("usuwa wpis; brak wpisu nie zmienia pliku", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await deleteAgentEntry("p1");
    expect(stored().map((i) => i.id)).not.toContain("p1");
    const before = vault.read(FILE);
    await deleteAgentEntry("brak");
    expect(vault.read(FILE)).toBe(before);
  });
});
