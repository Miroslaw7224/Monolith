"use client";

import React, { useState } from "react";
import type { CodeSyncDto } from "@/contexts/bc_projects/schemas";
import { useT } from "@/src/i18n/useT";
import type { MutationResult } from "./mutation";

/** Krótki znacznik przy projekcie na liście; `current`, `no-baseline` i brak danych nie są alarmem. */
export function CodeSyncMarker(props: { sync: CodeSyncDto | undefined }): React.JSX.Element | null {
  const { sync } = props;
  const t = useT();
  if (sync === undefined) return null;
  if (sync.status === "behind") {
    return (
      <span className="prj-item__sync">
        {t("projects:codeSync.listBehind", { count: sync.ahead })}
      </span>
    );
  }
  if (sync.status === "diverged") {
    return <span className="prj-item__sync">{t("projects:codeSync.listDiverged")}</span>;
  }
  if (sync.status === "unknown-sha") {
    return <span className="prj-item__sync">{t("projects:codeSync.listUnknown")}</span>;
  }
  return null;
}

/** Blok „Stan względem kodu” w teczce projektu: opis stanu, paczka „odśwież kartę”, oznaczenie karty. */
export function ProjectCodeSync(props: {
  sync: CodeSyncDto | undefined;
  /** `commit`: pełny sha z `head`; `undefined` = serwer weźmie HEAD (stan `no-baseline`). */
  onMark: (commit?: string) => Promise<MutationResult>;
  onShowPack: () => void;
}): React.JSX.Element | null {
  const { sync, onMark, onShowPack } = props;
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sync === undefined) return null;

  const head = "head" in sync ? sync.head : undefined;
  const short = head?.slice(0, 7) ?? "";
  const text =
    sync.status === "behind"
      ? t("projects:codeSync.behind", { count: sync.ahead, head: short })
      : sync.status === "diverged"
        ? t("projects:codeSync.diverged", { head: short })
        : sync.status === "current"
          ? t("projects:codeSync.current", { head: short })
          : sync.status === "unknown-sha"
            ? t("projects:codeSync.unknownSha")
            : sync.status === "no-baseline"
              ? t("projects:codeSync.noBaseline")
              : t("projects:codeSync.unavailable");

  const canMark = sync.status !== "current" && sync.status !== "unavailable";
  const canShowPack = sync.status !== "unavailable";

  const mark = async () => {
    setBusy(true);
    setError(null);
    const result = await onMark(head);
    setBusy(false);
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
    if (result.ok === false) setError(result.error);
  };

  return (
    <article className="prj-card" aria-label={t("projects:codeSync.title")}>
      <h3 className="prj-section-title">{t("projects:codeSync.title")}</h3>
      <p>{text}</p>
      <p className="prj-pack__note">{t("projects:codeSync.note")}</p>
      <div className="prj-form__actions">
        {canShowPack ? (
          <button type="button" className="prj-btn" onClick={onShowPack}>
            {t("projects:codeSync.showPack")}
          </button>
        ) : null}
        {canMark ? (
          <button type="button" className="prj-btn" disabled={busy} onClick={mark}>
            {t("projects:codeSync.mark")}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="prj-alert" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
