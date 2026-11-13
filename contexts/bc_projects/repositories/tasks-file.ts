import type { BoardTask, TaskColumn, TaskOp, TasksBoard } from "@/contexts/bc_projects/models";
import { ConflictError } from "@/lib/errors";

/**
 * Edytor tekstowy `Projects/<id>/tasks.md` dla tablicy zadań (etap 1-3).
 * Czyste funkcje na tekście (zakładają LF: `readVaultFile` normalizuje CRLF); zmieniają wyłącznie
 * wskazane linie, resztę pliku zostawiają bajt w bajt.
 */

type SectionKind = "blockers" | "next" | "icebox";

const SECTION_KIND: Record<string, SectionKind> = {
  Blokery: "blockers",
  Next: "next",
  Backlog: "icebox",
};

const SECTION_RE = /^## (.+?)\s*$/;
const TASK_RE = /^- \[( |x|X)\] (.*)$/;
const CONTINUATION_RE = /^[ \t]+\S/;
const NOW_SUFFIX_RE = /\s\[now::\]$/;
const DONE_DATE_SUFFIX_RE = /\s—\s(\d{4}-\d{2}-\d{2})$/;

export type ScannedTask = {
  column: TaskColumn;
  /** Indeks pierwszej linii bloku w `lines`. */
  start: number;
  /** Indeks za ostatnią linią bloku (linia zadania + wcięte linie). */
  end: number;
  done: boolean;
  now: boolean;
  text: string;
  doneDate?: string;
};

export type ScannedSection = {
  /** Indeks linii nagłówka. */
  heading: number;
  /** Indeks za ostatnią linią sekcji (następny nagłówek `## ` albo koniec pliku). */
  end: number;
};

export type Scan = {
  lines: string[];
  sections: Partial<Record<SectionKind, ScannedSection>>;
  /** Zadania we wszystkich znanych sekcjach, w kolejności pliku. */
  tasks: ScannedTask[];
};

/** Rozbiera treść linii zadania: zdejmuje końcowe `[now::]` i (dla ukończonych) datę, w dowolnej kolejności. */
function parseBody(raw: string, done: boolean): { text: string; now: boolean; doneDate?: string } {
  let body = raw.trim();
  let now = false;
  let doneDate: string | undefined;
  for (let i = 0; i < 2; i += 1) {
    const nowMatch = now ? null : NOW_SUFFIX_RE.exec(body);
    if (nowMatch) {
      now = true;
      body = body.slice(0, nowMatch.index).trimEnd();
      continue;
    }
    const dateMatch = done && doneDate === undefined ? DONE_DATE_SUFFIX_RE.exec(body) : null;
    if (dateMatch) {
      doneDate = dateMatch[1];
      body = body.slice(0, dateMatch.index).trimEnd();
      continue;
    }
    break;
  }
  return doneDate === undefined ? { text: body, now } : { text: body, now, doneDate };
}

export function scanTasks(text: string | null): Scan {
  const lines = text === null ? [] : text.split("\n");
  const headings: number[] = [];
  lines.forEach((line, i) => {
    if (SECTION_RE.test(line)) headings.push(i);
  });

  const sections: Scan["sections"] = {};
  const tasks: ScannedTask[] = [];

  headings.forEach((headingIndex, h) => {
    const name = SECTION_RE.exec(lines[headingIndex])![1].trim();
    const kind = SECTION_KIND[name];
    if (kind === undefined || sections[kind] !== undefined) return;
    const end = h + 1 < headings.length ? headings[h + 1] : lines.length;
    sections[kind] = { heading: headingIndex, end };

    for (let i = headingIndex + 1; i < end; i += 1) {
      const match = TASK_RE.exec(lines[i]);
      if (!match) continue;
      let blockEnd = i + 1;
      while (blockEnd < end && CONTINUATION_RE.test(lines[blockEnd])) blockEnd += 1;
      const done = match[1] !== " ";
      const parsed = parseBody(match[2], done);
      const column: TaskColumn = kind === "next" ? (parsed.now && !done ? "now" : "next") : kind;
      const task: ScannedTask = {
        column,
        start: i,
        end: blockEnd,
        done,
        now: parsed.now && !done,
        text: parsed.text,
      };
      if (parsed.doneDate !== undefined) task.doneDate = parsed.doneDate;
      tasks.push(task);
      i = blockEnd - 1;
    }
  });

  return { lines, sections, tasks };
}

function toBoardTask(task: ScannedTask): BoardTask {
  const result: BoardTask = { text: task.text, done: task.done };
  if (task.doneDate !== undefined) result.doneDate = task.doneDate;
  return result;
}

/** Czwórka kolumn tablicy z tekstu `tasks.md` (`null` = brak pliku). */
export function readBoardText(text: string | null): Omit<TasksBoard, "version"> {
  const board: Omit<TasksBoard, "version"> = { blockers: [], now: [], next: [], icebox: [] };
  for (const task of scanTasks(text).tasks) board[task.column].push(toBoardTask(task));
  return board;
}

export type TaskFileContext = {
  /** Nazwa projektu do nagłówka nowego pliku (`# Tasks — <nazwa>`). */
  projectName: string;
  /** Dzień `YYYY-MM-DD` wpisywany przy ukończeniu zadania. */
  today: string;
};

/** Kanoniczna pierwsza linia bloku zadania. */
function formatTaskLine(task: {
  done: boolean;
  now: boolean;
  text: string;
  doneDate?: string;
}): string {
  if (task.done) {
    return `- [x] ${task.text}${task.doneDate === undefined ? "" : ` — ${task.doneDate}`}`;
  }
  return `- [ ] ${task.text}${task.now ? " [now::]" : ""}`;
}

