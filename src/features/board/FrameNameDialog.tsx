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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={keepFocusInDialog}
    >
      <form
        className="w-full max-w-md rounded-xl bg-[var(--surface)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = value.trim();
          if (!trimmed) return;
          onSubmit(trimmed);
        }}
      >
        <h2 id="board-frame-title" className="text-base font-bold text-[var(--text)]">
          {title}
        </h2>
        <input
          ref={inputRef}
          aria-labelledby="board-frame-title"
          className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="submit">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}
