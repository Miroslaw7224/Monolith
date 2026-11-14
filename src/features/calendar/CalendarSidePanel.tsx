import React from "react";
import type { CalendarEvent } from "./calendarUtils";
import {
  MONTH_NAMES,
  WEEKDAY_MINI_PL,
  formatClock,
  formatHoursMinutes,
  parseYmd,
} from "./calendarUtils";
import { briefLines } from "@/src/features/home/cockpitFormat";
import type { DeepWindowDto } from "@/contexts/bc_cockpit/schemas";

interface MiniMonthProps {
  weeks: string[][];
  viewMonth: number;
  todayStr: string;
  weekDates: string[];
  eventDates: Set<string>;
  onPick: (date: string) => void;
}

export function CalendarMiniMonth({
  weeks,
  viewMonth,
  todayStr,
  weekDates,
  eventDates,
  onPick,
}: MiniMonthProps) {
  const inWeek = new Set(weekDates);
  return (
    <section className="panel" aria-label="Mini-kalendarz">
      <div className="panel__head">
        <h2 className="panel__title">
          <b>{MONTH_NAMES.pl[viewMonth]}</b>
        </h2>
      </div>
      <div className="kal-mini">
        {WEEKDAY_MINI_PL.map((d) => (
          <span key={d} className="h">
            {d}
          </span>
        ))}
        {weeks.flat().map((date) => {
          const d = parseYmd(date);
          const cls = [
            d.getMonth() !== viewMonth ? "o" : "",
            date === todayStr ? "t" : inWeek.has(date) ? "w" : "",
            eventDates.has(date) ? "e" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={date}
              type="button"
              className={cls}
              aria-label={date}
              onClick={() => onPick(date)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface EventDetailProps {
  event: CalendarEvent | null;
  onEdit: (ev: CalendarEvent) => void;
}

export function CalendarEventDetail({ event, onEdit }: EventDetailProps) {
  if (!event) {
    return (
      <section className="panel" aria-label="Wybrane wydarzenie">
        <p className="kal-state kal-state--inline">Wybierz wydarzenie, żeby zobaczyć szczegóły.</p>
      </section>
    );
  }
  const lines = briefLines(event.brief ?? null);
  const link = event.link && /^https?:\/\/\S+$/i.test(event.link) ? event.link : null;
  return (
    <section className="panel panel--active" aria-label="Wybrane wydarzenie">
      <div className="row">
        <span className="chip chip--accent">
          {formatClock(event.start_minutes)}–
          {formatClock(event.start_minutes + event.duration_minutes)}
        </span>
        {event.tags.map((tag) => (
          <span key={tag} className="chip">
            {tag}
          </span>
        ))}
      </div>
      <h3 className="kal-detail__title">{event.title}</h3>
      <div className="row">
        {link ? (
          <a className="btn btn--sm" href={link} target="_blank" rel="noopener noreferrer">
            Dołącz ↗
          </a>
        ) : null}
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => onEdit(event)}>
          Edytuj
        </button>
      </div>
      {lines.length > 0 && (
        <div className="kal-sec">
          <h4>Brief</h4>
          <ol>
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export function CalendarSlotPlanner({ windows }: { windows: DeepWindowDto[] }) {
  return (
    <section className="panel kal-slots" aria-label="Planer slotów">
      <div className="panel__head">
        <h2 className="panel__title">
          <b>Planer slotów</b> · dziś
        </h2>
      </div>
      {windows.length === 0 ? (
        <p className="kal-state kal-state--inline">Brak wolnych okien na resztę dnia.</p>
      ) : (
        <ul className="list">
          {windows.map((w) => (
            <li key={`${w.startMinutes}-${w.energy}`} className="list__item">
              <span className="mono">{formatClock(w.startMinutes)}</span>
              <span className="list__main">
                <span className="list__title">{w.title}</span>
                <span className="list__meta">
                  {formatHoursMinutes(w.endMinutes - w.startMinutes)}
                  {w.projectName ? ` · ${w.projectName}` : ""}
                </span>
              </span>
              <span className={`energy energy--${w.energy}`}>{w.energy}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
