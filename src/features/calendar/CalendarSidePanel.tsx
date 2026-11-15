import React from "react";
import type { CalendarEvent } from "./calendarUtils";
import {
  formatClock,
  formatHoursMinutes,
  parseYmd,
  weekdayKey,
  type WeekdayKey,
} from "./calendarUtils";
import { briefLines } from "@/src/features/home/cockpitFormat";
import type { DeepWindowDto } from "@/contexts/bc_cockpit/schemas";
import { useT } from "@/src/i18n/useT";
import { useLang } from "@/src/i18n/useLang";
import { formatMonthLong } from "@/src/i18n/format";

function calendarWeekdayMiniKey(k: WeekdayKey): `planning:calendarWeekdayMini.${WeekdayKey}` {
  return `planning:calendarWeekdayMini.${k}`;
}

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
  const t = useT();
  const { lang } = useLang();
  const inWeek = new Set(weekDates);
  const headerWeek = weeks[0] ?? [];
  return (
    <section className="panel" aria-label={t("planning:calendarMiniMonthAria")}>
      <div className="panel__head">
        <h2 className="panel__title">
          <b>
            {formatMonthLong(
              new Date(
                weeks[0]?.[0] ? parseYmd(weeks[0][0]).getFullYear() : new Date().getFullYear(),
                viewMonth,
                1
              ),
              lang
            )}
          </b>
        </h2>
      </div>
      <div className="kal-mini">
        {headerWeek.map((date) => (
          <span key={date} className="h">
            {t(calendarWeekdayMiniKey(weekdayKey(parseYmd(date))))}
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
  const t = useT();
  if (!event) {
    return (
      <section className="panel" aria-label={t("planning:calendarEventDetailAria")}>
        <p className="kal-state kal-state--inline">{t("planning:calendarDetailEmpty")}</p>
      </section>
    );
  }
  const lines = briefLines(event.brief ?? null);
  const link = event.link && /^https?:\/\/\S+$/i.test(event.link) ? event.link : null;
  return (
    <section className="panel panel--active" aria-label={t("planning:calendarEventDetailAria")}>
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
            {t("planning:calendarFormOpenMeeting")}
          </a>
        ) : null}
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => onEdit(event)}>
          {t("planning:calendarDetailEdit")}
        </button>
      </div>
      {lines.length > 0 && (
        <div className="kal-sec">
          <h4>{t("planning:calendarFormBrief")}</h4>
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
  const t = useT();
  return (
    <section className="panel kal-slots" aria-label={t("planning:calendarSlotPlannerAria")}>
      <div className="panel__head">
        <h2 className="panel__title">
          <b>{t("planning:calendarSlotPlannerTitle")}</b>
          {t("planning:calendarSlotPlannerToday")}
        </h2>
      </div>
      {windows.length === 0 ? (
        <p className="kal-state kal-state--inline">{t("planning:calendarSlotsEmpty")}</p>
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
