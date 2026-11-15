"use client";

import React, { useState } from "react";
import { GripVertical } from "lucide-react";
import {
  ARCHIVE_DAYS_OPTIONS,
  ARCHIVE_DEFAULT_DAYS,
  NOW_LIMIT,
  archiveDateOf,
  isArchivable,
  localIsoDate,
  type BoardTaskDto,
  type TaskOpInputDto,
  type TasksBoardDto,
} from "@/contexts/bc_projects/schemas";
import { useT } from "@/src/i18n/useT";
import type { MutationResult } from "./mutation";
import {
  archiveConfirmQuestion,
  archiveMovedNotice,
  columnTaskCountLabel,
  doneToNowError,
  nowLimitError,
  type ColumnKey,
} from "./projectsFormat";

const COLUMNS = [
  { key: "blockers" as const, labelKey: "projects:board.columns.blockers" as const },
  { key: "now" as const, labelKey: "projects:board.columns.now" as const },
  { key: "next" as const, labelKey: "projects:board.columns.next" as const },
  { key: "icebox" as const, labelKey: "projects:board.columns.icebox" as const },
];

type Filter = "all" | "open" | "done";

const FILTERS = [
  { key: "all" as const, labelKey: "projects:board.filterAll" as const },
  { key: "open" as const, labelKey: "projects:board.filterOpen" as const },
  { key: "done" as const, labelKey: "projects:board.filterDone" as const },
];

const EMPTY_KEYS = {
  all: "projects:board.emptyAll",
  open: "projects:board.emptyOpen",
  done: "projects:board.emptyDone",
} as const;

const matchesFilter = (filter: Filter, task: BoardTaskDto) =>
  filter === "all" || (filter === "done") === task.done;

type TaskPos = { column: ColumnKey; index: number };

const samePos = (a: TaskPos | null, column: ColumnKey, index: number) =>
  a !== null && a.column === column && a.index === index;

