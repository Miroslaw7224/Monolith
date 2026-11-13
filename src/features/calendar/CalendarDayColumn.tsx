import React from "react";
import { Pencil, Square, Bell, Flag } from "lucide-react";
import type { CalendarEvent, CalendarEventSegment } from "./calendarUtils";
import { assignLanes, getOverlapCounts, CALENDAR_MAX_STACK } from "./calendarUtils";
import { formatDuration } from "@/src/lib/calendarConstants";
import type { ActiveSession } from "@/src/components/sessions/activeSession";

type TranslationDict = Record<string, string | string[]>;

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface CalendarDayColumnProps {
  day: { date: string; dayOfWeek: number; day: number };
  daySegments: CalendarEventSegment[];
  cellWidth: number;
  lang: "pl" | "en";
  dayNames: string[];
  isToday: boolean;
  onAddClick: (date: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
  activeSession: ActiveSession | null;
  todayStr: string;
  nowMinutes: number;
  onEndSession?: () => void | Promise<void>;
  t: TranslationDict;
}

export function CalendarDayColumn({
  day,
  daySegments,
  cellWidth,
  lang,
  dayNames,
  isToday,
  onAddClick,
  onEventClick,
  activeSession,
  todayStr,
  nowMinutes,
  onEndSession,
  t,
}: CalendarDayColumnProps) {
  const laneItems = daySegments.map((s) => ({
    id: s.segmentKey,
    start_minutes: s.start_minutes,
    duration_minutes: s.duration_minutes,
  }));
  const lanes = assignLanes(laneItems);
  const overlapCounts = getOverlapCounts(laneItems);
  const HOURS = 24;
  const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

  return (
    <div
      className={`kal-day-row ${isToday ? "kal-day-row--today" : ""} ${isWeekend ? "kal-day-row--weekend" : ""}`}
      style={{ height: 48 }}
    >
      <div className="kal-day-cell" style={{ width: 80 }}>
        <b>{day.day}</b>
        <span>{dayNames[day.dayOfWeek]}</span>
      </div>
      <div
        className="kal-day-track"
        style={{ width: HOURS * cellWidth }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-event]")) return;
          onAddClick(day.date);
        }}
      >
        {isToday && (
          <div
            className="kal-now-line"
            style={{ left: (nowMinutes / 60) * cellWidth }}
            aria-label="Teraz"
          />
        )}
        {daySegments.map((seg) => {
          const lane = lanes.get(seg.segmentKey) ?? 0;
          const stackSize = Math.max(
            1,
            Math.min(CALENDAR_MAX_STACK, overlapCounts.get(seg.segmentKey) ?? 1)
          );
          const leftPx = (seg.start_minutes / 60) * cellWidth;
          const widthPx = (seg.duration_minutes / 60) * cellWidth;
          const heightPct = 100 / stackSize - 4;
          const topPct = lane * (100 / stackSize) + 2;
          const ev = seg.source;
          const isMeeting = ev.type === "meeting";
          const isDeadline = ev.type === "task_deadline";
          const isEtat = ev.tags?.some((tag) => tag.toLowerCase() === "etat") ?? false;
          const typeSuffix = isDeadline ? " · Task deadline" : isMeeting ? " · Meeting" : "";
          const titleTip = `${ev.title} ${ev.tags.map((tag) => `#${tag}`).join(" ")} · ${formatDuration(seg.duration_minutes)}${typeSuffix}`;

          let evMod = "";
          if (isDeadline) evMod = "kal-ev--deadline";
          else if (isMeeting) evMod = "kal-ev--meeting";
          else if (isEtat) evMod = "kal-ev--etat";

          return (
            <div
              key={seg.segmentKey}
              data-event
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(ev);
              }}
              className={`kal-ev ${evMod}`}
              style={{
                left: leftPx,
                width: Math.max(24, widthPx),
                top: `${topPct}%`,
                height: `${heightPct}%`,
                borderLeftColor: ev.color || undefined,
              }}
              title={titleTip}
            >
              {isMeeting && (
                <Bell className="kal-ev__icon w-3 h-3 text-[var(--accent-text)]" aria-hidden />
              )}
              {isDeadline && (
                <Flag className="kal-ev__icon w-3 h-3 text-[var(--warn)]" aria-hidden />
              )}
              <b className="kal-ev__title">{ev.title}</b>
              {!isDeadline && <Pencil className="kal-ev__action-icon w-3 h-3" aria-hidden />}
            </div>
          );
        })}
        {activeSession &&
          day.date === todayStr &&
          (() => {
            const started = new Date(activeSession.startedAt);
            const startDay = localYmd(started);
            let sessionStartMinutes: number;
            if (startDay < todayStr) {
              sessionStartMinutes = 0;
            } else if (startDay === todayStr) {
              sessionStartMinutes = started.getHours() * 60 + started.getMinutes();
            } else {
              return null;
            }
            const sessionEndMinutes = nowMinutes;
            if (sessionEndMinutes <= sessionStartMinutes) return null;
            const leftPx = (sessionStartMinutes / 60) * cellWidth;
            const maxMinutesInRow = 24 * 60 - sessionStartMinutes;
            const spanMinutes = Math.min(sessionEndMinutes - sessionStartMinutes, maxMinutesInRow);
            const widthPx = Math.max(24, (spanMinutes / 60) * cellWidth);
            const sessionTimeStr = `${String(started.getHours()).padStart(2, "0")}:${String(started.getMinutes()).padStart(2, "0")}`;
            const sessionInProgressSince =
              (t.sessionInProgressSince as string)?.replace("{time}", sessionTimeStr) ??
              "In progress";
            const sessionEndButton = (t.sessionEndButton as string) ?? "End work";
            return (
              <div
                data-event
                data-active-session
                onClick={(e) => {
                  e.stopPropagation();
                  onEndSession?.();
                }}
                className="kal-ev kal-ev--active-session"
                style={{
                  left: leftPx,
                  width: widthPx,
                  top: "2%",
                  height: "96%",
                  borderColor: activeSession.color || undefined,
                }}
                title={`${activeSession.title} · ${sessionInProgressSince} – ${sessionEndButton}`}
              >
                <b className="kal-ev__title">{activeSession.title}</b>
                <Square className="kal-ev__action-icon w-3 h-3" aria-hidden />
              </div>
            );
          })()}
      </div>
    </div>
  );
}
