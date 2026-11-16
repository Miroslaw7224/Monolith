export type Freshness = "fresh" | "stale" | "unknown";

export type Owner = "personal" | "work";

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
  /** Dokumentacja: link http(s) albo ścieżka w repozytorium (`docs/specs/v2.md`). */
  docs?: string;
  owner: Owner;
};

/** Zmiana linków projektu w rejestrze; pusty napis usuwa link, pominięte pole zostaje bez zmian. */
export type ProjectLinksInput = { github?: string; deploy?: string; docs?: string };
export const PROJECT_LINK_KEYS = ["github", "deploy", "docs"] as const;

export type ProjectType = "etat" | "wlasny" | "biblioteka";
export const PROJECT_TYPES: readonly ProjectType[] = ["etat", "wlasny", "biblioteka"];

/** Status, który aplikacja ustawia sama (przycisk „Uśpij” / „Wznów”); inne wartości rejestru zostają ręczne. */
export type ProjectStatusChange = "active" | "paused";
export const PROJECT_STATUS_CHANGES: readonly ProjectStatusChange[] = ["active", "paused"];

export type ProjectPriority = "high" | "medium" | "low";
export const PROJECT_PRIORITIES: readonly ProjectPriority[] = ["high", "medium", "low"];

/** Dane z formularza „Nowy projekt”; `id` i folder wylicza serwis z nazwy. */
export type NewProjectInput = {
  name: string;
  priority: ProjectPriority;
  type?: ProjectType;
  localPath: string;
  github?: string;
};

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
  /** Pełny sha commita repo, z którym zgadza się karta (YAML: `code_commit`); brak = bez punktu odniesienia. */
  codeCommit?: string;
  /** Treść pliku pod frontmatterem. */
  notes: string;
};

/** Stan karty względem HEAD repo projektu (`head` = pełny sha HEAD). */
export type CodeSync =
  | { status: "current"; head: string }
  | { status: "behind"; ahead: number; head: string }
  | { status: "diverged"; head: string }
  | { status: "no-baseline" } // brak `code_commit` w `state.md` albo brak `state.md`
  | { status: "unknown-sha" } // sha poza repo (rebase, force-push, shallow clone)
  | { status: "unavailable" }; // brak `local_path`, repo niedostępne, repo bez commitów, błąd gita

/** Zakres commitów dla paczki „odśwież kartę”. `baseline: null` = bez sha (ostatnie commity). */
export type GitRange =
  | {
      ok: true;
      head: string;
      baseline: string | null;
      /** `code_commit` jest, ale nie jest przodkiem HEAD: pokazujemy ostatnie commity. */
      baselineLost: boolean;
      commits: string[];
      total: number;
      diffStat: string;
    }
  | { ok: false };

export type DevlogEntry = { date: string | null; title: string; why: string };

export type ProjectIndex = {
  lastWorked?: string;
  stateConfidence?: string;
  type?: ProjectType;
  whereIStopped: string | null;
};

export type ChecklistItem = { text: string; done: boolean };
export type ChecklistSection = { heading: string; items: ChecklistItem[] };
/** Zadanie tablicy powiązane z bugiem (ID buga jako osobny token w treści zadania). */
export type BugTaskLink = { column: TaskColumn; done: boolean };

export type BugEntry = {
  id: string;
  title: string;
  section: string;
  priority?: string;
  status?: string;
  /** Pole `Plik` (surowy tekst). */
  file?: string;
  /** Pole `Otwarto`: poprawna data kalendarzowa `RRRR-MM-DD`. */
  opened?: string;
  description?: string;
  fix?: string;
  /** Treść pola `Rozwiązanie`. */
  resolution?: string;
  /** Data z nawiasu w `Rozwiązanie (RRRR-MM-DD)`. */
  closedOn?: string;
  /** Pola pochodne dopisywane w `services/bugs.ts`; parser ich nie ustawia. */
  ageDays?: number;
  stale?: boolean;
  task?: BugTaskLink;
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

/** Zarchiwizowany blok zadania: linia zadania z wciętymi liniami; `date` = data ukończenia (`null` = bez daty). */
export type ArchivedBlock = { date: string | null; lines: string[] };
/** Wynik archiwizacji (lista bloków tylko wewnątrz kontekstu; DTO ma samo `archived`). */
export type ArchiveResult = { archived: number; blocks: ArchivedBlock[] };

/** Niezakończone zadanie z kolumny „Teraz” jednego projektu (widok zbiorczy Kokpitu, etap 2-1). */
export type NowTask = {
  projectId: string;
  projectName: string;
  owner: Owner;
  /** Rodzaj projektu do koloru w Kokpicie (`type` z `index.md`, a bez niego z `owner`). */
  kind: ProjectType;
  /** `owner: work` albo `type: etat` (znacznik „Dane z firmy”). */
  companyData: boolean;
  priority: string;
  text: string;
  /** Numer wśród niezakończonych zadań o identycznym tekście w tej kolumnie (0 = pierwsze). */
  occurrence: number;
};

export type Project = RegistryEntry & ProjectIndex & { freshness: Freshness };
export type ProjectWithContent = Project & {
  tasks: ChecklistSection[];
  board: TasksBoard;
  bugs: BugEntry[];
  state: ProjectState | null;
  stateVersion: VersionToken | null;
  devlog: DevlogEntry[];
  /** Stan karty względem repo; brak = nie policzono. */
  codeSync?: CodeSync;
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

/** Aktywność gita projektu z dostępnym repozytorium (tylko odczyt). */
export type GitActivity = {
  projectId: string;
  /** Bieżąca gałąź; `null` dla odłączonego HEAD albo repo bez commitów. */
  branch: string | null;
  /** Commity (bez merge'y) na lokalnych gałęziach od początku dzisiejszego dnia. */
  commitsToday: number;
};

/** Commity projektu po dniach (`RRRR-MM-DD` → liczba); dni bez commitów pominięte. */
export type GitHistory = {
  projectId: string;
  name: string;
  days: Record<string, number>;
  /** Zmergowane PR-y po dniach (z tematów commitów); dni bez PR pominięte. */
  prs: Record<string, number>;
};

/** Tematy commitów projektu z zakresu dat (najnowsze pierwsze). */
export type GitSubjects = { projectId: string; name: string; subjects: string[] };

/** Zadania `done` projektu z `doneDate` w zakresie dat (kolejność kolumn tablicy). */
export type DoneTasks = { projectId: string; name: string; tasks: string[] };

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

/** Role paczki kontekstu (zestaw sekcji); `full` to pełna paczka sprzed wprowadzenia ról. */
export const CONTEXT_PACK_ROLES = ["full", "review", "implementation", "debug", "refresh"] as const;
export type ContextPackRole = (typeof CONTEXT_PACK_ROLES)[number];
