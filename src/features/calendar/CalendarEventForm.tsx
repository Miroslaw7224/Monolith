import React, { useState, useEffect, useRef } from "react";
import {
  CALENDAR_COLORS,
  DURATION_OPTIONS,
  EVENT_TYPE_DEFAULT_DURATION,
  formatDuration,
} from "@/src/lib/calendarConstants";
import { addCalendarDays } from "./calendarUtils";

export interface CalendarEventFormData {
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting";
}

interface CalendarEventFormProps {
  initial?: Partial<CalendarEventFormData>;
  existingTags?: string[];
  /** When user picks a tag, set event title to this if defined */
  tagTitles?: Record<string, string>;
  /** Map tag name → color; event color is derived from the first tag with a color on submit. */
  tagColors?: Record<string, string>;
  onSubmit: (data: CalendarEventFormData) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export function CalendarEventForm({
  initial,
  existingTags = [],
  tagTitles = {},
  tagColors = {},
  onSubmit,
  onCancel,
  submitLabel = "Add",
}: CalendarEventFormProps) {
  const [date, setDate] = useState(initial?.date ?? "");
  const [eventType, setEventType] = useState<"work" | "meeting">(initial?.type ?? "work");
  const [startMinutes, setStartMinutes] = useState(
    initial?.start_minutes != null ? Math.round(initial.start_minutes / 15) * 15 : 9 * 60
  );
  const [durationMinutes, setDurationMinutes] = useState(initial?.duration_minutes ?? 60);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInputFocused, setTagInputFocused] = useState(false);
  const tagContainerRef = useRef<HTMLDivElement>(null);

  const getColorForTag = (tag: string): string | undefined => {
    if (tagColors[tag]) return tagColors[tag];
    const lower = tag.toLowerCase();
    const key = Object.keys(tagColors).find((k) => k.toLowerCase() === lower);
    return key ? tagColors[key] : undefined;
  };

  useEffect(() => {
    if (!initial?.date && !date) {
      const d = new Date();
      setDate(d.toISOString().slice(0, 10));
    }
  }, [initial?.date, date]);

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
    if (!date || !title.trim()) return;
    const firstTagWithColor = tags.find((t) => getColorForTag(t));
    const color = firstTagWithColor ? getColorForTag(firstTagWithColor)! : CALENDAR_COLORS[0];
    onSubmit({
      date,
      start_minutes: startMinutes,
      duration_minutes: durationMinutes,
      title: title.trim(),
      tags,
      color,
      type: eventType,
    });
  };

  const hourOptions = Array.from({ length: 96 }, (_, i) => i * 15); // 0–23:45 co 15 min
  const MINS_PER_DAY = 24 * 60;
  const spanEndTotal = startMinutes + durationMinutes;
  const crossesDayBoundary = spanEndTotal > MINS_PER_DAY;
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
        <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. QA testing, Learning"
          className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">
          Event type
        </label>
        <select
          value={eventType}
          onChange={(e) => {
            const next = e.target.value as "work" | "meeting";
            setEventType(next);
            setDurationMinutes(EVENT_TYPE_DEFAULT_DURATION[next]);
          }}
          className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="work">Work session</option>
          <option value="meeting">Meeting</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">
            Start time
          </label>
          <select
            value={startMinutes}
            onChange={(e) => setStartMinutes(Number(e.target.value))}
            className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
          >
            {hourOptions.map((m) => (
              <option key={m} value={m}>
                {String(Math.floor(m / 60)).padStart(2, "0")}:{String(m % 60).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">
          Duration (15 min steps)
        </label>
        <select
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
        >
          {DURATION_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {formatDuration(m)}
            </option>
          ))}
        </select>
      </div>
      {crossesDayBoundary && date && (
        <p className="text-xs text-[var(--text3)] leading-relaxed">
          {(() => {
            const extraDays = Math.floor(spanEndTotal / MINS_PER_DAY);
            const endMinOfDay = spanEndTotal % MINS_PER_DAY;
            const endH = Math.floor(endMinOfDay / 60);
            const endM = endMinOfDay % 60;
            const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
            const endDateStr = addCalendarDays(date, extraDays);
            return extraDays === 1
              ? `Ends the next calendar day (${endDateStr}) at ${endStr}.`
              : `Ends on ${endDateStr} at ${endStr} (${extraDays} days after start).`;
          })()}
        </p>
      )}
      <div>
        <label className="block text-xs font-bold text-[var(--text2)] uppercase mb-1">
          Tags (#testy, #nauka…)
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
              placeholder="#tag lub wybierz poniżej"
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
                  Propozycje
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
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
