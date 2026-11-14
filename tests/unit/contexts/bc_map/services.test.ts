// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  aggregateEdges,
  composeGraph,
  resolveAgentProject,
  resolveLink,
  toAgents,
} from "@/contexts/bc_map/services";
import type { MapSources, ProjectRef, RawNote } from "@/contexts/bc_map/models";
import type { HerdrTerminal } from "@/lib/herdr/hc-ls";

const P = (id: string, localPath: string, owner: "personal" | "work" = "personal"): ProjectRef => ({
  id,
  name: id.toUpperCase(),
  localPath,
  owner,
});

const note = (path: string, o: Partial<RawNote> = {}): RawNote => ({
  path,
  area: "knowledge",
  title: path.split("/").pop() ?? path,
  projects: [],
  links: [],
  ...o,
});

describe("resolveLink", () => {
  const notes = [
    note("Knowledge/sub/b"),
    note("Knowledge/a"),
    note("Projects/monolith/monolith", { area: "project", projectId: "monolith" }),
    note("AI-2030/a", { area: "ai2030" }),
  ];
  it("sam basename, wiele trafień: Wiedza przed AI-2030", () => {
    expect(resolveLink("a", notes)).toEqual({ kind: "note", id: "Knowledge/a" });
  });
  it("częściowa i pełna ścieżka, wielkość liter i .md", () => {
    expect(resolveLink("sub/b", notes)).toEqual({ kind: "note", id: "Knowledge/sub/b" });
    expect(resolveLink("B.md", notes)).toEqual({ kind: "note", id: "Knowledge/sub/b" });
    expect(resolveLink("Projects/monolith/monolith", notes)).toEqual({
      kind: "note",
      id: "Projects/monolith/monolith",
    });
  });
  it("_index i _tags są ignorowane, nieznany cel to missing", () => {
    expect(resolveLink("_index", notes)).toEqual({ kind: "ignored" });
    expect(resolveLink("Knowledge/_tags", notes)).toEqual({ kind: "ignored" });
    expect(resolveLink("nie-ma", notes)).toEqual({ kind: "missing" });
  });
});

describe("aggregateEdges", () => {
  it("pomija pary w jednym skupisku, łączy kierunki, obcina do limitu i liczy total", () => {
    const pairs = Array.from({ length: 50 }, (_, i) => ({
      a: `c${String(i).padStart(2, "0")}`,
      b: "z",
      weight: 1,
    }));
    const r = aggregateEdges(
      [...pairs, { a: "z", b: "c00", weight: 4 }, { a: "x", b: "x", weight: 9 }],
      40
    );
    expect(r.total).toBe(50);
    expect(r.edges).toHaveLength(40);
    expect(r.edges[0]).toEqual({ from: "c00", to: "z", weight: 5 });
    expect(r.edges[39].from).toBe("c39");
  });
});

describe("composeGraph", () => {
  const projects = [P("nexus", "~/n"), P("monolith", "~/m")];
  const notes: RawNote[] = [
    note("Knowledge/a", {
      category: "tools",
      projects: ["monolith"],
      links: ["b", "Projects/monolith/monolith", "nie-ma", "_index"],
    }),
    note("Knowledge/b", { category: "tools", links: ["a", "Knowledge/b"] }),
    note("Knowledge/c", { category: "tools", projects: ["nexus", "ghost"], links: ["a"] }),
    note("Knowledge/d", { category: "rzadka", links: ["a"] }),
    note("AI-2030/x", { area: "ai2030", links: ["a"] }),
    note("Projects/monolith/monolith", {
      area: "project",
      projectId: "monolith",
      links: ["a", "a"],
    }),
    note("Projects/ghostproj/index", { area: "project", projectId: "ghostproj" }),
  ];
  const sources: MapSources = {
    sharedSections: [["nexus", "monolith", "unknown-x"]],
    notes,
    warnings: [],
  };
  const graph = composeGraph(projects, sources);

  it("buduje skupiska: projekty, Wiedza z „inne”, AI-2030, Skille", () => {
    expect(graph.clusters.map((c) => [c.id, c.size])).toEqual([
      ["monolith", 1],
      ["nexus", 0],
      ["knowledge:tools", 3],
      ["knowledge:inne", 1],
      ["ai-2030", 1],
      ["skille", 0],
    ]);
    expect(graph.clusters.at(-1)?.soon).toBe(true);
  });

  it("węzły: przypisane do skupisk, z liczbą powiązań; notatka nieznanego projektu pominięta", () => {
    expect(graph.nodes.map((n) => [n.id, n.cluster, n.links])).toEqual([
      ["AI-2030/x", "ai-2030", 1],
      ["Knowledge/a", "knowledge:tools", 9],
      ["Knowledge/b", "knowledge:tools", 2],
      ["Knowledge/c", "knowledge:tools", 2],
      ["Knowledge/d", "knowledge:inne", 1],
      ["Projects/monolith/monolith", "monolith", 3],
    ]);
  });

  it("krawędzie notatkowe: sumuje kierunki i duplikaty, pomija self i _index; projects: → krawędź project", () => {
    expect(graph.edges).toEqual([
      { from: "AI-2030/x", to: "Knowledge/a", weight: 1, type: "link" },
      { from: "Knowledge/a", to: "Knowledge/b", weight: 2, type: "link" },
      { from: "Knowledge/a", to: "Knowledge/c", weight: 1, type: "link" },
      { from: "Knowledge/a", to: "Knowledge/d", weight: 1, type: "link" },
      { from: "Knowledge/a", to: "Projects/monolith/monolith", weight: 3, type: "link" },
      { from: "Knowledge/a", to: "monolith", weight: 1, type: "project" },
      { from: "Knowledge/c", to: "nexus", weight: 1, type: "project" },
    ]);
  });

  it("krawędzie zagregowane: linki + projects: + sekcje Używają; dependencies liczy wszystkie pary", () => {
    expect(graph.clusterEdges).toEqual([
      { from: "knowledge:tools", to: "monolith", weight: 4 },
      { from: "ai-2030", to: "knowledge:tools", weight: 1 },
      { from: "knowledge:inne", to: "knowledge:tools", weight: 1 },
      { from: "knowledge:tools", to: "nexus", weight: 1 },
      { from: "monolith", to: "nexus", weight: 1 },
    ]);
    expect(graph.tiles).toEqual({
      neurons: { total: 6, knowledge: 4, ai2030: 1, projects: 1 },
      dependencies: 5,
    });
  });

  it("ostrzeżenia: nieznane projekty, nierozwiązane linki", () => {
    const text = graph.warnings.join("\n");
    expect(text).toContain("„ghost”");
    expect(text).toContain("„unknown-x”");
    expect(text).toContain("ghostproj");
    expect(text).toContain("nierozwiązane linki: 1");
  });
});

