// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/errors";

const mockGetCockpit = vi.hoisted(() => vi.fn());
const mockSetPinned = vi.hoisted(() => vi.fn());
const mockCloseDay = vi.hoisted(() => vi.fn());
const mockCompleteQueueItem = vi.hoisted(() => vi.fn());
const mockSetQueueItemEnergy = vi.hoisted(() => vi.fn());
const mockGetCommitHistory = vi.hoisted(() => vi.fn());
const mockGetReviewRequests = vi.hoisted(() => vi.fn());
const mockGetOpenPrs = vi.hoisted(() => vi.fn());
const mockGetReviewHistory = vi.hoisted(() => vi.fn());
const mockGetWeekReview = vi.hoisted(() => vi.fn());
const mockSetWeekFocus = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_cockpit/services", () => ({
  getCockpit: mockGetCockpit,
  setPinned: mockSetPinned,
  closeDay: mockCloseDay,
  completeQueueItem: mockCompleteQueueItem,
  setQueueItemEnergy: mockSetQueueItemEnergy,
  getCommitHistory: mockGetCommitHistory,
  getReviewRequests: mockGetReviewRequests,
  getOpenPrs: mockGetOpenPrs,
  getReviewHistory: mockGetReviewHistory,
  getWeekReview: mockGetWeekReview,
  setWeekFocus: mockSetWeekFocus,
}));

import {
  completeQueueItem,
  setQueueEnergy,
  getCockpit,
  getCommits,
  getReviewRequests,
  getOpenPrs,
  getReviewHistory,
  getWeekReview,
  putWeekFocus,
  putClosing,
  putPinned,
} from "@/contexts/bc_cockpit/router";

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
      pinnedIds: [],
      queue: [],
      events: [],
      nextMeeting: null,
      git: null,
      inbox: null,
      windows: [],
      closing: { anchor: null, today: null },
      weekFocus: null,
      warnings: ["x"],
    });
    const res = await getCockpit();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      date: "2026-11-13",
      topics: [],
      pinnedIds: [],
      queue: [],
      events: [],
      nextMeeting: null,
      git: null,
      inbox: null,
      windows: [],
      closing: { anchor: null, today: null },
      weekFocus: null,
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

  it("domyślnie 7 dni", async () => {
    mockGetCommitHistory.mockResolvedValue(history);
    const res = await getCommits(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(history);
    expect(mockGetCommitHistory).toHaveBeenCalledWith(7);
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

describe("GET /api/cockpit/reviews", () => {
  const item = {
    repo: "o/r",
    number: 1,
    title: "t",
    author: "a",
    url: "https://github.com/o/r/pull/1",
    updatedAt: "2026-11-16T05:58:28Z",
    state: "merged" as const,
  };

  it("200 z DTO", async () => {
    mockGetReviewRequests.mockResolvedValue({ available: true, total: 9, items: [item] });
    const res = await getReviewRequests();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: true, total: 9, items: [item] });
  });

  it("200 i available false, gdy GitHub niedostępny (nie 500)", async () => {
    mockGetReviewRequests.mockResolvedValue({ available: false, total: 0, items: [] });
    const res = await getReviewRequests();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false, total: 0, items: [] });
  });
});

describe("GET /api/cockpit/open-prs", () => {
  const item = {
    repo: "o/r",
    number: 1,
    title: "t",
    url: "https://github.com/o/r/pull/1",
    updatedAt: "2026-11-16T05:58:28Z",
    draft: false,
  };

  it("200 z DTO", async () => {
    mockGetOpenPrs.mockResolvedValue({ available: true, total: 9, items: [item] });
    const res = await getOpenPrs();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: true, total: 9, items: [item] });
  });

  it("200 i available false, gdy GitHub niedostępny (nie 500)", async () => {
    mockGetOpenPrs.mockResolvedValue({ available: false, total: 0, items: [] });
    const res = await getOpenPrs();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false, total: 0, items: [] });
  });
});

