export const TASK_STATUSES = ["todo", "in_progress", "to_review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskLine = {
  id: string;
  title: string;
  status: TaskStatus;
  link: string;
  description: string;
  due_date: string | null;
  priority: number | null;
  order: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export class TaskLineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskLineError";
  }
}

const LINE = /^- \[( |x|X)\](?: ([\s\S]*))?$/;
const FIELD_START = /^\[([A-Za-z_][\w-]*)::/;

function esc(value: string): string {
  return value.replace(/[\\[\]\n\r]/g, (c) => (c === "\n" ? "\\n" : c === "\r" ? "\\r" : `\\${c}`));
}

/** Znaczenie sekwencji `\x`; nieznane sekwencje zostają dosłownie (ręcznie pisany tekst). */
function unescapePair(next: string): string {
  if (next === "n") return "\n";
  if (next === "r") return "\r";
  if (next === "\\" || next === "[" || next === "]") return next;
  return `\\${next}`;
}

/** Czyta tekst z sekwencjami ucieczki aż do pierwszego nieucieczkowanego `stop` (lub końca). */
function readEscaped(
  s: string,
  from: number,
  stop: string
): { text: string; end: number; stopped: boolean } {
  let out = "";
  let i = from;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      out += unescapePair(s[i + 1]);
      i += 2;
      continue;
    }
    if (c === stop) return { text: out, end: i, stopped: true };
    out += c;
    i++;
  }
  return { text: out, end: i, stopped: false };
}

export function formatTaskLine(task: TaskLine): string {
  const fields: Array<[string, string]> = [
    ["id", task.id],
    ["status", task.status],
  ];
  if (task.due_date !== null) fields.push(["due", task.due_date]);
  if (task.priority !== null) fields.push(["priority", String(task.priority)]);
  if (task.order !== null) fields.push(["order", String(task.order)]);
  if (task.link !== "") fields.push(["link", task.link]);
  if (task.description !== "") fields.push(["desc", task.description]);
  if (task.created_at !== null) fields.push(["created", task.created_at]);
  if (task.updated_at !== null) fields.push(["updated", task.updated_at]);
  const box = task.status === "done" ? "x" : " ";
  return `- [${box}] ${esc(task.title)}` + fields.map(([k, v]) => ` [${k}:: ${esc(v)}]`).join("");
}

function numberField(raw: string | undefined, name: string): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  if (raw.trim() === "" || Number.isNaN(n)) {
    throw new TaskLineError(`pole ${name}: "${raw}" nie jest liczbą`);
  }
  return n;
}

/** Zwraca `null`, gdy linia nie jest zadaniem; rzuca `TaskLineError`, gdy pola są uszkodzone. */
export function parseTaskLine(line: string): TaskLine | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const rest = m[2] ?? "";

  let title = "";
  let i = 0;
  while (i < rest.length) {
    const c = rest[i];
    if (c === "\\" && i + 1 < rest.length) {
      title += unescapePair(rest[i + 1]);
      i += 2;
      continue;
    }
    if (c === "[" && FIELD_START.test(rest.slice(i))) break;
    title += c;
    i++;
  }
  // Format dopisuje jedną spację przed pierwszym polem; tylko ją usuwamy.
  if (i < rest.length && title.endsWith(" ")) title = title.slice(0, -1);

  const fields: Record<string, string> = {};
  while (i < rest.length) {
    const start = FIELD_START.exec(rest.slice(i));
    if (!start) {
      throw new TaskLineError(`nieoczekiwany tekst po polach: "${rest.slice(i, i + 20)}"`);
    }
    let j = i + start[0].length;
    if (rest[j] === " ") j++;
    const value = readEscaped(rest, j, "]");
    if (!value.stopped) throw new TaskLineError(`niezamknięte pole [${start[1]}::`);
    fields[start[1]] = value.text;
    i = value.end + 1;
    while (rest[i] === " ") i++;
  }

  const status = fields.status ?? (m[1] === " " ? "todo" : "done");
  if (!(TASK_STATUSES as readonly string[]).includes(status)) {
    throw new TaskLineError(`nieznany status "${status}"`);
  }
  return {
    id: fields.id ?? "",
    title,
    status: status as TaskStatus,
    link: fields.link ?? "",
    description: fields.desc ?? "",
    due_date: fields.due ?? null,
    priority: numberField(fields.priority, "priority"),
    order: numberField(fields.order, "order"),
    created_at: fields.created ?? null,
    updated_at: fields.updated ?? null,
  };
}

/** Wszystkie linie zadań z pliku Markdown; pozostałe linie (nagłówki, puste) są pomijane. */
export function parseTaskLines(text: string): TaskLine[] {
  const out: TaskLine[] = [];
  for (const line of text.split(/\r?\n/)) {
    const task = parseTaskLine(line);
    if (task) out.push(task);
  }
  return out;
}
