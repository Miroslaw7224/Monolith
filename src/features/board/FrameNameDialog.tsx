import React, { useEffect, useRef, useState, type KeyboardEvent } from "react";

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

export function FrameNameDialog({
  title,
  initialTitle = "",
  submitLabel,
  cancelLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  initialTitle?: string;
  submitLabel: string;
  cancelLabel: string;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="plo-dialog-backdrop"
      onKeyDown={keepFocusInDialog}
    >
      <form
        className="panel plo-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = value.trim();
          if (!trimmed) return;
          onSubmit(trimmed);
        }}
      >
        <div className="panel__head plo-panel__head">
          <h2 id="board-frame-title" className="panel__title plo-panel__title">
            <b>{title}</b>
          </h2>
          <span className="chip chip--accent plo-chip">Ramka</span>
        </div>

        <label className="plo-field">
          <input
            ref={inputRef}
            aria-labelledby="board-frame-title"
            className="input plo-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>

        <div className="plo-dialog__actions">
          <button type="button" className="btn plo-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="submit" className="btn btn--primary plo-btn plo-btn--primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
