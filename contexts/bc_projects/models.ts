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

export type TaskColumn = "blockers" | "now" | "next" | "icebox";
export const TASK_COLUMNS: readonly TaskColumn[] = ["blockers", "now", "next", "icebox"];
export const NOW_LIMIT = 3;

/** `text` jest kanoniczny: bez końcowego ` [now::]` i bez końcowego ` — YYYY-MM-DD` ukończonego zadania. */
export type BoardTask = { text: string; done: boolean; doneDate?: string };
export type TasksBoard = {
  blockers: BoardTask[];
  now: BoardTask[];
  next: BoardTask[];
  icebox: BoardTask[];
  /** Wersja `tasks.md`; `null`, gdy pliku nie ma. */
  version: VersionToken | null;
};

export type TaskRef = { column: TaskColumn; index: number; text: string };
export type TaskOp =
  | { op: "add"; column: TaskColumn; text: string }
  | ({ op: "toggle" } & TaskRef)
  | ({ op: "edit"; newText: string } & TaskRef)
  | ({ op: "remove" } & TaskRef)
  | ({ op: "move"; to: TaskColumn } & TaskRef);

export type Project = RegistryEntry & ProjectIndex & { freshness: Freshness };
export type ProjectWithContent = Project & {
  tasks: ChecklistSection[];
  board: TasksBoard;
  bugs: BugEntry[];
  state: ProjectState | null;
  stateVersion: VersionToken | null;
  devlog: DevlogEntry[];
};

// ── paczka kontekstu dla agenta (etap 1-4) ──────────────────────────────────────

/** Dlaczego repozytorium projektu jest niedostępne; zgodne strukturalnie z powodami z `lib/git` (models nie importuje `lib/*`). */
export type RepoUnavailableReason =
  | "unsupported-path"
  | "outside-home"
  | "missing"
  | "not-a-repo"
  | "git-error";

export type GitSnapshot = { status: string; log: string; diffStat: string };
export type GitSnapshotResult =
  | { ok: true; snapshot: GitSnapshot }
  | { ok: false; reason: RepoUnavailableReason };

export type RepoRulesResult =
  | { ok: true; text: string }
  | { ok: false; reason: RepoUnavailableReason | "no-file" | "unsafe-file" };

export type IndexRuleSection = { heading: string; body: string };

export type ContextPack = {
  markdown: string;
  approxTokens: number;
  truncated: boolean;
  warnings: string[];
};
