import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { CreateTaskBodySchema } from "@/lib/validation/tasks";
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

  const parsed = await parseBody(request, CreateTaskBodySchema);
  if (parsed.success === false) return parsed.response;

  const { title, link, description, status, due_date, priority } = parsed.data;
  try {
    const task = await taskService.createTask(auth.uid, {
      title: title as string,
      link: (link ?? "") as string,
      description: (description ?? "") as string,
      status: (status ?? "todo") as "todo" | "in_progress" | "to_review" | "done",
      due_date: (due_date ?? null) as string | null,
      priority: priority !== undefined && priority !== null ? Number(priority) : null,
    });
    return NextResponse.json(task);
  } catch (err) {
    return handleServiceError(err);
  }
}
