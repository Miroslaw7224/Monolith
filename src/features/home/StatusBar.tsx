// src/features/home/StatusBar.tsx
import React from "react";
import { hhmm } from "./cockpitFormat";

export interface StatusBarProps {
  /** Id pierwszego aktywnego tematu; `null` ukrywa pozycję „projekt”. */
  projectId: string | null;
  /** Bieżąca gałąź repozytorium pierwszego tematu (z gita); `null` ukrywa pozycję „branch”. */
  branch?: string | null;
  warningsCount: number;
  now: Date;
}

export function StatusBar({ projectId, branch = null, warningsCount, now }: StatusBarProps) {
  const ok = warningsCount === 0;
  return (
    <footer className="kok-statusbar" aria-label="Pasek statusu">
      <div className="kok-statusbar__left">
        {projectId ? (
          <span>
            projekt <b>{projectId}</b>
          </span>
        ) : null}
        {branch ? (
          <span>
            branch <b>{branch}</b>
          </span>
        ) : null}
        <span className={`kok-statusbar__vault ${ok ? "is-ok" : "is-warn"}`}>
          <i aria-hidden="true" />
          vault <b>{ok ? "zsynchronizowany" : `${warningsCount} ostrzeżeń`}</b>
        </span>
      </div>
      <div className="kok-statusbar__right">
        <span>Alt+1…9 karty · Alt+I inbox · Ctrl+K polecenia</span>
        <b>{hhmm(now.getHours() * 60 + now.getMinutes())}</b>
      </div>
    </footer>
  );
}
