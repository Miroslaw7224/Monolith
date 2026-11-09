import { FieldValue } from "firebase-admin/firestore";
import type { NoteRecord } from "@/types/records";
import { chunksCol, notesCol } from "./collections";
import { deleteChunksByNote } from "./chunks";

export async function getNotes(userId: string): Promise<NoteRecord[]> {
  const snap = await notesCol(userId).get();
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
      title: data.title ?? "",
      content: data.content ?? "",
      created_at: createdAt?.toDate?.()?.toISOString?.(),
      createdAt,
      updatedAt: data.updatedAt,
    };
  });
  list.sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tB - tA;
  });
  return list;
}

export async function createNote(
  userId: string,
  data: { title: string; content: string }
): Promise<{ id: string; title: string; content: string }> {
  const col = notesCol(userId);
  const ref = await col.add({
    title: data.title,
    content: data.content,
    createdAt: FieldValue.serverTimestamp(),
  });
  await chunksCol(userId).add({
    noteId: ref.id,
    content: data.content,
  });
  return { id: ref.id, title: data.title, content: data.content };
}

export async function updateNote(
  userId: string,
  noteId: string,
  data: { title: string; content: string }
): Promise<void> {
  const noteRef = notesCol(userId).doc(noteId);
  await noteRef.update({
    title: data.title,
    content: data.content,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await deleteChunksByNote(userId, noteId);
  await chunksCol(userId).add({ noteId, content: data.content });
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  await deleteChunksByNote(userId, noteId);
  await notesCol(userId).doc(noteId).delete();
}
