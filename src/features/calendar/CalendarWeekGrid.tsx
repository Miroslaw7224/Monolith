import React, { useEffect, useRef } from "react";
import type { CalendarEvent, CalendarEventSegment } from "./calendarUtils";
import {
  CALENDAR_MAX_STACK,
  WEEKDAY_SHORT_PL,
  assignLanes,
  formatClock,
  getOverlapCounts,
  parseYmd,
} from "./calendarUtils";
import { eventModifier } from "./calendarEventStyle";
import type { ActiveSession } from "@/src/components/sessions/activeSession";
import type { DeepWindowDto } from "@/contexts/bc_cockpit/schemas";

const HOURS = 24;
const SNAP_MINUTES = 30;

interface CalendarWeekGridProps {
  dates: string[];
  segments: CalendarEventSegment[];
  todayStr: string;
  nowMinutes: number;
  selectedId: string | null;
  /** Okna Deep Work / Quick Win proponowane na dziś. */
  windows: DeepWindowDto[];
  activeSession: ActiveSession | null;
  onSelect: (ev: CalendarEvent) => void;
  onAdd: (date: string, startMinutes: number) => void;
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Oś godzin pionowo, dni jako kolumny (makieta 02: `.kal-week`). */
export function CalendarWeekGrid({
  dates,
  segments,
  todayStr,
  nowMinutes,
  selectedId,
  windows,
  activeSession,
  onSelect,
  onAdd,
}: CalendarWeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Przy wejściu przewiń do okolic 07:00 (praca w różnych godzinach, ale nie od północy).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 7 * 52;
  }, []);

  return (
    <section className="kal-week" aria-label="Tydzień">
      <div className="kal-scroll" ref={scrollRef}>
        <div className="kal-days">
          <div />
          {dates.map((date, i) => {
            const isToday = date === todayStr;
            return (
              <div key={date} className={`kal-day-h ${isToday ? "kal-day-h--today" : ""}`}>
                <span>
                  {WEEKDAY_SHORT_PL[i]}
                  {isToday ? " · dziś" : ""}
                </span>
                <b>{parseYmd(date).getDate()}</b>
              </div>
            );
          })}
        </div>
        <div className="kal-body">
          <div className="kal-hours">
            {Array.from({ length: HOURS }, (_, h) => (
              <span key={h}>{String(h).padStart(2, "0")}</span>
            ))}
          </div>
          {dates.map((date, i) => {
            const isToday = date === todayStr;
            const daySegments = segments.filter((s) => s.segmentDate === date);
            const laneItems = daySegments.map((s) => ({
              id: s.segmentKey,
              start_minutes: s.start_minutes,
              duration_minutes: s.duration_minutes,
            }));
            const lanes = assignLanes(laneItems);
            const overlaps = getOverlapCounts(laneItems);
            return (
              <div
                key={date}
                className={`kal-col ${isToday ? "kal-col--today" : ""} ${i >= 5 ? "kal-col--weekend" : ""}`}
                data-date={date}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-event]")) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const raw = ((e.clientY - rect.top) / rect.height) * HOURS * 60;
                  const snapped = Math.floor(raw / SNAP_MINUTES) * SNAP_MINUTES;
                  onAdd(date, Math.max(0, Math.min(snapped, HOURS * 60 - SNAP_MINUTES)));
                }}
              >
                {isToday && (
                  <div
                    className="kal-now"
                    style={{ ["--start" as string]: nowMinutes / 60 }}
                    aria-label={`Teraz ${formatClock(nowMinutes)}`}
                  />
                )}
                {isToday &&
                  windows.map((w) => (
                    <div
                      key={`${w.startMinutes}-${w.energy}`}
                      className="kal-ev kal-ev--slot"
                      style={{
                        ["--start" as string]: w.startMinutes / 60,
                        ["--len" as string]: (w.endMinutes - w.startMinutes) / 60,
                      }}
                      title={`${formatClock(w.startMinutes)}–${formatClock(w.endMinutes)}`}
                    >
                      <b>{w.energy === "deep" ? "Okno Deep Work" : "Okno Quick Win"}</b>
                      {w.title}
                    </div>
                  ))}
                {daySegments.map((seg) => {
                  const ev = seg.source;
                  const lane = lanes.get(seg.segmentKey) ?? 0;
                  const stack = Math.max(
                    1,
                    Math.min(CALENDAR_MAX_STACK, overlaps.get(seg.segmentKey) ?? 1)
                  );
                  const end = seg.start_minutes + seg.duration_minutes;
                  const done = date < todayStr || (date === todayStr && end <= nowMinutes);
                  const short = seg.duration_minutes <= 30;
                  const cls = [
                    "kal-ev",
                    eventModifier(ev),
                    done ? "kal-ev--done" : "",
                    short ? "kal-ev--short" : "",
                    ev.id === selectedId ? "kal-ev--sel" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const range = `${formatClock(seg.start_minutes)}–${formatClock(end)}`;
                  return (
                    <div
                      key={seg.segmentKey}
                      data-event
                      role="button"
                      tabIndex={0}
                      className={cls}
                      style={{
                        ["--start" as string]: seg.start_minutes / 60,
                        ["--len" as string]: seg.duration_minutes / 60,
                        left: `calc(4px + ${lane} * (100% - 8px) / ${stack})`,
                        width: `calc((100% - 8px) / ${stack} - 2px)`,
                        right: "auto",
                        borderLeftColor: ev.color || undefined,
                      }}
                      title={`${ev.title} · ${range}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(ev);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(ev);
                        }
                      }}
                    >
                      <b>{ev.title}</b>
                      {!short && <time>{range}</time>}
                    </div>
                  );
                })}
                {isToday &&
                  activeSession &&
                  (() => {
                    const started = new Date(activeSession.startedAt);
                    const startDay = localYmd(started);
                    if (startDay > todayStr) return null;
                    const startMin =
                      startDay < todayStr ? 0 : started.getHours() * 60 + started.getMinutes();
                    if (nowMinutes < startMin) return null;
                    return (
                      <div
                        data-event
                        data-active-session
                        className="kal-ev kal-ev--active-session"
                        style={{
                          ["--start" as string]: startMin / 60,
                          ["--len" as string]: (nowMinutes - startMin) / 60,
                        }}
                        title={`${activeSession.title} · w toku`}
                      >
                        <b>{activeSession.title}</b>
                      </div>
                    );
                  })()}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
