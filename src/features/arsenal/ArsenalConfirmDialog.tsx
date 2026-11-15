import React, { useId } from "react";

/** Potwierdzenie usunięcia w karcie Arsenał (zamiast natywnego `window.confirm`). Style: `.ars-modal*` z resources.css. */
export function ArsenalConfirmDialog({
  title,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  return (
    <div
      className="ars-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onCancel}
    >
      <div
        className="ars-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
      >
        <div className="ars-modal__head">
          <h3 id={titleId} className="ars-modal__title">
            {title}
          </h3>
        </div>
        <div className="ars-modal__foot">
          <button type="button" className="btn btn--ghost" autoFocus onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
