import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight, Trash2, Play, Square } from "lucide-react";
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
  const rowHeight = 44;
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
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-[var(--bg3)] rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold min-w-[180px] text-center">
            {monthLabel} {viewYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-[var(--bg3)] rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {activeSession ? (
            <>
              <span className="text-sm font-medium text-[var(--text2)]">
                {sessionInProgressLabel}
              </span>
              <button
                type="button"
                onClick={() => onEndSession?.()}
                className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--accent)] text-[var(--accent)] bg-transparent rounded-xl text-sm font-semibold hover:bg-[var(--accent-bg)]"
              >
                <Square className="w-4 h-4" />
                {(t.sessionEndButton as string) ?? "End work"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setStartSessionModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg3)] text-[var(--text)] border border-[var(--border)] rounded-xl text-sm font-semibold hover:bg-[var(--bg2)]"
            >
              <Play className="w-4 h-4" />
              {(t.sessionStartButton as string) ?? "Start work"}
            </button>
          )}
          <button
            onClick={() => {
              setAddDate(days[0]?.date ?? startDate);
              setEditingEvent(null);
              setSaveError(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            {(t.calendarAddEntry as string) ?? "Add entry"}
          </button>
        </div>
      </div>

      {sessionEndError && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 flex items-center justify-between gap-2">
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {sessionEndError}
          </p>
          {clearSessionEndError && (
            <button
              type="button"
              onClick={clearSessionEndError}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-w-0 min-h-0 flex flex-col p-4" ref={gridRef}>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-[var(--text2)]">Loading…</div>
        ) : (
          <div
            className="overflow-auto overflow-x-scroll overflow-y-auto w-full"
            style={{ maxWidth: "100%", flex: "1 1 0" }}
          >
            <div style={{ width: totalWidth, minWidth: totalWidth }}>
              <div
                className="flex border-b border-[var(--border)] bg-[var(--bg2)] sticky top-0 z-20 shadow-sm"
                style={{ height: rowHeight }}
              >
                <div
                  className="flex-shrink-0 border-r border-[var(--border)] flex items-center px-2 text-xs font-bold text-[var(--text3)] bg-[var(--bg2)] sticky left-0 z-30"
                  style={{ width: dayLabelWidth }}
                >
                  {(t.calendarDay as string) ?? "Day"}
                </div>
                <div className="flex bg-[var(--bg2)]">
                  {Array.from({ length: HOURS }, (_, h) => (
                    <div
                      key={h}
                      className="border-r border-[var(--border)] text-[10px] text-[var(--text3)] font-medium flex items-center justify-center flex-shrink-0"
                      style={{ width: cellWidth, height: rowHeight }}
                    >
                      {h}
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
                    onAddClick={(date) => {
                      setAddDate(date);
                      setEditingEvent(null);
                      setSaveError(null);
                      setModalOpen(true);
                    }}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold mb-4">
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
              <p className="mt-3 text-sm text-red-500" role="alert">
                {saveError}
              </p>
            )}
            {editingEvent && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => handleDelete(editingEvent.id)}
                  className="flex items-center gap-2 text-red-500 text-sm font-medium hover:bg-red-50 px-3 py-2 rounded-lg"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold mb-4">
              {(t.sessionModalTitle as string) ?? "Start work"}
            </h3>
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
