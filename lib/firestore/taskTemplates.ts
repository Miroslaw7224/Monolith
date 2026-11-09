import { FieldValue } from "firebase-admin/firestore";
import type { TaskTemplateRecord } from "@/types/records";
import { taskTemplatesCol } from "./collections";

export async function getTaskTemplates(userId: string): Promise<TaskTemplateRecord[]> {
  const snap = await taskTemplatesCol(userId).get();
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
      label: (data.label ?? "").trim() || "",
      title: (data.title ?? "").trim() || "",
      link: typeof data.link === "string" ? data.link.trim() : "",
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

export async function createTaskTemplate(
  userId: string,
  data: { label: string; title: string; link?: string }
): Promise<TaskTemplateRecord> {
  const label = (data.label ?? "").trim() || "";
  const title = (data.title ?? "").trim() || "";
  const link = typeof data.link === "string" ? data.link.trim() : "";
  const payload: Record<string, unknown> = {
    label,
    title,
    link,
    createdAt: FieldValue.serverTimestamp(),
  };
  const ref = await taskTemplatesCol(userId).add(payload);
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    label: d.label ?? "",
    title: d.title ?? "",
    link: typeof d.link === "string" ? d.link : "",
    created_at: d.createdAt?.toDate?.()?.toISOString?.(),
    createdAt: d.createdAt,
  };
}

export async function updateTaskTemplate(
  userId: string,
  templateId: string,
  data: { label?: string; title?: string; link?: string }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (data.label !== undefined) update.label = (data.label ?? "").trim() || "";
  if (data.title !== undefined) update.title = (data.title ?? "").trim() || "";
  if (data.link !== undefined) update.link = typeof data.link === "string" ? data.link.trim() : "";
  if (Object.keys(update).length > 0) {
    await taskTemplatesCol(userId).doc(templateId).update(update);
  }
}

export async function deleteTaskTemplate(userId: string, templateId: string): Promise<void> {
  await taskTemplatesCol(userId).doc(templateId).delete();
}