describe("resolveAgentProject", () => {
  const home = "/home/u";
  const projects = [
    P("proj", "~/projects/proj"),
    P("proj2", "~/projects/proj-2"),
    P("nested", "~/projects/proj/sub"),
    P("tool", "/opt/tool"),
    P("rel", "relative/path"),
  ];
  const T = (cwd: string): HerdrTerminal => ({
    address: "t1",
    agent: "claude-code",
    cwd,
    state: "live",
    where: "w",
  });
  const idFor = (cwd: string) =>
    resolveAgentProject([T(cwd)], projects, home)[0].project?.id ?? null;

  it("granica segmentu: proj-2 nie pasuje do proj", () => {
    expect(idFor("/home/u/projects/proj-2")).toBe("proj2");
    expect(idFor("/home/u/projects/proj-2/src")).toBe("proj2");
  });
  it("najdłuższy prefiks wygrywa", () => {
    expect(idFor("/home/u/projects/proj/sub/x")).toBe("nested");
    expect(idFor("/home/u/projects/proj/other")).toBe("proj");
  });
  it("dokładna ścieżka i ukośnik końcowy", () => {
    expect(idFor("/home/u/projects/proj")).toBe("proj");
    expect(idFor("/home/u/projects/proj/")).toBe("proj");
  });
  it("ścieżka bezwzględna w rejestrze; względna jest ignorowana", () => {
    expect(idFor("/opt/tool/bin")).toBe("tool");
    expect(idFor("relative/path")).toBeNull();
  });
  it("brak dopasowania i pusty cwd", () => {
    expect(idFor("/home/u/other")).toBeNull();
    expect(idFor("")).toBeNull();
  });
});

describe("toAgents (prywatność D9)", () => {
  const home = "/home/u";
  const projects = [P("mine", "~/mine"), P("job", "~/job", "work")];
  const T = (address: string, agent: string, cwd: string, status?: string): HerdrTerminal => ({
    address,
    agent,
    cwd,
    state: "live",
    where: `${address} / 1`,
    ...(status ? { status } : {}),
  });
  const agents = toAgents(
    resolveAgentProject(
      [
        T("t1", "claude-code", "/home/u/mine", "working"),
        T("t2", "claude-code", "/home/u/job/app", "working"),
        T("t3", "antigravity", "/somewhere/else", "done"),
        T("t4", "bash", "/home/u/mine"),
        T("t5", "", "/home/u/mine"),
      ],
      projects,
      home
    )
  );
  const byAddr = Object.fromEntries(agents.map((a) => [a.address, a]));

  it("pomija powłokę (agent bash)", () => {
    expect(agents.map((a) => a.address)).toEqual(["t1", "t2", "t3", "t5"]);
  });
  it("agent z projektu personal ma projekt, where i status", () => {
    expect(byAddr.t1).toEqual({
      address: "t1",
      label: "claude-code",
      state: "live",
      status: "working",
      projectId: "mine",
      where: "t1 / 1",
    });
  });
  it("agent z projektu work i agent bez projektu mają tylko etykietę i stan", () => {
    expect(byAddr.t2).toEqual({ address: "t2", label: "claude-code", state: "live" });
    expect(byAddr.t3).toEqual({ address: "t3", label: "antigravity", state: "live" });
  });
  it("pusty agent dostaje etykietę „terminal”", () => {
    expect(byAddr.t5.label).toBe("terminal");
  });
  it("cwd nigdy nie trafia do wyniku", () => {
    expect(JSON.stringify(agents)).not.toContain("/home/u");
    expect(JSON.stringify(agents)).not.toContain("/somewhere");
  });
});
