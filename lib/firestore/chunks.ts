import { chunksCol, db } from "./collections";

const FIRESTORE_BATCH_LIMIT = 500;

export async function addChunks(
  userId: string,
  chunks: { documentId?: string; noteId?: string; content: string }[]
): Promise<void> {
  const col = chunksCol(userId);
  for (const c of chunks) {
    await col.add({
      documentId: c.documentId ?? null,
      noteId: c.noteId ?? null,
      content: c.content,
    });
  }
}

export async function deleteChunksByDocument(userId: string, documentId: string): Promise<void> {
  const snap = await chunksCol(userId).where("documentId", "==", documentId).get();
  for (let i = 0; i < snap.docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db().batch();
    snap.docs.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function deleteChunksByNote(userId: string, noteId: string): Promise<void> {
  const snap = await chunksCol(userId).where("noteId", "==", noteId).get();
  for (let i = 0; i < snap.docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db().batch();
    snap.docs.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
