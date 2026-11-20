// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CodeSync, ProjectState, RegistryEntry } from "@/contexts/bc_projects/models";
import type * as ProjectsRepo from "@/contexts/bc_projects/repositories";
import { ConflictError, DomainError } from "@/lib/errors";

const mockReadRegistry = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readRegistry>());
const mockReadProjectIndex = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectIndex>());
const mockReadProjectContent = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectContent>());
const mockReadProjectState = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectState>());
const mockReadDevlog = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readDevlog>());
const mockReadProjectBoard = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectBoard>());
const mockWriteProjectState = vi.hoisted(() => vi.fn<typeof ProjectsRepo.writeProjectState>());
const mockReadCodeSync = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readCodeSync>());
const mockReadHeadSha = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readHeadSha>());

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
      writeProjectState: mockWriteProjectState,
      readCodeSync: mockReadCodeSync,
      readHeadSha: mockReadHeadSha,
    }) satisfies Partial<typeof ProjectsRepo>
);

import {
  getCodeSync,
  getProject,
  listCodeSync,
  listProjects,
  markCodeSynced,
  saveState,
} from "@/contexts/bc_projects/services";

const entry: RegistryEntry = {
  id: "a",
  name: "A",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
};
const HEAD = "f".repeat(40);
const SHA = "abc1234";
const VERSION = { size: 10, hash: "h1" };
const TODAY = new Date(2026, 10, 16);

function state(over: Partial<ProjectState> = {}): ProjectState {
  return {
    branch: "main",
    env: "",
    blocker: "",
    nextStep: "x",
    links: [],
    milestone: "",
    updated: "2026-11-10T10:00",
    notes: "notatki",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReadRegistry.mockReturnValue({ entries: [entry], warnings: [] });
  mockReadProjectIndex.mockReturnValue({ whereIStopped: null, purpose: null });
  mockReadProjectContent.mockReturnValue({ tasks: [], bugs: [] });
  mockReadDevlog.mockReturnValue([]);
  mockReadProjectBoard.mockReturnValue({
    blockers: [],
    now: [],
    next: [],
    icebox: [],
    version: null,
  });
  mockReadProjectState.mockReturnValue({ state: null, version: null });
  mockReadHeadSha.mockReturnValue(HEAD);
});

describe("getCodeSync / getProject", () => {
  it("bez state.md: no-baseline i brak wywołania gita", () => {
    expect(getCodeSync("a")).toEqual({ status: "no-baseline" });
    expect(mockReadCodeSync).not.toHaveBeenCalled();
  });
  it("state.md bez code_commit: no-baseline", () => {
    mockReadProjectState.mockReturnValue({ state: state(), version: VERSION });
    expect(getCodeSync("a")).toEqual({ status: "no-baseline" });
  });
  it("z code_commit: wynik readCodeSync dla tego sha", () => {
    mockReadProjectState.mockReturnValue({ state: state({ codeCommit: SHA }), version: VERSION });
    mockReadCodeSync.mockReturnValue({ status: "behind", ahead: 2, head: HEAD });
    expect(getCodeSync("a")).toEqual({ status: "behind", ahead: 2, head: HEAD });
    expect(mockReadCodeSync).toHaveBeenCalledWith(entry, SHA);
  });
  it("ręcznie wpisany, niepoprawny code_commit: unknown-sha bez pytania gita", () => {
    mockReadProjectState.mockReturnValue({ state: state({ codeCommit: "xyz" }), version: VERSION });
    expect(getCodeSync("a")).toEqual({ status: "unknown-sha" });
    expect(mockReadCodeSync).not.toHaveBeenCalled();
  });
  it("getProject dołącza codeSync", () => {
    mockReadProjectState.mockReturnValue({ state: state({ codeCommit: SHA }), version: VERSION });
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    expect(getProject("a", TODAY).codeSync).toEqual({ status: "current", head: HEAD });
  });
});

describe("listProjects", () => {
  it("nie woła gita (lista zostaje szybka)", () => {
    mockReadProjectState.mockReturnValue({ state: state({ codeCommit: SHA }), version: VERSION });
    listProjects(TODAY);
    expect(mockReadCodeSync).not.toHaveBeenCalled();
    expect(mockReadHeadSha).not.toHaveBeenCalled();
  });
});

