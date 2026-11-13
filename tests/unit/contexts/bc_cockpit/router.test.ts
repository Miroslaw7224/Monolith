// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/errors";

const mockGetCockpit = vi.hoisted(() => vi.fn());
const mockSetPinned = vi.hoisted(() => vi.fn());
const mockCloseDay = vi.hoisted(() => vi.fn());
const mockGetCommitHistory = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_cockpit/services", () => ({
  getCockpit: mockGetCockpit,
  setPinned: mockSetPinned,
  closeDay: mockCloseDay,
  getCommitHistory: mockGetCommitHistory,
}));

import { getCockpit, getCommits, putClosing, putPinned } from "@/contexts/bc_cockpit/router";

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
      git: null,
      inbox: null,
      closing: { anchor: null, today: null },
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
      git: null,
      inbox: null,
      closing: { anchor: null, today: null },
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

describe("PUT /api/cockpit/closing", () => {
  const putC = (body: unknown) =>
    new NextRequest("http://localhost/api/cockpit/closing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("200 i zwraca zapisany wpis", async () => {
    const saved = { date: "2026-11-13", text: "Jutro K6", projectId: "nexus", commits: 3 };
    mockCloseDay.mockResolvedValue(saved);
    const res = await putClosing(putC({ text: " Jutro K6 ", projectId: "nexus" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(saved);
    expect(mockCloseDay).toHaveBeenCalledWith({ text: "Jutro K6", projectId: "nexus" });
  });

  it("brak projectId trafia do serwisu jako null", async () => {
    mockCloseDay.mockResolvedValue({ date: "d", text: "t", projectId: null, commits: null });
    await putClosing(putC({ text: "t" }));
    expect(mockCloseDay).toHaveBeenCalledWith({ text: "t", projectId: null });
  });

  it.each([
    ["pusty tekst", { text: " " }],
    ["brak tekstu", {}],
    ["zły JSON", "{nie json"],
  ])("400 dla: %s, serwis nie jest wołany", async (_n, body) => {
    expect((await putClosing(putC(body))).status).toBe(400);
    expect(mockCloseDay).not.toHaveBeenCalled();
  });
});

describe("GET /api/cockpit/commits", () => {
  const get = (qs = "") => new NextRequest(`http://localhost/api/cockpit/commits${qs}`);
  const history = { from: "a", to: "b", available: true, total: 0, totalPrs: 0, days: [] };

  it("domyślnie 14 dni", async () => {
    mockGetCommitHistory.mockResolvedValue(history);
    const res = await getCommits(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(history);
    expect(mockGetCommitHistory).toHaveBeenCalledWith(14);
  });

  it("przekazuje ?days=30", async () => {
    mockGetCommitHistory.mockResolvedValue(history);
    await getCommits(get("?days=30"));
    expect(mockGetCommitHistory).toHaveBeenCalledWith(30);
  });

  it.each(["?days=0", "?days=abc", "?days=91", "?days=2.5"])("400 dla %s", async (qs) => {
    expect((await getCommits(get(qs))).status).toBe(400);
    expect(mockGetCommitHistory).not.toHaveBeenCalled();
  });
});
