import { FieldValue } from "firebase-admin/firestore";
import { eventOverlapsInclusiveRange } from "@/lib/calendarRange";
import type { CalendarEventRecord } from "@/types/records";
import { calendarEventsCol } from "./collections";

export async function getCalendarEvents(
  userId: string,
  options?: { startDate?: string; endDate?: string }
): Promise<CalendarEventRecord[]> {
  const snap = await calendarEventsCol(userId).get();
  let list = snap.docs.map((d): CalendarEventRecord => {
    const data = d.data();
    const createdAt =
      data.createdAt ??
      (data.created_at != null
        ? typeof data.created_at === "string"
          ? { toDate: () => new Date(data.created_at) }
          : data.created_at
        : null);
    return {
      id: d.id,
      date: data.date ?? "",
      start_minutes: data.start_minutes ?? 0,
      duration_minutes: data.duration_minutes ?? 0,
      title: data.title ?? "",
      tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
      color: data.color ?? "#3B82F6",
      type: data.type === "meeting" ? "meeting" : "work",
      created_at: createdAt?.toDate?.()?.toISOString?.(),
      createdAt: data.createdAt ?? createdAt,
    };
  });
  if (options?.startDate && options?.endDate) {
    list = list.filter((e) => eventOverlapsInclusiveRange(e, options.startDate!, options.endDate!));
  } else if (options?.startDate) {
    list = list.filter((e) => e.date >= options.startDate!);
  } else if (options?.endDate) {
    list = list.filter((e) => e.date <= options.endDate!);
  }
  list.sort((a, b) => a.date.localeCompare(b.date) || a.start_minutes - b.start_minutes);
  return list;
}

export async function createCalendarEvent(
  userId: string,
  data: {
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type?: "work" | "meeting";
  }
): Promise<CalendarEventRecord> {
  if (data.duration_minutes % 15 !== 0) {
    throw new Error("duration_minutes must be a multiple of 15");
  }
  const ref = await calendarEventsCol(userId).add({
    date: data.date,
    start_minutes: data.start_minutes,
    duration_minutes: data.duration_minutes,
    title: data.title,
    tags: data.tags ?? [],
    color: data.color ?? "#3B82F6",
    type: data.type === "meeting" ? "meeting" : "work",
    createdAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  const d = doc.data()!;
  return {
    id: ref.id,
    date: d.date ?? "",
    start_minutes: d.start_minutes ?? 0,
    duration_minutes: d.duration_minutes ?? 0,
    title: d.title ?? "",
    tags: Array.isArray(d.tags) ? d.tags : [],
    color: d.color ?? "#3B82F6",
    type: d.type === "meeting" ? "meeting" : "work",
    created_at: d.createdAt?.toDate?.()?.toISOString?.(),
    createdAt: d.createdAt,
  };
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type: "work" | "meeting";
  }>
): Promise<void> {
  if (data.duration_minutes != null && data.duration_minutes % 15 !== 0) {
    throw new Error("duration_minutes must be a multiple of 15");
  }
  const ref = calendarEventsCol(userId).doc(eventId);
  const update: Record<string, unknown> = {};
  if (data.date !== undefined) update.date = data.date;
  if (data.start_minutes !== undefined) update.start_minutes = data.start_minutes;
  if (data.duration_minutes !== undefined) update.duration_minutes = data.duration_minutes;
  if (data.title !== undefined) update.title = data.title;
  if (data.tags !== undefined) update.tags = data.tags;
  if (data.color !== undefined) update.color = data.color;
  if (data.type !== undefined) update.type = data.type === "meeting" ? "meeting" : "work";
  if (Object.keys(update).length > 0) {
    await ref.update(update);
  }
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  await calendarEventsCol(userId).doc(eventId).delete();
}
