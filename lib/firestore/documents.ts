import { FieldValue } from "firebase-admin/firestore";
import type { DocumentRecord } from "@/types/records";
import { documentsCol } from "./collections";
import { deleteChunksByDocument } from "./chunks";

export async function getDocuments(userId: string): Promise<DocumentRecord[]> {
  const snap = await documentsCol(userId).get();
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
      name: data.name ?? "",
      content: data.content ?? "",
      type: data.type ?? "",
      created_at: createdAt?.toDate?.()?.toISOString?.(),
      createdAt: createdAt ?? undefined,
    };
  });
  list.sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tB - tA;
  });
  return list;
}

export async function createDocument(
  userId: string,
  data: { name: string; content: string; type: string }
): Promise<{ id: string; name: string }> {
  const col = documentsCol(userId);
  const ref = await col.add({
    name: data.name,
    content: data.content,
    type: data.type,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, name: data.name };
}

export async function deleteDocument(userId: string, docId: string): Promise<void> {
  await deleteChunksByDocument(userId, docId);
  await documentsCol(userId).doc(docId).delete();
}
