import React, { type KeyboardEvent } from "react";

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

export function ConfirmDeleteDialog({
  title,
  lines,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  lines: string[];
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-delete-title"
      className="plo-dialog-backdrop"
      onKeyDown={keepFocusInDialog}
    >
      <div className="panel plo-dialog">
        <div className="panel__head plo-panel__head">
          <h2 id="board-delete-title" className="panel__title plo-panel__title">
            <b>{title}</b>
          </h2>
          <span className="chip chip--danger plo-chip">Usuwanie</span>
        </div>

        <div className="plo-dialog__content">
          {lines.map((line) => (
            <p key={line} className="plo-dialog__line">
              {line}
            </p>
          ))}
        </div>

        <div className="plo-dialog__actions">
          <button type="button" className="btn plo-btn" autoFocus onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn--danger plo-btn plo-btn--danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
