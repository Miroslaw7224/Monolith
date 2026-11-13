// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistryEntry } from "@/contexts/bc_projects/models";
import { useTempVault } from "../../helpers/tempVault";

const mockResolve = vi.hoisted(() => vi.fn());
const mockSnapshot = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());
const mockCommitsSince = vi.hoisted(() => vi.fn());
const mockCurrentBranch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/git/repo-path", () => ({ resolveRepoPath: mockResolve }));
vi.mock("@/lib/git/project-git", () => ({
  snapshotRepo: mockSnapshot,
  commitsSince: mockCommitsSince,
  currentBranch: mockCurrentBranch,
}));
vi.mock("@/lib/git/repo-file", () => ({ readRepoFile: mockReadFile }));

import {
  readAiContext,
  readGitActivity,
  readGitSnapshot,
  readIndexRules,
  readRepoRules,
} from "@/contexts/bc_projects/repositories";

const entry: RegistryEntry = {
  id: "a",
  name: "A",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
};

const vault = useTempVault();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readAiContext", () => {
  it("przycięta treść pliku", () => {
    vault.write("Projects/a/ai-context.md", "\n  Reguły\n");
    expect(readAiContext(entry)).toBe("Reguły");
  });

  it("brak pliku albo same spacje: null", () => {
    expect(readAiContext(entry)).toBeNull();
    vault.write("Projects/a/ai-context.md", "  \n \n");
    expect(readAiContext(entry)).toBeNull();
  });
});

describe("readIndexRules", () => {
  it("trzy znane sekcje w kolejności pliku, bez frontmattera i innych sekcji", () => {
    vault.write(
      "Projects/a/index.md",
      [
        "---",
        "last_worked: 2026-11-01",
        "---",
        "## Tech Stack",
        "Next",
        "",
        "## Inne",
        "X",
        "",
        "## Architektura",
        "A",
        "",
        "## Pułapki",
        "P",
      ].join("\n")
    );
    expect(readIndexRules(entry)).toEqual([
      { heading: "Tech Stack", body: "Next" },
      { heading: "Architektura", body: "A" },
      { heading: "Pułapki", body: "P" },
    ]);
  });

  it("brak znanych sekcji albo brak pliku: pusta lista", () => {
    expect(readIndexRules(entry)).toEqual([]);
    vault.write("Projects/a/index.md", "## Inne\nX\n");
    expect(readIndexRules(entry)).toEqual([]);
  });
});

describe("readGitSnapshot", () => {
  it("odmowa ścieżki: powód przekazany, git niewołany", () => {
    mockResolve.mockReturnValue({ ok: false, reason: "outside-home" });
    expect(readGitSnapshot(entry)).toEqual({ ok: false, reason: "outside-home" });
    expect(mockResolve).toHaveBeenCalledWith("~/projects/a");
    expect(mockSnapshot).not.toHaveBeenCalled();
  });

  it("ścieżka ok: wynik snapshotRepo", () => {
    const snapshot = { status: "## main", log: "abc init", diffStat: "" };
    mockResolve.mockReturnValue({ ok: true, path: "/h/p" });
    mockSnapshot.mockReturnValue({ ok: true, snapshot });
    expect(readGitSnapshot(entry)).toEqual({ ok: true, snapshot });
    expect(mockSnapshot).toHaveBeenCalledWith("/h/p");
  });

  it("git-error jest przepuszczony", () => {
    mockResolve.mockReturnValue({ ok: true, path: "/h/p" });
    mockSnapshot.mockReturnValue({ ok: false, reason: "git-error" });
    expect(readGitSnapshot(entry)).toEqual({ ok: false, reason: "git-error" });
  });
});

describe("readRepoRules", () => {
  beforeEach(() => {
    mockResolve.mockReturnValue({ ok: true, path: "/h/p" });
  });

  it.each([
    [
      { ok: false, reason: "missing" },
      { ok: false, reason: "no-file" },
    ],
    [
      { ok: false, reason: "unsafe" },
      { ok: false, reason: "unsafe-file" },
    ],
    [
      { ok: true, text: "T" },
      { ok: true, text: "T" },
    ],
  ])("odczyt %j → %j", (fileResult, expected) => {
    mockReadFile.mockReturnValue(fileResult);
    expect(readRepoRules(entry)).toEqual(expected);
    expect(mockReadFile).toHaveBeenCalledWith("/h/p", "CLAUDE.md");
  });

  it("pusty lub biały CLAUDE.md to brak pliku; treść jest przycięta", () => {
    mockReadFile.mockReturnValue({ ok: true, text: " \n\t\n" });
    expect(readRepoRules(entry)).toEqual({ ok: false, reason: "no-file" });
    mockReadFile.mockReturnValue({ ok: true, text: "\n  T  \n" });
    expect(readRepoRules(entry)).toEqual({ ok: true, text: "T" });
  });

  it("odmowa ścieżki: powód przekazany, plik nieczytany", () => {
    mockResolve.mockReturnValue({ ok: false, reason: "unsupported-path" });
    expect(readRepoRules(entry)).toEqual({ ok: false, reason: "unsupported-path" });
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});

describe("readGitActivity", () => {
  it("odmowa ścieżki: ok:false, git niewołany", () => {
    mockResolve.mockReturnValue({ ok: false, reason: "missing" });
    expect(readGitActivity(entry, "2026-11-13")).toEqual({ ok: false });
    expect(mockCommitsSince).not.toHaveBeenCalled();
    expect(mockCurrentBranch).not.toHaveBeenCalled();
  });

  it("ścieżka ok: liczba commitów od dnia i gałąź", () => {
    mockResolve.mockReturnValue({ ok: true, path: "/h/p" });
    mockCommitsSince.mockReturnValue({ ok: true, count: 3 });
    mockCurrentBranch.mockReturnValue("feat/x");
    expect(readGitActivity(entry, "2026-11-13")).toEqual({
      ok: true,
      commits: 3,
      branch: "feat/x",
    });
    expect(mockCommitsSince).toHaveBeenCalledWith("/h/p", "2026-11-13");
  });

  it("błąd gita: ok:false, gałąź niepytana", () => {
    mockResolve.mockReturnValue({ ok: true, path: "/h/p" });
    mockCommitsSince.mockReturnValue({ ok: false });
    expect(readGitActivity(entry, "2026-11-13")).toEqual({ ok: false });
    expect(mockCurrentBranch).not.toHaveBeenCalled();
  });
});
