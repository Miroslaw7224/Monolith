// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistryEntry } from "@/contexts/bc_projects/models";

const mockResolve = vi.hoisted(() => vi.fn());
const mockHeadSha = vi.hoisted(() => vi.fn());
const mockRelation = vi.hoisted(() => vi.fn());
const mockCommitsInRange = vi.hoisted(() => vi.fn());
const mockDiffStat = vi.hoisted(() => vi.fn());

vi.mock("@/lib/git/repo-path", () => ({ resolveRepoPath: mockResolve }));
vi.mock("@/lib/git/project-git", () => ({
  headSha: mockHeadSha,
  relationToHead: mockRelation,
  commitsInRange: mockCommitsInRange,
  diffStatInRange: mockDiffStat,
  normalizeSha: (s: string) => s.trim().toLowerCase(),
}));
vi.mock("@/lib/git/repo-file", () => ({ readRepoFile: vi.fn() }));

import { readCodeSync, readGitRange, readHeadSha } from "@/contexts/bc_projects/repositories";

const entry: RegistryEntry = {
  id: "a",
  name: "A",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
};
const HEAD = "a".repeat(40);

beforeEach(() => {
  vi.clearAllMocks();
  mockResolve.mockReturnValue({ ok: true, path: "/home/u/projects/a" });
  mockHeadSha.mockReturnValue({ ok: true, sha: HEAD });
});

describe("readHeadSha", () => {
  it("pełny sha HEAD", () => {
    expect(readHeadSha(entry)).toBe(HEAD);
  });
  it("repo niedostępne albo bez commitów: null", () => {
    mockResolve.mockReturnValue({ ok: false, reason: "missing" });
    expect(readHeadSha(entry)).toBeNull();
    mockResolve.mockReturnValue({ ok: true, path: "/p" });
    mockHeadSha.mockReturnValue({ ok: false });
    expect(readHeadSha(entry)).toBeNull();
  });
});

describe("readCodeSync", () => {
  it("repo nierozwiązane: unavailable", () => {
    mockResolve.mockReturnValue({ ok: false, reason: "unsupported-path" });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "unavailable" });
  });
  it("brak HEAD: unavailable (bez pytania o relację)", () => {
    mockHeadSha.mockReturnValue({ ok: false });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "unavailable" });
    expect(mockRelation).not.toHaveBeenCalled();
  });
  it("ahead 0: current", () => {
    mockRelation.mockReturnValue({ kind: "ancestor", ahead: 0 });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "current", head: HEAD });
  });
  it("ahead 3: behind", () => {
    mockRelation.mockReturnValue({ kind: "ancestor", ahead: 3 });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "behind", ahead: 3, head: HEAD });
  });
  it("diverged / missing / error", () => {
    mockRelation.mockReturnValue({ kind: "diverged" });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "diverged", head: HEAD });
    mockRelation.mockReturnValue({ kind: "missing" });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "unknown-sha" });
    mockRelation.mockReturnValue({ kind: "error" });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "unavailable" });
  });
});

describe("readGitRange", () => {
  it("sha jest przodkiem: zakres od sha i diff --stat", () => {
    mockRelation.mockReturnValue({ kind: "ancestor", ahead: 2 });
    mockCommitsInRange.mockReturnValue({ ok: true, lines: ["b2 x", "a1 y"], total: 2 });
    mockDiffStat.mockReturnValue({ ok: true, stat: " f.ts | 2 +-" });
    expect(readGitRange(entry, "ABC1234")).toEqual({
      ok: true,
      head: HEAD,
      baseline: "abc1234",
      baselineLost: false,
      commits: ["b2 x", "a1 y"],
      total: 2,
      diffStat: " f.ts | 2 +-",
    });
    expect(mockCommitsInRange).toHaveBeenCalledWith("/home/u/projects/a", "abc1234", 30);
  });
  it("sha nie jest przodkiem: baselineLost, ostatnie commity bez sha", () => {
    mockRelation.mockReturnValue({ kind: "diverged" });
    mockCommitsInRange.mockReturnValue({ ok: true, lines: ["c3 z"], total: 40 });
    const res = readGitRange(entry, "abc1234");
    expect(res).toMatchObject({ ok: true, baseline: null, baselineLost: true, diffStat: "" });
    expect(mockCommitsInRange).toHaveBeenCalledWith("/home/u/projects/a", null, 30);
    expect(mockDiffStat).not.toHaveBeenCalled();
  });
  it("brak code_commit: baseline null, baselineLost false", () => {
    mockCommitsInRange.mockReturnValue({ ok: true, lines: ["c3 z"], total: 3 });
    expect(readGitRange(entry, undefined)).toMatchObject({
      ok: true,
      baseline: null,
      baselineLost: false,
    });
    expect(mockRelation).not.toHaveBeenCalled();
  });
  it("repo niedostępne albo log pada: ok false", () => {
    mockResolve.mockReturnValue({ ok: false, reason: "missing" });
    expect(readGitRange(entry, undefined)).toEqual({ ok: false });
    mockResolve.mockReturnValue({ ok: true, path: "/p" });
    mockCommitsInRange.mockReturnValue({ ok: false });
    expect(readGitRange(entry, undefined)).toEqual({ ok: false });
  });
});
