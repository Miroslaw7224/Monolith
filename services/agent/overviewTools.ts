import { z } from "zod";
import { defineTool } from "@/lib/agent/tools";
import { eventMinutesInInclusiveRange } from "@/lib/calendarRange";
import { formatYmd } from "@/lib/dateRef";
import * as calendarService from "@/services/calendarService";
import * as mindMapService from "@/services/mindMapService";
import * as taskService from "@/services/taskService";

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const overviewTools = [
  defineTool({
    name: "get_overview",
    description:
      "Overview of the whole app: task counts per status, overdue tasks, today's calendar entries and number of mind maps. Optional 'today' (YYYY-MM-DD) overrides the current date.",
    schema: z.object({ today: YMD.optional() }),
    readOnly: true,
    run: async (userId, { today }) => {
      const day = today ?? formatYmd(new Date());
      const [tasks, events, maps] = await Promise.all([
        taskService.getTasks(userId),
        calendarService.getCalendarEvents(userId, { startDate: day, endDate: day }),
        mindMapService.getMindMaps(userId),
      ]);
      const tasksByStatus = { todo: 0, in_progress: 0, to_review: 0, done: 0 };
      for (const t of tasks) tasksByStatus[t.status] += 1;
      const overdueTasks = tasks
        .filter((t) => t.status !== "done" && t.due_date && t.due_date < day)
        .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, status: t.status }));
      const todayEvents = events.map((e) => ({
        id: e.id,
        title: e.title,
        start_minutes: e.start_minutes,
        duration_minutes: e.duration_minutes,
        type: e.type,
      }));
      return {
        ok: true,
        data: { today: day, tasksByStatus, overdueTasks, todayEvents, mindMapCount: maps.length },
      };
    },
  }),
  defineTool({
    name: "get_work_summary",
    description:
      "Minutes of work per tag between two dates (inclusive), like the 'Moja praca' tab. Counts only 'work' entries, not meetings or task deadlines.",
    schema: z.object({ startDate: YMD, endDate: YMD }),
    readOnly: true,
    run: async (userId, { startDate, endDate }) => {
      const events = await calendarService.getCalendarEvents(userId, { startDate, endDate });
      let totalMinutes = 0;
      const byTag: Record<string, number> = {};
      for (const e of events) {
        if (e.type !== "work") continue;
        const minutes = eventMinutesInInclusiveRange(e, startDate, endDate);
        if (minutes <= 0) continue;
        totalMinutes += minutes;
        for (const tag of e.tags) byTag[tag] = (byTag[tag] ?? 0) + minutes;
      }
      return { ok: true, data: { startDate, endDate, totalMinutes, byTag } };
    },
  }),
];
