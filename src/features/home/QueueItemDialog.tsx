// src/features/home/QueueItemDialog.tsx
import React from "react";
import type { QueueGroupDto } from "@/contexts/bc_cockpit/schemas";

export type QueueItemView = QueueGroupDto["items"][number];

const KIND_TEXT: Record<QueueItemView["kind"], string> = {
  today: "termin: dziś",
  overdue: "zaległe",
  now: "w kolumnie „Teraz”",
  undated: "bez terminu",
};

/** Podgląd pozycji kolejki: szczegóły, domknięcie i skok do karty, w której zadanie żyje. */
export function QueueItemDialog({
  item,
  groupName,
  projectId,
  busy,
  error,
  onComplete,
  onOpenProject,
  onOpenTasks,
  onClose,
}: {
  item: QueueItemView;
  groupName: string;
  /** `null` dla zadania ogólnego. */
  projectId: string | null;
  busy: boolean;
  error: string | null;
  onComplete: () => void;
  onOpenProject: (id: string) => void;
  onOpenTasks: () => void;
  onClose: () => void;
}) {
  return (
    <div className="kok-overlay">
      <div role="dialog" aria-label="Podgląd zadania" className="kok-modal">
        <div className="kok-modal__head">
          <h3 className="kok-modal__title">{item.title}</h3>
          <p className="kok-modal__sub">{groupName}</p>
        </div>
        <dl className="kok-preview">
          <div>
            <dt>Status</dt>
            <dd>
              {KIND_TEXT[item.kind]}
              {item.kind === "overdue" && item.due ? ` (${item.due})` : null}
            </dd>
          </div>
          {item.priority ? (
            <div>
              <dt>Priorytet projektu</dt>
              <dd>{item.priority}</dd>
            </div>
          ) : null}
          {item.energy ? (
            <div>
              <dt>Energia</dt>
              <dd>
                <span className={`kok-energy kok-energy--${item.energy}`}>{item.energy}</span>
              </dd>
            </div>
          ) : null}
        </dl>
        {error ? (
          <p className="kok-state kok-state--error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="kok-modal__actions">
          <button type="button" onClick={onClose} className="kok-btn kok-btn--ghost">
            Zamknij
          </button>
          {projectId ? (
            <button type="button" className="kok-btn" onClick={() => onOpenProject(projectId)}>
              Otwórz w Projektach
            </button>
          ) : (
            <button type="button" className="kok-btn" onClick={onOpenTasks}>
              Otwórz w Zadaniach
            </button>
          )}
          <button
            type="button"
            className="kok-btn kok-btn--primary"
            disabled={busy}
            onClick={onComplete}
          >
            Oznacz jako zrobione
          </button>
        </div>
      </div>
    </div>
  );
}
