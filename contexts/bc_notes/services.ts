import * as repositories from "./repositories";

export async function listNotes() {
  return repositories.getNotes();
}

export async function createNote(data: { title: string; content: string }) {
  return repositories.createNote(data);
}

export async function updateNote(id: string, data: { title: string; content: string }) {
  return repositories.updateNote(id, data);
}

export async function deleteNote(id: string) {
  return repositories.deleteNote(id);
}
