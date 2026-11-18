// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, NotFoundError } from "@/lib/errors";
import type { WeekReview } from "@/contexts/bc_cockpit/models";

const mockReadPinned = vi.hoisted(() => vi.fn());
const mockWritePinned = vi.hoisted(() => vi.fn());
const mockReadClosings = vi.hoisted(() => vi.fn());
const mockUpsertClosing = vi.hoisted(() => vi.fn());
const mockGetProject = vi.hoisted(() => vi.fn());
const mockListNowTasks = vi.hoisted(() => vi.fn());
const mockListProjects = vi.hoisted(() => vi.fn());
const mockGetTasks = vi.hoisted(() => vi.fn());
const mockRewriteNowTask = vi.hoisted(() => vi.fn());
const mockGetCalendarEvents = vi.hoisted(() => vi.fn());
const mockListGitActivity = vi.hoisted(() => vi.fn());
const mockListGitHistory = vi.hoisted(() => vi.fn());
const mockCountOpen = vi.hoisted(() => vi.fn());
const mockCompleteNowTask = vi.hoisted(() => vi.fn());
const mockUpdateTask = vi.hoisted(() => vi.fn());
const mockLoadReviewRequests = vi.hoisted(() => vi.fn());
const mockLoadOpenPrs = vi.hoisted(() => vi.fn());
const mockLoadMyReviews = vi.hoisted(() => vi.fn());
const mockReadWeekFocuses = vi.hoisted(() => vi.fn());
const mockUpsertWeekFocus = vi.hoisted(() => vi.fn());
const mockListGitSubjects = vi.hoisted(() => vi.fn());
const mockListDoneTasks = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_cockpit/repositories", () => ({
  readPinned: mockReadPinned,
  writePinned: mockWritePinned,
  readClosings: mockReadClosings,
  upsertClosing: mockUpsertClosing,
  loadReviewRequests: mockLoadReviewRequests,
  loadOpenPrs: mockLoadOpenPrs,
  loadMyReviews: mockLoadMyReviews,
  readWeekFocuses: mockReadWeekFocuses,
  upsertWeekFocus: mockUpsertWeekFocus,
}));
vi.mock("@/contexts/bc_projects/services", () => ({
  getProject: mockGetProject,
  listNowTasks: mockListNowTasks,
  listProjects: mockListProjects,
  listGitActivity: mockListGitActivity,
  listGitHistory: mockListGitHistory,
  listGitSubjects: mockListGitSubjects,
  listDoneTasksInWindow: mockListDoneTasks,
  completeNowTask: mockCompleteNowTask,
  rewriteNowTask: mockRewriteNowTask,
  projectKind: (owner: string, type?: string) => type ?? (owner === "work" ? "etat" : "wlasny"),
  hasCompanyData: (owner: string, type?: string) => owner === "work" || type === "etat",
}));
vi.mock("@/contexts/bc_inbox/services", () => ({ countOpen: mockCountOpen }));
vi.mock("@/contexts/bc_tasks/services", () => ({
  getTasks: mockGetTasks,
  updateTask: mockUpdateTask,
}));
vi.mock("@/contexts/bc_calendar/services", () => ({ getCalendarEvents: mockGetCalendarEvents }));

import {
  closeDay,
  completeQueueItem,
  extractEnergy,
  setQueueItemEnergy,
  withEnergy,
  planWindows,
  getCommitHistory,
  getReviewRequests,
  getOpenPrs,
  MAX_OPEN_PRS,
  getReviewHistory,
  MAX_REVIEW_REQUESTS,
  getCockpit,
  isPlausibleDate,
  localDate,
  pickNextMeeting,
  setPinned,
  MAX_FOCUS_TEXT,
  MAX_WEEK_SUBJECTS,
  composeWeekPrompt,
  getWeekReview,
  setWeekFocus,
  weekStart,
} from "@/contexts/bc_cockpit/services";

/** 00:30 lokalnie: jedyna data „dziś” ma być 2026-11-13 (UTC byłoby 12-go). */
const TODAY = new Date(2026, 10, 13, 0, 30);

const task = (over: Record<string, unknown>) => ({
  id: "t",
  title: "Zadanie",
  link: "",
  description: "",
  status: "todo",
  due_date: null,
  priority: null,
  ...over,
});

const project = (over: Record<string, unknown> = {}) => ({
  id: "nexus",
  name: "NEXUS",
  owner: "personal",
  freshness: "fresh",
  whereIStopped: null,
  state: null,
  board: { now: [] },
  bugs: [],
  ...over,
});

const state = (over: Record<string, unknown> = {}) => ({
  nextStep: "",
  blocker: "",
  branch: "",
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  mockReadPinned.mockReturnValue({ ids: [] });
  mockListNowTasks.mockReturnValue({ tasks: [], warnings: [] });
  mockGetTasks.mockResolvedValue([]);
  mockGetCalendarEvents.mockResolvedValue([]);
  mockListGitActivity.mockReturnValue([]);
  mockListGitHistory.mockReturnValue([]);
  mockCountOpen.mockReturnValue(0);
  mockReadClosings.mockReturnValue([]);
  mockUpsertClosing.mockResolvedValue(undefined);
  mockReadWeekFocuses.mockReturnValue([]);
  mockUpsertWeekFocus.mockResolvedValue(undefined);
  mockListGitSubjects.mockReturnValue([]);
  mockListDoneTasks.mockReturnValue([]);
  mockListProjects.mockReturnValue({
    projects: [{ id: "nexus" }, { id: "monolith" }],
    warnings: [],
  });
});

describe("daty", () => {
  it("localDate liczy dzień lokalny (00:30 nie przesuwa dnia)", () => {
    expect(localDate(TODAY)).toBe("2026-11-13");
  });

  it("isPlausibleDate: poprawny format, istniejący dzień, rok 2000-2099", () => {
    expect(isPlausibleDate("2026-11-13")).toBe(true);
    expect(isPlausibleDate("0006-08-26")).toBe(false);
    expect(isPlausibleDate("2026-13-40")).toBe(false);
    expect(isPlausibleDate("2026-02-30")).toBe(false);
    expect(isPlausibleDate("jutro")).toBe(false);
    expect(isPlausibleDate("2026-11-13T10:00")).toBe(false);
    expect(isPlausibleDate(null)).toBe(false);
  });

  it("getCockpit zwraca jedną wspólną datę i pyta kalendarz o ten sam dzień", async () => {
    const result = await getCockpit(TODAY);
    expect(result.date).toBe("2026-11-13");
    expect(mockGetCalendarEvents).toHaveBeenCalledWith({
      startDate: "2026-11-13",
      endDate: "2026-11-13",
    });
  });
});

