import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../../../services/calendarService.js";

const mockGetCalendarEvents = vi.hoisted(() => vi.fn());
const mockCreateCalendarEvent = vi.hoisted(() => vi.fn());
const mockUpdateCalendarEvent = vi.hoisted(() => vi.fn());
const mockDeleteCalendarEvent = vi.hoisted(() => vi.fn());
const mockGetTasks = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/firestore-db.js", () => ({
  getCalendarEvents: (...args: unknown[]) => mockGetCalendarEvents(...args),
  createCalendarEvent: (...args: unknown[]) => mockCreateCalendarEvent(...args),
  updateCalendarEvent: (...args: unknown[]) => mockUpdateCalendarEvent(...args),
  deleteCalendarEvent: (...args: unknown[]) => mockDeleteCalendarEvent(...args),
}));

vi.mock("@/contexts/bc_tasks/services", () => ({
  getTasks: (...args: unknown[]) => mockGetTasks(...args),
}));

describe("calendarService", () => {
  beforeEach(() => {
    mockGetCalendarEvents.mockReset();
    mockCreateCalendarEvent.mockReset();
    mockUpdateCalendarEvent.mockReset();
    mockDeleteCalendarEvent.mockReset();
    mockGetTasks.mockReset();
    mockGetTasks.mockResolvedValue([]);
  });

  describe("getCalendarEvents", () => {
    it("given Firestore returns events, when getCalendarEvents is called, then returns the list (happy path)", async () => {
      const events = [
        {
          id: "e1",
          date: "2025-02-20",
          start_minutes: 540,
          duration_minutes: 60,
          title: "Meeting",
          tags: [],
          color: "#3B82F6",
          type: "work" as const,
        },
      ];
      mockGetCalendarEvents.mockResolvedValue(events);

      const result = await getCalendarEvents();

      expect(result).toEqual(events);
    });

    it("given getCalendarEvents throws, when getCalendarEvents is called, then propagates the error", async () => {
      mockGetCalendarEvents.mockRejectedValue(new Error("DB error"));

      await expect(getCalendarEvents()).rejects.toThrow("DB error");
    });

    it("given a task with a due_date in range and status not done, when getCalendarEvents is called, then includes a task_deadline pseudo-event", async () => {
      mockGetCalendarEvents.mockResolvedValue([]);
      mockGetTasks.mockResolvedValue([
        {
          id: "t1",
          title: "Finish report",
          description: "",
          status: "todo",
          due_date: "2025-02-20",
          priority: null,
        },
      ]);

      const result = await getCalendarEvents({
        startDate: "2025-02-01",
        endDate: "2025-02-28",
      });

      expect(result).toEqual([
        expect.objectContaining({
          id: "task:t1",
          date: "2025-02-20",
          title: "Finish report",
          type: "task_deadline",
        }),
      ]);
    });

    it("given a task with status done, when getCalendarEvents is called, then excludes it from results", async () => {
      mockGetCalendarEvents.mockResolvedValue([]);
      mockGetTasks.mockResolvedValue([
        {
          id: "t1",
          title: "Finish report",
          description: "",
          status: "done",
          due_date: "2025-02-20",
          priority: null,
        },
      ]);

      const result = await getCalendarEvents({
        startDate: "2025-02-01",
        endDate: "2025-02-28",
      });

      expect(result).toEqual([]);
    });

    it("given a task due_date outside the requested range, when getCalendarEvents is called, then excludes it from results", async () => {
      mockGetCalendarEvents.mockResolvedValue([]);
      mockGetTasks.mockResolvedValue([
        {
          id: "t1",
          title: "Finish report",
          description: "",
          status: "todo",
          due_date: "2025-03-15",
          priority: null,
        },
      ]);

      const result = await getCalendarEvents({
        startDate: "2025-02-01",
        endDate: "2025-02-28",
      });

      expect(result).toEqual([]);
    });
  });

  describe("createCalendarEvent", () => {
    it("given valid data, when createCalendarEvent is called, then returns created event (happy path)", async () => {
      const event = {
        id: "e1",
        date: "2025-02-20",
        start_minutes: 540,
        duration_minutes: 60,
        title: "Meeting",
        tags: [],
        color: "#3B82F6",
      };
      mockCreateCalendarEvent.mockResolvedValue(event);

      const result = await createCalendarEvent({
        date: "2025-02-20",
        start_minutes: 540,
        duration_minutes: 60,
        title: "Meeting",
        tags: [],
        color: "#3B82F6",
      });

      expect(result).toEqual(event);
    });

    it("given firestore createCalendarEvent throws (e.g. duration not multiple of 15), when createCalendarEvent is called, then propagates the error", async () => {
      mockCreateCalendarEvent.mockRejectedValue(
        new Error("duration_minutes must be a multiple of 15")
      );

      await expect(
        createCalendarEvent({
          date: "2025-02-20",
          start_minutes: 540,
          duration_minutes: 30,
          title: "X",
          tags: [],
          color: "#3B82F6",
        })
      ).rejects.toThrow("duration_minutes must be a multiple of 15");
    });
  });

  describe("updateCalendarEvent", () => {
    it("given valid id and data, when updateCalendarEvent is called, then delegates to firestore (happy path)", async () => {
      mockUpdateCalendarEvent.mockResolvedValue(undefined);

      await updateCalendarEvent("e1", { title: "Updated" });

      expect(mockUpdateCalendarEvent).toHaveBeenCalledWith("e1", { title: "Updated" });
    });

    it("given updateCalendarEvent throws, when updateCalendarEvent is called, then propagates the error", async () => {
      mockUpdateCalendarEvent.mockRejectedValue(new Error("Update failed"));

      await expect(updateCalendarEvent("e1", { title: "X" })).rejects.toThrow("Update failed");
    });
  });

  describe("deleteCalendarEvent", () => {
    it("given valid id, when deleteCalendarEvent is called, then delegates to firestore (happy path)", async () => {
      mockDeleteCalendarEvent.mockResolvedValue(undefined);

      await deleteCalendarEvent("e1");

      expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("e1");
    });

    it("given deleteCalendarEvent throws, when deleteCalendarEvent is called, then propagates the error", async () => {
      mockDeleteCalendarEvent.mockRejectedValue(new Error("Delete failed"));

      await expect(deleteCalendarEvent("e1")).rejects.toThrow("Delete failed");
    });
  });
});
