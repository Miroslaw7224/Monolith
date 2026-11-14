import React from "react";
import { formatClock, formatHoursMinutes } from "./calendarUtils";

export interface CalendarTilesData {
  /** `null`, gdy dzisiejszy dzień nie mieści się w pobranym zakresie (inny miesiąc). */
  todayCount: number | null;
  nextTodayStart: number | null;
  weekCount: number;
  weekEtat: number;
  deepMinutes: number;
  deepWindows: number;
  deadlines: number;
}

function windowsPhrase(count: number): string {
  if (count === 1) return "1 okno";
  const last = count % 10;
  const lastTwo = count % 100;
  const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return `${count} ${few ? "okna" : "okien"}`;
}

/** Kafle liczb tygodnia (makieta 02: `.kal-tiles`). */
export function CalendarTiles({ data }: { data: CalendarTilesData }) {
  const meetingsMeta =
    data.nextTodayStart !== null
      ? `następne ${formatClock(data.nextTodayStart)}`
      : "nic więcej dziś";
  return (
    <section className="kal-tiles" aria-label="Liczby tygodnia">
      <div className="kal-tile kal-tile--accent">
        <span className="kal-tile__label">Dziś</span>
        <span className="kal-tile__value">{data.todayCount ?? "–"}</span>
        <span className="kal-tile__meta">wydarzeń · {meetingsMeta}</span>
      </div>
      <div className="kal-tile">
        <span className="kal-tile__label">Wydarzenia w tygodniu</span>
        <span className="kal-tile__value">{data.weekCount}</span>
        <span className="kal-tile__meta">
          {data.weekEtat} etat · {data.weekCount - data.weekEtat} projekty i życie
        </span>
      </div>
      <div className="kal-tile">
        <span className="kal-tile__label">Okna Deep Work</span>
        <span className="kal-tile__value">
          {data.deepMinutes > 0 ? formatHoursMinutes(data.deepMinutes) : "0"}
        </span>
        <span className="kal-tile__meta">{windowsPhrase(data.deepWindows)} dziś</span>
      </div>
      <div className="kal-tile">
        <span className="kal-tile__label">Terminy zadań</span>
        <span className="kal-tile__value">{data.deadlines}</span>
        <span className="kal-tile__meta">w tym tygodniu</span>
      </div>
    </section>
  );
}
