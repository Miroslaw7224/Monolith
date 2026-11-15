"use client";

import React, { useCallback, useMemo, useState } from "react";
import "./map.css";
import { EDGE_CLASSES } from "./edgeColors";
import { Globe } from "./Globe";
import { MapAgentsPanel } from "./MapAgentsPanel";
import { MapBlockersPanel } from "./MapBlockersPanel";
import { MapClusterPanel } from "./MapClusterPanel";
import { MapNodeList } from "./MapNodeList";
import { buildMapTiles } from "./mapTiles";
import { useMapAgents } from "./useMapAgents";
import { useMapGraph } from "./useMapGraph";
import type { MapSelection } from "./selection";
import { useT } from "@/src/i18n/useT";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

export function MapView({
  apiFetch,
  onOpenProject,
}: {
  apiFetch: ApiFetch;
  onOpenProject: (id: string) => void;
}) {
  const t = useT();
  const graph = useMapGraph(apiFetch);
  const agents = useMapAgents(apiFetch);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null);
  const [listFocused, setListFocused] = useState(false);

  const clusters = useMemo(() => graph.graph?.clusters ?? [], [graph.graph]);
  const projectNames = useMemo(
    () =>
      Object.fromEntries(
        clusters.flatMap((c) => (c.projectId ? [[c.projectId, c.label] as const] : []))
      ),
    [clusters]
  );

  /** Globus, panel i lista robią to samo: zaznacz, obróć; skupisko projektu dodatkowo otwiera kartę Projekty. */
  const activate = useCallback(
    (sel: MapSelection) => {
      setSelection(sel);
      setFocus((f) => ({ id: sel.id, tick: (f?.tick ?? 0) + 1 }));
      if (sel.kind === "cluster") {
        const projectId = graph.graph?.clusters.find((c) => c.id === sel.id)?.projectId;
        if (projectId) onOpenProject(projectId);
      }
    },
    [graph.graph, onOpenProject]
  );

  if (graph.status === "loading") {
    return (
      <section className="map" aria-busy="true">
        <p className="map-panel__empty">{t("map:mapLoading")}</p>
      </section>
    );
  }
  if (graph.status === "error") {
    return (
      <section className="map">
        <p role="alert" className="map-panel__empty">
          {t("map:mapLoadFailed", { error: graph.error })}
        </p>
      </section>
    );
  }

  const data = graph.graph;
  const tiles = buildMapTiles(data, { available: agents.available, count: agents.agents.length });
  const selectedCluster =
    selection?.kind === "cluster"
      ? (data.clusters.find((c) => c.id === selection.id) ?? null)
      : null;
  const selectedNote =
    selection?.kind === "note" ? (data.nodes.find((n) => n.id === selection.id) ?? null) : null;
  const caption = selectedCluster
    ? selectedCluster.soon
      ? t("map:mapCaptionSoon", { label: selectedCluster.label })
      : t("map:mapCaptionNotes", { label: selectedCluster.label, count: selectedCluster.size })
    : (selectedNote?.label ?? null);

  return (
    <section className="map" aria-labelledby="map-title">
      <header className="map-head">
        <h1 id="map-title" className="map-head__title">
          {t("map:mapTitle")}
        </h1>
        <p className="map-head__sub">{t("map:mapSubtitle")}</p>
      </header>

      <div className="map-tiles">
        {tiles.map((tile) => (
          <div key={tile.id} className="map-tile">
            <div className="map-tile__label">{tile.label}</div>
            <div className="map-tile__value">{tile.value}</div>
            <div className="map-tile__meta">{tile.meta}</div>
          </div>
        ))}
      </div>

      <div className="map-layout">
        <div
          className="map-stage"
          onFocusCapture={() => setListFocused(true)}
          onBlurCapture={() => setListFocused(false)}
        >
          <div className="map-canvas">
            <Globe
              clusters={data.clusters}
              nodes={data.nodes}
              edges={data.edges}
              clusterEdges={data.clusterEdges}
              selection={selection}
              focus={focus}
              paused={listFocused}
              onSelect={activate}
              ariaLabel={t("map:mapGlobeSummaryAria", {
                clusters: data.clusters.length,
                notes: data.nodes.length,
                edges: data.edges.length,
              })}
            />
            {caption ? (
              <div className="map-caption" aria-live="polite">
                {caption}
              </div>
            ) : null}
          </div>
          <ul className="map-legend" aria-label={t("map:mapLegendAria")}>
            {EDGE_CLASSES.map((cls) => (
              <li key={cls.id} className="map-legend-item">
                <span className="map-legend-line" style={{ borderTopColor: cls.color }} />
                {t(cls.labelKey)}
              </li>
            ))}
          </ul>
          <p className="map-legend-note">{t("map:mapLegendNote")}</p>
          <MapNodeList
            clusters={data.clusters}
            selectedId={selection?.kind === "cluster" ? selection.id : null}
            onSelect={(id) => activate({ kind: "cluster", id })}
          />
        </div>

        <aside className="map-sidebar">
          <MapClusterPanel
            clusters={data.clusters}
            nodes={data.nodes}
            edges={data.edges}
            selection={selection}
            onSelect={activate}
          />
          <MapAgentsPanel
            available={agents.available}
            agents={agents.agents}
            loading={agents.loading}
            projectNames={projectNames}
            onRefresh={() => void agents.refresh()}
          />
          <MapBlockersPanel />
        </aside>
      </div>

      {data.warnings.length > 0 ? (
        <ul className="map-warnings" aria-label={t("map:mapWarningsAria")}>
          {data.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
