import React, { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import type { UserTagDto } from "@/contexts/bc_tags/schemas";
import { CALENDAR_COLORS } from "@/src/lib/calendarConstants";
import { useT } from "@/src/i18n/useT";

export type UserTag = UserTagDto;

interface TagsSectionProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  userTags: UserTag[];
  onTagsChange: () => void;
}

export function TagsSection({ apiFetch, userTags, onTagsChange }: TagsSectionProps) {
  const t = useT();
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
      <div className="p-6 border-b border-[var(--border)] bg-[var(--surface)]">
        <h2 className="text-lg font-bold mb-1">{t("planning:tagsTitle")}</h2>
        <p className="text-sm text-[var(--text2)] mb-4">{t("planning:tagsSubtitle")}</p>
        <div className="max-w-2xl grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder={`#${t("planning:tagsTagLabel").toLowerCase()}`}
            className="px-4 py-3 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
          />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder={t("planning:tagsTitleLabel")}
            className="px-4 py-3 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--text2)]">
            <span>{t("planning:tagsColorLabel")}</span>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-9 h-9 rounded-lg border border-[var(--border)] cursor-pointer"
              title={t("planning:tagsColorTitle")}
            />
          </label>
          <button
            type="button"
            onClick={addTag}
            disabled={saving || !newTag.trim()}
            className="flex items-center gap-2 px-4 py-3 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {t("planning:tagsAdd")}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {userTags.length === 0 && !saving ? (
          <div className="max-w-md p-8 border-2 border-dashed border-[var(--border)] rounded-2xl text-center text-[var(--text2)] text-sm">
            {t("planning:tagsNoTags")}
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
                      placeholder={t("planning:tagsTagLabel")}
                    />
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(item.id)}
                      className="flex-1 min-w-0 px-3 py-2 bg-[var(--bg3)] border-none rounded-lg text-sm"
                      placeholder={t("planning:tagsTitleLabel")}
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer"
                      title={t("planning:tagsColorLabel")}
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(item.id)}
                      className="p-2 text-[var(--text)] hover:bg-[var(--bg3)] rounded-lg"
                      title={t("planning:calendarSave")}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-sm text-[var(--text2)] hover:bg-[var(--bg3)] rounded-lg"
                    >
                      {t("planning:calendarCancel")}
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ backgroundColor: item.color || CALENDAR_COLORS[0] }}
                      title={t("planning:tagsColorTitle")}
                    />
                    <span className="font-medium text-sm text-[var(--text)]">#{item.tag}</span>
                    <span className="flex-1 min-w-0 text-sm text-[var(--text2)] truncate">
                      {item.title || "—"}
                    </span>
                    {item.aliases && item.aliases.length > 0 && (
                      <span
                        className="text-xs text-[var(--text2)] truncate"
                        title={item.aliases.join(", ")}
                      >
                        ≈ {item.aliases.join(", ")}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="p-2 text-[var(--text2)] hover:bg-[var(--bg3)] rounded-lg"
                      title={t("planning:tagsEdit")}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTag(item.id)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                      title={t("planning:tagsDelete")}
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
