import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { CreateTagBodySchema, toUserTagDto, UpdateTagBodySchema } from "./schemas";
import * as services from "./services";

type RouteContext = { params: Promise<{ id: string }> };

export async function listTags(): Promise<NextResponse> {
  try {
    const list = await services.getUserTags();
    return NextResponse.json(list.map(toUserTagDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function createTag(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, CreateTagBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { tag, title, color } = parsed.data;
  try {
    const created = await services.createUserTag({
      tag: (tag as string).trim(),
      title: typeof title === "string" ? title.trim() : "",
      color: typeof color === "string" ? color.trim() || undefined : undefined,
    });
    return NextResponse.json(toUserTagDto(created));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function updateTag(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;

  const parsed = await parseBody(request, UpdateTagBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { tag, title, color } = parsed.data;
  try {
    await services.updateUserTag(id, {
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

export async function deleteTag(_request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await services.deleteUserTag(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
