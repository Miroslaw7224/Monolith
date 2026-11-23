// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BoardTask,
  Project,
  ProjectState,
  RegistryEntry,
  TasksBoard,
} from "@/contexts/bc_projects/models";
import type * as ProjectsRepo from "@/contexts/bc_projects/repositories";
import { NotFoundError } from "@/lib/errors";
import { PROJECT_KIND_CASES } from "./projectKindCases";

const mockReadRegistry = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readRegistry>());
const mockReadProjectIndex = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectIndex>());
const mockReadProjectContent = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectContent>());
const mockReadProjectState = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectState>());
const mockReadDevlog = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readDevlog>());
const mockReadProjectBoard = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectBoard>());

vi.mock(
  "@/contexts/bc_projects/repositories",
  () =>
    ({
      readRegistry: mockReadRegistry,
      readProjectIndex: mockReadProjectIndex,
      readProjectContent: mockReadProjectContent,
      readProjectState: mockReadProjectState,
      readDevlog: mockReadDevlog,
      readProjectBoard: mockReadProjectBoard,
    }) satisfies Partial<typeof ProjectsRepo>
);

import {
  effectiveLastWorked,
  freshness,
  getProject,
  hasCompanyData,
  isWorkProject,
  listNowTasks,
  listProjects,
  projectKind,
  sortProjects,
} from "@/contexts/bc_projects/services";

const TODAY = new Date(2026, 10, 12);
const EMPTY_BOARD: TasksBoard = { blockers: [], now: [], next: [], icebox: [], version: null };

function entry(partial: Partial<RegistryEntry> & Pick<RegistryEntry, "id">): RegistryEntry {
  return {
    name: partial.name ?? partial.id,
    status: partial.status ?? "active",
    priority: partial.priority ?? "medium",
    folder: partial.folder ?? `Projects/${partial.id}/`,
    localPath: partial.localPath ?? `/tmp/${partial.id}`,
    owner: "personal",
    ...partial,
  };
}

function project(partial: Partial<Project> & Pick<Project, "id">): Project {
  const e = entry(partial);
  return {
    ...e,
    whereIStopped: partial.whereIStopped ?? null,
    purpose: partial.purpose ?? null,
    freshness: partial.freshness ?? "unknown",
    ...partial,
  };
}

