import { FieldValue } from "firebase-admin/firestore";
import type { TaskRecord } from "@/types/records";
import { db, tasksCol } from "./collections";

export async function getTasks(userId: string): Promise<TaskRecord[]> {
  const snap = await tasksCol(userId).get();
  const list = snap.docs.map((d) => {
    const data = d.data();
    const createdAt =
      data.createdAt ??
      (data.created_at != null
        ? typeof data.created_at === "string"
          ? {
              toDate: () => new Date(data.created_at),
              toMillis: () => new Date(data.created_at).getTime(),
            }
          : data.created_at
        : null);
    return {
      id: d.id,
      title: data.title ?? "",
      link: data.link ?? "",
      description: data.description ?? "",
      status: (data.status as TaskRecord["status"]) ?? "todo",
      due_date: data.due_date ?? null,
      priority: data.priority ?? null,
      order: typeof data.order === "number" ? data.order : undefined,
      created_at: createdAt?.toDate?.()?.toISOString?.(),
      updated_at: data.updatedAt?.toDate?.()?.toISOString?.(),
      createdAt: data.createdAt ?? createdAt,
      updatedAt: data.updatedAt,
    };
  });
  list.sort((a, b) => {
    const oA = a.order ?? 999999;
    const oB = b.order ?? 999999;
    if (oA !== oB) return oA - oB;
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tB - tA;
  });
  return list;
}

export async function createTask(
  userId: string,
  data: {
    title: string;
    link?: string;
    description?: string;
    status?: TaskRecord["status"];
    due_date?: string | null;
    priority?: number | null;
  }
): Promise<TaskRecord> {
  const ref = await tasksCol(userId).add({
    title: data.title ?? "",
    link: data.link ?? "",
    description: data.description ?? "",
    status: data.status ?? "todo",
    due_date: data.due_date ?? null,
    priority: data.priority ?? null,
    order: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    title: d.title ?? "",
    link: d.link ?? "",
    description: d.description ?? "",
    status: (d.status as TaskRecord["status"]) ?? "todo",
    due_date: d.due_date ?? null,
    priority: d.priority ?? null,
    order: typeof d.order === "number" ? d.order : 0,
    created_at: d.createdAt?.toDate?.()?.toISOString?.(),
    updated_at: d.updatedAt?.toDate?.()?.toISOString?.(),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function updateTask(
  userId: string,
  taskId: string,
  data: Partial<{
    title: string;
    link: string;
    description: string;
    status: TaskRecord["status"];
    due_date: string | null;
    priority: number | null;
    order: number;
  }>
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (data.title !== undefined) update.title = data.title;
  if (data.link !== undefined) update.link = data.link;
  if (data.description !== undefined) update.description = data.description;
  if (data.status !== undefined) update.status = data.status;
  if (data.due_date !== undefined) update.due_date = data.due_date;
  if (data.priority !== undefined) update.priority = data.priority;
  if (data.order !== undefined) update.order = data.order;
  await tasksCol(userId).doc(taskId).update(update);
}

export async function reorderTasks(userId: string, taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const col = tasksCol(userId);
  const batch = db().batch();
  taskIds.forEach((id, index) => {
    batch.update(col.doc(id), { order: index, updatedAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  await tasksCol(userId).doc(taskId).delete();
}
