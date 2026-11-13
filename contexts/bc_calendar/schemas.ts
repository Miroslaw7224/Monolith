import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";
import type { CalendarEntry } from "./models";

// ── wejście (zod) ──────────────────────────────────────────────────────────────

export const CreateCalendarEventBodySchema = looseObject({
  date: z.unknown().optional(),
  start_minutes: z.unknown().optional(),
  duration_minutes: z.unknown().optional(),
  title: z.unknown().optional(),
  tags: z.unknown().optional(),
  color: z.unknown().optional(),
  type: z.unknown().optional(),
}).superRefine((body, ctx) => {
  const missingDuration = body.duration_minutes === undefined || body.duration_minutes === null;
  if (!body.date || missingDuration) {
    ctx.addIssue("date and duration_minutes required");
  }
});

export const UpdateCalendarEventBodySchema = looseObject({
  date: z.unknown().optional(),
  start_minutes: z.unknown().optional(),
  duration_minutes: z.unknown().optional(),
  title: z.unknown().optional(),
  tags: z.unknown().optional(),
  color: z.unknown().optional(),
  type: z.unknown().optional(),
});

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type CalendarEventDto = {
  id: string;
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting" | "task_deadline";
  created_at?: string;
};

export function toCalendarEventDto(entry: CalendarEntry): CalendarEventDto {
  return {
    id: entry.id,
    date: entry.date,
    start_minutes: entry.start_minutes,
    duration_minutes: entry.duration_minutes,
    title: entry.title,
    tags: entry.tags,
    color: entry.color,
    type: entry.type,
    created_at: entry.created_at,
  };
}
