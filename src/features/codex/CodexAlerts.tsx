"use client";

import React from "react";
import { useT } from "@/src/i18n/useT";
import type { AlertItem } from "./codexFilters";

/** Nieblokujące ostrzeżenia parsera i dziennika (spec §4.1, §4.2); bez ostrzeżeń nie renderuje nic. */
export function CodexAlerts({ items }: { items: AlertItem[] }) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <section className="kod-alerts" aria-label={t("codex:codexAlertsAria")}>
      <div className="kod-alerts__head">
        <h2 className="kod-alerts__title">{t("codex:codexAlertsTitle")}</h2>
        <span className="chip chip--warn">
          {t("codex:codexAlertsCount", { count: items.length })}
        </span>
      </div>
      <ul className="kod-alerts__list">
        {items.map((item, i) => (
          <li key={`${item.tag}-${i}`} className="kod-alerts__item">
            <span className="kod-alerts__tag">{item.tag}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