describe("bc_projects services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadProjectState.mockReturnValue({ state: null, version: null });
    mockReadDevlog.mockReturnValue([]);
    mockReadProjectBoard.mockReturnValue(EMPTY_BOARD);
  });

  it("freshness 14 dni", () => {
    expect(freshness("2026-10-29", TODAY)).toBe("fresh");
  });

  it("freshness 15 dni", () => {
    expect(freshness("2026-10-28", TODAY)).toBe("stale");
  });

  it('freshness brak / "abc" / "2026-13-45"', () => {
    expect(freshness(undefined, TODAY)).toBe("unknown");
    expect(freshness("abc", TODAY)).toBe("unknown");
    expect(freshness("2026-13-45", TODAY)).toBe("unknown");
  });

  it("freshness data z przyszłości", () => {
    expect(freshness("2026-11-20", TODAY)).toBe("fresh");
  });

  it("kolejność: śmieciowy lastWorked jest traktowany jak brak daty", () => {
    const sorted = sortProjects([
      project({
        id: "junk",
        name: "Junk",
        status: "active",
        lastWorked: "abc",
        freshness: "unknown",
      }),
      project({
        id: "real",
        name: "Real",
        status: "active",
        lastWorked: "2026-10-01",
        freshness: "stale",
      }),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["real", "junk"]);
  });

  it("kolejność D5", () => {
    const projects = [
      project({
        id: "done",
        name: "Done",
        status: "done",
        lastWorked: "2026-11-10",
        freshness: "fresh",
      }),
      project({
        id: "hold",
        name: "Hold",
        status: "on_hold",
        lastWorked: "2026-11-01",
        freshness: "fresh",
      }),
      project({ id: "active-brak", name: "Brak", status: "active", freshness: "unknown" }),
      project({
        id: "active-oct",
        name: "Oct",
        status: "active",
        lastWorked: "2026-10-01",
        freshness: "stale",
      }),
      project({
        id: "active-nov-b",
        name: "Beta",
        status: "active",
        lastWorked: "2026-11-05",
        freshness: "fresh",
      }),
      project({
        id: "maint",
        name: "Maint",
        status: "maintenance",
        lastWorked: "2026-11-11",
        freshness: "fresh",
      }),
      project({
        id: "active-nov-a",
        name: "Alfa",
        status: "active",
        lastWorked: "2026-11-05",
        freshness: "fresh",
      }),
    ];
    expect(sortProjects(projects).map((p) => p.id)).toEqual([
      "active-nov-a",
      "active-nov-b",
      "active-oct",
      "active-brak",
      "maint",
      "hold",
      "done",
    ]);
  });

  it("ostrzeżenie projektu", () => {
    const a = entry({ id: "a", name: "A" });
    const b = entry({ id: "b", name: "B", status: "active" });
    mockReadRegistry.mockReturnValue({ entries: [a, b], warnings: [] });
    mockReadProjectIndex.mockImplementation((e: RegistryEntry) => {
      if (e.id === "b") throw new Error("boom");
      return { lastWorked: "2026-11-05", whereIStopped: "ok", purpose: null };
    });

    const result = listProjects(TODAY);
    expect(result.warnings).toEqual(["b: boom"]);
    const projB = result.projects.find((p) => p.id === "b");
    expect(projB).toMatchObject({
      id: "b",
      name: "B",
      freshness: "unknown",
      whereIStopped: null,
    });
    const projA = result.projects.find((p) => p.id === "a");
    expect(projA).toMatchObject({
      id: "a",
      lastWorked: "2026-11-05",
      whereIStopped: "ok",
      freshness: "fresh",
    });
  });

  it("ostrzeżenia rejestru", () => {
    mockReadRegistry.mockReturnValue({ entries: [], warnings: ["w1"] });
    expect(listProjects(TODAY).warnings[0]).toBe("w1");
  });

  it("błąd rejestru leci dalej", () => {
    const err = new Error("registry boom");
    mockReadRegistry.mockImplementation(() => {
      throw err;
    });
    expect(() => listProjects(TODAY)).toThrow(err);
  });

  it("getProject", () => {
    const a = entry({ id: "a", name: "A" });
    mockReadRegistry.mockReturnValue({ entries: [a], warnings: [] });
    mockReadProjectIndex.mockReturnValue({
      lastWorked: "2026-11-05",
      whereIStopped: "tu",
      purpose: null,
    });
    mockReadProjectContent.mockReturnValue({
      tasks: [{ heading: "Next", items: [{ text: "A", done: false }] }],
      bugs: [{ id: "B-1", title: "x", section: "Aktywne" }],
    });

    const result = getProject("a", TODAY);
    expect(result).toMatchObject({
      id: "a",
      freshness: "fresh",
      whereIStopped: "tu",
      tasks: [{ heading: "Next", items: [{ text: "A", done: false }] }],
      bugs: [{ id: "B-1", title: "x", section: "Aktywne" }],
    });
  });

  it("getProject: bugi z wiekiem i powiązaniem z zadaniem", () => {
    const a = entry({ id: "a", name: "A" });
    mockReadRegistry.mockReturnValue({ entries: [a], warnings: [] });
    mockReadProjectIndex.mockReturnValue({
      lastWorked: "2026-11-05",
      whereIStopped: "tu",
      purpose: null,
    });
    mockReadProjectContent.mockReturnValue({
      tasks: [],
      bugs: [{ id: "B-1", title: "x", section: "Aktywne", opened: "2026-10-01" }],
    });
    mockReadProjectBoard.mockReturnValue({
      ...EMPTY_BOARD,
      next: [{ text: "Napraw (patrz B-1)", done: false }],
    });

    expect(getProject("a", TODAY).bugs).toEqual([
      {
        id: "B-1",
        title: "x",
        section: "Aktywne",
        opened: "2026-10-01",
        ageDays: 42,
        stale: true,
        task: { column: "next", done: false },
      },
    ]);
  });

  it("getProject nieznany", () => {
    mockReadRegistry.mockReturnValue({ entries: [], warnings: [] });
    expect(() => getProject("zzz", TODAY)).toThrow(NotFoundError);
  });

  it("getProject błąd odczytu", () => {
    const a = entry({ id: "a" });
    mockReadRegistry.mockReturnValue({ entries: [a], warnings: [] });
    mockReadProjectIndex.mockReturnValue({ whereIStopped: null, purpose: null });
    const err = new Error("content boom");
    mockReadProjectContent.mockImplementation(() => {
      throw err;
    });
    expect(() => getProject("a", TODAY)).toThrow(err);
  });
});

describe("isWorkProject", () => {
  it("true tylko dla owner work", () => {
    expect(isWorkProject({ owner: "work" })).toBe(true);
    expect(isWorkProject({ owner: "personal" })).toBe(false);
  });
});

