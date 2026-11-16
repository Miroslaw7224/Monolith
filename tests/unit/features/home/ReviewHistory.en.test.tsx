import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { setLanguage } from "@/src/i18n";
import { ReviewHistory } from "@/src/features/home/ReviewHistory";

const HISTORY = {
  from: "2026-11-15",
  to: "2026-11-16",
  available: true,
  approved: 3,
  comments: 3,
  prs: 4,
  days: [
    { date: "2026-11-15", approved: 2, comments: 1 },
    { date: "2026-11-16", approved: 1, comments: 2 },
  ],
};

describe("ReviewHistory po angielsku", () => {
  afterEach(async () => {
    cleanup();
    await act(async () => {
      await setLanguage("pl");
    });
  });

  test("panel: legenda, chip i opisy słupków po angielsku", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const apiFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => HISTORY });
    render(<ReviewHistory apiFetch={apiFetch} day="2026-11-16" />);
    expect(await screen.findByText("Reviews")).toBeTruthy();
    expect(screen.getByText("approved")).toBeTruthy();
    expect(screen.getByText("comments")).toBeTruthy();
    expect(screen.getByText("3 approved · 3 comments · 4 PRs · 2 days")).toBeTruthy();
    expect(screen.getByRole("img", { name: /approved 2, comments 1/ })).toBeTruthy();
  });

  test("błąd HTTP: komunikat po angielsku", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const apiFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<ReviewHistory apiFetch={apiFetch} day="2026-11-16" />);
    expect(await screen.findByText("Could not load from GitHub")).toBeTruthy();
  });
});
