import { z } from "zod";
import { defineTool } from "@/lib/agent/tools";
import * as calendarService from "@/services/calendarService";
import * as tagService from "@/services/tagService";

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM (24h)");
const DURATION = z.coerce
  .number()
  .int()
  .min(15)
  .max(1440)
  .refine((n) => n % 15 === 0, "duration_minutes must be a multiple of 15");
const EVENT_TYPE = z.enum(["work", "meeting"]);
const DEFAULT_COLOR = "#3B82F6";

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

async function resolveTags(
  userId: string,
  requested: string[]
): Promise<{ tags: string[]; color?: string }> {
  if (requested.length === 0) return { tags: [] };
  const userTags = await tagService.getUserTags(userId);
  const tags: string[] = [];
  const unknown: string[] = [];
  let color: string | undefined;
  for (const raw of requested) {
    const name = raw.trim().replace(/^#/, "");
    const found = userTags.find((u) => u.tag.toLowerCase() === name.toLowerCase());
    if (!found) {
      unknown.push(name);
      continue;
    }
    tags.push(found.tag);
    color ??= found.color;
  }
  if (unknown.length > 0) {
    throw new Error(
      `Unknown tag(s): ${unknown.join(", ")}. Existing tags: ${userTags.map((u) => u.tag).join(", ") || "(none)"}. Ask the user to create the tag first.`
    );
  }
  return { tags, color };
}

function rejectDeadline(id: string): void {
  if (id.startsWith("task:")) {
    throw new Error("This is a task deadline, not a calendar entry. Use update_task instead.");
  }
}

async function findEvent(userId: string, id: string) {
  const events = await calendarService.getCalendarEvents(userId);
  const found = events.find((e) => e.id === id);
  if (!found) throw new Error(`Event not found: ${id}`);
  return found;
}

export const calendarTools = [
  defineTool({
    name: "list_events",
    description:
      "List calendar events between two dates (inclusive). Includes task deadlines (type task_deadline, id starts with 'task:'), which cannot be edited here.",
    schema: z.object({ startDate: YMD, endDate: YMD }),
    readOnly: true,
    run: async (userId, { startDate, endDate }) => {
      const events = await calendarService.getCalendarEvents(userId, { startDate, endDate });
      return {
        ok: true,
        data: events.map((e) => ({
          id: e.id,
          date: e.date,
          start_time: minutesToHhmm(e.start_minutes),
          duration_minutes: e.duration_minutes,
          title: e.title,
          tags: e.tags,
          type: e.type,
        })),
      };
    },
  }),
  defineTool({
    name: "create_event",
    description:
      "Create a calendar entry. date is YYYY-MM-DD, start_time is HH:MM (24h), duration_minutes is a multiple of 15. tags must already exist (use list_tags). type: work (default) or meeting.",
    schema: z.object({
      date: YMD,
      start_time: HHMM,
      duration_minutes: DURATION,
      title: z.string().min(1).max(200),
      tags: z.array(z.string()).optional(),
      type: EVENT_TYPE.optional(),
    }),
    run: async (userId, args) => {
      const { tags, color } = await resolveTags(userId, args.tags ?? []);
      const event = await calendarService.createCalendarEvent(userId, {
        date: args.date,
        start_minutes: hhmmToMinutes(args.start_time),
        duration_minutes: args.duration_minutes,
        title: args.title,
        tags,
        color: color ?? DEFAULT_COLOR,
        type: args.type ?? "work",
      });
      return {
        ok: true,
        data: { id: event.id },
        changed: "calendar",
        summary: `Dodano wpis „${args.title}” (${args.date} ${args.start_time})`,
      };
    },
  }),
  defineTool({
    name: "update_event",
    description: "Update a calendar entry by id. Provide only the fields to change.",
    schema: z.object({
      id: z.string().min(1),
      date: YMD.optional(),
      start_time: HHMM.optional(),
      duration_minutes: DURATION.optional(),
      title: z.string().min(1).max(200).optional(),
      tags: z.array(z.string()).optional(),
      type: EVENT_TYPE.optional(),
    }),
    run: async (userId, args) => {
      rejectDeadline(args.id);
      const patch: Record<string, unknown> = {};
      if (args.date !== undefined) patch.date = args.date;
      if (args.start_time !== undefined) patch.start_minutes = hhmmToMinutes(args.start_time);
      if (args.duration_minutes !== undefined) patch.duration_minutes = args.duration_minutes;
      if (args.title !== undefined) patch.title = args.title;
      if (args.type !== undefined) patch.type = args.type;
      if (args.tags !== undefined) {
        const { tags, color } = await resolveTags(userId, args.tags);
        patch.tags = tags;
        if (color) patch.color = color;
      }
      if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update" };
      await calendarService.updateCalendarEvent(userId, args.id, patch);
      return {
        ok: true,
        data: { id: args.id },
        changed: "calendar",
        summary: `Zaktualizowano wpis ${args.id}`,
      };
    },
  }),
  defineTool({
    name: "delete_event",
    description:
      "Delete a calendar entry by id. Requires user confirmation; it is not executed immediately.",
    schema: z.object({ id: z.string().min(1) }),
    destructive: true,
    describe: async (userId, { id }) => {
      rejectDeadline(id);
      const e = await findEvent(userId, id);
      return `Usunąć wpis „${e.title}” (${e.date} ${minutesToHhmm(e.start_minutes)})?`;
    },
    run: async (userId, { id }) => {
      rejectDeadline(id);
      const e = await findEvent(userId, id);
      await calendarService.deleteCalendarEvent(userId, id);
      return {
        ok: true,
        data: { id },
        changed: "calendar",
        summary: `Usunięto wpis „${e.title}” (${e.date})`,
      };
    },
  }),
  defineTool({
    name: "list_tags",
    description: "List the user's existing tags. Use exactly these names for calendar entries.",
    schema: z.object({}),
    readOnly: true,
    run: async (userId) => {
      const tags = await tagService.getUserTags(userId);
      return { ok: true, data: tags.map((t) => ({ tag: t.tag, title: t.title })) };
    },
  }),
];
