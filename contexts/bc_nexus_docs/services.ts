import { isWorkProject, listProjects } from "@/contexts/bc_projects/services";
import { DomainError, NotFoundError } from "@/lib/errors";
import {
  MAX_DOC_BYTES,
  NEXUS_AREAS,
  PROJECT_EXCLUDED_FILES,
  type FrontmatterLine,
  type NexusArea,
  type NexusDoc,
  type NexusDocSummary,
  type RawNexusDoc,
} from "./models";
import { listNexusPaths, readNexusDoc } from "./repositories";

const cmp = (a: string, b: string): number => a.localeCompare(b, "pl");
const badRequest = (message: string) => new DomainError(message, 400);

/**
 * Segmenty catch-all → ścieżka względem vaulta. Rzuca 400 dla pustej ścieżki, pustego/`.`/`..`
 * segmentu, segmentu ze znakami `/`, `\` lub `\0` (np. po zdekodowaniu `%2F`), braku `.md`
 * oraz prefiksu innego niż dokładnie `Knowledge/` lub `Projects/` (wielkość liter rozróżniana).
 */
export function parseDocPath(segments: string[]): string {
  if (segments.length === 0) throw badRequest("Ścieżka dokumentu jest pusta");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === ".." || /[\\/\0]/.test(segment)) {
      throw badRequest("Nieprawidłowy segment ścieżki dokumentu");
    }
  }
  const joined = segments.join("/");
  if (!joined.endsWith(".md")) throw badRequest("Dozwolone są tylko pliki .md");
  if (segments.length < 2 || !NEXUS_AREAS.some((area) => area === segments[0])) {
    throw badRequest("Dozwolone obszary: Knowledge i Projects");
  }
  return joined;
}

/**
 * Reguła widoczności (D3, D9): `Knowledge/**` oraz `Projects/<id>/<plik>.md` dla projektów z rejestru
 * (bez `owner: work`), z wyłączeniem plików obsługiwanych przez kartę Projekty, plików `_*`
 * i katalogów `attachments/`. Działa na ścieżkach; nie czyta plików.
 */
export function isVisiblePath(rel: string, projectIds: ReadonlySet<string>): boolean {
  const segments = rel.split("/");
  const file = segments[segments.length - 1];
  if (segments.length < 2 || !file.endsWith(".md")) return false;
  if (file.startsWith("_") || segments.includes("attachments")) return false;
  if (segments[0] === "Knowledge") return true;
  if (segments[0] === "Projects") {
    return (
      segments.length === 3 && projectIds.has(segments[1]) && !PROJECT_EXCLUDED_FILES.includes(file)
    );
  }
  return false;
}

export function docGroup(rel: string): string {
  const segments = rel.split("/");
  if (segments[0] === "Projects") return segments[1] ?? "";
  return segments.length > 2 ? segments[1] : "";
}

export function docTitle(meta: Record<string, unknown>, body: string, rel: string): string {
  for (const key of ["title", "name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  const heading = /^#[ \t]+(\S.*?)[ \t]*$/m.exec(body.replace(/^```[\s\S]*?^```/gm, ""));
  if (heading) return heading[1];
  const file = rel.split("/").pop() ?? rel;
  return file.replace(/\.md$/, "");
}

export function docTags(meta: Record<string, unknown>): string[] {
  const value = meta.tags;
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function frontmatterLines(meta: Record<string, unknown>): FrontmatterLine[] {
  return Object.entries(meta).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? `[${value.map(scalar).join(", ")}]` : scalar(value),
  }));
}

function summarize(raw: RawNexusDoc): NexusDocSummary {
  return {
    path: raw.path,
    area: raw.path.split("/")[0] as NexusArea,
    group: docGroup(raw.path),
    title: docTitle(raw.meta, raw.body, raw.path),
    tags: docTags(raw.meta),
  };
}

function visibleProjectIds(): Set<string> {
  const { projects } = listProjects();
  return new Set(
    projects.filter((project) => !isWorkProject(project)).map((project) => project.id)
  );
}

/** Lista widocznych ścieżek: jedyne źródło prawdy dla listy i dla zgody na odczyt. */
function listVisiblePaths(): string[] {
  const ids = visibleProjectIds();
  return listNexusPaths().filter((rel) => isVisiblePath(rel, ids));
}

/** Podsumowania wszystkich widocznych dokumentów (bez treści). Nieczytelny plik jest pomijany. */
export function listDocs(): NexusDocSummary[] {
  const out: NexusDocSummary[] = [];
  for (const rel of listVisiblePaths()) {
    const raw = readNexusDoc(rel);
    if (raw !== null) out.push(summarize(raw));
  }
  return out.sort(
    (a, b) =>
      cmp(a.area, b.area) || cmp(a.group, b.group) || cmp(a.title, b.title) || cmp(a.path, b.path)
  );
}

/**
 * Jeden dokument. Najpierw składnia i prefiks (400), potem obecność na liście widocznych (404),
 * potem rozmiar (413). Odczyt spoza listy jest niemożliwy.
 */
export function getDoc(segments: string[]): NexusDoc {
  const rel = parseDocPath(segments);
  if (!listVisiblePaths().includes(rel)) throw new NotFoundError("Nie znaleziono dokumentu");
  const raw = readNexusDoc(rel);
  if (raw === null) throw new NotFoundError("Nie znaleziono dokumentu");
  if (raw.bytes > MAX_DOC_BYTES) throw new DomainError("Dokument jest zbyt duży", 413);
  return {
    ...summarize(raw),
    frontmatter: frontmatterLines(raw.meta),
    body: raw.body,
  };
}
