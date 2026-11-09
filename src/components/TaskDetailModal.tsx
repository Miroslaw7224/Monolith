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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 id="task-detail-title" className="text-lg font-bold text-[var(--text)]">
            {modalTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg3)] rounded-lg transition-colors text-[var(--text2)]"
            aria-label={closeLabel}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label
              htmlFor="task-detail-title-field"
              className="block text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1.5"
            >
              {titleLabel}
            </label>
            <input
              id="task-detail-title-field"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg3)] text-[var(--text)] text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="task-detail-link"
              className="block text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1.5"
            >
              {linkLabel}
            </label>
            <input
              id="task-detail-link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={linkPlaceholder}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg3)] text-[var(--text)] text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1.5">
              {statusLabel}
            </span>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    status === opt.value
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--border)]",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="task-detail-due"
              className="block text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1.5"
            >
              {deadlineLabel}
            </label>
            <input
              id="task-detail-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full max-w-xs px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg3)] text-[var(--text)] text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="task-detail-note"
              className="block text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1.5"
            >
              {noteLabel}
            </label>
            <textarea
              id="task-detail-note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={notePlaceholder}
              rows={8}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg3)] text-[var(--text)] text-sm min-h-[120px] resize-y focus:ring-2 focus:ring-[var(--accent)] outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text2)] hover:bg-[var(--bg3)]"
          >
            {closeLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !title.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white disabled:opacity-50"
          >
            {saving ? ((t.tasksDetailSaving as string) ?? "…") : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
