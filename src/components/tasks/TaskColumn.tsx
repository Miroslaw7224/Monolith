import React from "react";
import type { Task } from "../TasksSection";
import type { TaskStatus } from "./taskOrderUtils";
import { TaskCard } from "./TaskCard";

interface TaskColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  lang: "en" | "pl";
  isDragOverColumn: boolean;
  dragTaskId: string | null;
  dragOverTaskId: string | null;
  draggable: boolean;
  editingId: string | null;
  editTitle: string;
  labels: {
    startDateLabel: string;
    deadlineLabel: string;
  };
  formatDate: (iso: string | null | undefined) => string;
  onColumnDragOver: (status: TaskStatus) => void;
  onColumnDrop: (status: TaskStatus) => void;
  onDragStart: (taskId: string) => void;
  onDragOverTask: (taskId: string) => void;
  onDragEnd: () => void;
  onDropOnTask: (taskId: string, columnStatus: TaskStatus) => void;
  onTitleAreaClick: (task: Task) => void;
  onEditTitleChange: (value: string) => void;
  onEditTitleCommit: (taskId: string) => void;
  onEditTitleCancel: () => void;
  onDueDateChange: (taskId: string, due: string | null) => void;
  onDelete: (taskId: string) => void;
}

export function TaskColumn({
  status,
  title,
  tasks,
  lang,
  isDragOverColumn,
  dragTaskId,
  dragOverTaskId,
  draggable,
  editingId,
  editTitle,
  labels,
  formatDate,
  onColumnDragOver,
  onColumnDrop,
  onDragStart,
  onDragOverTask,
  onDragEnd,
  onDropOnTask,
  onTitleAreaClick,
  onEditTitleChange,
  onEditTitleCommit,
  onEditTitleCancel,
  onDueDateChange,
  onDelete,
}: TaskColumnProps) {
  return (
    <div
      className={[
        "flex flex-col min-w-0 flex-1 rounded-xl p-3 min-h-[12rem] transition-colors",
        isDragOverColumn
          ? "bg-[var(--accent-bg)] border border-[var(--accent-border)]"
          : "bg-[var(--bg2)]/50",
      ].join(" ")}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onColumnDragOver(status);
      }}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onColumnDrop(status);
      }}
    >
      <h3 className="text-sm font-bold text-[var(--text2)] uppercase tracking-wider mb-3 px-1">
        {title}
        <span className="ml-2 text-[var(--text3)] font-normal normal-case">{tasks.length}</span>
      </h3>
      <ul className="space-y-1 flex-1">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            lang={lang}
            isDragging={dragTaskId === task.id}
            isDragOver={dragOverTaskId === task.id && dragTaskId !== task.id}
            draggable={draggable}
            isDone={status === "done"}
            editingId={editingId}
            editTitle={editTitle}
            labels={labels}
            formatDate={formatDate}
            onDragStart={onDragStart}
            onDragOver={onDragOverTask}
            onDragEnd={onDragEnd}
            onDropOnTask={(taskId) => onDropOnTask(taskId, status)}
            onTitleAreaClick={onTitleAreaClick}
            onEditTitleChange={onEditTitleChange}
            onEditTitleCommit={onEditTitleCommit}
            onEditTitleCancel={onEditTitleCancel}
            onDueDateChange={onDueDateChange}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}
