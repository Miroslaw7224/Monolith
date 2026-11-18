// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchReviewRequests = vi.hoisted(() => vi.fn());
const mockFetchMyReviews = vi.hoisted(() => vi.fn());
const mockFetchMyOpenPrs = vi.hoisted(() => vi.fn());
vi.mock("@/lib/github/review-requests", () => ({ fetchReviewRequests: mockFetchReviewRequests }));
vi.mock("@/lib/github/my-reviews", () => ({ fetchMyReviews: mockFetchMyReviews }));
vi.mock("@/lib/github/my-open-prs", () => ({ fetchMyOpenPrs: mockFetchMyOpenPrs }));

import { loadMyReviews, loadOpenPrs, loadReviewRequests } from "@/contexts/bc_cockpit/repositories";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadReviewRequests", () => {
  it("ok: kopiuje pola do modelu, available true", async () => {
    const item = {
      repo: "o/r",
      number: 5,
      title: "Tytuł",
      author: "ktoś",
      url: "https://github.com/o/r/pull/5",
      updatedAt: "2026-11-16T05:58:28Z",
      state: "merged",
    };
    mockFetchReviewRequests.mockResolvedValue({ ok: true, items: [item] });
    expect(await loadReviewRequests()).toEqual({ available: true, total: 1, items: [item] });
  });

  it.each(["gh-missing", "gh-error"])("%s to available false z pustą listą", async (reason) => {
    mockFetchReviewRequests.mockResolvedValue({ ok: false, reason });
    expect(await loadReviewRequests()).toEqual({ available: false, total: 0, items: [] });
  });
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
