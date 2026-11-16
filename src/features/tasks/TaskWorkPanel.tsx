import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Task } from "./TasksSection";
import { useT } from "@/src/i18n/useT";
import { TaskDetailContent } from "./TaskDetailContent";
import type { TaskPatch } from "./useTasksBoard";
import type { DuplicateHandler } from "./TaskDetailContent";

interface Props {
  task: Task;
  projects: { id: string; name: string }[];
  onClose: () => void;
  onPatch: (taskId: string, patch: TaskPatch) => Promise<void>;
  onDuplicate?: DuplicateHandler;
}

/** Panel roboczy zadania w siatce tablicy (od 1024 px); ta sama treść co modal. */
export function TaskWorkPanel({ task, projects, onClose, onPatch, onDuplicate }: Props) {
  const t = useT();
  const closeLabel = t("tasks:tasksDetailClose");
  const ref = useRef<HTMLElement>(null);

  // po otwarciu lub zmianie zadania panel ma być widoczny w całości (tablica przewija się w `.zad`)
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [task.id]);
  return (
    <aside
      ref={ref}
      className="zad-work-panel"
      aria-label={t("tasks:tasksPanelAria")}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="zad-work-panel__head">
        <h3 className="zad-modal__title">{t("tasks:tasksDetailModalTitle")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="zad-btn zad-btn--ghost zad-btn--sm"
          aria-label={closeLabel}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="zad-work-panel__body">
        <TaskDetailContent
          key={task.id}
          task={task}
          projects={projects}
          onPatch={onPatch}
          onDuplicate={onDuplicate}
        />
      </div>
    </aside>
  );
}
