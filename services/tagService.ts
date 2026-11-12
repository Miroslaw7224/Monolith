import { DomainError } from "@/lib/errors";
import * as firestoreDb from "@/lib/firestore-db";

export async function getUserTags() {
  return firestoreDb.getUserTags();
}

export async function createUserTag(data: { tag: string; title: string; color?: string }) {
  if (!data.tag || typeof data.tag !== "string" || !data.tag.trim()) {
    throw new DomainError("tag required");
  }
  return firestoreDb.createUserTag(data);
}

export async function updateUserTag(
  id: string,
  data: { tag?: string; title?: string; color?: string | null }
) {
  return firestoreDb.updateUserTag(id, data);
}

export async function deleteUserTag(id: string) {
  return firestoreDb.deleteUserTag(id);
}
