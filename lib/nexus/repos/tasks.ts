import { DomainError } from "@/lib/errors";
import type { TaskRecord } from "@/types/records";
import {
  appendTaskLine,
  readTasks,
  removeTaskLine,
  stripGeneratedBy,
  updateTaskLines,
} from "../markdown-edit";
import type { TaskLine } from "../task-line";
import { readVaultFile, updateVaultFile } from "../vault-fs";
import { generateId, nowIso } from "./common";

const FILE = "Tasks/tasks.md";

/** Wartownik: `fn` nic nie zmieniło, więc plik nie jest zapisywany. */
class NoChange extends Error {}

/**
 * Odczyt, zmiana i atomowy zapis `Tasks/tasks.md`. `fn` zwraca nowy tekst albo `null` (brak zmiany).
 * Pierwszy zapis aplikacji usuwa `generated_by` z frontmattera (T3).
 */
async function edit(fn: (current: string | null) => string | null): Promise<void> {
  try {
    await updateVaultFile(FILE, (current) => {
      const next = fn(current);
      if (next === null) throw new NoChange();
      return stripGeneratedBy(next);
    });
  } catch (err) {
    if (err instanceof NoChange) return;
    throw err;
  }
}

function toRecord(t: TaskLine): TaskRecord {
  return {
    id: t.id,
    title: t.title,
    link: t.link,
    description: t.description,
    status: t.status,
    due_date: t.due_date,
    priority: t.priority,
    order: t.order ?? undefined,
    created_at: t.created_at ?? undefined,
    updated_at: t.updated_at ?? undefined,
  };
}

function timeOf(iso: string | undefined): number {
  const time = Date.parse(iso ?? "");
  return Number.isNaN(time) ? 0 : time;
}

/** `order` rosnąco (brak = 999999), potem `created_at` malejąco, potem `id` (T6). */
function compare(a: TaskRecord, b: TaskRecord): number {
  const orderDiff = (a.order ?? 999999) - (b.order ?? 999999);
  if (orderDiff !== 0) return orderDiff;
  const createdDiff = timeOf(b.created_at) - timeOf(a.created_at);
  if (createdDiff !== 0) return createdDiff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export async function getTasks(): Promise<TaskRecord[]> {
  const text = readVaultFile(FILE)?.text ?? null;
  return readTasks(text).map(toRecord).sort(compare);
}

export async function createTask(data: {
  title: string;
  link?: string;
  description?: string;
  status?: TaskRecord["status"];
  due_date?: string | null;
  priority?: number | null;
}): Promise<TaskRecord> {
  let created: TaskLine | undefined;
  await edit((current) => {
    const now = nowIso();
    const line: TaskLine = {
      id: generateId(new Set(readTasks(current).map((t) => t.id))),
      title: data.title ?? "",
      status: data.status ?? "todo",
      link: data.link ?? "",
      description: data.description ?? "",
      due_date: data.due_date ?? null,
      priority: data.priority ?? null,
      order: 0,
      created_at: now,
      updated_at: now,
    };
    created = line;
    return appendTaskLine(current, line);
  });
  return toRecord(created as TaskLine);
}

export async function updateTask(
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
  const patch = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  await edit((current) => {
    const { text, missing } = updateTaskLines(current ?? "", [taskId], (t) => ({
      ...t,
      ...patch,
      updated_at: nowIso(),
    }));
    if (missing.length > 0) throw new DomainError("Task not found", 404);
    return text;
  });
}

export async function reorderTasks(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const index = new Map<string, number>();
  taskIds.forEach((id, position) => index.set(id, position));
  await edit((current) => {
    const { text, missing } = updateTaskLines(current ?? "", taskIds, (t) => {
      const order = index.get(t.id) as number;
      return t.order === order ? t : { ...t, order };
    });
    if (missing.length > 0) {
      throw new DomainError(`Task not found: ${missing.join(",")}`, 404);
    }
    return text;
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await edit((current) => removeTaskLine(current ?? "", taskId));
}