describe("tematy", () => {
  beforeEach(() => {
    mockReadPinned.mockReturnValue({ ids: ["nexus"] });
  });

  it("ze state.md: nextStep i blocker, puste pola to null", async () => {
    mockGetProject.mockReturnValue(
      project({ state: state({ nextStep: " Zrobić X ", blocker: "" }), whereIStopped: "stare" })
    );
    const { topics } = await getCockpit(TODAY);
    expect(topics).toEqual([
      {
        id: "nexus",
        name: "NEXUS",
        owner: "personal",
        kind: "wlasny",
        companyData: false,
        freshness: "fresh",
        source: "state",
        nextStep: "Zrobić X",
        blocker: null,
        whereIStopped: null,
        branch: null,
        lastActivity: null,
        confidence: "sure",
        nowCount: 0,
        bugCount: 0,
      },
    ]);
    expect(mockGetProject).toHaveBeenCalledWith("nexus", TODAY);
  });

  it("bez state.md: fallback do „Gdzie skończyłem” z index.md", async () => {
    mockGetProject.mockReturnValue(project({ whereIStopped: "Skończyłem na Y" }));
    const { topics } = await getCockpit(TODAY);
    expect(topics[0]).toMatchObject({
      source: "index",
      whereIStopped: "Skończyłem na Y",
      nextStep: null,
      blocker: null,
    });
  });

  it("state.md z pustymi polami nie przesłania „Gdzie skończyłem” z index.md", async () => {
    mockGetProject.mockReturnValue(
      project({ state: state({ nextStep: "  ", blocker: "" }), whereIStopped: "Skończyłem na Z" })
    );
    expect((await getCockpit(TODAY)).topics[0]).toMatchObject({
      source: "index",
      whereIStopped: "Skończyłem na Z",
      nextStep: null,
      blocker: null,
    });
  });

  it("bez state.md i index.md: source none", async () => {
    mockGetProject.mockReturnValue(project());
    expect((await getCockpit(TODAY)).topics[0].source).toBe("none");
  });

  it("stary last_worked: temat zostaje, freshness stale", async () => {
    mockGetProject.mockReturnValue(project({ freshness: "stale", whereIStopped: "x" }));
    const { topics } = await getCockpit(TODAY);
    expect(topics).toHaveLength(1);
    expect(topics[0].freshness).toBe("stale");
  });

  it.each([
    [{ status: "behind", ahead: 2, head: "a".repeat(40) }, "check"],
    [{ status: "diverged", head: "a".repeat(40) }, "check"],
    [{ status: "current", head: "a".repeat(40) }, "sure"],
    [{ status: "no-baseline" }, "sure"],
  ] as const)("codeSync %j: confidence %s", async (codeSync, expected) => {
    mockGetProject.mockReturnValue(project({ whereIStopped: "x", codeSync }));
    expect((await getCockpit(TODAY)).topics[0].confidence).toBe(expected);
  });

  it("owner work przechodzi do tematu", async () => {
    mockGetProject.mockReturnValue(project({ owner: "work" }));
    expect((await getCockpit(TODAY)).topics[0].owner).toBe("work");
  });

  it("przypięty id spoza rejestru jest pomijany z ostrzeżeniem", async () => {
    mockGetProject.mockImplementation(() => {
      throw new NotFoundError("Nie ma projektu o id nexus");
    });
    const { topics, warnings } = await getCockpit(TODAY);
    expect(topics).toEqual([]);
    expect(warnings).toEqual(["Przypięty projekt nexus nie istnieje już w rejestrze"]);
  });

  it("pinnedIds to przypięte id z pliku (max 3), także tych, których projekt się nie wczytał", async () => {
    mockReadPinned.mockReturnValue({ ids: ["a", "b", "c", "d"] });
    mockGetProject.mockImplementation((id: string) => {
      if (id === "b") throw new Error("zły state.md");
      return project({ id, name: id });
    });
    const result = await getCockpit(TODAY);
    expect(result.topics.map((t) => t.id)).toEqual(["a", "c"]);
    expect(result.pinnedIds).toEqual(["a", "b", "c"]);
  });

  it("uszkodzony pinned.yaml: pinnedIds puste", async () => {
    mockReadPinned.mockImplementation(() => {
      throw new Error("zły YAML");
    });
    expect((await getCockpit(TODAY)).pinnedIds).toEqual([]);
  });

  it("inny błąd odczytu projektu to ostrzeżenie, nie wyjątek", async () => {
    mockGetProject.mockImplementation(() => {
      throw new Error("zły state.md");
    });
    const { topics, warnings } = await getCockpit(TODAY);
    expect(topics).toEqual([]);
    expect(warnings).toEqual(["Projekt nexus: zły state.md"]);
  });

  it("w pliku więcej niż 3 id (ręczna edycja): pokazuje 3 i ostrzega", async () => {
    mockReadPinned.mockReturnValue({ ids: ["a", "b", "c", "d"] });
    mockGetProject.mockImplementation((id: string) => project({ id, name: id }));
    const { topics, warnings } = await getCockpit(TODAY);
    expect(topics.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(warnings).toEqual(["Przypięto 4 projekty, pokazuję pierwsze 3"]);
  });

  it("uszkodzony pinned.yaml: pusta sekcja i ostrzeżenie, reszta Kokpitu działa", async () => {
    mockReadPinned.mockImplementation(() => {
      throw new Error("Nie można odczytać pliku Cockpit/pinned.yaml: zły YAML");
    });
    mockListNowTasks.mockReturnValue({
      tasks: [
        {
          projectId: "p",
          projectName: "P",
          owner: "personal",
          priority: "high",
          text: "Zadanie",
          occurrence: 0,
        },
      ],
      warnings: [],
    });
    const result = await getCockpit(TODAY);
    expect(result.topics).toEqual([]);
    expect(result.warnings).toEqual([
      "Przypięte projekty: Nie można odczytać pliku Cockpit/pinned.yaml: zły YAML",
    ]);
    expect(result.queue).toHaveLength(1);
  });
});

describe("tematy: dane do karty skupienia", () => {
  beforeEach(() => {
    mockReadPinned.mockReturnValue({ ids: ["nexus"] });
  });

  it("temat niesie rodzaj: type: etat przy owner personal → etat i Dane z firmy", async () => {
    mockGetProject.mockReturnValue(project({ type: "etat" }));
    const { topics } = await getCockpit(TODAY);
    expect(topics[0]).toMatchObject({ kind: "etat", companyData: true, owner: "personal" });
  });

  it("temat owner work bez type → etat", async () => {
    mockGetProject.mockReturnValue(project({ owner: "work" }));
    const { topics } = await getCockpit(TODAY);
    expect(topics[0]).toMatchObject({ kind: "etat", companyData: true });
  });

  it("branch jest przycinany, pusty to null", async () => {
    mockGetProject.mockReturnValue(project({ state: state({ branch: " fix/x " }) }));
    expect((await getCockpit(TODAY)).topics[0].branch).toBe("fix/x");
  });

  it("lastActivity: state.updated ma pierwszeństwo przed last_worked", async () => {
    mockGetProject.mockReturnValue(
      project({ lastWorked: "2026-11-01", state: state({ updated: "2026-11-12T21:40" }) })
    );
    expect((await getCockpit(TODAY)).topics[0].lastActivity).toBe("2026-11-12T21:40");
    mockGetProject.mockReturnValue(project({ lastWorked: "2026-11-01" }));
    expect((await getCockpit(TODAY)).topics[0].lastActivity).toBe("2026-11-01");
  });

  it("confidence: stale lub niezweryfikowany stan to check, reszta sure", async () => {
    mockGetProject.mockReturnValue(project({ freshness: "stale" }));
    expect((await getCockpit(TODAY)).topics[0].confidence).toBe("check");
    mockGetProject.mockReturnValue(project({ stateConfidence: "unknown" }));
    expect((await getCockpit(TODAY)).topics[0].confidence).toBe("check");
    mockGetProject.mockReturnValue(project({ stateConfidence: "verified" }));
    expect((await getCockpit(TODAY)).topics[0].confidence).toBe("sure");
    mockGetProject.mockReturnValue(project());
    expect((await getCockpit(TODAY)).topics[0].confidence).toBe("sure");
  });

  it("nowCount liczy niezakończone, bugCount pomija sekcję Zamknięte", async () => {
    mockGetProject.mockReturnValue(
      project({
        board: { now: [{ done: false }, { done: true }, { done: false }] },
        bugs: [{ section: "Aktywne" }, { section: "Zamknięte" }, { section: "Aktywne" }],
      })
    );
    const topic = (await getCockpit(TODAY)).topics[0];
    expect(topic.nowCount).toBe(2);
    expect(topic.bugCount).toBe(2);
  });
});

describe("następne spotkanie", () => {
  const ev = (type: "work" | "meeting", start: number, dur: number, title = "S") => ({
    id: title,
    title,
    startMinutes: start,
    durationMinutes: dur,
    type,
    color: "#000",
    link: null,
    brief: null,
  });
  const events = [
    ev("work", 540, 60, "Praca"),
    ev("meeting", 630, 30, "A"),
    ev("meeting", 780, 60, "B"),
  ];

  it("najbliższe jeszcze nie zakończone spotkanie", () => {
    expect(pickNextMeeting(events, 588)?.title).toBe("A");
    expect(pickNextMeeting(events, 640)?.title).toBe("A"); // trwa
    expect(pickNextMeeting(events, 660)?.title).toBe("B");
  });

  it("po ostatnim spotkaniu null; wydarzenie work nie jest spotkaniem", () => {
    expect(pickNextMeeting(events, 840)).toBeNull();
    expect(pickNextMeeting([ev("work", 600, 30)], 0)).toBeNull();
  });

  it("getCockpit podaje nextMeeting z godziny „dziś”", async () => {
    mockGetCalendarEvents.mockResolvedValue([
      {
        id: "e",
        date: "2026-11-13",
        start_minutes: 630,
        duration_minutes: 30,
        title: "A",
        tags: [],
        color: "#1",
        type: "meeting",
        link: "https://meet.google.com/abc-defg-hij",
      },
    ]);
    const result = await getCockpit(new Date(2026, 10, 13, 9, 48));
    expect(result.nextMeeting).toEqual({
      date: "2026-11-13",
      title: "A",
      startMinutes: 630,
      durationMinutes: 30,
      link: "https://meet.google.com/abc-defg-hij",
    });
    // dzisiejsze spotkanie wystarcza: kalendarz nie jest pytany o przyszłość
    expect(mockGetCalendarEvents).toHaveBeenCalledTimes(1);
  });
});

describe("kolejka na dziś", () => {
  it("zadanie ogólne z priorytetem 1 jest oznaczone jako pilne, niezależnie od terminu", async () => {
    mockGetTasks.mockResolvedValue([
      task({ id: "u", title: "Od ręki", due_date: "2026-12-01", priority: 1 }),
      task({ id: "n", title: "Zwykłe", priority: 2 }),
      task({ id: "d", title: "Zrobione pilne", priority: 1, status: "done" }),
    ]);

    const { queue } = await getCockpit(TODAY);
    const items = queue.flatMap((g) => g.items);

    expect(items.find((i) => i.title === "Od ręki")?.urgent).toBe(true);
    expect(items.find((i) => i.title === "Zwykłe")?.urgent).toBeUndefined();
    expect(items.some((i) => i.title === "Zrobione pilne")).toBe(false);
  });

  it("zadania ogólne „do sprawdzenia” znikają z kolejki (także pilne); „w toku” zostaje", async () => {
    mockGetTasks.mockResolvedValue([
      task({ id: "r", title: "Wysłane do sprawdzenia", priority: 1, status: "to_review" }),
      task({ id: "r2", title: "Do sprawdzenia z terminem", due_date: TODAY, status: "to_review" }),
      task({ id: "w", title: "W toku pilne", priority: 1, status: "in_progress" }),
    ]);

    const { queue } = await getCockpit(TODAY);
    const titles = queue.flatMap((g) => g.items.map((i) => i.title));

    expect(titles).toEqual(["W toku pilne"]);
  });

  it("zadania ogólne „odłożone” znikają z kolejki, także zaległe, na dziś i pilne", async () => {
    mockGetTasks.mockResolvedValue([
      task({ id: "d1", title: "Kurs Playwright", status: "deferred" }),
      task({ id: "d2", title: "Odłożone na dziś", due_date: "2026-11-13", status: "deferred" }),
      task({
        id: "d3",
        title: "Odłożone zaległe pilne",
        due_date: "2026-11-01",
        priority: 1,
        status: "deferred",
      }),
      task({ id: "a", title: "Aktualne", status: "todo" }),
    ]);

    const { queue, warnings } = await getCockpit(TODAY);
    const titles = queue.flatMap((g) => g.items.map((i) => i.title));

    expect(titles).toEqual(["Aktualne"]);
    expect(warnings.filter((w) => w.includes("Zadania ogólne"))).toEqual([]);
  });

  it("kolejność: dzisiejsze due, zaległe (najświeższe pierwsze), potem [now::], na końcu bez terminu; grupy per projekt, ogólne jako „Ogólne”", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        {
          projectId: "p1",
          projectName: "Projekt 1",
          owner: "personal",
          priority: "high",
          text: "Plan",
          occurrence: 0,
        },
        {
          projectId: "p2",
          projectName: "Projekt 2",
          owner: "work",
          priority: "",
          text: "Raport",
          occurrence: 0,
        },
      ],
      warnings: [],
    });
    mockGetTasks.mockResolvedValue([
      task({ id: "b", title: "Dziś", due_date: "2026-11-13" }),
      task({ id: "a", title: "Zaległe", due_date: "2026-11-10", status: "in_progress" }),
      task({ id: "c", title: "Jutro", due_date: "2026-11-14" }),
      task({ id: "d", title: "Zrobione", due_date: "2026-11-13", status: "done" }),
      task({ id: "e", title: "Bez terminu" }),
    ]);

    const { queue } = await getCockpit(TODAY);

    expect(queue).toEqual([
      {
        projectId: null,
        name: "Ogólne",
        owner: "personal",
        items: [
          {
            kind: "today",
            title: "Dziś",
            due: "2026-11-13",
            projectName: null,
            priority: null,
            energy: null,
            source: { type: "task", taskId: "b" },
          },
          {
            kind: "overdue",
            title: "Zaległe",
            due: "2026-11-10",
            projectName: null,
            priority: null,
            energy: null,
            source: { type: "task", taskId: "a" },
          },
          {
            kind: "upcoming",
            title: "Jutro",
            due: "2026-11-14",
            projectName: null,
            priority: null,
            energy: null,
            source: { type: "task", taskId: "c" },
          },
          {
            kind: "undated",
            title: "Bez terminu",
            due: null,
            projectName: null,
            priority: null,
            energy: null,
            source: { type: "task", taskId: "e" },
          },
        ],
      },
      {
        projectId: "p1",
        name: "Projekt 1",
        owner: "personal",
        items: [
          {
            kind: "now",
            title: "Plan",
            due: null,
            projectName: "Projekt 1",
            priority: "high",
            energy: null,
            source: { type: "project", projectId: "p1", text: "Plan", occurrence: 0 },
          },
        ],
      },
      {
        projectId: "p2",
        name: "Projekt 2",
        owner: "work",
        items: [
          {
            kind: "now",
            title: "Raport",
            due: null,
            projectName: "Projekt 2",
            priority: null,
            energy: null,
            source: { type: "project", projectId: "p2", text: "Raport", occurrence: 0 },
          },
        ],
      },
    ]);
  });

  it("zadania [now::] kilku projektów nie mieszają grup, kilka zadań jednego projektu w jednej grupie", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        { projectId: "p1", projectName: "P1", owner: "personal", text: "A", occurrence: 0 },
        { projectId: "p2", projectName: "P2", owner: "personal", text: "B", occurrence: 0 },
        { projectId: "p1", projectName: "P1", owner: "personal", text: "C", occurrence: 0 },
      ],
      warnings: [],
    });
    const { queue } = await getCockpit(TODAY);
    expect(queue.map((g) => [g.projectId, g.items.map((i) => i.title)])).toEqual([
      ["p1", ["A", "C"]],
      ["p2", ["B"]],
    ]);
  });

  it("zadania ogólne: dziś → „upcoming” (termin w przyszłości, najbliższy pierwszy) → „undated”; ukończone nie", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        {
          projectId: "p",
          projectName: "P",
          owner: "personal",
          priority: "",
          text: "Teraz",
          occurrence: 0,
        },
      ],
      warnings: [],
    });
    mockGetTasks.mockResolvedValue([
      task({ id: "1", title: "Bez daty", due_date: null }),
      task({ id: "2", title: "W toku bez daty", due_date: null, status: "in_progress" }),
      task({ id: "3", title: "Zrobione bez daty", due_date: null, status: "done" }),
      task({ id: "4", title: "Za tydzień", due_date: "2026-11-20" }),
      task({ id: "5", title: "Dziś #deep", due_date: "2026-11-13" }),
      task({ id: "6", title: "Jutro", due_date: "2026-11-14" }),
    ]);
    const { queue, warnings } = await getCockpit(TODAY);
    expect(warnings).toEqual([]);
    expect(queue.map((g) => [g.name, g.items.map((i) => `${i.kind}:${i.title}`)])).toEqual([
      [
        "Ogólne",
        [
          "today:Dziś",
          "upcoming:Jutro",
          "upcoming:Za tydzień",
          "undated:Bez daty",
          "undated:W toku bez daty",
        ],
      ],
      ["P", ["now:Teraz"]],
    ]);
    expect(queue[0].items[3].due).toBeNull();
  });

  it("złe daty due (0006-08-26 i inne) są pomijane z ostrzeżeniem, poprawne zostają", async () => {
    mockGetTasks.mockResolvedValue([
      task({ id: "1", title: "Stare", due_date: "0006-08-26" }),
      task({ id: "2", title: "Nie data", due_date: "jutro" }),
      task({ id: "3", title: "Nie ma takiego dnia", due_date: "2026-02-30" }),
      task({ id: "4", title: "Ok", due_date: "2026-11-13" }),
    ]);
    const { queue, warnings } = await getCockpit(TODAY);
    expect(queue[0].items.map((i) => i.title)).toEqual(["Ok"]);
    expect(warnings).toEqual([
      'Zadanie "Stare": pominięto błędny termin 0006-08-26',
      'Zadanie "Nie data": pominięto błędny termin jutro',
      'Zadanie "Nie ma takiego dnia": pominięto błędny termin 2026-02-30',
    ]);
  });

  it("ostrzeżenia listNowTasks trafiają do warnings", async () => {
    mockListNowTasks.mockReturnValue({ tasks: [], warnings: ["zly: pęknięty tasks.md"] });
    expect((await getCockpit(TODAY)).warnings).toEqual(["zly: pęknięty tasks.md"]);
  });
});

