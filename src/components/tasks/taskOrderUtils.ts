import type { Task } from "../TasksSection";

export type TaskStatus = Task["status"];

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

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

  const columnIds = (status: TaskStatus) =>
    remaining.filter((t) => t.status === status).map((t) => t.id);

  let todoIds = columnIds("todo");
  let inProgressIds = columnIds("in_progress");
  let doneIds = columnIds("done");

  let targetList =
    targetStatus === "todo" ? todoIds : targetStatus === "in_progress" ? inProgressIds : doneIds;

  let insertIndex = targetList.length;
  if (targetTaskId) {
    const idx = targetList.indexOf(targetTaskId);
    if (idx >= 0) insertIndex = idx;
  }

  targetList = [...targetList.slice(0, insertIndex), draggedId, ...targetList.slice(insertIndex)];

  if (targetStatus === "todo") todoIds = targetList;
  else if (targetStatus === "in_progress") inProgressIds = targetList;
  else doneIds = targetList;

  return {
    orderedIds: [...todoIds, ...inProgressIds, ...doneIds],
    statusChanged,
  };
}

export function tasksByStatus(tasks: Task[], status: TaskStatus): Task[] {
  return tasks.filter((t) => t.status === status);
}
