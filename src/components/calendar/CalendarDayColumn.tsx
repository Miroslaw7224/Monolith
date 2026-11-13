import React from "react";
import { Pencil, Square, Bell, Flag } from "lucide-react";
import type { CalendarEvent, CalendarEventSegment } from "./calendarUtils";
import { assignLanes, getOverlapCounts, CALENDAR_MAX_STACK } from "./calendarUtils";
import { formatDuration } from "@/src/lib/calendarConstants";
import type { ActiveSession } from "@/src/lib/activeSession";

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

  return (
    <div
      className={`flex border-b border-[var(--border)] relative ${isToday ? "bg-[var(--accent-bg)] ring-1 ring-inset ring-[var(--accent)]" : "bg-[var(--surface)]"}`}
      style={{ height: 44 }}
    >
      <div
        className={`flex-shrink-0 border-r border-[var(--border)] flex items-center px-2 text-sm font-medium sticky left-0 z-10 ${isToday ? "bg-[var(--accent-bg)] font-semibold text-[var(--accent)]" : "bg-[var(--bg2)]"}`}
        style={{ width: 80 }}
      >
        {day.day} {dayNames[day.dayOfWeek]}
      </div>
      <div
        className="flex-1 relative"
        style={{ width: HOURS * cellWidth }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-event]")) return;
          onAddClick(day.date);
        }}
      >
        {daySegments.map((seg) => {
          const lane = lanes.get(seg.segmentKey) ?? 0;
          const stackSize = Math.max(
            1,
            Math.min(CALENDAR_MAX_STACK, overlapCounts.get(seg.segmentKey) ?? 1)
          );
          const leftPx = (seg.start_minutes / 60) * cellWidth;
          const widthPx = (seg.duration_minutes / 60) * cellWidth;
          const heightPct = 100 / stackSize - 2;
          const topPct = lane * (100 / stackSize);
          const ev = seg.source;
          const isMeeting = ev.type === "meeting";
          const isDeadline = ev.type === "task_deadline";
          const typeSuffix = isDeadline ? " · Task deadline" : isMeeting ? " · Meeting" : "";
          const titleTip = `${ev.title} ${ev.tags.map((tag) => `#${tag}`).join(" ")} · ${formatDuration(seg.duration_minutes)}${typeSuffix}`;
          return (
            <div
              key={seg.segmentKey}
              data-event
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(ev);
              }}
              className={`absolute rounded overflow-hidden cursor-pointer shadow-sm flex items-center gap-1 group hover:ring-2 hover:ring-white/80 ${
                isDeadline ? "border-2 border-dashed border-white/80" : "border border-white/50"
              }`}
              style={{
                left: leftPx,
                width: Math.max(24, widthPx),
                top: `${topPct}%`,
                height: `${heightPct}%`,
                backgroundColor: ev.color,
              }}
              title={titleTip}
            >
              {isMeeting && (
                <Bell className="w-3 h-3 text-white/90 flex-shrink-0 ml-1" aria-hidden />
              )}
              {isDeadline && (
                <Flag className="w-3 h-3 text-white/90 flex-shrink-0 ml-1" aria-hidden />
              )}
              <span className="truncate text-[10px] font-medium text-white px-1 drop-shadow flex-1 min-w-0">
                {ev.title}
              </span>
              {!isDeadline && (
                <Pencil
                  className="w-3 h-3 text-white/90 flex-shrink-0 opacity-70 group-hover:opacity-100 mr-1"
                  aria-hidden
                />
              )}
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
                className="absolute rounded overflow-hidden cursor-pointer border-2 border-dashed border-white/80 shadow-sm flex items-center gap-1 group hover:ring-2 hover:ring-white/80 z-10"
                style={{
                  left: leftPx,
                  width: widthPx,
                  top: "2%",
                  height: "96%",
                  backgroundColor: activeSession.color,
                  opacity: 0.85,
                }}
                title={`${activeSession.title} · ${sessionInProgressSince} – ${sessionEndButton}`}
              >
                <span className="truncate text-[10px] font-medium text-white px-1 drop-shadow flex-1 min-w-0">
                  {activeSession.title}
                </span>
                <Square
                  className="w-3 h-3 text-white/90 flex-shrink-0 opacity-70 group-hover:opacity-100 mr-1"
                  aria-hidden
                />
              </div>
            );
          })()}
      </div>
    </div>
  );
}
