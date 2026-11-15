"use client";

import React from "react";
import { useT } from "@/src/i18n/useT";

/** Przyciski powiększenia w rogu płótna globusa. */
export function GlobeControls(props: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  const t = useT();
  return (
    <div className="map-zoom" role="group" aria-label={t("map:mapZoomGroupAria")}>
      <button
        type="button"
        aria-label={t("map:mapZoomOutAria")}
        title={t("map:mapZoomOutTitle")}
        onClick={props.onZoomOut}
      >
        −
      </button>
      <button
        type="button"
        aria-label={t("map:mapZoomInAria")}
        title={t("map:mapZoomInTitle")}
        onClick={props.onZoomIn}
      >
        +
      </button>
      <button
        type="button"
        aria-label={t("map:mapFitAria")}
        title={t("map:mapFitTitle")}
        onClick={props.onFit}
      >
        {t("map:mapFitButton")}
      </button>
      <span aria-live="polite">{Math.round(props.zoom * 100)}%</span>
    </div>
  );
}
