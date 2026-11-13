import type {
  Freshness,
  Project,
  ProjectType,
  ProjectWithContent,
  RegistryEntry,
  VersionToken,
} from "@/contexts/bc_projects/models";
import {
  appendDevlogEntry,
  readDevlog,
  readProjectContent,
  readProjectIndex,
  readProjectState,
  readRegistry,
  writeProjectState,
  writeProjectType,
} from "@/contexts/bc_projects/repositories";
import { NotFoundError } from "@/lib/errors";

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
  return {
    ...entry,
    ...index,
    ...content,
    state,
    stateVersion: version,
    devlog,
    freshness: freshness(effectiveLastWorked(index.lastWorked, state?.updated), today),
  };
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
