// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistryEntry } from "@/contexts/bc_projects/models";
import type * as ProjectsRepo from "@/contexts/bc_projects/repositories";
import { ConflictError, NotFoundError } from "@/lib/errors";

const mockReadRegistry = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readRegistry>());
const mockReadProjectIndex = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectIndex>());
const mockReadProjectContent = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectContent>());
const mockReadProjectState = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectState>());
const mockReadDevlog = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readDevlog>());
const mockReadProjectBoard = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readProjectBoard>());
const mockArchiveDoneTasks = vi.hoisted(() => vi.fn<typeof ProjectsRepo.archiveDoneTasks>());

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
      archiveDoneTasks: mockArchiveDoneTasks,
    }) satisfies Partial<typeof ProjectsRepo>
);

import { archiveDone } from "@/contexts/bc_projects/services";

const NOW = new Date(2026, 10, 13, 12, 0);
const VERSION = { size: 12, hash: "a".repeat(64) };
const a: RegistryEntry = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "/tmp/a",
  owner: "personal",
};

describe("bc_projects services: archiveDone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadRegistry.mockReturnValue({ entries: [a], warnings: [] });
    mockReadProjectIndex.mockReturnValue({ whereIStopped: null, purpose: null });
    mockReadProjectContent.mockReturnValue({ tasks: [], bugs: [] });
    mockReadProjectState.mockReturnValue({ state: null, version: null });
    mockReadDevlog.mockReturnValue([]);
    mockReadProjectBoard.mockReturnValue({
      blockers: [],
      now: [],
      next: [],
      icebox: [],
      version: null,
    });
    mockArchiveDoneTasks.mockResolvedValue({ archived: 2, blocks: [] });
  });

  it("woła repozytorium z wersją, dniem serwera i progiem; zwraca świeży projekt i liczbę", async () => {
    const result = await archiveDone("a", VERSION, 3, NOW);
    expect(mockArchiveDoneTasks).toHaveBeenCalledWith(a, VERSION, {
      today: "2026-11-13",
      olderThanDays: 3,
    });
    expect(result.archived).toBe(2);
    expect(result.project.id).toBe("a");
  });

  it("błąd repozytorium (409) przechodzi dalej", async () => {
    mockArchiveDoneTasks.mockRejectedValue(new ConflictError("x"));
    await expect(archiveDone("a", VERSION, 7, NOW)).rejects.toBeInstanceOf(ConflictError);
  });

  it("nieznany projekt: NotFoundError, repozytorium nietknięte", async () => {
    await expect(archiveDone("nie-ma", VERSION, 7, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(mockArchiveDoneTasks).not.toHaveBeenCalled();
  });
});
