// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectState, RegistryEntry } from "@/contexts/bc_projects/models";
import { NotFoundError } from "@/lib/errors";

const mockReadRegistry = vi.hoisted(() => vi.fn());
const mockReadProjectIndex = vi.hoisted(() => vi.fn());
const mockReadProjectContent = vi.hoisted(() => vi.fn());
const mockReadProjectState = vi.hoisted(() => vi.fn());
const mockReadDevlog = vi.hoisted(() => vi.fn());
const mockReadProjectBoard = vi.hoisted(() => vi.fn());
const mockReadGitSnapshot = vi.hoisted(() => vi.fn());
const mockReadRepoRules = vi.hoisted(() => vi.fn());
const mockReadAiContext = vi.hoisted(() => vi.fn());
const mockReadIndexRules = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/repositories", () => ({
  readRegistry: mockReadRegistry,
  readProjectIndex: mockReadProjectIndex,
  readProjectContent: mockReadProjectContent,
  readProjectState: mockReadProjectState,
  readDevlog: mockReadDevlog,
  readProjectBoard: mockReadProjectBoard,
  readGitSnapshot: mockReadGitSnapshot,
  readRepoRules: mockReadRepoRules,
  readAiContext: mockReadAiContext,
  readIndexRules: mockReadIndexRules,
}));

import { buildContextPack } from "@/contexts/bc_projects/services";
import { OWNER_WORK_WARNING } from "@/contexts/bc_projects/services/context-pack";

const TODAY = new Date(2026, 10, 12);

const entry: RegistryEntry = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
};

const state: ProjectState = {
  branch: "main",
  env: "local",
  blocker: "",
  nextStep: "Krok",
  links: [],
  milestone: "",
  notes: "",
};

const GIT_OK = {
  ok: true,
  snapshot: { status: "## main", log: "abc1234 init", diffStat: "" },
};

beforeEach(() => {
  vi.resetAllMocks();
  mockReadRegistry.mockReturnValue({ entries: [entry], warnings: [] });
  mockReadProjectIndex.mockReturnValue({ whereIStopped: null, lastWorked: "2026-11-01" });
  mockReadProjectContent.mockReturnValue({ tasks: [], bugs: [] });
  mockReadProjectState.mockReturnValue({ state, version: null });
  mockReadDevlog.mockReturnValue([]);
  mockReadProjectBoard.mockReturnValue({
    blockers: [],
    now: [],
    next: [],
    icebox: [],
    version: null,
  });
  mockReadGitSnapshot.mockReturnValue(GIT_OK);
  mockReadRepoRules.mockReturnValue({ ok: false, reason: "no-file" });
  mockReadAiContext.mockReturnValue(null);
  mockReadIndexRules.mockReturnValue([]);
});