describe("oś dnia", () => {
  it("odrzuca task_deadline (kolejka już je pokazuje), zachowuje kolejność z kalendarza", async () => {
    mockGetCalendarEvents.mockResolvedValue([
      {
        id: "e1",
        date: "2026-11-13",
        start_minutes: 570,
        duration_minutes: 30,
        title: "Spotkanie",
        tags: [],
        color: "#111",
        type: "meeting",
        link: "https://meet.google.com/abc-defg-hij",
      },
      {
        id: "task:1",
        date: "2026-11-13",
        start_minutes: 1410,
        duration_minutes: 30,
        title: "Termin",
        tags: [],
        color: "#666",
        type: "task_deadline",
      },
      {
        id: "e2",
        date: "2026-11-13",
        start_minutes: 780,
        duration_minutes: 60,
        title: "Praca",
        tags: [],
        color: "#222",
        type: "work",
      },
    ]);
    const { events } = await getCockpit(TODAY);
    expect(events).toEqual([
      {
        id: "e1",
        title: "Spotkanie",
        startMinutes: 570,
        durationMinutes: 30,
        type: "meeting",
        color: "#111",
        link: "https://meet.google.com/abc-defg-hij",
        brief: null,
      },
      {
        id: "e2",
        title: "Praca",
        startMinutes: 780,
        durationMinutes: 60,
        type: "work",
        color: "#222",
        link: null,
        brief: null,
      },
    ]);
  });

  it("wydarzenie z wczoraj, które przechodzi przez północ, nie trafia na dzisiejszą oś ani do nextMeeting", async () => {
    mockGetCalendarEvents.mockResolvedValue([
      {
        id: "late",
        date: "2026-11-12",
        start_minutes: 1380,
        duration_minutes: 120,
        title: "Wczorajsze late",
        tags: [],
        color: "#111",
        type: "meeting",
      },
      {
        id: "today",
        date: "2026-11-13",
        start_minutes: 780,
        duration_minutes: 60,
        title: "Dzisiejsze",
        tags: [],
        color: "#222",
        type: "meeting",
      },
    ]);
    const result = await getCockpit(new Date(2026, 10, 13, 9, 0));
    expect(result.events.map((e) => e.id)).toEqual(["today"]);
    expect(result.nextMeeting?.title).toBe("Dzisiejsze");
  });

  it("przenosi brief wydarzenia (K4)", async () => {
    mockGetCalendarEvents.mockResolvedValue([
      {
        id: "e1",
        date: "2026-11-13",
        start_minutes: 630,
        duration_minutes: 30,
        title: "Przegląd tygodnia",
        tags: [],
        color: "#111",
        type: "meeting",
        brief: "Wybrać focus\nDecyzja o fiszkach",
      },
    ]);
    const { events } = await getCockpit(TODAY);
    expect(events[0].brief).toBe("Wybrać focus\nDecyzja o fiszkach");
  });
});

describe("awaria jednego źródła nie wywraca reszty", () => {
  it("getTasks rzuca: kolejka z projektów, oś i tematy działają, jest ostrzeżenie", async () => {
    mockReadPinned.mockReturnValue({ ids: ["nexus"] });
    mockGetProject.mockReturnValue(project({ whereIStopped: "x" }));
    mockListNowTasks.mockReturnValue({
      tasks: [{ projectId: "p1", projectName: "P1", owner: "personal", text: "A", occurrence: 0 }],
      warnings: [],
    });
    mockGetTasks.mockRejectedValue(new Error("zły tasks.md"));
    mockGetCalendarEvents.mockResolvedValue([
      {
        id: "e1",
        date: "2026-11-13",
        start_minutes: 600,
        duration_minutes: 15,
        title: "E",
        tags: [],
        color: "#1",
        type: "work",
      },
    ]);

    const result = await getCockpit(TODAY);

    expect(result.topics).toHaveLength(1);
    expect(result.queue.map((g) => g.projectId)).toEqual(["p1"]);
    expect(result.events).toHaveLength(1);
    expect(result.warnings).toEqual(["Zadania ogólne: zły tasks.md"]);
  });

  it("kalendarz rzuca: pusta oś i ostrzeżenie", async () => {
    mockGetCalendarEvents.mockRejectedValue(new Error("zły kalendarz"));
    const result = await getCockpit(TODAY);
    expect(result.events).toEqual([]);
    expect(result.warnings).toEqual(["Kalendarz: zły kalendarz"]);
  });

  it("listNowTasks rzuca (zły rejestr): zadania ogólne nadal są w kolejce", async () => {
    mockListNowTasks.mockImplementation(() => {
      throw new Error("zły rejestr");
    });
    mockGetTasks.mockResolvedValue([task({ title: "Dziś", due_date: "2026-11-13" })]);
    const result = await getCockpit(TODAY);
    expect(result.queue[0].name).toBe("Ogólne");
    expect(result.warnings).toEqual(["Zadania projektów: zły rejestr"]);
  });
});

