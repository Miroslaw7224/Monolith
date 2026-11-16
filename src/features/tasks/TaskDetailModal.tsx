import React from "react";
import { X } from "lucide-react";
import type { Task } from "./TasksSection";
import { useT } from "@/src/i18n/useT";
import { TaskDetailContent } from "./TaskDetailContent";
import type { TaskPatch } from "./useTasksBoard";

export interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  /** Projekty z rejestru do wyboru; brak = sama opcja „Bez projektu”. */
  projects?: { id: string; name: string }[];
  onClose: () => void;
  onPatch: (taskId: string, patch: TaskPatch) => Promise<void>;
}

export function TaskDetailModal({
  task,
  isOpen,
  projects = [],
  onClose,
  onPatch,
}: TaskDetailModalProps) {
  const t = useT();
  if (!isOpen || !task) return null;
  const closeLabel = t("tasks:tasksDetailClose");

  return (
    <div
      className="zad-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      <div
        className="zad-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="zad-modal__head">
          <h3 id="task-detail-title" className="zad-modal__title">
            {t("tasks:tasksDetailModalTitle")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="zad-btn zad-btn--ghost zad-btn--sm"
            aria-label={closeLabel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="zad-modal__body">
          <TaskDetailContent key={task.id} task={task} projects={projects} onPatch={onPatch} />
        </div>

        <div className="zad-modal__footer">
          <button type="button" onClick={onClose} className="zad-btn zad-btn--ghost">
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
