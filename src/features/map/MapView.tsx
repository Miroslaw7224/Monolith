"use client";

import React, { useCallback, useMemo, useState } from "react";
import "./map.css";
import { Globe } from "./Globe";
import { MapAgentsPanel } from "./MapAgentsPanel";
import { MapBlockersPanel } from "./MapBlockersPanel";
import { MapNodeList } from "./MapNodeList";
import { buildMapTiles } from "./mapTiles";
import { useMapAgents } from "./useMapAgents";
import { useMapGraph } from "./useMapGraph";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null);
  const [listFocused, setListFocused] = useState(false);

  const nodes = useMemo(() => graph.graph?.nodes ?? [], [graph.graph]);
  const projectNames = useMemo(
    () => Object.fromEntries(nodes.filter((n) => n.kind === "project").map((n) => [n.id, n.label])),
    [nodes]
  );

  /** Globus i lista robią to samo: zaznacz, obróć; projekt dodatkowo otwiera kartę Projekty. */
  const activate = useCallback(
    (id: string) => {
      setSelectedId(id);
      setFocus((f) => ({ id, tick: (f?.tick ?? 0) + 1 }));
      if (graph.graph?.nodes.find((n) => n.id === id)?.kind === "project") onOpenProject(id);
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
  const selected = data.nodes.find((n) => n.id === selectedId) ?? null;
  const projectsCount = data.nodes.filter((n) => n.kind === "project").length;
  const continentsCount = data.nodes.length - projectsCount;
  const caption =
    selected === null
      ? null
      : selected.soon
        ? `${selected.label}: wkrótce`
        : selected.kind === "continent"
          ? `${selected.label}: ${selected.size ?? 0} plików`
          : selected.label;

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
              nodes={data.nodes}
              edges={data.edges}
              selectedId={selectedId}
              focus={focus}
              paused={listFocused}
              onSelect={activate}
              ariaLabel={`Globus sieci NEXUS: ${projectsCount} projektów, ${continentsCount} kontynenty, ${data.edges.length} połączeń`}
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
              współdzielenie (komponenty, wiedza)
            </li>
            <li className="map-legend-item">Skille: bez powiązań (placeholder)</li>
          </ul>
          <MapNodeList nodes={data.nodes} selectedId={selectedId} onSelect={activate} />
        </div>

        <aside className="map-sidebar">
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
