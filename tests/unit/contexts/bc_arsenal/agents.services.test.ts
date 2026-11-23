// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseYamlList } from "@/lib/nexus/yaml-lists";
import {
  createAgentEntry,
  listAgents,
  removeAgentEntry,
  updateAgentEntry,
} from "@/contexts/bc_arsenal/services";
import { setupTempVault } from "../../helpers/tempVault";

const FILE = "Arsenal/agents.yaml";
const vault = setupTempVault();

const agent = { kind: "agent" as const, id: "a1", name: "agy", role: "Review" };
const agent2 = { kind: "agent" as const, id: "a2", name: "cursor", role: "Testy" };
const preset = { kind: "preset" as const, id: "p1", name: "P", command: "cmd" };
const script = { kind: "script" as const, id: "s1", name: "S", path: "scripts/x.sh" };

/** Wpisy w pliku, w formacie czytanym przez repozytorium. */
const seed = (...blocks: string[]) => vault.write(FILE, `version: 1\nitems:\n${blocks.join("")}`);
const A1 = "  - id: a1\n    kind: agent\n    name: agy\n    role: Review\n";
const A2 = "  - id: a2\n    kind: agent\n    name: cursor\n    role: Testy\n";
const P1 = "  - id: p1\n    kind: preset\n    name: P\n    command: cmd\n";
const S1 = "  - id: s1\n    kind: script\n    name: S\n    path: scripts/x.sh\n";
const BAD = "  - kind: preset\n    name: Bez id\n    command: x\n";
const stored = () => parseYamlList(vault.read(FILE)!, "items").items;

describe("listAgents", () => {
  it("grupuje wg rodzaju z zachowaniem kolejności pliku i przekazuje licznik pominiętych", () => {
    seed(S1, A1, P1, A2, BAD);

    expect(listAgents()).toEqual({
      agents: [agent, agent2],
      presets: [preset],
      scripts: [script],
      skipped: 1,
    });
  });
});

describe("createAgentEntry", () => {
  it("dopisuje wpis do pliku i zwraca go z nowym id", async () => {
    const created = await createAgentEntry({ kind: "preset", name: "P", command: "cmd" });

    expect(created).toEqual({ ...preset, id: created.id });
    expect(stored()).toEqual([{ id: created.id, kind: "preset", name: "P", command: "cmd" }]);
  });
});

describe("updateAgentEntry", () => {
  it("zapisuje w pliku i zwraca świeży wpis, sąsiednie zostają", async () => {
    seed(A1, P1);

    const updated = await updateAgentEntry("a1", { kind: "agent", name: "agy", role: "Nowa rola" });

    expect(updated).toEqual({ ...agent, role: "Nowa rola" });
    expect(stored()).toEqual([
      { id: "a1", kind: "agent", name: "agy", role: "Nowa rola" },
      { id: "p1", kind: "preset", name: "P", command: "cmd" },
    ]);
  });

  it("nieznany wpis to 404 i plik bez zmian", async () => {
    seed(A1);

    await expect(
      updateAgentEntry("brak", { kind: "agent", name: "x", role: "r" })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(vault.read(FILE)).toBe(`version: 1\nitems:\n${A1}`);
  });
});

describe("removeAgentEntry", () => {
  it("usuwa wpis z pliku i zostawia pozostałe", async () => {
    seed(A1, P1);

    await removeAgentEntry("a1");

    expect(stored()).toEqual([{ id: "p1", kind: "preset", name: "P", command: "cmd" }]);
  });
});
