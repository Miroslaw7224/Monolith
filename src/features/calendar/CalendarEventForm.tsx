import React, { useState, useEffect, useRef } from "react";
import {
  CALENDAR_COLORS,
  DURATION_OPTIONS,
  EVENT_TYPE_DEFAULT_DURATION,
  formatDuration,
} from "@/src/lib/calendarConstants";
import { addCalendarDays } from "./calendarUtils";
import { useT } from "@/src/i18n/useT";

export interface CalendarEventFormData {
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting" | "visit";
  /** Adres spotkania online; pusty tekst usuwa istniejący link. */
  link: string;
  /** Notatka przed spotkaniem (każda linia = punkt); pusty tekst usuwa istniejący brief. */
  brief: string;
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
  submitLabel,
}: CalendarEventFormProps) {
  const t = useT();
  const resolvedSubmitLabel = submitLabel ?? t("planning:calendarAddEntry");
  const [date, setDate] = useState(initial?.date ?? "");
  const [eventType, setEventType] = useState<"work" | "meeting" | "visit">(initial?.type ?? "work");
  const [startMinutes, setStartMinutes] = useState(
    initial?.start_minutes != null ? Math.round(initial.start_minutes / 15) * 15 : 9 * 60
  );
  const [durationMinutes, setDurationMinutes] = useState(initial?.duration_minutes ?? 60);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [brief, setBrief] = useState(initial?.brief ?? "");
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
    const tag = tagInput.trim().replace(/^#/, "");
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((x) => x !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !title.trim()) return;
    const firstTagWithColor = tags.find((tag) => getColorForTag(tag));
    const color = firstTagWithColor ? getColorForTag(firstTagWithColor)! : CALENDAR_COLORS[0];
    onSubmit({
      date,
      start_minutes: startMinutes,
      duration_minutes: durationMinutes,
      title: title.trim(),
      tags,
      color,
      type: eventType,
      link: link.trim(),
      brief: brief.trim(),
    });
  };

  const hourOptions = Array.from({ length: 96 }, (_, i) => i * 15); // 0–23:45 co 15 min
  const MINS_PER_DAY = 24 * 60;
  const spanEndTotal = startMinutes + durationMinutes;
  const crossesDayBoundary = spanEndTotal > MINS_PER_DAY;
  const tagInputNormalized = tagInput.trim().replace(/^#/, "").toLowerCase();
  const filteredExistingTags = existingTags
    .filter((tag) => {
      if (tags.includes(tag)) return false;
      if (!tagInputNormalized) return true;
      return tag.toLowerCase().includes(tagInputNormalized);
    })
    .slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="kal-form">
      <div className="kal-form-group">
        <label className="kal-label">{t("planning:calendarFormTitleLabel")}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("planning:calendarFormTitlePlaceholder")}
          className="kal-input"
          required
        />
      </div>
      <div className="kal-form-group">
        <label className="kal-label" htmlFor="kal-link">
          {t("planning:calendarFormMeetingLink")}
        </label>
        <input
          id="kal-link"
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={t("planning:calendarFormMeetingLinkPlaceholder")}
          className="kal-input"
        />
        {/^https?:\/\/\S+$/i.test(link.trim()) ? (
          <a href={link.trim()} target="_blank" rel="noopener noreferrer" className="kal-link-open">
            {t("planning:calendarFormOpenMeeting")}
          </a>
        ) : null}
      </div>
      <div className="kal-form-group">
        <label className="kal-label" htmlFor="kal-brief">
          {t("planning:calendarFormBrief")}
        </label>
        <textarea
          id="kal-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={t("planning:calendarFormBriefPlaceholder")}
          maxLength={1000}
          rows={3}
          className="kal-input"
        />
      </div>
      <div className="kal-form-group">
        <label className="kal-label">{t("planning:calendarFormEventType")}</label>
        <select
          value={eventType}
          onChange={(e) => {
            const next = e.target.value as "work" | "meeting" | "visit";
            setEventType(next);
            setDurationMinutes(EVENT_TYPE_DEFAULT_DURATION[next]);
          }}
          className="kal-select"
        >
          <option value="work">{t("planning:calendarFormTypeWork")}</option>
          <option value="meeting">{t("planning:calendarFormTypeMeeting")}</option>
          <option value="visit">{t("planning:calendarFormTypeVisit")}</option>
        </select>
      </div>
      <div className="kal-form-row">
        <div className="kal-form-group">
          <label className="kal-label">{t("planning:calendarFormDate")}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="kal-input"
          />
        </div>
        <div className="kal-form-group">
          <label className="kal-label">{t("planning:calendarFormStartTime")}</label>
          <select
            value={startMinutes}
            onChange={(e) => setStartMinutes(Number(e.target.value))}
            className="kal-select"
          >
            {hourOptions.map((m) => (
              <option key={m} value={m}>
                {String(Math.floor(m / 60)).padStart(2, "0")}:{String(m % 60).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="kal-form-group">
        <label className="kal-label">{t("planning:calendarFormDuration")}</label>
        <select
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          className="kal-select"
        >
          {DURATION_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {formatDuration(m)}
            </option>
          ))}
        </select>
      </div>
      {crossesDayBoundary && date && (
        <p className="kal-sub" style={{ fontSize: "var(--fs-xs)", margin: 0 }}>
          {(() => {
            const extraDays = Math.floor(spanEndTotal / MINS_PER_DAY);
            const endMinOfDay = spanEndTotal % MINS_PER_DAY;
            const endH = Math.floor(endMinOfDay / 60);
            const endM = endMinOfDay % 60;
            const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
            const endDateStr = addCalendarDays(date, extraDays);
            return extraDays === 1
              ? t("planning:calendarEndsNextDay", { date: endDateStr, time: endStr })
              : t("planning:calendarEndsMultiDay", {
                  date: endDateStr,
                  time: endStr,
                  days: extraDays,
                });
          })()}
        </p>
      )}
      <div className="kal-form-group">
        <label className="kal-label">{t("planning:calendarFormTagsLabel")}</label>
        <div className="kal-tag-container">
          {tags.map((tag) => (
            <span key={tag} className="kal-tag-chip">
              #{tag}
              <button type="button" onClick={() => removeTag(tag)} className="kal-tag-chip__remove">
                ×
              </button>
            </span>
          ))}
          <div
            ref={tagContainerRef}
            style={{ position: "relative", display: "flex", gap: "var(--s-1)", flex: "1 1 120px" }}
          >
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
              placeholder={t("planning:sessionModalTagPlaceholder")}
              className="kal-input"
              style={{ flex: 1 }}
            />
            <button type="button" onClick={addTag} className="kal-btn kal-btn--primary kal-btn--sm">
              +
            </button>
            {(tagInputFocused || tagInput) && filteredExistingTags.length > 0 && (
              <div className="kal-autocomplete">
                <p className="kal-autocomplete__header">
                  {t("planning:sessionModalSuggestionsLabel")}
                </p>
                {filteredExistingTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!tags.includes(tag)) setTags([...tags, tag]);
                      setTagInput("");
                      const assignedTitle = tagTitles[tag];
                      if (assignedTitle) setTitle(assignedTitle);
                    }}
                    className="kal-autocomplete__item"
                  >
                    <span style={{ color: "var(--accent-text)" }}>#</span>
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="kal-form-actions">
        <button type="button" onClick={onCancel} className="kal-btn kal-btn--ghost">
          {t("planning:calendarCancel")}
        </button>
        <button type="submit" className="kal-btn kal-btn--primary">
          {resolvedSubmitLabel}
        </button>
      </div>
    </form>
  );
}