describe("setPinned", () => {
  it("zapisuje poprawną listę (kolejność zachowana) i zwraca ją", async () => {
    mockWritePinned.mockResolvedValue(undefined);
    await expect(setPinned(["monolith", "nexus"])).resolves.toEqual({
      ids: ["monolith", "nexus"],
    });
    expect(mockWritePinned).toHaveBeenCalledWith(["monolith", "nexus"]);
  });

  it("pusta lista jest dozwolona (odpięcie wszystkich)", async () => {
    await expect(setPinned([])).resolves.toEqual({ ids: [] });
    expect(mockWritePinned).toHaveBeenCalledWith([]);
  });

  it.each([
    ["nieznane id", ["nexus", "nie-ma"]],
    ["4 id", ["a", "b", "c", "d"]],
    ["duplikaty", ["nexus", "nexus"]],
  ])("%s: DomainError 400, nic nie zapisano", async (_name, ids) => {
    const err = await setPinned(ids).catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).statusCode).toBe(400);
    expect(mockWritePinned).not.toHaveBeenCalled();
  });
});

describe("git (K7)", () => {
  it("brak dostępnych repozytoriów: git === null, bez ostrzeżenia", async () => {
    const result = await getCockpit(TODAY);
    expect(result.git).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it("sumuje commity, liczy projekty z commitami i bierze gałąź pierwszego tematu", async () => {
    mockReadPinned.mockReturnValue({ ids: ["nexus", "monolith"] });
    mockGetProject.mockImplementation((id: string) => project({ id, name: id }));
    mockListGitActivity.mockReturnValue([
      { projectId: "monolith", branch: "main", commitsToday: 1 },
      { projectId: "nexus", branch: "feat/k7", commitsToday: 3 },
      { projectId: "inny", branch: null, commitsToday: 0 },
    ]);
    const result = await getCockpit(TODAY);
    expect(mockListGitActivity).toHaveBeenCalledWith(TODAY);
    expect(result.git).toEqual({ commitsToday: 4, projectsWithCommits: 2, branch: "feat/k7" });
  });

  it("pierwszy temat bez repo: gałąź null, liczniki zostają", async () => {
    mockReadPinned.mockReturnValue({ ids: ["nexus"] });
    mockGetProject.mockReturnValue(project());
    mockListGitActivity.mockReturnValue([{ projectId: "inny", branch: "x", commitsToday: 2 }]);
    expect((await getCockpit(TODAY)).git).toEqual({
      commitsToday: 2,
      projectsWithCommits: 1,
      branch: null,
    });
  });

  it("awaria gita: ostrzeżenie i git === null, reszta Kokpitu działa", async () => {
    mockListGitActivity.mockImplementation(() => {
      throw new Error("boom");
    });
    const result = await getCockpit(TODAY);
    expect(result.git).toBeNull();
    expect(result.warnings).toEqual(["Git: boom"]);
  });
});

const closing = (date: string, text = "t", over: Record<string, unknown> = {}) => ({
  date,
  text,
  projectId: null,
  commits: null,
  ...over,
});

describe("zamknięcie dnia (K6)", () => {
  it("getCockpit: zaczep = najnowszy wpis sprzed dziś, today = wpis z dziś", async () => {
    mockReadClosings.mockReturnValue([
      closing("2026-11-09", "stary"),
      closing("2026-11-12", "wczoraj"),
      closing("2026-11-13", "dziś"),
      closing("2026-11-14", "z przyszłości"),
    ]);
    const { closing: c } = await getCockpit(TODAY);
    expect(c.anchor?.text).toBe("wczoraj");
    expect(c.today?.text).toBe("dziś");
  });

  it("getCockpit: brak wpisów to puste zaczep i today", async () => {
    expect((await getCockpit(TODAY)).closing).toEqual({ anchor: null, today: null });
  });

  it("getCockpit: uszkodzony plik to ostrzeżenie, reszta działa", async () => {
    mockReadClosings.mockImplementation(() => {
      throw new Error("Nie można odczytać pliku Cockpit/closing.yaml: x");
    });
    const res = await getCockpit(TODAY);
    expect(res.closing).toEqual({ anchor: null, today: null });
    expect(res.warnings).toEqual([
      "Zamknięcie dnia: Nie można odczytać pliku Cockpit/closing.yaml: x",
    ]);
  });

  it("closeDay zapisuje dzisiejszą datę, przycięty tekst bez nowych linii i sumę commitów", async () => {
    mockListGitActivity.mockReturnValue([
      { projectId: "a", branch: null, commitsToday: 3 },
      { projectId: "b", branch: null, commitsToday: 2 },
    ]);
    const saved = await closeDay({ text: "  Zacząć\nod K6  ", projectId: null }, TODAY);
    expect(saved).toEqual({
      date: "2026-11-13",
      text: "Zacząć od K6",
      projectId: null,
      commits: 5,
    });
    expect(mockUpsertClosing).toHaveBeenCalledWith(saved);
  });

  it("closeDay: brak dostępnych repo to commits null, awaria gita nie blokuje zapisu", async () => {
    expect((await closeDay({ text: "x", projectId: null }, TODAY)).commits).toBeNull();
    mockListGitActivity.mockImplementation(() => {
      throw new Error("boom");
    });
    expect((await closeDay({ text: "x", projectId: null }, TODAY)).commits).toBeNull();
    expect(mockUpsertClosing).toHaveBeenCalledTimes(2);
  });

  it("closeDay: znany projekt przechodzi, nieznany to DomainError bez zapisu", async () => {
    const ok = await closeDay({ text: "x", projectId: "nexus" }, TODAY);
    expect(ok.projectId).toBe("nexus");
    mockUpsertClosing.mockClear();
    await expect(closeDay({ text: "x", projectId: "nie-ma" }, TODAY)).rejects.toBeInstanceOf(
      DomainError
    );
    expect(mockUpsertClosing).not.toHaveBeenCalled();
  });

  it("closeDay: pusty tekst i tekst > 300 znaków to DomainError", async () => {
    await expect(closeDay({ text: " \n ", projectId: null }, TODAY)).rejects.toBeInstanceOf(
      DomainError
    );
    await expect(
      closeDay({ text: "a".repeat(301), projectId: null }, TODAY)
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("historia commitów (K8)", () => {
  it("zakres to `days` dni kończących się dziś; dni bez commitów mają 0; sumy i projekty malejąco", async () => {
    mockListGitHistory.mockReturnValue([
      {
        projectId: "a",
        name: "A",
        days: { "2026-11-12": 2, "2026-11-13": 1 },
        prs: { "2026-11-12": 1 },
      },
      { projectId: "b", name: "B", days: { "2026-11-12": 5 }, prs: { "2026-11-12": 2 } },
    ]);
    const h = await getCommitHistory(3, TODAY);
    expect(mockListGitHistory).toHaveBeenCalledWith("2026-11-11", "2026-11-13");
    expect(h.from).toBe("2026-11-11");
    expect(h.to).toBe("2026-11-13");
    expect(h.total).toBe(8);
    expect(h.totalPrs).toBe(3);
    expect(h.days).toEqual([
      { date: "2026-11-11", total: 0, prs: 0, projects: [] },
      {
        date: "2026-11-12",
        total: 7,
        prs: 3,
        projects: [
          { projectId: "b", name: "B", count: 5 },
          { projectId: "a", name: "A", count: 2 },
        ],
      },
      {
        date: "2026-11-13",
        total: 1,
        prs: 0,
        projects: [{ projectId: "a", name: "A", count: 1 }],
      },
    ]);
  });

  it("zakres przechodzi przez granicę miesiąca i roku", async () => {
    await getCommitHistory(3, new Date(2027, 0, 1, 10));
    expect(mockListGitHistory).toHaveBeenCalledWith("2026-12-30", "2027-01-01");
  });

  it("brak dostępnych repozytoriów: `available: false`, puste dni", async () => {
    const h = await getCommitHistory(7, TODAY);
    expect(h.available).toBe(false);
    expect(h.days).toEqual([]);
    expect(h.total).toBe(0);
    expect(h.totalPrs).toBe(0);
  });

  it("dostępne repo bez commitów: `available: true` i dni z zerami", async () => {
    mockListGitHistory.mockReturnValue([{ projectId: "a", name: "A", days: {}, prs: {} }]);
    const h = await getCommitHistory(2, TODAY);
    expect(h.available).toBe(true);
    expect(h.days.map((d) => d.total)).toEqual([0, 0]);
  });

  it("ignoruje dni spoza zakresu; `days` poza 1–90 to DomainError", async () => {
    mockListGitHistory.mockReturnValue([
      { projectId: "a", name: "A", days: { "2020-01-01": 9 }, prs: { "2020-01-01": 4 } },
    ]);
    const out = await getCommitHistory(2, TODAY);
    expect(out.total).toBe(0);
    expect(out.totalPrs).toBe(0);
    await expect(getCommitHistory(0, TODAY)).rejects.toBeInstanceOf(DomainError);
    await expect(getCommitHistory(91, TODAY)).rejects.toBeInstanceOf(DomainError);
    await expect(getCommitHistory(2.5, TODAY)).rejects.toBeInstanceOf(DomainError);
  });
});

describe("inbox (K3)", () => {
  it("getCockpit zwraca liczbę otwartych wpisów inboxu", async () => {
    mockCountOpen.mockReturnValue(5);
    expect((await getCockpit(TODAY)).inbox).toEqual({ open: 5 });
  });

  it("błąd inboxu: ostrzeżenie i inbox === null, reszta działa", async () => {
    mockCountOpen.mockImplementation(() => {
      throw new Error("Nie można odczytać pliku Inbox/inbox.md: x");
    });
    const res = await getCockpit(TODAY);
    expect(res.inbox).toBeNull();
    expect(res.warnings).toEqual(["Inbox: Nie można odczytać pliku Inbox/inbox.md: x"]);
  });
});

describe("energia deep/quick (K2)", () => {
  it.each([
    ["Naprawić porty #deep", "deep", "Naprawić porty"],
    ["#quick Sprawdzić linki", "quick", "Sprawdzić linki"],
    ["Mail do klienta #Quick.", "quick", "Mail do klienta."],
    ["Coś [energy:: deep] ważnego", "deep", "Coś ważnego"],
    ["Zadanie #deep #quick", "deep", "Zadanie"],
    ["Zadanie #deeper", null, "Zadanie #deeper"],
    ["Zadanie bez tagu", null, "Zadanie bez tagu"],
    ["C# i F# #quick", "quick", "C# i F#"],
  ])("extractEnergy(%j)", (input, energy, title) => {
    expect(extractEnergy(input)).toEqual({ energy, title });
  });

  it("kolejka: zadania projektów i ogólne dostają energię, a tytuł jest czysty", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        {
          projectId: "p",
          projectName: "P",
          owner: "personal",
          priority: "high",
          text: "Porty #deep",
          occurrence: 0,
        },
        {
          projectId: "p",
          projectName: "P",
          owner: "personal",
          priority: "high",
          text: "Bez tagu",
          occurrence: 0,
        },
      ],
      warnings: [],
    });
    mockGetTasks.mockResolvedValue([
      task({ id: "1", title: "Faktura #quick", due_date: "2026-11-13" }),
    ]);
    const { queue } = await getCockpit(TODAY);
    const items = queue.flatMap((g) => g.items).map((i) => [i.title, i.energy]);
    expect(items).toEqual(
      expect.arrayContaining([
        ["Porty", "deep"],
        ["Bez tagu", null],
        ["Faktura", "quick"],
      ])
    );
  });
});

describe("okna Deep Work (K5)", () => {
  const ev = (start: number, dur: number) => ({
    id: `e${start}`,
    title: "x",
    startMinutes: start,
    durationMinutes: dur,
    type: "meeting" as const,
    color: "#000",
    link: null,
    brief: null,
  });
  type Spec = [title: string, energy: "deep" | "quick" | null, projectName?: string | null];
  const group = (...items: Spec[]) => [
    {
      projectId: "p",
      name: "P",
      owner: "personal" as const,
      items: items.map(([title, energy, projectName = "P"]) => ({
        kind: "now" as const,
        title,
        due: null,
        projectName,
        priority: null,
        energy,
        source: { type: "task" as const, taskId: title },
      })),
    },
  ];

  it("wolne okna między wydarzeniami dostają zadania: najpierw deep do okien ≥ 60 min, potem quick", () => {
    // zajęte 08:30–09:00 i 10:30–11:00; wolne 09:00–10:30 (90) i 11:00–23:00 (przycięte do 150)
    const out = planWindows(
      [ev(510, 30), ev(630, 30)],
      group(["Porty", "deep"], ["Linki", "quick"]),
      480
    );
    expect(out).toEqual([
      { startMinutes: 540, endMinutes: 630, energy: "deep", title: "Porty", projectName: "P" },
      { startMinutes: 660, endMinutes: 810, energy: "quick", title: "Linki", projectName: "P" },
    ]);
  });

  it("okno startuje nie wcześniej niż „teraz” (zaokrąglone w górę do 15 min)", () => {
    // 09:38 → 09:45; do 10:30 zostaje 45 min, więc tylko quick
    expect(planWindows([ev(630, 30)], group(["A", "quick"]), 9 * 60 + 38)).toEqual([
      { startMinutes: 585, endMinutes: 630, energy: "quick", title: "A", projectName: "P" },
    ]);
  });

  it("odcinki krótsze niż 45 min są pomijane; okno 45–59 min dostaje tylko quick", () => {
    expect(planWindows([ev(480, 30), ev(540, 840)], group(["A", "quick"]), 0)).toEqual([]);
    const only = planWindows([ev(480, 15), ev(540, 840)], group(["Deep", "deep"]), 0);
    expect(only).toEqual([]);
    const quick = planWindows(
      [ev(480, 15), ev(540, 840)],
      group(["Deep", "deep"], ["Szybkie", "quick"]),
      0
    );
    expect(quick).toEqual([
      { startMinutes: 495, endMinutes: 540, energy: "quick", title: "Szybkie", projectName: "P" },
    ]);
  });

  it("okna sięgają do 23:00 i nie wychodzą poza nią", () => {
    // wolne 18:00–23:00 (300 min, przycięte do 150), po 23:00 nic
    expect(planWindows([ev(480, 600)], group(["Wieczór", "deep"]), 0)).toEqual([
      { startMinutes: 1080, endMinutes: 1230, energy: "deep", title: "Wieczór", projectName: "P" },
    ]);
    expect(planWindows([], group(["A", "quick"]), 22 * 60 + 5)).toEqual([
      { startMinutes: 1335, endMinutes: 1380, energy: "quick", title: "A", projectName: "P" },
    ]);
  });

  it("maksymalnie 3 okna (najdłuższe wolne odcinki), w kolejności czasu", () => {
    const events = [ev(540, 15), ev(660, 15), ev(780, 15), ev(900, 15)];
    const tasks = group(["1", "deep"], ["2", "deep"], ["3", "deep"], ["4", "deep"], ["5", "deep"]);
    const out = planWindows(events, tasks, 0);
    expect(out).toHaveLength(3);
    expect(out.map((w) => w.startMinutes)).toEqual(
      [...out.map((w) => w.startMinutes)].sort((a, b) => a - b)
    );
  });

  it("zachodzące na siebie wydarzenia są łączone; wydarzenia poza 08–23 nie zawężają dnia", () => {
    const out = planWindows(
      [ev(480, 120), ev(540, 120), ev(1380, 60), ev(300, 60)],
      group(["A", "deep"]),
      0
    );
    expect(out).toEqual([
      { startMinutes: 660, endMinutes: 810, energy: "deep", title: "A", projectName: "P" },
    ]);
  });

  it("bez zadań z energią nic nie proponuje; zadanie ogólne ma projectName null", () => {
    expect(planWindows([], group(["Bez energii", null]), 0)).toEqual([]);
    expect(planWindows([], [], 0)).toEqual([]);
    const out = planWindows([], group(["Faktura", "quick", null]), 0);
    expect(out[0].projectName).toBeNull();
  });

  it("getCockpit zwraca okna z wydarzeń dnia i kolejki", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        {
          projectId: "p",
          projectName: "P",
          owner: "personal",
          priority: "high",
          text: "Porty #deep",
          occurrence: 0,
        },
      ],
      warnings: [],
    });
    const result = await getCockpit(new Date(2026, 10, 13, 8, 0));
    expect(result.windows).toEqual([
      { startMinutes: 480, endMinutes: 630, energy: "deep", title: "Porty", projectName: "P" },
    ]);
  });
});

