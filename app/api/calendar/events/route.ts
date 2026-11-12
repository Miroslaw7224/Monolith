import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { CreateCalendarEventBodySchema } from "@/lib/validation/calendarEvents";
import * as calendarService from "@/services/calendarService";

export async function GET(request: NextRequest) {
  const startDate = request.nextUrl.searchParams.get("startDate") ?? undefined;
  const endDate = request.nextUrl.searchParams.get("endDate") ?? undefined;
  try {
    const events = await calendarService.getCalendarEvents({ startDate, endDate });
    return NextResponse.json(events);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, CreateCalendarEventBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { date, start_minutes, duration_minutes, title, tags, color, type } = parsed.data;
  try {
    const event = await calendarService.createCalendarEvent({
      date: date as string,
      start_minutes: Number(start_minutes) ?? 0,
      duration_minutes: Number(duration_minutes),
      title: (title ?? "") as string,
      tags: (Array.isArray(tags) ? tags : tags ? [tags] : []) as string[],
      color: (color ?? "#3B82F6") as string,
      type: type === "meeting" ? "meeting" : "work",
    });
    return NextResponse.json(event);
  } catch (err) {
    return handleServiceError(err);
  }
}
