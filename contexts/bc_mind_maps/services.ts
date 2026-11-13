import { DomainError } from "@/lib/errors";
import * as repositories from "./repositories";
import type { MindMap, MindMapNode } from "./models";

export async function createMindMap(title: string): Promise<MindMap> {
  const label = (title ?? "").trim() || "Nowa mapa";
  const rootNode: MindMapNode = {
    id: "root",
    label,
    note: "",
    collapsed: false,
    children: [],
  };
  return repositories.createMindMap({ title: label, rootNode });
}

export async function getMindMaps(): Promise<MindMap[]> {
  const list = await repositories.getMindMaps();
  const time = (m: MindMap) => Date.parse(m.updatedAt ?? "") || 0;
  return [...list].sort((a, b) => time(b) - time(a));
}

export async function getMindMap(mapId: string): Promise<MindMap> {
  const map = await repositories.getMindMap(mapId);
  if (!map) {
    throw new DomainError("Mind map not found", 404);
  }
  return map;
}

export async function saveMindMap(
  mapId: string,
  data: { title?: string; rootNode?: MindMapNode; colWidths?: Record<number, number> }
): Promise<void> {
  await getMindMap(mapId);

  const patch: { title?: string; rootNode?: MindMapNode; colWidths?: Record<number, number> } = {};
  if (data.title !== undefined) patch.title = (data.title ?? "").trim();
  if (data.rootNode !== undefined) patch.rootNode = data.rootNode;
  if (data.colWidths !== undefined) patch.colWidths = data.colWidths ?? {};

  await repositories.saveMindMap(mapId, patch);
}

export async function deleteMindMap(mapId: string): Promise<void> {
  await getMindMap(mapId);
  await repositories.deleteMindMap(mapId);
}
