import { DomainError } from "@/lib/errors";
import * as firestoreDb from "@/lib/firestore-db";

export async function getTaskTemplates() {
  return firestoreDb.getTaskTemplates();
}

export async function createTaskTemplate(data: { label: string; title: string; link?: string }) {
  if (!data.label || typeof data.label !== "string" || !data.label.trim()) {
    throw new DomainError("label required");
  }
  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    throw new DomainError("title required");
  }
  return firestoreDb.createTaskTemplate(data);
}

export async function updateTaskTemplate(
  id: string,
  data: { label?: string; title?: string; link?: string }
) {
  return firestoreDb.updateTaskTemplate(id, data);
}

export async function deleteTaskTemplate(id: string) {
  return firestoreDb.deleteTaskTemplate(id);
}
