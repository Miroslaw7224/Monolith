import React from "react";
import { GripVertical, Trash2 } from "lucide-react";
import type { Task } from "./TasksSection";
import { TaskDescriptionLink } from "./TaskDescriptionLink";
import { URGENT_PRIORITY } from "./taskPriorityUtils";
import { getTaskDueState } from "./taskStatsUtils";
import { getTaskEnergy, setTaskEnergy, type TaskEnergy } from "./taskEnergyUtils";

interface TaskCardProps {
  task: Task;
  lang: "en" | "pl";
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
  lang,
  isDragging,
  isDragOver,
  draggable,
  isDone,
  editingId,
  editTitle,
  labels,
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
        title={lang === "pl" ? "Przeciągnij" : "Drag"}
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
                  <span className="zad-link-dot" title="Link" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className="zad-urgent-btn"
                aria-pressed={isUrgent}
                title={lang === "pl" ? "Pilne: do zrobienia od ręki" : "Urgent: do right away"}
                onClick={() => onToggleUrgent(task.id)}
              >
                {lang === "pl" ? "Pilne" : "Urgent"}
              </button>
              <span className="zad-energy" role="group" aria-label="Energia">
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
                {dueState === "overdue"
                  ? lang === "pl"
                    ? "po terminie"
                    : "overdue"
                  : lang === "pl"
                    ? "dziś"
                    : "today"}
              </span>
            )}
          </label>
          {task.priority != null && task.priority !== URGENT_PRIORITY && (
            <span className={`zad-pri zad-pri--p${task.priority}`}>P{task.priority}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(task.id)}
        className="zad-card__delete-btn"
        aria-label={lang === "pl" ? "Usuń" : "Delete"}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}
