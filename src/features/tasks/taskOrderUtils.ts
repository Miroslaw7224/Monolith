import type { Task } from "./TasksSection";

export type TaskStatus = Task["status"];

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "to_review", "done"];
export const TASK_COLUMN_VISIBLE_LIMIT = 15;

export function sortTasksByNewest(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (tB !== tA) return tB - tA;
    return a.id.localeCompare(b.id);
  });
}

export function getVisibleColumnTasks(
  tasks: Task[],
  expanded: boolean,
  collapseEnabled: boolean
): { visibleTasks: Task[]; hiddenCount: number; isCollapsed: boolean; canCollapse: boolean } {
  const canCollapse = collapseEnabled && tasks.length > TASK_COLUMN_VISIBLE_LIMIT;
  if (!canCollapse || expanded) {
    return { visibleTasks: tasks, hiddenCount: 0, isCollapsed: false, canCollapse };
  }

  const visibleTasks = sortTasksByNewest(tasks).slice(0, TASK_COLUMN_VISIBLE_LIMIT);
  return {
    visibleTasks,
    hiddenCount: tasks.length - TASK_COLUMN_VISIBLE_LIMIT,
    isCollapsed: true,
    canCollapse,
  };
}

export function computeTaskOrderAfterDrop(
  tasks: Task[],
  draggedId: string,
  targetStatus: TaskStatus,
  targetTaskId: string | null
): { orderedIds: string[]; statusChanged: boolean } {
  const dragged = tasks.find((t) => t.id === draggedId);
  if (!dragged) {
    return { orderedIds: tasks.map((t) => t.id), statusChanged: false };
  }

  const statusChanged = dragged.status !== targetStatus;
  const remaining = tasks.filter((t) => t.id !== draggedId);

  const columnIdsByStatus = Object.fromEntries(
    TASK_STATUSES.map((status) => [
      status,
      remaining.filter((t) => t.status === status).map((t) => t.id),
    ])
  ) as Record<TaskStatus, string[]>;

  let targetList = [...columnIdsByStatus[targetStatus]];
  let insertIndex = targetList.length;
  if (targetTaskId) {
    const idx = targetList.indexOf(targetTaskId);
    if (idx >= 0) insertIndex = idx;
  }
  targetList = [...targetList.slice(0, insertIndex), draggedId, ...targetList.slice(insertIndex)];
  columnIdsByStatus[targetStatus] = targetList;

  return {
    orderedIds: TASK_STATUSES.flatMap((status) => columnIdsByStatus[status]),
    statusChanged,
  };
}

export function tasksByStatus(tasks: Task[], status: TaskStatus): Task[] {
  return tasks.filter((t) => t.status === status);
}
