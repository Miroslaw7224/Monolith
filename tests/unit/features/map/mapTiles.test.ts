import { describe, expect, it } from "vitest";
import type { MapGraphDto } from "@/contexts/bc_map/schemas";
import { buildMapTiles } from "@/src/features/map/mapTiles";

const graph: MapGraphDto = {
  nodes: [],
  edges: [],
  tiles: {
    neurons: { total: 330, knowledge: 300, ai2030: 20, projects: 10 },
    dependencies: 12,
    blockers: null,
  },
  warnings: [],
};

describe("buildMapTiles", () => {
  it("cztery kafle z realnymi liczbami; blokery to „—”", () => {
    const tiles = buildMapTiles(graph, { available: true, count: 3 });
    expect(tiles.map((t) => [t.id, t.value])).toEqual([
      ["neurons", "330"],
      ["deps", "12"],
      ["blockers", "—"],
      ["agents", "3"],
    ]);
    expect(tiles[0].meta).toContain("300 Wiedza");
  });

  it("niedostępny Herdr: kafel agentów to „—”", () => {
    const tiles = buildMapTiles(graph, { available: false, count: 0 });
    expect(tiles[3].value).toBe("—");
    expect(tiles[3].meta).toMatch(/niedostępny/);
  });
});
