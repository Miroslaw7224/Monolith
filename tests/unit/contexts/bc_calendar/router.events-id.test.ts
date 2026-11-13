// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DomainError } from "@/lib/errors";

const mockUpdateCalendarEvent = vi.hoisted(() => vi.fn());
const mockDeleteCalendarEvent = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_calendar/services", () => ({
  updateCalendarEvent: mockUpdateCalendarEvent,
  deleteCalendarEvent: mockDeleteCalendarEvent,
}));

import { PUT, DELETE } from "@/app/api/calendar/events/[id]/route";

const params = Promise.resolve({ id: "e1" });

const request = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/calendar/events/e1", {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  mockUpdateCalendarEvent.mockReset();
  mockDeleteCalendarEvent.mockReset();
});

describe("PUT /api/calendar/events/[id]", () => {
  it("przekazuje pola do serwisu i zwraca success", async () => {
    mockUpdateCalendarEvent.mockResolvedValue(undefined);
    const res = await PUT(request("PUT", { title: "Nowy", duration_minutes: 45 }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith("e1", {
      title: "Nowy",
      duration_minutes: 45,
    });
  });

  it("zachowuje meeting, nieznany typ zamienia na work, brak typu zostaje undefined", async () => {
    mockUpdateCalendarEvent.mockResolvedValue(undefined);
    await PUT(request("PUT", { type: "meeting" }), { params });
    await PUT(request("PUT", { type: "foo" }), { params });
    await PUT(request("PUT", { title: "x" }), { params });
    expect(mockUpdateCalendarEvent.mock.calls.map((c) => c[1].type)).toEqual([
      "meeting",
      "work",
      undefined,
    ]);
  });

  it("zwraca 400 dla niepoprawnego JSON", async () => {
    const res = await PUT(request("PUT", "{nie-json"), { params });
    expect(res.status).toBe(400);
    expect(mockUpdateCalendarEvent).not.toHaveBeenCalled();
  });

  it("mapuje błąd domeny na jego status", async () => {
    mockUpdateCalendarEvent.mockRejectedValue(new DomainError("Calendar event not found", 404));
    const res = await PUT(request("PUT", { title: "x" }), { params });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/calendar/events/[id]", () => {
  it("usuwa zdarzenie i zwraca success", async () => {
    mockDeleteCalendarEvent.mockResolvedValue(undefined);
    const res = await DELETE(request("DELETE"), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("e1");
  });

  it("mapuje błąd domeny na jego status", async () => {
    mockDeleteCalendarEvent.mockRejectedValue(new DomainError("brak", 404));
    const res = await DELETE(request("DELETE"), { params });
    expect(res.status).toBe(404);
  });
});
