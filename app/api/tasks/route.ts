import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import * as taskService from "@/services/taskService";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const tasks = await taskService.getTasks(auth.uid);
    return NextResponse.json(tasks);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  let body: {
    title?: string;
    link?: string;
    description?: string;
    status?: string;
    due_date?: string | null;
    priority?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { title, link, description, status, due_date, priority } = body;
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  try {
    const task = await taskService.createTask(auth.uid, {
      title,
      link: link ?? "",
      description: description ?? "",
      status: (status ?? "todo") as "todo" | "in_progress" | "to_review" | "done",
      due_date: due_date ?? null,
      priority: priority !== undefined && priority !== null ? Number(priority) : null,
    });
    return NextResponse.json(task);
  } catch (err) {
    return handleServiceError(err);
  }
}
