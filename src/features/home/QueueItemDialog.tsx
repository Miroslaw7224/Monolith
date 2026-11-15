// src/features/home/QueueItemDialog.tsx
import React from "react";
import type { QueueGroupDto } from "@/contexts/bc_cockpit/schemas";
import { useT } from "@/src/i18n/useT";
import { EnergySwitch, type EnergyValue } from "./EnergySwitch";

export type QueueItemView = QueueGroupDto["items"][number];

const KIND_LABEL_KEY: Record<
  QueueItemView["kind"],
  `home:queue.kind${Capitalize<QueueItemView["kind"]>}`
> = {
  today: "home:queue.kindToday",
  overdue: "home:queue.kindOverdue",
  upcoming: "home:queue.kindUpcoming",
  now: "home:queue.kindNow",
  undated: "home:queue.kindUndated",
};

/** Podgląd pozycji kolejki: szczegóły, domknięcie i skok do karty, w której zadanie żyje. */
export function QueueItemDialog({
  item,
  groupName,
  projectId,
  busy,
  error,
  onComplete,
  onSetEnergy,
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
  onSetEnergy: (energy: EnergyValue | null) => void;
  onOpenProject: (id: string) => void;
  onOpenTasks: () => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div className="kok-overlay">
      <div role="dialog" aria-label={t("home:queue.aria")} className="kok-modal">
        <div className="kok-modal__head">
          <h3 className="kok-modal__title">{item.title}</h3>
          <p className="kok-modal__sub">{groupName}</p>
        </div>
        <dl className="kok-preview">
          <div>
            <dt>{t("home:queue.status")}</dt>
            <dd>
              {t(KIND_LABEL_KEY[item.kind])}
              {(item.kind === "overdue" || item.kind === "upcoming") && item.due
                ? ` (${item.due})`
                : null}
            </dd>
          </div>
          {item.priority ? (
            <div>
              <dt>{t("home:queue.priority")}</dt>
              <dd>{item.priority}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t("home:queue.energy")}</dt>
            <dd>
              <EnergySwitch
                title={item.title}
                energy={item.energy}
                disabled={busy}
                onChange={onSetEnergy}
              />
            </dd>
          </div>
        </dl>
        {error ? (
          <p className="kok-state kok-state--error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="kok-modal__actions">
          <button type="button" onClick={onClose} className="kok-btn kok-btn--ghost">
            {t("home:queue.close")}
          </button>
          {projectId ? (
            <button type="button" className="kok-btn" onClick={() => onOpenProject(projectId)}>
              {t("home:queue.openProjects")}
            </button>
          ) : (
            <button type="button" className="kok-btn" onClick={onOpenTasks}>
              {t("home:queue.openTasks")}
            </button>
          )}
          <button
            type="button"
            className="kok-btn kok-btn--primary"
            disabled={busy}
            onClick={onComplete}
          >
            {t("home:queue.markDone")}
          </button>
        </div>
      </div>
    </div>
  );
}
