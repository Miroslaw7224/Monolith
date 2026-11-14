"use client";

import React from "react";

/** D12: `bugs.md` nie ma pola blokera, więc radar jest stanem pustym bez wymyślonych danych. */
export function MapBlockersPanel() {
  return (
    <section className="map-panel" aria-labelledby="map-blockers-title">
      <header className="map-panel__head">
        <h2 id="map-blockers-title" className="map-panel__title">
          Radar blokad
        </h2>
        <span className="chip">wkrótce</span>
      </header>
      <p className="map-panel__empty">
        Blokery pojawią się, gdy pliki bugs.md dostaną pole blokera. Do tego czasu radar jest pusty.
      </p>
    </section>
  );
}
