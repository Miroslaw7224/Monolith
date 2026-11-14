import React from "react";
import type { TaskTilesData } from "./taskStatsUtils";

function dueLabel(iso: string, now: Date, lang: "en" | "pl"): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (iso === key(now)) return lang === "pl" ? "dziś" : "today";
  if (iso === key(tomorrow)) return lang === "pl" ? "jutro" : "tomorrow";
  const [, month, day] = iso.split("-");
  return `${day}.${month}`;
}

/** Kafle liczb karty Zadania (makieta 03: `.zad-tiles`). */
export function TaskTiles({
  data,
  lang,
  now,
  dueOnly,
  onToggleDueOnly,
}: {
  data: TaskTilesData;
  lang: "en" | "pl";
  now: Date;
  dueOnly: boolean;
  onToggleDueOnly: () => void;
}) {
  const pl = lang === "pl";
  const { inProgress, todo, deadlines, doneWeek } = data;
  const dueNow = deadlines.overdue + deadlines.today;
  const delta = doneWeek.count - doneWeek.prevCount;

  const todoMeta = todo.nextDue
    ? `${pl ? "najbliższy termin" : "next due"}: ${dueLabel(todo.nextDue, now, lang)}`
    : pl
      ? "bez terminów"
      : "no due dates";
  const deadlinesMeta =
    deadlines.overdue > 0
      ? pl
        ? `${deadlines.overdue} po terminie`
        : `${deadlines.overdue} overdue`
      : `${pl ? "w 7 dni" : "next 7 days"}: ${deadlines.week}`;
  const doneMeta = `${delta >= 0 ? "+" : "−"}${Math.abs(delta)} ${
    pl ? "vs ubiegły tydzień" : "vs last week"
  }`;

  return (
    <section className="zad-tiles" aria-label={pl ? "Liczby zadań" : "Task numbers"}>
      <div className="zad-tile zad-tile--accent">
        <span className="zad-tile__label">{pl ? "W toku" : "In progress"}</span>
        <span className="zad-tile__value">{inProgress.count}</span>
        <span className="zad-tile__meta">
          {inProgress.deep} deep · {inProgress.quick} quick
        </span>
      </div>
      <div className="zad-tile">
        <span className="zad-tile__label">{pl ? "Do zrobienia" : "To do"}</span>
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
        title={
          dueOnly
            ? pl
              ? "Pokaż wszystkie zadania"
              : "Show all tasks"
            : pl
              ? "Pokaż tylko zadania na dziś i po terminie"
              : "Show only tasks due today or overdue"
        }
      >
        <span className="zad-tile__label">{pl ? "Terminy" : "Deadlines"}</span>
        <span className="zad-tile__value">{dueNow}</span>
        <span
          className={[
            "zad-tile__meta",
            deadlines.overdue > 0 && !dueOnly ? "zad-tile__meta--danger" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {dueOnly ? (pl ? "kliknij, by pokazać wszystkie" : "click to show all") : deadlinesMeta}
        </span>
      </button>
      <div className="zad-tile">
        <span className="zad-tile__label">{pl ? "Zrobione w tym tygodniu" : "Done this week"}</span>
        <span className="zad-tile__value">{doneWeek.count}</span>
        <span className="zad-tile__meta">{doneMeta}</span>
      </div>
    </section>
  );
}
