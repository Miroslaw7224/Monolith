import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";
import type { Task, TaskTemplate } from "./models";

// ── wejście (zod) ──────────────────────────────────────────────────────────────

export const CreateTaskBodySchema = looseObject({
  title: z.unknown().optional(),
  link: z.unknown().optional(),
  description: z.unknown().optional(),
  status: z.unknown().optional(),
  due_date: z.unknown().optional(),
  priority: z.unknown().optional(),
}).superRefine((body, ctx) => {
  if (!body.title || typeof body.title !== "string") {
    ctx.addIssue("title required");
  }
});

export const UpdateTaskBodySchema = looseObject({
  title: z.unknown().optional(),
  link: z.unknown().optional(),
  description: z.unknown().optional(),
  status: z.unknown().optional(),
  due_date: z.unknown().optional(),
  priority: z.unknown().optional(),
  order: z.unknown().optional(),
});

export const CreateTaskTemplateBodySchema = looseObject({
  label: z.unknown().optional(),
  title: z.unknown().optional(),
  link: z.unknown().optional(),
}).superRefine((body, ctx) => {
  if (typeof body.label !== "string" || !body.label.trim()) {
    ctx.addIssue("label required");
  } else if (typeof body.title !== "string" || !body.title.trim()) {
    ctx.addIssue("title required");
  }
});

export const UpdateTaskTemplateBodySchema = looseObject({
  label: z.unknown().optional(),
  title: z.unknown().optional(),
  link: z.unknown().optional(),
});

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type TaskDto = {
  id: string;
  title: string;
  link: string;
  description: string;
  status: "todo" | "in_progress" | "to_review" | "done";
  due_date: string | null;
  priority: number | null;
  order?: number;
  created_at?: string;
  updated_at?: string;
};

export type TaskTemplateDto = {
  id: string;
  label: string;
  title: string;
  link: string;
  created_at?: string;
};

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    title: task.title,
    link: task.link,
    description: task.description,
    status: task.status,
    due_date: task.due_date,
    priority: task.priority,
    order: task.order,
    created_at: task.created_at,
    updated_at: task.updated_at,
  };
}

export function toTaskTemplateDto(template: TaskTemplate): TaskTemplateDto {
  return {
    id: template.id,
    label: template.label,
    title: template.title,
    link: template.link,
    created_at: template.created_at,
  };
}
