import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi, beforeEach, test, expect } from "vitest";
import HomeView from "@/src/features/home/HomeView";
import { translations } from "@/src/translations";
import type { CockpitDto } from "@/contexts/bc_cockpit/schemas";

vi.mock("@/src/components/sessions/ActivityLog", () => ({
  ActivityLog: () => <div data-testid="activity-log" />,
}));
vi.mock("@/src/components/layout/AppHeader", () => ({
  AppHeader: () => <div data-testid="header" />,
}));

const t = translations["pl"];

const EMPTY: CockpitDto = { date: "2026-11-13", topics: [], queue: [], events: [], warnings: [] };

const FULL: CockpitDto = {
  date: "2026-11-13",
  topics: [
    {
      id: "nexus",
      name: "NEXUS",
      owner: "personal",
      freshness: "fresh",
      source: "state",
      nextStep: "Napisać plan 2-1",
      blocker: "Brak decyzji o energii",
      whereIStopped: null,
    },
    {
      id: "firma",
      name: "Projekt firmowy",
      owner: "work",
      freshness: "stale",
      source: "index",
      nextStep: null,
      blocker: null,
      whereIStopped: "Skończyłem na raporcie",
    },
  ],
  queue: [
    {
      projectId: null,
      name: "Ogólne",
      owner: "personal",
      items: [
        { kind: "overdue", title: "Zaległa faktura", due: "2026-11-10" },
        { kind: "today", title: "Wysłać wniosek", due: "2026-11-13" },
      ],
    },
    {
      projectId: "firma",
      name: "Projekt firmowy",
      owner: "work",
      items: [{ kind: "now", title: "Przejrzeć raport", due: null }],
    },
  ],
  events: [
    {
      id: "e1",
      title: "Spotkanie zespołu",
      startMinutes: 570,
      durationMinutes: 30,
      type: "meeting",
      color: "#111",
    },
  ],
  warnings: ['Zadanie "Stare": pominięto błędny termin 0006-08-26'],
};

const mockApiFetch = vi.fn();

function respond(cockpit: CockpitDto | "fail") {
  mockApiFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/cockpit") {
      return cockpit === "fail"
        ? Promise.resolve({ ok: false, status: 500, json: async () => ({ error: "boom" }) })
        : Promise.resolve({ ok: true, json: async () => cockpit });
    }
    if (url === "/api/projects") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          projects: [
            { id: "nexus", name: "NEXUS", status: "active", owner: "personal" },
            { id: "firma", name: "Projekt firmowy", status: "active", owner: "work" },
            { id: "monolith", name: "Monolith", status: "active", owner: "personal" },
            { id: "inny", name: "Inny", status: "active", owner: "personal" },
          ],
          warnings: [],
        }),
      });
    }
    if (url === "/api/cockpit/pinned" && init?.method === "PUT") {
      return Promise.resolve({ ok: true, json: async () => ({ ids: [] }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

const defaultProps = {
  apiFetch: mockApiFetch,
  lang: "pl" as const,
  t,
  appMode: "home" as const,
  setAppMode: vi.fn(),
  planningTab: "tasks" as const,
  setPlanningTab: vi.fn(),
  setLang: vi.fn(),
};

beforeEach(() => {
  mockApiFetch.mockReset();
  respond(EMPTY);
});

afterEach(() => cleanup());

test("pokazuje aktywne tematy: nazwa, następny krok i blokadę", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("NEXUS")).toBeInTheDocument();
  expect(screen.getByText("Napisać plan 2-1")).toBeInTheDocument();
  expect(screen.getByText("Brak decyzji o energii")).toBeInTheDocument();
  expect(screen.getByText("Skończyłem na raporcie")).toBeInTheDocument();
});

test("pusty stan tematów: Przypnij projekty", async () => {
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("Przypnij projekty")).toBeInTheDocument();
});

test("znacznik „Dane z firmy” przy temacie i grupie kolejki oraz „do sprawdzenia” przy starych danych", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");
  expect(screen.getAllByText("Dane z firmy")).toHaveLength(2);
  expect(screen.getAllByText("do sprawdzenia")).toHaveLength(1);
});

test("kolejka: grupy, zaległe z datą, bez znacznika firmy dla ogólnych", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("Zaległa faktura")).toBeInTheDocument();
  expect(screen.getByText("2026-11-10")).toBeInTheDocument();
  expect(screen.getByText("Wysłać wniosek")).toBeInTheDocument();
  expect(screen.getByText("Ogólne")).toBeInTheDocument();
  expect(screen.getByText("Przejrzeć raport")).toBeInTheDocument();
});

test("oś dnia: godzina i tytuł; pusty stan", async () => {
  respond(FULL);
  const { unmount } = render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("Spotkanie zespołu")).toBeInTheDocument();
  expect(screen.getByText("09:30")).toBeInTheDocument();
  unmount();

  respond(EMPTY);
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("Brak wydarzeń na dziś")).toBeInTheDocument();
});

test("pokazuje ostrzeżenia z serwera", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  expect(
    await screen.findByText('Zadanie "Stare": pominięto błędny termin 0006-08-26')
  ).toBeInTheDocument();
});

test("błąd GET /api/cockpit: komunikat, a ActivityLog nadal jest", async () => {
  respond("fail");
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText(/Nie udało się wczytać Kokpitu/)).toBeInTheDocument();
  expect(screen.getByTestId("activity-log")).toBeInTheDocument();
});

test("ActivityLog jest renderowany pod sekcjami", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");
  expect(screen.getByTestId("activity-log")).toBeInTheDocument();
});

test("„Zmień aktywne”: wybór, zapis PUT i odświeżenie Kokpitu", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");

  fireEvent.click(screen.getByRole("button", { name: "Zmień aktywne" }));
  const monolith = await screen.findByLabelText("Monolith");
  fireEvent.click(monolith);
  fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));

  await waitFor(() => {
    const put = mockApiFetch.mock.calls.find(
      ([url, init]) => url === "/api/cockpit/pinned" && init?.method === "PUT"
    );
    expect(put).toBeTruthy();
    expect(JSON.parse(put![1].body)).toEqual({ ids: ["nexus", "firma", "monolith"] });
  });
  await waitFor(() => {
    const cockpitCalls = mockApiFetch.mock.calls.filter(([url]) => url === "/api/cockpit");
    expect(cockpitCalls.length).toBe(2);
  });
});

test("picker: po wybraniu 3 projektów pozostałe są zablokowane", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");
  fireEvent.click(screen.getByRole("button", { name: "Zmień aktywne" }));
  await screen.findByLabelText("Monolith");
  fireEvent.click(screen.getByLabelText("Monolith"));
  expect(screen.getByLabelText("Inny")).toBeDisabled();
});

test("picker: błąd PUT (np. 409) pokazuje komunikat serwera i nie zamyka okna", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");
  const base = mockApiFetch.getMockImplementation()!;
  mockApiFetch.mockImplementation((url: string, init?: RequestInit) =>
    url === "/api/cockpit/pinned" && init?.method === "PUT"
      ? Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ error: "Plik zmienił się w międzyczasie" }),
        })
      : base(url, init)
  );
  fireEvent.click(screen.getByRole("button", { name: "Zmień aktywne" }));
  await screen.findByLabelText("Monolith");
  fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(await screen.findByText("Plik zmienił się w międzyczasie")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zapisz" })).toBeInTheDocument();
});
