"use client";

import React, { useState } from "react";
import {
  NOW_LIMIT,
  type BoardTaskDto,
  type TaskOpInputDto,
  type TasksBoardDto,
} from "@/contexts/bc_projects/schemas";
import type { MutationResult } from "./mutation";

type ColumnKey = "blockers" | "now" | "next" | "icebox";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "blockers", label: "Blokery" },
  { key: "now", label: "Teraz" },
  { key: "next", label: "Następne" },
  { key: "icebox", label: "Icebox" },
];

type TaskPos = { column: ColumnKey; index: number };

const CONFLICT_MESSAGE = "Plik zadań zmienił się; odświeżono tablicę. Spróbuj ponownie.";

const samePos = (a: TaskPos | null, column: ColumnKey, index: number) =>
  a !== null && a.column === column && a.index === index;

export function ProjectTasksBoard(props: {
  board: TasksBoardDto;
  onOp: (input: TaskOpInputDto) => Promise<MutationResult>;
  onReload: () => void;
}): React.JSX.Element {
  const { board, onOp, onReload } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskPos | null>(null);
  const [editText, setEditText] = useState("");
  const [confirming, setConfirming] = useState<TaskPos | null>(null);
  const [drafts, setDrafts] = useState<Record<ColumnKey, string>>({
    blockers: "",
    now: "",
    next: "",
    icebox: "",
  });

  const nowFull = board.now.length >= NOW_LIMIT;

  /** Jedna mutacja naraz; wersja pliku z ostatniego odczytu jest dopisywana przez wywołującego. */
  const run = async (input: TaskOpInputDto): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const result = await onOp(input);
    setBusy(false);
    // Indeksy zadań zmieniają się po każdej udanej mutacji, więc otwarta edycja i potwierdzenie
    // usunięcia (trzymane po indeksie) przestałyby wskazywać to samo zadanie.
    if (result.ok === true) {
      setEditing(null);
      setConfirming(null);
    }
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
    if (result.ok === false) {
      setError(result.conflict ? CONFLICT_MESSAGE : result.error);
      if (result.conflict) {
        setEditing(null);
        setConfirming(null);
        onReload();
      }
      return false;
    }
    return true;
  };

  /** Referencja do zadania; zadania istnieją tylko, gdy plik istnieje, więc wersja jest wtedy niepusta. */
  const ref = (column: ColumnKey, index: number, task: BoardTaskDto) =>
    ({ column, index, text: task.text, version: board.version as string }) as const;

  const submitAdd = async (e: React.FormEvent, column: ColumnKey) => {
    e.preventDefault();
    const text = drafts[column].trim();
    if (busy || text === "") return;
    const ok = await run({ op: "add", column, text, version: board.version });
    if (ok) setDrafts((d) => ({ ...d, [column]: "" }));
  };

  const submitEdit = async (
    e: React.FormEvent,
    column: ColumnKey,
    index: number,
    task: BoardTaskDto
  ) => {
    e.preventDefault();
    const newText = editText.trim();
    if (busy) return;
    if (newText === "" || newText === task.text) {
      setEditing(null);
      return;
    }
    const ok = await run({ op: "edit", ...ref(column, index, task), newText });
    if (ok) setEditing(null);
  };

  const confirmRemove = async (column: ColumnKey, index: number, task: BoardTaskDto) => {
    if (busy) return;
    await run({ op: "remove", ...ref(column, index, task) });
    setConfirming(null);
  };

  const renderTask = (column: ColumnKey, task: BoardTaskDto, index: number) => {
    const key = `${column}-${index}-${task.text}`;
    if (samePos(editing, column, index)) {
      return (
        <li key={key} className="prj-board__item">
          <form className="prj-board__edit" onSubmit={(e) => submitEdit(e, column, index, task)}>
            <input
              aria-label="Edytuj zadanie"
              value={editText}
              maxLength={300}
              autoFocus
              disabled={busy}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(null);
              }}
            />
            <button type="submit" className="prj-btn prj-btn--primary" disabled={busy}>
              Zapisz
            </button>
            <button
              type="button"
              className="prj-btn"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Anuluj
            </button>
          </form>
        </li>
      );
    }
    const targets = COLUMNS.filter((c) => c.key !== column);
    return (
      <li
        key={key}
        className={task.done ? "prj-board__item prj-board__item--done" : "prj-board__item"}
      >
        <label className="prj-task-item">
          <input
            type="checkbox"
            checked={task.done}
            disabled={busy}
            onChange={() => run({ op: "toggle", ...ref(column, index, task) })}
          />
          <span className="prj-board__text">{task.text}</span>
        </label>
        {task.doneDate ? <span className="prj-board__date">{task.doneDate}</span> : null}
        <div className="prj-board__actions">
          <button
            type="button"
            className="prj-btn"
            aria-label={`Edytuj: ${task.text}`}
            disabled={busy}
            onClick={() => {
              setConfirming(null);
              setEditText(task.text);
              setEditing({ column, index });
            }}
          >
            Edytuj
          </button>
          {samePos(confirming, column, index) ? (
            <button
              type="button"
              className="prj-btn prj-btn--danger"
              aria-label={`Potwierdź usunięcie: ${task.text}`}
              disabled={busy}
              onClick={() => confirmRemove(column, index, task)}
            >
              Potwierdź
            </button>
          ) : (
            <button
              type="button"
              className="prj-btn"
              aria-label={`Usuń: ${task.text}`}
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setConfirming({ column, index });
              }}
            >
              Usuń
            </button>
          )}
          <select
            className="prj-board__move"
            aria-label={`Przenieś: ${task.text}`}
            value=""
            disabled={busy}
            onChange={(e) =>
              run({ op: "move", ...ref(column, index, task), to: e.target.value as ColumnKey })
            }
          >
            <option value="" disabled>
              Przenieś do…
            </option>
            {targets.map((t) => (
              <option
                key={t.key}
                value={t.key}
                disabled={t.key === "now" && (task.done || nowFull)}
              >
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </li>
    );
  };

  return (
    <div className="prj-board">
      {error ? (
        <p className="prj-alert prj-board__alert" role="alert">
          {error}
        </p>
      ) : null}
      {COLUMNS.map(({ key, label }) => {
        const tasks = board[key];
        const addDisabled = busy || (key === "now" && nowFull);
        return (
          <section key={key} className="prj-board__col" aria-label={`Kolumna ${label}`}>
            <h4 className="prj-task-section__title">
              {label}
              {key === "now" ? (
                <span className="prj-board__count">
                  {board.now.length}/{NOW_LIMIT}
                </span>
              ) : null}
            </h4>
            {tasks.length === 0 ? <p className="prj-task-empty">Brak</p> : null}
            <ul className="prj-task-list">{tasks.map((t, i) => renderTask(key, t, i))}</ul>
            <form className="prj-board__add" onSubmit={(e) => submitAdd(e, key)}>
              <input
                aria-label={`Dodaj zadanie: ${label}`}
                value={drafts[key]}
                maxLength={300}
                disabled={addDisabled}
                onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
              />
              <button type="submit" className="prj-btn" disabled={addDisabled}>
                Dodaj
              </button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
