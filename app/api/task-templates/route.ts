import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { CreateTaskTemplateBodySchema } from "@/lib/validation/taskTemplates";
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

  const parsed = await parseBody(request, CreateTaskTemplateBodySchema);
  if (parsed.success === false) return parsed.response;

  const { label, title, link } = parsed.data;
  try {
    const created = await taskTemplateService.createTaskTemplate(auth.uid, {
      label: (label as string).trim(),
      title: (title as string).trim(),
      link: typeof link === "string" ? link.trim() : "",
    });
    return NextResponse.json(created);
  } catch (err) {
    return handleServiceError(err);
  }
}
