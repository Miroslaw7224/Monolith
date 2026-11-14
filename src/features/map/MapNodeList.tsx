"use client";

import React from "react";
import type { MapNodeDto } from "@/contexts/bc_map/schemas";

function describe(node: MapNodeDto): string {
  if (node.soon) return `${node.label} (wkrótce)`;
  if (node.kind === "continent" && node.size !== undefined) {
    return `${node.label}, ${node.size} plików`;
  }
  return node.label;
}

/** Dostępna z klawiatury (Tab, Enter) alternatywa dla globusa na canvasie. */
export function MapNodeList(props: {
  nodes: MapNodeDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="map-nodelist" aria-label="Węzły sieci NEXUS">
      {props.nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            className="map-nodelist__item"
            aria-current={props.selectedId === node.id ? "true" : undefined}
            onClick={() => props.onSelect(node.id)}
          >
            {describe(node)}
          </button>
        </li>
      ))}
    </ul>
  );
}
