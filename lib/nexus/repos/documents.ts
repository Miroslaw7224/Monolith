import type { DocumentRecord } from "@/types/records";
import { nowIso, optStr, sortByCreated, str } from "../record-helpers";
import { createEntry, deleteEntry, listEntries, type MarkdownEntry } from "../markdown-dir";

const DIR = "Documents";

function toDocument(entry: MarkdownEntry): DocumentRecord {
  return {
    id: entry.id,
    name: str(entry.meta.name),
    content: entry.body,
    type: str(entry.meta.type),
    created_at: optStr(entry.meta.created),
  };
}

export async function getDocuments(): Promise<DocumentRecord[]> {
  return sortByCreated(listEntries(DIR).map(toDocument), (d) => d.created_at, "desc");
}

export async function createDocument(data: {
  name: string;
  content: string;
  type: string;
}): Promise<{ id: string; name: string }> {
  const { id } = createEntry(DIR, data.name, (newId) => ({
    meta: { id: newId, name: data.name, type: data.type, created: nowIso() },
    body: data.content,
  }));
  return { id, name: data.name };
}

export async function deleteDocument(docId: string): Promise<void> {
  deleteEntry(DIR, docId);
}
