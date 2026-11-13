import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Task } from "./TasksSection";

type TranslationDict = Record<string, string | string[]>;

export interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  t: TranslationDict;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    link: string;
    description: string;
    status: Task["status"];
    due_date: string | null;
  }) => Promise<void>;
}

export function TaskDetailModal({ task, isOpen, t, onClose, onSave }: TaskDetailModalProps) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [dueDate, setDueDate] = useState("");
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
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !task) return null;

  const closeLabel = (t.calendarCancel as string) ?? "Close";
  const saveLabel = (t.tasksDetailSave as string) ?? "Save";
  const linkLabel = (t.tasksDetailLinkLabel as string) ?? "Link";
  const linkPlaceholder = (t.tasksDetailLinkPlaceholder as string) ?? "";
  const noteLabel = (t.tasksDetailNoteLabel as string) ?? "Note";
  const notePlaceholder = (t.tasksDetailNotePlaceholder as string) ?? "";
  const titleLabel = (t.tasksDetailTitleFieldLabel as string) ?? "Title";
  const modalTitle = (t.tasksDetailModalTitle as string) ?? "Task";
  const statusLabel = (t.tasksDetailStatusLabel as string) ?? "Status";

  const statusOptions: { value: Task["status"]; label: string }[] = [
    { value: "todo", label: (t.tasksTodo as string) ?? "To do" },
    { value: "in_progress", label: (t.tasksInProgress as string) ?? "In progress" },
    { value: "to_review", label: (t.tasksToReview as string) ?? "To review" },
    { value: "done", label: (t.tasksDone as string) ?? "Done" },
  ];

  const deadlineLabel = (t.tasksDeadlineLabel as string) ?? "Due";

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
            {modalTitle}
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
              {titleLabel}
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
              {linkLabel}
            </label>
            <input
              id="task-detail-link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={linkPlaceholder}
              className="zad-input"
            />
          </div>

          <div className="zad-field">
            <span className="zad-label">{statusLabel}</span>
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
              {deadlineLabel}
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
            <label htmlFor="task-detail-note" className="zad-label">
              {noteLabel}
            </label>
            <textarea
              id="task-detail-note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={notePlaceholder}
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
            {saving ? ((t.tasksDetailSaving as string) ?? "…") : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
