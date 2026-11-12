import type { NoteRecord } from "@/types/records";
import { nowIso, optStr, sortByCreated } from "../record-helpers";
import {
  createEntry,
  deleteEntry,
  listEntries,
  updateEntry,
  type MarkdownEntry,
} from "../markdown-dir";

const DIR = "Notes";

function toNote(entry: MarkdownEntry): NoteRecord {
  const { title } = entry.meta;
  const fileName = entry.rel.slice(DIR.length + 1).replace(/\.md$/i, "");
  return {
    id: entry.id,
    title: title === undefined || title === null ? fileName : String(title),
    content: entry.body,
    created_at: optStr(entry.meta.created),
    updated_at: optStr(entry.meta.updated),
  };
}

export async function getNotes(): Promise<NoteRecord[]> {
  return sortByCreated(listEntries(DIR).map(toNote), (n) => n.created_at, "desc");
}

export async function createNote(data: {
  title: string;
  content: string;
}): Promise<{ id: string; title: string; content: string }> {
  const now = nowIso();
  const { id } = createEntry(DIR, data.title, (newId) => ({
    meta: { id: newId, title: data.title, created: now, updated: now },
    body: data.content,
  }));
  return { id, title: data.title, content: data.content };
}

export async function updateNote(
  noteId: string,
  data: { title: string; content: string }
): Promise<void> {
  await updateEntry(DIR, noteId, "Note not found", ({ meta }) => ({
    meta: { ...meta, title: data.title, updated: nowIso() },
    body: data.content,
  }));
}

export async function deleteNote(noteId: string): Promise<void> {
  deleteEntry(DIR, noteId);
}
