import React from "react";
import { GripVertical, Trash2 } from "lucide-react";
import type { Task } from "./TasksSection";
import { TaskDescriptionLink } from "./TaskDescriptionLink";
import { URGENT_PRIORITY } from "./taskPriorityUtils";
import { getTaskDueState } from "./taskStatsUtils";
import { getTaskEnergy, setTaskEnergy, type TaskEnergy } from "./taskEnergyUtils";
import type { TaskProject } from "./useTasksBoard";
import { PROJECT_KIND_LABELS } from "@/contexts/bc_projects/schemas";
import { useT } from "@/src/i18n/useT";

interface TaskCardProps {
  task: Task;
  isDragging: boolean;
  isDragOver: boolean;
  draggable: boolean;
  isDone: boolean;
  editingId: string | null;
  editTitle: string;
  labels: {
    startDateLabel: string;
    deadlineLabel: string;
  };
  /** Projekt zadania z rejestru (kolor i znacznik rodzaju); brak, gdy zadanie bez projektu lub projekt nieznany. */
  project?: TaskProject;
  formatDate: (iso: string | null | undefined) => string;
  onDragStart: (taskId: string) => void;
  onDragOver: (taskId: string) => void;
  onDragEnd: () => void;
  onDropOnTask: (taskId: string) => void;
  onTitleAreaClick: (task: Task) => void;
  onTitleAreaDoubleClick: (task: Task) => void;
  onEditTitleChange: (value: string) => void;
  onEditTitleCommit: (taskId: string) => void;
  onEditTitleCancel: () => void;
  onDueDateChange: (taskId: string, due: string | null) => void;
  onToggleEnergy: (taskId: string, energy: TaskEnergy) => void;
  onToggleUrgent: (taskId: string) => void;
  now: Date;
  onDelete: (taskId: string) => void;
}

export function TaskCard({
  task,
  isDragging,
  isDragOver,
  draggable,
  isDone,
  editingId,
  editTitle,
  labels,
  project,
  formatDate,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDropOnTask,
  onTitleAreaClick,
  onTitleAreaDoubleClick,
  onEditTitleChange,
  onEditTitleCommit,
  onEditTitleCancel,
  onDueDateChange,
  onToggleEnergy,
  onToggleUrgent,
  now,
  onDelete,
}: TaskCardProps) {
  const t = useT();
  const isUrgent = task.priority === URGENT_PRIORITY;
  const dueState = getTaskDueState(task, now);
  const energy = getTaskEnergy(task.title);
  return (
    <li
      className={[
        "zad-card",
        isDragging ? "zad-card--dragging" : "",
        isDragOver ? "zad-card--dragover" : "",
        isDone ? "zad-card--done" : "",
        dueState ? `zad-card--${dueState}` : "",
        isUrgent && !isDone ? "zad-card--urgent" : "",
        project ? `zad-card--kind zad-card--kind-${project.kind}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDragOver(task.id);
      }}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDropOnTask(task.id);
      }}
    >
      <div
        draggable={draggable}
        onDragStart={(e) => {
          if (!draggable) return;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", task.id);
          onDragStart(task.id);
        }}
        onDragEnd={onDragEnd}
        className={[
          "zad-card__grip",
          draggable ? "zad-card__grip--draggable" : "zad-card__grip--disabled",
        ].join(" ")}
        title={t("tasks:tasksCardDrag")}
        aria-hidden={!draggable}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      <span className="zad-mark" aria-hidden="true">
        {isDone ? "[x]" : "[ ]"}
      </span>

      <div className="zad-card__main">
        {editingId === task.id ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onBlur={() => onEditTitleCommit(task.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEditTitleCommit(task.id);
              if (e.key === "Escape") onEditTitleCancel();
            }}
            className="zad-input zad-input--sm zad-card__edit-input"
            autoFocus
          />
        ) : (
          <div>
            <div className="zad-card__titlerow">
              <button
                type="button"
                onClick={() => onTitleAreaClick(task)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  onTitleAreaDoubleClick(task);
                }}
                className={["zad-card__title-btn", isDone ? "zad-card__title-btn--done" : ""].join(
                  " "
                )}
              >
                <span className={["zad-title", isDone ? "zad-title--done" : ""].join(" ")}>
                  {setTaskEnergy(task.title, null)}
                </span>
                {Boolean(task.link?.trim()) && (
                  <span
                    className="zad-link-dot"
                    title={t("tasks:tasksDetailLinkLabel")}
                    aria-hidden="true"
                  />
                )}
              </button>
              <button
                type="button"
                className="zad-urgent-btn"
                aria-pressed={isUrgent}
                title={t("tasks:tasksCardUrgentTitle")}
                onClick={() => onToggleUrgent(task.id)}
              >
                {t("tasks:tasksCardUrgent")}
              </button>
              <span className="zad-energy" role="group" aria-label={t("tasks:tasksEnergyAria")}>
                {(["deep", "quick"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`zad-energy__btn zad-energy__btn--${value}`}
                    aria-pressed={energy === value}
                    onClick={() => onToggleEnergy(task.id, value)}
                  >
                    {value === "deep" ? "Deep" : "Quick"}
                  </button>
                ))}
              </span>
            </div>
            <TaskDescriptionLink link={task.link} />
          </div>
        )}
        <div className="zad-meta">
          {task.created_at && (
            <span className="zad-date-created">
              {labels.startDateLabel}: {formatDate(task.created_at)}
            </span>
          )}
          <label className="zad-due-label">
            <span className="zad-due-prefix">{labels.deadlineLabel}:</span>
            <input
              type="date"
              value={task.due_date ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                onDueDateChange(task.id, v === "" ? null : v);
              }}
              className="zad-due-input"
            />
            {dueState && (
              <span className={`zad-due-flag zad-due-flag--${dueState}`}>
                {dueState === "overdue" ? t("tasks:tasksCardOverdue") : t("tasks:tasksTileToday")}
              </span>
            )}
          </label>
          {project && (
            <span
              className={`zad-kind zad-kind--${project.kind}`}
              title={`${PROJECT_KIND_LABELS[project.kind]}: ${project.name}`}
            >
              {PROJECT_KIND_LABELS[project.kind]} · {project.name}
            </span>
          )}
          {task.priority != null && task.priority !== URGENT_PRIORITY && (
            <span className={`zad-pri zad-pri--p${task.priority}`}>P{task.priority}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(task.id)}
        className="zad-card__delete-btn"
        aria-label={t("tasks:tasksCardDelete")}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}
