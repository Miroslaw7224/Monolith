import React from "react";
import type { CalendarEvent } from "./calendarUtils";
import { formatClock, parseYmd, weekdayKey, type WeekdayKey } from "./calendarUtils";
import { isEtat } from "./calendarEventStyle";
import { useT } from "@/src/i18n/useT";
function calendarWeekdayShortKey(k: WeekdayKey): `planning:calendarWeekdayShort.${WeekdayKey}` {
  return `planning:calendarWeekdayShort.${k}`;
}

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
  const t = useT();
  const headerWeek = weeks[0] ?? [];
  return (
    <section className="kal-week" aria-label={t("planning:calendarMonthAria")}>
      <div className="kal-days kal-days--month">
        {headerWeek.map((date) => (
          <div key={date} className="kal-day-h">
            <span>{t(calendarWeekdayShortKey(weekdayKey(parseYmd(date))))}</span>
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
