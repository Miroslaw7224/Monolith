import {
  TASK_COLUMNS,
  type BugEntry,
  type BugTaskLink,
  type TasksBoard,
} from "@/contexts/bc_projects/models";

/** Po tylu dniach otwarty bug dostaje znaczek „stary”. Osobna stała od `STALE_AFTER_DAYS` (Save State). */
export const BUG_STALE_AFTER_DAYS = 14;

const DAY_MS = 86_400_000;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Zadanie tablicy powiązane z bugiem: ID występuje w treści jako osobny token (nie przylega do liter,
 * cyfr ani myślnika). Niezakończone zadanie ma pierwszeństwo przed zakończonym.
 */
export function findBugTask(id: string, board: TasksBoard): BugTaskLink | undefined {
  const pattern = new RegExp(`(?<![A-Za-z0-9-])${escapeRegExp(id)}(?![A-Za-z0-9-])`);
  let doneLink: BugTaskLink | undefined;
  for (const column of TASK_COLUMNS) {
    for (const task of board[column]) {
      if (!pattern.test(task.text)) continue;
      if (!task.done) return { column, done: false };
      if (doneLink === undefined) doneLink = { column, done: true };
    }
  }
  return doneLink;
}

/** Dopisuje pola pochodne (`ageDays`, `stale`, `task`); nie zmienia wejścia, pola bez wartości pomija. */
export function enrichBugs(bugs: BugEntry[], board: TasksBoard, today: Date): BugEntry[] {
  if (bugs.length === 0) return bugs;
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return bugs.map((bug) => {
    const out: BugEntry = { ...bug };
    if (bug.section !== "Zamknięte" && bug.opened !== undefined) {
      const [y, m, d] = bug.opened.split("-").map(Number);
      const age = Math.max(0, Math.round((todayUtc - Date.UTC(y, m - 1, d)) / DAY_MS));
      out.ageDays = age;
      if (age > BUG_STALE_AFTER_DAYS) out.stale = true;
    }
    const task = findBugTask(bug.id, board);
    if (task !== undefined) out.task = task;
    return out;
  });
}