describe("kolejność wg najbliższej daty", () => {
  it("dziś, potem zaległe od najświeższego (nie od najstarszego), potem [now::], na końcu bez terminu", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        {
          projectId: "p",
          projectName: "P",
          owner: "personal",
          priority: "",
          text: "Teraz",
          occurrence: 0,
        },
      ],
      warnings: [],
    });
    mockGetTasks.mockResolvedValue([
      task({ id: "1", title: "Bez daty" }),
      task({ id: "2", title: "Sierpień", due_date: "2026-08-06" }),
      task({ id: "3", title: "Wczoraj", due_date: "2026-11-12" }),
      task({ id: "4", title: "Dziś", due_date: "2026-11-13" }),
      task({ id: "5", title: "Tydzień temu", due_date: "2026-11-06" }),
    ]);
    const { queue } = await getCockpit(TODAY);
    expect(queue[0].items.map((i) => i.title)).toEqual([
      "Dziś",
      "Wczoraj",
      "Tydzień temu",
      "Sierpień",
      "Bez daty",
    ]);
  });
});

describe("domykanie zadań z kolejki", () => {
  it("źródło zadania: ogólne ma id, projektowe ma projekt i surowy tekst (z tagiem energii)", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        {
          projectId: "p",
          projectName: "P",
          owner: "personal",
          priority: "",
          text: "Porty #deep",
          occurrence: 0,
        },
      ],
      warnings: [],
    });
    mockGetTasks.mockResolvedValue([task({ id: "t9", title: "Faktura", due_date: "2026-11-13" })]);
    const { queue } = await getCockpit(TODAY);
    const items = queue.flatMap((g) => g.items);
    expect(items.find((i) => i.title === "Faktura")?.source).toEqual({
      type: "task",
      taskId: "t9",
    });
    expect(items.find((i) => i.title === "Porty")?.source).toEqual({
      type: "project",
      projectId: "p",
      text: "Porty #deep",
      occurrence: 0,
    });
  });

  it("zadanie ogólne: status done przez serwis zadań", async () => {
    mockUpdateTask.mockResolvedValue(undefined);
    await completeQueueItem({ type: "task", taskId: "t9" });
    expect(mockUpdateTask).toHaveBeenCalledWith("t9", { status: "done" });
    expect(mockCompleteNowTask).not.toHaveBeenCalled();
  });

  it("zadanie projektu: completeNowTask z projektem, tekstem i numerem wystąpienia", async () => {
    mockCompleteNowTask.mockResolvedValue(undefined);
    await completeQueueItem({
      type: "project",
      projectId: "p",
      text: "Porty #deep",
      occurrence: 2,
    });
    expect(mockCompleteNowTask).toHaveBeenCalledWith("p", "Porty #deep", 2);
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("błąd z serwisu przechodzi dalej", async () => {
    mockCompleteNowTask.mockRejectedValue(new NotFoundError("Nie ma projektu"));
    await expect(
      completeQueueItem({ type: "project", projectId: "x", text: "t", occurrence: 0 })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("następne spotkanie poza dniem dzisiejszym", () => {
  const cal = (date: string, over: Record<string, unknown> = {}) => ({
    id: `e-${date}`,
    date,
    start_minutes: 1200,
    duration_minutes: 60,
    title: "Career Guide",
    tags: [],
    color: "#00802b",
    type: "meeting",
    link: "https://meet.google.com/gon-fztr-zrn",
    ...over,
  });
  const future = [
    cal("2026-11-25"),
    cal("2026-11-16", { type: "work", title: "Praca" }),
    cal("2026-11-18"),
    cal("2026-11-17", { type: "task_deadline", title: "Termin" }),
  ];

  it("bez spotkań dziś bierze najbliższe przyszłe (tylko typ meeting) i podaje jego dzień", async () => {
    mockGetCalendarEvents.mockImplementation(async (r: { startDate: string; endDate: string }) =>
      r.startDate === r.endDate ? [] : future
    );
    const { nextMeeting } = await getCockpit(TODAY);
    expect(nextMeeting).toEqual({
      date: "2026-11-18",
      title: "Career Guide",
      startMinutes: 1200,
      durationMinutes: 60,
      link: "https://meet.google.com/gon-fztr-zrn",
    });
    expect(mockGetCalendarEvents).toHaveBeenCalledWith({
      startDate: "2026-11-14",
      endDate: "2027-01-12",
    });
  });

  it("gdy dzisiejsze spotkania już się skończyły, bierze przyszłe", async () => {
    mockGetCalendarEvents.mockImplementation(async (r: { startDate: string; endDate: string }) =>
      r.startDate === r.endDate
        ? [cal("2026-11-13", { start_minutes: 540, duration_minutes: 30 })]
        : future
    );
    const { nextMeeting } = await getCockpit(new Date(2026, 10, 13, 15, 0));
    expect(nextMeeting?.date).toBe("2026-11-18");
  });

  it("odpowiedź kalendarza z dzisiejszymi wydarzeniami w zapytaniu o przyszłość jest ignorowana", async () => {
    mockGetCalendarEvents.mockResolvedValue([
      cal("2026-11-13", { start_minutes: 540, duration_minutes: 30 }),
    ]);
    expect((await getCockpit(new Date(2026, 10, 13, 15, 0))).nextMeeting).toBeNull();
  });

  it("brak spotkań w ciągu 60 dni to null", async () => {
    mockGetCalendarEvents.mockResolvedValue([]);
    expect((await getCockpit(TODAY)).nextMeeting).toBeNull();
  });

  it("awaria kalendarza: jedno ostrzeżenie (bez dublowania), nextMeeting null", async () => {
    mockGetCalendarEvents.mockRejectedValue(new Error("boom"));
    const res = await getCockpit(TODAY);
    expect(res.nextMeeting).toBeNull();
    expect(res.warnings).toEqual(["Kalendarz: boom"]);
  });
});

describe("withEnergy", () => {
  it.each([
    ["Porty", "deep", "Porty #deep"],
    ["Porty #quick", "deep", "Porty #deep"],
    ["#quick Porty V2", "deep", "Porty V2 #deep"],
    ["Porty [energy:: deep]", "quick", "Porty #quick"],
    ["Porty #deep", null, "Porty"],
    ["Porty", null, "Porty"],
    ["Porty #deepwork", "quick", "Porty #deepwork #quick"],
    ["#quick", "deep", "#deep"],
  ] as const)("%s + %s → %s", (raw, energy, expected) => {
    expect(withEnergy(raw, energy)).toBe(expected);
  });

  it("zachowuje resztę tekstu bajt w bajt (spacje wewnątrz)", () => {
    expect(withEnergy("A  b   [due:: 2026-11-20]", "deep")).toBe("A  b   [due:: 2026-11-20] #deep");
  });

  it("wynik odczytuje extractEnergy", () => {
    expect(extractEnergy(withEnergy("Zadanie", "quick"))).toEqual({
      energy: "quick",
      title: "Zadanie",
    });
  });
});

describe("setQueueItemEnergy (K2b)", () => {
  beforeEach(() => {
    mockUpdateTask.mockReset();
    mockRewriteNowTask.mockReset();
  });

  it("zadanie ogólne: tytuł z nowym znacznikiem przez serwis zadań", async () => {
    mockGetTasks.mockResolvedValue([{ id: "t9", title: "Faktura #quick" }]);
    const next = await setQueueItemEnergy({ type: "task", taskId: "t9" }, "deep");
    expect(mockUpdateTask).toHaveBeenCalledWith("t9", { title: "Faktura #deep" });
    expect(next).toEqual({ type: "task", taskId: "t9" });
  });

  it("zadanie ogólne: brak zadania to NotFoundError, bez zapisu", async () => {
    mockGetTasks.mockResolvedValue([]);
    await expect(setQueueItemEnergy({ type: "task", taskId: "x" }, "deep")).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("zadanie projektu: rewriteNowTask ze starym i nowym tekstem; null zdejmuje znacznik", async () => {
    mockRewriteNowTask.mockResolvedValue(undefined);
    mockRewriteNowTask.mockResolvedValue(1);
    const quick = await setQueueItemEnergy(
      { type: "project", projectId: "p", text: "Porty", occurrence: 3 },
      "quick"
    );
    expect(mockRewriteNowTask).toHaveBeenLastCalledWith("p", "Porty", "Porty #quick", 3);
    // zwracane źródło ma nowy tekst i nowy numer wystąpienia: dalsze akcje trafiają w aktualną linię
    expect(quick).toEqual({
      type: "project",
      projectId: "p",
      text: "Porty #quick",
      occurrence: 1,
    });
    mockRewriteNowTask.mockResolvedValueOnce(0);
    const none = await setQueueItemEnergy(
      { type: "project", projectId: "p", text: "Porty #quick", occurrence: 1 },
      null
    );
    expect(mockRewriteNowTask).toHaveBeenLastCalledWith("p", "Porty #quick", "Porty", 1);
    expect(none).toEqual({ type: "project", projectId: "p", text: "Porty", occurrence: 0 });
  });

  it("zdjęcie energii z zadania będącego samym znacznikiem jest odrzucone (puste zadanie)", async () => {
    mockGetTasks.mockResolvedValue([{ id: "t1", title: "#deep" }]);
    await expect(setQueueItemEnergy({ type: "task", taskId: "t1" }, null)).rejects.toBeInstanceOf(
      DomainError
    );
    await expect(
      setQueueItemEnergy(
        { type: "project", projectId: "p", text: "[energy:: quick]", occurrence: 0 },
        null
      )
    ).rejects.toBeInstanceOf(DomainError);
    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockRewriteNowTask).not.toHaveBeenCalled();
  });

  it("bez zmiany (ten sam tekst) niczego nie zapisuje", async () => {
    const same = await setQueueItemEnergy(
      { type: "project", projectId: "p", text: "Porty #deep", occurrence: 0 },
      "deep"
    );
    expect(mockRewriteNowTask).not.toHaveBeenCalled();
    expect(same).toEqual({
      type: "project",
      projectId: "p",
      text: "Porty #deep",
      occurrence: 0,
    });
  });
});

describe("kolejka: rodzaj grupy (D8)", () => {
  const nowTask = (over: Record<string, unknown> = {}) => ({
    projectId: "p",
    projectName: "P",
    owner: "personal",
    kind: "biblioteka",
    companyData: false,
    priority: "high",
    text: "Zadanie",
    occurrence: 0,
    ...over,
  });

  it("grupa projektowa niesie kind i companyData z NowTask, grupa ogólna ich nie ma", async () => {
    mockListNowTasks.mockReturnValue({ tasks: [nowTask()], warnings: [] });
    mockGetTasks.mockResolvedValue([task({ title: "Ogólne zadanie" })]);
    const { queue } = await getCockpit(TODAY);
    const project = queue.find((g) => g.projectId === "p");
    const general = queue.find((g) => g.projectId === null);
    expect(project).toMatchObject({ kind: "biblioteka", companyData: false });
    expect(general).toBeDefined();
    expect("kind" in general!).toBe(false);
    expect("companyData" in general!).toBe(false);
  });
});

describe("kolejka: zadanie ogólne z projektem (spec zadań ogólnych, P4)", () => {
  const known = (over: Record<string, unknown> = {}) => ({
    id: "monolith",
    name: "Monolith",
    owner: "personal",
    type: undefined,
    ...over,
  });

  it("pozycja z `project` zostaje w grupie „Ogólne” i niesie rodzaj projektu", async () => {
    mockListProjects.mockReturnValue({ projects: [known()], warnings: [] });
    mockGetTasks.mockResolvedValue([task({ id: "t1", title: "Z projektu", project: "monolith" })]);
    const { queue } = await getCockpit(TODAY);
    expect(queue).toHaveLength(1);
    expect(queue[0].projectId).toBeNull();
    expect("kind" in queue[0]).toBe(false);
    expect(queue[0].items[0].project).toEqual({
      id: "monolith",
      name: "Monolith",
      kind: "wlasny",
      companyData: false,
    });
  });

  it("projekt etatowy dostaje kind etat i companyData", async () => {
    mockListProjects.mockReturnValue({
      projects: [known({ id: "firma", name: "Firma", type: "etat" })],
      warnings: [],
    });
    mockGetTasks.mockResolvedValue([task({ title: "Raport", project: "firma" })]);
    const { queue } = await getCockpit(TODAY);
    expect(queue[0].items[0].project).toMatchObject({ kind: "etat", companyData: true });
  });

  it("nieznany projekt i zadanie bez projektu: bez pola project, bez ostrzeżenia", async () => {
    mockListProjects.mockReturnValue({ projects: [known()], warnings: [] });
    mockGetTasks.mockResolvedValue([
      task({ id: "a", title: "Osierocone", project: "usuniety" }),
      task({ id: "b", title: "Zwykłe" }),
    ]);
    const { queue, warnings } = await getCockpit(TODAY);
    for (const item of queue[0].items) expect("project" in item).toBe(false);
    expect(warnings).toEqual([]);
  });

  it("błąd odczytu rejestru to ostrzeżenie, a zadania zostają bez koloru", async () => {
    mockListProjects.mockImplementation(() => {
      throw new Error("zły rejestr");
    });
    mockGetTasks.mockResolvedValue([task({ title: "Z projektu", project: "monolith" })]);
    const { queue, warnings } = await getCockpit(TODAY);
    expect(queue[0].items).toHaveLength(1);
    expect("project" in queue[0].items[0]).toBe(false);
    expect(warnings.some((w) => w.includes("zły rejestr"))).toBe(true);
  });

  it("bez zadań z projektem rejestr nie jest czytany dla kolejki", async () => {
    mockGetTasks.mockResolvedValue([task({ title: "Zwykłe" })]);
    await getCockpit(TODAY);
    // loadTopics/pin nie czytają listy przy pustych przypięciach, więc kolejka nie może jej wołać
    expect(mockListProjects).not.toHaveBeenCalled();
  });
});

describe("getReviewRequests", () => {
  const pr = (n: number, updatedAt: string) => ({
    repo: "o/r",
    number: n,
    title: `PR ${n}`,
    author: "a",
    url: `https://github.com/o/r/pull/${n}`,
    updatedAt,
    state: "open" as const,
    reason: "requested" as const,
  });

  it("sortuje malejąco po updatedAt", async () => {
    mockLoadReviewRequests.mockResolvedValue({
      available: true,
      updatesAvailable: true,
      total: 3,
      items: [
        pr(1, "2026-11-14T10:00:00Z"),
        pr(2, "2026-11-16T10:00:00Z"),
        pr(3, "2026-11-15T10:00:00Z"),
      ],
    });
    const res = await getReviewRequests();
    expect(res.available).toBe(true);
    expect(res.items.map((i) => i.number)).toEqual([2, 3, 1]);
  });

  it("przycina do 20 najnowszych, total zostaje pełny", async () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      pr(i + 1, new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString())
    ).reverse();
    mockLoadReviewRequests.mockResolvedValue({
      available: true,
      updatesAvailable: true,
      total: 25,
      items,
    });
    const res = await getReviewRequests();
    expect(res.total).toBe(25);
    expect(MAX_REVIEW_REQUESTS).toBe(20);
    expect(res.items).toHaveLength(20);
    expect(res.items[0].number).toBe(25);
    expect(res.items[19].number).toBe(6);
  });

  it("niedostępny GitHub przechodzi bez zmian", async () => {
    mockLoadReviewRequests.mockResolvedValue({
      available: false,
      updatesAvailable: false,
      total: 0,
      items: [],
    });
    expect(await getReviewRequests()).toEqual({
      available: false,
      updatesAvailable: false,
      total: 0,
      items: [],
    });
  });

  it("przekazuje updatesAvailable i sortuje razem prośby i „po review”", async () => {
    mockLoadReviewRequests.mockResolvedValue({
      available: true,
      updatesAvailable: false,
      total: 2,
      items: [
        { ...pr(1, "2026-11-14T10:00:00Z"), reason: "requested" },
        { ...pr(2, "2026-11-16T10:00:00Z"), reason: "updated" },
      ],
    });
    const res = await getReviewRequests();
    expect(res.updatesAvailable).toBe(false);
    expect(res.items.map((i) => [i.number, i.reason])).toEqual([
      [2, "updated"],
      [1, "requested"],
    ]);
  });
});

describe("getOpenPrs", () => {
  const pr = (n: number, updatedAt: string, draft = false) => ({
    repo: "o/r",
    number: n,
    title: `PR ${n}`,
    url: `https://github.com/o/r/pull/${n}`,
    updatedAt,
    draft,
  });

  it("sortuje malejąco po updatedAt", async () => {
    mockLoadOpenPrs.mockResolvedValue({
      available: true,
      total: 3,
      items: [
        pr(1, "2026-11-14T10:00:00Z"),
        pr(2, "2026-11-16T10:00:00Z"),
        pr(3, "2026-11-15T10:00:00Z", true),
      ],
    });
    const res = await getOpenPrs();
    expect(res.available).toBe(true);
    expect(res.items.map((i) => i.number)).toEqual([2, 3, 1]);
    expect(res.items[1].draft).toBe(true);
  });

  it("przycina do 20 najnowszych, total zostaje pełny", async () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      pr(i + 1, new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString())
    ).reverse();
    mockLoadOpenPrs.mockResolvedValue({ available: true, total: 25, items });
    const res = await getOpenPrs();
    expect(res.total).toBe(25);
    expect(MAX_OPEN_PRS).toBe(20);
    expect(res.items).toHaveLength(20);
    expect(res.items[0].number).toBe(25);
    expect(res.items[19].number).toBe(6);
  });

  it("niedostępny GitHub przechodzi bez zmian", async () => {
    mockLoadOpenPrs.mockResolvedValue({ available: false, total: 0, items: [] });
    expect(await getOpenPrs()).toEqual({ available: false, total: 0, items: [] });
  });
});

describe("getReviewHistory", () => {
  const TODAY_REVIEWS = new Date(2026, 10, 16, 10, 0);
  const at = (day: number, h: number, m = 0, month = 10) =>
    new Date(2026, month, day, h, m).toISOString();
  const rv = (
    number: number,
    state: "APPROVED" | "COMMENTED" | "CHANGES_REQUESTED",
    submittedAt: string
  ) => ({ repo: "o/r", number, state, submittedAt });

  it("liczy zatwierdzone i komentarze dzień po dniu, sumy i różne PR-y", async () => {
    mockLoadMyReviews.mockResolvedValue({
      available: true,
      reviews: [
        rv(1, "APPROVED", at(15, 18, 34)),
        rv(1, "COMMENTED", at(15, 10)),
        rv(2, "COMMENTED", at(14, 12)),
        rv(3, "APPROVED", at(16, 9)),
        rv(4, "CHANGES_REQUESTED", at(12, 12)),
        rv(5, "APPROVED", at(9, 12)),
        rv(6, "APPROVED", at(17, 12)),
      ],
    });
    const h = await getReviewHistory(7, TODAY_REVIEWS);
    expect(h.available).toBe(true);
    expect(h.from).toBe("2026-11-10");
    expect(h.to).toBe("2026-11-16");
    expect(h.days.map((d) => d.date)).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
    ]);
    expect(h.days.map((d) => [d.approved, d.comments])).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ]);
    expect(h.approved).toBe(2);
    expect(h.comments).toBe(2);
    expect(h.prs).toBe(4);
  });

  it("różne repozytoria z tym samym numerem to dwa różne PR-y", async () => {
    mockLoadMyReviews.mockResolvedValue({
      available: true,
      reviews: [
        { repo: "o/r", number: 1, state: "APPROVED", submittedAt: at(15, 10) },
        { repo: "x/y", number: 1, state: "COMMENTED", submittedAt: at(15, 11) },
      ],
    });
    expect((await getReviewHistory(7, TODAY_REVIEWS)).prs).toBe(2);
  });

  it("granica doby wg strefy lokalnej: 00:30 dnia 16 wchodzi, 23:30 dnia 9 odpada", async () => {
    mockLoadMyReviews.mockResolvedValue({
      available: true,
      reviews: [rv(1, "APPROVED", at(16, 0, 30)), rv(2, "APPROVED", at(9, 23, 30))],
    });
    const h = await getReviewHistory(7, TODAY_REVIEWS);
    expect(h.days[6]).toEqual({ date: "2026-11-16", approved: 1, comments: 0 });
    expect(h.approved).toBe(1);
    expect(h.prs).toBe(1);
  });

  it("prosi repozytorium o PR-y zmienione od dnia przed początkiem zakresu", async () => {
    mockLoadMyReviews.mockResolvedValue({ available: true, reviews: [] });
    await getReviewHistory(7, TODAY_REVIEWS);
    expect(mockLoadMyReviews).toHaveBeenCalledWith("2026-11-09");
  });

  it("niedostępny GitHub: available false, puste dni i zera", async () => {
    mockLoadMyReviews.mockResolvedValue({ available: false, reviews: [] });
    expect(await getReviewHistory(7, TODAY_REVIEWS)).toEqual({
      from: "2026-11-10",
      to: "2026-11-16",
      available: false,
      approved: 0,
      comments: 0,
      prs: 0,
      days: [],
    });
  });

  it.each([0, 91, 2.5, -1])(
    "days=%s to DomainError, repozytorium nie jest wołane",
    async (days) => {
      await expect(getReviewHistory(days, TODAY_REVIEWS)).rejects.toThrow(DomainError);
      expect(mockLoadMyReviews).not.toHaveBeenCalled();
    }
  );
});

