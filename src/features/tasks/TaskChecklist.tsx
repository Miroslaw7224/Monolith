import React, { useState } from "react";
import { useT } from "@/src/i18n/useT";
import {
  countItems,
  cycleStatus,
  exportMarkdown,
  itemComment,
  itemLevel,
  parseChecklist,
  serializeChecklist,
  setItemComment,
  setItemStatus,
  type ItemStatus,
} from "./taskChecklist";

interface Props {
  title: string;
  value: string;
  onChange: (next: string) => void;
}

const GLYPH: Record<ItemStatus, string> = { todo: "☐", pass: "✓", fail: "✕" };
type CopyState = "idle" | "ok" | "failed";

export function TaskChecklist({ title, value, onChange }: Props) {
  const t = useT();
  const model = parseChecklist(value);
  const counts = countItems(model);
  const hasItems = counts.pass + counts.fail + counts.todo > 0;
  const [mode, setMode] = useState<"list" | "text">(hasItems ? "list" : "text");
  const [copy, setCopy] = useState<CopyState>("idle");

  const statusLabel: Record<ItemStatus, string> = {
    todo: t("tasks:tasksChecklistStatusTodo"),
    pass: t("tasks:tasksChecklistStatusPass"),
    fail: t("tasks:tasksChecklistStatusFail"),
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(exportMarkdown(title, value));
      setCopy("ok");
    } catch {
      setCopy("failed");
    }
  };

  const textarea = (
    <div className="zad-field">
      <label htmlFor="task-detail-note" className="zad-label">
        {t("tasks:tasksDetailNoteLabel")}
      </label>
      <textarea
        id="task-detail-note"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("tasks:tasksDetailNotePlaceholder")}
        rows={6}
        className="zad-textarea"
      />
    </div>
  );

  if (!hasItems) return textarea;

  return (
    <div className="zad-checklist">
      <div className="zad-checklist__head">
        <span className="zad-label">{t("tasks:tasksDetailNoteLabel")}</span>
        <span className="zad-checklist__counter">
          {t("tasks:tasksChecklistCounter", {
            pass: counts.pass,
            fail: counts.fail,
            todo: counts.todo,
          })}
        </span>
        <div className="zad-checklist__tools">
          {(["list", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={["zad-btn zad-btn--ghost zad-btn--sm", mode === m ? "zad-btn--active" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              {t(m === "list" ? "tasks:tasksChecklistList" : "tasks:tasksChecklistText")}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void copyMarkdown()}
            className="zad-btn zad-btn--ghost zad-btn--sm"
          >
            {t("tasks:tasksChecklistCopy")}
          </button>
        </div>
      </div>
      <p className="zad-save-state" role="status" aria-live="polite">
        {copy === "ok"
          ? t("tasks:tasksChecklistCopied")
          : copy === "failed"
            ? t("tasks:tasksChecklistCopyFailed")
            : ""}
      </p>

      {mode === "text" ? (
        textarea
      ) : (
        <ul className="zad-checklist__list">
          {model.lines.map((line, index) => {
            if (line.type === "text") {
              return line.raw.trim() === "" ? null : (
                <li key={index} className="zad-checklist__text">
                  {line.raw}
                </li>
              );
            }
            return (
              <li
                key={index}
                data-testid="checklist-item"
                className={`zad-checklist__item zad-checklist__item--${line.status}`}
                style={{ paddingLeft: `${itemLevel(line) * 1.25}rem` }}
              >
                <div className="zad-checklist__row">
                  <button
                    type="button"
                    aria-label={statusLabel[line.status]}
                    onClick={() =>
                      onChange(
                        serializeChecklist(setItemStatus(model, index, cycleStatus(line.status)))
                      )
                    }
                    className={`zad-checklist__status zad-checklist__status--${line.status}`}
                  >
                    {GLYPH[line.status]}
                  </button>
                  <span className="zad-checklist__label">{line.text}</span>
                </div>
                <textarea
                  rows={1}
                  value={itemComment(line)}
                  placeholder={t("tasks:tasksChecklistCommentPlaceholder")}
                  aria-label={`${t("tasks:tasksChecklistCommentPlaceholder")} ${line.text}`}
                  onChange={(e) =>
                    onChange(serializeChecklist(setItemComment(model, index, e.target.value)))
                  }
                  className="zad-checklist__comment"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
