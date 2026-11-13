// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DomainError } from "@/lib/errors";

const mockGetCalendarEvents = vi.hoisted(() => vi.fn());
const mockCreateCalendarEvent = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_calendar/services", () => ({
  getCalendarEvents: mockGetCalendarEvents,
  createCalendarEvent: mockCreateCalendarEvent,
}));

import { GET, POST } from "@/app/api/calendar/events/route";

const EVENT = {
  id: "e1",
  date: "2026-11-13",
  start_minutes: 540,
  duration_minutes: 60,
  title: "Praca",
  tags: ["a"],
  color: "#111111",
  type: "work" as const,
  created_at: "2026-11-13T08:00:00.000Z",
};

const get = (query = "") => new NextRequest(`http://localhost/api/calendar/events${query}`);
const post = (body: unknown) =>
  new NextRequest("http://localhost/api/calendar/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  mockGetCalendarEvents.mockReset();
  mockCreateCalendarEvent.mockReset();
});

describe("GET /api/calendar/events", () => {
  it("bez parametrów woła serwis z pustym zakresem i zwraca listę", async () => {
    mockGetCalendarEvents.mockResolvedValue([EVENT]);
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([EVENT]);
    expect(mockGetCalendarEvents).toHaveBeenCalledWith({
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("przekazuje startDate i endDate z query", async () => {
    mockGetCalendarEvents.mockResolvedValue([]);
    await GET(get("?startDate=2026-11-01&endDate=2026-11-30"));
    expect(mockGetCalendarEvents).toHaveBeenCalledWith({
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });
  });

  it("zachowuje wirtualne task_deadline bez created_at", async () => {
    const deadline = {
      id: "task:t1",
      date: "2026-11-13",
      start_minutes: 1410,
      duration_minutes: 30,
      title: "Termin",
      tags: [],
      color: "#6B7280",
      type: "task_deadline" as const,
    };
    mockGetCalendarEvents.mockResolvedValue([deadline]);
    const res = await GET(get());
    expect(await res.json()).toEqual([deadline]);
  });

  it("mapuje błąd domeny na jego status", async () => {
    mockGetCalendarEvents.mockRejectedValue(new DomainError("zła data", 400));
    const res = await GET(get());
    expect(res.status).toBe(400);
  });
});

describe("POST /api/calendar/events", () => {
  it("przekazuje pełne body do serwisu i zwraca utworzone zdarzenie", async () => {
    mockCreateCalendarEvent.mockResolvedValue({ ...EVENT, type: "meeting" });
    const res = await POST(
      post({
        date: "2026-11-13",
        start_minutes: 540,
        duration_minutes: 60,
        title: "Spotkanie",
        tags: ["a"],
        color: "#111111",
        type: "meeting",
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...EVENT, type: "meeting" });
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith({
      date: "2026-11-13",
      start_minutes: 540,
      duration_minutes: 60,
      title: "Spotkanie",
      tags: ["a"],
      color: "#111111",
      type: "meeting",
    });
  });

  it("stosuje domyślne: tytuł pusty, tags [], kolor #3B82F6, typ work", async () => {
    mockCreateCalendarEvent.mockResolvedValue(EVENT);
    await POST(post({ date: "2026-11-13", start_minutes: 0, duration_minutes: 30 }));
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith({
      date: "2026-11-13",
      start_minutes: 0,
      duration_minutes: 30,
      title: "",
      tags: [],
      color: "#3B82F6",
      type: "work",
    });
  });

  it("zamienia pojedynczy tag w tablicę i nieznany typ na work", async () => {
    mockCreateCalendarEvent.mockResolvedValue(EVENT);
    await POST(
      post({ date: "2026-11-13", start_minutes: 0, duration_minutes: 30, tags: "a", type: "foo" })
    );
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["a"], type: "work" })
    );
  });

  it.each([[{ duration_minutes: 30 }], [{ date: "2026-11-13" }]])(
    "zwraca 400, gdy brakuje date albo duration_minutes (%j)",
    async (body) => {
      const res = await POST(post(body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "date and duration_minutes required" });
      expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
    }
  );

  it("zwraca 400 dla niepoprawnego JSON", async () => {
    const res = await POST(post("{nie-json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("mapuje błąd domeny serwisu na jego status", async () => {
    mockCreateCalendarEvent.mockRejectedValue(
      new DomainError("duration_minutes must be a multiple of 15", 400)
    );
    const res = await POST(post({ date: "2026-11-13", start_minutes: 0, duration_minutes: 25 }));
    expect(res.status).toBe(400);
  });
});