export function ProjectTasksBoard(props: {
  board: TasksBoardDto;
  onOp: (input: TaskOpInputDto) => Promise<MutationResult>;
  onArchive: (version: string | null, olderThanDays: number) => Promise<MutationResult>;
  onReload: () => void;
}): React.JSX.Element {
  const t = useT();
  const { board, onOp, onArchive, onReload } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskPos | null>(null);
  const [editText, setEditText] = useState("");
  const [confirming, setConfirming] = useState<TaskPos | null>(null);
  /** Przeciągane zadanie (po pozycji) i kolumna, nad którą jest kursor. */
  const [drag, setDrag] = useState<TaskPos | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnKey | null>(null);
  const [drafts, setDrafts] = useState<Record<ColumnKey, string>>({
    blockers: "",
    now: "",
    next: "",
    icebox: "",
  });

  const [filter, setFilter] = useState<Filter>("all");
  const [days, setDays] = useState<number>(ARCHIVE_DEFAULT_DAYS);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /** Zmiana filtra zamyka edycję i potwierdzenie usunięcia (trzymane po pozycji). */
  const changeFilter = (next: Filter) => {
    setFilter(next);
    setEditing(null);
    setConfirming(null);
  };

  const nowFull = board.now.length >= NOW_LIMIT;

  // M i K z pełnej tablicy (nie z widoku), tymi samymi funkcjami co serwer.
  const allTasks = COLUMNS.flatMap(({ key }) => board[key]);
  const today = localIsoDate(new Date());
  const archivable = allTasks.filter((t) => isArchivable(t, today, days));
  const archiveCount = archivable.length;
  const archiveNoDate = archivable.filter((t) => archiveDateOf(t) === null).length;
  const hasDone = allTasks.some((t) => t.done);

  /** Jedna mutacja naraz (wspólny `busy`/`error`/konflikt); wersję pliku dopisuje wywołujący. */
  const exec = async (call: () => Promise<MutationResult>): Promise<MutationResult> => {
    setBusy(true);
    setError(null);
    setNotice(null);
    // Każda mutacja zamyka otwarte potwierdzenie archiwizacji (M/K mogą się zmienić).
    setConfirmingArchive(false);
    const result = await call();
    setBusy(false);
    // Indeksy zadań zmieniają się po każdej udanej mutacji, więc otwarta edycja i potwierdzenie
    // usunięcia (trzymane po indeksie) przestałyby wskazywać to samo zadanie.
    if (result.ok === true) {
      setEditing(null);
      setConfirming(null);
    }
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
    if (result.ok === false) {
      setError(result.conflict ? t("projects:board.conflict") : result.error);
      if (result.conflict) {
        setEditing(null);
        setConfirming(null);
        onReload();
      }
    }
    return result;
  };

  const run = async (input: TaskOpInputDto): Promise<boolean> =>
    (await exec(() => onOp(input))).ok === true;

  const confirmArchive = async () => {
    if (busy) return;
    const result = await exec(() => onArchive(board.version, days));
    setConfirmingArchive(false);
    if (result.ok === true) {
      setNotice(archiveMovedNotice(result.archived ?? 0));
    }
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

  const endDrag = () => {
    setDrag(null);
    setOverColumn(null);
  };

  /** Te same reguły co na serwerze (422), sprawdzane wcześniej, żeby nie wysyłać skazanego żądania. */
  const moveBlockReason = (task: BoardTaskDto, to: ColumnKey): string | null => {
    if (to !== "now") return null;
    if (task.done) return doneToNowError();
    if (nowFull) return nowLimitError(NOW_LIMIT);
    return null;
  };

  /** Upuszczenie przeciąganego zadania na kolumnę: przeniesienie (ta sama kolumna = brak zmiany). */
  const dropOn = async (to: ColumnKey) => {
    const from = drag;
    endDrag();
    if (from === null || busy || from.column === to) return;
    const task = board[from.column][from.index];
    if (task === undefined) return;
    const reason = moveBlockReason(task, to);
    if (reason !== null) {
      setError(reason);
      return;
    }
    await run({ op: "move", ...ref(from.column, from.index, task), to });
  };

  const renderTask = (column: ColumnKey, task: BoardTaskDto, index: number) => {
    const key = `${column}-${index}-${task.text}`;
    if (samePos(editing, column, index)) {
      return (
        <li key={key} className="prj-board__item">
          <form className="prj-board__edit" onSubmit={(e) => submitEdit(e, column, index, task)}>
            <input
              aria-label={t("projects:board.editTaskAria")}
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
              {t("projects:common.save")}
            </button>
            <button
              type="button"
              className="prj-btn"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              {t("projects:common.cancel")}
            </button>
          </form>
        </li>
      );
    }
    const itemClass = [
      "prj-board__item",
      task.done ? "prj-board__item--done" : "",
      samePos(drag, column, index) ? "prj-board__item--dragging" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <li key={key} className={itemClass}>
        <div className="prj-board__row">
          <span
            className="prj-board__grip"
            draggable={!busy}
            aria-label={t("projects:board.dragAria", { text: task.text })}
            title={t("projects:board.dragTitle")}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", task.text);
              setError(null);
              setDrag({ column, index });
            }}
            onDragEnd={endDrag}
          >
            <GripVertical className="prj-board__grip-icon" aria-hidden />
          </span>
          <label className="prj-task-item">
            <input
              type="checkbox"
              checked={task.done}
              disabled={busy}
              onChange={() => run({ op: "toggle", ...ref(column, index, task) })}
            />
            <span className="prj-board__text">{task.text}</span>
          </label>
        </div>
        <div className="prj-board__foot">
          <span className="prj-board__date">{task.doneDate ?? ""}</span>
          <div className="prj-board__actions">
            <button
              type="button"
              className="prj-btn"
              aria-label={t("projects:board.editAria", { text: task.text })}
              disabled={busy}
              onClick={() => {
                setConfirming(null);
                setEditText(task.text);
                setEditing({ column, index });
              }}
            >
              {t("projects:board.editBtn")}
            </button>
            {samePos(confirming, column, index) ? (
              <button
                type="button"
                className="prj-btn prj-btn--danger"
                aria-label={t("projects:board.confirmRemoveAria", { text: task.text })}
                disabled={busy}
                onClick={() => confirmRemove(column, index, task)}
              >
                {t("projects:board.confirmRemoveBtn")}
              </button>
            ) : (
              <button
                type="button"
                className="prj-btn"
                aria-label={t("projects:board.removeAria", { text: task.text })}
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setConfirming({ column, index });
                }}
              >
                {t("projects:board.removeBtn")}
              </button>
            )}
          </div>
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
      {notice ? (
        <p className="prj-board__notice" role="status">
          {notice}
        </p>
      ) : null}
      <div className="prj-board__toolbar">
        <div className="prj-board__filter" role="group" aria-label={t("projects:board.filterAria")}>
          {FILTERS.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              className={filter === key ? "prj-btn prj-btn--primary" : "prj-btn"}
              aria-pressed={filter === key}
              onClick={() => changeFilter(key)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        {hasDone ? (
          <div className="prj-board__archive">
            <span>{t("projects:board.archiveOlder")}</span>
            <select
              aria-label={t("projects:board.archiveDaysAria")}
              value={days}
              disabled={busy}
              onChange={(e) => {
                setDays(Number(e.target.value));
                setConfirmingArchive(false);
              }}
            >
              {ARCHIVE_DAYS_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {t("projects:board.archiveDays", { count: d })}
                </option>
              ))}
            </select>
            {archiveCount === 0 ? null : confirmingArchive ? (
              <>
                <span>{archiveConfirmQuestion(archiveCount, archiveNoDate)}</span>
                <button
                  type="button"
                  className="prj-btn prj-btn--danger"
                  aria-label={t("projects:board.archiveConfirmAria")}
                  disabled={busy}
                  onClick={confirmArchive}
                >
                  {t("projects:board.archiveConfirmBtn")}
                </button>
                <button
                  type="button"
                  className="prj-btn"
                  aria-label={t("projects:board.archiveCancelAria")}
                  disabled={busy}
                  onClick={() => setConfirmingArchive(false)}
                >
                  {t("projects:common.cancel")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="prj-btn"
                disabled={busy}
                onClick={() => setConfirmingArchive(true)}
              >
                {t("projects:board.archiveBtn", { count: archiveCount })}
              </button>
            )}
          </div>
        ) : null}
      </div>
      {COLUMNS.map(({ key, labelKey }) => {
        const label = t(labelKey);
        const tasks = board[key];
        // Indeksy zostają oryginalne (z pełnej kolumny): filtr tylko ukrywa wiersze.
        const visible = tasks
          .map((task, index) => ({ task, index }))
          .filter(({ task }) => matchesFilter(filter, task));
        const addDisabled = busy || (key === "now" && nowFull);
        return (
          <section
            key={key}
            className={
              drag !== null && overColumn === key
                ? `prj-board__col prj-board__col--${key} prj-board__col--over`
                : `prj-board__col prj-board__col--${key}`
            }
            aria-label={t("projects:board.columnAria", { label })}
            onDragOver={(e) => {
              if (drag === null || busy) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverColumn(key);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setOverColumn((c) => (c === key ? null : c));
              }
            }}
            onDrop={(e) => {
              if (drag === null) return;
              e.preventDefault();
              void dropOn(key);
            }}
          >
            <div className="prj-column__head">
              <h4 className="prj-column__title">
                <span className={`prj-dot prj-dot--${key}`} aria-hidden />
                {label}
                {key === "now" ? (
                  <span className="prj-board__count">
                    {board.now.length}/{NOW_LIMIT}
                  </span>
                ) : null}
              </h4>
              {key !== "now" ? (
                <span className="prj-column__count">
                  {columnTaskCountLabel(key, visible.length)}
                </span>
              ) : null}
            </div>
            {visible.length === 0 ? (
              <p className="prj-task-empty">{t(EMPTY_KEYS[filter])}</p>
            ) : null}
            <ul className="prj-task-list">
              {visible.map(({ task, index }) => renderTask(key, task, index))}
            </ul>
            {filter === "done" ? null : (
              <form className="prj-board__add" onSubmit={(e) => submitAdd(e, key)}>
                <input
                  aria-label={t("projects:board.addAria", { label })}
                  placeholder={t("projects:board.addPlaceholder")}
                  value={drafts[key]}
                  maxLength={300}
                  disabled={addDisabled}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                />
                <button type="submit" className="prj-btn" disabled={addDisabled}>
                  {t("projects:board.addBtn")}
                </button>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
