import { FieldValue } from "firebase-admin/firestore";
import type { UserTagRecord } from "@/types/records";
import { userTagsCol } from "./collections";

export async function getUserTags(userId: string): Promise<UserTagRecord[]> {
  const snap = await userTagsCol(userId).get();
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
      tag: (data.tag ?? "").trim().replace(/^#/, "") || "",
      title: (data.title ?? "").trim() || "",
      color: typeof data.color === "string" && data.color ? data.color : undefined,
      created_at: createdAt?.toDate?.()?.toISOString?.(),
      createdAt: data.createdAt ?? createdAt,
    };
  });
  list.sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tA - tB;
  });
  return list;
}

export async function createUserTag(
  userId: string,
  data: { tag: string; title: string; color?: string }
): Promise<UserTagRecord> {
  const tag = (data.tag ?? "").trim().replace(/^#/, "") || "";
  const title = (data.title ?? "").trim() || "";
  const color = typeof data.color === "string" && data.color.trim() ? data.color.trim() : undefined;
  const payload: Record<string, unknown> = { tag, title, createdAt: FieldValue.serverTimestamp() };
  if (color) payload.color = color;
  const ref = await userTagsCol(userId).add(payload);
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    tag: d.tag ?? "",
    title: d.title ?? "",
    color: typeof d.color === "string" && d.color ? d.color : undefined,
    created_at: d.createdAt?.toDate?.()?.toISOString?.(),
    createdAt: d.createdAt,
  };
}

export async function updateUserTag(
  userId: string,
  tagId: string,
  data: { tag?: string; title?: string; color?: string | null }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (data.tag !== undefined) update.tag = (data.tag ?? "").trim().replace(/^#/, "") || "";
  if (data.title !== undefined) update.title = (data.title ?? "").trim() || "";
  if (data.color !== undefined)
    update.color = typeof data.color === "string" && data.color.trim() ? data.color.trim() : null;
  if (Object.keys(update).length > 0) {
    await userTagsCol(userId).doc(tagId).update(update);
  }
}

export async function deleteUserTag(userId: string, tagId: string): Promise<void> {
  await userTagsCol(userId).doc(tagId).delete();
}
