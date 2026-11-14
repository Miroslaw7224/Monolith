import { describe, expect, it } from "vitest";
import type { Agent, MapGraph } from "@/contexts/bc_map/models";
import {
  MapAgentsDtoSchema,
  MapGraphDtoSchema,
  toAgentsDto,
  toGraphDto,
} from "@/contexts/bc_map/schemas";

const graph: MapGraph = {
  clusters: [
    {
      id: "nexus",
      label: "NEXUS",
      group: "projects",
      size: 1,
      projectId: "nexus",
      owner: "personal",
    },
    { id: "skille", label: "Skille", group: "skills", size: 0, soon: true },
  ],
  nodes: [{ id: "Projects/nexus/nexus", label: "NEXUS", cluster: "nexus", links: 2 }],
  edges: [{ from: "Knowledge/a", to: "nexus", weight: 1, type: "project" }],
  clusterEdges: [{ from: "knowledge:tools", to: "nexus", weight: 3 }],
  tiles: { neurons: { total: 1, knowledge: 0, ai2030: 0, projects: 1 }, dependencies: 1 },
  warnings: ["w"],
};

describe("toGraphDto", () => {
  it("daje DTO zgodne ze schematem, z kaflem blokerów = null (D12)", () => {
    const dto = toGraphDto(graph);
    expect(dto.tiles.blockers).toBeNull();
    expect(MapGraphDtoSchema.safeParse(dto).success).toBe(true);
  });

  it("kopiuje skupiska bez pustych pól opcjonalnych i niczego spoza schematu", () => {
    const dto = toGraphDto({
      ...graph,
      nodes: [{ ...graph.nodes[0], cwd: "/home/u/x" } as never],
    });
    expect(JSON.stringify(dto)).not.toContain("/home/u");
    expect(dto.clusters[1]).toEqual({
      id: "skille",
      label: "Skille",
      group: "skills",
      size: 0,
      soon: true,
    });
    expect(dto.clusters[1]).not.toHaveProperty("projectId");
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
