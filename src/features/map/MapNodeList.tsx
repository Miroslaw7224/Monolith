"use client";

import React from "react";
import type { MapClusterDto } from "@/contexts/bc_map/schemas";

function describe(cluster: MapClusterDto): string {
  if (cluster.soon) return `${cluster.label} (wkrótce)`;
  return `${cluster.label}, ${cluster.size} notatek`;
}

/** Dostępna z klawiatury (Tab, Enter) alternatywa dla globusa na canvasie: lista skupisk. */
export function MapNodeList(props: {
  clusters: MapClusterDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="map-nodelist" aria-label="Skupiska sieci NEXUS">
      {props.clusters.map((cluster) => (
        <li key={cluster.id}>
          <button
            type="button"
            className="map-nodelist__item"
            aria-current={props.selectedId === cluster.id ? "true" : undefined}
            onClick={() => props.onSelect(cluster.id)}
          >
            {describe(cluster)}
          </button>
        </li>
      ))}
    </ul>
  );
}
