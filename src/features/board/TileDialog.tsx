import React, { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { BoardTileDto as BoardTile } from "@/contexts/bc_board/schemas";

function keepFocusInDialog(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab") return;
  const focusables = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>("button, input, textarea")
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function TileDialog({
  tile,
  titleLabel,
  noteLabel,
  closeLabel,
  onSave,
}: {
  tile: BoardTile;
  titleLabel: string;
  noteLabel: string;
  closeLabel: string;
  onSave: (patch: { title: string; note: string }) => void;
}) {
  const [title, setTitle] = useState(tile.title);
  const [note, setNote] = useState(tile.note);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titleLabel}
      className="plo-dialog-backdrop"
      onKeyDown={keepFocusInDialog}
    >
      <div className="panel plo-dialog">
        <div className="panel__head plo-panel__head">
          <h2 className="panel__title plo-panel__title">
            <b>{titleLabel}</b>
          </h2>
          <span className="chip chip--accent plo-chip">Kafelek</span>
        </div>

        <label className="plo-field">
          <span className="plo-field__label">{titleLabel}</span>
          <input
            ref={titleInputRef}
            className="input plo-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="plo-field">
          <span className="plo-field__label">{noteLabel}</span>
          <textarea
            className="input plo-input plo-textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <div className="plo-dialog__actions">
          <button
            type="button"
            className="btn btn--primary plo-btn plo-btn--primary"
            onClick={() =>
              onSave({ title: title.trim().slice(0, 200), note: note.slice(0, 10000) })
            }
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
