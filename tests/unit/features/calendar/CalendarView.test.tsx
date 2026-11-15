import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { CalendarView } from "@/src/features/calendar/CalendarView";
import { monthGrid } from "@/src/features/calendar/calendarUtils";

const MONTH_NAMES_PL = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

const apiFetch = vi.fn();

function monthLabel(date: Date) {
  return `${MONTH_NAMES_PL[date.getMonth()]} ${date.getFullYear()}`;
}

function monthRange(date: Date) {
  const { start, end } = monthGrid(date.getFullYear(), date.getMonth());
  return `startDate=${start}&endDate=${end}`;
}

beforeEach(() => {
  apiFetch.mockResolvedValue({ ok: true, json: async () => [] });
});

test("loads the visible month and the next month without posting", async () => {
  const user = userEvent.setup();
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  render(<CalendarView apiFetch={apiFetch} />);

  await waitFor(() => {
    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/calendar/events?${monthRange(now)}`)
    );
  });
  expect(screen.getByText(monthLabel(now))).toBeInTheDocument();

  // Domyślny widok to tydzień; przejście o miesiąc: zakładka Miesiąc + strzałka.
  await user.click(screen.getByRole("tab", { name: "Miesiąc" }));
  await user.click(screen.getByRole("button", { name: "Następny miesiąc" }));

  await waitFor(() => {
    expect(screen.getByText(monthLabel(next))).toBeInTheDocument();
  });
  expect(apiFetch).toHaveBeenCalledWith(
    expect.stringContaining(`/api/calendar/events?${monthRange(next)}`)
  );
  expect(apiFetch.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false);
});
