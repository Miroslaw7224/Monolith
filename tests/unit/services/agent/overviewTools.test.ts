import { describe, it, expect, vi } from "vitest";

const mockGetTasks = vi.hoisted(() => vi.fn());
const mockGetEvents = vi.hoisted(() => vi.fn());
const mockGetMindMaps = vi.hoisted(() => vi.fn());

vi.mock("@/services/taskService", () => ({ getTasks: mockGetTasks }));
vi.mock("@/services/calendarService", () => ({ getCalendarEvents: mockGetEvents }));
vi.mock("@/services/mindMapService", () => ({ getMindMaps: mockGetMindMaps }));

import { executeTool } from "@/lib/agent/tools";
import { overviewTools } from "@/services/agent/overviewTools";
import { agentTools } from "@/services/agent";

describe("overviewTools", () => {
  it("get_overview counts tasks by status and lists overdue and today's items", async () => {
    mockGetTasks.mockResolvedValue([
      { id: "1", title: "A", status: "todo", due_date: "2026-11-01" },
      { id: "2", title: "B", status: "done", due_date: "2026-11-01" },
      { id: "3", title: "C", status: "in_progress", due_date: null },
    ]);
    mockGetEvents.mockResolvedValue([
      { id: "e1", date: "2026-11-09", start_minutes: 540, duration_minutes: 60, title: "Sesja", tags: [], type: "work" },
    ]);
    mockGetMindMaps.mockResolvedValue([{ id: "m1", title: "X" }]);

    const res = await executeTool(overviewTools, "u1", "get_overview", { today: "2026-11-09" });

    expect(res.ok).toBe(true);
    const data = (res as { data: Record<string, unknown> }).data;
    expect(data.tasksByStatus).toEqual({ todo: 1, in_progress: 1, to_review: 0, done: 1 });
    expect((data.overdueTasks as { id: string }[]).map((t) => t.id)).toEqual(["1"]);
    expect((data.todayEvents as { id: string }[]).map((e) => e.id)).toEqual(["e1"]);
    expect(data.mindMapCount).toBe(1);
  });

  it("get_work_summary sums minutes per tag within the range and ignores meetings and deadlines", async () => {
    mockGetEvents.mockResolvedValue([
      { id: "e1", date: "2026-11-02", start_minutes: 540, duration_minutes: 90, title: "a", tags: ["Praca"], type: "work" },
      { id: "e2", date: "2026-11-03", start_minutes: 540, duration_minutes: 30, title: "b", tags: ["Praca", "Nauka"], type: "work" },
      { id: "e3", date: "2026-11-03", start_minutes: 600, duration_minutes: 60, title: "c", tags: ["Praca"], type: "meeting" },
      { id: "task:1", date: "2026-11-03", start_minutes: 1410, duration_minutes: 30, title: "d", tags: [], type: "task_deadline" },
    ]);
    const res = await executeTool(overviewTools, "u1", "get_work_summary", {
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });
    expect(res.ok).toBe(true);
    const data = (res as { data: { totalMinutes: number; byTag: Record<string, number> } }).data;
    expect(data.totalMinutes).toBe(120);
    expect(data.byTag).toEqual({ Praca: 120, Nauka: 30 });
  });
});

describe("agentTools registry", () => {
  it("has unique tool names and every destructive tool has describe()", () => {
    const names = agentTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of agentTools.filter((x) => x.destructive)) {
      expect(typeof t.describe).toBe("function");
    }
    expect(names).toEqual(
      expect.arrayContaining(["create_task", "create_event", "add_mind_map_node", "get_overview"])
    );
  });
});
