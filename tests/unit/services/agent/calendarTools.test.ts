import { describe, it, expect, vi } from "vitest";

const mockGetEvents = vi.hoisted(() => vi.fn());
const mockCreateEvent = vi.hoisted(() => vi.fn());
const mockUpdateEvent = vi.hoisted(() => vi.fn());
const mockDeleteEvent = vi.hoisted(() => vi.fn());
const mockGetUserTags = vi.hoisted(() => vi.fn());

vi.mock("@/services/calendarService", () => ({
  getCalendarEvents: mockGetEvents,
  createCalendarEvent: mockCreateEvent,
  updateCalendarEvent: mockUpdateEvent,
  deleteCalendarEvent: mockDeleteEvent,
}));
vi.mock("@/services/tagService", () => ({ getUserTags: mockGetUserTags }));

import { executeTool } from "@/lib/agent/tools";
import { calendarTools, hhmmToMinutes, minutesToHhmm } from "@/services/agent/calendarTools";

describe("time helpers", () => {
  it("converts HH:MM <-> minutes", () => {
    expect(hhmmToMinutes("21:45")).toBe(1305);
    expect(minutesToHhmm(1305)).toBe("21:45");
    expect(minutesToHhmm(540)).toBe("09:00");
  });
});

describe("calendarTools", () => {
  it("create_event converts start_time, resolves tag case-insensitively and uses the tag color", async () => {
    mockGetUserTags.mockResolvedValue([{ id: "g1", tag: "Vibe coding", title: "x", color: "#10B981" }]);
    mockCreateEvent.mockResolvedValue({ id: "e1", title: "Sesja" });
    const res = await executeTool(calendarTools, "u1", "create_event", {
      date: "2026-11-10",
      start_time: "21:45",
      duration_minutes: "105",
      title: "Sesja",
      tags: ["vibe coding"],
    });
    expect(mockCreateEvent).toHaveBeenCalledWith("u1", {
      date: "2026-11-10",
      start_minutes: 1305,
      duration_minutes: 105,
      title: "Sesja",
      tags: ["Vibe coding"],
      color: "#10B981",
      type: "work",
    });
    expect(res.ok && res.changed).toBe("calendar");
  });

  it("create_event errors on an unknown tag and lists existing tags", async () => {
    mockGetUserTags.mockResolvedValue([{ id: "g1", tag: "Praca", title: "x" }]);
    const res = await executeTool(calendarTools, "u1", "create_event", {
      date: "2026-11-10",
      start_time: "09:00",
      duration_minutes: 60,
      title: "t",
      tags: ["Nowy"],
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.error).toContain("Nowy");
      expect(res.error).toContain("Praca");
    }
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it("create_event rejects durations that are not a multiple of 15", async () => {
    const res = await executeTool(calendarTools, "u1", "create_event", {
      date: "2026-11-10",
      start_time: "09:00",
      duration_minutes: 50,
      title: "t",
    });
    expect(res.ok).toBe(false);
  });

  it("update_event refuses derived deadline events", async () => {
    const res = await executeTool(calendarTools, "u1", "update_event", {
      id: "task:abc",
      title: "x",
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.error).toContain("update_task");
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  it("update_event converts start_time to start_minutes", async () => {
    await executeTool(calendarTools, "u1", "update_event", { id: "e1", start_time: "10:30" });
    expect(mockUpdateEvent).toHaveBeenCalledWith("u1", "e1", { start_minutes: 630 });
  });

  it("delete_event is destructive and describes the event", async () => {
    mockGetEvents.mockResolvedValue([
      { id: "e1", date: "2026-11-10", start_minutes: 540, duration_minutes: 60, title: "Sesja", tags: [], color: "", type: "work" },
    ]);
    const tool = calendarTools.find((t) => t.name === "delete_event")!;
    expect(tool.destructive).toBe(true);
    const text = await tool.describe!("u1", { id: "e1" });
    expect(text).toContain("Sesja");
    expect(text).toContain("2026-11-10");
    expect(text).toContain("09:00");
  });
});
