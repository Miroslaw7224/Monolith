// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardTask, RegistryEntry } from "@/contexts/bc_projects/models";

const mockReadRegistry = vi.hoisted(() => vi.fn());
const mockReadGitSubjects = vi.hoisted(() => vi.fn());
const mockReadProjectBoard = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/repositories", () => ({
  readRegistry: mockReadRegistry,
  readGitSubjects: mockReadGitSubjects,
  readProjectBoard: mockReadProjectBoard,
}));

import { listDoneTasksInWindow, listGitSubjects } from "@/contexts/bc_projects/services";

const entry = (id: string): RegistryEntry => ({
  id,
  name: id.toUpperCase(),
  status: "active",
  priority: "high",
  folder: `Projects/${id}/`,
  localPath: `~/projects/${id}`,
  owner: "personal",
});

type Columns = Partial<Record<"blockers" | "now" | "next" | "icebox", BoardTask[]>>;
const board = (over: Columns = {}) => ({
  blockers: [],
  now: [],
  next: [],
  icebox: [],
  version: null,
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  mockReadRegistry.mockReturnValue({ entries: [entry("a"), entry("b")], warnings: [] });
});

describe("listGitSubjects", () => {
  it("pyta repozytorium o zakres dat i pomija projekty bez dostępnego repo", () => {
    mockReadGitSubjects.mockImplementation((e: RegistryEntry) =>
      e.id === "b" ? { ok: false } : { ok: true, subjects: ["feat: x", "fix: y"] }
    );
    expect(listGitSubjects("2026-11-10", "2026-11-16")).toEqual([
      { projectId: "a", name: "A", subjects: ["feat: x", "fix: y"] },
    ]);
    expect(mockReadGitSubjects).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a" }),
      "2026-11-10",
      "2026-11-16"
    );
  });

  it("wyjątek z repozytorium jednego projektu nie psuje reszty", () => {
    mockReadGitSubjects.mockImplementation((e: RegistryEntry) => {
      if (e.id === "a") throw new Error("boom");
      return { ok: true, subjects: ["c"] };
    });
    expect(listGitSubjects("2026-11-10", "2026-11-16").map((s) => s.projectId)).toEqual(["b"]);
  });
});

describe("listDoneTasksInWindow", () => {
  const FROM = "2026-11-10";
  const TO = "2026-11-16";

  it("bierze zamknięte zadania z `doneDate` w oknie (granice włącznie) ze wszystkich kolumn", () => {
    mockReadProjectBoard.mockImplementation((e: RegistryEntry) =>
      e.id === "a"
        ? board({
            blockers: [{ text: "z blokerów", done: true, doneDate: "2026-11-10" }],
            now: [{ text: "z teraz", done: true, doneDate: "2026-11-16" }],
            next: [
              { text: "za wcześnie", done: true, doneDate: "2026-11-09" },
              { text: "bez daty", done: true },
              { text: "otwarte", done: false },
            ],
            icebox: [{ text: "z lodówki", done: true, doneDate: "2026-11-12" }],
          })
        : board()
    );
    expect(listDoneTasksInWindow(FROM, TO)).toEqual([
      { projectId: "a", name: "A", tasks: ["z blokerów", "z teraz", "z lodówki"] },
    ]);
  });

  it("wyjątek przy tablicy jednego projektu nie psuje reszty", () => {
    mockReadProjectBoard.mockImplementation((e: RegistryEntry) => {
      if (e.id === "a") throw new Error("boom");
      return board({ now: [{ text: "ok", done: true, doneDate: "2026-11-11" }] });
    });
    expect(listDoneTasksInWindow(FROM, TO).map((d) => d.projectId)).toEqual(["b"]);
  });
});
