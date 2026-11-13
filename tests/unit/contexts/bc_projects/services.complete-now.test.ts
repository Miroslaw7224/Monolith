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

import { completeNowTask, rewriteNowTask } from "@/contexts/bc_projects/services";

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
    await completeNowTask("a", "Y", 0, NOW);
    expect(mockWriteProjectTasks).toHaveBeenCalledWith(
      entry,
      { op: "toggle", column: "now", index: 1, text: "Y" },
      VERSION,
      { today: "2026-11-13" }
    );
  });

  it("przy identycznych tekstach bierze pierwsze niezakończone", async () => {
    mockReadProjectBoard.mockReturnValue(board([task("Z", true), task("Z"), task("Z")]));
    await completeNowTask("a", "Z", 0, NOW);
    expect(mockWriteProjectTasks.mock.calls[0][1]).toMatchObject({ index: 1 });
  });

  it("occurrence wskazuje n-te niezakończone zadanie o tym samym tekście", async () => {
    mockReadProjectBoard.mockReturnValue(board([task("Z"), task("Y"), task("Z", true), task("Z")]));
    await completeNowTask("a", "Z", 1, NOW);
    expect(mockWriteProjectTasks.mock.calls[0][1]).toMatchObject({ index: 3, text: "Z" });
  });

  it("occurrence większe niż liczba takich zadań: ConflictError", async () => {
    mockReadProjectBoard.mockReturnValue(board([task("Z")]));
    await expect(completeNowTask("a", "Z", 1, NOW)).rejects.toBeInstanceOf(ConflictError);
    expect(mockWriteProjectTasks).not.toHaveBeenCalled();
  });

  it("brak takiego zadania (plik zmienił się): ConflictError, bez zapisu", async () => {
    mockReadProjectBoard.mockReturnValue(board([task("X")]));
    await expect(completeNowTask("a", "Nie ma", 0, NOW)).rejects.toBeInstanceOf(ConflictError);
    expect(mockWriteProjectTasks).not.toHaveBeenCalled();
  });

  it("nieznany projekt: NotFoundError", async () => {
    await expect(completeNowTask("zzz", "X", 0, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("rewriteNowTask", () => {
  it("podmienia tekst zadania z kolumny Teraz (op edit, z aktualną wersją pliku)", async () => {
    mockReadProjectBoard.mockReturnValue(board([task("X"), task("Y")]));
    await rewriteNowTask("a", "Y", "Y #deep", 0, NOW);
    expect(mockWriteProjectTasks).toHaveBeenCalledWith(
      entry,
      { op: "edit", column: "now", index: 1, text: "Y", newText: "Y #deep" },
      VERSION,
      { today: "2026-11-13" }
    );
  });

  it("brak takiego zadania (plik zmienił się): ConflictError, bez zapisu", async () => {
    mockReadProjectBoard.mockReturnValue(board([task("X", true)]));
    await expect(rewriteNowTask("a", "X", "X #deep", 0, NOW)).rejects.toBeInstanceOf(ConflictError);
    expect(mockWriteProjectTasks).not.toHaveBeenCalled();
  });
});

describe("rewriteNowTask: occurrence", () => {
  it("edytuje n-te niezakończone zadanie o tym tekście", async () => {
    mockReadProjectBoard.mockReturnValue(board([task("X"), task("X")]));
    await rewriteNowTask("a", "X", "X #quick", 1, NOW);
    expect(mockWriteProjectTasks.mock.calls[0][1]).toMatchObject({
      op: "edit",
      index: 1,
      text: "X",
      newText: "X #quick",
    });
  });

  it("zwraca occurrence nowego tekstu: ile niezakończonych zadań o nim stoi wcześniej", async () => {
    mockReadProjectBoard.mockReturnValue(
      board([task("X #deep"), task("X"), task("X #deep", true)])
    );
    // „X” z indeksu 1 staje się „X #deep”; wcześniej jest jedno otwarte „X #deep” (zamknięte się nie liczy)
    expect(await rewriteNowTask("a", "X", "X #deep", 0, NOW)).toBe(1);
    mockReadProjectBoard.mockReturnValue(board([task("A"), task("B")]));
    expect(await rewriteNowTask("a", "B", "B #deep", 0, NOW)).toBe(0);
  });
});
