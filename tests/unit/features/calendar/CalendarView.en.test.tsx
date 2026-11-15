import React from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CalendarView } from "@/src/features/calendar/CalendarView";
import { setLanguage } from "@/src/i18n";

const apiFetch = vi.fn();

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

beforeEach(() => {
  apiFetch.mockResolvedValue({ ok: true, json: async () => [] });
});

describe("CalendarView po angielsku", () => {
  test("podtytuł EN / PL", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<CalendarView apiFetch={apiFetch} />);
    expect(screen.getByText(/full-time job and projects in one schedule/)).toBeInTheDocument();

    await act(async () => {
      await setLanguage("pl");
    });
    expect(screen.getByText(/etat i projekty w jednym planie/)).toBeInTheDocument();
  });

  test("skrót niedzieli w widoku tygodnia PL / EN", async () => {
    await act(async () => {
      await setLanguage("pl");
    });
    render(<CalendarView apiFetch={apiFetch} />);
    const weekPl = await screen.findByLabelText("Tydzień");
    expect(within(weekPl).getByText(/^nd/)).toBeInTheDocument();

    await act(async () => {
      await setLanguage("en");
    });
    const weekEn = await screen.findByLabelText("Week");
    expect(within(weekEn).getByText(/^sun/)).toBeInTheDocument();
  });
});
