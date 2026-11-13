import type { BoardTask, TaskColumn, TasksBoard } from "@/contexts/bc_projects/models";

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
