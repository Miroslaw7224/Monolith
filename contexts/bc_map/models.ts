export type Owner = "personal" | "work";

export type MapNode = {
  id: string;
  kind: "project" | "continent";
  label: string;
  /** Tylko kontynenty z danymi (Wiedza, AI-2030): liczba plików `.md`. */
  size?: number;
  owner?: Owner;
  /** D13: placeholder (Skille), bez rozmiaru i krawędzi. */
  soon?: boolean;
};

export type MapEdge = { from: string; to: string; weight: number; type: "shared" };

export type MapTiles = {
  neurons: { total: number; knowledge: number; ai2030: number; projects: number };
  dependencies: number;
};

export type MapGraph = {
  nodes: MapNode[];
  edges: MapEdge[];
  tiles: MapTiles;
  warnings: string[];
};

/** Agent po dopasowaniu i filtrze prywatności (D9). Nigdy nie niesie `cwd`. */
export type Agent = {
  address: string;
  label: string;
  state: string;
  status?: string;
  projectId?: string;
  where?: string;
};

/** Projekt z rejestru w zakresie potrzebnym Mapie (z `bc_projects/services`). */
export type ProjectRef = { id: string; name: string; localPath: string; owner: Owner };

/** Surowe dane z vaulta, przed złożeniem grafu. */
export type MapSources = {
  /** Id projektów z każdej linii `**Używają:**` w `tech-stack-wspolny.md`. */
  sharedSections: string[][];
  /** Niepuste `projects:` z frontmatteru notatek `Knowledge/` (jedna lista na notatkę). */
  noteProjects: string[][];
  counts: { knowledge: number; ai2030: number; projects: number };
  warnings: string[];
};

export const CONTINENT_IDS = {
  knowledge: "@wiedza",
  ai2030: "@ai-2030",
  skills: "@skille",
} as const;
