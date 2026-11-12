import { DomainError } from "@/lib/errors";
import type { TaskRecord } from "@/lib/firestore-db";
import * as firestoreDb from "@/lib/firestore-db";

export async function getTasks() {
  return firestoreDb.getTasks();
}

export async function createTask(data: {
  title: string;
  link?: string;
  description?: string;
  status?: TaskRecord["status"];
  due_date?: string | null;
  priority?: number | null;
}) {
  if (!data.title || typeof data.title !== "string") {
    throw new DomainError("title required");
  }
  return firestoreDb.createTask(data);
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    link: string;
    description: string;
    status: TaskRecord["status"];
    due_date: string | null;
    priority: number | null;
    order: number;
  }>
) {
  return firestoreDb.updateTask(id, data);
}

export async function reorderTasks(taskIds: string[]) {
  return firestoreDb.reorderTasks(taskIds);
}

export async function deleteTask(id: string) {
  return firestoreDb.deleteTask(id);
}
