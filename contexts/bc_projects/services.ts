import type { Freshness, Project, ProjectWithContent } from "@/contexts/bc_projects/models";
import {
  readProjectContent,
  readProjectIndex,
  readRegistry,
} from "@/contexts/bc_projects/repositories";
import { NotFoundError } from "@/lib/errors";

export const STALE_AFTER_DAYS = 14;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

export function freshness(lastWorked: string | undefined, today: Date): Freshness {
  if (!lastWorked) return "unknown";
  const m = DATE_RE.exec(lastWorked);
  if (!m) return "unknown";
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  const utc = Date.UTC(y, month - 1, d);
  const probe = new Date(utc);
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== d) {
    return "unknown";
  }
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = (todayUtc - utc) / 86_400_000;
  return days <= STALE_AFTER_DAYS ? "fresh" : "stale";
}

function statusRank(status: string): number {
  if (status === "active") return 0;
  if (status === "done") return 2;
  return 1;
}

export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const rankDiff = statusRank(a.status) - statusRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    const aDate = a.lastWorked;
    const bDate = b.lastWorked;
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
      projects.push({
        ...entry,
        ...index,
        freshness: freshness(index.lastWorked, today),
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

export function getProject(id: string, today: Date = new Date()): ProjectWithContent {
  const entry = readRegistry().entries.find((e) => e.id === id);
  if (!entry) {
    throw new NotFoundError(`Nie ma projektu o id ${id}`);
  }
  const index = readProjectIndex(entry);
  const content = readProjectContent(entry);
  return {
    ...entry,
    ...index,
    ...content,
    freshness: freshness(index.lastWorked, today),
  };
}