describe("bc_projects services: Save State, devlog, type", () => {
  const a = entry({ id: "a", name: "A" });
  const NOW = new Date(2026, 10, 13, 9, 15);
  const VERSION = { size: 1, hash: "h" };
  const PREV: ProjectState = {
    branch: "stary",
    env: "",
    blocker: "",
    nextStep: "",
    links: [],
    milestone: "",
    updated: "2026-11-01T10:00",
    notes: "stara notatka",
  };
  const INPUT = {
    branch: "main",
    env: "local",
    blocker: "",
    nextStep: "krok",
    links: ["https://a"],
    milestone: "M",
    milestoneDue: "2026-12-01",
    version: VERSION,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadRegistry.mockReturnValue({ entries: [a], warnings: [] });
    mockReadProjectIndex.mockReturnValue({
      lastWorked: "2026-11-05",
      whereIStopped: null,
      purpose: null,
    });
    mockReadProjectContent.mockReturnValue({ tasks: [], bugs: [] });
    mockReadProjectState.mockReturnValue({ state: PREV, version: VERSION });
    mockReadDevlog.mockReturnValue([{ date: "2026-11-12", title: "T", why: "W" }]);
    mockReadProjectBoard.mockReturnValue(EMPTY_BOARD);
  });

  it.each([
    ["2026-10-23", "2026-11-12T09:00", "2026-11-12T09:00"],
    ["2026-11-12", "2026-10-01T10:00", "2026-11-12"],
    ["2026-10-01", "zła", "2026-10-01"],
    [undefined, "2026-11-12T09:00", "2026-11-12T09:00"],
    [undefined, undefined, undefined],
    ["2026-02-30", "2026-02-31", "2026-02-30"],
  ])("effectiveLastWorked(%s, %s)", (last, updated, expected) => {
    expect(effectiveLastWorked(last, updated)).toBe(expected);
  });

  it("getProject: świeżość z nowszej daty (state.updated) i dane state/devlog", () => {
    mockReadProjectIndex.mockReturnValue({
      lastWorked: "2026-10-23",
      whereIStopped: null,
      purpose: null,
    });
    mockReadProjectState.mockReturnValue({
      state: { ...PREV, updated: "2026-11-11T09:00" },
      version: VERSION,
    });
    const result = getProject("a", TODAY);
    expect(result.freshness).toBe("fresh");
    expect(result.state?.updated).toBe("2026-11-11T09:00");
    expect(result.stateVersion).toEqual(VERSION);
    expect(result.devlog).toEqual([{ date: "2026-11-12", title: "T", why: "W" }]);
  });

  it("getProject: błąd odczytu state.md leci dalej", () => {
    mockReadProjectState.mockImplementation(() => {
      throw new Error("Projects/a/state.md: zepsuty frontmatter");
    });
    expect(() => getProject("a", TODAY)).toThrow(/state\.md/);
  });

  it("listProjects: błąd state.md to ostrzeżenie, projekt zachowuje dane z indeksu", () => {
    mockReadProjectIndex.mockReturnValue({
      lastWorked: "2026-11-05",
      whereIStopped: "tu",
      purpose: null,
    });
    mockReadProjectState.mockImplementation(() => {
      throw new Error("state boom");
    });
    const result = listProjects(TODAY);
    expect(result.warnings).toEqual(["a: state boom"]);
    expect(result.projects[0]).toMatchObject({ id: "a", whereIStopped: "tu", freshness: "fresh" });
  });

  it("listProjects: świeżość uwzględnia state.updated", () => {
    mockReadProjectIndex.mockReturnValue({
      lastWorked: "2026-10-01",
      whereIStopped: null,
      purpose: null,
    });
    mockReadProjectState.mockReturnValue({
      state: { ...PREV, updated: "2026-11-12T08:00" },
      version: VERSION,
    });
    expect(listProjects(TODAY).projects[0].freshness).toBe("fresh");
  });
});

describe("bc_projects services: zadania projektu (odczyt tablicy)", () => {
  it("getProject zwraca board z repozytorium", () => {
    const a = entry({ id: "a", name: "A" });
    const version = { size: 10, hash: "h1" };
    const b: TasksBoard = { ...EMPTY_BOARD, version, next: [{ text: "A", done: false }] };
    mockReadRegistry.mockReturnValue({ entries: [a], warnings: [] });
    mockReadProjectIndex.mockReturnValue({ whereIStopped: null, purpose: null });
    mockReadProjectContent.mockReturnValue({ tasks: [], bugs: [] });
    mockReadProjectState.mockReturnValue({ state: null, version: null });
    mockReadDevlog.mockReturnValue([]);
    mockReadProjectBoard.mockReturnValue(b);
    expect(getProject("a", TODAY).board).toEqual(b);
  });
});

