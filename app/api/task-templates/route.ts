import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { CreateTaskTemplateBodySchema } from "@/lib/validation/taskTemplates";
import * as taskTemplateService from "@/services/taskTemplateService";

export async function GET(request: NextRequest) {
  try {
    const list = await taskTemplateService.getTaskTemplates();
    return NextResponse.json(list);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, CreateTaskTemplateBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { label, title, link } = parsed.data;
  try {
    const created = await taskTemplateService.createTaskTemplate({
      label: (label as string).trim(),
      title: (title as string).trim(),
      link: typeof link === "string" ? link.trim() : "",
    });
    return NextResponse.json(created);
  } catch (err) {
    return handleServiceError(err);
  }
}
