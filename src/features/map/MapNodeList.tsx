"use client";

import React from "react";
import type { MapClusterDto } from "@/contexts/bc_map/schemas";
import i18n, { currentLang, type Lang } from "@/src/i18n";
import { useT } from "@/src/i18n/useT";

export function clusterListLabel(cluster: MapClusterDto, lang: Lang = currentLang()): string {
  if (cluster.soon) {
    return i18n.t("map:mapClusterSoon", { lng: lang, label: cluster.label });
  }
  return i18n.t("map:mapClusterListCount", {
    lng: lang,
    label: cluster.label,
    count: cluster.size,
  });
}

/** Dostępna z klawiatury (Tab, Enter) alternatywa dla globusa na canvasie: lista skupisk. */
export function MapNodeList(props: {
  clusters: MapClusterDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  return (
    <ul className="map-nodelist" aria-label={t("map:mapNodeListAria")}>
      {props.clusters.map((cluster) => (
        <li key={cluster.id}>
          <button
            type="button"
            className="map-nodelist__item"
            aria-current={props.selectedId === cluster.id ? "true" : undefined}
            onClick={() => props.onSelect(cluster.id)}
          >
            {clusterListLabel(cluster)}
          </button>
        </li>
      ))}
    </ul>
  );
}
