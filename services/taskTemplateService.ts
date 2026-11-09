import { DomainError } from "@/lib/errors";
import * as firestoreDb from "@/lib/firestore-db";

export async function getTaskTemplates(userId: string) {
  return firestoreDb.getTaskTemplates(userId);
}

export async function createTaskTemplate(
  userId: string,
  data: { label: string; title: string; link?: string }
) {
  if (!data.label || typeof data.label !== "string" || !data.label.trim()) {
    throw new DomainError("label required");
  }
  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    throw new DomainError("title required");
  }
  return firestoreDb.createTaskTemplate(userId, data);
}

export async function updateTaskTemplate(
  userId: string,
  id: string,
  data: { label?: string; title?: string; link?: string }
) {
  return firestoreDb.updateTaskTemplate(userId, id, data);
}

export async function deleteTaskTemplate(userId: string, id: string) {
  return firestoreDb.deleteTaskTemplate(userId, id);
}
