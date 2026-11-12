import * as firestoreDb from "@/lib/firestore-db";

export async function listNotes() {
  return firestoreDb.getNotes();
}

export async function createNote(data: { title: string; content: string }) {
  return firestoreDb.createNote(data);
}

export async function updateNote(id: string, data: { title: string; content: string }) {
  return firestoreDb.updateNote(id, data);
}

export async function deleteNote(id: string) {
  return firestoreDb.deleteNote(id);
}
