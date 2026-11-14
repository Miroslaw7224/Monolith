import React from "react";
import type { CalendarEvent } from "./calendarUtils";
import { WEEKDAY_SHORT_PL, formatClock, parseYmd } from "./calendarUtils";
import { isEtat } from "./calendarEventStyle";

const MAX_PILLS = 3;

interface CalendarMonthGridProps {
  weeks: string[][];
  viewMonth: number;
  todayStr: string;
  eventsByDate: Map<string, CalendarEvent[]>;
  onPickDay: (date: string) => void;
  onSelect: (ev: CalendarEvent) => void;
}

export function CalendarMonthGrid({
  weeks,
  viewMonth,
  todayStr,
  eventsByDate,
  onPickDay,
  onSelect,
}: CalendarMonthGridProps) {
  return (
    <section className="kal-week" aria-label="Miesiąc">
      <div className="kal-days kal-days--month">
        {WEEKDAY_SHORT_PL.map((d) => (
          <div key={d} className="kal-day-h">
            <span>{d}</span>
          </div>
        ))}
      </div>
      <div className="kal-month">
        {weeks.flat().map((date) => {
          const d = parseYmd(date);
          const items = eventsByDate.get(date) ?? [];
          const cls = [d.getMonth() !== viewMonth ? "muted" : "", date === todayStr ? "t" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={date}
              className={cls}
              data-date={date}
              role="button"
              tabIndex={0}
              onClick={() => onPickDay(date)}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onPickDay(date);
                }
              }}
            >
              <b>{d.getDate()}</b>
              {items.slice(0, MAX_PILLS).map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={`pill ${isEtat(ev) ? "pill--etat" : ""} ${ev.type === "task_deadline" ? "pill--deadline" : ""}`}
                  style={{ borderLeftColor: isEtat(ev) ? undefined : ev.color || undefined }}
                  title={`${ev.title} · ${formatClock(ev.start_minutes)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(ev);
                  }}
                >
                  {ev.title}
                </button>
              ))}
              {items.length > MAX_PILLS && (
                <span className="pill pill--more">+{items.length - MAX_PILLS}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
