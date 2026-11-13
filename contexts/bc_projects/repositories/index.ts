import YAML from "yaml";
import {
  PROJECT_TYPES,
  type BugEntry,
  type ChecklistSection,
  type DevlogEntry,
  type ProjectIndex,
  type ProjectState,
  type ProjectType,
  type RegistryEntry,
  type TaskOp,
  type TasksBoard,
  type VersionToken,
} from "@/contexts/bc_projects/models";
import { ConflictError, DomainError, NotFoundError } from "@/lib/errors";
import { parseFrontmatter } from "@/lib/nexus/frontmatter";
import { getVaultRoot } from "@/lib/nexus/vault-path";
import {
  readVaultFile,
  resolveInsideVault,
  updateVaultFile,
  writeVaultFile,
} from "@/lib/nexus/vault-fs";
import {
  parseBugs,
  parseChecklist,
  parseDevlog,
  parseSections,
  parseState,
  prependDevlogEntry,
  serializeState,
  setFrontmatterType,
} from "./markdown";
import { applyTaskOp, readBoardText } from "./tasks-file";

const REGISTRY = "Projects/_registry.yaml";
const MISSING_PROJECTS_LIST = "Projects/_registry.yaml: brak listy 'projects'";

function text(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

function projectPath(folder: string, name: string): string {
  return folder.replace(/\/?$/, "/") + name;
}

function isPlainMap(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readRegistry(): {
  entries: RegistryEntry[];
  warnings: string[];
} {
  const file = readVaultFile(REGISTRY);
  if (file === null) {
    return {
      entries: [],
      warnings: ["Brak Projects/_registry.yaml w vaulcie"],
    };
  }

  let doc: unknown;
  try {
    doc = YAML.parse(file.text);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Nie można odczytać pliku ${REGISTRY}: ${reason}`);
  }

  if (!isPlainMap(doc) || !("projects" in doc) || !Array.isArray(doc.projects)) {
    return { entries: [], warnings: [MISSING_PROJECTS_LIST] };
  }

  const entries: RegistryEntry[] = [];
  const warnings: string[] = [];

  doc.projects.forEach((raw, index) => {
    const n = index + 1;
    if (!isPlainMap(raw)) {
      warnings.push(`Projects/_registry.yaml: pozycja ${n} nie jest mapą`);
      return;
    }

    const id = text(raw.id);
    const folder = text(raw.folder);
    if (!id || !folder) {
      warnings.push(`Projects/_registry.yaml: pozycja ${n} bez id lub folder`);
      return;
    }

    const name = text(raw.name) || id;
    const entry: RegistryEntry = {
      id,
      name,
      status: text(raw.status),
      priority: text(raw.priority),
      folder,
      localPath: text(raw.local_path),
      owner: "personal",
    };

    const deploy = text(raw.deploy);
    if (deploy) entry.deploy = deploy;
    const github = text(raw.github);
    if (github) entry.github = github;

    entries.push(entry);
  });

  return { entries, warnings };
}

export function readProjectIndex(entry: RegistryEntry): ProjectIndex {
  const rel = projectPath(entry.folder, "index.md");
  const file = readVaultFile(rel);
  if (file === null) {
    return { whereIStopped: null };
  }

  let meta: Record<string, unknown> = {};
  let body = file.text;

  if (file.text.startsWith("---")) {
    const parsed = parseFrontmatter(file.text);
    if (parsed === null) {
      throw new Error(`${rel}: zepsuty frontmatter`);
    }
    meta = parsed.meta;
    body = parsed.body;
  }

  const whereSection = parseSections(body).find((s) => s.heading === "Gdzie skończyłem");
  const whereBody = whereSection?.body.trim() ?? "";

  const index: ProjectIndex = {
    whereIStopped: whereBody === "" ? null : whereBody,
  };

  const lastWorked = text(meta.last_worked);
  if (lastWorked) index.lastWorked = lastWorked;
  const stateConfidence = text(meta.state_confidence);
  if (stateConfidence) index.stateConfidence = stateConfidence;
  const type = text(meta.type);
  if ((PROJECT_TYPES as readonly string[]).includes(type)) index.type = type as ProjectType;

  return index;
}

export function readProjectContent(entry: RegistryEntry): {
  tasks: ChecklistSection[];
  bugs: BugEntry[];
} {
  const tasksFile = readVaultFile(projectPath(entry.folder, "tasks.md"));
  const bugsFile = readVaultFile(projectPath(entry.folder, "bugs.md"));

  const tasks =
    tasksFile === null
      ? []
      : parseSections(tasksFile.text).map((s) => ({
          heading: s.heading,
          items: parseChecklist(s.body),
        }));

  const bugs = bugsFile === null ? [] : parseBugs(bugsFile.text);

  return { tasks, bugs };
}

export function readProjectState(entry: RegistryEntry): {
  state: ProjectState | null;
  version: VersionToken | null;
} {
  const rel = projectPath(entry.folder, "state.md");
  const file = readVaultFile(rel);
  if (file === null) return { state: null, version: null };
  return { state: parseState(file.text, rel), version: file.version };
}

export function readDevlog(entry: RegistryEntry): DevlogEntry[] {
  const file = readVaultFile(projectPath(entry.folder, "devlog.md"));
  return file === null ? [] : parseDevlog(file.text);
}

/**
 * Zapis tylko w `Projects/<id>/` (rejestr jest plikiem edytowalnym ręcznie, więc `folder` nie jest zaufany).
 * Najpierw strażnik vaulta (`PathOutsideVaultError`, `WorkAreaBlockedError` mają pierwszeństwo).
 */
function assertWritable(entry: RegistryEntry, rel: string): void {
  resolveInsideVault(getVaultRoot(), rel);
  if (!/^Projects\/(?!\.{1,2}(?:\/|$))[^/]+\/?$/.test(entry.folder)) {
    throw new DomainError(`Zapis tylko w Projects/<id>/ (folder: ${entry.folder})`, 422);
  }
}

/** Zapis `state.md` z kontrolą wersji: niezgodność z `expected` daje `ConflictError` (409). */
export function writeProjectState(
  entry: RegistryEntry,
  state: ProjectState,
  expected: VersionToken | null
): VersionToken {
  const rel = projectPath(entry.folder, "state.md");
  assertWritable(entry, rel);
  return writeVaultFile(rel, serializeState(state), { expected });
}

/** Dopisuje wpis na górze `devlog.md` (tworzy plik); zmiana lokalna, więc ponawiana po konflikcie. */
export async function appendDevlogEntry(
  entry: RegistryEntry,
  devlogEntry: { date: string; title: string; why: string }
): Promise<void> {
  const rel = projectPath(entry.folder, "devlog.md");
  assertWritable(entry, rel);
  await updateVaultFile(rel, (current) => prependDevlogEntry(current, devlogEntry));
}

/** Zmienia tylko linię `type:` w `index.md`; brak pliku to `NotFoundError`. */
export async function writeProjectType(entry: RegistryEntry, type: ProjectType): Promise<void> {
  const rel = projectPath(entry.folder, "index.md");
  assertWritable(entry, rel);
  await updateVaultFile(rel, (current) => {
    if (current === null) throw new NotFoundError(`Brak pliku ${rel}`);
    return setFrontmatterType(current, type);
  });
}

function sameVersion(a: VersionToken | null, b: VersionToken | null): boolean {
  if (a === null || b === null) return a === b;
  return a.size === b.size && a.hash === b.hash;
}

/** Tablica zadań z `tasks.md` (brak pliku: puste kolumny i `version: null`). */
export function readProjectBoard(entry: RegistryEntry): TasksBoard {
  const file = readVaultFile(projectPath(entry.folder, "tasks.md"));
  return { ...readBoardText(file?.text ?? null), version: file?.version ?? null };
}

/**
 * Zapis operacji na zadaniu do `tasks.md` z kontrolą wersji (`expected`; `null` = plik ma nie istnieć).
 * Bez ponawiania: operacje po indeksie nie są lokalne, więc zmiana zewnętrzna to `ConflictError` (409).
 */
export function writeProjectTasks(
  entry: RegistryEntry,
  op: TaskOp,
  expected: VersionToken | null,
  ctx: { today: string }
): VersionToken {
  const rel = projectPath(entry.folder, "tasks.md");
  assertWritable(entry, rel);
  const file = readVaultFile(rel);
  if (!sameVersion(file?.version ?? null, expected)) {
    throw new ConflictError(`Plik zmienił się w międzyczasie: ${rel}`);
  }
  const next = applyTaskOp(file?.text ?? null, op, {
    projectName: entry.name,
    today: ctx.today,
  });
  return writeVaultFile(rel, next, { expected });
}
