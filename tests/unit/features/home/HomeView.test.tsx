import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, vi, beforeEach, describe, test, expect } from "vitest";
import HomeView from "@/src/features/home/HomeView";
import type { CockpitDto } from "@/contexts/bc_cockpit/schemas";

const EMPTY: CockpitDto = {
  date: "2026-11-13",
  topics: [],
  queue: [],
  events: [],
  nextMeeting: null,
  git: null,
  closing: { anchor: null, today: null },
  warnings: [],
};

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
      branch: "main",
      lastActivity: "2026-11-12T21:40",
      confidence: "sure",
      nowCount: 2,
      bugCount: 1,
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
      branch: null,
      lastActivity: "2026-10-01",
      confidence: "check",
      nowCount: 0,
      bugCount: 0,
    },
  ],
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
        },
        {
          kind: "today",
          title: "Wysłać wniosek",
          due: "2026-11-13",
          projectName: null,
          priority: null,
        },
      ],
    },
    {
      projectId: "firma",
      name: "Projekt firmowy",
      owner: "work",
      items: [
        {
          kind: "now",
          title: "Przejrzeć raport",
          due: null,
          projectName: "Projekt firmowy",
          priority: "high",
        },
      ],
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
  nextMeeting: { title: "Spotkanie zespołu", startMinutes: 570, durationMinutes: 30 },
  git: { commitsToday: 4, projectsWithCommits: 2, branch: "feat/k7" },
  closing: {
    anchor: { date: "2026-11-12", text: "Zacząć od K6", projectId: "nexus", commits: 4 },
    today: null,
  },
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
    if (url === "/api/cockpit/closing" && init?.method === "PUT") {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (url === "/api/cockpit/pinned" && init?.method === "PUT") {
      return Promise.resolve({ ok: true, json: async () => ({ ids: [] }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

const defaultProps = { apiFetch: mockApiFetch };

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
  expect(screen.getAllByText("09:30")).toHaveLength(2); // oś czasu + kafel
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

test("błąd GET /api/cockpit: komunikat zamiast sekcji", async () => {
  respond("fail");
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText(/Nie udało się wczytać Kokpitu/)).toBeInTheDocument();
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

describe("K1: układ wg makiety", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 13, 9, 48) });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("nagłówek: data po polsku, zegar i numer tygodnia, bez „Dzień dobry”", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    expect(await screen.findByText("Piątek, 13 listopada")).toBeInTheDocument();
    expect(screen.queryByText(/Dzień dobry/)).toBeNull();
    expect(screen.getByLabelText("Aktualna godzina")).toHaveTextContent("09:48");
    expect(screen.getByLabelText("Aktualna godzina")).toHaveTextContent("tydz. 46");
    expect(screen.getByText("1 spotkanie dziś")).toBeInTheDocument();
  });

  test("kafel następnego spotkania: godzina i „za N min”", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    await screen.findByText("Następne spotkanie");
    expect(screen.getAllByText("09:30")).toHaveLength(2);
    expect(screen.getByText(/trwa · Spotkanie zespołu/)).toBeInTheDocument();
  });

  test("karta tematu: branch, bloker, ostatnio z pewnością i chipy liczników", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    await screen.findByText("NEXUS");
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("bloker")).toBeInTheDocument();
    expect(screen.getByText("Teraz: 2")).toBeInTheDocument();
    expect(screen.getByText("bugi: 1")).toBeInTheDocument();
    expect(screen.getByText("pewne")).toBeInTheDocument();
    expect(screen.getByText("wczoraj", { exact: false, selector: "dd" })).toBeInTheDocument();
  });

  test("„Kopiuj kontekst” pobiera paczkę i kopiuje Markdown do schowka", async () => {
    respond(FULL);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const base = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation((url: string, init?: RequestInit) =>
      url === "/api/projects/nexus/context-pack"
        ? Promise.resolve({ ok: true, json: async () => ({ markdown: "# paczka" }) })
        : base(url, init)
    );
    render(<HomeView {...defaultProps} />);
    await screen.findByText("NEXUS");
    fireEvent.click(screen.getAllByRole("button", { name: "Kopiuj kontekst" })[0]);
    expect(await screen.findByRole("button", { name: "Skopiowano" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("# paczka");
  });

  test("„Wejdź” woła onOpenProject z id projektu", async () => {
    respond(FULL);
    const onOpenProject = vi.fn();
    render(<HomeView {...defaultProps} onOpenProject={onOpenProject} />);
    await screen.findByText("NEXUS");
    fireEvent.click(screen.getAllByRole("button", { name: "Wejdź" })[0]);
    expect(onOpenProject).toHaveBeenCalledWith("nexus");
  });

  test("dwa tematy: slot „Wolne miejsce na trzeci temat” otwiera wybór", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    await screen.findByText("NEXUS");
    fireEvent.click(screen.getByText("Wolne miejsce na trzeci temat"));
    expect(await screen.findByRole("button", { name: "Zapisz" })).toBeInTheDocument();
  });

  test("oś dnia: znacznik „teraz” i zakres godzin", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    await screen.findByText("Spotkanie zespołu");
    expect(screen.getByLabelText("Teraz 09:48")).toBeInTheDocument();
    expect(screen.getByText("08–18")).toBeInTheDocument();
  });

  test("pasek statusu: vault zsynchronizowany albo liczba ostrzeżeń", async () => {
    respond(EMPTY);
    const { unmount } = render(<HomeView {...defaultProps} />);
    expect(await screen.findByText("zsynchronizowany")).toBeInTheDocument();
    unmount();
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    expect(await screen.findByText("1 ostrzeżeń")).toBeInTheDocument();
  });

  test("kafel „Commity dziś” i gałąź w pasku statusu (K7)", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    expect(await screen.findByText("Commity dziś")).toBeInTheDocument();
    const tile = screen.getByText("Commity dziś").closest(".kok-tile") as HTMLElement;
    expect(tile).toHaveTextContent("4");
    expect(tile).toHaveTextContent("2 projekty");
    const bar = screen.getByLabelText("Pasek statusu");
    expect(bar).toHaveTextContent("branch feat/k7");
  });

  test("bez dostępnego gita: brak kafla i brak gałęzi w pasku (nic nie zmyślamy)", async () => {
    respond(EMPTY);
    render(<HomeView {...defaultProps} />);
    await screen.findByText("zsynchronizowany");
    expect(screen.queryByText("Commity dziś")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Pasek statusu")).not.toHaveTextContent("branch");
  });

  test("zaczep z wczoraj: etykieta, tekst i „Wejdź w temat” (K6)", async () => {
    respond(FULL);
    const onOpenProject = vi.fn();
    render(<HomeView {...defaultProps} onOpenProject={onOpenProject} />);
    const bar = await screen.findByLabelText("Zaczep z wczoraj");
    expect(bar).toHaveTextContent("Zacząć od K6");
    fireEvent.click(screen.getByRole("button", { name: "Wejdź w temat" }));
    expect(onOpenProject).toHaveBeenCalledWith("nexus");
  });

  test("zaczep sprzed kilku dni ma etykietę z liczbą dni; bez projektu nie ma „Wejdź w temat”", async () => {
    respond({
      ...FULL,
      closing: {
        anchor: { date: "2026-11-10", text: "Dokończyć fakturę", projectId: null, commits: null },
        today: null,
      },
    });
    render(<HomeView {...defaultProps} />);
    expect(await screen.findByLabelText("Zaczep sprzed 3 dni")).toHaveTextContent(
      "Dokończyć fakturę"
    );
    expect(screen.queryByRole("button", { name: "Wejdź w temat" })).not.toBeInTheDocument();
  });

  test("bez zamknięcia sprzed dziś nie ma paska zaczepu", async () => {
    respond(EMPTY);
    render(<HomeView {...defaultProps} />);
    await screen.findByText("zsynchronizowany");
    expect(screen.queryByLabelText(/^Zaczep/)).not.toBeInTheDocument();
  });

  test("„Zamknij dzień”: zapis zdania wysyła PUT i odświeża Kokpit", async () => {
    respond(EMPTY);
    render(<HomeView {...defaultProps} />);
    fireEvent.click(await screen.findByRole("button", { name: "Zamknij dzień" }));
    const dialog = await screen.findByRole("dialog", { name: "Zamknij dzień" });
    const save = within(dialog).getByRole("button", { name: "Zapisz" });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Od czego zacząć jutro?"), {
      target: { value: "  Zacząć od K6 " },
    });
    fireEvent.change(await within(dialog).findByLabelText("Temat (opcjonalnie)"), {
      target: { value: "nexus" },
    });
    const callsBefore = mockApiFetch.mock.calls.filter((c) => c[0] === "/api/cockpit").length;
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const put = mockApiFetch.mock.calls.find((c) => c[0] === "/api/cockpit/closing");
    expect(put?.[1]).toMatchObject({ method: "PUT" });
    expect(JSON.parse(put?.[1].body)).toEqual({ text: "Zacząć od K6", projectId: "nexus" });
    await waitFor(() =>
      expect(mockApiFetch.mock.calls.filter((c) => c[0] === "/api/cockpit").length).toBe(
        callsBefore + 1
      )
    );
  });

  test("po zamknięciu dnia przycisk pokazuje „Dzień zamknięty · zmień”, a dialog ma zapisany tekst", async () => {
    respond({
      ...EMPTY,
      closing: {
        anchor: null,
        today: { date: "2026-11-13", text: "Jutro K3", projectId: null, commits: 2 },
      },
    });
    render(<HomeView {...defaultProps} />);
    fireEvent.click(await screen.findByRole("button", { name: "Dzień zamknięty · zmień" }));
    const dialog = await screen.findByRole("dialog", { name: "Zamknij dzień" });
    expect(within(dialog).getByLabelText("Od czego zacząć jutro?")).toHaveValue("Jutro K3");
  });

  test("błąd zapisu zostawia dialog otwarty z komunikatem", async () => {
    respond(EMPTY);
    const base = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation((url: string, init?: RequestInit) =>
      url === "/api/cockpit/closing"
        ? Promise.resolve({ ok: false, status: 400, json: async () => ({ error: "Zły temat" }) })
        : base(url, init)
    );
    render(<HomeView {...defaultProps} />);
    fireEvent.click(await screen.findByRole("button", { name: "Zamknij dzień" }));
    const dialog = await screen.findByRole("dialog", { name: "Zamknij dzień" });
    fireEvent.change(within(dialog).getByLabelText("Od czego zacząć jutro?"), {
      target: { value: "x" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Zapisz" }));
    expect(await within(dialog).findByText("Zły temat")).toBeInTheDocument();
  });
});
