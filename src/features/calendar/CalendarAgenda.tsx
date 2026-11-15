import React from "react";
import type { CalendarEvent } from "./calendarUtils";
import { formatClock, parseYmd } from "./calendarUtils";
import { useT } from "@/src/i18n/useT";
import { useLang } from "@/src/i18n/useLang";
import { formatWeekdayLong } from "@/src/i18n/format";

interface CalendarAgendaProps {
  dates: string[];
  todayStr: string;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelect: (ev: CalendarEvent) => void;
}

export function CalendarAgenda({ dates, todayStr, eventsByDate, onSelect }: CalendarAgendaProps) {
  const t = useT();
  const { lang } = useLang();
  const days = dates.filter((d) => (eventsByDate.get(d) ?? []).length > 0);
  return (
    <section className="kal-week" aria-label={t("planning:calendarAgendaAria")}>
      {days.length === 0 ? (
        <p className="kal-state">{t("planning:calendarAgendaEmpty")}</p>
      ) : (
        <div className="kal-agenda">
          {days.map((date) => (
            <React.Fragment key={date}>
              <div className="kal-agenda__day">
                <b>{parseYmd(date).getDate()}</b>
                {formatWeekdayLong(parseYmd(date), lang)}
                {date === todayStr ? t("planning:calendarTodaySuffix") : ""}
              </div>
              <ul className="list kal-agenda__items">
                {(eventsByDate.get(date) ?? []).map((ev) => (
                  <li
                    key={ev.id}
                    className="list__item"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(ev)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(ev);
                      }
                    }}
                  >
                    <span className="mono muted">{formatClock(ev.start_minutes)}</span>
                    <span className="list__main">
                      <span className="list__title">{ev.title}</span>
                      {ev.tags.length > 0 && (
                        <span className="list__meta">{ev.tags.join(" · ")}</span>
                      )}
                    </span>
                    {ev.brief ? <span className="chip chip--accent">brief</span> : null}
                  </li>
                ))}
              </ul>
            </React.Fragment>
          ))}
        </div>
      )}
    </section>
  );
}
