import React, { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { CALENDAR_COLORS } from "./calendarConstants";
import type { UserTagRecord } from "@/types/records";

export type UserTag = Omit<UserTagRecord, "createdAt">;

type TranslationDict = Record<string, string | string[]>;

interface TagsSectionProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: TranslationDict;
  userTags: UserTag[];
  onTagsChange: () => void;
}

export function TagsSection({ apiFetch, lang, t, userTags, onTagsChange }: TagsSectionProps) {
  const [newTag, setNewTag] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState(CALENDAR_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTag, setEditTag] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editColor, setEditColor] = useState(CALENDAR_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const addTag = async () => {
    const tag = newTag.trim().replace(/^#/, "") || "";
    if (!tag) return;
    setSaving(true);
    try {
      await apiFetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, title: newTitle.trim(), color: newColor }),
      });
      setNewTag("");
      setNewTitle("");
      setNewColor(CALENDAR_COLORS[0]);
      onTagsChange();
    } catch (err) {
      console.error("Add tag failed", err);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: UserTag) => {
    setEditingId(item.id);
    setEditTag(item.tag);
    setEditTitle(item.title);
    setEditColor(item.color || CALENDAR_COLORS[0]);
  };

  const saveEdit = async (id: string) => {
    if (editingId !== id) return;
    const tag = editTag.trim().replace(/^#/, "") || "";
    if (!tag) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, title: editTitle.trim(), color: editColor }),
      });
      setEditingId(null);
      setEditTag("");
      setEditTitle("");
      setEditColor(CALENDAR_COLORS[0]);
      onTagsChange();
    } catch (err) {
      console.error("Update tag failed", err);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTag("");
    setEditTitle("");
    setEditColor(CALENDAR_COLORS[0]);
  };

  const deleteTag = async (id: string) => {
    try {
      await apiFetch(`/api/tags/${id}`, { method: "DELETE" });
      onTagsChange();
    } catch (err) {
      console.error("Delete tag failed", err);
    }
  };

  const labels = {
    title: (t.tagsTitle as string) ?? "Tag list",
    subtitle: (t.tagsSubtitle as string) ?? "Assign a default title to each tag.",
    tagLabel: (t.tagsTagLabel as string) ?? "Tag",
    titleLabel: (t.tagsTitleLabel as string) ?? "Default title",
    add: (t.tagsAdd as string) ?? "Add tag",
    noTags: (t.tagsNoTags as string) ?? "No tags yet. Add your first tag.",
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
      <div className="p-6 border-b border-[var(--border)] bg-[var(--surface)]">
        <h2 className="text-lg font-bold mb-1">{labels.title}</h2>
        <p className="text-sm text-[var(--text2)] mb-4">{labels.subtitle}</p>
        <div className="max-w-2xl grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder={`#${labels.tagLabel.toLowerCase()}`}
            className="px-4 py-3 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
          />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder={labels.titleLabel}
            className="px-4 py-3 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--text2)]">
            <span>Kolor</span>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-9 h-9 rounded-lg border border-[var(--border)] cursor-pointer"
              title="Kolor tagu"
            />
          </label>
          <button
            type="button"
            onClick={addTag}
            disabled={saving || !newTag.trim()}
            className="flex items-center gap-2 px-4 py-3 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {labels.add}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {userTags.length === 0 && !saving ? (
          <div className="max-w-md p-8 border-2 border-dashed border-[var(--border)] rounded-2xl text-center text-[var(--text2)] text-sm">
            {labels.noTags}
          </div>
        ) : (
          <ul className="max-w-2xl space-y-2">
            {userTags.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl"
              >
                {editingId === item.id ? (
                  <>
                    <input
                      type="text"
                      value={editTag}
                      onChange={(e) => setEditTag(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 bg-[var(--bg3)] border-none rounded-lg text-sm"
                      placeholder={labels.tagLabel}
                    />
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(item.id)}
                      className="flex-1 min-w-0 px-3 py-2 bg-[var(--bg3)] border-none rounded-lg text-sm"
                      placeholder={labels.titleLabel}
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer"
                      title="Kolor"
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(item.id)}
                      className="p-2 text-[var(--text)] hover:bg-[var(--bg3)] rounded-lg"
                      title="Save"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-sm text-[var(--text2)] hover:bg-[var(--bg3)] rounded-lg"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ backgroundColor: item.color || CALENDAR_COLORS[0] }}
                      title="Kolor tagu"
                    />
                    <span className="font-medium text-sm text-[var(--text)]">#{item.tag}</span>
                    <span className="flex-1 min-w-0 text-sm text-[var(--text2)] truncate">
                      {item.title || "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="p-2 text-[var(--text2)] hover:bg-[var(--bg3)] rounded-lg"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTag(item.id)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