describe("listNowTasks", () => {
  beforeEach(() => {
    mockReadRegistry.mockReset();
    mockReadProjectBoard.mockReset();
    mockReadProjectIndex.mockReset();
  });

  const board = (now: BoardTask[]): TasksBoard => ({ ...EMPTY_BOARD, now });

  it("occurrence numeruje niezakończone zadania o identycznym tekście w obrębie projektu", () => {
    mockReadRegistry.mockReturnValue({ entries: [entry({ id: "nexus" })], warnings: [] });
    mockReadProjectBoard.mockReturnValue(
      board([
        { text: "Z", done: false },
        { text: "Z", done: true },
        { text: "Y", done: false },
        { text: "Z", done: false },
      ])
    );
    expect(listNowTasks().tasks.map((t) => [t.text, t.occurrence])).toEqual([
      ["Z", 0],
      ["Y", 0],
      ["Z", 1],
    ]);
  });

  it("zbiera niezakończone zadania Teraz ze wszystkich projektów razem z nazwą, owner i rodzajem", () => {
    mockReadRegistry.mockReturnValue({
      entries: [
        entry({ id: "nexus", name: "NEXUS" }),
        entry({ id: "firma", name: "Firma", owner: "work" }),
      ],
      warnings: [],
    });
    mockReadProjectIndex.mockReturnValue({ whereIStopped: null, purpose: null });
    mockReadProjectBoard.mockImplementation((e: RegistryEntry) =>
      e.id === "nexus"
        ? board([{ text: "Plan 2-1", done: false }])
        : board([{ text: "Raport", done: false }])
    );

    const { tasks, warnings } = listNowTasks();

    expect(tasks).toEqual([
      {
        projectId: "nexus",
        projectName: "NEXUS",
        owner: "personal",
        kind: "wlasny",
        companyData: false,
        priority: "medium",
        text: "Plan 2-1",
        occurrence: 0,
      },
      {
        projectId: "firma",
        projectName: "Firma",
        owner: "work",
        kind: "etat",
        companyData: true,
        priority: "medium",
        text: "Raport",
        occurrence: 0,
      },
    ]);
    expect(warnings).toEqual([]);
  });

  it("rodzaj zadania z `type` w index.md: personal + etat → etat i Dane z firmy", () => {
    mockReadRegistry.mockReturnValue({ entries: [entry({ id: "a" })], warnings: [] });
    mockReadProjectIndex.mockReturnValue({ whereIStopped: null, purpose: null, type: "etat" });
    mockReadProjectBoard.mockReturnValue(board([{ text: "Zadanie", done: false }]));

    const { tasks } = listNowTasks();

    expect(tasks[0]).toMatchObject({ kind: "etat", companyData: true, owner: "personal" });
  });

  it("uszkodzony index.md nie przerywa listy: rodzaj z samego owner", () => {
    mockReadRegistry.mockReturnValue({
      entries: [entry({ id: "a", owner: "work" })],
      warnings: [],
    });
    mockReadProjectIndex.mockImplementation(() => {
      throw new Error("zepsuty frontmatter");
    });
    mockReadProjectBoard.mockReturnValue(board([{ text: "Zadanie", done: false }]));

    const { tasks, warnings } = listNowTasks();

    expect(tasks[0]).toMatchObject({ kind: "etat", companyData: true });
    expect(warnings).toEqual([]);
  });

  it("pomija ukończone zadania", () => {
    mockReadRegistry.mockReturnValue({ entries: [entry({ id: "a" })], warnings: [] });
    mockReadProjectBoard.mockReturnValue(
      board([
        { text: "Zrobione", done: true, doneDate: "2026-11-12" },
        { text: "Do zrobienia", done: false },
      ])
    );
    expect(listNowTasks().tasks.map((t) => t.text)).toEqual(["Do zrobienia"]);
  });

  it("błąd odczytu tablicy jednego projektu to ostrzeżenie, reszta zostaje", () => {
    mockReadRegistry.mockReturnValue({
      entries: [entry({ id: "zly" }), entry({ id: "dobry" })],
      warnings: ["rejestr: ostrzeżenie"],
    });
    mockReadProjectBoard.mockImplementation((e: RegistryEntry) => {
      if (e.id === "zly") throw new Error("pęknięty tasks.md");
      return board([{ text: "Ok", done: false }]);
    });

    const { tasks, warnings } = listNowTasks();

    expect(tasks.map((t) => t.projectId)).toEqual(["dobry"]);
    expect(warnings).toEqual(["rejestr: ostrzeżenie", "zly: pęknięty tasks.md"]);
  });
});

describe("projectKind i hasCompanyData", () => {
  it.each(PROJECT_KIND_CASES)(
    "owner=%s type=%s → kind=%s, companyData=%s",
    (owner, type, kind, companyData) => {
      expect(projectKind(owner, type)).toBe(kind);
      expect(hasCompanyData(owner, type)).toBe(companyData);
    }
  );

  it("isWorkProject zależy tylko od owner: type: etat nie włącza blokad (D3)", () => {
    const etatOsobisty = { owner: "personal" as const, type: "etat" as const };
    expect(isWorkProject(etatOsobisty)).toBe(false);
    expect(isWorkProject({ owner: "work" })).toBe(true);
  });
});
