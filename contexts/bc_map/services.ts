import os from "node:os";
import path from "node:path";
import { isWorkProject, listProjects } from "@/contexts/bc_projects/services";
import type { HerdrTerminal } from "@/lib/herdr/hc-ls";
import {
  AI2030_CLUSTER_ID,
  MAX_CLUSTER_EDGES,
  MIN_CATEGORY_NOTES,
  OTHER_CATEGORY,
  SKILLS_CLUSTER_ID,
  knowledgeClusterId,
  type Agent,
  type ClusterGroup,
  type MapCluster,
  type MapClusterEdge,
  type MapEdge,
  type MapGraph,
  type MapNode,
  type MapSources,
  type ProjectRef,
  type RawNote,
} from "./models";
import { readMapSources, readTerminals } from "./repositories";

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const SEP = "\u0000";

export type LinkResolution =
  | { kind: "note"; id: string }
  | { kind: "ignored" }
  | { kind: "missing" };

const AREA_RANK: Record<RawNote["area"], number> = { knowledge: 0, project: 1, ai2030: 2 };

/**
 * D18: `cel` → notatka. Pełna lub częściowa ścieżka (kończąca się na `/cel`), bez wielkości liter i `.md`;
 * przy wielu trafieniach Wiedza przed Projektami przed AI-2030, potem alfabetycznie. Cele `_*` są ignorowane.
 */
export function resolveLink(target: string, notes: RawNote[]): LinkResolution {
  const t = target.trim().replace(/\.md$/i, "").replace(/^\/+/, "").toLowerCase();
  const last = t.split("/").pop() ?? "";
  if (last.startsWith("_")) return { kind: "ignored" };
  if (t === "") return { kind: "missing" };
  const candidates = notes.filter((n) => {
    const path = n.path.toLowerCase();
    return path === t || path.endsWith(`/${t}`);
  });
  if (candidates.length === 0) return { kind: "missing" };
  candidates.sort((a, b) => AREA_RANK[a.area] - AREA_RANK[b.area] || cmp(a.path, b.path));
  return { kind: "note", id: candidates[0].path };
}

