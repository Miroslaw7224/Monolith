import { parseFrontmatter } from "../../lib/nexus/frontmatter";
import { parseTaskLine, type TaskLine } from "../../lib/nexus/task-line";
import { parseYamlList, type YamlRecord } from "../../lib/nexus/yaml-lists";
import { htmlFileName } from "./slug";
import type { Converted, HandledType, PlanResult, VaultView } from "./types";

const NOTES_DIR = "Notes";
const NOTES_HTML_DIR = "Notes/.html";

type VerifyResult = { ok: boolean; problems: string[]; found: Record<HandledType, number> };

/** Nazwy kluczy, których wartości się różnią (nigdy same wartości). */
function differingKeys(expected: object, actual: object): string[] {
  const e = expected as Record<string, unknown>;
  const a = actual as Record<string, unknown>;
  const keys = new Set([...Object.keys(e), ...Object.keys(a)]);
  const out: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(e[key]) !== JSON.stringify(a[key])) out.push(key);
  }
  return out;
}

function verifyNotes(notes: Converted["notes"], vault: VaultView, problems: string[]): number {
  const byId = new Map<string, { rels: string[]; titles: unknown[] }>();
  for (const name of vault.list(NOTES_DIR).filter((n) => n.toLowerCase().endsWith(".md"))) {
    const rel = `${NOTES_DIR}/${name}`;
    const text = vault.read(rel);
    const meta = text === null ? null : (parseFrontmatter(text)?.meta ?? null);
    if (meta === null || typeof meta.id !== "string") continue;
    const entry = byId.get(meta.id) ?? { rels: [], titles: [] };
    entry.rels.push(rel);
    entry.titles.push(meta.title);
    byId.set(meta.id, entry);
  }

  let found = 0;
  for (const note of notes) {
    const entry = byId.get(note.id);
    if (entry === undefined) {
      problems.push(`brak notatki id=${note.id}`);
      continue;
    }
    found += 1;
    if (entry.rels.length > 1) {
      problems.push(`zduplikowane id notatki ${note.id}`);
    }
    const bad: string[] = [];
    if (entry.titles[0] !== note.title) bad.push("title");
    const html = vault.read(`${NOTES_HTML_DIR}/${htmlFileName(note.id)}.html`);
    if (html !== note.html) bad.push("html");
    if (bad.length > 0) problems.push(`niezgodne pola notatki id=${note.id}: ${bad.join(", ")}`);
  }
  return found;
}

function verifyTasks(
  tasks: TaskLine[],
  relPath: string | undefined,
  vault: VaultView,
  problems: string[]
): number {
  if (tasks.length === 0) return 0;
  const text = relPath === undefined ? null : vault.read(relPath);
  if (relPath === undefined || text === null) {
    problems.push(`brak pliku ${relPath ?? "Tasks/tasks.md"}`);
    return 0;
  }

  const actual = new Map<string, TaskLine>();
  text.split(/\r?\n/).forEach((line, index) => {
    let parsed: TaskLine | null;
    try {
      parsed = parseTaskLine(line);
    } catch {
      problems.push(`błędna linia zadania w ${relPath} (linia ${index + 1})`);
      return;
    }
    if (parsed === null) return;
    if (actual.has(parsed.id)) {
      problems.push(`zduplikowane id zadania ${parsed.id}`);
      return;
    }
    actual.set(parsed.id, parsed);
  });

  let found = 0;
  for (const task of tasks) {
    const got = actual.get(task.id);
    if (got === undefined) {
      problems.push(`brak zadania id=${task.id}`);
      continue;
    }
    found += 1;
    const bad = differingKeys(task, got);
    if (bad.length > 0) problems.push(`niezgodne pola zadania id=${task.id}: ${bad.join(", ")}`);
  }
  return found;
}

function verifyYamlRecords(
  records: object[],
  relPath: string | undefined,
  listKey: string,
  labels: { missing: string; mismatch: string; duplicate: string; defaultPath: string },
  vault: VaultView,
  problems: string[]
): number {
  if (records.length === 0) return 0;
  const text = relPath === undefined ? null : vault.read(relPath);
  if (relPath === undefined || text === null) {
    problems.push(`brak pliku ${relPath ?? labels.defaultPath}`);
    return 0;
  }

  let items: YamlRecord[];
  try {
    items = parseYamlList(text, listKey).items;
  } catch {
    problems.push(`niepoprawny plik ${relPath}`);
    return 0;
  }

  const actual = new Map<string, YamlRecord>();
  for (const item of items) {
    const id = String(item.id);
    if (actual.has(id)) {
      problems.push(`${labels.duplicate} ${id}`);
      continue;
    }
    actual.set(id, item);
  }

  let found = 0;
  for (const record of records) {
    const normalized = JSON.parse(JSON.stringify(record)) as YamlRecord;
    const id = String(normalized.id);
    const got = actual.get(id);
    if (got === undefined) {
      problems.push(`${labels.missing}${id}`);
      continue;
    }
    found += 1;
    const bad = differingKeys(normalized, got);
    if (bad.length > 0) problems.push(`${labels.mismatch}${id}: ${bad.join(", ")}`);
  }
  return found;
}

/**
 * Round-trip: czyta z vaulta wyłącznie to, co faktycznie zapisano, i porównuje z oczekiwanymi
 * rekordami. Komunikaty zawierają id i nazwy pól, nigdy wartości.
 */
export function verifyVault(
  expected: Converted,
  plan: Pick<PlanResult, "targets" | "noteFiles">,
  vault: VaultView
): VerifyResult {
  const problems: string[] = [];
  const found: Record<HandledType, number> = {
    notes: verifyNotes(expected.notes, vault, problems),
    tasks: verifyTasks(expected.tasks, plan.targets.tasks, vault, problems),
    resources: verifyYamlRecords(
      expected.resources,
      plan.targets.resources,
      "resources",
      {
        missing: "brak zasobu id=",
        mismatch: "niezgodne pola zasobu id=",
        duplicate: "zduplikowane id zasobu",
        defaultPath: "Resources/resources.yaml",
      },
      vault,
      problems
    ),
    user_tags: verifyYamlRecords(
      expected.tags,
      plan.targets.tags,
      "tags",
      {
        missing: "brak tagu id=",
        mismatch: "niezgodne pola tagu id=",
        duplicate: "zduplikowane id tagu",
        defaultPath: "Resources/tags.yaml",
      },
      vault,
      problems
    ),
    task_templates: verifyYamlRecords(
      expected.templates,
      plan.targets.templates,
      "templates",
      {
        missing: "brak szablonu id=",
        mismatch: "niezgodne pola szablonu id=",
        duplicate: "zduplikowane id szablonu",
        defaultPath: "Tasks/templates.yaml",
      },
      vault,
      problems
    ),
  };
  return { ok: problems.length === 0, problems, found };
}
