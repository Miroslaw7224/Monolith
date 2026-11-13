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
  inbox: null,
  windows: [],
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
          energy: "quick",
          source: { type: "task", taskId: "t-old" },
        },
        {
          kind: "today",
          title: "Wysłać wniosek",
          due: "2026-11-13",
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
      items: [
        {
          kind: "now",
          title: "Przejrzeć raport",
          due: null,
          projectName: "Projekt firmowy",
          priority: "high",
          energy: "deep",
          source: { type: "project", projectId: "firma", text: "Przejrzeć raport #deep" },
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
      link: "https://meet.google.com/gon-fztr-zrn",
      brief: null,
    },
    {
      id: "e2",
      title: "Praca głęboka",
      startMinutes: 780,
      durationMinutes: 60,
      type: "work",
      color: "#222",
      link: null,
      brief: null,
    },
  ],
  nextMeeting: {
    date: "2026-11-13",
    title: "Spotkanie zespołu",
    startMinutes: 570,
    durationMinutes: 30,
    link: "https://meet.google.com/gon-fztr-zrn",
  },
  git: { commitsToday: 4, projectsWithCommits: 2, branch: "feat/k7" },
  inbox: { open: 2 },
  windows: [
    {
      startMinutes: 480,
      endMinutes: 570,
      energy: "deep",
      title: "Stare okno",
      projectName: "NEXUS",
    },
    {
      startMinutes: 600,
      endMinutes: 750,
      energy: "deep",
      title: "Napisać plan K5",
      projectName: "NEXUS",
    },
    {
      startMinutes: 840,
      endMinutes: 930,
      energy: "quick",
      title: "Sprawdzić linki",
      projectName: null,
    },
  ],
  closing: {
    anchor: { date: "2026-11-12", text: "Zacząć od K6", projectId: "nexus", commits: 4 },
    today: null,
  },
  warnings: ['Zadanie "Stare": pominięto błędny termin 0006-08-26'],
};

const HISTORY = {
  from: "2026-11-11",
  to: "2026-11-13",
  available: true,
  total: 7,
  totalPrs: 1,
  days: [
    { date: "2026-11-11", total: 0, prs: 0, projects: [] },
    {
      date: "2026-11-12",
      total: 5,
      prs: 1,
      projects: [
        { projectId: "nexus", name: "NEXUS", count: 4 },
        { projectId: "monolith", name: "Monolith", count: 1 },
      ],
    },
    {
      date: "2026-11-13",
      total: 2,
      prs: 0,
      projects: [{ projectId: "nexus", name: "NEXUS", count: 2 }],
    },
  ],
};

const INBOX = {
  items: [
    { id: "b-0", text: "Code Sensei: pusty stan listy", type: "bug", at: "2026-11-13T10:00" },
    { id: "a-0", text: "Artykuł o vitest", type: "link", at: "2026-11-13T09:10" },
  ],
  open: 2,
};

const mockApiFetch = vi.fn();

