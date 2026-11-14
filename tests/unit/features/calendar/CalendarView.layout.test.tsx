import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CalendarView } from "@/src/features/calendar/CalendarView";
import { toYmd } from "@/src/features/calendar/calendarUtils";

const apiFetch = vi.fn();
const today = toYmd(new Date());

const meeting = {
  id: "ev-1",
  date: today,
  start_minutes: 23 * 60 + 30,
  duration_minutes: 20,
  title: "Przegląd tygodnia",
  tags: ["nexus"],
  color: "#6b8cff",
  type: "meeting",
  link: "https://example.com/spotkanie",
  brief: "- Wybrać focus\n- Zadania GP-002",
};

afterEach(cleanup);

beforeEach(() => {
  apiFetch.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/cockpit")) {
      return {
        ok: true,
        json: async () => ({
          windows: [
            {
              startMinutes: 23 * 60 + 50,
              endMinutes: 24 * 60 - 1,
              energy: "deep",
              title: "Porty V2",
              projectName: null,
            },
          ],
        }),
      };
    }
    return { ok: true, json: async () => [meeting] };
  });
});

test("tydzień: kafle, siatka z dzisiejszym dniem i zakładki widoków", async () => {
  render(<CalendarView apiFetch={apiFetch} lang="pl" t={{}} />);

  expect(await screen.findByLabelText("Liczby tygodnia")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /Przegląd tygodnia/ })).toBeInTheDocument();
  expect(screen.getAllByText(/· dziś/).length).toBeGreaterThan(0);
  expect(screen.getByRole("tab", { name: "Tydzień" })).toHaveAttribute("aria-selected", "true");
});

test("klik w wydarzenie pokazuje szczegóły z briefem i linkiem do spotkania", async () => {
  const user = userEvent.setup();
  render(<CalendarView apiFetch={apiFetch} lang="pl" t={{}} />);

  await user.click(await screen.findByRole("button", { name: /Przegląd tygodnia/ }));

  const detail = screen.getByLabelText("Wybrane wydarzenie");
  expect(within(detail).getByText("Wybrać focus")).toBeInTheDocument();
  expect(within(detail).getByText("Zadania GP-002")).toBeInTheDocument();
  expect(within(detail).getByRole("link", { name: /Dołącz/ })).toHaveAttribute(
    "href",
    "https://example.com/spotkanie"
  );
});

test("agenda wypisuje wydarzenia dnia, a planer pokazuje okno z Kokpitu", async () => {
  const user = userEvent.setup();
  render(<CalendarView apiFetch={apiFetch} lang="pl" t={{}} />);

  await user.click(await screen.findByRole("tab", { name: "Agenda" }));
  expect(screen.getByLabelText("Agenda")).toHaveTextContent("Przegląd tygodnia");
  expect(await screen.findByLabelText("Planer slotów")).toHaveTextContent("Porty V2");
});
