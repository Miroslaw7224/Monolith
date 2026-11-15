"use client";

import React, { useState } from "react";
import {
  PACK_BUDGET_TOKENS,
  PACK_ROLES,
  type ContextPackRole,
} from "@/contexts/bc_projects/schemas";
import { useT } from "@/src/i18n/useT";
import { formatTokens, packSections } from "./packSections";
import { packButtonSizeSuffix, tokensThousandLabel } from "./projectsFormat";
import type { CopyNotice, PackState } from "./useContextPack";

export type ContextPackModel = {
  state: PackState;
  busy: boolean;
  notice: CopyNotice | null;
  copy: () => Promise<void>;
  role: ContextPackRole;
  setRole: (role: ContextPackRole) => void;
};

/** Wynik kopiowania: sukces (z liczbą tokenów i ostrzeżeniami) albo błąd. */
function CopyNoticeView(props: { notice: CopyNotice | null }): React.JSX.Element | null {
  const { notice } = props;
  const t = useT();
  if (notice === null) return null;
  if (notice.kind === "error") {
    return (
      <p className="prj-alert" role="alert">
        {notice.error}
      </p>
    );
  }
  const { pack } = notice;
  return (
    <>
      <p className="prj-pack__note" role="status">
        {t("projects:pack.copied", { label: tokensThousandLabel(pack.approxTokens) })}
        {pack.truncated ? t("projects:pack.copiedTruncated") : ""}
      </p>
      {pack.warnings.length > 0 ? (
        <p className="prj-pack__note" role="status">
          {pack.warnings.join(" · ")}
        </p>
      ) : null}
    </>
  );
}

/** Przycisk w nagłówku karty: kopiuje paczkę wybranego projektu (pełny opis i budżet są w karcie na dole teczki). */
export function ProjectContextPackButton(props: { pack: ContextPackModel }): React.JSX.Element {
  const { state, busy, notice, copy } = props.pack;
  const t = useT();
  const size = state.status === "ready" ? packButtonSizeSuffix(state.pack.approxTokens) : "";
  return (
    <div className="prj-pack-button">
      <button type="button" className="prj-btn prj-btn--primary" disabled={busy} onClick={copy}>
        {`${t("projects:pack.copy")}${size}`}
      </button>
      <CopyNoticeView notice={notice} />
    </div>
  );
}

/** Karta „Paczka kontekstu” (makieta 04): budżet tokenów, skład sekcji, kopiowanie i podgląd Markdown. */
export function ProjectContextPack(props: { pack: ContextPackModel }): React.JSX.Element {
  const { state, busy, notice, copy, role, setRole } = props.pack;
  const t = useT();
  const [preview, setPreview] = useState(false);

  return (
    <article className="prj-card prj-pack-card" aria-label={t("projects:pack.cardAria")}>
      <div className="prj-card__head">
        <div>
          <h3 className="prj-section-title">{t("projects:pack.title")}</h3>
          <p className="prj-pack-card__sub">{t("projects:pack.subtitle")}</p>
        </div>
        {state.status === "ready" ? (
          <div className="prj-pack-card__budget">
            <span>
              {t("projects:pack.budgetLine", {
                used: formatTokens(state.pack.approxTokens),
                budget: formatTokens(PACK_BUDGET_TOKENS),
              })}
            </span>
            <small>
              {t("projects:pack.windowUse", {
                percent: Math.round((state.pack.approxTokens / PACK_BUDGET_TOKENS) * 100),
              })}
            </small>
          </div>
        ) : null}
      </div>

      <div className="prj-pack-card__roles" role="group" aria-label={t("projects:pack.rolesAria")}>
        {PACK_ROLES.map(({ key }) => (
          <button
            key={key}
            type="button"
            className={role === key ? "prj-btn prj-btn--primary" : "prj-btn"}
            aria-pressed={role === key}
            onClick={() => setRole(key)}
          >
            {t(`projects:pack.role.${key}`)}
          </button>
        ))}
      </div>

      {state.status === "loading" ? (
        <p className="prj-state">{t("projects:pack.loading")}</p>
      ) : null}
      {state.status === "error" ? (
        <p className="prj-alert" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <>
          <div
            className="prj-progress"
            role="progressbar"
            aria-label={t("projects:pack.progressAria")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(
              100,
              Math.round((state.pack.approxTokens / PACK_BUDGET_TOKENS) * 100)
            )}
          >
            <span
              style={{
                width: `${Math.min(100, (state.pack.approxTokens / PACK_BUDGET_TOKENS) * 100)}%`,
              }}
            />
          </div>
          <ul className="prj-pack-card__sections">
            {packSections(state.pack.markdown).map((section) => (
              <li key={section.name} className="prj-section-chip">
                <span className="prj-section-chip__name">{section.name}</span>
                <span className="prj-section-chip__tok">{formatTokens(section.tokens)} tok</span>
              </li>
            ))}
          </ul>
          {state.pack.truncated ? (
            <p className="prj-pack__note">{t("projects:pack.truncatedNote")}</p>
          ) : null}
          {state.pack.warnings.length > 0 ? (
            <p className="prj-pack__note">{state.pack.warnings.join(" · ")}</p>
          ) : null}
        </>
      ) : null}

      <div className="prj-form__actions">
        <button type="button" className="prj-btn prj-btn--primary" disabled={busy} onClick={copy}>
          {t("projects:pack.copy")}
        </button>
        {state.status === "ready" ? (
          <button
            type="button"
            className="prj-btn"
            aria-expanded={preview}
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? t("projects:pack.previewHide") : t("projects:pack.previewShow")}
          </button>
        ) : null}
      </div>
      {preview && state.status === "ready" ? (
        <pre className="prj-pack-card__preview">{state.pack.markdown}</pre>
      ) : null}
      <CopyNoticeView notice={notice} />
    </article>
  );
}
