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

export type ProjectType = "etat" | "wlasny" | "biblioteka";
export const PROJECT_TYPES: readonly ProjectType[] = ["etat", "wlasny", "biblioteka"];

/** Wersja pliku (strukturalnie zgodna z `FileVersion` z `lib/nexus/vault-fs`; models nie importuje `lib/nexus`, reguła R5). */
export type VersionToken = { size: number; hash: string };

export type ProjectState = {
  branch: string;
  env: string;
  blocker: string;
  nextStep: string;
  links: string[];
  milestone: string;
  /** `YYYY-MM-DD` */
  milestoneDue?: string;
  /** `YYYY-MM-DDTHH:mm`, ustawia serwer */
  updated?: string;
  /** Treść pliku pod frontmatterem. */
  notes: string;
};

export type DevlogEntry = { date: string | null; title: string; why: string };

export type ProjectIndex = {
  lastWorked?: string;
  stateConfidence?: string;
  type?: ProjectType;
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
