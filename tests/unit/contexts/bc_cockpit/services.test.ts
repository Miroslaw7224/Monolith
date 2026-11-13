// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, NotFoundError } from "@/lib/errors";

const mockReadPinned = vi.hoisted(() => vi.fn());
const mockWritePinned = vi.hoisted(() => vi.fn());
const mockReadClosings = vi.hoisted(() => vi.fn());
const mockUpsertClosing = vi.hoisted(() => vi.fn());
const mockGetProject = vi.hoisted(() => vi.fn());
const mockListNowTasks = vi.hoisted(() => vi.fn());
const mockListProjects = vi.hoisted(() => vi.fn());
const mockGetTasks = vi.hoisted(() => vi.fn());
const mockGetCalendarEvents = vi.hoisted(() => vi.fn());
const mockListGitActivity = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_cockpit/repositories", () => ({
  readPinned: mockReadPinned,
  writePinned: mockWritePinned,
  readClosings: mockReadClosings,
  upsertClosing: mockUpsertClosing,
}));
vi.mock("@/contexts/bc_projects/services", () => ({
  getProject: mockGetProject,
  listNowTasks: mockListNowTasks,
  listProjects: mockListProjects,
  listGitActivity: mockListGitActivity,
}));
vi.mock("@/contexts/bc_tasks/services", () => ({ getTasks: mockGetTasks }));
vi.mock("@/contexts/bc_calendar/services", () => ({ getCalendarEvents: mockGetCalendarEvents }));

import {
  closeDay,
  getCockpit,
  isPlausibleDate,
  localDate,
  pickNextMeeting,
  setPinned,
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
  mockReadClosings.mockReturnValue([]);
  mockUpsertClosing.mockResolvedValue(undefined);
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
        { projectId: "p", projectName: "P", owner: "personal", priority: "high", text: "Zadanie" },
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
      },
    ]);
    const result = await getCockpit(new Date(2026, 10, 13, 9, 48));
    expect(result.nextMeeting).toEqual({ title: "A", startMinutes: 630, durationMinutes: 30 });
  });
});

describe("kolejka na dziś", () => {
  it("kolejność: zaległe, dzisiejsze due, potem [now::]; grupy per projekt, ogólne jako „Ogólne”", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        {
          projectId: "p1",
          projectName: "Projekt 1",
          owner: "personal",
          priority: "high",
          text: "Plan",
        },
        {
          projectId: "p2",
          projectName: "Projekt 2",
          owner: "work",
          priority: "",
          text: "Raport",
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
            kind: "overdue",
            title: "Zaległe",
            due: "2026-11-10",
            projectName: null,
            priority: null,
          },
          {
            kind: "today",
            title: "Dziś",
            due: "2026-11-13",
            projectName: null,
            priority: null,
          },
        ],
      },
      {
        projectId: "p1",
        name: "Projekt 1",
        owner: "personal",
        items: [
          { kind: "now", title: "Plan", due: null, projectName: "Projekt 1", priority: "high" },
        ],
      },
      {
        projectId: "p2",
        name: "Projekt 2",
        owner: "work",
        items: [
          { kind: "now", title: "Raport", due: null, projectName: "Projekt 2", priority: null },
        ],
      },
    ]);
  });

  it("zadania [now::] kilku projektów nie mieszają grup, kilka zadań jednego projektu w jednej grupie", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        { projectId: "p1", projectName: "P1", owner: "personal", text: "A" },
        { projectId: "p2", projectName: "P2", owner: "personal", text: "B" },
        { projectId: "p1", projectName: "P1", owner: "personal", text: "C" },
      ],
      warnings: [],
    });
    const { queue } = await getCockpit(TODAY);
    expect(queue.map((g) => [g.projectId, g.items.map((i) => i.title)])).toEqual([
      ["p1", ["A", "C"]],
      ["p2", ["B"]],
    ]);
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
      },
      {
        id: "e2",
        title: "Praca",
        startMinutes: 780,
        durationMinutes: 60,
        type: "work",
        color: "#222",
      },
    ]);
  });
});

describe("awaria jednego źródła nie wywraca reszty", () => {
  it("getTasks rzuca: kolejka z projektów, oś i tematy działają, jest ostrzeżenie", async () => {
    mockReadPinned.mockReturnValue({ ids: ["nexus"] });
    mockGetProject.mockReturnValue(project({ whereIStopped: "x" }));
    mockListNowTasks.mockReturnValue({
      tasks: [{ projectId: "p1", projectName: "P1", owner: "personal", text: "A" }],
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
