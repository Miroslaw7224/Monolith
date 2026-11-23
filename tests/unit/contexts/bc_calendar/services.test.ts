// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import { formatYamlList } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import type { CalendarEvent } from "@/contexts/bc_calendar/models";
import type { Task } from "@/contexts/bc_tasks/models";
import type * as TasksServices from "@/contexts/bc_tasks/services";
import type * as TagsServices from "@/contexts/bc_tags/services";
import { setupTempVault } from "../../helpers/tempVault";

const mockGetTasks = vi.hoisted(() => vi.fn<typeof TasksServices.getTasks>());
const mockResolveTags = vi.hoisted(() => vi.fn<typeof TagsServices.resolveTags>());

vi.mock(
  "@/contexts/bc_tasks/services",
  () => ({ getTasks: mockGetTasks }) satisfies Partial<typeof TasksServices>
);

vi.mock(
  "@/contexts/bc_tags/services",
  () => ({ resolveTags: mockResolveTags }) satisfies Partial<typeof TagsServices>
);

import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/contexts/bc_calendar/services";

const vault = setupTempVault();
const FEB = "Calendar/2025-02.yaml";
const NOV = "Calendar/2026-11.yaml";

/** Zapisuje wydarzenia w pliku miesiąca tak, jak robi to repozytorium. */
const seedEvents = (file: string, events: CalendarEvent[]) =>
  vault.write(file, formatYamlList("events", events));

const calendarEvent = (o: Partial<CalendarEvent> & Pick<CalendarEvent, "id">): CalendarEvent => ({
  date: "2025-02-20",
  start_minutes: 540,
  duration_minutes: 60,
  title: "Meeting",
  tags: [],
  color: "#3B82F6",
  type: "work",
  ...o,
});

const task = (o: Partial<Task> & Pick<Task, "id">): Task => ({
  title: "Task",
  link: "",
  description: "",
  status: "todo",
  due_date: null,
  priority: null,
  ...o,
});

