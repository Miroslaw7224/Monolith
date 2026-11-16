// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { GitRange, ProjectWithContent } from "@/contexts/bc_projects/models";
import {
  composeContextPack,
  type ContextPackInput,
} from "@/contexts/bc_projects/services/context-pack";

const HEAD = "9".repeat(40);

const project: ProjectWithContent = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
  whereIStopped: null,
  freshness: "fresh",
  tasks: [],
  board: {
    blockers: [],
    now: [{ text: "N1", done: false }],
    next: [],
    icebox: [],
    version: null,
  },
  bugs: [],
  state: {
    branch: "main",
    env: "",
    blocker: "",
    nextStep: "Zrobić Z",
    links: [],
    milestone: "",
    notes: "",
  },
  stateVersion: null,
  devlog: [],
};

const commits = (n: number) =>
  Array.from({ length: n }, (_, i) => `abcdef1 commit ${String(i + 1).padStart(2, "0")}`);

function range(over: Partial<Extract<GitRange, { ok: true }>> = {}): GitRange {
  return {
    ok: true,
    head: HEAD,
    baseline: "abc1234def5678abc1234def5678abc1234def56",
    baselineLost: false,
    commits: commits(3),
    total: 3,
    diffStat: " src/a.ts | 4 ++--",
    ...over,
  };
}

function input(over: Partial<ContextPackInput> = {}): ContextPackInput {
  return {
    project,
    lastWorked: "2026-11-10",
    rules: null,
    git: { ok: true, snapshot: { status: "## main", log: "x y", diffStat: "" } },
    warnings: [],
    role: "refresh",
    range: range(),
    ...over,
  };
}

const idx = (md: string, s: string) => md.indexOf(s);

describe("rola refresh", () => {
  it("kolejność: Save State, zmiany w repo, zadania; bez sekcji „Kod (git)”", () => {
    const { markdown } = composeContextPack(input());
    expect(markdown).not.toContain("## Kod (git)");
    expect(idx(markdown, "## Save State")).toBeGreaterThan(-1);
    expect(idx(markdown, "## Zmiany w repo")).toBeGreaterThan(idx(markdown, "## Save State"));
    expect(idx(markdown, "## Zadania")).toBeGreaterThan(idx(markdown, "## Zmiany w repo"));
  });

  it("z sha: nagłówek „od abc1234”, commity, diff --stat i instrukcja z pełnym HEAD", () => {
    const { markdown } = composeContextPack(input());
    expect(markdown).toContain("od `abc1234`");
    expect(markdown).toContain("abcdef1 commit 03");
    expect(markdown).toContain("src/a.ts | 4 ++--");
    expect(markdown).toContain(`code_commit: ${HEAD}`);
  });

  it("więcej commitów niż pokazano: „… i N starszych”", () => {
    const { markdown } = composeContextPack(
      input({ range: range({ commits: commits(30), total: 45 }) })
    );
    expect(markdown).toContain("… i 15 starszych");
  });

  it("bez punktu odniesienia i z utraconym sha: osobne opisy", () => {
    const none = composeContextPack(input({ range: range({ baseline: null }) })).markdown;
    expect(none).toContain("brak punktu odniesienia");
    const lost = composeContextPack(
      input({ range: range({ baseline: null, baselineLost: true }) })
    ).markdown;
    expect(lost).toContain("nie jest już w historii repo");
  });

  it("zakres niedostępny: informacja zamiast commitów", () => {
    const { markdown } = composeContextPack(input({ range: { ok: false } }));
    expect(markdown).toContain("## Zmiany w repo");
    expect(markdown).toContain("Repozytorium niedostępne");
  });

  it("przy małym budżecie ścina diff i commity (maks. 10 linii commitów), truncated true", () => {
    const big = Array.from({ length: 200 }, (_, i) => ` src/f${i}.ts | 10 ++++++++++`).join("\n");
    const res = composeContextPack(
      input({ range: range({ commits: commits(30), total: 30, diffStat: big }) }),
      300
    );
    expect(res.truncated).toBe(true);
    const shown = res.markdown.split("\n").filter((l) => l.startsWith("abcdef1 commit"));
    expect(shown.length).toBeLessThanOrEqual(10);
  });

  it("inne role ignorują range", () => {
    const { markdown } = composeContextPack(input({ role: "full" }));
    expect(markdown).not.toContain("## Zmiany w repo");
  });
});
