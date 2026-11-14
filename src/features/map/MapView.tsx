"use client";

import React, { useCallback, useMemo, useState } from "react";
import "./map.css";
import { Globe } from "./Globe";
import { MapAgentsPanel } from "./MapAgentsPanel";
import { MapBlockersPanel } from "./MapBlockersPanel";
import { MapClusterPanel } from "./MapClusterPanel";
import { MapNodeList } from "./MapNodeList";
import { buildMapTiles } from "./mapTiles";
import { useMapAgents } from "./useMapAgents";
import { useMapGraph } from "./useMapGraph";
import type { MapSelection } from "./selection";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

export function MapView({
  apiFetch,
  onOpenProject,
}: {
  apiFetch: ApiFetch;
  onOpenProject: (id: string) => void;
}) {
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
        <p className="map-panel__empty">Wczytywanie mapy…</p>
      </section>
    );
  }
  if (graph.status === "error") {
    return (
      <section className="map">
        <p role="alert" className="map-panel__empty">
          Nie udało się wczytać mapy: {graph.error}
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
      ? `${selectedCluster.label}: wkrótce`
      : `${selectedCluster.label}: ${selectedCluster.size} notatek`
    : (selectedNote?.label ?? null);

  return (
    <section className="map" aria-labelledby="map-title">
      <header className="map-head">
        <h1 id="map-title" className="map-head__title">
          Mapa
        </h1>
        <p className="map-head__sub">Sieć NEXUS: projekty, wiedza i agenci.</p>
      </header>

      <div className="map-tiles">
        {tiles.map((t) => (
          <div key={t.id} className="map-tile">
            <div className="map-tile__label">{t.label}</div>
            <div className="map-tile__value">{t.value}</div>
            <div className="map-tile__meta">{t.meta}</div>
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
              ariaLabel={`Globus sieci NEXUS: ${data.clusters.length} skupisk, ${data.nodes.length} notatek, ${data.edges.length} połączeń`}
            />
            {caption ? (
              <div className="map-caption" aria-live="polite">
                {caption}
              </div>
            ) : null}
          </div>
          <ul className="map-legend" aria-label="Legenda">
            <li className="map-legend-item">
              <span className="map-legend-line map-legend-line--shared" />
              linia: link między notatkami (po najechaniu lub kliknięciu jaśniejsza)
            </li>
            <li className="map-legend-item">Skille: wkrótce, bez powiązań</li>
          </ul>
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
        <ul className="map-warnings" aria-label="Ostrzeżenia">
          {data.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
