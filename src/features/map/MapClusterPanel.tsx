"use client";

import React from "react";
import type { MapClusterDto, MapEdgeDto, MapNodeDto } from "@/contexts/bc_map/schemas";
import { noteNeighbors, type MapSelection } from "./selection";

const MAX_NEIGHBORS = 30;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Panel zaznaczenia: lista notatek skupiska albo szczegóły notatki z jej sąsiadami. */
export function MapClusterPanel(props: {
  clusters: MapClusterDto[];
  nodes: MapNodeDto[];
  edges: MapEdgeDto[];
  selection: MapSelection | null;
  onSelect: (s: MapSelection) => void;
}) {
  const { clusters, nodes, edges, selection, onSelect } = props;
  const pickNote = (id: string) => onSelect({ kind: "note", id });

  if (selection === null) {
    return (
      <section className="map-cluster-panel map-panel" aria-label="Zaznaczenie">
        <p className="map-panel__empty">Wybierz skupisko lub punkt na globusie.</p>
      </section>
    );
  }

  if (selection.kind === "cluster") {
    const cluster = clusters.find((c) => c.id === selection.id);
    if (!cluster) return null;
    const notes = nodes
      .filter((n) => n.cluster === cluster.id)
      .sort((a, b) => b.links - a.links || cmp(a.label, b.label) || cmp(a.id, b.id));
    return (
      <section className="map-cluster-panel map-panel" aria-label="Zaznaczenie">
        <h2 className="map-panel__title">{cluster.label}</h2>
        {cluster.soon ? (
          <p className="map-panel__empty">Kontynent wkrótce: bez notatek i powiązań.</p>
        ) : (
          <>
            <p className="map-panel__empty">{cluster.size} notatek</p>
            <ul>
              {notes.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => pickNote(n.id)}>
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    );
  }

  const note = nodes.find((n) => n.id === selection.id);
  if (!note) return null;
  const cluster = clusters.find((c) => c.id === note.cluster);
  const neighbors = noteNeighbors(note.id, nodes, edges).slice(0, MAX_NEIGHBORS);
  return (
    <section className="map-cluster-panel map-panel" aria-label="Zaznaczenie">
      <h2 className="map-panel__title">{note.label}</h2>
      <p className="map-panel__empty">Skupisko: {cluster?.label ?? note.cluster}</p>
      <p className="map-panel__empty">Powiązania: {note.links}</p>
      {neighbors.length > 0 ? (
        <ul>
          {neighbors.map((nb) => (
            <li key={nb.id}>
              <button type="button" onClick={() => pickNote(nb.id)}>
                {nb.label}
                {nb.weight > 1 ? ` (${nb.weight})` : ""}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
