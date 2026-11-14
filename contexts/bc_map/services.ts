import os from "node:os";
import path from "node:path";
import { isWorkProject, listProjects } from "@/contexts/bc_projects/services";
import type { HerdrTerminal } from "@/lib/herdr/hc-ls";
import {
  CONTINENT_IDS,
  type Agent,
  type MapEdge,
  type MapGraph,
  type MapNode,
  type MapSources,
  type ProjectRef,
} from "./models";
import { readMapSources, readTerminals } from "./repositories";

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const SEP = "\u0000";

/** Czysta funkcja: składa węzły, krawędzie i kafle. Nieznane id (spoza rejestru) pomija z ostrzeżeniem. */
export function composeGraph(projects: ProjectRef[], sources: MapSources): MapGraph {
  const warnings = [...sources.warnings];
  const known = new Set(projects.map((p) => p.id));
  const unknown = new Set<string>();
  const weights = new Map<string, number>();
  const bump = (a: string, b: string): void => {
    const key = `${a}${SEP}${b}`;
    weights.set(key, (weights.get(key) ?? 0) + 1);
  };

  for (const section of sources.sharedSections) {
    const ids = [...new Set(section)];
    for (const id of ids) if (!known.has(id)) unknown.add(id);
    const valid = ids.filter((id) => known.has(id)).sort(cmp);
    for (let i = 0; i < valid.length; i += 1) {
      for (let j = i + 1; j < valid.length; j += 1) bump(valid[i], valid[j]);
    }
  }
  for (const noteIds of sources.noteProjects) {
    for (const id of new Set(noteIds)) {
      if (known.has(id)) bump(id, CONTINENT_IDS.knowledge);
      else unknown.add(id);
    }
  }
  for (const id of [...unknown].sort(cmp)) {
    warnings.push(
      `Mapa: nieznany projekt „${id}” w tech-stack-wspolny.md lub notatkach Wiedzy (pominięty)`
    );
  }

  const edges: MapEdge[] = [...weights]
    .map(([key, weight]) => {
      const [from, to] = key.split(SEP);
      return { from, to, weight, type: "shared" as const };
    })
    .sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to));

  const { counts } = sources;
  const nodes: MapNode[] = [
    ...[...projects]
      .sort((a, b) => cmp(a.id, b.id))
      .map((p): MapNode => ({ id: p.id, kind: "project", label: p.name, owner: p.owner })),
    { id: CONTINENT_IDS.knowledge, kind: "continent", label: "Wiedza", size: counts.knowledge },
    { id: CONTINENT_IDS.ai2030, kind: "continent", label: "AI-2030", size: counts.ai2030 },
    { id: CONTINENT_IDS.skills, kind: "continent", label: "Skille", soon: true },
  ];

  return {
    nodes,
    edges,
    tiles: {
      neurons: {
        total: counts.knowledge + counts.ai2030 + counts.projects,
        knowledge: counts.knowledge,
        ai2030: counts.ai2030,
        projects: counts.projects,
      },
      dependencies: edges.length,
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
