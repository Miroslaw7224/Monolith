import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { UpdateCalendarEventBodySchema } from "@/lib/validation/calendarEvents";
import * as calendarService from "@/services/calendarService";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const parsed = await parseBody(request, UpdateCalendarEventBodySchema);
  if (parsed.success === false) return parsed.response;

  const body = parsed.data;
  try {
    await calendarService.updateCalendarEvent(auth.uid, id, {
      date: body.date as string | undefined,
      start_minutes: body.start_minutes as number | undefined,
      duration_minutes: body.duration_minutes as number | undefined,
      title: body.title as string | undefined,
      tags: body.tags as string[] | undefined,
      color: body.color as string | undefined,
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
