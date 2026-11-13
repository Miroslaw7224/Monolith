import {
  NOW_LIMIT,
  type ContextPack,
  type Freshness,
  type Project,
  type ProjectType,
  type ProjectWithContent,
  type RegistryEntry,
  type TaskOp,
  type VersionToken,
} from "@/contexts/bc_projects/models";
import {
  appendDevlogEntry,
  readAiContext,
  readDevlog,
  readGitSnapshot,
  readIndexRules,
  readProjectBoard,
  readProjectContent,
  readProjectIndex,
  readProjectState,
  readRegistry,
  readRepoRules,
  writeProjectState,
  writeProjectTasks,
  writeProjectType,
} from "@/contexts/bc_projects/repositories";
import { ConflictError, DomainError, NotFoundError } from "@/lib/errors";
import {
  composeContextPack,
  OWNER_WORK_WARNING,
  REPO_REASON_TEXT,
  type PackRules,
} from "./context-pack";

export const STALE_AFTER_DAYS = 14;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** `YYYY-MM-DD…` jako UTC ms; `null` dla braku, złego formatu i nieistniejącej daty kalendarzowej. */
function utcOf(value: string | undefined): number | null {
  if (!value) return null;
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  const utc = Date.UTC(y, month - 1, d);
  const probe = new Date(utc);
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== d) return null;
  return utc;
}

export function freshness(lastWorked: string | undefined, today: Date): Freshness {
  const utc = utcOf(lastWorked);
  if (utc === null) return "unknown";
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = (todayUtc - utc) / 86_400_000;
  return days <= STALE_AFTER_DAYS ? "fresh" : "stale";
}

/**
 * Data pracy nad projektem: nowsza z `last_worked` (index.md) i `updated` (state.md), po pierwszych
 * 10 znakach. Niepoprawna data jest pomijana; gdy żadna nie jest poprawna, zwraca `lastWorked`.
 */
export function effectiveLastWorked(
  lastWorked: string | undefined,
  stateUpdated: string | undefined
): string | undefined {
  const a = utcOf(lastWorked);
  const b = utcOf(stateUpdated);
  if (a !== null && b !== null) return b > a ? stateUpdated : lastWorked;
  if (b !== null) return stateUpdated;
  return lastWorked;
}

function statusRank(status: string): number {
  if (status === "active") return 0;
  if (status === "done") return 2;
  return 1;
}

/** Data `YYYY-MM-DD` do sortowania; śmieciowy `last_worked` traktujemy jak brak daty. */
function sortDate(p: Project): string | undefined {
  return p.lastWorked && DATE_RE.test(p.lastWorked) ? p.lastWorked.slice(0, 10) : undefined;
}

export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const rankDiff = statusRank(a.status) - statusRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    const aDate = sortDate(a);
    const bDate = sortDate(b);
    if (aDate && bDate) {
      const dateDiff = bDate.localeCompare(aDate);
      if (dateDiff !== 0) return dateDiff;
    } else if (aDate && !bDate) {
      return -1;
    } else if (!aDate && bDate) {
      return 1;
    }
    return a.name.localeCompare(b.name, "pl");
  });
}

