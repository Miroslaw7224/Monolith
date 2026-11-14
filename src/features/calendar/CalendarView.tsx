import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Play, Square } from "lucide-react";
import "./calendar.css";
import { CalendarEventForm, type CalendarEventFormData } from "./CalendarEventForm";
import { StartSessionModal } from "@/src/components/sessions/StartSessionModal";
import { CALENDAR_COLORS } from "@/src/lib/calendarConstants";
import {
  type CalendarEvent,
  type CalendarViewMode,
  MONTH_NAMES,
  expandEventToSegments,
  toYmd,
  weekDates as weekDatesOf,
  weekRangeLabel,
} from "./calendarUtils";
import { CalendarWeekGrid } from "./CalendarWeekGrid";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarAgenda } from "./CalendarAgenda";
import { CalendarTiles, type CalendarTilesData } from "./CalendarTiles";
import { CalendarEventDetail, CalendarMiniMonth, CalendarSlotPlanner } from "./CalendarSidePanel";
import { useCalendarData } from "./useCalendarData";
import { isEtat } from "./calendarEventStyle";
import { upcomingWindows, weekNumber } from "@/src/features/home/cockpitFormat";
import type { DeepWindowDto } from "@/contexts/bc_cockpit/schemas";
import type { UserTag } from "@/src/features/tags/TagsSection";
import type { ActiveSession } from "@/src/components/sessions/activeSession";

export type { CalendarEvent } from "./calendarUtils";

