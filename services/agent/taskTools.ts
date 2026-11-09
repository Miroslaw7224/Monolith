import { z } from "zod";
import type { TaskRecord } from "@/lib/firestore-db";
import { defineTool } from "@/lib/agent/tools";
import * as taskService from "@/services/taskService";

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const STATUS = z.enum(["todo", "in_progress", "to_review", "done"]);

function brief(t: TaskRecord) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    due_date: t.due_date,
    description: (t.description ?? "").slice(0, 200),
  };
}

async function findTask(userId: string, id: string): Promise<TaskRecord> {
  const tasks = await taskService.getTasks(userId);
  const found = tasks.find((t) => t.id === id);
  if (!found) throw new Error(`Task not found: ${id}`);
  return found;
}

export const taskTools = [
  defineTool({
    name: "list_tasks",
    description:
      "List the user's tasks (id, title, status, due_date, description). Optionally filter by status.",
    schema: z.object({ status: STATUS.optional() }),
    readOnly: true,
    run: async (userId, { status }) => {
      const tasks = await taskService.getTasks(userId);
      const filtered = status ? tasks.filter((t) => t.status === status) : tasks;
      return { ok: true, data: filtered.map(brief) };
    },
  }),
  defineTool({
    name: "create_task",
    description:
      "Create a task. status defaults to todo. due_date is YYYY-MM-DD (resolve relative dates using the reference dates).",
    schema: z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
      status: STATUS.optional(),
      due_date: YMD.nullable().optional(),
    }),
    run: async (userId, args) => {
      const task = await taskService.createTask(userId, {
        title: args.title,
        description: args.description ?? "",
        status: args.status ?? "todo",
        due_date: args.due_date ?? null,
      });
      return {
        ok: true,
        data: brief(task),
        changed: "tasks",
        summary: `Dodano zadanie „${task.title}”`,
      };
    },
  }),
  defineTool({
    name: "update_task",
    description:
      "Update a task by id. Provide only the fields to change. due_date null clears the deadline.",
    schema: z.object({
      id: z.string().min(1),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      status: STATUS.optional(),
      due_date: YMD.nullable().optional(),
    }),
    run: async (userId, { id, ...fields }) => {
      const existing = await findTask(userId, id);
      const patch = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined)
      );
      if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update" };
      await taskService.updateTask(userId, id, patch);
      return {
        ok: true,
        data: { id },
        changed: "tasks",
        summary: `Zaktualizowano zadanie „${existing.title}”`,
      };
    },
  }),
  defineTool({
    name: "delete_task",
    description: "Delete a task by id. Requires user confirmation; it is not executed immediately.",
    schema: z.object({ id: z.string().min(1) }),
    destructive: true,
    describe: async (userId, { id }) => `Usunąć zadanie „${(await findTask(userId, id)).title}”?`,
    run: async (userId, { id }) => {
      const existing = await findTask(userId, id);
      await taskService.deleteTask(userId, id);
      return {
        ok: true,
        data: { id },
        changed: "tasks",
        summary: `Usunięto zadanie „${existing.title}”`,
      };
    },
  }),
];
