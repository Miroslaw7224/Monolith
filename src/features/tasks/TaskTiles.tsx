import React from "react";
import type { TaskTilesData } from "./taskStatsUtils";
import i18n, { currentLang, type Lang } from "@/src/i18n";
import { useT } from "@/src/i18n/useT";

export function dueLabel(iso: string, now: Date, lang: Lang = currentLang()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (iso === key(now)) return i18n.t("tasks:tasksTileToday", { lng: lang });
  if (iso === key(tomorrow)) return i18n.t("tasks:tasksTileTomorrow", { lng: lang });
  const [, month, day] = iso.split("-");
  return `${day}.${month}`;
}

/** Kafle liczb karty Zadania (makieta 03: `.zad-tiles`). */
export function TaskTiles({
  data,
  now,
  dueOnly,
  onToggleDueOnly,
}: {
  data: TaskTilesData;
  now: Date;
  dueOnly: boolean;
  onToggleDueOnly: () => void;
}) {
  const t = useT();
  const { inProgress, todo, deadlines, doneWeek } = data;
  const dueNow = deadlines.overdue + deadlines.today;
  const delta = doneWeek.count - doneWeek.prevCount;
  const deltaStr = `${delta >= 0 ? "+" : "−"}${Math.abs(delta)}`;

  const todoMeta = todo.nextDue
    ? t("tasks:tasksTileNextDueMeta", {
        label: t("tasks:tasksTileNextDue"),
        date: dueLabel(todo.nextDue, now),
      })
    : t("tasks:tasksTileNoDueDates");
  const deadlinesMeta =
    deadlines.overdue > 0
      ? t("tasks:tasksTileOverdueMeta", { count: deadlines.overdue })
      : t("tasks:tasksTileWeekMeta", { week: deadlines.week });
  const doneMeta = t("tasks:tasksTileVsLastWeek", { delta: deltaStr });

  return (
    <section className="zad-tiles" aria-label={t("tasks:tasksTileAriaLabel")}>
      <div className="zad-tile zad-tile--accent">
        <span className="zad-tile__label">{t("tasks:tasksInProgress")}</span>
        <span className="zad-tile__value">{inProgress.count}</span>
        <span className="zad-tile__meta">
          {inProgress.deep} deep · {inProgress.quick} quick
        </span>
      </div>
      <div className="zad-tile">
        <span className="zad-tile__label">{t("tasks:tasksTodo")}</span>
        <span className="zad-tile__value">{todo.count}</span>
        <span className="zad-tile__meta">{todoMeta}</span>
      </div>
      <button
        type="button"
        className={["zad-tile", "zad-tile--button", dueOnly ? "zad-tile--pressed" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={dueOnly}
        disabled={dueNow === 0 && !dueOnly}
        onClick={onToggleDueOnly}
        title={dueOnly ? t("tasks:tasksTileShowAllTitle") : t("tasks:tasksTileDueOnlyTitle")}
      >
        <span className="zad-tile__label">{t("tasks:tasksTileDeadlines")}</span>
        <span className="zad-tile__value">{dueNow}</span>
        <span
          className={[
            "zad-tile__meta",
            deadlines.overdue > 0 && !dueOnly ? "zad-tile__meta--danger" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {dueOnly ? t("tasks:tasksTileClickShowAll") : deadlinesMeta}
        </span>
      </button>
      <div className="zad-tile">
        <span className="zad-tile__label">{t("tasks:tasksTileDoneThisWeek")}</span>
        <span className="zad-tile__value">{doneWeek.count}</span>
        <span className="zad-tile__meta">{doneMeta}</span>
      </div>
    </section>
  );
}
