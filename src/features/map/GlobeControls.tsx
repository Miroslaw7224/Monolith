"use client";

import React from "react";

/** Przyciski powiększenia w rogu płótna globusa. */
export function GlobeControls(props: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <div className="map-zoom" role="group" aria-label="Powiększenie">
      <button type="button" aria-label="Oddal" title="Oddal (−)" onClick={props.onZoomOut}>
        −
      </button>
      <button type="button" aria-label="Przybliż" title="Przybliż (+)" onClick={props.onZoomIn}>
        +
      </button>
      <button
        type="button"
        aria-label="Dopasuj do okna"
        title="Dopasuj do okna (0)"
        onClick={props.onFit}
      >
        Dopasuj
      </button>
      <span aria-live="polite">{Math.round(props.zoom * 100)}%</span>
    </div>
  );
}
