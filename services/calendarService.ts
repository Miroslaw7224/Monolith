import * as firestoreDb from "@/lib/firestore-db";

export async function getCalendarEvents(
  userId: string,
  options?: { startDate?: string; endDate?: string }
) {
  return firestoreDb.getCalendarEvents(userId, options);
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
) {
  return firestoreDb.createCalendarEvent(userId, data);
}

export async function updateCalendarEvent(
  userId: string,
  id: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type: "work" | "meeting";
  }>
) {
  return firestoreDb.updateCalendarEvent(userId, id, data);
}

export async function deleteCalendarEvent(userId: string, id: string) {
  return firestoreDb.deleteCalendarEvent(userId, id);
}