function respond(cockpit: CockpitDto | "fail") {
  mockApiFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/cockpit") {
      return cockpit === "fail"
        ? Promise.resolve({ ok: false, status: 500, json: async () => ({ error: "boom" }) })
        : Promise.resolve({ ok: true, json: async () => cockpit });
    }
    if (url === "/api/inbox" && (init?.method ?? "GET") === "GET") {
      return Promise.resolve({ ok: true, json: async () => INBOX });
    }
    if (url === "/api/inbox" && init?.method === "POST") {
      return Promise.resolve({ ok: true, status: 201, json: async () => ({}) });
    }
    if (url.startsWith("/api/inbox/") && init?.method === "PATCH") {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }
    if (url === "/api/cockpit/queue/complete" && init?.method === "POST") {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }
    if (url.startsWith("/api/cockpit/commits")) {
      return Promise.resolve({ ok: true, json: async () => HISTORY });
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
    expect(screen.getByText("1 spotkanie dziś · 1 okno Deep Work")).toBeInTheDocument();
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

  test("ostrzeżenia: brak kafla, lista na dole i licznik w pasku zostają", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    const list = await screen.findByRole("list", { name: "Ostrzeżenia" });
    expect(list).toHaveTextContent("pominięto błędny termin");
    expect(screen.queryByText("stan spójny")).not.toBeInTheDocument();
    const labels = [...document.querySelectorAll(".kok-tile__label")].map((n) => n.textContent);
    expect(labels).not.toContain("Ostrzeżenia");
    expect(screen.getByLabelText("Pasek statusu")).toHaveTextContent("1 ostrzeżeń");
  });

  test("historia commitów: słupki dzień po dniu z sumą i podziałem na projekty (K8)", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    const panel = await screen.findByRole("region", { name: "Historia commitów" });
    expect(panel).toHaveTextContent("7 commitów · 1 PR w 3 dni");
    expect(
      within(panel).getByText("PR", { selector: ".kok-history__legend-pr" })
    ).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/cockpit/commits?days=7");
    const bars = within(panel).getAllByRole("img");
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveAccessibleName("11 listopada: brak commitów");
    expect(bars[1]).toHaveAccessibleName("12 listopada: 5 commitów (NEXUS 4, Monolith 1), 1 PR");
    expect(bars[2]).toHaveAccessibleName("13 listopada: 2 commity (NEXUS 2)");
  });

  test("historia commitów: bez dostępnych repo panelu nie ma, błąd API nic nie psuje", async () => {
    respond(FULL);
    const base = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation((url: string, init?: RequestInit) =>
      url.startsWith("/api/cockpit/commits")
        ? Promise.resolve({
            ok: true,
            json: async () => ({ ...HISTORY, available: false, total: 0, days: [] }),
          })
        : base(url, init)
    );
    const { unmount } = render(<HomeView {...defaultProps} />);
    await screen.findByText("Commity dziś");
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/cockpit/commits?days=7"));
    expect(screen.queryByRole("region", { name: "Historia commitów" })).not.toBeInTheDocument();
    unmount();

    mockApiFetch.mockImplementation((url: string, init?: RequestInit) =>
      url.startsWith("/api/cockpit/commits")
        ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
        : base(url, init)
    );
    render(<HomeView {...defaultProps} />);
    expect(await screen.findByText("Commity dziś")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Historia commitów" })).not.toBeInTheDocument();
  });

  test("kafel Inbox: liczba otwartych; bez danych kafla nie ma (K3)", async () => {
    respond(FULL);
    const { unmount } = render(<HomeView {...defaultProps} />);
    const tile = (await screen.findByText("Inbox", { selector: ".kok-tile__label" })).closest(
      ".kok-tile"
    ) as HTMLElement;
    expect(tile).toHaveTextContent("2");
    expect(tile).toHaveTextContent("do segregacji wieczorem");
    unmount();
    respond(EMPTY);
    render(<HomeView {...defaultProps} />);
    await screen.findByText("zsynchronizowany");
    expect(screen.queryByText("Inbox", { selector: ".kok-tile__label" })).not.toBeInTheDocument();
  });

  test("panel Inbox: lista z typami, dodanie wpisu (POST) i oznaczenie jako gotowe (PATCH)", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    const panel = await screen.findByRole("region", { name: "Inbox" });
    expect(await within(panel).findByText("Artykuł o vitest")).toBeInTheDocument();
    expect(within(panel).getByText("bug")).toBeInTheDocument();
    expect(within(panel).getByText("link")).toBeInTheDocument();

    const input = within(panel).getByLabelText("Szybki zapis");
    const add = within(panel).getByRole("button", { name: "Dodaj" });
    expect(add).toBeDisabled();
    fireEvent.change(input, { target: { value: "  bug: coś nie działa " } });
    fireEvent.click(add);
    await waitFor(() => {
      const post = mockApiFetch.mock.calls.find(
        (c) => c[0] === "/api/inbox" && c[1]?.method === "POST"
      );
      expect(JSON.parse(post?.[1].body)).toEqual({ text: "bug: coś nie działa" });
    });
    await waitFor(() => expect(input).toHaveValue(""));

    fireEvent.click(within(panel).getAllByRole("button", { name: "Gotowe" })[1]);
    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some((c) => c[0] === "/api/inbox/a-0" && c[1]?.method === "PATCH")
      ).toBe(true)
    );
  });

  test("Alt+I (focusInbox): fokus w polu zapisu i potwierdzenie", async () => {
    respond(FULL);
    const onInboxFocused = vi.fn();
    render(<HomeView {...defaultProps} focusInbox onInboxFocused={onInboxFocused} />);
    const input = await screen.findByLabelText("Szybki zapis");
    await waitFor(() => expect(input).toHaveFocus());
    expect(onInboxFocused).toHaveBeenCalled();
  });

  test("energia: znaczniki w kolejce, podsumowanie w kaflu i filtr deep/quick (K2)", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    const queue = await screen.findByRole("region", { name: "Kolejka na dziś" });
    const tile = screen
      .getByText("Kolejka zadań", { selector: ".kok-tile__label" })
      .closest(".kok-tile") as HTMLElement;
    expect(tile).toHaveTextContent("1 deep · 1 quick");

    expect(within(queue).getByText("Zaległa faktura")).toBeInTheDocument();
    expect(within(queue).getByText("Wysłać wniosek")).toBeInTheDocument();
    expect(within(queue).getByText("Przejrzeć raport")).toBeInTheDocument();
    expect(within(queue).getByRole("button", { name: "wszystko" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(within(queue).getByRole("button", { name: "deep" }));
    expect(within(queue).getByRole("button", { name: "deep" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(queue).getByText("Przejrzeć raport")).toBeInTheDocument();
    expect(within(queue).queryByText("Zaległa faktura")).not.toBeInTheDocument();
    expect(within(queue).queryByText("Wysłać wniosek")).not.toBeInTheDocument();
    expect(queue).toHaveTextContent("1 zadań");

    fireEvent.click(within(queue).getByRole("button", { name: "quick" }));
    expect(within(queue).getByText("Zaległa faktura")).toBeInTheDocument();
    expect(within(queue).queryByText("Przejrzeć raport")).not.toBeInTheDocument();

    fireEvent.click(within(queue).getByRole("button", { name: "wszystko" }));
    expect(within(queue).getByText("Wysłać wniosek")).toBeInTheDocument();
  });

  test("bez zadań z energią: kafel pokazuje liczbę grup, filtry się nie pojawiają", async () => {
    const noEnergy: CockpitDto = {
      ...FULL,
      queue: FULL.queue.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, energy: null })) })),
    };
    respond(noEnergy);
    render(<HomeView {...defaultProps} />);
    const queue = await screen.findByRole("region", { name: "Kolejka na dziś" });
    const tile = screen
      .getByText("Kolejka zadań", { selector: ".kok-tile__label" })
      .closest(".kok-tile") as HTMLElement;
    expect(tile).toHaveTextContent("2 grup projektowych");
    expect(within(queue).queryByRole("button", { name: "deep" })).not.toBeInTheDocument();
  });

  test("oś dnia: „Dołącz” tylko dla wydarzeń z linkiem, w nowej karcie (K4)", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    await screen.findByText("Spotkanie zespołu");
    // kafel „Następne spotkanie” i wiersz osi czasu; wydarzenie bez linku nie ma przycisku
    const links = screen.getAllByRole("link", { name: /Dołącz/ });
    expect(links).toHaveLength(2);
    for (const a of links) {
      expect(a).toHaveAttribute("href", "https://meet.google.com/gon-fztr-zrn");
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
    }
    const tile = screen
      .getByText("Następne spotkanie", { selector: ".kok-tile__label" })
      .closest(".kok-tile") as HTMLElement;
    expect(within(tile).getByRole("link", { name: /Dołącz/ })).toBeInTheDocument();
  });

  test("oś dnia: BRIEF jako lista punktów tylko przy wydarzeniach, które się nie skończyły (K4)", async () => {
    const withBriefs: CockpitDto = {
      ...FULL,
      events: [
        { ...FULL.events[0], id: "past", title: "Poranny sync", startMinutes: 480, brief: "Stary" },
        {
          ...FULL.events[0],
          id: "next",
          title: "Przegląd tygodnia",
          startMinutes: 630,
          brief: "- Wybrać focus\n\n• Decyzja o fiszkach\nGP-002",
        },
        { ...FULL.events[1], id: "nobrief", title: "Praca głęboka", startMinutes: 780 },
      ],
    };
    respond(withBriefs);
    render(<HomeView {...defaultProps} />);
    await screen.findByText("Przegląd tygodnia");
    const blocks = screen.getAllByLabelText("Brief");
    expect(blocks).toHaveLength(1);
    const items = within(blocks[0]).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Wybrać focus",
      "Decyzja o fiszkach",
      "GP-002",
    ]);
    expect(screen.queryByText("Stary")).not.toBeInTheDocument();
  });

  test("układ: commity pod osią czasu, inbox pod kolejką (te same kolumny)", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    const timeline = await screen.findByRole("region", { name: "Oś dnia" });
    const queue = screen.getByRole("region", { name: "Kolejka na dziś" });
    const history = await screen.findByRole("region", { name: "Historia commitów" });
    const inbox = await screen.findByRole("region", { name: "Inbox" });
    expect(timeline.parentElement).toBe(history.parentElement);
    expect(queue.parentElement).toBe(inbox.parentElement);
    expect(timeline.parentElement).not.toBe(queue.parentElement);
  });

  test("okna Deep Work: propozycje na osi między wydarzeniami, miniona ukryta, licznik w nagłówku (K5)", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    const timeline = await screen.findByRole("region", { name: "Oś dnia" });
    const slots = within(timeline).getAllByTestId("window-slot");
    expect(slots).toHaveLength(2);
    expect(slots[0]).toHaveTextContent("Okno 10:00–12:30");
    expect(slots[0]).toHaveTextContent("proponowane");
    expect(slots[0]).toHaveTextContent("deep");
    expect(slots[0]).toHaveTextContent("Napisać plan K5");
    expect(slots[0]).toHaveTextContent("NEXUS");
    expect(slots[1]).toHaveTextContent("Okno 14:00–15:30");
    expect(slots[1]).toHaveTextContent("quick");
    expect(within(timeline).queryByText("Stare okno")).not.toBeInTheDocument();
    // kolejność na osi: spotkanie 09:30, „teraz” 09:48, okno 10:00, praca 13:00, okno 14:00
    const text = timeline.textContent ?? "";
    const order = ["Spotkanie zespołu", "teraz", "Okno 10:00", "Praca głęboka", "Okno 14:00"].map(
      (t) => text.indexOf(t)
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(screen.getByText(/1 okno Deep Work/)).toBeInTheDocument();
  });

  test("bez propozycji nie ma slotów ani licznika okien", async () => {
    respond(EMPTY);
    render(<HomeView {...defaultProps} />);
    await screen.findByText("zsynchronizowany");
    expect(screen.queryByTestId("window-slot")).not.toBeInTheDocument();
    expect(screen.queryByText(/Deep Work/)).not.toBeInTheDocument();
  });

  test("zadanie ogólne bez terminu ma odznakę „bez terminu” (K2/kolejka)", async () => {
    respond({
      ...FULL,
      queue: [
        {
          projectId: null,
          name: "Ogólne",
          owner: "personal",
          items: [
            {
              kind: "undated",
              title: "Lista zasad",
              due: null,
              projectName: null,
              priority: null,
              energy: null,
              source: { type: "task", taskId: "t-zasady" },
            },
          ],
        },
      ],
    });
    render(<HomeView {...defaultProps} />);
    const queue = await screen.findByRole("region", { name: "Kolejka na dziś" });
    expect(within(queue).getByText("Lista zasad")).toBeInTheDocument();
    expect(within(queue).getByText("bez terminu")).toBeInTheDocument();
  });

  test("kolejka: gdy zadań jest więcej niż 8, widać pierwsze 8 (najbliższe daty), reszta pod przyciskiem", async () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      kind: "overdue" as const,
      title: `Zadanie ${i + 1}`,
      due: `2026-11-${String(12 - i).padStart(2, "0")}`,
      projectName: null,
      priority: null,
      energy: null,
      source: { type: "task" as const, taskId: `t${i}` },
    }));
    respond({
      ...FULL,
      queue: [{ projectId: null, name: "Ogólne", owner: "personal", items }],
    });
    render(<HomeView {...defaultProps} />);
    const queue = await screen.findByRole("region", { name: "Kolejka na dziś" });
    expect(within(queue).getByText("Zadanie 8")).toBeInTheDocument();
    expect(within(queue).queryByText("Zadanie 9")).not.toBeInTheDocument();
    expect(queue).toHaveTextContent("11 zadań");
    fireEvent.click(within(queue).getByRole("button", { name: "Pokaż wszystkie (11)" }));
    expect(within(queue).getByText("Zadanie 11")).toBeInTheDocument();
    fireEvent.click(within(queue).getByRole("button", { name: "Pokaż mniej" }));
    expect(within(queue).queryByText("Zadanie 9")).not.toBeInTheDocument();
  });

  test("kolejka do 8 zadań: bez przycisku „Pokaż wszystkie”", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    const queue = await screen.findByRole("region", { name: "Kolejka na dziś" });
    expect(
      within(queue).queryByRole("button", { name: /Pokaż wszystkie/ })
    ).not.toBeInTheDocument();
  });

  test("historia: liczba commitów i liczba PR mają osobne znaczniki kolorów", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    const panel = await screen.findByRole("region", { name: "Historia commitów" });
    expect(panel.querySelectorAll(".kok-history__commit-value")).toHaveLength(3);
    expect(panel.querySelectorAll(".kok-history__pr-value")).toHaveLength(1);
    expect(panel.querySelector(".kok-history__pr-value")).toHaveTextContent("1");
  });

  const completeCalls = () =>
    mockApiFetch.mock.calls.filter((c) => c[0] === "/api/cockpit/queue/complete");

  test("checkbox w kolejce domyka zadanie ogólne i odświeża Kokpit", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    const queue = await screen.findByRole("region", { name: "Kolejka na dziś" });
    const before = mockApiFetch.mock.calls.filter((c) => c[0] === "/api/cockpit").length;
    const row = within(queue).getByText("Wysłać wniosek").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("checkbox", { name: "zrobione" }));
    await waitFor(() => expect(completeCalls()).toHaveLength(1));
    expect(JSON.parse(completeCalls()[0][1].body)).toEqual({ type: "task", taskId: "t-wniosek" });
    await waitFor(() =>
      expect(mockApiFetch.mock.calls.filter((c) => c[0] === "/api/cockpit").length).toBe(before + 1)
    );
  });

  test("checkbox zadania projektu wysyła projekt i surowy tekst", async () => {
    respond(FULL);
    render(<HomeView {...defaultProps} />);
    const queue = await screen.findByRole("region", { name: "Kolejka na dziś" });
    const row = within(queue).getByText("Przejrzeć raport").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("checkbox", { name: "zrobione" }));
    await waitFor(() => expect(completeCalls()).toHaveLength(1));
    expect(JSON.parse(completeCalls()[0][1].body)).toEqual({
      type: "project",
      projectId: "firma",
      text: "Przejrzeć raport #deep",
    });
  });

  test("klik w tytuł otwiera podgląd; zadanie projektu: Zrobione i „Otwórz w Projektach”", async () => {
    respond(FULL);
    const onOpenProject = vi.fn();
    render(<HomeView {...defaultProps} onOpenProject={onOpenProject} />);
    const queue = await screen.findByRole("region", { name: "Kolejka na dziś" });
    fireEvent.click(within(queue).getByRole("button", { name: "Przejrzeć raport" }));
    const dialog = await screen.findByRole("dialog", { name: "Podgląd zadania" });
    expect(dialog).toHaveTextContent("Przejrzeć raport");
    expect(dialog).toHaveTextContent("Projekt firmowy");
    expect(dialog).toHaveTextContent("deep");
    fireEvent.click(within(dialog).getByRole("button", { name: "Otwórz w Projektach" }));
    expect(onOpenProject).toHaveBeenCalledWith("firma");
    expect(screen.queryByRole("dialog", { name: "Podgląd zadania" })).not.toBeInTheDocument();
  });

  test("podgląd zadania ogólnego: „Otwórz w Zadaniach” i „Oznacz jako zrobione”", async () => {
    respond(FULL);
    const onOpenTasks = vi.fn();
    render(<HomeView {...defaultProps} onOpenTasks={onOpenTasks} />);
    const queue = await screen.findByRole("region", { name: "Kolejka na dziś" });
    fireEvent.click(within(queue).getByRole("button", { name: "Zaległa faktura" }));
    let dialog = await screen.findByRole("dialog", { name: "Podgląd zadania" });
    expect(dialog).toHaveTextContent("zaległe");
    fireEvent.click(within(dialog).getByRole("button", { name: "Otwórz w Zadaniach" }));
    expect(onOpenTasks).toHaveBeenCalled();

    fireEvent.click(within(queue).getByRole("button", { name: "Zaległa faktura" }));
    dialog = await screen.findByRole("dialog", { name: "Podgląd zadania" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Oznacz jako zrobione" }));
    await waitFor(() => expect(completeCalls()).toHaveLength(1));
    expect(JSON.parse(completeCalls()[0][1].body)).toEqual({ type: "task", taskId: "t-old" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Podgląd zadania" })).not.toBeInTheDocument()
    );
  });

  test("podgląd zamyka Anuluj; błąd domknięcia pokazuje komunikat i zostawia zadanie", async () => {
    respond(FULL);
    const base = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation((url: string, init?: RequestInit) =>
      url === "/api/cockpit/queue/complete"
        ? Promise.resolve({
            ok: false,
            status: 409,
            json: async () => ({ error: "Zadanie zmieniło się w pliku" }),
          })
        : base(url, init)
    );
    render(<HomeView {...defaultProps} />);
    const queue = await screen.findByRole("region", { name: "Kolejka na dziś" });
    fireEvent.click(within(queue).getByRole("button", { name: "Wysłać wniosek" }));
    const dialog = await screen.findByRole("dialog", { name: "Podgląd zadania" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Oznacz jako zrobione" }));
    expect(await within(dialog).findByText("Zadanie zmieniło się w pliku")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog", { name: "Podgląd zadania" })).not.toBeInTheDocument();
    expect(within(queue).getByText("Wysłać wniosek")).toBeInTheDocument();
  });

  test("następne spotkanie z innego dnia: godzina i dzień, odnośnik Dołącz", async () => {
    respond({
      ...FULL,
      nextMeeting: {
        date: "2026-11-18",
        title: "Career Guide",
        startMinutes: 1200,
        durationMinutes: 60,
        link: "https://meet.google.com/gon-fztr-zrn",
      },
    });
    render(<HomeView {...defaultProps} />);
    const tile = (
      await screen.findByText("Następne spotkanie", { selector: ".kok-tile__label" })
    ).closest(".kok-tile") as HTMLElement;
    expect(tile).toHaveTextContent("20:00");
    expect(tile).toHaveTextContent("Środa, 18 listopada · Career Guide");
    expect(tile).not.toHaveTextContent("za ");
    expect(within(tile).getByRole("link", { name: /Dołącz/ })).toHaveAttribute(
      "href",
      "https://meet.google.com/gon-fztr-zrn"
    );
  });

  test("jutrzejsze spotkanie jest podpisane „jutro”; brak spotkań to „brak nadchodzących spotkań”", async () => {
    respond({
      ...FULL,
      nextMeeting: {
        date: "2026-11-14",
        title: "Daily",
        startMinutes: 540,
        durationMinutes: 15,
        link: null,
      },
    });
    const { unmount } = render(<HomeView {...defaultProps} />);
    const tile = (
      await screen.findByText("Następne spotkanie", { selector: ".kok-tile__label" })
    ).closest(".kok-tile") as HTMLElement;
    expect(tile).toHaveTextContent("jutro · Daily");
    unmount();
    respond({ ...FULL, nextMeeting: null });
    render(<HomeView {...defaultProps} />);
    const tile2 = (
      await screen.findByText("Następne spotkanie", { selector: ".kok-tile__label" })
    ).closest(".kok-tile") as HTMLElement;
    expect(tile2).toHaveTextContent("brak nadchodzących spotkań");
  });
});
