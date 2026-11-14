import { describe, expect, it } from "vitest";
import type { Agent, MapGraph } from "@/contexts/bc_map/models";
import {
  MapAgentsDtoSchema,
  MapGraphDtoSchema,
  toAgentsDto,
  toGraphDto,
} from "@/contexts/bc_map/schemas";

const graph: MapGraph = {
  nodes: [
    { id: "nexus", kind: "project", label: "NEXUS", owner: "personal" },
    { id: "@skille", kind: "continent", label: "Skille", soon: true },
  ],
  edges: [{ from: "nexus", to: "@wiedza", weight: 2, type: "shared" }],
  tiles: { neurons: { total: 5, knowledge: 2, ai2030: 1, projects: 2 }, dependencies: 1 },
  warnings: ["w"],
};

describe("toGraphDto", () => {
  it("daje DTO zgodne ze schematem, z kaflem blokerów = null (D12)", () => {
    const dto = toGraphDto(graph);
    expect(dto.tiles.blockers).toBeNull();
    expect(MapGraphDtoSchema.safeParse(dto).success).toBe(true);
  });
});

describe("toAgentsDto", () => {
  it("kopiuje tylko znane pola: nawet obce pole cwd nie przechodzi", () => {
    const leaky = { address: "t1", label: "x", state: "live", cwd: "/home/u/secret" } as Agent;
    const dto = toAgentsDto({ available: true, agents: [leaky] });
    expect(JSON.stringify(dto)).not.toContain("secret");
    expect(MapAgentsDtoSchema.safeParse(dto).success).toBe(true);
  });
});
