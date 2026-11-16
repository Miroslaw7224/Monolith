import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { setLanguage } from "@/src/i18n";
import { WeekReview } from "@/src/features/home/WeekReview";

const REVIEW = {
  from: "2026-11-10",
  to: "2026-11-16",
  weekStart: "2026-11-16",
  git: { available: true, commits: 5, prs: 1 },
  projects: [
    {
      projectId: "m",
      name: "Monolith",
      work: false,
      commits: 5,
      prs: 1,
      subjects: [],
      doneTasks: [],
    },
  ],
  closings: [],
  reviews: { available: true, approved: 1, comments: 1, prs: 2 },
  meetings: { count: 3, minutes: 180 },
  containsWork: false,
  prompt: "# P",
};

describe("WeekReview po angielsku", () => {
  afterEach(async () => {
    cleanup();
    await act(async () => {
      await setLanguage("pl");
    });
  });

  test("tytuł, przyciski i podsumowania po angielsku", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const apiFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => REVIEW });
    render(
      <WeekReview
        apiFetch={apiFetch}
        focus={null}
        onChangeActive={vi.fn()}
        onFocusSaved={vi.fn()}
      />
    );
    expect(screen.getByText("Week review")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(await screen.findByText("commits 5 · PRs 1")).toBeTruthy();
    expect(screen.getByText("Reviews: approved 1, comments 1, PRs 2")).toBeTruthy();
    expect(screen.getByText("Meetings: 3 (180 min)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy prompt for agent" })).toBeTruthy();
    expect(screen.getByLabelText("Focus for this week")).toBeTruthy();
  });
});
