import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Trash2, Play, Square } from "lucide-react";
import "./calendar.css";
import { CalendarEventForm, type CalendarEventFormData } from "./CalendarEventForm";
import { StartSessionModal } from "@/src/components/sessions/StartSessionModal";
import { CALENDAR_COLORS } from "@/src/lib/calendarConstants";
import { type CalendarEvent, MONTH_NAMES, DAY_NAMES, expandEventToSegments } from "./calendarUtils";
import { CalendarDayColumn } from "./CalendarDayColumn";
import { useCalendarData } from "./useCalendarData";
import type { UserTag } from "@/src/features/tags/TagsSection";
import type { ActiveSession } from "@/src/components/sessions/activeSession";

export type { CalendarEvent } from "./calendarUtils";

const HOURS = 24;

type TranslationDict = Record<string, string | string[]>;

interface CalendarViewProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: TranslationDict;
  userTags?: UserTag[];
  refreshTrigger?: number;
  activeSession?: ActiveSession | null;
  onStartSession?: (payload: { title: string; tags: string[]; color: string }) => void;
  onEndSession?: () => void | Promise<void>;
  sessionEndError?: string | null;
  clearSessionEndError?: () => void;
  onOpenTaskDeadline?: (taskId: string) => void;
}

export function CalendarView({
  apiFetch,
  lang,
  t,
  userTags = [],
  refreshTrigger,
  activeSession = null,
  onStartSession,
  onEndSession,
  sessionEndError = null,
  clearSessionEndError,
  onOpenTaskDeadline,
}: CalendarViewProps) {
  const now = new Date();
  const {
    viewYear,
    viewMonth,
    events,
    setEvents,
    loading,
    days,
    startDate,
    endDate,
    handlePrevMonth,
    handleNextMonth,
  } = useCalendarData(apiFetch, refreshTrigger);
  const [modalOpen, setModalOpen] = useState(false);
  const [startSessionModalOpen, setStartSessionModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [addDate, setAddDate] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const interval = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const monthLabel = MONTH_NAMES[lang][viewMonth];

  const eventSegments = useMemo(() => events.flatMap((e) => expandEventToSegments(e)), [events]);

  const eventTags = Array.from(new Set(events.flatMap((e) => e.tags)));
  const userTagNames = userTags.map((u) => u.tag).filter(Boolean);
  const allTags = Array.from(new Set([...eventTags, ...userTagNames]));
  const tagTitles: Record<string, string> = {};
  const tagColors: Record<string, string> = {};
  let colorIndex = 0;
  for (const u of userTags) {
    if (u.tag) {
      if (u.title) tagTitles[u.tag] = u.title;
      tagColors[u.tag] = u.color || CALENDAR_COLORS[colorIndex % CALENDAR_COLORS.length];
      colorIndex++;
    }
  }

  const handleOpenAdd = (date: string) => {
    setAddDate(date);
    setEditingEvent(null);
    setSaveError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (ev: CalendarEvent) => {
    if (ev.type === "task_deadline") {
      onOpenTaskDeadline?.(ev.id.replace(/^task:/, ""));
      return;
    }
    setEditingEvent(ev);
    setAddDate(null);
    setSaveError(null);
    setModalOpen(true);
  };

  const handleSave = async (data: CalendarEventFormData) => {
    setSaveError(null);
    try {
      if (editingEvent) {
        const res = await apiFetch(`/api/calendar/events/${editingEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error((errBody as { error?: string }).error ?? `HTTP ${res.status}`);
        }
      } else {
        const res = await apiFetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error((errBody as { error?: string }).error ?? `HTTP ${res.status}`);
        }
      }
      setModalOpen(false);
      setEditingEvent(null);
      setAddDate(null);
      const res = await apiFetch(`/api/calendar/events?startDate=${startDate}&endDate=${endDate}`);
      const data2 = await res.json();
      setEvents(Array.isArray(data2) ? data2 : []);
    } catch (err) {
      console.error("Save calendar event failed", err);
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/calendar/events/${id}`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setModalOpen(false);
      setEditingEvent(null);
    } catch (err) {
      console.error("Delete calendar event failed", err);
    }
  };

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const cellWidth = 80;
  const dayLabelWidth = 80;
  const totalWidth = dayLabelWidth + HOURS * cellWidth;

  const formatSessionTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const sessionInProgressLabel =
    (t.sessionInProgressSince as string)?.replace(
      "{time}",
      activeSession ? formatSessionTime(activeSession.startedAt) : ""
    ) ??
    (activeSession ? `Work in progress since ${formatSessionTime(activeSession.startedAt)}` : "");

  return (
    <div className="kal flex-1 min-w-0 flex flex-col overflow-hidden" data-card="kalendarz">
      <header className="kal-head">
        <div>
          <p className="kal-eyebrow">Alt+2 · Kalendarz</p>
          <div className="kal-head__title-group">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="kal-btn kal-btn--icon kal-btn--ghost"
              aria-label="Poprzedni miesiąc"
            >
              ‹
            </button>
            <h1 className="kal-title">
              {monthLabel} {viewYear}
            </h1>
            <button
              type="button"
              onClick={handleNextMonth}
              className="kal-btn kal-btn--icon kal-btn--ghost"
              aria-label="Następny miesiąc"
            >
              ›
            </button>
          </div>
          <p className="kal-sub">
            {lang === "pl"
              ? "etat i projekty w jednym planie"
              : "full-time job and projects in one schedule"}
          </p>
        </div>
        <div className="kal-head__actions">
          {activeSession ? (
            <div className="kal-session-active">
              <span className="kal-session-badge">{sessionInProgressLabel}</span>
              <button
                type="button"
                onClick={() => onEndSession?.()}
                className="kal-btn kal-btn--accent"
              >
                <Square className="w-3.5 h-3.5" />
                {(t.sessionEndButton as string) ?? "End work"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setStartSessionModalOpen(true)}
              className="kal-btn kal-btn--ghost"
            >
              <Play className="w-3.5 h-3.5" />
              {(t.sessionStartButton as string) ?? "Start work"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setAddDate(days[0]?.date ?? startDate);
              setEditingEvent(null);
              setSaveError(null);
              setModalOpen(true);
            }}
            className="kal-btn kal-btn--primary"
          >
            <Plus className="w-3.5 h-3.5" />
            {(t.calendarAddEntry as string) ?? "Add entry"}
          </button>
        </div>
      </header>

      {sessionEndError && (
        <div className="kal-alert">
          <p role="alert">{sessionEndError}</p>
          {clearSessionEndError && (
            <button type="button" onClick={clearSessionEndError} className="kal-alert-dismiss">
              Dismiss
            </button>
          )}
        </div>
      )}

      <div className="kal-grid-card" ref={gridRef}>
        {loading ? (
          <div className="kal-state">Loading…</div>
        ) : (
          <div className="kal-grid-scroll">
            <div className="kal-grid-table" style={{ width: totalWidth, minWidth: totalWidth }}>
              <div className="kal-grid-header">
                <div className="kal-grid-header__day-label" style={{ width: dayLabelWidth }}>
                  {(t.calendarDay as string) ?? "Day"}
                </div>
                <div className="kal-grid-header__hours">
                  {Array.from({ length: HOURS }, (_, h) => (
                    <div key={h} className="kal-grid-header__hour" style={{ width: cellWidth }}>
                      {String(h).padStart(2, "0")}
                    </div>
                  ))}
                </div>
              </div>
              {days.map((day) => {
                const daySegments = eventSegments.filter((s) => s.segmentDate === day.date);
                return (
                  <CalendarDayColumn
                    key={day.date}
                    day={day}
                    daySegments={daySegments}
                    cellWidth={cellWidth}
                    lang={lang}
                    dayNames={DAY_NAMES[lang]}
                    isToday={day.date === todayStr}
                    onAddClick={(date) => handleOpenAdd(date)}
                    onEventClick={handleOpenEdit}
                    activeSession={activeSession}
                    todayStr={todayStr}
                    nowMinutes={nowMinutes}
                    onEndSession={onEndSession}
                    t={t}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="kal-overlay">
          <div className="kal-modal">
            <h3 className="kal-modal__title">
              {editingEvent
                ? ((t.calendarEditEntry as string) ?? "Edit entry")
                : ((t.calendarNewEntry as string) ?? "New entry")}
            </h3>
            <CalendarEventForm
              initial={
                editingEvent
                  ? {
                      date: editingEvent.date,
                      start_minutes: editingEvent.start_minutes,
                      duration_minutes: editingEvent.duration_minutes,
                      title: editingEvent.title,
                      tags: editingEvent.tags,
                      type: editingEvent.type === "meeting" ? "meeting" : "work",
                    }
                  : addDate
                    ? {
                        date: addDate,
                        start_minutes: 9 * 60,
                        duration_minutes: 60,
                        title: "",
                        tags: [],
                        type: "work",
                      }
                    : undefined
              }
              existingTags={allTags}
              tagTitles={tagTitles}
              tagColors={tagColors}
              onSubmit={handleSave}
              onCancel={() => {
                setModalOpen(false);
                setEditingEvent(null);
                setAddDate(null);
                setSaveError(null);
              }}
              submitLabel={
                editingEvent
                  ? ((t.calendarSave as string) ?? "Save")
                  : ((t.calendarAddEntry as string) ?? "Add")
              }
            />
            {saveError && (
              <p className="kal-alert" role="alert" style={{ marginTop: "var(--s-3)" }}>
                {saveError}
              </p>
            )}
            {editingEvent && (
              <div className="kal-delete-section">
                <button
                  type="button"
                  onClick={() => handleDelete(editingEvent.id)}
                  className="kal-btn kal-btn--danger"
                >
                  <Trash2 className="w-4 h-4" />
                  {(t.calendarDeleteEntry as string) ?? "Delete entry"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {startSessionModalOpen && (
        <div className="kal-overlay">
          <div className="kal-modal">
            <h3 className="kal-modal__title">{(t.sessionModalTitle as string) ?? "Start work"}</h3>
            <StartSessionModal
              existingTags={allTags}
              tagTitles={tagTitles}
              tagColors={tagColors}
              onSubmit={(payload) => {
                onStartSession?.(payload);
                setStartSessionModalOpen(false);
              }}
              onCancel={() => setStartSessionModalOpen(false)}
              submitLabel={(t.sessionSubmitStart as string) ?? "Start work"}
              cancelLabel={(t.calendarCancel as string) ?? "Cancel"}
              titleLabel={(t.sessionModalTitleLabel as string) ?? "Title"}
              tagsLabel={(t.sessionModalTagsLabel as string) ?? "Tags"}
              tagPlaceholder={(t.sessionModalTagPlaceholder as string) ?? "#tag or pick below"}
              suggestionsLabel={(t.sessionModalSuggestionsLabel as string) ?? "Suggestions"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
