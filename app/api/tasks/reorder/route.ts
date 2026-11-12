import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/apiError";
import * as taskService from "@/services/taskService";

export async function PUT(request: NextRequest) {
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
    await taskService.reorderTasks(taskIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
