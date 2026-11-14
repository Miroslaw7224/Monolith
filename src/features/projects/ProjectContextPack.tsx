import React, { useState } from "react";
import { PACK_BUDGET_TOKENS } from "@/contexts/bc_projects/schemas";
import { formatTokens, packSections } from "./packSections";
import type { CopyNotice, PackState } from "./useContextPack";

const tokensLabel = (approxTokens: number) =>
  `~${(approxTokens / 1000).toFixed(1).replace(".", ",")} tys. tokenów`;

export type ContextPackModel = {
  state: PackState;
  busy: boolean;
  notice: CopyNotice | null;
  copy: () => Promise<void>;
};

/** Wynik kopiowania: sukces (z liczbą tokenów i ostrzeżeniami) albo błąd. */
function CopyNoticeView(props: { notice: CopyNotice | null }): React.JSX.Element | null {
  const { notice } = props;
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
        Skopiowano paczkę kontekstu ({tokensLabel(pack.approxTokens)})
        {pack.truncated ? " · skrócona do budżetu" : ""}
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
  const size =
    state.status === "ready"
      ? ` (${tokensLabel(state.pack.approxTokens).replace(" tokenów", " tok")})`
      : "";
  return (
    <div className="prj-pack-button">
      <button type="button" className="prj-btn prj-btn--primary" disabled={busy} onClick={copy}>
        Kopiuj paczkę kontekstu{size}
      </button>
      <CopyNoticeView notice={notice} />
    </div>
  );
}

/** Karta „Paczka kontekstu” (makieta 04): budżet tokenów, skład sekcji, kopiowanie i podgląd Markdown. */
export function ProjectContextPack(props: { pack: ContextPackModel }): React.JSX.Element {
  const { state, busy, notice, copy } = props.pack;
  const [preview, setPreview] = useState(false);

  return (
    <article className="prj-card prj-pack-card" aria-label="Paczka kontekstu">
      <div className="prj-card__head">
        <div>
          <h3 className="prj-section-title">Paczka kontekstu · zrzut do LLM</h3>
          <p className="prj-pack-card__sub">
            Prompt startowy dla agenta, składany na żywo z Save State, gita, zadań, bugów i devlogu.
          </p>
        </div>
        {state.status === "ready" ? (
          <div className="prj-pack-card__budget">
            <span>
              {formatTokens(state.pack.approxTokens)} / {formatTokens(PACK_BUDGET_TOKENS)} tokenów
            </span>
            <small>
              Wykorzystanie okna: {Math.round((state.pack.approxTokens / PACK_BUDGET_TOKENS) * 100)}
              %
            </small>
          </div>
        ) : null}
      </div>

      {state.status === "loading" ? <p className="prj-state">Składam paczkę…</p> : null}
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
            aria-label="Budżet paczki kontekstu"
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
            <p className="prj-pack__note">Paczka skrócona do budżetu.</p>
          ) : null}
          {state.pack.warnings.length > 0 ? (
            <p className="prj-pack__note">{state.pack.warnings.join(" · ")}</p>
          ) : null}
        </>
      ) : null}

      <div className="prj-form__actions">
        <button type="button" className="prj-btn prj-btn--primary" disabled={busy} onClick={copy}>
          Kopiuj paczkę kontekstu
        </button>
        {state.status === "ready" ? (
          <button
            type="button"
            className="prj-btn"
            aria-expanded={preview}
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? "Ukryj podgląd" : "Podgląd Markdown"}
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
