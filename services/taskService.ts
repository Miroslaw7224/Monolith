import type { TaskRecord } from "@/lib/firestore-db";
import * as firestoreDb from "@/lib/firestore-db";

export async function getTasks(userId: string) {
  return firestoreDb.getTasks(userId);
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
) {
  return firestoreDb.createTask(userId, data);
}

export async function updateTask(
  userId: string,
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
  return firestoreDb.updateTask(userId, id, data);
}

export async function reorderTasks(userId: string, taskIds: string[]) {
  return firestoreDb.reorderTasks(userId, taskIds);
}

export async function deleteTask(userId: string, id: string) {
  return firestoreDb.deleteTask(userId, id);
}
