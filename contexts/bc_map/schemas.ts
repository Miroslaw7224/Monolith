import { z } from "zod";
import type { Agent, MapGraph } from "./models";

const count = z.number().int().nonnegative();

export const MapClusterDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.enum(["projects", "knowledge", "ai2030", "skills"]),
  size: count,
  projectId: z.string().optional(),
  owner: z.enum(["personal", "work"]).optional(),
  soon: z.boolean().optional(),
});

export const MapNodeDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  cluster: z.string(),
  links: count,
});

export const MapEdgeDtoSchema = z.object({
  from: z.string(),
  to: z.string(),
  weight: z.number().int().positive(),
  type: z.enum(["link", "project"]),
});

export const MapClusterEdgeDtoSchema = z.object({
  from: z.string(),
  to: z.string(),
  weight: z.number().int().positive(),
});

export const MapGraphDtoSchema = z.object({
  clusters: z.array(MapClusterDtoSchema),
  nodes: z.array(MapNodeDtoSchema),
  edges: z.array(MapEdgeDtoSchema),
  clusterEdges: z.array(MapClusterEdgeDtoSchema),
  tiles: z.object({
    neurons: z.object({ total: count, knowledge: count, ai2030: count, projects: count }),
    dependencies: count,
    /** D12: brak danych o blokerach. */
    blockers: z.null(),
  }),
  warnings: z.array(z.string()),
});

export const AgentDtoSchema = z.object({
  address: z.string(),
  label: z.string(),
  state: z.string(),
  status: z.string().optional(),
  projectId: z.string().optional(),
  where: z.string().optional(),
});

export const MapAgentsDtoSchema = z.object({
  agents: z.array(AgentDtoSchema),
  available: z.boolean(),
});

export type MapClusterDto = z.infer<typeof MapClusterDtoSchema>;
export type MapNodeDto = z.infer<typeof MapNodeDtoSchema>;
export type MapEdgeDto = z.infer<typeof MapEdgeDtoSchema>;
export type MapClusterEdgeDto = z.infer<typeof MapClusterEdgeDtoSchema>;
export type MapGraphDto = z.infer<typeof MapGraphDtoSchema>;
export type AgentDto = z.infer<typeof AgentDtoSchema>;
export type MapAgentsDto = z.infer<typeof MapAgentsDtoSchema>;

export function toGraphDto(graph: MapGraph): MapGraphDto {
  return {
    clusters: graph.clusters.map((c) => ({
      id: c.id,
      label: c.label,
      group: c.group,
      size: c.size,
      ...(c.projectId !== undefined ? { projectId: c.projectId } : {}),
      ...(c.owner !== undefined ? { owner: c.owner } : {}),
      ...(c.soon ? { soon: true } : {}),
    })),
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      cluster: n.cluster,
      links: n.links,
    })),
    edges: graph.edges.map((e) => ({ from: e.from, to: e.to, weight: e.weight, type: e.type })),
    clusterEdges: graph.clusterEdges.map((e) => ({ from: e.from, to: e.to, weight: e.weight })),
    tiles: {
      neurons: { ...graph.tiles.neurons },
      dependencies: graph.tiles.dependencies,
      blockers: null,
    },
    warnings: [...graph.warnings],
  };
}

/** Jawne kopiowanie pól: żadne dodatkowe pole (np. `cwd`) nie przejdzie do odpowiedzi. */
export function toAgentDto(a: Agent): AgentDto {
  return {
    address: a.address,
    label: a.label,
    state: a.state,
    ...(a.status !== undefined ? { status: a.status } : {}),
    ...(a.projectId !== undefined ? { projectId: a.projectId } : {}),
    ...(a.where !== undefined ? { where: a.where } : {}),
  };
}

export function toAgentsDto(result: { available: boolean; agents: Agent[] }): MapAgentsDto {
  return { available: result.available, agents: result.agents.map(toAgentDto) };
}
