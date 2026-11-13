import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import {
  CreateCalendarEventBodySchema,
  UpdateCalendarEventBodySchema,
  toCalendarEventDto,
} from "./schemas";
import * as services from "./services";

type RouteContext = { params: Promise<{ id: string }> };

export async function listCalendarEvents(request: NextRequest): Promise<NextResponse> {
  const startDate = request.nextUrl.searchParams.get("startDate") ?? undefined;
  const endDate = request.nextUrl.searchParams.get("endDate") ?? undefined;
  try {
    const events = await services.getCalendarEvents({ startDate, endDate });
    return NextResponse.json(events.map(toCalendarEventDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function createCalendarEvent(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, CreateCalendarEventBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { date, start_minutes, duration_minutes, title, tags, color, type, link, brief } =
    parsed.data;
  try {
    const event = await services.createCalendarEvent({
      date: date as string,
      start_minutes: Number(start_minutes) ?? 0,
      duration_minutes: Number(duration_minutes),
      title: (title ?? "") as string,
      tags: (Array.isArray(tags) ? tags : tags ? [tags] : []) as string[],
      color: (color ?? "#3B82F6") as string,
      type: type === "meeting" ? "meeting" : "work",
      link: typeof link === "string" ? link : undefined,
      brief: typeof brief === "string" ? brief : undefined,
    });
    return NextResponse.json(toCalendarEventDto(event));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function updateCalendarEvent(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const { id } = await ctx.params;

  const parsed = await parseBody(request, UpdateCalendarEventBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const body = parsed.data;
  try {
    await services.updateCalendarEvent(id, {
      date: body.date as string | undefined,
      start_minutes: body.start_minutes as number | undefined,
      duration_minutes: body.duration_minutes as number | undefined,
      title: body.title as string | undefined,
      tags: body.tags as string[] | undefined,
      color: body.color as string | undefined,
      type: body.type !== undefined ? (body.type === "meeting" ? "meeting" : "work") : undefined,
      link: typeof body.link === "string" ? body.link : undefined,
      brief: typeof body.brief === "string" ? body.brief : undefined,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteCalendarEvent(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await services.deleteCalendarEvent(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
