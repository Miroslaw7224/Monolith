import { z } from "zod";
import type { Agent, MapGraph } from "./models";

const count = z.number().int().nonnegative();

export const MapNodeDtoSchema = z.object({
  id: z.string(),
  kind: z.enum(["project", "continent"]),
  label: z.string(),
  size: count.optional(),
  owner: z.enum(["personal", "work"]).optional(),
  soon: z.boolean().optional(),
});

export const MapEdgeDtoSchema = z.object({
  from: z.string(),
  to: z.string(),
  weight: z.number().int().positive(),
  type: z.literal("shared"),
});

export const MapGraphDtoSchema = z.object({
  nodes: z.array(MapNodeDtoSchema),
  edges: z.array(MapEdgeDtoSchema),
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

export type MapNodeDto = z.infer<typeof MapNodeDtoSchema>;
export type MapEdgeDto = z.infer<typeof MapEdgeDtoSchema>;
export type MapGraphDto = z.infer<typeof MapGraphDtoSchema>;
export type AgentDto = z.infer<typeof AgentDtoSchema>;
export type MapAgentsDto = z.infer<typeof MapAgentsDtoSchema>;

export function toGraphDto(graph: MapGraph): MapGraphDto {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      label: n.label,
      ...(n.size !== undefined ? { size: n.size } : {}),
      ...(n.owner !== undefined ? { owner: n.owner } : {}),
      ...(n.soon ? { soon: true } : {}),
    })),
    edges: graph.edges.map((e) => ({ from: e.from, to: e.to, weight: e.weight, type: e.type })),
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
