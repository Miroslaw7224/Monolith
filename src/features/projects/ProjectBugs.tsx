import React, { useState } from "react";
import type { BugEntryDto } from "@/contexts/bc_projects/schemas";
import { useT } from "@/src/i18n/useT";

function BugRow(props: { bug: BugEntryDto; isClosed: boolean }): React.JSX.Element {
  const t = useT();
  const { bug, isClosed } = props;
  const [expanded, setExpanded] = useState(false);

  const hint = ((): string | null => {
    const task = bug.task;
    if (!task) return null;
    if (isClosed) return task.done ? null : t("projects:bugs.hintClosedOpen");
    if (task.done) return t("projects:bugs.hintOpenDone");
    const column =
      t(`projects:board.columns.${task.column}` as "projects:board.columns.now") || task.column;
    return t("projects:bugs.hintInTasks", { column });
  })();

  const hasDetails = Boolean(bug.file || bug.description || bug.fix || bug.resolution);

  return (
    <li className="prj-bug">
      <div className="prj-bug__row">
        <span className="prj-badge">{bug.id}</span>
        <span>{bug.title}</span>
        {bug.priority ? <span className="prj-badge">{bug.priority}</span> : null}
        {bug.status ? <span className="prj-badge">{bug.status}</span> : null}
        {!isClosed && bug.ageDays !== undefined ? (
          <span className={bug.stale ? "prj-badge prj-badge--warn" : "prj-badge"}>
            {t("projects:bugs.openDays", { days: bug.ageDays })}
          </span>
        ) : null}
        {isClosed && bug.closedOn ? (
          <span className="prj-badge">{t("projects:bugs.closedOn", { date: bug.closedOn })}</span>
        ) : null}
        {hint ? <span className="prj-badge prj-badge--warn">{hint}</span> : null}
        {hasDetails ? (
          <button
            type="button"
            className="prj-bug__toggle"
            aria-expanded={expanded}
            aria-label={t("projects:bugs.detailsAria", { id: bug.id })}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t("projects:bugs.collapse") : t("projects:bugs.expand")}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <dl className="prj-bug__details">
          {bug.file ? (
            <>
              <dt>{t("projects:bugs.fieldFile")}</dt>
              <dd>{bug.file}</dd>
            </>
          ) : null}
          {bug.description ? (
            <>
              <dt>{t("projects:bugs.fieldDesc")}</dt>
              <dd>{bug.description}</dd>
            </>
          ) : null}
          {bug.fix ? (
            <>
              <dt>{t("projects:bugs.fieldFix")}</dt>
              <dd>{bug.fix}</dd>
            </>
          ) : null}
          {bug.resolution ? (
            <>
              <dt>{t("projects:bugs.fieldResolution")}</dt>
              <dd>{bug.resolution}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}

/** Sekcja „Bugi” teczki projektu (tylko odczyt `bugs.md`). */
export function ProjectBugs(props: { bugs: BugEntryDto[] }): React.JSX.Element {
  const t = useT();
  const [closedOpen, setClosedOpen] = useState(false);
  const active = props.bugs.filter((b) => b.section !== "Zamknięte");
  const closed = props.bugs.filter((b) => b.section === "Zamknięte");

  return (
    <article className="prj-card">
      <h3 className="prj-section-title">{t("projects:bugs.title")}</h3>
      {props.bugs.length === 0 ? (
        <p>{t("projects:bugs.empty")}</p>
      ) : (
        <>
          {active.length > 0 ? (
            <ul className="prj-bugs">
              {active.map((bug) => (
                <BugRow key={bug.id} bug={bug} isClosed={false} />
              ))}
            </ul>
          ) : null}
          {closed.length > 0 ? (
            <>
              <button
                type="button"
                className="prj-bugs-closed"
                aria-expanded={closedOpen}
                onClick={() => setClosedOpen((v) => !v)}
              >
                {t("projects:bugs.closedToggle", { count: closed.length })}
              </button>
              {closedOpen ? (
                <ul className="prj-bugs-list">
                  {closed.map((bug) => (
                    <BugRow key={bug.id} bug={bug} isClosed />
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </article>
  );
}