/** Zadanie wskazane przez kolumnę, indeks w kolumnie i tekst; niezgodność to konflikt (plik się zmienił). */
function locateTask(scan: Scan, ref: { column: TaskColumn; index: number; text: string }) {
  const task = scan.tasks.filter((t) => t.column === ref.column)[ref.index];
  if (task === undefined || task.text !== ref.text) {
    throw new ConflictError("Zadanie zmieniło się w pliku");
  }
  return task;
}

export function applyTaskOp(text: string | null, op: TaskOp, ctx: TaskFileContext): string {
  switch (op.op) {
    case "toggle": {
      const scan = scanTasks(text);
      const task = locateTask(scan, op);
      scan.lines[task.start] = task.done
        ? formatTaskLine({ done: false, now: false, text: task.text })
        : formatTaskLine({ done: true, now: false, text: task.text, doneDate: ctx.today });
      return scan.lines.join("\n");
    }
    case "edit": {
      const scan = scanTasks(text);
      const task = locateTask(scan, op);
      scan.lines[task.start] = formatTaskLine({
        done: task.done,
        now: task.now,
        text: op.newText,
        doneDate: task.doneDate,
      });
      return scan.lines.join("\n");
    }
    case "remove": {
      const scan = scanTasks(text);
      const task = locateTask(scan, op);
      scan.lines.splice(task.start, task.end - task.start);
      return scan.lines.join("\n");
    }
    case "add": {
      const line = formatTaskLine({ done: false, now: op.column === "now", text: op.text });
      const kind = sectionKindOf(op.column);
      if (text === null) return newFileWith(ctx.projectName, kind, [line]);
      return insertBlock(text, kind, [line]);
    }
    case "move": {
      if (op.to === op.column) throw new Error("Zadanie jest już w tej kolumnie");
      const scan = scanTasks(text);
      const task = locateTask(scan, op);
      const movedLine = formatTaskLine({
        done: task.done,
        now: op.to === "now",
        text: task.text,
        doneDate: task.doneDate,
      });
      const kind = sectionKindOf(op.to);
      if (kind === sectionKindOf(task.column)) {
        // next ↔ now: zmienia się tylko znacznik, linia zostaje na miejscu.
        scan.lines[task.start] = movedLine;
        return scan.lines.join("\n");
      }
      const block = [movedLine, ...scan.lines.slice(task.start + 1, task.end)];
      scan.lines.splice(task.start, task.end - task.start);
      return insertBlock(scan.lines.join("\n"), kind, block);
    }
  }
}

const SECTION_HEADING: Record<SectionKind, string> = {
  blockers: "Blokery",
  next: "Next",
  icebox: "Backlog",
};
const SECTION_ORDER: readonly SectionKind[] = ["blockers", "next", "icebox"];
const PLACEHOLDER_RE = /^_?Brak\b/;

/** Sekcja pliku, w której leży kolumna (`now` i `next` dzielą `## Next`). */
function sectionKindOf(column: TaskColumn): SectionKind {
  return column === "now" ? "next" : column;
}

/** Nowy plik (brak `tasks.md`): nagłówek, trzy sekcje, zadanie w sekcji docelowej. */
function newFileWith(projectName: string, target: SectionKind, block: string[]): string {
  let out = `# Tasks — ${projectName}\n`;
  for (const kind of SECTION_ORDER) {
    out += `\n## ${SECTION_HEADING[kind]}\n`;
    if (kind === target) out += `\n${block.join("\n")}\n`;
  }
  return out;
}

/**
 * Wstawia blok linii do sekcji: po ostatnim zadaniu; w sekcji bez zadań usuwa placeholdery `Brak…`
 * i wstawia pod nagłówkiem (albo po ostatniej niepustej linii prozy); brak sekcji dopisuje na końcu pliku.
 */
function insertBlock(text: string, kind: SectionKind, block: string[]): string {
  const scan = scanTasks(text);
  const section = scan.sections[kind];
  if (section === undefined) {
    const head = text.replace(/\n+$/, "");
    const heading = `## ${SECTION_HEADING[kind]}`;
    return `${head === "" ? "" : `${head}\n\n`}${heading}\n\n${block.join("\n")}\n`;
  }

  const inSection = scan.tasks.filter((t) => t.start > section.heading && t.start < section.end);
  if (inSection.length > 0) {
    scan.lines.splice(inSection[inSection.length - 1].end, 0, ...block);
    return scan.lines.join("\n");
  }

  const raw = scan.lines.slice(section.heading + 1, section.end);
  // Placeholder znika tylko wtedy, gdy jest jedyną treścią sekcji; proza zaczynająca się od „Brak” zostaje.
  const onlyPlaceholders = raw
    .filter((line) => line.trim() !== "")
    .every((line) => PLACEHOLDER_RE.test(line.trim()));
  const body = onlyPlaceholders ? [] : raw;
  let lastNonBlank = -1;
  body.forEach((line, i) => {
    if (line.trim() !== "") lastNonBlank = i;
  });
  const tail = body.slice(lastNonBlank + 1);
  const newBody =
    lastNonBlank === -1
      ? ["", ...block, ""]
      : [...body.slice(0, lastNonBlank + 1), "", ...block, ...(tail.length === 0 ? [""] : tail)];
  scan.lines.splice(section.heading + 1, section.end - section.heading - 1, ...newBody);
  return scan.lines.join("\n");
}
