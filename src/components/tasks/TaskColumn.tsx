import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Task } from "../TasksSection";
import type { TaskStatus } from "./taskOrderUtils";
import { getVisibleColumnTasks } from "./taskOrderUtils";
import { TaskCard } from "./TaskCard";

interface TaskColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  lang: "en" | "pl";
  collapseEnabled: boolean;
  isDragOverColumn: boolean;
  dragTaskId: string | null;
  dragOverTaskId: string | null;
  draggable: boolean;
  editingId: string | null;
  editTitle: string;
  labels: {
    startDateLabel: string;
    deadlineLabel: string;
    showMore: (count: number) => string;
    showLess: string;
  };
  formatDate: (iso: string | null | undefined) => string;
  onColumnDragOver: (status: TaskStatus) => void;
  onColumnDrop: (status: TaskStatus) => void;
  onDragStart: (taskId: string) => void;
  onDragOverTask: (taskId: string) => void;
  onDragEnd: () => void;
  onDropOnTask: (taskId: string, columnStatus: TaskStatus) => void;
  onTitleAreaClick: (task: Task) => void;
  onTitleAreaDoubleClick: (task: Task) => void;
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
  collapseEnabled,
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
  onTitleAreaDoubleClick,
  onEditTitleChange,
  onEditTitleCommit,
  onEditTitleCancel,
  onDueDateChange,
  onDelete,
}: TaskColumnProps) {
  const [expanded, setExpanded] = useState(false);
  const { visibleTasks, hiddenCount, isCollapsed, canCollapse } = getVisibleColumnTasks(
    tasks,
    expanded,
    collapseEnabled
  );

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
        {visibleTasks.map((task) => (
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
            onTitleAreaDoubleClick={onTitleAreaDoubleClick}
            onEditTitleChange={onEditTitleChange}
            onEditTitleCommit={onEditTitleCommit}
            onEditTitleCancel={onEditTitleCancel}
            onDueDateChange={onDueDateChange}
            onDelete={onDelete}
          />
        ))}
      </ul>
      {isCollapsed ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--accent)] bg-[var(--accent-bg)] hover:bg-[var(--accent-border)]/30 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" aria-hidden />
          {labels.showMore(hiddenCount)}
        </button>
      ) : null}
      {expanded && canCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--text2)] bg-[var(--bg3)] hover:bg-[var(--border)] transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" aria-hidden />
          {labels.showLess}
        </button>
      ) : null}
    </div>
  );
}
