export type Owner = "personal" | "work";

export type ClusterGroup = "projects" | "knowledge" | "ai2030" | "skills";

/** Skupisko = płat na globusie: projekt, AI-2030, kategoria Wiedzy albo Skille (placeholder). */
export type MapCluster = {
  id: string;
  label: string;
  group: ClusterGroup;
  /** Liczba notatek w skupisku. */
  size: number;
  projectId?: string;
  owner?: Owner;
  /** D13: placeholder (Skille), bez punktów. */
  soon?: boolean;
};

/** Notatka = punkt na globusie. `id` to ścieżka względem Vault bez `.md`. */
export type MapNode = { id: string; label: string; cluster: string; links: number };

/** `link`: notatka–notatka (para nieskierowana, `from` < `to`); `project`: notatka Wiedzy → id projektu. */
export type MapEdge = { from: string; to: string; weight: number; type: "link" | "project" };

export type MapClusterEdge = { from: string; to: string; weight: number };

export type MapTiles = {
  neurons: { total: number; knowledge: number; ai2030: number; projects: number };
  dependencies: number;
};

export type MapGraph = {
  clusters: MapCluster[];
  nodes: MapNode[];
  edges: MapEdge[];
  clusterEdges: MapClusterEdge[];
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

/** Notatka z vaulta przed złożeniem grafu. */
export type RawNote = {
  /** Względem Vault, bez `.md`. */
  path: string;
  area: "knowledge" | "ai2030" | "project";
  /** Tylko `area: "project"`. */
  projectId?: string;
  title: string;
  /** Tylko Wiedza: pierwsza kategoria (małe litery). */
  category?: string;
  /** Tylko Wiedza: pole `projects:` z frontmattera. */
  projects: string[];
  /** Cele wikilinków z treści, z duplikatami. */
  links: string[];
};

/** Surowe dane z vaulta, przed złożeniem grafu. */
export type MapSources = {
  /** Id projektów z każdej linii `**Używają:**` w `tech-stack-wspolny.md`. */
  sharedSections: string[][];
  notes: RawNote[];
  warnings: string[];
};

export const SKILLS_CLUSTER_ID = "skille";
export const AI2030_CLUSTER_ID = "ai-2030";
export const OTHER_CATEGORY = "inne";
export const MIN_CATEGORY_NOTES = 3;
export const MAX_CLUSTER_EDGES = 40;
export const knowledgeClusterId = (category: string): string => `knowledge:${category}`;
