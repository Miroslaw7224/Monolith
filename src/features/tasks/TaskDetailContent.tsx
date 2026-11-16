import React, { useEffect, useState } from "react";
import type { Task } from "./TasksSection";
import { useT } from "@/src/i18n/useT";
import { TaskChecklist } from "./TaskChecklist";
import { useTaskDraft } from "./useTaskDraft";
import type { TaskPatch } from "./useTasksBoard";

export interface TaskDetailContentProps {
  task: Task;
  projects: { id: string; name: string }[];
  onPatch: (taskId: string, patch: TaskPatch) => Promise<void>;
}

/** Pola zadania z autozapisem; wspólne dla modala (< 1024 px) i panelu roboczego. Montować z `key={task.id}`. */
export function TaskDetailContent({ task, projects, onPatch }: TaskDetailContentProps) {
  const t = useT();
  const draft = useTaskDraft({
    taskId: task.id,
    initial: {
      title: task.title,
      link: task.link ?? "",
      description: task.description ?? "",
    },
    save: onPatch,
  });
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [project, setProject] = useState(task.project ?? "");

  // zmiana z zewnątrz (przeciągnięcie karty, data na karcie) odświeża pola
  useEffect(() => {
    setStatus(task.status);
  }, [task.status]);
  useEffect(() => {
    setDueDate(task.due_date ?? "");
  }, [task.due_date]);
  useEffect(() => {
    setProject(task.project ?? "");
  }, [task.project]);

  const statusOptions: { value: Task["status"]; label: string }[] = [
    { value: "deferred", label: t("tasks:tasksDeferred") },
    { value: "todo", label: t("tasks:tasksTodo") },
    { value: "in_progress", label: t("tasks:tasksInProgress") },
    { value: "to_review", label: t("tasks:tasksToReview") },
    { value: "done", label: t("tasks:tasksDone") },
  ];

  // projekt usunięty z rejestru: zostaje wybrany (samo id) i nie jest wysyłany bez zmiany
  const orphanProject = project !== "" && !projects.some((p) => p.id === project) ? project : null;

  const stateText =
    draft.state === "saving"
      ? t("tasks:tasksDetailSaving")
      : draft.state === "saved"
        ? t("tasks:tasksDetailSaved")
        : draft.state === "error"
          ? t("tasks:tasksDetailSaveError")
          : "";

  return (
    <>
      <div className="zad-field">
        <label htmlFor="task-detail-title-field" className="zad-label">
          {t("tasks:tasksDetailTitleFieldLabel")}
        </label>
        <input
          id="task-detail-title-field"
          type="text"
          value={draft.values.title}
          onChange={(e) => draft.setField("title", e.target.value)}
          aria-invalid={draft.titleEmpty}
          className="zad-input"
        />
        {draft.titleEmpty ? (
          <p className="zad-field__error" role="alert">
            {t("tasks:tasksDetailTitleRequired")}
          </p>
        ) : null}
      </div>

      <div className="zad-field">
        <label htmlFor="task-detail-link" className="zad-label">
          {t("tasks:tasksDetailLinkLabel")}
        </label>
        <input
          id="task-detail-link"
          type="url"
          value={draft.values.link}
          onChange={(e) => draft.setField("link", e.target.value)}
          placeholder={t("tasks:tasksDetailLinkPlaceholder")}
          className="zad-input"
        />
      </div>

      <div className="zad-field">
        <span className="zad-label">{t("tasks:tasksDetailStatusLabel")}</span>
        <div className="zad-status-group">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={status === opt.value}
              onClick={() => {
                setStatus(opt.value);
                void draft.saveNow({ status: opt.value }).then((ok) => {
                  if (!ok) setStatus(task.status);
                });
              }}
              className={["zad-status-btn", status === opt.value ? "zad-status-btn--active" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={`zad-dot zad-dot--${opt.value}`} aria-hidden="true" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="zad-field">
        <label htmlFor="task-detail-due" className="zad-label">
          {t("tasks:tasksDeadlineLabel")}
        </label>
        <input
          id="task-detail-due"
          type="date"
          value={dueDate}
          onChange={(e) => {
            const value = e.target.value;
            setDueDate(value);
            void draft.saveNow({ due_date: value === "" ? null : value }).then((ok) => {
              if (!ok) setDueDate(task.due_date ?? "");
            });
          }}
          className="zad-input zad-due-input--field"
        />
      </div>

      <div className="zad-field">
        <label htmlFor="task-detail-project" className="zad-label">
          {t("tasks:tasksDetailProjectLabel")}
        </label>
        <select
          id="task-detail-project"
          value={project}
          onChange={(e) => {
            const value = e.target.value;
            setProject(value);
            void draft.saveNow({ project: value === "" ? null : value }).then((ok) => {
              if (!ok) setProject(task.project ?? "");
            });
          }}
          className="zad-input"
        >
          <option value="">{t("tasks:tasksNoProject")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {orphanProject !== null && <option value={orphanProject}>{orphanProject}</option>}
        </select>
      </div>

      <TaskChecklist
        title={draft.values.title.trim() || task.title}
        value={draft.values.description}
        onChange={(next) => draft.setField("description", next)}
      />

      <p className="zad-save-state" role="status" aria-live="polite">
        {stateText}
      </p>
    </>
  );
}
