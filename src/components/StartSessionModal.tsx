/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { CALENDAR_COLORS } from "@/src/lib/calendarConstants";

export interface StartSessionPayload {
  title: string;
  tags: string[];
  color: string;
}

interface StartSessionModalProps {
  existingTags: string[];
  tagTitles: Record<string, string>;
  tagColors: Record<string, string>;
  onSubmit: (payload: StartSessionPayload) => void;
  onCancel: () => void;
  submitLabel: string;
  cancelLabel: string;
  titleLabel: string;
  tagsLabel: string;
  tagPlaceholder: string;
  suggestionsLabel: string;
}

function getColorForTag(tag: string, tagColors: Record<string, string>): string | undefined {
  if (tagColors[tag]) return tagColors[tag];
  const lower = tag.toLowerCase();
  const key = Object.keys(tagColors).find((k) => k.toLowerCase() === lower);
  return key ? tagColors[key] : undefined;
}

export function StartSessionModal({
  existingTags,
  tagTitles,
  tagColors,
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel,
  titleLabel,
  tagsLabel,
  tagPlaceholder,
  suggestionsLabel,
}: StartSessionModalProps) {
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInputFocused, setTagInputFocused] = useState(false);
  const tagContainerRef = useRef<HTMLDivElement>(null);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (t: string) => {
    setTags(tags.filter((x) => x !== t));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle && tags.length === 0) return;
    const displayTitle = trimmedTitle || tags.map((x) => `#${x}`).join(" ");
    const firstTagWithColor = tags.find((t) => getColorForTag(t, tagColors));
    const color =
      firstTagWithColor && getColorForTag(firstTagWithColor, tagColors)
        ? getColorForTag(firstTagWithColor, tagColors)!
        : CALENDAR_COLORS[0];
    onSubmit({
      title: displayTitle,
      tags,
      color,
    });
  };

  const tagInputNormalized = tagInput.trim().replace(/^#/, "").toLowerCase();
  const filteredExistingTags = existingTags
    .filter((t) => {
      if (tags.includes(t)) return false;
      if (!tagInputNormalized) return true;
      return t.toLowerCase().includes(tagInputNormalized);
    })
    .slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">
          {titleLabel}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. QA testing, Learning"
          className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">
          {tagsLabel}
        </label>
        <div className="flex gap-2 flex-wrap">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--border)] rounded-md text-xs font-medium"
            >
              #{t}
              <button type="button" onClick={() => removeTag(t)} className="hover:text-red-500">
                ×
              </button>
            </span>
          ))}
          <div ref={tagContainerRef} className="relative flex gap-1 flex-1 min-w-[120px]">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onFocus={() => setTagInputFocused(true)}
              onBlur={() => {
                setTimeout(() => {
                  if (
                    tagContainerRef.current &&
                    !tagContainerRef.current.contains(document.activeElement)
                  ) {
                    setTagInputFocused(false);
                  }
                }, 180);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              placeholder={tagPlaceholder}
              className="flex-1 px-2 py-1 bg-[var(--bg3)] border-none rounded text-sm"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-2 py-1 bg-[var(--accent)] text-white rounded text-sm"
            >
              +
            </button>
            {(tagInputFocused || tagInput) && filteredExistingTags.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg max-h-40 overflow-y-auto">
                <p className="px-2 py-0.5 text-[10px] font-bold text-[var(--text3)] uppercase">
                  {suggestionsLabel}
                </p>
                {filteredExistingTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!tags.includes(t)) setTags([...tags, t]);
                      setTagInput("");
                      const assignedTitle = tagTitles[t];
                      if (assignedTitle) setTitle(assignedTitle);
                    }}
                    className="w-full text-left text-sm px-3 py-1.5 hover:bg-[var(--bg3)] flex items-center gap-1"
                  >
                    <span className="text-[var(--text2)]">#</span>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-[var(--bg3)] rounded-xl text-sm font-semibold"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={!title.trim() && tags.length === 0}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
