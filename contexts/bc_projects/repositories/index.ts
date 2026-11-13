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
  type VersionToken,
} from "@/contexts/bc_projects/models";
import { parseFrontmatter } from "@/lib/nexus/frontmatter";
import { readVaultFile } from "@/lib/nexus/vault-fs";
import { parseBugs, parseChecklist, parseDevlog, parseSections, parseState } from "./markdown";

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