describe("calendarService", () => {
  beforeEach(() => {
    mockGetTasks.mockReset();
    mockResolveTags.mockReset();
    mockResolveTags.mockImplementation(async (names) =>
      Array.isArray(names) ? names.map(String) : []
    );
    mockGetTasks.mockResolvedValue([]);
  });

  describe("getCalendarEvents", () => {
    it("zwraca wydarzenia zapisane w vaulcie", async () => {
      seedEvents(FEB, [calendarEvent({ id: "e1", title: "Meeting" })]);

      const result = await getCalendarEvents();

      expect(result.map((e) => [e.id, e.date, e.title, e.type])).toEqual([
        ["e1", "2025-02-20", "Meeting", "work"],
      ]);
    });

    it("given a task with a due_date in range and status not done, when getCalendarEvents is called, then includes a task_deadline pseudo-event", async () => {
      mockGetTasks.mockResolvedValue([
        task({
          id: "t1",
          title: "Finish report",
          due_date: "2025-02-20",
        }),
      ]);

      const result = await getCalendarEvents({
        startDate: "2025-02-01",
        endDate: "2025-02-28",
      });

      expect(result).toEqual([
        {
          id: "task:t1",
          date: "2025-02-20",
          start_minutes: 1410,
          duration_minutes: 30,
          title: "Finish report",
          tags: [],
          color: "#6B7280",
          type: "task_deadline",
        },
      ]);
    });

    it("given a task with status done, when getCalendarEvents is called, then excludes it from results", async () => {
      mockGetTasks.mockResolvedValue([
        task({
          id: "t1",
          title: "Finish report",
          status: "done",
          due_date: "2025-02-20",
        }),
      ]);

      const result = await getCalendarEvents({
        startDate: "2025-02-01",
        endDate: "2025-02-28",
      });

      expect(result).toEqual([]);
    });

    it("given a task due_date outside the requested range, when getCalendarEvents is called, then excludes it from results", async () => {
      mockGetTasks.mockResolvedValue([
        task({
          id: "t1",
          title: "Finish report",
          due_date: "2025-03-15",
        }),
      ]);

      const result = await getCalendarEvents({
        startDate: "2025-02-01",
        endDate: "2025-02-28",
      });

      expect(result).toEqual([]);
    });

    it("given a deferred task with a due_date in range, when getCalendarEvents is called, then does not add a task_deadline pseudo-event", async () => {
      mockGetTasks.mockResolvedValue([
        task({
          id: "t1",
          title: "Kurs Playwright",
          status: "deferred",
          due_date: "2025-02-20",
        }),
      ]);

      const result = await getCalendarEvents({
        startDate: "2025-02-01",
        endDate: "2025-02-28",
      });

      expect(result).toEqual([]);
    });

    it("given stored events and task deadlines, when getCalendarEvents is called, then sorts by date and start_minutes", async () => {
      seedEvents(FEB, [calendarEvent({ id: "e1", start_minutes: 600, title: "Praca" })]);
      mockGetTasks.mockResolvedValue([
        task({ id: "t1", title: "Termin 20", due_date: "2025-02-20" }),
        task({ id: "t2", title: "Termin 19", due_date: "2025-02-19", status: "in_progress" }),
      ]);

      const result = await getCalendarEvents();

      expect(result.map((e) => e.id)).toEqual(["task:t2", "e1", "task:t1"]);
      expect(result[0]).toMatchObject({
        type: "task_deadline",
        start_minutes: 1410,
        duration_minutes: 30,
        color: "#6B7280",
        tags: [],
      });
    });
  });

  describe("createCalendarEvent", () => {
    const input = {
      date: "2025-02-20",
      start_minutes: 540,
      duration_minutes: 60,
      title: "Meeting",
      tags: [],
      color: "#3B82F6",
    };

    it("zapisuje wydarzenie w pliku miesiąca (happy path)", async () => {
      const created = await createCalendarEvent(input);

      expect(readList(FEB, "events")).toEqual([
        {
          id: created.id,
          date: "2025-02-20",
          start_minutes: 540,
          duration_minutes: 60,
          title: "Meeting",
          tags: [],
          color: "#3B82F6",
          type: "work",
          created: expect.any(String),
        },
      ]);
    });

    it("given duration_minutes not a multiple of 15, when createCalendarEvent is called, then rejects and writes nothing", async () => {
      const call = createCalendarEvent({ ...input, duration_minutes: 25 });

      await expect(call).rejects.toBeInstanceOf(DomainError);
      await expect(call).rejects.toThrow("duration_minutes must be a multiple of 15");
      expect(vault.read(FEB)).toBeNull();
    });
  });

  describe("updateCalendarEvent", () => {
    it("zmienia tytuł wydarzenia w pliku, reszta pól bez zmian (happy path)", async () => {
      seedEvents(FEB, [calendarEvent({ id: "e1" })]);

      await updateCalendarEvent("e1", { title: "Updated" });

      expect(readList(FEB, "events")).toEqual([
        { ...calendarEvent({ id: "e1" }), title: "Updated", updated: expect.any(String) },
      ]);
    });

    it("given duration_minutes not a multiple of 15, when updateCalendarEvent is called, then rejects and leaves the file unchanged", async () => {
      seedEvents(FEB, [calendarEvent({ id: "e1" })]);
      const before = vault.read(FEB);

      await expect(updateCalendarEvent("e1", { duration_minutes: 20 })).rejects.toThrow(
        "duration_minutes must be a multiple of 15"
      );
      expect(vault.read(FEB)).toBe(before);
    });

    it("given a patch without duration_minutes, when updateCalendarEvent is called, then the rule does not fire", async () => {
      seedEvents(FEB, [calendarEvent({ id: "e1" })]);

      await updateCalendarEvent("e1", { title: "Nowy" });

      expect(readList(FEB, "events")[0]).toMatchObject({ id: "e1", title: "Nowy" });
    });
  });

  describe("deleteCalendarEvent", () => {
    it("usuwa wydarzenie z pliku (happy path)", async () => {
      seedEvents(FEB, [calendarEvent({ id: "e1" }), calendarEvent({ id: "e2", title: "Zostaje" })]);

      await deleteCalendarEvent("e1");

      expect(readList(FEB, "events")).toEqual([
        { ...calendarEvent({ id: "e2", title: "Zostaje" }) },
      ]);
    });
  });

  describe("tagi wydarzeń", () => {
    const base = {
      date: "2026-11-18",
      start_minutes: 540,
      duration_minutes: 60,
      title: "Spotkanie",
      color: "#3B82F6",
    };

    it("createCalendarEvent zapisuje tagi zwrócone przez resolveTags", async () => {
      mockResolveTags.mockResolvedValue(["Agenci AI"]);

      const created = await createCalendarEvent({ ...base, tags: ["agent ai"] });

      expect(mockResolveTags).toHaveBeenCalledWith(["agent ai"]);
      expect(readList(NOV, "events")).toEqual([
        expect.objectContaining({ id: created.id, tags: ["Agenci AI"] }),
      ]);
    });

    it("updateCalendarEvent z tags zapisuje tagi zwrócone przez resolveTags", async () => {
      seedEvents(NOV, [calendarEvent({ id: "e1", date: "2026-11-18", tags: ["stary"] })]);
      mockResolveTags.mockResolvedValue(["Praca własna"]);

      await updateCalendarEvent("e1", { tags: ["Projekty"] });

      expect(mockResolveTags).toHaveBeenCalledWith(["Projekty"]);
      expect(readList(NOV, "events")[0]).toMatchObject({ id: "e1", tags: ["Praca własna"] });
    });

    it("updateCalendarEvent bez tags nie woła resolveTags i zostawia zapisane tagi", async () => {
      seedEvents(NOV, [calendarEvent({ id: "e1", date: "2026-11-18", tags: ["stary"] })]);

      await updateCalendarEvent("e1", { title: "Nowy tytuł" });

      expect(mockResolveTags).not.toHaveBeenCalled();
      expect(readList(NOV, "events")[0]).toMatchObject({
        id: "e1",
        title: "Nowy tytuł",
        tags: ["stary"],
      });
    });
  });
});
