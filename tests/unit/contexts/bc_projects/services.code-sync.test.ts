// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CodeSync, RegistryEntry } from "@/contexts/bc_projects/models";
import type * as ProjectsRepo from "@/contexts/bc_projects/repositories";
import { DomainError } from "@/lib/errors";
import { setupTempVault } from "../../helpers/tempVault";

const mockReadCodeSync = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readCodeSync>());
const mockReadHeadSha = vi.hoisted(() => vi.fn<typeof ProjectsRepo.readHeadSha>());

// Git to granica procesu (TDD-5): atrapą są tylko odczyty gita, pliki projektu są prawdziwe.
vi.mock("@/contexts/bc_projects/repositories", async (importOriginal) => ({
  ...(await importOriginal<typeof ProjectsRepo>()),
  readCodeSync: mockReadCodeSync,
  readHeadSha: mockReadHeadSha,
}));

import {
  getCodeSync,
  getProject,
  listCodeSync,
  listProjects,
  markCodeSynced,
  saveState,
} from "@/contexts/bc_projects/services";

const vault = setupTempVault();
const STATE_FILE = "Projects/a/state.md";
const entry: RegistryEntry = {
  id: "a",
  name: "A",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "",
  owner: "personal",
};
const HEAD = "f".repeat(40);
const SHA = "abc1234";
const TODAY = new Date(2026, 10, 16);

/** Rejestr z projektami podanych id (folder `Projects/<id>/`). */
const seedRegistry = (...ids: string[]) =>
  vault.write(
    "Projects/_registry.yaml",
    `projects:\n${ids
      .map(
        (id) =>
          `  - id: ${id}\n    name: ${id.toUpperCase()}\n    status: active\n    folder: Projects/${id}/\n`
      )
      .join("")}`
  );

/** `state.md` w formacie zapisywanym przez repozytorium; `codeCommit` opcjonalny. */
const stateText = (over: { branch?: string; codeCommit?: string } = {}) =>
  `---
branch: ${over.branch ?? "main"}
env: ""
blocker: ""
next_step: x
links: []
milestone: ""
updated: 2026-11-10T10:00${over.codeCommit ? `\ncode_commit: ${over.codeCommit}` : ""}
---

notatki
`;
const seedState = (over: { branch?: string; codeCommit?: string } = {}) =>
  vault.write(STATE_FILE, stateText(over));
const currentVersion = () => getProject("a", TODAY).stateVersion;

beforeEach(() => {
  vi.clearAllMocks();
  seedRegistry("a");
  mockReadHeadSha.mockReturnValue(HEAD);
});

describe("getCodeSync / getProject", () => {
  it("bez state.md: no-baseline i brak wywołania gita", () => {
    expect(getCodeSync("a")).toEqual({ status: "no-baseline" });
    expect(mockReadCodeSync).not.toHaveBeenCalled();
  });
  it("state.md bez code_commit: no-baseline", () => {
    seedState();
    expect(getCodeSync("a")).toEqual({ status: "no-baseline" });
  });
  it("z code_commit: wynik readCodeSync dla tego sha", () => {
    seedState({ codeCommit: SHA });
    mockReadCodeSync.mockReturnValue({ status: "behind", ahead: 2, head: HEAD });
    expect(getCodeSync("a")).toEqual({ status: "behind", ahead: 2, head: HEAD });
    expect(mockReadCodeSync).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), SHA);
  });
  it("ręcznie wpisany, niepoprawny code_commit: unknown-sha bez pytania gita", () => {
    seedState({ codeCommit: "xyz" });
    expect(getCodeSync("a")).toEqual({ status: "unknown-sha" });
    expect(mockReadCodeSync).not.toHaveBeenCalled();
  });
  it("getProject dołącza codeSync", () => {
    seedState({ codeCommit: SHA });
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    expect(getProject("a", TODAY).codeSync).toEqual({ status: "current", head: HEAD });
  });
});

describe("listProjects", () => {
  it("nie woła gita (lista zostaje szybka)", () => {
    seedState({ codeCommit: SHA });
    listProjects(TODAY);
    expect(mockReadCodeSync).not.toHaveBeenCalled();
    expect(mockReadHeadSha).not.toHaveBeenCalled();
  });
});

describe("listCodeSync", () => {
  it("mapa po id; wyjątek jednego projektu daje unavailable tylko dla niego", () => {
    seedRegistry("a", "b");
    seedState({ codeCommit: SHA });
    vault.write("Projects/b/state.md", "---\nbranch: [\n---\n");
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    expect(listCodeSync()).toEqual({
      a: { status: "current", head: HEAD },
      b: { status: "unavailable" },
    });
  });
});

describe("saveState", () => {
  it("zachowuje code_commit z istniejącego state.md", async () => {
    seedState({ codeCommit: SHA });
    await saveState(
      "a",
      {
        branch: "dev",
        env: "",
        blocker: "",
        nextStep: "nowy krok",
        links: [],
        milestone: "",
        version: currentVersion(),
      },
      TODAY
    );
    expect(vault.read(STATE_FILE)).toBe(`---
branch: dev
env: ""
blocker: ""
next_step: nowy krok
links: []
milestone: ""
updated: 2026-11-16T00:00
code_commit: ${SHA}
---

notatki
`);
  });
});

describe("markCodeSynced", () => {
  it("zapisuje code_commit, nie rusza updated ani notatek, używa tokenu wersji", async () => {
    seedState();
    mockReadCodeSync.mockReturnValue({ status: "behind", ahead: 2, head: HEAD });
    await markCodeSynced("a", SHA, TODAY);
    expect(mockReadCodeSync).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), SHA);
    expect(vault.read(STATE_FILE)).toBe(stateText({ codeCommit: SHA }));
  });

  it("bez commit w wywołaniu bierze HEAD", async () => {
    seedState();
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    await markCodeSynced("a", undefined, TODAY);
    expect(mockReadCodeSync).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), HEAD);
    expect(vault.read(STATE_FILE)).toBe(stateText({ codeCommit: HEAD }));
  });

  it("brak state.md: tworzy plik z pustymi polami, bez updated", async () => {
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    await markCodeSynced("a", SHA, TODAY);
    expect(vault.read(STATE_FILE)).toBe(`---
branch: ""
env: ""
blocker: ""
next_step: ""
links: []
milestone: ""
code_commit: ${SHA}
---


`);
  });

  it.each<[CodeSync]>([
    [{ status: "diverged", head: HEAD }],
    [{ status: "unknown-sha" }],
    [{ status: "unavailable" }],
  ])("odrzuca commit, gdy readCodeSync = %j", async (sync) => {
    seedState();
    mockReadCodeSync.mockReturnValue(sync);
    await expect(markCodeSynced("a", SHA, TODAY)).rejects.toBeInstanceOf(DomainError);
    expect(vault.read(STATE_FILE)).toBe(stateText());
  });

  it("niepoprawny format sha: DomainError bez pytania o git", async () => {
    await expect(markCodeSynced("a", "--help", TODAY)).rejects.toBeInstanceOf(DomainError);
    expect(mockReadCodeSync).not.toHaveBeenCalled();
  });

  it("repo bez HEAD i brak commit: DomainError", async () => {
    mockReadHeadSha.mockReturnValue(null);
    await expect(markCodeSynced("a", undefined, TODAY)).rejects.toBeInstanceOf(DomainError);
  });
});