/** D14, D15: skupiska i przypisanie notatek. Notatki projektów spoza rejestru są pomijane. */
export function buildClusters(
  projects: ProjectRef[],
  notes: RawNote[]
): { clusters: MapCluster[]; noteCluster: Map<string, string>; unknownProjects: string[] } {
  const noteCluster = new Map<string, string>();
  const known = new Set(projects.map((p) => p.id));
  const unknown = new Set<string>();
  const perProject = new Map<string, number>();
  const knowledge: RawNote[] = [];
  let ai2030 = 0;

  for (const n of notes) {
    if (n.area === "project") {
      const id = n.projectId ?? "";
      if (!known.has(id)) {
        unknown.add(id);
        continue;
      }
      noteCluster.set(n.path, id);
      perProject.set(id, (perProject.get(id) ?? 0) + 1);
    } else if (n.area === "ai2030") {
      noteCluster.set(n.path, AI2030_CLUSTER_ID);
      ai2030 += 1;
    } else {
      knowledge.push(n);
    }
  }

  const counts = new Map<string, number>();
  for (const n of knowledge) {
    const cat = n.category ?? OTHER_CATEGORY;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const categoryOf = (n: RawNote): string => {
    const cat = n.category ?? OTHER_CATEGORY;
    return (counts.get(cat) ?? 0) < MIN_CATEGORY_NOTES ? OTHER_CATEGORY : cat;
  };
  const sizes = new Map<string, number>();
  for (const n of knowledge) {
    const cat = categoryOf(n);
    sizes.set(cat, (sizes.get(cat) ?? 0) + 1);
    noteCluster.set(n.path, knowledgeClusterId(cat));
  }

  const knowledgeClusters: MapCluster[] = [...sizes]
    .sort(([a, sa], [b, sb]) => {
      if (a === OTHER_CATEGORY) return 1;
      if (b === OTHER_CATEGORY) return -1;
      return sb - sa || cmp(a, b);
    })
    .map(([cat, size]) => ({
      id: knowledgeClusterId(cat),
      label: cat,
      group: "knowledge",
      size,
    }));

  const clusters: MapCluster[] = [
    ...[...projects]
      .sort((a, b) => cmp(a.id, b.id))
      .map(
        (p): MapCluster => ({
          id: p.id,
          label: p.name,
          group: "projects",
          size: perProject.get(p.id) ?? 0,
          projectId: p.id,
          owner: p.owner,
        })
      ),
    ...knowledgeClusters,
    { id: AI2030_CLUSTER_ID, label: "AI-2030", group: "ai2030", size: ai2030 },
    { id: SKILLS_CLUSTER_ID, label: "Skille", group: "skills", size: 0, soon: true },
  ];
  return { clusters, noteCluster, unknownProjects: [...unknown].sort(cmp) };
}

export type ClusterPair = { a: string; b: string; weight: number };

/** Sumuje pary skupisk (nieskierowane, bez par w jednym skupisku), sortuje wagą malejąco i obcina do `limit`. */
export function aggregateEdges(
  pairs: ClusterPair[],
  limit: number
): { edges: MapClusterEdge[]; total: number } {
  const weights = new Map<string, number>();
  for (const { a, b, weight } of pairs) {
    if (a === b) continue;
    const [from, to] = a < b ? [a, b] : [b, a];
    const key = `${from}${SEP}${to}`;
    weights.set(key, (weights.get(key) ?? 0) + weight);
  }
  const all = [...weights]
    .map(([key, weight]) => {
      const [from, to] = key.split(SEP);
      return { from, to, weight };
    })
    .sort((x, y) => y.weight - x.weight || cmp(x.from, y.from) || cmp(x.to, y.to));
  return { edges: all.slice(0, limit), total: all.length };
}

/** Czysta funkcja: składa skupiska, węzły-notatki, krawędzie, krawędzie zagregowane i kafle. */
export function composeGraph(projects: ProjectRef[], sources: MapSources): MapGraph {
  const warnings = [...sources.warnings];
  const known = new Set(projects.map((p) => p.id));
  const { clusters, noteCluster, unknownProjects } = buildClusters(projects, sources.notes);
  if (unknownProjects.length > 0) {
    warnings.push(
      `Mapa: notatki w nieznanych projektach (pominięte): ${unknownProjects.join(", ")}`
    );
  }
  const assigned = sources.notes.filter((n) => noteCluster.has(n.path));
  const unknownIds = new Set<string>();

  const linkWeights = new Map<string, number>();
  let missing = 0;
  for (const n of assigned) {
    for (const target of n.links) {
      const res = resolveLink(target, assigned);
      if (res.kind === "missing") missing += 1;
      if (res.kind !== "note" || res.id === n.path) continue;
      const [from, to] = n.path < res.id ? [n.path, res.id] : [res.id, n.path];
      const key = `${from}${SEP}${to}`;
      linkWeights.set(key, (linkWeights.get(key) ?? 0) + 1);
    }
  }
  if (missing > 0) warnings.push(`Mapa: nierozwiązane linki: ${missing} (pominięte)`);

  const edges: MapEdge[] = [...linkWeights].map(([key, weight]) => {
    const [from, to] = key.split(SEP);
    return { from, to, weight, type: "link" as const };
  });
  for (const n of assigned) {
    if (n.area !== "knowledge") continue;
    for (const id of new Set(n.projects)) {
      if (known.has(id)) edges.push({ from: n.path, to: id, weight: 1, type: "project" });
      else unknownIds.add(id);
    }
  }
  edges.sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to) || cmp(a.type, b.type));

  const links = new Map<string, number>();
  const addLinks = (id: string, by: number): void => {
    links.set(id, (links.get(id) ?? 0) + by);
  };
  const pairs: ClusterPair[] = [];
  for (const e of edges) {
    const fromCluster = noteCluster.get(e.from) ?? "";
    if (e.type === "link") {
      addLinks(e.from, e.weight);
      addLinks(e.to, e.weight);
      pairs.push({ a: fromCluster, b: noteCluster.get(e.to) ?? "", weight: e.weight });
    } else {
      addLinks(e.from, 1);
      pairs.push({ a: fromCluster, b: e.to, weight: 1 });
    }
  }
  for (const section of sources.sharedSections) {
    const ids = [...new Set(section)];
    for (const id of ids) if (!known.has(id)) unknownIds.add(id);
    const valid = ids.filter((id) => known.has(id)).sort(cmp);
    for (let i = 0; i < valid.length; i += 1) {
      for (let j = i + 1; j < valid.length; j += 1) {
        pairs.push({ a: valid[i], b: valid[j], weight: 1 });
      }
    }
  }
  for (const id of [...unknownIds].sort(cmp)) {
    warnings.push(
      `Mapa: nieznany projekt „${id}” w tech-stack-wspolny.md lub notatkach Wiedzy (pominięty)`
    );
  }

  const { edges: clusterEdges, total } = aggregateEdges(pairs, MAX_CLUSTER_EDGES);

  const nodes: MapNode[] = assigned
    .map(
      (n): MapNode => ({
        id: n.path,
        label: n.title,
        cluster: noteCluster.get(n.path) ?? "",
        links: links.get(n.path) ?? 0,
      })
    )
    .sort((a, b) => cmp(a.id, b.id));

  const groupOf = new Map(clusters.map((c) => [c.id, c.group]));
  const inGroup = (g: ClusterGroup): number =>
    nodes.filter((n) => groupOf.get(n.cluster) === g).length;

  return {
    clusters,
    nodes,
    edges,
    clusterEdges,
    tiles: {
      neurons: {
        total: nodes.length,
        knowledge: inGroup("knowledge"),
        ai2030: inGroup("ai2030"),
        projects: inGroup("projects"),
      },
      dependencies: total,
    },
    warnings,
  };
}

