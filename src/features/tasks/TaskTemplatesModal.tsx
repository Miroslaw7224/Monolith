import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import type { TaskTemplateDto } from "@/contexts/bc_tasks/schemas";
import { useT } from "@/src/i18n/useT";

export type TaskTemplate = TaskTemplateDto;

export interface TaskTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onTemplatesChange: () => void;
}

export function TaskTemplatesModal({
  isOpen,
  onClose,
  apiFetch,
  onTemplatesChange,
}: TaskTemplatesModalProps) {
  const t = useT();
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

  const closeLabel = t("planning:calendarCancel");

  const fetchTemplates = useCallback(async () => {
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
  }, [apiFetch]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchTemplates();
    setEditingId(null);
    setNewLabel("");
    setNewTitle("");
    setNewLink("");
  }, [isOpen, fetchTemplates]);

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
      className="zad-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-templates-modal-title"
    >
      <div
        className="zad-modal zad-modal--lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="zad-modal__head">
          <div>
            <h3 id="task-templates-modal-title" className="zad-modal__title">
              {t("tasks:tasksTemplatesModalTitle")}
            </h3>
            <p className="zad-modal__sub">{t("tasks:tasksTemplatesSubtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="zad-btn zad-btn--ghost zad-btn--sm"
            aria-label={closeLabel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="zad-modal__body zad-modal__body--templates">
          <div className="zad-template-form">
            <div className="zad-template-form__grid">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t("tasks:tasksTemplateLabelField")}
                aria-label={t("tasks:tasksTemplateLabelField")}
                className="zad-input"
              />
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addTemplate()}
                placeholder={t("tasks:tasksTemplateTitleField")}
                aria-label={t("tasks:tasksTemplateTitleField")}
                className="zad-input"
              />
            </div>
            <div className="zad-template-form__row">
              <input
                type="url"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addTemplate()}
                placeholder={t("tasks:tasksDetailLinkPlaceholder")}
                aria-label={t("tasks:tasksDetailLinkLabel")}
                className="zad-input zad-input--flex"
              />
              <button
                type="button"
                onClick={() => void addTemplate()}
                disabled={saving || !newLabel.trim()}
                className="zad-btn zad-btn--primary"
              >
                <Plus className="w-4 h-4" />
                {t("tasks:tasksTemplatesAdd")}
              </button>
            </div>
          </div>

          <div className="zad-templates-list-container">
            {loading ? (
              <p className="zad-state zad-state--loading">{t("tasks:tasksLoading")}</p>
            ) : templates.length === 0 ? (
              <div className="zad-empty-box">{t("tasks:tasksTemplatesNoItems")}</div>
            ) : (
              <ul className="zad-templates-list">
                {templates.map((item) => (
                  <li key={item.id} className="zad-template-item">
                    {editingId === item.id ? (
                      <div className="zad-template-edit">
                        <div className="zad-template-form__grid">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="zad-input"
                            placeholder={t("tasks:tasksTemplateLabelField")}
                          />
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && void saveEdit(item.id)}
                            className="zad-input"
                            placeholder={t("tasks:tasksTemplateTitleField")}
                          />
                        </div>
                        <input
                          type="url"
                          value={editLink}
                          onChange={(e) => setEditLink(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && void saveEdit(item.id)}
                          className="zad-input"
                          placeholder={t("tasks:tasksDetailLinkPlaceholder")}
                        />
                        <div className="zad-template-edit__actions">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="zad-btn zad-btn--ghost zad-btn--sm"
                          >
                            {closeLabel}
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveEdit(item.id)}
                            disabled={saving || !editLabel.trim()}
                            className="zad-btn zad-btn--primary zad-btn--sm"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {t("tasks:tasksDetailSave")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="zad-template-item__row">
                        <div className="zad-template-item__info">
                          <div className="zad-template-item__label">{item.label}</div>
                          <div className="zad-template-item__title">{item.title}</div>
                          {item.link ? (
                            <div className="zad-template-item__link">{item.link}</div>
                          ) : null}
                        </div>
                        <div className="zad-template-item__actions">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="zad-btn zad-btn--ghost zad-btn--sm"
                            title={t("tasks:tasksTemplateEdit")}
                            aria-label={t("tasks:tasksTemplateEdit")}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTemplate(item.id)}
                            className="zad-btn zad-btn--ghost zad-btn--sm zad-btn--danger"
                            title={t("tasks:tasksCardDelete")}
                            aria-label={t("tasks:tasksCardDelete")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
