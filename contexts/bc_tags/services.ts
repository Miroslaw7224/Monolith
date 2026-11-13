import { DomainError } from "@/lib/errors";
import * as repositories from "./repositories";

export async function getUserTags() {
  return repositories.getUserTags();
}

export async function createUserTag(data: { tag: string; title: string; color?: string }) {
  if (!data.tag || typeof data.tag !== "string" || !data.tag.trim()) {
    throw new DomainError("tag required");
  }
  return repositories.createUserTag(data);
}

export async function updateUserTag(
  id: string,
  data: { tag?: string; title?: string; color?: string | null }
) {
  return repositories.updateUserTag(id, data);
}

export async function deleteUserTag(id: string) {
  return repositories.deleteUserTag(id);
}