describe("weekStart", () => {
  it.each([
    ["2026-11-16", "2026-11-16"], // poniedziałek
    ["2026-11-22", "2026-11-16"], // niedziela
    ["2026-11-23", "2026-11-23"], // następny poniedziałek
    ["2027-01-01", "2026-12-28"], // piątek, przez przełom roku
  ])("%s → %s", (day, expected) => {
    expect(weekStart(day)).toBe(expected);
  });
});

describe("setWeekFocus", () => {
  it("zapisuje przycięte zdanie pod poniedziałkiem bieżącego tygodnia", async () => {
    const focus = await setWeekFocus({ text: "  Domknąć   słownik tagów " }, TODAY);
    expect(focus).toEqual({ weekStart: "2026-11-09", text: "Domknąć słownik tagów" });
    expect(mockUpsertWeekFocus).toHaveBeenCalledWith(focus);
  });

  it("pusty tekst i same spacje to DomainError", async () => {
    await expect(setWeekFocus({ text: "" }, TODAY)).rejects.toThrow(DomainError);
    await expect(setWeekFocus({ text: "   " }, TODAY)).rejects.toThrow(DomainError);
    expect(mockUpsertWeekFocus).not.toHaveBeenCalled();
  });

  it("300 znaków przechodzi, 301 to DomainError", async () => {
    expect(MAX_FOCUS_TEXT).toBe(300);
    await expect(setWeekFocus({ text: "a".repeat(300) }, TODAY)).resolves.toBeDefined();
    await expect(setWeekFocus({ text: "a".repeat(301) }, TODAY)).rejects.toThrow(DomainError);
  });
});