const VIEW_TABS: { id: CalendarViewMode; label: string }[] = [
  { id: "month", label: "Miesiąc" },
  { id: "week", label: "Tydzień" },
  { id: "agenda", label: "Agenda" },
];

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
    anchor,
    setAnchor,
    view,
    setView,
    viewYear,
    viewMonth,
    grid,
    events,
    setEvents,
    loading,
    startDate,
    endDate,
    handlePrev,
    handleNext,
    goToday,
  } = useCalendarData(apiFetch, refreshTrigger);
  const [modalOpen, setModalOpen] = useState(false);
  const [startSessionModalOpen, setStartSessionModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [addDate, setAddDate] = useState<string | null>(null);
  const [addStart, setAddStart] = useState<number>(9 * 60);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [windows, setWindows] = useState<DeepWindowDto[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  // Okna Deep Work / Quick Win liczy Kokpit (te same dane, tylko do odczytu).
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/cockpit")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = (data as { windows?: unknown } | null)?.windows;
        setWindows(Array.isArray(list) ? (list as DeepWindowDto[]) : []);
      })
      .catch(() => {
        if (!cancelled) setWindows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch, refreshTrigger]);

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

  const handleOpenAdd = (date: string, startMinutes = 9 * 60) => {
    setAddDate(date);
    setAddStart(startMinutes);
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

  /** Klik w wydarzenie: podgląd w panelu bocznym (termin zadania otwiera zadanie). */
  const handleSelect = (ev: CalendarEvent) => {
    if (ev.type === "task_deadline") {
      onOpenTaskDeadline?.(ev.id.replace(/^task:/, ""));
      return;
    }
    setSelectedId(ev.id);
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

  const todayStr = toYmd(now);
  const weekDates = useMemo(() => weekDatesOf(anchor), [anchor]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    // Wydarzenia przechodzące przez północ trafiają do każdego dnia, którego dotykają.
    for (const seg of eventSegments) {
      const list = map.get(seg.segmentDate) ?? [];
      if (!list.includes(seg.source)) list.push(seg.source);
      map.set(seg.segmentDate, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_minutes - b.start_minutes);
    return map;
  }, [eventSegments]);
  const selectedEvent = events.find((e) => e.id === selectedId) ?? null;
  const upcoming = useMemo(() => upcomingWindows(windows, nowMinutes), [windows, nowMinutes]);

  const tiles: CalendarTilesData = useMemo(() => {
    const real = (e: CalendarEvent) => e.type !== "task_deadline";
    const weekSet = new Set(weekDates);
    const weekEvents = events.filter((e) => weekSet.has(e.date) && real(e));
    // Poza pobranym zakresem (inny miesiąc) nie znamy dzisiejszych wydarzeń.
    const todayLoaded = todayStr >= startDate && todayStr <= endDate;
    const todayEvents = (eventsByDate.get(todayStr) ?? []).filter(real);
    const deep = upcoming.filter((w) => w.energy === "deep");
    return {
      todayCount: todayLoaded ? todayEvents.length : null,
      nextTodayStart: todayEvents.find((e) => e.start_minutes > nowMinutes)?.start_minutes ?? null,
      weekCount: weekEvents.length,
      weekEtat: weekEvents.filter(isEtat).length,
      deepMinutes: deep.reduce((sum, w) => sum + (w.endMinutes - w.startMinutes), 0),
      deepWindows: deep.length,
      deadlines: events.filter((e) => weekSet.has(e.date) && e.type === "task_deadline").length,
    };
  }, [events, eventsByDate, weekDates, upcoming, todayStr, nowMinutes, startDate, endDate]);

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
    <div className="kal flex-1 min-w-0 flex flex-col overflow-y-auto" data-card="kalendarz">
      <header className="kal-head">
        <div>
          <p className="kal-eyebrow">Alt+2 · Kalendarz</p>
          <h1 className="kal-title">
            {monthLabel} {viewYear}
            <span className="kal-title__week">
              · tydzień {weekNumber(new Date(`${anchor}T12:00:00`))}
            </span>
          </h1>
          <p className="kal-sub">
            {weekRangeLabel(weekDates)} ·{" "}
            {lang === "pl"
              ? "etat i projekty w jednym planie"
              : "full-time job and projects in one schedule"}
          </p>
        </div>
        <div className="kal-head__actions">
          <button
            type="button"
            onClick={handlePrev}
            className="kal-btn kal-btn--icon kal-btn--ghost"
            aria-label={view === "month" ? "Poprzedni miesiąc" : "Poprzedni tydzień"}
          >
            ‹
          </button>
          <button type="button" onClick={goToday} className="kal-btn">
            Dziś
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="kal-btn kal-btn--icon kal-btn--ghost"
            aria-label={view === "month" ? "Następny miesiąc" : "Następny tydzień"}
          >
            ›
          </button>
          <div className="kal-tabs" role="tablist" aria-label="Widok kalendarza">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className="kal-tabs__btn"
                aria-selected={view === tab.id}
                onClick={() => setView(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
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
            onClick={() => handleOpenAdd(anchor)}
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

      <CalendarTiles data={tiles} />

      <div className="kal-layout">
        <div className="kal-main">
          {loading ? (
            <p className="kal-state">Loading…</p>
          ) : view === "week" ? (
            <CalendarWeekGrid
              dates={weekDates}
              segments={eventSegments}
              todayStr={todayStr}
              nowMinutes={nowMinutes}
              selectedId={selectedId}
              windows={upcoming}
              activeSession={activeSession}
              onSelect={handleSelect}
              onAdd={handleOpenAdd}
            />
          ) : view === "month" ? (
            <CalendarMonthGrid
              weeks={grid.weeks}
              viewMonth={viewMonth}
              todayStr={todayStr}
              eventsByDate={eventsByDate}
              onPickDay={(date) => {
                setAnchor(date);
                setView("week");
              }}
              onSelect={handleSelect}
            />
          ) : (
            <CalendarAgenda
              dates={weekDates}
              todayStr={todayStr}
              eventsByDate={eventsByDate}
              onSelect={handleSelect}
            />
          )}
        </div>

        <aside className="kal-aside">
          <CalendarMiniMonth
            weeks={grid.weeks}
            viewMonth={viewMonth}
            todayStr={todayStr}
            weekDates={weekDates}
            eventDates={new Set(eventsByDate.keys())}
            onPick={setAnchor}
          />
          <CalendarEventDetail event={selectedEvent} onEdit={handleOpenEdit} />
          <CalendarSlotPlanner windows={upcoming} />
        </aside>
      </div>

      {modalOpen && (
        <div className="kal-overlay">
          <div className="kal-modal" role="dialog" aria-modal="true">
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
                      link: editingEvent.link ?? "",
                      brief: editingEvent.brief ?? "",
                    }
                  : addDate
                    ? {
                        date: addDate,
                        start_minutes: addStart,
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
          <div className="kal-modal" role="dialog" aria-modal="true">
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
