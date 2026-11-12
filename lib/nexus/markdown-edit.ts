import { formatTaskLine, parseTaskLine, type TaskLine } from "./task-line";

/** Tekst z `vault-fs` jest już znormalizowany do LF. */
const FRONTMATTER = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;

type Entry = { index: number; task: TaskLine };

/** Linie zadań z niepustym `id`; uszkodzone linie i duplikaty `id` (poza pierwszym) są pomijane. */
function scan(lines: string[]): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  lines.forEach((line, index) => {
    let task: TaskLine | null;
    try {
      task = parseTaskLine(line);
    } catch {
      return;
    }
    if (task === null || task.id === "" || seen.has(task.id)) return;
    seen.add(task.id);
    out.push({ index, task });
  });
  return out;
}

export function readTasks(text: string | null): TaskLine[] {
  if (text === null) return [];
  return scan(text.split("\n")).map((entry) => entry.task);
}

/** Dopisuje linię na końcu; brak pliku lub sam biały tekst daje nagłówek `# Zadania` i jedną linię. */
export function appendTaskLine(text: string | null, task: TaskLine): string {
  const line = formatTaskLine(task);
  if (text === null || text.trim() === "") return `# Zadania\n\n${line}\n`;
  return `${text.replace(/\n*$/, "\n")}${line}\n`;
}

/**
 * Przepisuje (przez `formatTaskLine`) tylko linie o podanych `id`, dla których `apply` zwraca inny
 * obiekt niż dostał (ta sama referencja = linia zostaje bajtowo); reszta tekstu zostaje bajtowo.
 * `missing` to `id`, których nie znaleziono; gdy jest niepuste, zwracany tekst jest nietknięty.
 */
export function updateTaskLines(
  text: string,
  ids: readonly string[],
  apply: (task: TaskLine) => TaskLine
): { text: string; missing: string[] } {
  const lines = text.split("\n");
  const entries = scan(lines);
  const missing: string[] = [];
  for (const id of ids) {
    const entry = entries.find((e) => e.task.id === id);
    if (!entry) {
      missing.push(id);
      continue;
    }
    const next = apply(entry.task);
    if (next !== entry.task) lines[entry.index] = formatTaskLine(next);
  }
  if (missing.length > 0) return { text, missing };
  return { text: lines.join("\n"), missing };
}

/** Usuwa linię o danym `id`; `null`, gdy jej nie ma. */
export function removeTaskLine(text: string, id: string): string | null {
  const lines = text.split("\n");
  const entry = scan(lines).find((e) => e.task.id === id);
  if (!entry) return null;
  lines.splice(entry.index, 1);
  return lines.join("\n");
}

/** Usuwa klucz `generated_by` z frontmattera (T3); pusty frontmatter znika razem z blokiem `---`. */
export function stripGeneratedBy(text: string): string {
  const match = FRONTMATTER.exec(text);
  if (!match) return text;
  const all = match[1].split("\n");
  const kept = all.filter((line) => !/^generated_by\s*:/.test(line));
  if (kept.length === all.length) return text;
  const rest = text.slice(match[0].length);
  if (kept.every((line) => line.trim() === "")) return rest.replace(/^\n+/, "");
  return `---\n${kept.join("\n")}\n---\n${rest}`;
}
