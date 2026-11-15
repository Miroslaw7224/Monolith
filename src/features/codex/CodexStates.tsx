"use client";

import React from "react";
import { useT } from "@/src/i18n/useT";
import { CODEX_TEMPLATE } from "./codexTemplate";

export function CodexMissing({ onCopy, path }: { onCopy: (text: string) => void; path: string }) {
  const t = useT();
  return (
    <div className="kod-state-view is-visible">
      <div className="kod-empty-box">
        <h2 className="kod-empty-box__title">{t("codex:codexMissingTitle")}</h2>
        <p className="kod-empty-box__desc">
          {t("codex:codexMissingDescLead")}
          <code>Vault/{path}</code>
          {t("codex:codexMissingDescTrail")}
        </p>
        <pre className="kod-codeblock">{CODEX_TEMPLATE}</pre>
        <div className="row" style={{ gap: "var(--s-3)" }}>
          <button type="button" className="btn btn--primary" onClick={() => onCopy(CODEX_TEMPLATE)}>
            {t("codex:codexCopyCreateInstruction")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CodexConfigError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="kod-state-view is-visible">
      <div className="kod-empty-box kod-error-box">
        <h2 className="kod-empty-box__title" style={{ color: "var(--danger)" }}>
          {t("codex:codexConfigErrorTitle")}
        </h2>
        <p className="kod-empty-box__desc">{message}</p>
        <pre className="kod-codeblock">
          {
            "# Sprawdź plik .env.local w katalogu Monolith:\nNEXUS_VAULT_PATH=/bezwzględna/ścieżka/do/NEXUS/Vault\n# W WSL upewnij się, że dysk Windows jest zamontowany (ls /mnt/c)."
          }
        </pre>
        <div className="row" style={{ gap: "var(--s-3)" }}>
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            {t("codex:codexRetryConnection")}
          </button>
        </div>
      </div>
    </div>
  );
}
