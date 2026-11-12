import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { UpdateTagBodySchema } from "@/lib/validation/tags";
import * as tagService from "@/services/tagService";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = await parseBody(request, UpdateTagBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { tag, title, color } = parsed.data;
  try {
    await tagService.updateUserTag(id, {
      tag: typeof tag === "string" ? tag.trim() : undefined,
      title: typeof title === "string" ? title.trim() : undefined,
      color:
        color !== undefined ? (typeof color === "string" ? color.trim() || null : null) : undefined,
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
    await tagService.deleteUserTag(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
