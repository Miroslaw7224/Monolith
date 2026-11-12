import { NextResponse } from "next/server";

export type UploadFileResult =
  | { ok: true; name: string; type: string; content: string }
  | { ok: false; response: NextResponse };

/**
 * Reads multipart "file" entry for POST /api/upload (after formData() succeeds).
 */
export async function parseUploadFormFile(formData: FormData): Promise<UploadFileResult> {
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "No file uploaded" }, { status: 400 }),
    };
  }
  const name = file.name;
  const type = file.type;
  let content: string;
  try {
    content = await file.text();
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Failed to read file content" }, { status: 400 }),
    };
  }
  return { ok: true as const, name, type, content };
}
