// src/features/home/InboxItemDialog.tsx
import React from "react";
import type { InboxItemDto } from "@/contexts/bc_inbox/schemas";

/** Pełny wpis inboxu z akcjami: „Gotowe” (zostaje w pliku jako `[x]`) albo „Usuń” (znika z pliku). */
export function InboxItemDialog({
  item,
  busy,
  error,
  onResolve,
  onDelete,
  onClose,
}: {
  item: InboxItemDto;
  busy: boolean;
  error: string | null;
  onResolve: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="kok-overlay">
      <div role="dialog" aria-label="Wpis z inboxu" className="kok-modal">
        <div className="kok-modal__head">
          <h3 className="kok-modal__title">Wpis z inboxu</h3>
          <p className="kok-modal__sub">
            {item.type}
            {item.at ? ` · ${item.at.replace("T", " ")}` : ""}
          </p>
        </div>
        <p className="kok-inbox__full">{item.text}</p>
        {error ? (
          <p className="kok-state kok-state--error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="kok-modal__actions">
          <button type="button" onClick={onClose} className="kok-btn kok-btn--ghost">
            Zamknij
          </button>
          <button type="button" className="kok-btn" disabled={busy} onClick={onResolve}>
            Gotowe
          </button>
          <button
            type="button"
            className="kok-btn kok-btn--danger"
            disabled={busy}
            onClick={onDelete}
          >
            Usuń
          </button>
        </div>
      </div>
    </div>
  );
}
