// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, ProjectState, RegistryEntry } from "@/contexts/bc_projects/models";
import { ConflictError, NotFoundError } from "@/lib/errors";

const mockReadRegistry = vi.hoisted(() => vi.fn());
const mockReadProjectIndex = vi.hoisted(() => vi.fn());
const mockReadProjectContent = vi.hoisted(() => vi.fn());
const mockReadProjectState = vi.hoisted(() => vi.fn());
const mockReadDevlog = vi.hoisted(() => vi.fn());
const mockWriteProjectState = vi.hoisted(() => vi.fn());
const mockAppendDevlogEntry = vi.hoisted(() => vi.fn());
const mockWriteProjectType = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/repositories", () => ({
  readRegistry: mockReadRegistry,
  readProjectIndex: mockReadProjectIndex,
  readProjectContent: mockReadProjectContent,
  readProjectState: mockReadProjectState,
  readDevlog: mockReadDevlog,
  writeProjectState: mockWriteProjectState,
  appendDevlogEntry: mockAppendDevlogEntry,
  writeProjectType: mockWriteProjectType,
}));

import {
  addDevlogEntry,
  effectiveLastWorked,
  freshness,
  getProject,
  listProjects,
  saveState,
  setProjectType,
  sortProjects,
} from "@/contexts/bc_projects/services";

const TODAY = new Date(2026, 10, 12);

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
    freshness: partial.freshness ?? "unknown",
    ...partial,
  };
}

describe("bc_projects services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadProjectState.mockReturnValue({ state: null, version: null });
    mockReadDevlog.mockReturnValue([]);
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
      return { lastWorked: "2026-11-05", whereIStopped: "ok" };
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

  it("getProject nieznany", () => {
    mockReadRegistry.mockReturnValue({ entries: [], warnings: [] });
    expect(() => getProject("zzz", TODAY)).toThrow(NotFoundError);
  });

  it("getProject błąd odczytu", () => {
    const a = entry({ id: "a" });
    mockReadRegistry.mockReturnValue({ entries: [a], warnings: [] });
    mockReadProjectIndex.mockReturnValue({ whereIStopped: null });
    const err = new Error("content boom");
    mockReadProjectContent.mockImplementation(() => {
      throw err;
    });
    expect(() => getProject("a", TODAY)).toThrow(err);
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
    mockReadProjectIndex.mockReturnValue({ lastWorked: "2026-11-05", whereIStopped: null });
    mockReadProjectContent.mockReturnValue({ tasks: [], bugs: [] });
    mockReadProjectState.mockReturnValue({ state: PREV, version: VERSION });
    mockReadDevlog.mockReturnValue([{ date: "2026-11-12", title: "T", why: "W" }]);
    mockWriteProjectState.mockReturnValue(VERSION);
    mockAppendDevlogEntry.mockResolvedValue(undefined);
    mockWriteProjectType.mockResolvedValue(undefined);
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
    mockReadProjectIndex.mockReturnValue({ lastWorked: "2026-10-23", whereIStopped: null });
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
    mockReadProjectIndex.mockReturnValue({ lastWorked: "2026-11-05", whereIStopped: "tu" });
    mockReadProjectState.mockImplementation(() => {
      throw new Error("state boom");
    });
    const result = listProjects(TODAY);
    expect(result.warnings).toEqual(["a: state boom"]);
    expect(result.projects[0]).toMatchObject({ id: "a", whereIStopped: "tu", freshness: "fresh" });
  });

  it("listProjects: świeżość uwzględnia state.updated", () => {
    mockReadProjectIndex.mockReturnValue({ lastWorked: "2026-10-01", whereIStopped: null });
    mockReadProjectState.mockReturnValue({
      state: { ...PREV, updated: "2026-11-12T08:00" },
      version: VERSION,
    });
    expect(listProjects(TODAY).projects[0].freshness).toBe("fresh");
  });

  it("saveState: updated z now, notes zachowane, wersja przekazana", async () => {
    const result = await saveState("a", INPUT, NOW);
    expect(mockWriteProjectState).toHaveBeenCalledWith(
      a,
      {
        branch: "main",
        env: "local",
        blocker: "",
        nextStep: "krok",
        links: ["https://a"],
        milestone: "M",
        milestoneDue: "2026-12-01",
        updated: "2026-11-13T09:15",
        notes: "stara notatka",
      },
      VERSION
    );
    expect(result.id).toBe("a");
  });

  it("saveState bez poprzedniego pliku: notes pusty, expected null", async () => {
    mockReadProjectState.mockReturnValue({ state: null, version: null });
    await saveState("a", { ...INPUT, version: null }, NOW);
    expect(mockWriteProjectState).toHaveBeenCalledWith(
      a,
      expect.objectContaining({ notes: "" }),
      null
    );
  });

  it("saveState: nieznany id bez zapisu", async () => {
    mockReadRegistry.mockReturnValue({ entries: [], warnings: [] });
    await expect(saveState("zzz", INPUT, NOW)).rejects.toThrow(NotFoundError);
    expect(mockWriteProjectState).not.toHaveBeenCalled();
  });

  it("saveState: ConflictError z repozytorium leci dalej", async () => {
    mockWriteProjectState.mockImplementation(() => {
      throw new ConflictError("Plik zmienił się w międzyczasie");
    });
    await expect(saveState("a", INPUT, NOW)).rejects.toThrow(ConflictError);
  });

  it("addDevlogEntry: data z now", async () => {
    const result = await addDevlogEntry("a", { title: "T", why: "W" }, new Date(2026, 10, 13));
    expect(mockAppendDevlogEntry).toHaveBeenCalledWith(a, {
      date: "2026-11-13",
      title: "T",
      why: "W",
    });
    expect(result.id).toBe("a");
  });

  it("addDevlogEntry: nieznany id bez zapisu", async () => {
    mockReadRegistry.mockReturnValue({ entries: [], warnings: [] });
    await expect(addDevlogEntry("zzz", { title: "T", why: "" })).rejects.toThrow(NotFoundError);
    expect(mockAppendDevlogEntry).not.toHaveBeenCalled();
  });

  it("setProjectType", async () => {
    const result = await setProjectType("a", "wlasny", TODAY);
    expect(mockWriteProjectType).toHaveBeenCalledWith(a, "wlasny");
    expect(result.id).toBe("a");
  });

  it("setProjectType: nieznany id bez zapisu", async () => {
    mockReadRegistry.mockReturnValue({ entries: [], warnings: [] });
    await expect(setProjectType("zzz", "etat")).rejects.toThrow(NotFoundError);
    expect(mockWriteProjectType).not.toHaveBeenCalled();
  });
});
