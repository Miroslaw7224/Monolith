import { formatFrontmatter, parseFrontmatter } from "../../lib/nexus/frontmatter";
import { formatTaskLine } from "../../lib/nexus/task-line";
import {
  formatYamlList,
  GENERATED_BY_IMPORT,
  parseYamlList,
  type YamlRecord,
} from "../../lib/nexus/yaml-lists";
import { buildNoteFiles } from "./notes";
import { allocateName, htmlFileName, slugify } from "./slug";
import type { Converted, NoteLoss, PlanResult, PlannedFile, VaultNote, VaultView } from "./types";

const NOTES_DIR = "Notes";
const NOTES_HTML_DIR = "Notes/.html";

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function actionFor(vault: VaultView, relPath: string, content: string): PlannedFile["action"] {
  const current = vault.read(relPath);
  if (current === null) return "create";
  return current === content ? "unchanged" : "update";
}

/** Rekord z kluczami w podanej kolejności; wartości `undefined` pomijamy. */
function pick(source: object, keys: string[]): YamlRecord {
  const record = source as Record<string, unknown>;
  const out: YamlRecord = {};
  for (const key of keys) {
    if (record[key] !== undefined) out[key] = record[key];
  }
  return out;
}

function planNotes(
  notes: VaultNote[],
  vault: VaultView
): {
  files: PlannedFile[];
  noteFiles: Record<string, string>;
  noteLosses: NoteLoss[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const importIds = new Set(notes.map((n) => n.id));

  // Indeks istniejących notatek: id -> ścieżka; nazwy zajęte (małe litery) -> ścieżka.
  const idToRel: Record<string, string> = {};
  const taken = new Map<string, { relPath: string; ours: boolean }>();
  for (const name of vault.list(NOTES_DIR).filter((n) => n.toLowerCase().endsWith(".md"))) {
    const relPath = `${NOTES_DIR}/${name}`;
    const text = vault.read(relPath);
    const meta = text === null ? null : (parseFrontmatter(text)?.meta ?? null);
    const id = meta !== null && typeof meta.id === "string" ? meta.id : null;
    let ours = false;
    if (id !== null && !(id in idToRel)) {
      idToRel[id] = relPath;
      ours = importIds.has(id);
    }
    taken.set(name.slice(0, -3).toLowerCase(), { relPath, ours });
  }

  const sorted = [...notes].sort(
    (a, b) => compareText(a.created ?? "", b.created ?? "") || compareText(a.id, b.id)
  );

  const files: PlannedFile[] = [];
  const noteFiles: Record<string, string> = {};
  const noteLosses: NoteLoss[] = [];
  for (const note of sorted) {
    let relPath = idToRel[note.id];
    if (relPath === undefined) {
      const base = slugify(note.title);
      const blocker = taken.get(base.toLowerCase());
      if (blocker !== undefined && !blocker.ours) {
        warnings.push(
          `Notatka id=${note.id}: nazwa ${base}.md koliduje z istniejącym plikiem ${blocker.relPath}; zapis pod inną nazwą`
        );
      }
      const name = allocateName(base, (candidate) => taken.has(candidate.toLowerCase()));
      relPath = `${NOTES_DIR}/${name}.md`;
      taken.set(name.toLowerCase(), { relPath, ours: true });
    }
    noteFiles[note.id] = relPath;

    const built = buildNoteFiles(note);
    files.push({
      relPath,
      content: built.markdown,
      kind: "note",
      action: actionFor(vault, relPath, built.markdown),
    });
    const htmlPath = `${NOTES_HTML_DIR}/${htmlFileName(note.id)}.html`;
    files.push({
      relPath: htmlPath,
      content: built.html,
      kind: "note-html",
      action: actionFor(vault, htmlPath, built.html),
    });
    if (built.losses.length > 0) {
      noteLosses.push({ id: note.id, relPath, losses: built.losses });
    }
  }
  return { files, noteFiles, noteLosses, warnings };
}

function splitExt(relPath: string): { stem: string; ext: string } {
  const dot = relPath.lastIndexOf(".");
  return { stem: relPath.slice(0, dot), ext: relPath.slice(dot) };
}

/** Plik jest nasz, gdy ma znacznik importu; uszkodzony lub nieobsługiwany plik uznajemy za obcy. */
function isOurs(text: string, kind: "markdown" | "yaml", listKey: string): boolean {
  try {
    if (kind === "markdown") {
      return parseFrontmatter(text)?.meta.generated_by === GENERATED_BY_IMPORT;
    }
    return parseYamlList(text, listKey).generatedBy === GENERATED_BY_IMPORT;
  } catch {
    return false;
  }
}

function chooseTarget(
  base: string,
  vault: VaultView,
  kind: "markdown" | "yaml",
  listKey: string,
  warnings: string[]
): string {
  const { stem, ext } = splitExt(base);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${stem}-${n}${ext}`;
    const text = vault.read(candidate);
    if (text === null || isOurs(text, kind, listKey)) {
      if (candidate !== base) {
        warnings.push(`Istniejący plik ${base} nie pochodzi z importu; zapis do ${candidate}`);
      }
      return candidate;
    }
  }
}

const RESOURCE_KEYS = [
  "id",
  "title",
  "url",
  "description",
  "tags",
  "favorite",
  "thumbnail_url",
  "note_id",
  "created",
  "updated",
];
const TAG_KEYS = ["id", "tag", "title", "color", "created"];
const TEMPLATE_KEYS = ["id", "label", "title", "link", "created"];

export function buildPlan(converted: Converted, vault: VaultView): PlanResult {
  const notes = planNotes(converted.notes, vault);
  const files: PlannedFile[] = [...notes.files];
  const warnings: string[] = [...notes.warnings];
  const targets: PlanResult["targets"] = {};

  const addSingle = (
    key: "tasks" | "resources" | "tags" | "templates",
    kind: "markdown" | "yaml",
    listKey: string,
    base: string,
    render: () => string
  ) => {
    const relPath = chooseTarget(base, vault, kind, listKey, warnings);
    const content = render();
    targets[key] = relPath;
    files.push({ relPath, content, kind: key, action: actionFor(vault, relPath, content) });
  };

  if (converted.tasks.length > 0) {
    const tasks = [...converted.tasks].sort((a, b) => {
      const ao = a.order === null ? 1 : 0;
      const bo = b.order === null ? 1 : 0;
      return (
        ao - bo ||
        (a.order ?? 0) - (b.order ?? 0) ||
        compareText(a.created_at ?? "", b.created_at ?? "") ||
        compareText(a.id, b.id)
      );
    });
    addSingle("tasks", "markdown", "", "Tasks/tasks.md", () =>
      formatFrontmatter(
        { generated_by: GENERATED_BY_IMPORT },
        "# Zadania\n\n" + tasks.map(formatTaskLine).join("\n")
      )
    );
  }

  if (converted.resources.length > 0) {
    const sorted = [...converted.resources].sort(
      (a, b) => compareText(a.created ?? "", b.created ?? "") || compareText(a.id, b.id)
    );
    addSingle("resources", "yaml", "resources", "Resources/resources.yaml", () =>
      formatYamlList(
        "resources",
        sorted.map((r) => pick(r, RESOURCE_KEYS)),
        GENERATED_BY_IMPORT
      )
    );
  }

  if (converted.tags.length > 0) {
    const sorted = [...converted.tags].sort(
      (a, b) => compareText(a.tag, b.tag) || compareText(a.id, b.id)
    );
    addSingle("tags", "yaml", "tags", "Resources/tags.yaml", () =>
      formatYamlList(
        "tags",
        sorted.map((t) => pick(t, TAG_KEYS)),
        GENERATED_BY_IMPORT
      )
    );
  }

  if (converted.templates.length > 0) {
    const sorted = [...converted.templates].sort(
      (a, b) => compareText(a.label, b.label) || compareText(a.id, b.id)
    );
    addSingle("templates", "yaml", "templates", "Tasks/templates.yaml", () =>
      formatYamlList(
        "templates",
        sorted.map((t) => pick(t, TEMPLATE_KEYS)),
        GENERATED_BY_IMPORT
      )
    );
  }

  return {
    files,
    targets,
    noteFiles: notes.noteFiles,
    noteLosses: notes.noteLosses,
    warnings,
  };
}