describe("GET /api/cockpit/review-history", () => {
  const get = (qs = "") => new NextRequest(`http://localhost/api/cockpit/review-history${qs}`);
  const history = {
    from: "a",
    to: "b",
    available: true,
    approved: 1,
    comments: 2,
    prs: 3,
    days: [],
  };

  it("domyślnie 7 dni, 200 z DTO", async () => {
    mockGetReviewHistory.mockResolvedValue(history);
    const res = await getReviewHistory(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(history);
    expect(mockGetReviewHistory).toHaveBeenCalledWith(7);
  });

  it("przekazuje ?days=30", async () => {
    mockGetReviewHistory.mockResolvedValue(history);
    await getReviewHistory(get("?days=30"));
    expect(mockGetReviewHistory).toHaveBeenCalledWith(30);
  });

  it.each(["?days=0", "?days=abc", "?days=91", "?days=2.5"])("400 dla %s", async (qs) => {
    expect((await getReviewHistory(get(qs))).status).toBe(400);
    expect(mockGetReviewHistory).not.toHaveBeenCalled();
  });

  it("200 i available false, gdy GitHub niedostępny (nie 500)", async () => {
    const down = { ...history, available: false, approved: 0, comments: 0, prs: 0 };
    mockGetReviewHistory.mockResolvedValue(down);
    const res = await getReviewHistory(get());
    expect(res.status).toBe(200);
    expect((await res.json()).available).toBe(false);
  });
});

describe("POST /api/cockpit/queue/complete", () => {
  const postC = (body: unknown) =>
    new NextRequest("http://localhost/api/cockpit/queue/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("200 i wywołuje serwis ze źródłem zadania", async () => {
    mockCompleteQueueItem.mockResolvedValue(undefined);
    const res = await completeQueueItem(postC({ type: "task", taskId: "t1" }));
    expect(res.status).toBe(200);
    expect(mockCompleteQueueItem).toHaveBeenCalledWith({ type: "task", taskId: "t1" });
    await completeQueueItem(postC({ type: "project", projectId: "p", text: "Zrób #deep" }));
    expect(mockCompleteQueueItem).toHaveBeenLastCalledWith({
      type: "project",
      projectId: "p",
      text: "Zrób #deep",
      occurrence: 0,
    });
  });

  it.each([
    ["brak pól", {}],
    ["projekt bez tekstu", { type: "project", projectId: "p" }],
    ["zły JSON", "{x"],
  ])("400 dla: %s", async (_n, body) => {
    expect((await completeQueueItem(postC(body))).status).toBe(400);
    expect(mockCompleteQueueItem).not.toHaveBeenCalled();
  });

  it("ConflictError to 409, NotFoundError to 404", async () => {
    mockCompleteQueueItem.mockRejectedValueOnce(new ConflictError("Zadanie zmieniło się w pliku"));
    expect((await completeQueueItem(postC({ type: "task", taskId: "t" }))).status).toBe(409);
    mockCompleteQueueItem.mockRejectedValueOnce(new NotFoundError("Nie ma"));
    expect((await completeQueueItem(postC({ type: "task", taskId: "t" }))).status).toBe(404);
  });
});

describe("POST /api/cockpit/queue/energy", () => {
  const postE = (body: unknown) =>
    new NextRequest("http://localhost/api/cockpit/queue/energy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("200 i wywołuje serwis ze źródłem i energią (także null)", async () => {
    mockSetQueueItemEnergy.mockResolvedValue({ type: "task", taskId: "t1" });
    const res = await setQueueEnergy(postE({ type: "task", taskId: "t1", energy: "deep" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, source: { type: "task", taskId: "t1" } });
    expect(mockSetQueueItemEnergy).toHaveBeenCalledWith({ type: "task", taskId: "t1" }, "deep");
    await setQueueEnergy(postE({ type: "project", projectId: "p", text: "Zrób", energy: null }));
    expect(mockSetQueueItemEnergy).toHaveBeenLastCalledWith(
      { type: "project", projectId: "p", text: "Zrób", occurrence: 0 },
      null
    );
  });

  it.each([
    ["brak energii", { type: "task", taskId: "t" }],
    ["zła energia", { type: "task", taskId: "t", energy: "slow" }],
    ["projekt bez tekstu", { type: "project", projectId: "p", energy: "deep" }],
    ["zły JSON", "{x"],
  ])("400 dla: %s", async (_n, body) => {
    mockSetQueueItemEnergy.mockClear();
    expect((await setQueueEnergy(postE(body))).status).toBe(400);
    expect(mockSetQueueItemEnergy).not.toHaveBeenCalled();
  });

  it("ConflictError to 409", async () => {
    mockSetQueueItemEnergy.mockRejectedValueOnce(new ConflictError("Zadanie zmieniło się w pliku"));
    const res = await setQueueEnergy(postE({ type: "task", taskId: "t", energy: "deep" }));
    expect(res.status).toBe(409);
  });
});

describe("GET /api/cockpit/week-review", () => {
  it("200 z zestawieniem", async () => {
    mockGetWeekReview.mockResolvedValue({
      from: "2026-11-10",
      to: "2026-11-16",
      weekStart: "2026-11-16",
      git: { available: false, commits: 0, prs: 0 },
      projects: [],
      closings: [],
      reviews: { available: false, approved: 0, comments: 0, prs: 0 },
      meetings: { count: 0, minutes: 0 },
      containsWork: false,
      prompt: "# P",
    });
    const res = await getWeekReview();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.git.available).toBe(false);
    expect(body.prompt).toBe("# P");
  });

  it("błąd serwisu przechodzi przez handleServiceError", async () => {
    mockGetWeekReview.mockRejectedValue(new ConflictError("x"));
    expect((await getWeekReview()).status).toBe(409);
  });
});

describe("PUT /api/cockpit/week-focus", () => {
  it("zapisuje focus i zwraca go", async () => {
    mockSetWeekFocus.mockResolvedValue({ weekStart: "2026-11-16", text: "Tagi" });
    const res = await putWeekFocus(put({ text: "Tagi" }));
    expect(res.status).toBe(200);
    expect(mockSetWeekFocus).toHaveBeenCalledWith({ text: "Tagi" });
    expect(await res.json()).toEqual({ weekStart: "2026-11-16", text: "Tagi" });
  });

  it("puste ciało i pusty tekst to 400", async () => {
    expect((await putWeekFocus(put({}))).status).toBe(400);
    expect((await putWeekFocus(put({ text: "  " }))).status).toBe(400);
    expect(mockSetWeekFocus).not.toHaveBeenCalled();
  });
});
