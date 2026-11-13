import { DomainError } from "@/lib/errors";
import type { Task } from "./models";
import * as repositories from "./repositories";

// ── zadania ────────────────────────────────────────────────────────────────────

export async function getTasks() {
  return repositories.getTasks();
}

export async function createTask(data: {
  title: string;
  link?: string;
  description?: string;
  status?: Task["status"];
  due_date?: string | null;
  priority?: number | null;
}) {
  if (!data.title || typeof data.title !== "string") {
    throw new DomainError("title required");
  }
  return repositories.createTask(data);
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    link: string;
    description: string;
    status: Task["status"];
    due_date: string | null;
    priority: number | null;
    order: number;
  }>
) {
  return repositories.updateTask(id, data);
}

export async function reorderTasks(taskIds: string[]) {
  return repositories.reorderTasks(taskIds);
}

export async function deleteTask(id: string) {
  return repositories.deleteTask(id);
}

// ── szablony ───────────────────────────────────────────────────────────────────

export async function getTaskTemplates() {
  return repositories.getTaskTemplates();
}

export async function createTaskTemplate(data: { label: string; title: string; link?: string }) {
  if (!data.label || typeof data.label !== "string" || !data.label.trim()) {
    throw new DomainError("label required");
  }
  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    throw new DomainError("title required");
  }
  return repositories.createTaskTemplate(data);
}

export async function updateTaskTemplate(
  id: string,
  data: { label?: string; title?: string; link?: string }
) {
  return repositories.updateTaskTemplate(id, data);
}

export async function deleteTaskTemplate(id: string) {
  return repositories.deleteTaskTemplate(id);
}