describe("getCockpit: weekFocus", () => {
  it("zwraca focus bieżącego tygodnia (TODAY = piątek 2026-11-13, poniedziałek 2026-11-09)", async () => {
    mockReadWeekFocuses.mockReturnValue([
      { weekStart: "2026-11-02", text: "Poprzedni" },
      { weekStart: "2026-11-09", text: "Bieżący" },
    ]);
    const cockpit = await getCockpit(TODAY);
    expect(cockpit.weekFocus).toEqual({ weekStart: "2026-11-09", text: "Bieżący" });
    expect(cockpit.warnings).toEqual([]);
  });

  it("focus z poprzedniego tygodnia nie jest pokazywany", async () => {
    mockReadWeekFocuses.mockReturnValue([{ weekStart: "2026-11-02", text: "Poprzedni" }]);
    expect((await getCockpit(TODAY)).weekFocus).toBeNull();
  });

  it("uszkodzony plik to ostrzeżenie i `null`, nie wyjątek", async () => {
    mockReadWeekFocuses.mockImplementation(() => {
      throw new Error("weeks.yaml: zły YAML");
    });
    const cockpit = await getCockpit(TODAY);
    expect(cockpit.weekFocus).toBeNull();
    expect(cockpit.warnings).toContain("Focus tygodnia: weeks.yaml: zły YAML");
  });
});

const MONDAY = new Date(2026, 10, 16, 12, 0); // okno 2026-11-10 … 2026-11-16

const meeting = (id: string, date: string, type = "meeting") => ({
  id,
  date,
  start_minutes: 600,
  duration_minutes: 60,
  title: `Spotkanie ${id}`,
  tags: [],
  color: "#fff",
  type,
});