describe("listCodeSync", () => {
  it("mapa po id; wyjątek jednego projektu daje unavailable tylko dla niego", () => {
    const b: RegistryEntry = { ...entry, id: "b", folder: "Projects/b/" };
    mockReadRegistry.mockReturnValue({ entries: [entry, b], warnings: [] });
    mockReadProjectState.mockImplementation((e: RegistryEntry) => {
      if (e.id === "b") throw new Error("zepsuty frontmatter");
      return { state: state({ codeCommit: SHA }), version: VERSION };
    });
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    expect(listCodeSync()).toEqual({
      a: { status: "current", head: HEAD },
      b: { status: "unavailable" },
    });
  });
});

describe("saveState", () => {
  it("zachowuje code_commit z istniejącego state.md", async () => {
    mockReadProjectState.mockReturnValue({ state: state({ codeCommit: SHA }), version: VERSION });
    await saveState(
      "a",
      {
        branch: "dev",
        env: "",
        blocker: "",
        nextStep: "nowy krok",
        links: [],
        milestone: "",
        version: VERSION,
      },
      TODAY
    );
    expect(mockWriteProjectState).toHaveBeenCalledWith(
      entry,
      expect.objectContaining({ codeCommit: SHA, branch: "dev", notes: "notatki" }),
      VERSION
    );
  });
});

describe("markCodeSynced", () => {
  beforeEach(() => {
    mockReadProjectState.mockReturnValue({ state: state(), version: VERSION });
  });

  it("zapisuje code_commit, nie rusza updated ani notatek, używa tokenu wersji", async () => {
    mockReadCodeSync.mockReturnValue({ status: "behind", ahead: 2, head: HEAD });
    await markCodeSynced("a", SHA, TODAY);
    expect(mockReadCodeSync).toHaveBeenCalledWith(entry, SHA);
    expect(mockWriteProjectState).toHaveBeenCalledWith(
      entry,
      expect.objectContaining({
        codeCommit: SHA,
        updated: "2026-11-10T10:00",
        notes: "notatki",
      }),
      VERSION
    );
  });

  it("bez commit w wywołaniu bierze HEAD", async () => {
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    await markCodeSynced("a", undefined, TODAY);
    expect(mockReadCodeSync).toHaveBeenCalledWith(entry, HEAD);
    expect(mockWriteProjectState).toHaveBeenCalledWith(
      entry,
      expect.objectContaining({ codeCommit: HEAD }),
      VERSION
    );
  });

  it("brak state.md: tworzy plik z pustymi polami, bez updated, expected null", async () => {
    mockReadProjectState.mockReturnValue({ state: null, version: null });
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    await markCodeSynced("a", SHA, TODAY);
    const [, written, expected] = mockWriteProjectState.mock.calls[0];
    expect(written).toEqual({
      branch: "",
      env: "",
      blocker: "",
      nextStep: "",
      links: [],
      milestone: "",
      notes: "",
      codeCommit: SHA,
    });
    expect(expected).toBeNull();
  });

  it.each<[CodeSync]>([
    [{ status: "diverged", head: HEAD }],
    [{ status: "unknown-sha" }],
    [{ status: "unavailable" }],
  ])("odrzuca commit, gdy readCodeSync = %j", async (sync) => {
    mockReadCodeSync.mockReturnValue(sync);
    await expect(markCodeSynced("a", SHA, TODAY)).rejects.toBeInstanceOf(DomainError);
    expect(mockWriteProjectState).not.toHaveBeenCalled();
  });

  it("niepoprawny format sha: DomainError bez pytania o git", async () => {
    await expect(markCodeSynced("a", "--help", TODAY)).rejects.toBeInstanceOf(DomainError);
    expect(mockReadCodeSync).not.toHaveBeenCalled();
  });

  it("repo bez HEAD i brak commit: DomainError", async () => {
    mockReadHeadSha.mockReturnValue(null);
    await expect(markCodeSynced("a", undefined, TODAY)).rejects.toBeInstanceOf(DomainError);
  });

  it("zmiana pliku w międzyczasie: ConflictError leci dalej", async () => {
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    mockWriteProjectState.mockImplementation(() => {
      throw new ConflictError("Plik zmienił się");
    });
    await expect(markCodeSynced("a", SHA, TODAY)).rejects.toBeInstanceOf(ConflictError);
  });
});
