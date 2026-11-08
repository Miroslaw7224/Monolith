import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import * as taskTemplateService from "@/services/taskTemplateService";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const list = await taskTemplateService.getTaskTemplates(auth.uid);
    return NextResponse.json(list);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { label, title, link } = body as {
    label?: string;
    title?: string;
    link?: string;
  };
  if (!label || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  try {
    const created = await taskTemplateService.createTaskTemplate(auth.uid, {
      label: label.trim(),
      title: title.trim(),
      link: typeof link === "string" ? link.trim() : "",
    });
    return NextResponse.json(created);
  } catch (err) {
    return handleServiceError(err);
  }
}
