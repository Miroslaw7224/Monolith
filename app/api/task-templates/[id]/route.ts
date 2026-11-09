import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { UpdateTaskTemplateBodySchema } from "@/lib/validation/taskTemplates";
import * as taskTemplateService from "@/services/taskTemplateService";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const parsed = await parseBody(request, UpdateTaskTemplateBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { label, title, link } = parsed.data;
  try {
    await taskTemplateService.updateTaskTemplate(auth.uid, id, {
      label: typeof label === "string" ? label.trim() : undefined,
      title: typeof title === "string" ? title.trim() : undefined,
      link: typeof link === "string" ? link.trim() : undefined,
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
    await taskTemplateService.deleteTaskTemplate(auth.uid, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
