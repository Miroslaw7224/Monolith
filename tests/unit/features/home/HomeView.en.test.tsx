import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import HomeView from "@/src/features/home/HomeView";
import type { CockpitDto } from "@/contexts/bc_cockpit/schemas";
import { setLanguage } from "@/src/i18n";

const cockpitWithEnergyQueue: CockpitDto = {
  pinnedIds: [],
  date: "2026-11-11",
  topics: [],
  queue: [
    {
      projectId: null,
      name: "Ogólne",
      owner: "personal",
      items: [
        {
          kind: "overdue",
          title: "Zaległa faktura",
          due: "2026-11-10",
          projectName: null,
          priority: null,
          energy: "quick",
          source: { type: "task", taskId: "t-old" },
        },
        {
          kind: "today",
          title: "Wysłać wniosek",
          due: "2026-11-11",
          projectName: null,
          priority: null,
          energy: null,
          source: { type: "task", taskId: "t-wniosek" },
        },
      ],
    },
    {
      projectId: "firma",
      name: "Projekt firmowy",
      owner: "work",
      kind: "etat",
      companyData: true,
      items: [
        {
          kind: "now",
          title: "Przejrzeć raport",
          due: null,
          projectName: "Projekt firmowy",
          priority: "high",
          energy: "deep",
          source: {
            type: "project",
            projectId: "firma",
            text: "Przejrzeć raport #deep",
            occurrence: 0,
          },
        },
      ],
    },
  ],
  events: [],
  nextMeeting: null,
  git: null,
  inbox: null,
  windows: [],
  closing: { anchor: null, today: null },
  warnings: [],
};

const mockApiFetch = vi.fn();

function respond(cockpit: CockpitDto) {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/api/cockpit") {
      return Promise.resolve({ ok: true, json: async () => cockpit });
    }
    if (url === "/api/inbox") {
      return Promise.resolve({ ok: true, json: async () => ({ items: [], open: 0, closed: 0 }) });
    }
    if (url.startsWith("/api/cockpit/commits")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ available: false, days: [], total: 0, totalPrs: 0 }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

const defaultProps = { apiFetch: mockApiFetch };

describe("HomeView po angielsku", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 11, 9, 0) });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  test("nagłówek dnia: Wednesday, November 11 (bez polskiej daty)", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    respond({
      ...cockpitWithEnergyQueue,
      queue: [],
    });
    render(<HomeView {...defaultProps} />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Wednesday, November 11"
    );
    expect(screen.queryByText("Środa, 11 listopada")).toBeNull();
  });

  test("kolejka: chip 3 tasks przy filtrze all, 1 task przy deep", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    respond(cockpitWithEnergyQueue);
    render(<HomeView {...defaultProps} />);
    const queue = await screen.findByRole("region", { name: "Today's queue" });
    const head = queue.querySelector(".kok-panel__tools") as HTMLElement;
    expect(head).toHaveTextContent("3 tasks");

    fireEvent.click(within(queue).getByRole("button", { name: "deep" }));
    expect(head).toHaveTextContent("1 task");
    expect(head).not.toHaveTextContent("3 tasks");
  });

  test("przełączenie na PL bez remountu: data i chipy po polsku", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    respond(cockpitWithEnergyQueue);
    render(<HomeView {...defaultProps} />);
    const queue = await screen.findByRole("region", { name: "Today's queue" });
    const title = await screen.findByRole("heading", { level: 1 });
    const head = queue.querySelector(".kok-panel__tools") as HTMLElement;
    expect(title).toHaveTextContent("Wednesday, November 11");
    expect(head).toHaveTextContent("3 tasks");

    await act(async () => {
      await setLanguage("pl");
    });

    expect(title).toHaveTextContent("Środa, 11 listopada");
    expect(screen.queryByText("Wednesday, November 11")).toBeNull();
    expect(head).toHaveTextContent("3 zadania");

    fireEvent.click(within(queue).getByRole("button", { name: "deep" }));
    expect(head).toHaveTextContent("1 zadanie");
  });
});
