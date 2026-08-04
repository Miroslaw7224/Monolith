import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import * as calendarService from "@/services/calendarService";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  const startDate = request.nextUrl.searchParams.get("startDate") ?? undefined;
  const endDate = request.nextUrl.searchParams.get("endDate") ?? undefined;
  try {
    const events = await calendarService.getCalendarEvents(auth.uid, { startDate, endDate });
    return NextResponse.json(events);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  let body: {
    date?: string;
    start_minutes?: number;
    duration_minutes?: number;
    title?: string;
    tags?: string[];
    color?: string;
    type?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { date, start_minutes, duration_minutes, title, tags, color, type } = body;
  if (!date || duration_minutes == null) {
    return NextResponse.json({ error: "date and duration_minutes required" }, { status: 400 });
  }
  if (duration_minutes % 15 !== 0) {
    return NextResponse.json(
      { error: "duration_minutes must be a multiple of 15" },
      { status: 400 }
    );
  }
  try {
    const event = await calendarService.createCalendarEvent(auth.uid, {
      date,
      start_minutes: Number(start_minutes) ?? 0,
      duration_minutes: Number(duration_minutes),
      title: title ?? "",
      tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
      color: color ?? "#3B82F6",
      type: type === "meeting" ? "meeting" : "work",
    });
    return NextResponse.json(event);
  } catch (err) {
    return handleServiceError(err);
  }
}
