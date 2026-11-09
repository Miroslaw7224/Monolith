import { DomainError } from "@/lib/errors";
import * as firestoreDb from "@/lib/firestore-db";

export async function getUserTags(userId: string) {
  return firestoreDb.getUserTags(userId);
}

export async function createUserTag(
  userId: string,
  data: { tag: string; title: string; color?: string }
) {
  if (!data.tag || typeof data.tag !== "string" || !data.tag.trim()) {
    throw new DomainError("tag required");
  }
  return firestoreDb.createUserTag(userId, data);
}

export async function updateUserTag(
  userId: string,
  id: string,
  data: { tag?: string; title?: string; color?: string | null }
) {
  return firestoreDb.updateUserTag(userId, id, data);
}

export async function deleteUserTag(userId: string, id: string) {
  return firestoreDb.deleteUserTag(userId, id);
}
