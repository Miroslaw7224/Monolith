import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import * as taskService from "@/services/taskService";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  let body: {
    title?: string;
    link?: string;
    description?: string;
    status?: string;
    due_date?: string | null;
    priority?: number | null;
    order?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { title, link, description, status, due_date, priority, order } = body;
  try {
    await taskService.updateTask(auth.uid, id, {
      title,
      link,
      description,
      status: status as "todo" | "in_progress" | "to_review" | "done" | undefined,
      due_date: due_date ?? undefined,
      priority:
        priority !== undefined
          ? priority === null
            ? null
            : typeof priority === "number"
              ? priority
              : Number(priority)
          : undefined,
      order,
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
  const auth = await getAuthUserId(_request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await taskService.deleteTask(auth.uid, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
