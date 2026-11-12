import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { UpdateTaskBodySchema } from "@/lib/validation/tasks";
import * as taskService from "@/services/taskService";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = await parseBody(request, UpdateTaskBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { title, link, description, status, due_date, priority, order } = parsed.data;
  try {
    await taskService.updateTask(id, {
      title: title as string | undefined,
      link: link as string | undefined,
      description: description as string | undefined,
      status: status as "todo" | "in_progress" | "to_review" | "done" | undefined,
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await taskService.deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
