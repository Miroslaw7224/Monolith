import { DomainError } from "@/lib/errors";
import * as taskService from "@/contexts/bc_tasks/services";
import type { CalendarEntry } from "./models";
import * as repositories from "./repositories";

const DURATION_MULTIPLE_OF_15 = "duration_minutes must be a multiple of 15";

function assertDurationMultipleOf15(durationMinutes: number | null | undefined): void {
  if (durationMinutes !== undefined && durationMinutes !== null && durationMinutes % 15 !== 0) {
    throw new DomainError(DURATION_MULTIPLE_OF_15);
  }
}

const LINK_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const MAX_LINK_LENGTH = 500;

/** Pusty = brak linku (usunięcie); poza tym tylko adres http(s) bez spacji. */
function normalizeLink(link: string | undefined): string | undefined {
  if (link === undefined) return undefined;
  const trimmed = link.trim();
  if (trimmed === "") return "";
  if (trimmed.length > MAX_LINK_LENGTH || !LINK_RE.test(trimmed)) {
    throw new DomainError("link must be an http(s) URL");
  }
  return trimmed;
}

const TASK_DEADLINE_START_MINUTES = 23 * 60 + 30; // 23:30 — a fixed end-of-day slot
const TASK_DEADLINE_DURATION_MINUTES = 30;
const TASK_DEADLINE_COLOR = "#6B7280";

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

export async function getCalendarEvents(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<CalendarEntry[]> {
  const events = await repositories.getCalendarEvents(options);
  const tasks = await taskService.getTasks();
  const deadlineEvents: CalendarEntry[] = tasks
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

export async function createCalendarEvent(data: {
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type?: "work" | "meeting";
  link?: string;
}) {
  assertDurationMultipleOf15(data.duration_minutes);
  return repositories.createCalendarEvent({ ...data, link: normalizeLink(data.link) });
}

export async function updateCalendarEvent(
  id: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type: "work" | "meeting";
    link: string;
  }>
) {
  assertDurationMultipleOf15(data.duration_minutes);
  return repositories.updateCalendarEvent(id, { ...data, link: normalizeLink(data.link) });
}

export async function deleteCalendarEvent(id: string) {
  return repositories.deleteCalendarEvent(id);
}