describe("getWeekReview", () => {
  beforeEach(() => {
    mockListProjects.mockReturnValue({
      projects: [
        { id: "monolith", name: "Monolith", owner: "personal", type: undefined },
        { id: "firma", name: "Firma", owner: "work", type: undefined },
      ],
      warnings: [],
    });
    mockListGitHistory.mockReturnValue([
      {
        projectId: "monolith",
        name: "Monolith",
        days: { "2026-11-12": 3, "2026-11-14": 2 },
        prs: { "2026-11-14": 1 },
      },
      { projectId: "firma", name: "Firma", days: { "2026-11-11": 10 }, prs: {} },
    ]);
    mockListGitSubjects.mockReturnValue([
      { projectId: "monolith", name: "Monolith", subjects: ["feat: a", "fix: b"] },
      { projectId: "firma", name: "Firma", subjects: ["tajny temat"] },
    ]);
    mockListDoneTasks.mockReturnValue([
      { projectId: "monolith", name: "Monolith", tasks: ["Zrobione zadanie"] },
      { projectId: "firma", name: "Firma", tasks: ["Tajne zadanie"] },
    ]);
    mockReadClosings.mockReturnValue([
      { date: "2026-11-09", text: "za wcześnie", projectId: null, commits: 1 },
      { date: "2026-11-12", text: "Zaczep Monolith", projectId: "monolith", commits: 2 },
      { date: "2026-11-13", text: "Tajne zamknięcie", projectId: "firma", commits: 1 },
    ]);
    mockGetCalendarEvents.mockResolvedValue([
      meeting("1", "2026-11-11"),
      meeting("2", "2026-11-12"),
      meeting("3", "2026-11-13"),
      meeting("4", "2026-11-13", "work"),
      meeting("5", "2026-11-14", "task_deadline"),
    ]);
    const submittedAt = new Date(2026, 10, 12, 10, 0).toISOString();
    mockLoadMyReviews.mockResolvedValue({
      available: true,
      reviews: [
        { repo: "o/r", number: 1, state: "APPROVED", submittedAt },
        { repo: "o/r", number: 2, state: "COMMENTED", submittedAt },
      ],
    });
  });

  it("zbiera dane z okna 7 dni i liczy sumy", async () => {
    const review = await getWeekReview(MONDAY);
    expect(review.from).toBe("2026-11-10");
    expect(review.to).toBe("2026-11-16");
    expect(review.weekStart).toBe("2026-11-16");
    expect(mockListGitHistory).toHaveBeenCalledWith("2026-11-10", "2026-11-16");
    expect(mockGetCalendarEvents).toHaveBeenCalledWith({
      startDate: "2026-11-10",
      endDate: "2026-11-16",
    });
    expect(review.git).toEqual({ available: true, commits: 15, prs: 1 });
    expect(review.reviews).toEqual({ available: true, approved: 1, comments: 1, prs: 2 });
    expect(review.meetings).toEqual({ count: 3, minutes: 180 });
    expect(review.closings.map((c) => c.date)).toEqual(["2026-11-12", "2026-11-13"]);
  });

  it("projekty: malejąco po commitach; zwykły ma tematy i zadania", async () => {
    const review = await getWeekReview(MONDAY);
    expect(review.projects.map((p) => p.projectId)).toEqual(["firma", "monolith"]);
    expect(review.projects[1]).toEqual({
      projectId: "monolith",
      name: "Monolith",
      work: false,
      commits: 5,
      prs: 1,
      subjects: ["feat: a", "fix: b"],
      doneTasks: ["Zrobione zadanie"],
    });
  });

  it("dane firmy: tylko nazwa i liczby; zamknięcie dnia bez treści; w prompcie nie ma sekretów", async () => {
    const review = await getWeekReview(MONDAY);
    expect(review.projects[0]).toEqual({
      projectId: "firma",
      name: "Firma",
      work: true,
      commits: 10,
      prs: 0,
      subjects: [],
      doneTasks: [],
    });
    expect(review.closings[1]).toEqual({ date: "2026-11-13", text: null, projectId: "firma" });
    expect(review.containsWork).toBe(true);
    expect(review.prompt).toContain("Firma (dane z firmy) — commity: 10, PR: 0");
    expect(review.prompt).toContain("Zaczep Monolith");
    expect(review.prompt).toContain("feat: a");
    expect(review.prompt).toContain("Zrobione zadanie");
    for (const secret of ["tajny temat", "Tajne zadanie", "Tajne zamknięcie"]) {
      expect(review.prompt).not.toContain(secret);
    }
  });

  it("projekt `type: etat` też jest maskowany (hasCompanyData)", async () => {
    mockListProjects.mockReturnValue({
      projects: [
        { id: "monolith", name: "Monolith", owner: "personal", type: "etat" },
        { id: "firma", name: "Firma", owner: "work", type: undefined },
      ],
      warnings: [],
    });
    const review = await getWeekReview(MONDAY);
    const monolith = review.projects.find((p) => p.projectId === "monolith");
    expect(monolith?.work).toBe(true);
    expect(monolith?.subjects).toEqual([]);
    expect(review.prompt).not.toContain("feat: a");
  });

  it("nieznany projekt (brak w rejestrze) jest traktowany jak dane firmy: fail-closed", async () => {
    mockListGitHistory.mockReturnValue([
      { projectId: "duch", name: "Duch", days: { "2026-11-11": 4 }, prs: {} },
    ]);
    mockListGitSubjects.mockReturnValue([
      { projectId: "duch", name: "Duch", subjects: ["sekret ducha"] },
    ]);
    mockReadClosings.mockReturnValue([
      { date: "2026-11-12", text: "Zamknięcie ducha", projectId: "duch", commits: 1 },
    ]);
    const review = await getWeekReview(MONDAY);
    expect(review.projects[0]).toMatchObject({ projectId: "duch", work: true, subjects: [] });
    expect(review.closings).toEqual([{ date: "2026-11-12", text: null, projectId: "duch" }]);
    expect(review.prompt).not.toContain("sekret ducha");
    expect(review.prompt).not.toContain("Zamknięcie ducha");
  });

  it("zamknięcie dnia bez projektu jest pokazywane", async () => {
    mockReadClosings.mockReturnValue([
      { date: "2026-11-12", text: "Ogólne zdanie", projectId: null, commits: 1 },
    ]);
    const review = await getWeekReview(MONDAY);
    expect(review.closings).toEqual([
      { date: "2026-11-12", text: "Ogólne zdanie", projectId: null },
    ]);
  });

  it("bez gita i gh: sekcje niedostępne, bez wyjątku", async () => {
    mockListGitHistory.mockReturnValue([]);
    mockListGitSubjects.mockReturnValue([]);
    mockListDoneTasks.mockReturnValue([]);
    mockLoadMyReviews.mockResolvedValue({ available: false, reviews: [] });
    const review = await getWeekReview(MONDAY);
    expect(review.git).toEqual({ available: false, commits: 0, prs: 0 });
    expect(review.reviews.available).toBe(false);
    expect(review.projects).toEqual([]);
    expect(review.prompt).toContain("Dane z gita niedostępne.");
    expect(review.prompt).not.toContain("## Review");
  });

  it("awaria zamknięć dnia albo kalendarza nie przerywa przeglądu", async () => {
    mockReadClosings.mockImplementation(() => {
      throw new Error("closing.yaml");
    });
    mockGetCalendarEvents.mockRejectedValue(new Error("kalendarz"));
    const review = await getWeekReview(MONDAY);
    expect(review.closings).toEqual([]);
    expect(review.meetings).toEqual({ count: 0, minutes: 0 });
  });
});

describe("composeWeekPrompt", () => {
  const base = (over: Partial<Omit<WeekReview, "prompt">> = {}): Omit<WeekReview, "prompt"> => ({
    from: "2026-11-10",
    to: "2026-11-16",
    weekStart: "2026-11-16",
    git: { available: true, commits: 20, prs: 0 },
    projects: [],
    closings: [],
    reviews: { available: false, approved: 0, comments: 0, prs: 0 },
    meetings: { count: 0, minutes: 0 },
    containsWork: false,
    ...over,
  });

  it("nagłówek i instrukcja dla agenta", () => {
    const prompt = composeWeekPrompt(base());
    expect(prompt).toContain("# Przegląd tygodnia 2026-11-10 – 2026-11-16");
    expect(prompt).toContain("Zaproponuj 1–3 tematy focusu na tydzień od 2026-11-16");
  });

  it("20 tematów commitów: wypisuje 15 i „… i 5 więcej”", () => {
    const subjects = Array.from({ length: 20 }, (_, i) => `temat ${i + 1}`);
    const prompt = composeWeekPrompt(
      base({
        projects: [
          {
            projectId: "m",
            name: "Monolith",
            work: false,
            commits: 20,
            prs: 2,
            subjects,
            doneTasks: [],
          },
        ],
      })
    );
    expect(MAX_WEEK_SUBJECTS).toBe(15);
    expect(prompt).toContain("- Monolith — commity: 20, PR: 2");
    expect(prompt).toContain("  - temat 15");
    expect(prompt).not.toContain("  - temat 16");
    expect(prompt).toContain("  - … i 5 więcej");
  });

  it("sekcje bez danych są pomijane, z danymi pojawiają się w kolejności", () => {
    const empty = composeWeekPrompt(base());
    for (const heading of [
      "## Zamknięte zadania",
      "## Zamknięcia dnia",
      "## Review",
      "## Spotkania",
    ]) {
      expect(empty).not.toContain(heading);
    }
    expect(empty).not.toContain("Uwaga:");
    const full = composeWeekPrompt(
      base({
        projects: [
          {
            projectId: "m",
            name: "M",
            work: false,
            commits: 1,
            prs: 0,
            subjects: [],
            doneTasks: ["Z1"],
          },
        ],
        closings: [
          { date: "2026-11-12", text: "Zaczep", projectId: null },
          { date: "2026-11-13", text: null, projectId: "f" },
        ],
        reviews: { available: true, approved: 2, comments: 1, prs: 3 },
        meetings: { count: 2, minutes: 90 },
        containsWork: true,
      })
    );
    const order = [
      "## Commity i PR-y",
      "## Zamknięte zadania (przybliżenie)",
      "## Zamknięcia dnia",
      "## Review",
      "## Spotkania",
      "Uwaga:",
    ].map((h) => full.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(full).toContain("- 2026-11-12: Zaczep");
    expect(full).toContain("- 2026-11-13: (dane z firmy, treść pominięta)");
    expect(full).toContain("Zatwierdzone: 2, komentarze: 1, PR-y: 3");
    expect(full).toContain("Spotkań: 2, łącznie 90 min");
  });
});
