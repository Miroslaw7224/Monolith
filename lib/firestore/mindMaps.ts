import { FieldValue } from "firebase-admin/firestore";
import type { MindMap, MindMapNode } from "@/types/records";
import { mindMapsCol } from "./collections";
import { toIso } from "./time";

export async function getMindMaps(userId: string): Promise<MindMap[]> {
  const snap = await mindMapsCol(userId).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId ?? userId,
      title: data.title ?? "",
      rootNode: data.rootNode,
      colWidths: data.colWidths ?? {},
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
    } as MindMap;
  });
}

export async function getMindMap(userId: string, mapId: string): Promise<MindMap | null> {
  const snap = await mindMapsCol(userId).doc(mapId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    userId: data.userId ?? "",
    title: data.title ?? "",
    rootNode: data.rootNode as MindMapNode,
    colWidths: data.colWidths ?? {},
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function createMindMap(
  userId: string,
  data: { title: string; rootNode: MindMapNode }
): Promise<MindMap> {
  const ref = mindMapsCol(userId).doc();
  await ref.set({
    userId,
    title: data.title,
    rootNode: data.rootNode,
    colWidths: {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const snap = await ref.get();
  const saved = snap.data()!;
  return {
    id: ref.id,
    userId: saved.userId ?? userId,
    title: saved.title ?? "",
    rootNode: saved.rootNode ?? data.rootNode,
    colWidths: saved.colWidths ?? {},
    createdAt: toIso(saved.createdAt),
    updatedAt: toIso(saved.updatedAt),
  };
}

export async function saveMindMap(
  userId: string,
  mapId: string,
  patch: { title?: string; rootNode?: MindMapNode; colWidths?: Record<number, number> }
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.rootNode !== undefined) update.rootNode = patch.rootNode;
  if (patch.colWidths !== undefined) update.colWidths = patch.colWidths;

  await mindMapsCol(userId).doc(mapId).update(update);
}

export async function deleteMindMap(userId: string, mapId: string): Promise<void> {
  await mindMapsCol(userId).doc(mapId).delete();
}
