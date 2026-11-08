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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={keepFocusInDialog}
    >
      <div className="w-full max-w-md rounded-xl bg-[var(--surface)] p-4">
        <h2 id="board-delete-title" className="text-base font-bold text-[var(--text)]">
          {title}
        </h2>
        {lines.map((line) => (
          <p key={line} className="mt-2 text-sm text-[var(--text2)]">
            {line}
          </p>
        ))}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm"
            autoFocus
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
