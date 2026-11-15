// src/features/home/InboxItemDialog.tsx
import React, { useState } from "react";
import type { InboxItemDto, MoveInboxBody } from "@/contexts/bc_inbox/schemas";
import { useT } from "@/src/i18n/useT";
import { inboxTypeLabel } from "./inboxType";
import { InboxMoveForm } from "./InboxMoveForm";

/**
 * Pełny wpis inboxu z akcjami: „Gotowe” (zostaje w pliku jako `[x]`), „Usuń” (znika z pliku)
 * albo „Przenieś do…” (zadanie projektu, zadanie ogólne, notatka).
 */
export function InboxItemDialog({
  item,
  apiFetch,
  busy,
  error,
  onResolve,
  onDelete,
  onMove,
  onClose,
}: {
  item: InboxItemDto;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  busy: boolean;
  error: string | null;
  onResolve: () => void;
  onDelete: () => void;
  onMove: (body: MoveInboxBody) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [moving, setMoving] = useState(false);
  return (
    <div className="kok-overlay">
      <div role="dialog" aria-label={t("home:inbox.itemAria")} className="kok-modal">
        <div className="kok-modal__head">
          <h3 className="kok-modal__title">{t("home:inbox.itemTitle")}</h3>
          <p className="kok-modal__sub">
            {inboxTypeLabel(item.type)}
            {item.at ? ` · ${item.at.replace("T", " ")}` : ""}
          </p>
        </div>
        {moving ? (
          <InboxMoveForm
            item={item}
            apiFetch={apiFetch}
            busy={busy}
            error={error}
            onSubmit={onMove}
            onCancel={() => setMoving(false)}
          />
        ) : (
          <>
            <p className="kok-inbox__full">{item.text}</p>
            {error ? (
              <p className="kok-state kok-state--error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="kok-modal__actions">
              <button type="button" onClick={onClose} className="kok-btn kok-btn--ghost">
                {t("home:inbox.close")}
              </button>
              <button
                type="button"
                className="kok-btn"
                disabled={busy}
                onClick={() => setMoving(true)}
              >
                {t("home:inbox.moveOpen")}
              </button>
              <button type="button" className="kok-btn" disabled={busy} onClick={onResolve}>
                {t("home:inbox.done")}
              </button>
              <button
                type="button"
                className="kok-btn kok-btn--danger"
                disabled={busy}
                onClick={onDelete}
              >
                {t("home:inbox.delete")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
