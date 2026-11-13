// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistryEntry } from "@/contexts/bc_projects/models";

const mockReadRegistry = vi.hoisted(() => vi.fn());
const mockReadGitActivity = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/repositories", () => ({
  readRegistry: mockReadRegistry,
  readGitActivity: mockReadGitActivity,
}));

import { listGitActivity } from "@/contexts/bc_projects/services";

const entry = (id: string): RegistryEntry => ({
  id,
  name: id.toUpperCase(),
  status: "active",
  priority: "high",
  folder: `Projects/${id}/`,
  localPath: `~/projects/${id}`,
  owner: "personal",
});

beforeEach(() => {
  vi.resetAllMocks();
  mockReadRegistry.mockReturnValue({ entries: [entry("a"), entry("b"), entry("c")], warnings: [] });
});

describe("listGitActivity", () => {
  it("pyta repozytorium o dzień lokalny `today` i pomija projekty bez dostępnego repo", () => {
    mockReadGitActivity.mockImplementation((e: RegistryEntry) =>
      e.id === "b"
        ? { ok: false }
        : { ok: true, commits: e.id === "a" ? 2 : 0, branch: `br-${e.id}` }
    );
    const result = listGitActivity(new Date(2026, 10, 3, 23, 59));
    expect(mockReadGitActivity).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a" }),
      "2026-11-03"
    );
    expect(result).toEqual([
      { projectId: "a", branch: "br-a", commitsToday: 2 },
      { projectId: "c", branch: "br-c", commitsToday: 0 },
    ]);
  });

  it("wyjątek z repozytorium jednego projektu nie psuje reszty", () => {
    mockReadGitActivity.mockImplementation((e: RegistryEntry) => {
      if (e.id === "a") throw new Error("boom");
      return { ok: true, commits: 1, branch: null };
    });
    expect(listGitActivity(new Date(2026, 10, 3)).map((a) => a.projectId)).toEqual(["b", "c"]);
  });

  it("błąd rejestru leci wyżej", () => {
    mockReadRegistry.mockImplementation(() => {
      throw new Error("registry");
    });
    expect(() => listGitActivity(new Date(2026, 10, 3))).toThrow("registry");
  });
});
