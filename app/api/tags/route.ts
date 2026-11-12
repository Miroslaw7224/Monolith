import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { CreateTagBodySchema } from "@/lib/validation/tags";
import * as tagService from "@/services/tagService";

export async function GET(request: NextRequest) {
  try {
    const list = await tagService.getUserTags();
    return NextResponse.json(list);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, CreateTagBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { tag, title, color } = parsed.data;
  try {
    const created = await tagService.createUserTag({
      tag: (tag as string).trim(),
      title: typeof title === "string" ? title.trim() : "",
      color: typeof color === "string" ? color.trim() || undefined : undefined,
    });
    return NextResponse.json(created);
  } catch (err) {
    return handleServiceError(err);
  }
}
