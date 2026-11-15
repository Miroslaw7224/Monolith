// src/features/home/ClosingAnchor.tsx
import React from "react";
import type { ClosingDto } from "@/contexts/bc_cockpit/schemas";
import { useT } from "@/src/i18n/useT";
import { anchorLabel } from "./cockpitFormat";

/** Pasek „Zaczep z wczoraj”: zdanie z ostatniego zamknięcia dnia + skok do tematu. */
export function ClosingAnchor({
  anchor,
  today,
  onOpenProject,
}: {
  anchor: ClosingDto;
  today: Date;
  onOpenProject: (id: string) => void;
}) {
  const t = useT();
  const label = anchorLabel(anchor.date, today);
  return (
    <div className="kok-anchor" role="group" aria-label={label}>
      <span className="kok-anchor__label">{label}</span>
      <span className="kok-anchor__text">{anchor.text}</span>
      {anchor.projectId ? (
        <button
          type="button"
          className="kok-btn kok-btn--sm"
          onClick={() => onOpenProject(anchor.projectId as string)}
        >
          {t("home:anchor.enterTopic")}
        </button>
      ) : null}
    </div>
  );
}