describe("buildContextPack", () => {
  it("nieznany id: NotFoundError", () => {
    expect(() => buildContextPack("zz", TODAY)).toThrow(NotFoundError);
  });

  it("repozytorium niedostępne: adnotacja, ostrzeżenie, Save State nadal jest", () => {
    mockReadGitSnapshot.mockReturnValue({ ok: false, reason: "unsupported-path" });
    mockReadRepoRules.mockReturnValue({ ok: false, reason: "unsupported-path" });
    const pack = buildContextPack("a", TODAY);
    expect(pack.markdown).toContain("Repozytorium niedostępne (ścieżka spoza WSL).");
    expect(pack.warnings).toContain("Kod: repozytorium niedostępne (ścieżka spoza WSL)");
    expect(pack.markdown).toContain("## Save State");
  });

  it("owner work: ostrzeżenie jest pierwsze, markdown bez zmian", () => {
    mockReadGitSnapshot.mockReturnValue({ ok: false, reason: "unsupported-path" });
    const personal = buildContextPack("a", TODAY);
    mockReadRegistry.mockReturnValue({ entries: [{ ...entry, owner: "work" }], warnings: [] });
    const work = buildContextPack("a", TODAY);
    expect(work.warnings[0]).toBe("Dane z firmy: sprawdź, gdzie wklejasz");
    expect(work.warnings[0]).toBe(OWNER_WORK_WARNING);
    expect(work.warnings[1]).toContain("repozytorium niedostępne");
    expect(work.markdown).toBe(personal.markdown);
    expect(personal.warnings).not.toContain(OWNER_WORK_WARNING);
  });

  it("priorytet źródeł zasad: ai-context.md → CLAUDE.md → index.md → brak", () => {
    mockReadAiContext.mockReturnValue("AI");
    mockReadRepoRules.mockReturnValue({ ok: true, text: "CL" });
    mockReadIndexRules.mockReturnValue([{ heading: "Tech Stack", body: "TS" }]);
    let md = buildContextPack("a", TODAY).markdown;
    expect(md).toContain("## Zasady projektu (źródło: ai-context.md)\n\nAI");
    expect(md).not.toContain("CL\n");
    expect(md).not.toContain("TS");

    mockReadAiContext.mockReturnValue(null);
    md = buildContextPack("a", TODAY).markdown;
    expect(md).toContain("## Zasady projektu (źródło: CLAUDE.md)\n\nCL");

    mockReadRepoRules.mockReturnValue({ ok: false, reason: "no-file" });
    md = buildContextPack("a", TODAY).markdown;
    expect(md).toContain("## Zasady projektu (źródło: index.md)\n\n### Tech Stack\n\nTS");

    mockReadIndexRules.mockReturnValue([]);
    md = buildContextPack("a", TODAY).markdown;
    expect(md).not.toContain("## Zasady");
  });

  it("sekcje index.md łączone w kolejności, każda pod nagłówkiem ###", () => {
    mockReadIndexRules.mockReturnValue([
      { heading: "Tech Stack", body: "TS" },
      { heading: "Pułapki", body: "P" },
    ]);
    const md = buildContextPack("a", TODAY).markdown;
    expect(md).toContain("### Tech Stack\n\nTS\n\n### Pułapki\n\nP");
  });

  it("niebezpieczny CLAUDE.md: ostrzeżenie i zasady z index.md; brak pliku bez ostrzeżenia", () => {
    mockReadRepoRules.mockReturnValue({ ok: false, reason: "unsafe-file" });
    mockReadIndexRules.mockReturnValue([{ heading: "Architektura", body: "A" }]);
    const pack = buildContextPack("a", TODAY);
    expect(pack.markdown).toContain("(źródło: index.md)");
    expect(pack.warnings).toContain(
      "CLAUDE.md pominięty (symlink, zbyt duży lub nie jest zwykłym plikiem)"
    );

    mockReadRepoRules.mockReturnValue({ ok: false, reason: "no-file" });
    expect(buildContextPack("a", TODAY).warnings).toEqual([]);
  });

  it("data pracy: nowsza z last_worked i state.updated", () => {
    mockReadProjectState.mockReturnValue({
      state: { ...state, updated: "2026-11-10T09:00" },
      version: null,
    });
    const md = buildContextPack("a", TODAY).markdown;
    expect(md).toContain("ostatnia praca: 2026-11-10T09:00 (świeży)");
  });

  it("brak state, devlog i ai-context przy działającym gicie: bez ostrzeżeń", () => {
    mockReadProjectState.mockReturnValue({ state: null, version: null });
    const pack = buildContextPack("a", TODAY);
    expect(pack.warnings).toEqual([]);
    expect(pack.markdown).not.toContain("## Save State");
    expect(pack.markdown).not.toContain("## Devlog");
  });

  it("approxTokens to szacunek długości markdownu", () => {
    const pack = buildContextPack("a", TODAY);
    expect(pack.approxTokens).toBe(Math.ceil(pack.markdown.length / 4));
  });
});
