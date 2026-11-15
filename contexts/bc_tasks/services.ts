import { DomainError } from "@/lib/errors";
import type { Task } from "./models";
import * as repositories from "./repositories";

// ── zadania ────────────────────────────────────────────────────────────────────

/** Id projektu jak w rejestrze: małe litery, cyfry, `-`, `_`; do 64 znaków (spec zadań ogólnych, P2). */
const PROJECT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** `undefined` = bez zmiany, `null` (lub pusty tekst) = bez projektu; zły format = 400. Istnienia projektu nie sprawdzamy. */
function normalizeProject(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !PROJECT_ID.test(value)) {
    throw new DomainError("invalid project");
  }
  return value;
}

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
  project?: string | null;
}) {
  if (!data.title || typeof data.title !== "string") {
    throw new DomainError("title required");
  }
  const project = normalizeProject(data.project);
  return repositories.createTask(project === undefined ? data : { ...data, project });
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
    project: string | null;
    order: number;
  }>
) {
  const project = normalizeProject(data.project);
  return repositories.updateTask(id, project === undefined ? data : { ...data, project });
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
