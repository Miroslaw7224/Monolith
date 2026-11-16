import React, { useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw } from "lucide-react";
import type { Task } from "./TasksSection";
import type { TaskStatus } from "./taskOrderUtils";
import { getVisibleColumnTasks } from "./taskOrderUtils";
import { TaskCard } from "./TaskCard";
import type { TaskEnergy } from "./taskEnergyUtils";
import type { TaskProject } from "./useTasksBoard";
import { clampHeight } from "./taskBoardLayout";
import { useT } from "@/src/i18n/useT";

interface TaskColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
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
  projectsById: ReadonlyMap<string, TaskProject>;
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
  onToggleEnergy: (taskId: string, energy: TaskEnergy) => void;
  onToggleUrgent: (taskId: string) => void;
  now: Date;
  onDelete: (taskId: string) => void;
  /** Kolumna zwinięta do paska (poziomo) lub samego nagłówka (w stosie). */
  columnCollapsed: boolean;
  /** Kolumna w stosie trybu roboczego: zwija się w pionie. */
  stacked?: boolean;
  onToggleColumn: (status: TaskStatus, collapsed: boolean) => void;
  /** Własna wysokość listy kart w px; `undefined` = automatyczna. */
  listHeight: number | undefined;
  onListHeightChange: (status: TaskStatus, px: number | null) => void;
}

export function TaskColumn({
  status,
  title,
  tasks,
  collapseEnabled,
  isDragOverColumn,
  dragTaskId,
  dragOverTaskId,
  draggable,
  editingId,
  editTitle,
  labels,
  projectsById,
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
  onToggleEnergy,
  onToggleUrgent,
  now,
  onDelete,
  columnCollapsed,
  stacked = false,
  onToggleColumn,
  listHeight,
  onListHeightChange,
}: TaskColumnProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const shownHeight = dragHeight ?? listHeight;

  const currentHeight = () => listRef.current?.getBoundingClientRect().height ?? 0;

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { startY: e.clientY, startH: currentHeight() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d) setDragHeight(clampHeight(d.startH + e.clientY - d.startY));
  };
  const endDrag = (commit: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && commit && dragHeight !== null) onListHeightChange(status, dragHeight);
    setDragHeight(null);
  };
  const onHandleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowDown" ? 40 : e.key === "ArrowUp" ? -40 : 0;
    if (!step) return;
    e.preventDefault();
    onListHeightChange(status, clampHeight(currentHeight() + step));
  };

  const { visibleTasks, hiddenCount, isCollapsed, canCollapse } = getVisibleColumnTasks(
    tasks,
    expanded,
    collapseEnabled
  );

  return (
    <div
      className={[
        "zad-column",
        isDragOverColumn ? "zad-column--drop-target" : "",
        columnCollapsed ? "zad-column--collapsed" : "",
        stacked ? "zad-column--stacked" : "",
      ]
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
        {listHeight !== undefined && !columnCollapsed ? (
          <button
            type="button"
            className="zad-btn zad-btn--ghost zad-btn--sm zad-column__tool"
            aria-label={t("tasks:tasksColumnResetHeight")}
            onClick={() => onListHeightChange(status, null)}
          >
            <RotateCcw className="w-3 h-3" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          className="zad-btn zad-btn--ghost zad-btn--sm zad-column__tool"
          aria-label={
            columnCollapsed ? t("tasks:tasksColumnExpand") : t("tasks:tasksColumnCollapse")
          }
          aria-expanded={!columnCollapsed}
          onClick={() => onToggleColumn(status, !columnCollapsed)}
        >
          {stacked ? (
            columnCollapsed ? (
              <ChevronDown className="w-3 h-3" aria-hidden />
            ) : (
              <ChevronUp className="w-3 h-3" aria-hidden />
            )
          ) : columnCollapsed ? (
            <ChevronRight className="w-3 h-3" aria-hidden />
          ) : (
            <ChevronLeft className="w-3 h-3" aria-hidden />
          )}
        </button>
      </h3>
      {columnCollapsed ? null : (
        <ul
          ref={listRef}
          className={[
            "zad-column__list",
            shownHeight !== undefined ? "zad-column__list--sized" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={shownHeight !== undefined ? { height: `${shownHeight}px` } : undefined}
        >
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isDragging={dragTaskId === task.id}
              isDragOver={dragOverTaskId === task.id && dragTaskId !== task.id}
              draggable={draggable}
              isDone={status === "done"}
              editingId={editingId}
              editTitle={editTitle}
              labels={labels}
              project={task.project ? projectsById.get(task.project) : undefined}
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
              onToggleEnergy={onToggleEnergy}
              onToggleUrgent={onToggleUrgent}
              now={now}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
      {columnCollapsed ? null : (
        <div
          className="zad-column__handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label={t("tasks:tasksColumnResize")}
          tabIndex={0}
          title={t("tasks:tasksColumnResizeHint")}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={() => endDrag(true)}
          onPointerCancel={() => endDrag(false)}
          onKeyDown={onHandleKeyDown}
          onDoubleClick={() => onListHeightChange(status, null)}
        />
      )}
      {!columnCollapsed && isCollapsed ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="zad-btn zad-btn--ghost zad-btn--expand"
        >
          <ChevronDown className="w-3.5 h-3.5" aria-hidden />
          {labels.showMore(hiddenCount)}
        </button>
      ) : null}
      {!columnCollapsed && expanded && canCollapse ? (
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
