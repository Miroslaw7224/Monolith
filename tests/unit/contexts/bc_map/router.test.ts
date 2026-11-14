// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const mockGetGraph = vi.hoisted(() => vi.fn());
const mockGetAgents = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_map/services", () => ({
  getGraph: mockGetGraph,
  getAgents: mockGetAgents,
}));

import { GET as graphGET } from "@/app/api/map/graph/route";
import { GET as agentsGET } from "@/app/api/map/agents/route";

beforeEach(() => {
  mockGetGraph.mockReset();
  mockGetAgents.mockReset();
});

describe("GET /api/map/graph", () => {
  it("zwraca graf jako DTO", async () => {
    mockGetGraph.mockReturnValue({
      clusters: [],
      nodes: [{ id: "Knowledge/a", label: "A", cluster: "knowledge:x", links: 0 }],
      edges: [],
      clusterEdges: [],
      tiles: { neurons: { total: 1, knowledge: 0, ai2030: 0, projects: 1 }, dependencies: 0 },
      warnings: [],
    });
    const res = await graphGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodes).toHaveLength(1);
    expect(body.clusters).toEqual([]);
    expect(body.tiles.blockers).toBeNull();
  });

  it("błąd domeny mapuje na jego status", async () => {
    mockGetGraph.mockImplementation(() => {
      throw new DomainError("boom", 400);
    });
    const res = await graphGET();
    expect(res.status).toBe(400);
  });
});

describe("GET /api/map/agents", () => {
  it("zwraca agentów i available", async () => {
    mockGetAgents.mockReturnValue({
      available: true,
      agents: [{ address: "t1", label: "claude-code", state: "live" }],
    });
    const res = await agentsGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      available: true,
      agents: [{ address: "t1", label: "claude-code", state: "live" }],
    });
  });
});
