import type { Task } from "./TasksSection";
import { getTaskEnergy } from "./taskEnergyUtils";

export interface TaskTilesData {
  inProgress: { count: number; deep: number; quick: number };
  todo: { count: number; nextDue: string | null };
  deadlines: { overdue: number; today: number; week: number };
  doneWeek: { count: number; prevCount: number };
}

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Poniedziałek tygodnia zawierającego `d`, o północy czasu lokalnego. */
function weekStart(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** Liczby do kafli karty Zadania (daty lokalne; terminy `YYYY-MM-DD` porównywane jako napisy). */
export function computeTaskTiles(tasks: Task[], now: Date): TaskTilesData {
  const today = isoDate(now);
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
  const weekEndIso = isoDate(weekEnd);
  const thisWeek = weekStart(now);
  const prevWeek = new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() - 7);

  const data: TaskTilesData = {
    inProgress: { count: 0, deep: 0, quick: 0 },
    todo: { count: 0, nextDue: null },
    deadlines: { overdue: 0, today: 0, week: 0 },
    doneWeek: { count: 0, prevCount: 0 },
  };

  for (const task of tasks) {
    if (task.status === "done") {
      if (!task.updated_at) continue;
      const updated = new Date(task.updated_at);
      if (Number.isNaN(updated.getTime())) continue;
      if (updated >= thisWeek) data.doneWeek.count += 1;
      else if (updated >= prevWeek) data.doneWeek.prevCount += 1;
      continue;
    }

    if (task.status === "in_progress") {
      data.inProgress.count += 1;
      const energy = getTaskEnergy(task.title);
      if (energy) data.inProgress[energy] += 1;
    } else if (task.status === "todo") {
      data.todo.count += 1;
      if (task.due_date && (!data.todo.nextDue || task.due_date < data.todo.nextDue)) {
        data.todo.nextDue = task.due_date;
      }
    }

    const due = task.due_date;
    if (!due) continue;
    if (due < today) data.deadlines.overdue += 1;
    else if (due === today) data.deadlines.today += 1;
    else if (due <= weekEndIso) data.deadlines.week += 1;
  }

  return data;
}

/** Zaległe (termin przed dziś) albo na dziś; zadania zrobione i bez terminu → `null`. */
export function getTaskDueState(task: Task, now: Date): "overdue" | "today" | null {
  if (task.status === "done" || !task.due_date) return null;
  const today = isoDate(now);
  if (task.due_date < today) return "overdue";
  return task.due_date === today ? "today" : null;
}
