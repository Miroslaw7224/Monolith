import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";

export interface TaskTemplate {
  id: string;
  label: string;
  title: string;
  link: string;
  created_at?: string;
}

type TranslationDict = Record<string, string | string[]>;

export interface TaskTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  t: TranslationDict;
  onTemplatesChange: () => void;
}

export function TaskTemplatesModal({
  isOpen,
  onClose,
  apiFetch,
  t,
  onTemplatesChange,
}: TaskTemplatesModalProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newLink, setNewLink] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editLink, setEditLink] = useState("");

  const labels = {
    modalTitle: (t.tasksTemplatesModalTitle as string) ?? "Task templates",
    subtitle:
      (t.tasksTemplatesSubtitle as string) ?? "Save frequently used tasks for quick create.",
    labelField: (t.tasksTemplateLabelField as string) ?? "Template name",
    titleField: (t.tasksTemplateTitleField as string) ?? "Default task name",
    linkLabel: (t.tasksDetailLinkLabel as string) ?? "Link",
    linkPlaceholder: (t.tasksDetailLinkPlaceholder as string) ?? "https://…",
    add: (t.tasksTemplatesAdd as string) ?? "Add template",
    noItems: (t.tasksTemplatesNoItems as string) ?? "No templates yet. Add your first.",
    close: (t.calendarCancel as string) ?? "Close",
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/task-templates");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void fetchTemplates();
    setEditingId(null);
    setNewLabel("");
    setNewTitle("");
    setNewLink("");
  }, [isOpen, apiFetch]);

  const notifyChange = () => {
    onTemplatesChange();
  };

  const addTemplate = async () => {
    const label = newLabel.trim();
    const title = newTitle.trim() || label;
    if (!label) return;
    setSaving(true);
    try {
      await apiFetch("/api/task-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, title, link: newLink.trim() }),
      });
      setNewLabel("");
      setNewTitle("");
      setNewLink("");
      await fetchTemplates();
      notifyChange();
    } catch (err) {
      console.error("Add task template failed", err);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: TaskTemplate) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditTitle(item.title);
    setEditLink(item.link ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
    setEditTitle("");
    setEditLink("");
  };

  const saveEdit = async (id: string) => {
    if (editingId !== id) return;
    const label = editLabel.trim();
    const title = editTitle.trim() || label;
    if (!label) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/task-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, title, link: editLink.trim() }),
      });
      cancelEdit();
      await fetchTemplates();
      notifyChange();
    } catch (err) {
      console.error("Update task template failed", err);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await apiFetch(`/api/task-templates/${id}`, { method: "DELETE" });
      if (editingId === id) cancelEdit();
      await fetchTemplates();
      notifyChange();
    } catch (err) {
      console.error("Delete task template failed", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-templates-modal-title"
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div>
            <h3
              id="task-templates-modal-title"
              className="text-lg font-bold text-[var(--text)]"
            >
              {labels.modalTitle}
            </h3>
            <p className="text-sm text-[var(--text2)] mt-0.5">{labels.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg3)] rounded-lg transition-colors text-[var(--text2)]"
            aria-label={labels.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--border)] space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={labels.labelField}
              aria-label={labels.labelField}
              className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg3)] text-[var(--text)] text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
            />
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addTemplate()}
              placeholder={labels.titleField}
              aria-label={labels.titleField}
              className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg3)] text-[var(--text)] text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addTemplate()}
              placeholder={labels.linkPlaceholder}
              aria-label={labels.linkLabel}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg3)] text-[var(--text)] text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
            />
            <button
              type="button"
              onClick={() => void addTemplate()}
              disabled={saving || !newLabel.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {labels.add}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-[var(--text2)]">Loading…</p>
          ) : templates.length === 0 ? (
            <div className="p-6 border-2 border-dashed border-[var(--border)] rounded-2xl text-center text-[var(--text2)] text-sm">
              {labels.noItems}
            </div>
          ) : (
            <ul className="space-y-2">
              {templates.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl"
                >
                  {editingId === item.id ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="px-3 py-2 bg-[var(--bg3)] border-none rounded-lg text-sm"
                          placeholder={labels.labelField}
                        />
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && void saveEdit(item.id)}
                          className="px-3 py-2 bg-[var(--bg3)] border-none rounded-lg text-sm"
                          placeholder={labels.titleField}
                        />
                      </div>
                      <input
                        type="url"
                        value={editLink}
                        onChange={(e) => setEditLink(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void saveEdit(item.id)}
                        className="w-full px-3 py-2 bg-[var(--bg3)] border-none rounded-lg text-sm"
                        placeholder={labels.linkPlaceholder}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-sm text-[var(--text2)] hover:bg-[var(--bg3)] rounded-lg"
                        >
                          {labels.close}
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEdit(item.id)}
                          disabled={saving || !editLabel.trim()}
                          className="px-3 py-1.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-lg disabled:opacity-50"
                        >
                          <Pencil className="w-4 h-4 inline mr-1" />
                          {(t.tasksDetailSave as string) ?? "Save"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-[var(--text)] truncate">
                          {item.label}
                        </div>
                        <div className="text-sm text-[var(--text2)] truncate">{item.title}</div>
                        {item.link ? (
                          <div className="text-xs text-[var(--text3)] truncate mt-0.5">
                            {item.link}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="p-2 text-[var(--text2)] hover:bg-[var(--bg3)] rounded-lg"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTemplate(item.id)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
