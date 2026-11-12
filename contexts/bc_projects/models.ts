export type Freshness = "fresh" | "stale" | "unknown";

export type RegistryEntry = {
  id: string;
  name: string;
  status: string;
  priority: string;
  /** Ścieżka katalogu projektu względem korzenia vaulta, np. `Projects/nexus/`. Pole wewnętrzne. */
  folder: string;
  localPath: string;
  deploy?: string;
  github?: string;
  owner: "personal";
};

export type ProjectIndex = {
  lastWorked?: string;
  stateConfidence?: string;
  whereIStopped: string | null;
};

export type ChecklistItem = { text: string; done: boolean };
export type ChecklistSection = { heading: string; items: ChecklistItem[] };
export type BugEntry = {
  id: string;
  title: string;
  section: string;
  priority?: string;
  status?: string;
};

export type Project = RegistryEntry & ProjectIndex & { freshness: Freshness };
export type ProjectWithContent = Project & { tasks: ChecklistSection[]; bugs: BugEntry[] };
