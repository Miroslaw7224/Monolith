import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { CreateTagBodySchema } from "@/lib/validation/tags";
import * as tagService from "@/services/tagService";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const list = await tagService.getUserTags(auth.uid);
    return NextResponse.json(list);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(request, CreateTagBodySchema);
  if (parsed.success === false) return parsed.response;

  const { tag, title, color } = parsed.data;
  try {
    const created = await tagService.createUserTag(auth.uid, {
      tag: (tag as string).trim(),
      title: typeof title === "string" ? title.trim() : "",
      color: typeof color === "string" ? color.trim() || undefined : undefined,
    });
    return NextResponse.json(created);
  } catch (err) {
    return handleServiceError(err);
  }
}
