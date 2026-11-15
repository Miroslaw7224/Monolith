// src/features/home/StatusBar.tsx
import React from "react";
import { useT } from "@/src/i18n/useT";
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
  const t = useT();
  const ok = warningsCount === 0;
  return (
    <footer className="kok-statusbar" aria-label={t("shell:statusbar.aria")}>
      <div className="kok-statusbar__left">
        {projectId ? (
          <span>
            {t("shell:statusbar.project")} <b>{projectId}</b>
          </span>
        ) : null}
        {branch ? (
          <span>
            {t("shell:statusbar.branch")} <b>{branch}</b>
          </span>
        ) : null}
        <span className={`kok-statusbar__vault ${ok ? "is-ok" : "is-warn"}`}>
          <i aria-hidden="true" />
          {t("shell:statusbar.vault")}{" "}
          <b>
            {ok
              ? t("shell:statusbar.synced")
              : t("shell:statusbar.warnings", { count: warningsCount })}
          </b>
        </span>
      </div>
      <div className="kok-statusbar__right">
        <span>{t("shell:statusbar.hints")}</span>
        <b>{hhmm(now.getHours() * 60 + now.getMinutes())}</b>
      </div>
    </footer>
  );
}
