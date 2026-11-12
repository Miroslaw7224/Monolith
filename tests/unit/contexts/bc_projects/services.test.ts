// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, RegistryEntry } from "@/contexts/bc_projects/models";
import { NotFoundError } from "@/lib/errors";

const mockReadRegistry = vi.hoisted(() => vi.fn());
const mockReadProjectIndex = vi.hoisted(() => vi.fn());
const mockReadProjectContent = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/repositories", () => ({
  readRegistry: mockReadRegistry,
  readProjectIndex: mockReadProjectIndex,
  readProjectContent: mockReadProjectContent,
}));

import { freshness, getProject, listProjects, sortProjects } from "@/contexts/bc_projects/services";

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
