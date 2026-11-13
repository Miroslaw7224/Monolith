// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/errors";

const mockGetCockpit = vi.hoisted(() => vi.fn());
const mockSetPinned = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_cockpit/services", () => ({
  getCockpit: mockGetCockpit,
  setPinned: mockSetPinned,
}));

import { getCockpit, putPinned } from "@/contexts/bc_cockpit/router";

const put = (body: unknown) =>
  new NextRequest("http://localhost/api/cockpit/pinned", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/cockpit", () => {
  it("200 z DTO", async () => {
    mockGetCockpit.mockResolvedValue({
      date: "2026-11-13",
      topics: [],
      queue: [],
      events: [],
      nextMeeting: null,
      warnings: ["x"],
    });
    const res = await getCockpit();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      date: "2026-11-13",
      topics: [],
      queue: [],
      events: [],
      nextMeeting: null,
      warnings: ["x"],
    });
  });

  it("nieoczekiwany wyjątek to 500 przez handleServiceError", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCockpit.mockRejectedValue(new Error("boom"));
    expect((await getCockpit()).status).toBe(500);
  });
});

describe("PUT /api/cockpit/pinned", () => {
  it("200 i zwraca zapisaną listę", async () => {
    mockSetPinned.mockResolvedValue({ ids: ["nexus"] });
    const res = await putPinned(put({ ids: ["nexus"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ids: ["nexus"] });
    expect(mockSetPinned).toHaveBeenCalledWith(["nexus"]);
  });

  it.each([
    ["4 id", { ids: ["a", "b", "c", "d"] }],
    ["duplikaty", { ids: ["a", "a"] }],
    ["brak ids", {}],
    ["zły JSON", "{nie json"],
  ])("400 dla: %s, serwis nie jest wołany", async (_name, body) => {
    const res = await putPinned(put(body));
    expect(res.status).toBe(400);
    expect(mockSetPinned).not.toHaveBeenCalled();
  });

  it("ConflictError z yaml-store (wyczerpane ponowienia) to 409", async () => {
    mockSetPinned.mockRejectedValue(new ConflictError("Plik zmienił się w międzyczasie"));
    const res = await putPinned(put({ ids: ["nexus"] }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Plik zmienił się w międzyczasie" });
  });
});
