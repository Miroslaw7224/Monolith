// @vitest-environment node
import { describe, expect, it } from "vitest";
import { composeGraph, resolveAgentProject, toAgents } from "@/contexts/bc_map/services";
import type { MapSources, ProjectRef } from "@/contexts/bc_map/models";
import type { HerdrTerminal } from "@/lib/herdr/hc-ls";

const P = (id: string, localPath: string, owner: "personal" | "work" = "personal"): ProjectRef => ({
  id,
  name: id.toUpperCase(),
  localPath,
  owner,
});

describe("composeGraph", () => {
  const projects = [P("nexus", "~/n"), P("monolith", "~/m"), P("english-agent", "~/e")];
  const sources: MapSources = {
    sharedSections: [
      ["english-agent", "monolith", "unknown-x"],
      ["english-agent", "monolith"],
    ],
    noteProjects: [["monolith"], ["monolith", "nexus"], ["ghost"]],
    counts: { knowledge: 10, ai2030: 4, projects: 20 },
    warnings: [],
  };
  const graph = composeGraph(projects, sources);

  it("liczy krawędzie: pary ze wspólnych sekcji i projekt–Wiedza, posortowane", () => {
    expect(graph.edges).toEqual([
      { from: "english-agent", to: "monolith", weight: 2, type: "shared" },
      { from: "monolith", to: "@wiedza", weight: 2, type: "shared" },
      { from: "nexus", to: "@wiedza", weight: 1, type: "shared" },
    ]);
  });

  it("nieznane id nie tworzy krawędzi i daje ostrzeżenie", () => {
    const text = graph.warnings.join("\n");
    expect(text).toContain("unknown-x");
    expect(text).toContain("ghost");
  });

  it("węzły: 3 projekty i 3 kontynenty; Skille to placeholder bez rozmiaru", () => {
    expect(graph.nodes.filter((n) => n.kind === "project").map((n) => n.id)).toEqual([
      "english-agent",
      "monolith",
      "nexus",
    ]);
    const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    expect(byId["@wiedza"]).toMatchObject({ kind: "continent", label: "Wiedza", size: 10 });
    expect(byId["@ai-2030"]).toMatchObject({ kind: "continent", size: 4 });
    expect(byId["@skille"]).toMatchObject({ kind: "continent", soon: true });
    expect(byId["@skille"]).not.toHaveProperty("size");
  });

  it("kafle: neurony bez Skille, zależności = liczba krawędzi", () => {
    expect(graph.tiles).toEqual({
      neurons: { total: 34, knowledge: 10, ai2030: 4, projects: 20 },
      dependencies: 3,
    });
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
