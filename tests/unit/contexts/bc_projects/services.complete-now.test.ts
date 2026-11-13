// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardTask, RegistryEntry, TasksBoard } from "@/contexts/bc_projects/models";
import { ConflictError, NotFoundError } from "@/lib/errors";

const mockReadRegistry = vi.hoisted(() => vi.fn());
const mockReadProjectIndex = vi.hoisted(() => vi.fn());
const mockReadProjectContent = vi.hoisted(() => vi.fn());
const mockReadProjectState = vi.hoisted(() => vi.fn());
const mockReadDevlog = vi.hoisted(() => vi.fn());
const mockReadProjectBoard = vi.hoisted(() => vi.fn());
const mockWriteProjectTasks = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/repositories", () => ({
  readRegistry: mockReadRegistry,
  readProjectIndex: mockReadProjectIndex,
  readProjectContent: mockReadProjectContent,
  readProjectState: mockReadProjectState,
  readDevlog: mockReadDevlog,
  readProjectBoard: mockReadProjectBoard,
  writeProjectTasks: mockWriteProjectTasks,
}));

import { completeNowTask } from "@/contexts/bc_projects/services";

const NOW = new Date(2026, 10, 13, 9, 15);
const VERSION = { size: 10, hash: "h1" };
const entry: RegistryEntry = {
  id: "a",
  name: "A",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
};
const task = (text: string, done = false): BoardTask => ({ text, done });
const board = (now: BoardTask[]): TasksBoard => ({
  blockers: [],
  now,
  next: [],
  icebox: [],
  version: VERSION,
});

beforeEach(() => {
  vi.resetAllMocks();
  mockReadRegistry.mockReturnValue({ entries: [entry], warnings: [] });
  mockReadProjectIndex.mockReturnValue({ lastWorked: "2026-11-05", whereIStopped: null });
  mockReadProjectContent.mockReturnValue({ tasks: [], bugs: [] });
  mockReadProjectState.mockReturnValue({ state: null, version: null });
  mockReadDevlog.mockReturnValue([]);
  mockWriteProjectTasks.mockReturnValue(VERSION);
});

describe("completeNowTask", () => {
  it("znajduje zadanie w kolumnie Teraz po tekście i przełącza je (z aktualną wersją i datą dnia)", async () => {
    mockReadProjectBoard.mockReturnValue(board([task("X"), task("Y")]));
    await completeNowTask("a", "Y", NOW);
    expect(mockWriteProjectTasks).toHaveBeenCalledWith(
      entry,
      { op: "toggle", column: "now", index: 1, text: "Y" },
      VERSION,
      { today: "2026-11-13" }
    );
  });

  it("przy identycznych tekstach bierze pierwsze niezakończone", async () => {
    mockReadProjectBoard.mockReturnValue(board([task("Z", true), task("Z"), task("Z")]));
    await completeNowTask("a", "Z", NOW);
    expect(mockWriteProjectTasks.mock.calls[0][1]).toMatchObject({ index: 1 });
  });

  it("brak takiego zadania (plik zmienił się): ConflictError, bez zapisu", async () => {
    mockReadProjectBoard.mockReturnValue(board([task("X")]));
    await expect(completeNowTask("a", "Nie ma", NOW)).rejects.toBeInstanceOf(ConflictError);
    expect(mockWriteProjectTasks).not.toHaveBeenCalled();
  });

  it("nieznany projekt: NotFoundError", async () => {
    await expect(completeNowTask("zzz", "X", NOW)).rejects.toBeInstanceOf(NotFoundError);
  });
});
