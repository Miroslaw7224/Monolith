import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { NoteResourceRecord } from "@/types/records";
import { userResourcesCol } from "./collections";

export async function addResourceToFirestore(
  userId: string,
  data: Omit<NoteResourceRecord, "id" | "createdAt" | "updatedAt">
): Promise<NoteResourceRecord> {
  const col = userResourcesCol(userId);
  const ref = await col.add({
    userId,
    description: data.description,
    url: data.url,
    title: data.title,
    tags: data.tags ?? [],
    isFavorite: data.isFavorite ?? false,
    ...(data.noteId != null && { noteId: data.noteId }),
    ...(data.thumbnailUrl != null && { thumbnailUrl: data.thumbnailUrl }),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    noteId: d.noteId,
    userId: d.userId ?? userId,
    description: d.description ?? "",
    url: d.url ?? "",
    title: d.title ?? "",
    thumbnailUrl: d.thumbnailUrl,
    tags: Array.isArray(d.tags) ? d.tags : [],
    isFavorite: d.isFavorite === true,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function getResourcesFromFirestore(userId: string): Promise<NoteResourceRecord[]> {
  const snap = await userResourcesCol(userId).get();
  const list = snap.docs.map((d) => {
    const data = d.data();
    const createdAt =
      data.createdAt ??
      (data.created_at != null
        ? typeof data.created_at === "string"
          ? { toDate: () => new Date(data.created_at) }
          : data.created_at
        : null);
    return {
      id: d.id,
      noteId: data.noteId,
      userId: data.userId ?? userId,
      description: data.description ?? "",
      url: data.url ?? "",
      title: data.title ?? "",
      thumbnailUrl: data.thumbnailUrl,
      tags: Array.isArray(data.tags) ? data.tags : [],
      isFavorite: data.isFavorite === true,
      createdAt: (data.createdAt ?? createdAt) as Timestamp,
      updatedAt: data.updatedAt,
    };
  });
  list.sort((a, b) => {
    const tA =
      a.createdAt?.toMillis?.() ??
      (a.createdAt &&
      typeof (a.createdAt as unknown as { toDate?: () => Date }).toDate === "function"
        ? (a.createdAt as unknown as { toDate: () => Date }).toDate().getTime()
        : 0);
    const tB =
      b.createdAt?.toMillis?.() ??
      (b.createdAt &&
      typeof (b.createdAt as unknown as { toDate?: () => Date }).toDate === "function"
        ? (b.createdAt as unknown as { toDate: () => Date }).toDate().getTime()
        : 0);
    return tB - tA;
  });
  return list;
}

export async function deleteResourceFromFirestore(
  userId: string,
  resourceId: string
): Promise<void> {
  await userResourcesCol(userId).doc(resourceId).delete();
}

export async function updateResourceInFirestore(
  userId: string,
  resourceId: string,
  data: {
    title?: string;
    description?: string;
    url?: string;
    tags?: string[];
    isFavorite?: boolean;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.description !== undefined) updateData.description = data.description.trim();
  if (data.url !== undefined) updateData.url = data.url.trim();
  if (data.tags !== undefined) updateData.tags = Array.isArray(data.tags) ? data.tags : [];
  if (data.isFavorite !== undefined) updateData.isFavorite = data.isFavorite;
  await userResourcesCol(userId).doc(resourceId).update(updateData);
}
