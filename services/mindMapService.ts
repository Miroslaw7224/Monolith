import { DomainError } from "@/lib/errors";
import * as firestoreDb from "@/lib/firestore-db";
import type { MindMap, MindMapNode } from "@/src/features/mind-maps/mindMapTypes";

function ensureOwnMap(userId: string, map: MindMap) {
  if (map.userId !== userId) {
    throw new DomainError("Mind map not found", 404);
  }
}

export async function createMindMap(userId: string, title: string): Promise<MindMap> {
  const label = (title ?? "").trim() || "Nowa mapa";
  const rootNode: MindMapNode = {
    id: "root",
    label,
    note: "",
    collapsed: false,
    children: [],
  };
  return firestoreDb.createMindMap(userId, { title: label, rootNode });
}

export async function getMindMaps(userId: string): Promise<MindMap[]> {
  const list = await firestoreDb.getMindMaps(userId);
  const time = (m: MindMap) => Date.parse(m.updatedAt ?? "") || 0;
  return [...list].sort((a, b) => time(b) - time(a));
}

export async function getMindMap(userId: string, mapId: string): Promise<MindMap> {
  const map = await firestoreDb.getMindMap(userId, mapId);
  if (!map) {
    throw new DomainError("Mind map not found", 404);
  }
  ensureOwnMap(userId, map);
  return map;
}

export async function saveMindMap(
  userId: string,
  mapId: string,
  data: { title?: string; rootNode?: MindMapNode; colWidths?: Record<number, number> }
): Promise<void> {
  await getMindMap(userId, mapId);

  const patch: { title?: string; rootNode?: MindMapNode; colWidths?: Record<number, number> } = {};
  if (data.title !== undefined) patch.title = (data.title ?? "").trim();
  if (data.rootNode !== undefined) patch.rootNode = data.rootNode;
  if (data.colWidths !== undefined) patch.colWidths = data.colWidths ?? {};

  await firestoreDb.saveMindMap(userId, mapId, patch);
}

export async function deleteMindMap(userId: string, mapId: string): Promise<void> {
  await getMindMap(userId, mapId);
  await firestoreDb.deleteMindMap(userId, mapId);
}