/** `~`, `~/x` lub ścieżka bezwzględna → znormalizowana ścieżka bez końcowego `/`; inaczej `null`. */
function expandHome(raw: string, home: string): string | null {
  const p = raw.trim();
  let abs: string;
  if (p === "~") abs = home;
  else if (p.startsWith("~/")) abs = path.posix.join(home, p.slice(2));
  else if (p.startsWith("/")) abs = p;
  else return null;
  const norm = path.posix.normalize(abs).replace(/\/+$/, "");
  return norm === "" ? null : norm;
}

export type ResolvedTerminal = { terminal: HerdrTerminal; project: ProjectRef | null };

/**
 * Agent → projekt po prefiksie `cwd` względem `localPath` na granicy segmentu; najdłuższy prefiks wygrywa
 * (remis długości: alfabetycznie po `id`). Porównanie tekstowe, symlinki nie są rozwiązywane.
 */
export function resolveAgentProject(
  terminals: HerdrTerminal[],
  projects: ProjectRef[],
  home: string
): ResolvedTerminal[] {
  const roots = projects.flatMap((project) => {
    const root = expandHome(project.localPath, home);
    return root === null ? [] : [{ project, root }];
  });
  return terminals.map((terminal) => {
    if (!terminal.cwd.startsWith("/")) return { terminal, project: null };
    const cwd = path.posix.normalize(terminal.cwd).replace(/\/+$/, "");
    let best: { project: ProjectRef; root: string } | null = null;
    for (const r of roots) {
      if (cwd !== r.root && !cwd.startsWith(`${r.root}/`)) continue;
      if (
        best === null ||
        r.root.length > best.root.length ||
        (r.root.length === best.root.length && r.project.id < best.project.id)
      ) {
        best = r;
      }
    }
    return { terminal, project: best?.project ?? null };
  });
}

const isAgentTerminal = (t: HerdrTerminal): boolean => t.agent.toLowerCase() !== "bash";

/** Filtr prywatności D9: `work` i brak projektu → tylko adres, etykieta i stan. `cwd` nie opuszcza tej funkcji. */
export function toAgents(resolved: ResolvedTerminal[]): Agent[] {
  return resolved
    .filter(({ terminal }) => isAgentTerminal(terminal))
    .map(({ terminal, project }): Agent => {
      const base = {
        address: terminal.address,
        label: terminal.agent === "" ? "terminal" : terminal.agent,
        state: terminal.state,
      };
      if (project === null || isWorkProject(project)) return base;
      return {
        ...base,
        ...(terminal.status ? { status: terminal.status } : {}),
        projectId: project.id,
        where: terminal.where,
      };
    });
}

function projectRefs(): { refs: ProjectRef[]; warnings: string[] } {
  const { projects, warnings } = listProjects();
  return {
    refs: projects.map((p) => ({ id: p.id, name: p.name, localPath: p.localPath, owner: p.owner })),
    warnings,
  };
}

export function getGraph(): MapGraph {
  const { refs, warnings } = projectRefs();
  const graph = composeGraph(refs, readMapSources());
  return { ...graph, warnings: [...warnings, ...graph.warnings] };
}

export function getAgents(): { available: boolean; agents: Agent[] } {
  const result = readTerminals();
  if (!result.available) return { available: false, agents: [] };
  const { refs } = projectRefs();
  return {
    available: true,
    agents: toAgents(resolveAgentProject(result.terminals, refs, os.homedir())),
  };
}
