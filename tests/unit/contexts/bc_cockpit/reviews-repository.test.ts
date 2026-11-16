// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchReviewRequests = vi.hoisted(() => vi.fn());
vi.mock("@/lib/github/review-requests", () => ({ fetchReviewRequests: mockFetchReviewRequests }));

import { loadReviewRequests } from "@/contexts/bc_cockpit/repositories";

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