export function listProjects(today: Date = new Date()): {
  projects: Project[];
  warnings: string[];
} {
  const { entries, warnings: registryWarnings } = readRegistry();
  const warnings = [...registryWarnings];
  const projects: Project[] = [];

  for (const entry of entries) {
    try {
      const index = readProjectIndex(entry);
      let stateUpdated: string | undefined;
      try {
        stateUpdated = readProjectState(entry).state?.updated;
      } catch (err) {
        warnings.push(`${entry.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
      projects.push({
        ...entry,
        ...index,
        freshness: freshness(effectiveLastWorked(index.lastWorked, stateUpdated), today),
      });
    } catch (err) {
      warnings.push(`${entry.id}: ${err instanceof Error ? err.message : String(err)}`);
      projects.push({
        ...entry,
        whereIStopped: null,
        freshness: "unknown",
      });
    }
  }

  return { projects: sortProjects(projects), warnings };
}

function findEntry(id: string): RegistryEntry {
  const entry = readRegistry().entries.find((e) => e.id === id);
  if (!entry) {
    throw new NotFoundError(`Nie ma projektu o id ${id}`);
  }
  return entry;
}

export function getProject(id: string, today: Date = new Date()): ProjectWithContent {
  const entry = findEntry(id);
  const index = readProjectIndex(entry);
  const content = readProjectContent(entry);
  const { state, version } = readProjectState(entry);
  const devlog = readDevlog(entry);
  const board = readProjectBoard(entry);
  return {
    ...entry,
    ...index,
    ...content,
    board,
    state,
    stateVersion: version,
    devlog,
    freshness: freshness(effectiveLastWorked(index.lastWorked, state?.updated), today),
  };
}

/** Pierwsze dostępne źródło zasad: `ai-context.md` → `CLAUDE.md` z repo → sekcje `index.md`. */
function pickRules(entry: RegistryEntry, warnings: string[]): PackRules | null {
  const aiContext = readAiContext(entry);
  if (aiContext !== null) return { source: "ai-context.md", text: aiContext };

  const repoRules = readRepoRules(entry);
  if (repoRules.ok === false) {
    if (repoRules.reason === "unsafe-file") {
      warnings.push("CLAUDE.md pominięty (symlink, zbyt duży lub nie jest zwykłym plikiem)");
    }
  } else {
    return { source: "CLAUDE.md", text: repoRules.text };
  }

  const sections = readIndexRules(entry);
  if (sections.length === 0) return null;
  return {
    source: "index.md",
    text: sections.map((s) => `### ${s.heading}\n\n${s.body}`).join("\n\n"),
  };
}

/**
 * Paczka kontekstu dla agenta (spec etapu 1-4): Markdown z zasadami, Save State, gitem, zadaniami,
 * bugami i devlogiem w budżecie tokenów. Tylko odczyt; brak jednego źródła nie przerywa składania.
 */
/** Jedno miejsce sprawdzenia dla funkcji, które nie mogą obejmować danych etatu (przyszłe AI lokalne, eksport). */
export function isWorkProject(entry: Pick<RegistryEntry, "owner">): boolean {
  return entry.owner === "work";
}

export function buildContextPack(id: string, today: Date = new Date()): ContextPack {
  const entry = findEntry(id);
  const project = getProject(id, today);
  const warnings: string[] = isWorkProject(entry) ? [OWNER_WORK_WARNING] : [];

  const git = readGitSnapshot(entry);
  if (git.ok === false) {
    warnings.push(`Kod: repozytorium niedostępne (${REPO_REASON_TEXT[git.reason]})`);
  }

  return composeContextPack({
    project,
    lastWorked: effectiveLastWorked(project.lastWorked, project.state?.updated),
    rules: pickRules(entry, warnings),
    git,
    warnings,
  });
}

export type StateInput = {
  branch: string;
  env: string;
  blocker: string;
  nextStep: string;
  links: string[];
  milestone: string;
  milestoneDue?: string;
  /** Wersja `state.md` z ostatniego odczytu; `null` = plik ma nie istnieć (tworzenie). */
  version: VersionToken | null;
};

export type DevlogInput = { title: string; why: string };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localDateTime(d: Date): string {
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function saveState(
  id: string,
  input: StateInput,
  now: Date = new Date()
): Promise<ProjectWithContent> {
  const entry = findEntry(id);
  const current = readProjectState(entry).state;
  writeProjectState(
    entry,
    {
      branch: input.branch,
      env: input.env,
      blocker: input.blocker,
      nextStep: input.nextStep,
      links: input.links,
      milestone: input.milestone,
      milestoneDue: input.milestoneDue,
      updated: localDateTime(now),
      notes: current?.notes ?? "",
    },
    input.version
  );
  return getProject(id, now);
}

export async function addDevlogEntry(
  id: string,
  input: DevlogInput,
  now: Date = new Date()
): Promise<ProjectWithContent> {
  const entry = findEntry(id);
  await appendDevlogEntry(entry, { date: localDate(now), title: input.title, why: input.why });
  return getProject(id, now);
}

export async function setProjectType(
  id: string,
  type: ProjectType,
  today: Date = new Date()
): Promise<ProjectWithContent> {
  const entry = findEntry(id);
  await writeProjectType(entry, type);
  return getProject(id, today);
}

function sameVersion(a: VersionToken | null, b: VersionToken | null): boolean {
  if (a === null || b === null) return a === b;
  return a.size === b.size && a.hash === b.hash;
}

/**
 * Operacja na zadaniu z tablicy `tasks.md`. Reguły: wersja pliku i zgodność `text` pod indeksem (409),
 * limit zadań w „Teraz”, ukończone zadanie nie trafia do „Teraz”, ruch do tej samej kolumny (422).
 * Błędy wykrywamy przed zapisem. Data ukończenia to dzień z `now` (ustawia serwer).
 */
export async function applyTaskOp(
  id: string,
  op: TaskOp,
  version: VersionToken | null,
  now: Date = new Date()
): Promise<ProjectWithContent> {
  const entry = findEntry(id);
  const board = readProjectBoard(entry);
  if (!sameVersion(board.version, version)) {
    throw new ConflictError("Plik zadań zmienił się w międzyczasie");
  }

  if (op.op === "add") {
    if (op.column === "now" && board.now.length >= NOW_LIMIT) {
      throw new DomainError(`Limit ${NOW_LIMIT} zadań w kolumnie Teraz`, 422);
    }
  } else {
    const task = board[op.column][op.index];
    if (task === undefined || task.text !== op.text) {
      throw new ConflictError("Zadanie zmieniło się w pliku");
    }
    if (op.op === "move") {
      if (op.to === op.column) throw new DomainError("Zadanie jest już w tej kolumnie", 422);
      if (op.to === "now") {
        if (task.done) throw new DomainError("Ukończone zadanie nie może trafić do Teraz", 422);
        if (board.now.length >= NOW_LIMIT) {
          throw new DomainError(`Limit ${NOW_LIMIT} zadań w kolumnie Teraz`, 422);
        }
      }
    }
  }

  writeProjectTasks(entry, op, version, { today: localDate(now) });
  return getProject(id, now);
}
