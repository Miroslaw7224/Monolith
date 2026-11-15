import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Task } from "./TasksSection";
import { useT } from "@/src/i18n/useT";

export interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  /** Projekty z rejestru do wyboru; brak = sama opcja „Bez projektu”. */
  projects?: { id: string; name: string }[];
  onClose: () => void;
  onSave: (payload: {
    title: string;
    link: string;
    description: string;
    status: Task["status"];
    due_date: string | null;
    project: string | null;
  }) => Promise<void>;
}

export function TaskDetailModal({
  task,
  isOpen,
  projects = [],
  onClose,
  onSave,
}: TaskDetailModalProps) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [dueDate, setDueDate] = useState("");
  const [project, setProject] = useState("");
  const [saving, setSaving] = useState(false);
  const syncedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      syncedIdRef.current = null;
      return;
    }
    if (!task) return;
    if (syncedIdRef.current === task.id) return;
    syncedIdRef.current = task.id;
    setTitle(task.title);
    setLink(task.link ?? "");
    setDescription(task.description ?? "");
    setStatus(task.status);
    setDueDate(task.due_date ?? "");
    setProject(task.project ?? "");
  }, [isOpen, task]);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed || !task) return;
    setSaving(true);
    try {
      await onSave({
        title: trimmed,
        link: link.trim(),
        description: description.trim(),
        status,
        due_date: dueDate.trim() === "" ? null : dueDate.trim(),
        project: project === "" ? null : project,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !task) return null;

  const closeLabel = t("planning:calendarCancel");
  const statusOptions: { value: Task["status"]; label: string }[] = [
    { value: "deferred", label: t("tasks:tasksDeferred") },
    { value: "todo", label: t("tasks:tasksTodo") },
    { value: "in_progress", label: t("tasks:tasksInProgress") },
    { value: "to_review", label: t("tasks:tasksToReview") },
    { value: "done", label: t("tasks:tasksDone") },
  ];

  // projekt usunięty z rejestru: zostaje wybrany (z samym id), żeby zapis go po cichu nie skasował
  const orphanProject = project !== "" && !projects.some((p) => p.id === project) ? project : null;

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
          <div className="zad-field">
            <label htmlFor="task-detail-title-field" className="zad-label">
              {t("tasks:tasksDetailTitleFieldLabel")}
            </label>
            <input
              id="task-detail-title-field"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="zad-input"
            />
          </div>

          <div className="zad-field">
            <label htmlFor="task-detail-link" className="zad-label">
              {t("tasks:tasksDetailLinkLabel")}
            </label>
            <input
              id="task-detail-link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
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
                  onClick={() => setStatus(opt.value)}
                  className={[
                    "zad-status-btn",
                    status === opt.value ? "zad-status-btn--active" : "",
                  ]
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
              onChange={(e) => setDueDate(e.target.value)}
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
              onChange={(e) => setProject(e.target.value)}
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

          <div className="zad-field">
            <label htmlFor="task-detail-note" className="zad-label">
              {t("tasks:tasksDetailNoteLabel")}
            </label>
            <textarea
              id="task-detail-note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("tasks:tasksDetailNotePlaceholder")}
              rows={6}
              className="zad-textarea"
            />
          </div>
        </div>

        <div className="zad-modal__footer">
          <button type="button" onClick={onClose} className="zad-btn zad-btn--ghost">
            {closeLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !title.trim()}
            className="zad-btn zad-btn--primary"
          >
            {saving ? t("tasks:tasksDetailSaving") : t("tasks:tasksDetailSave")}
          </button>
        </div>
      </div>
    </div>
  );
}
