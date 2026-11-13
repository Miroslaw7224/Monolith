import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import {
  CreateTaskBodySchema,
  CreateTaskTemplateBodySchema,
  UpdateTaskBodySchema,
  UpdateTaskTemplateBodySchema,
  toTaskDto,
  toTaskTemplateDto,
  type TaskDto,
} from "./schemas";
import * as services from "./services";

type RouteContext = { params: Promise<{ id: string }> };

// ── zadania ────────────────────────────────────────────────────────────────────

export async function listTasks(): Promise<NextResponse> {
  try {
    const tasks = await services.getTasks();
    return NextResponse.json(tasks.map(toTaskDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function createTask(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, CreateTaskBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { title, link, description, status, due_date, priority } = parsed.data;
  try {
    const task = await services.createTask({
      title: title as string,
      link: (link ?? "") as string,
      description: (description ?? "") as string,
      status: (status ?? "todo") as TaskDto["status"],
      due_date: (due_date ?? null) as string | null,
      priority: priority !== undefined && priority !== null ? Number(priority) : null,
    });
    return NextResponse.json(toTaskDto(task));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function updateTask(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;

  const parsed = await parseBody(request, UpdateTaskBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { title, link, description, status, due_date, priority, order } = parsed.data;
  try {
    await services.updateTask(id, {
      title: title as string | undefined,
      link: link as string | undefined,
      description: description as string | undefined,
      status: status as TaskDto["status"] | undefined,
      due_date: (due_date ?? undefined) as string | null | undefined,
      priority:
        priority !== undefined
          ? priority === null
            ? null
            : typeof priority === "number"
              ? priority
              : Number(priority)
          : undefined,
      order: order as number | undefined,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteTask(_request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await services.deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function reorderTasks(request: NextRequest): Promise<NextResponse> {
  let body: { taskIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { taskIds } = body;
  if (!Array.isArray(taskIds) || taskIds.some((x: unknown) => typeof x !== "string")) {
    return NextResponse.json({ error: "taskIds must be an array of strings" }, { status: 400 });
  }
  try {
    await services.reorderTasks(taskIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

// ── szablony ───────────────────────────────────────────────────────────────────

export async function listTaskTemplates(): Promise<NextResponse> {
  try {
    const list = await services.getTaskTemplates();
    return NextResponse.json(list.map(toTaskTemplateDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function createTaskTemplate(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, CreateTaskTemplateBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { label, title, link } = parsed.data;
  try {
    const created = await services.createTaskTemplate({
      label: (label as string).trim(),
      title: (title as string).trim(),
      link: typeof link === "string" ? link.trim() : "",
    });
    return NextResponse.json(toTaskTemplateDto(created));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function updateTaskTemplate(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const { id } = await ctx.params;

  const parsed = await parseBody(request, UpdateTaskTemplateBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { label, title, link } = parsed.data;
  try {
    await services.updateTaskTemplate(id, {
      label: typeof label === "string" ? label.trim() : undefined,
      title: typeof title === "string" ? title.trim() : undefined,
      link: typeof link === "string" ? link.trim() : undefined,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteTaskTemplate(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await services.deleteTaskTemplate(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
