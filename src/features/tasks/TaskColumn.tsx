import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Task } from "./TasksSection";
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
      className={["zad-column", isDragOverColumn ? "zad-column--drop-target" : ""]
        .filter(Boolean)
        .join(" ")}
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
      <h3 className="zad-column__title">
        <span className={`zad-dot zad-dot--${status}`} aria-hidden="true" />
        <span className="zad-column__title-text">{title}</span>
        <span className="zad-column__count">{tasks.length}</span>
      </h3>
      <ul className="zad-column__list">
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
          className="zad-btn zad-btn--ghost zad-btn--expand"
        >
          <ChevronDown className="w-3.5 h-3.5" aria-hidden />
          {labels.showMore(hiddenCount)}
        </button>
      ) : null}
      {expanded && canCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="zad-btn zad-btn--ghost zad-btn--expand"
        >
          <ChevronUp className="w-3.5 h-3.5" aria-hidden />
          {labels.showLess}
        </button>
      ) : null}
    </div>
  );
}
