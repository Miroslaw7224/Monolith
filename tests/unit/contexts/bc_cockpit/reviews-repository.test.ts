// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchReviewRequests = vi.hoisted(() => vi.fn());
const mockFetchReviewedUpdates = vi.hoisted(() => vi.fn());
const mockFetchMyReviews = vi.hoisted(() => vi.fn());
const mockFetchMyOpenPrs = vi.hoisted(() => vi.fn());
vi.mock("@/lib/github/review-requests", () => ({ fetchReviewRequests: mockFetchReviewRequests }));
vi.mock("@/lib/github/reviewed-updates", () => ({
  fetchReviewedUpdates: mockFetchReviewedUpdates,
}));
vi.mock("@/lib/github/my-reviews", () => ({ fetchMyReviews: mockFetchMyReviews }));
vi.mock("@/lib/github/my-open-prs", () => ({ fetchMyOpenPrs: mockFetchMyOpenPrs }));

import { loadMyReviews, loadOpenPrs, loadReviewRequests } from "@/contexts/bc_cockpit/repositories";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadReviewRequests", () => {
  const item = {
    repo: "o/r",
    number: 5,
    title: "Tytuł",
    author: "ktoś",
    url: "https://github.com/o/r/pull/5",
    updatedAt: "2026-11-16T05:58:28Z",
    state: "merged" as const,
  };
  const updated = {
    repo: "x/y",
    number: 9,
    title: "Po review",
    author: "ann",
    url: "https://github.com/x/y/pull/9",
    updatedAt: "2026-11-18T15:31:19.000Z",
  };

  it("ok: prośby dostają reason requested, a PR-y po review reason updated", async () => {
    mockFetchReviewRequests.mockResolvedValue({ ok: true, items: [item] });
    mockFetchReviewedUpdates.mockResolvedValue({ ok: true, items: [updated] });
    expect(await loadReviewRequests()).toEqual({
      available: true,
      updatesAvailable: true,
      total: 2,
      items: [
        { ...item, reason: "requested" },
        { ...updated, state: "open", reason: "updated" },
      ],
    });
  });

  it("PR obecny w obu źródłach zostaje jako requested", async () => {
    mockFetchReviewRequests.mockResolvedValue({ ok: true, items: [{ ...item, state: "open" }] });
    mockFetchReviewedUpdates.mockResolvedValue({
      ok: true,
      items: [{ ...updated, repo: "o/r", number: 5 }],
    });
    const res = await loadReviewRequests();
    expect(res.total).toBe(1);
    expect(res.items.map((i) => i.reason)).toEqual(["requested"]);
  });

  it("błąd „po review” nie ukrywa próśb: updatesAvailable false", async () => {
    mockFetchReviewRequests.mockResolvedValue({ ok: true, items: [item] });
    mockFetchReviewedUpdates.mockResolvedValue({ ok: false, reason: "gh-error" });
    expect(await loadReviewRequests()).toEqual({
      available: true,
      updatesAvailable: false,
      total: 1,
      items: [{ ...item, reason: "requested" }],
    });
  });

  it.each(["gh-missing", "gh-error"])(
    "%s w prośbach to available false z pustą listą",
    async (reason) => {
      mockFetchReviewRequests.mockResolvedValue({ ok: false, reason });
      mockFetchReviewedUpdates.mockResolvedValue({ ok: true, items: [updated] });
      expect(await loadReviewRequests()).toEqual({
        available: false,
        updatesAvailable: false,
        total: 0,
        items: [],
      });
    }
  );
});

describe("loadMyReviews", () => {
  it("ok: kopiuje review, available true; przekazuje updatedSince", async () => {
    const review = {
      repo: "o/r",
      number: 5,
      state: "APPROVED",
      submittedAt: "2026-11-15T18:34:24Z",
    };
    mockFetchMyReviews.mockResolvedValue({ ok: true, reviews: [review] });
    expect(await loadMyReviews("2026-11-09")).toEqual({ available: true, reviews: [review] });
    expect(mockFetchMyReviews).toHaveBeenCalledWith("2026-11-09");
  });

  it.each(["gh-missing", "gh-error"])("%s to available false z pustą listą", async (reason) => {
    mockFetchMyReviews.mockResolvedValue({ ok: false, reason });
    expect(await loadMyReviews("2026-11-09")).toEqual({ available: false, reviews: [] });
  });
});

describe("loadOpenPrs", () => {
  it("ok: kopiuje pola do modelu, available true", async () => {
    const item = {
      repo: "o/r",
      number: 5,
      title: "Tytuł",
      url: "https://github.com/o/r/pull/5",
      updatedAt: "2026-11-16T05:58:28Z",
      draft: true,
    };
    mockFetchMyOpenPrs.mockResolvedValue({ ok: true, items: [item] });
    expect(await loadOpenPrs()).toEqual({ available: true, total: 1, items: [item] });
  });

  it.each(["gh-missing", "gh-error"])("%s to available false z pustą listą", async (reason) => {
    mockFetchMyOpenPrs.mockResolvedValue({ ok: false, reason });
    expect(await loadOpenPrs()).toEqual({ available: false, total: 0, items: [] });
  });
});
