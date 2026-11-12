import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { UpdateTaskTemplateBodySchema } from "@/lib/validation/taskTemplates";
import * as taskTemplateService from "@/services/taskTemplateService";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = await parseBody(request, UpdateTaskTemplateBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { label, title, link } = parsed.data;
  try {
    await taskTemplateService.updateTaskTemplate(id, {
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
  const { id } = await params;
  try {
    await taskTemplateService.deleteTaskTemplate(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
