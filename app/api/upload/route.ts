import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseUploadFormFile } from "@/lib/http/uploadFormFile";
import * as documentService from "@/services/documentService";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const parsed = await parseUploadFormFile(formData);
  if (parsed.ok === false) {
    return parsed.response;
  }
  const { name, type, content } = parsed;
  try {
    const result = await documentService.ingestDocument({ name, content, type });
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
