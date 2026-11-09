import { DomainError } from "@/lib/errors";
import * as firestoreDb from "@/lib/firestore-db";
import type { CalendarEvent } from "@/types/records";

const DURATION_MULTIPLE_OF_15 = "duration_minutes must be a multiple of 15";

function assertDurationMultipleOf15(durationMinutes: number | null | undefined): void {
  if (durationMinutes !== undefined && durationMinutes !== null && durationMinutes % 15 !== 0) {
    throw new DomainError(DURATION_MULTIPLE_OF_15);
  }
}

const TASK_DEADLINE_START_MINUTES = 23 * 60 + 30; // 23:30 — a fixed end-of-day slot
const TASK_DEADLINE_DURATION_MINUTES = 30;
const TASK_DEADLINE_COLOR = "#6B7280";

export type CalendarEventWithType = CalendarEvent;

function taskDueDateInRange(
  dueDate: string,
  options?: { startDate?: string; endDate?: string }
): boolean {
  if (options?.startDate && options?.endDate) {
    return dueDate >= options.startDate && dueDate <= options.endDate;
  }
  if (options?.startDate) return dueDate >= options.startDate;
  if (options?.endDate) return dueDate <= options.endDate;
  return true;
}

export async function getCalendarEvents(
  userId: string,
  options?: { startDate?: string; endDate?: string }
): Promise<CalendarEventWithType[]> {
  const events = await firestoreDb.getCalendarEvents(userId, options);
  const tasks = await firestoreDb.getTasks(userId);
  const deadlineEvents: CalendarEventWithType[] = tasks
    .filter((task) => task.due_date && task.status !== "done")
    .filter((task) => taskDueDateInRange(task.due_date!, options))
    .map((task) => ({
      id: `task:${task.id}`,
      date: task.due_date!,
      start_minutes: TASK_DEADLINE_START_MINUTES,
      duration_minutes: TASK_DEADLINE_DURATION_MINUTES,
      title: task.title,
      tags: [] as string[],
      color: TASK_DEADLINE_COLOR,
      type: "task_deadline" as const,
    }));
  return [...events, ...deadlineEvents].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start_minutes - b.start_minutes
  );
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
  assertDurationMultipleOf15(data.duration_minutes);
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
  assertDurationMultipleOf15(data.duration_minutes);
  return firestoreDb.updateCalendarEvent(userId, id, data);
}

export async function deleteCalendarEvent(userId: string, id: string) {
  return firestoreDb.deleteCalendarEvent(userId, id);
}
