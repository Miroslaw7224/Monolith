import React from "react";
import { formatClock, formatHoursMinutes } from "./calendarUtils";
import { useT } from "@/src/i18n/useT";

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

/** Kafle liczb tygodnia (makieta 02: `.kal-tiles`). */
export function CalendarTiles({ data }: { data: CalendarTilesData }) {
  const t = useT();
  const meetingsMeta =
    data.nextTodayStart !== null
      ? t("planning:calendarTileNextAt", { time: formatClock(data.nextTodayStart) })
      : t("planning:calendarTileNoMoreToday");
  const deepWindowsPhrase = t("planning:calendarDeepWindows", { count: data.deepWindows });
  return (
    <section className="kal-tiles" aria-label={t("planning:calendarTilesAriaLabel")}>
      <div className="kal-tile kal-tile--accent">
        <span className="kal-tile__label">{t("planning:calendarToday")}</span>
        <span className="kal-tile__value">{data.todayCount ?? "–"}</span>
        <span className="kal-tile__meta">
          {t("planning:calendarTileEventsMeta", { meetings: meetingsMeta })}
        </span>
      </div>
      <div className="kal-tile">
        <span className="kal-tile__label">{t("planning:calendarTileWeekEventsLabel")}</span>
        <span className="kal-tile__value">{data.weekCount}</span>
        <span className="kal-tile__meta">
          {t("planning:calendarTileWeekMeta", {
            etat: data.weekEtat,
            rest: data.weekCount - data.weekEtat,
          })}
        </span>
      </div>
      <div className="kal-tile">
        <span className="kal-tile__label">{t("planning:calendarTileDeepWorkLabel")}</span>
        <span className="kal-tile__value">
          {data.deepMinutes > 0 ? formatHoursMinutes(data.deepMinutes) : "0"}
        </span>
        <span className="kal-tile__meta">
          {t("planning:calendarTileDeepMeta", { windows: deepWindowsPhrase })}
        </span>
      </div>
      <div className="kal-tile">
        <span className="kal-tile__label">{t("planning:calendarTileDeadlinesLabel")}</span>
        <span className="kal-tile__value">{data.deadlines}</span>
        <span className="kal-tile__meta">{t("planning:calendarTileDeadlinesMeta")}</span>
      </div>
    </section>
  );
}
