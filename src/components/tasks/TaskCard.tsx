import React from "react";
import { GripVertical, Trash2 } from "lucide-react";
import type { Task } from "../TasksSection";
import { TaskDescriptionLink } from "./TaskDescriptionLink";

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
  onDelete,
}: TaskCardProps) {
  return (
    <li
      className={[
        "flex items-center gap-1.5 py-1.5 px-2 bg-[var(--surface)] border rounded-lg transition-colors",
        isDragging ? "opacity-40 border-[var(--accent-border)]" : "border-[var(--border)]",
        isDragOver ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "",
        isDone ? "opacity-90" : "",
      ].join(" ")}
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
          "flex-shrink-0 p-0.5 rounded touch-none",
          draggable
            ? "cursor-grab active:cursor-grabbing hover:bg-[var(--bg3)]"
            : "opacity-30 cursor-not-allowed",
        ].join(" ")}
        title={lang === "pl" ? "Przeciągnij" : "Drag"}
        aria-hidden={!draggable}
      >
        <GripVertical className="w-3.5 h-3.5 text-[var(--text3)]" />
      </div>
      <div className="flex-1 min-w-0">
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
            className="w-full px-2 py-0.5 border border-[var(--border)] rounded text-sm bg-[var(--surface)] text-[var(--text)]"
            autoFocus
          />
        ) : (
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onTitleAreaClick(task)}
              onDoubleClick={(e) => {
                e.preventDefault();
                onTitleAreaDoubleClick(task);
              }}
              className={[
                "w-full text-left text-sm font-medium flex items-center gap-2 min-w-0",
                isDone ? "text-[var(--text3)]" : "text-[var(--text)]",
              ].join(" ")}
            >
              <span className={["truncate flex-1 min-w-0", isDone ? "line-through" : ""].join(" ")}>
                {task.title}
              </span>
              {Boolean(task.link?.trim()) ? (
                <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" aria-hidden />
              ) : null}
            </button>
            <TaskDescriptionLink link={task.link} className="mt-0.5" />
          </div>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--text3)]">
          {task.created_at && (
            <span>
              {labels.startDateLabel}: {formatDate(task.created_at)}
            </span>
          )}
          <label className="inline-flex items-center gap-1">
            <span>{labels.deadlineLabel}:</span>
            <input
              type="date"
              value={task.due_date ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                onDueDateChange(task.id, v === "" ? null : v);
              }}
              className="rounded border border-[var(--border)] bg-[var(--bg3)] px-1 py-0.5 text-[10px] text-[var(--text)]"
            />
          </label>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(task.id)}
        className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg flex-shrink-0"
        aria-label={lang === "pl" ? "Usuń" : "Delete"}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}
