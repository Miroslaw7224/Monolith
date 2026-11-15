import React, { useState } from "react";
import type { BugEntryDto } from "@/contexts/bc_projects/schemas";

const COLUMN_LABEL: Record<string, string> = {
  blockers: "Blokery",
  now: "Teraz",
  next: "Następne",
  icebox: "Icebox",
};

/** Znacznik rozjazdu lub powiązania bugu z zadaniem; `null`, gdy nie ma czego pokazać. */
function taskHint(bug: BugEntryDto, isClosed: boolean): string | null {
  const task = bug.task;
  if (!task) return null;
  if (isClosed) return task.done ? null : "bug zamknięty, zadanie nadal otwarte";
  return task.done
    ? "zadanie zrobione, bug nadal otwarty"
    : `w zadaniach: ${COLUMN_LABEL[task.column] ?? task.column}`;
}

function BugRow(props: { bug: BugEntryDto; isClosed: boolean }): React.JSX.Element {
  const { bug, isClosed } = props;
  const [expanded, setExpanded] = useState(false);
  const hint = taskHint(bug, isClosed);
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
            otwarty {bug.ageDays} d
          </span>
        ) : null}
        {isClosed && bug.closedOn ? (
          <span className="prj-badge">zamknięto {bug.closedOn}</span>
        ) : null}
        {hint ? <span className="prj-badge prj-badge--warn">{hint}</span> : null}
        {hasDetails ? (
          <button
            type="button"
            className="prj-bug__toggle"
            aria-expanded={expanded}
            aria-label={`Szczegóły ${bug.id}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Zwiń" : "Szczegóły"}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <dl className="prj-bug__details">
          {bug.file ? (
            <>
              <dt>Plik</dt>
              <dd>{bug.file}</dd>
            </>
          ) : null}
          {bug.description ? (
            <>
              <dt>Opis</dt>
              <dd>{bug.description}</dd>
            </>
          ) : null}
          {bug.fix ? (
            <>
              <dt>Naprawa</dt>
              <dd>{bug.fix}</dd>
            </>
          ) : null}
          {bug.resolution ? (
            <>
              <dt>Rozwiązanie</dt>
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
  const [closedOpen, setClosedOpen] = useState(false);
  const active = props.bugs.filter((b) => b.section !== "Zamknięte");
  const closed = props.bugs.filter((b) => b.section === "Zamknięte");

  return (
    <article className="prj-card">
      <h3 className="prj-section-title">Bugi</h3>
      {props.bugs.length === 0 ? (
        <p>Brak bugów</p>
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
                Zamknięte: {closed.length}
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
