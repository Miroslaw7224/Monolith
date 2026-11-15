"use client";

import React from "react";
import { useT } from "@/src/i18n/useT";

/** D12: `bugs.md` nie ma pola blokera, więc radar jest stanem pustym bez wymyślonych danych. */
export function MapBlockersPanel() {
  const t = useT();
  return (
    <section className="map-panel" aria-labelledby="map-blockers-title">
      <header className="map-panel__head">
        <h2 id="map-blockers-title" className="map-panel__title">
          {t("map:mapBlockersTitle")}
        </h2>
        <span className="chip">{t("map:mapSoon")}</span>
      </header>
      <p className="map-panel__empty">{t("map:mapBlockersEmpty")}</p>
    </section>
  );
}
