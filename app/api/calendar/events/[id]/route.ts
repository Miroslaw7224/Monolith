import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import * as calendarService from "@/services/calendarService";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
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
  if (body.duration_minutes != null && body.duration_minutes % 15 !== 0) {
    return NextResponse.json(
      { error: "duration_minutes must be a multiple of 15" },
      { status: 400 }
    );
  }
  try {
    await calendarService.updateCalendarEvent(auth.uid, id, {
      date: body.date,
      start_minutes: body.start_minutes,
      duration_minutes: body.duration_minutes,
      title: body.title,
      tags: body.tags,
      color: body.color,
      type: body.type !== undefined ? (body.type === "meeting" ? "meeting" : "work") : undefined,
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
  const auth = await getAuthUserId(_request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await calendarService.deleteCalendarEvent(auth.uid, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
