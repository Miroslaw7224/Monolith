import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { CreateInboxItemSchema, toInboxDto, toInboxItemDto } from "./schemas";
import * as services from "./services";

export async function listInbox(): Promise<NextResponse> {
  try {
    return NextResponse.json(toInboxDto(services.listItems()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function createItem(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, CreateInboxItemSchema, { details: false });
  if (parsed.success === false) return parsed.response;
  try {
    return NextResponse.json(toInboxItemDto(await services.addItem(parsed.data.text)), {
      status: 201,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

/** PATCH: oznacza wpis jako posegregowany (znika z listy, zostaje w pliku). */
export async function resolveItem(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await services.resolve(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
