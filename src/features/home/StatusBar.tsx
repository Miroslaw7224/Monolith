// src/features/home/StatusBar.tsx
import React from "react";
import { hhmm } from "./cockpitFormat";

export interface StatusBarProps {
  /** Id pierwszego aktywnego tematu; `null` ukrywa pozycję „projekt”. */
  projectId: string | null;
  warningsCount: number;
  now: Date;
}

export function StatusBar({ projectId, warningsCount, now }: StatusBarProps) {
  const ok = warningsCount === 0;
  return (
    <footer className="kok-statusbar" aria-label="Pasek statusu">
      <div className="kok-statusbar__left">
        {projectId ? (
          <span>
            projekt <b>{projectId}</b>
          </span>
        ) : null}
        <span className={`kok-statusbar__vault ${ok ? "is-ok" : "is-warn"}`}>
          <i aria-hidden="true" />
          vault <b>{ok ? "zsynchronizowany" : `${warningsCount} ostrzeżeń`}</b>
        </span>
      </div>
      <div className="kok-statusbar__right">
        <span>Alt+1…9 karty · Ctrl+K polecenia</span>
        <b>{hhmm(now.getHours() * 60 + now.getMinutes())}</b>
      </div>
    </footer>
  );
}
