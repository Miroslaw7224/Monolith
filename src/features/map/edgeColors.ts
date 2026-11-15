import type { MapClusterDto, MapEdgeDto, MapNodeDto } from "@/contexts/bc_map/schemas";

export type MapEdgeLabelKey =
  | "map:edge.kkSame"
  | "map:edge.kkCross"
  | "map:edge.kp"
  | "map:edge.kField"
  | "map:edge.ppSame"
  | "map:edge.ppCross"
  | "map:edge.ka"
  | "map:edge.pa"
  | "map:edge.aa";

export type EdgeClass =
  | "kk-same"
  | "kk-cross"
  | "kp"
  | "k-field"
  | "pp-same"
  | "pp-cross"
  | "ka"
  | "pa"
  | "aa";

/**
 * Klasy połączeń (wg grup końców) i ich kolory. Kolory pochodzą z kart aplikacji
 * (`--c-*` w docs/mockups/karty/tokens.css), żeby mapa pasowała do reszty interfejsu.
 */
export const EDGE_CLASSES: { id: EdgeClass; labelKey: MapEdgeLabelKey; color: string }[] = [
  { id: "kk-same", labelKey: "map:edge.kkSame", color: "#22d3ee" },
  { id: "kk-cross", labelKey: "map:edge.kkCross", color: "#b47bff" },
  { id: "kp", labelKey: "map:edge.kp", color: "#ff9f1c" },
  { id: "k-field", labelKey: "map:edge.kField", color: "#b6ff2e" },
  { id: "pp-same", labelKey: "map:edge.ppSame", color: "#3d95ff" },
  { id: "pp-cross", labelKey: "map:edge.ppCross", color: "#ff2bd6" },
  { id: "ka", labelKey: "map:edge.ka", color: "#f3ff3a" },
  { id: "pa", labelKey: "map:edge.pa", color: "#ff3b1f" },
  { id: "aa", labelKey: "map:edge.aa", color: "#3ddc84" },
];

export type EdgeMaps = {
  nodeCluster: ReadonlyMap<string, string>;
  clusterGroup: ReadonlyMap<string, MapClusterDto["group"]>;
};

export function buildEdgeMaps(nodes: MapNodeDto[], clusters: MapClusterDto[]): EdgeMaps {
  return {
    nodeCluster: new Map(nodes.map((n) => [n.id, n.cluster])),
    clusterGroup: new Map(clusters.map((c) => [c.id, c.group])),
  };
}

/** Klasa połączenia wg grup skupisk jego końców; `null`, gdy któryś koniec jest nieznany. */
export function edgeClass(e: MapEdgeDto, maps: EdgeMaps): EdgeClass | null {
  const fromCluster = maps.nodeCluster.get(e.from);
  if (fromCluster === undefined) return null;
  if (e.type === "project") return "k-field";
  const toCluster = maps.nodeCluster.get(e.to);
  if (toCluster === undefined) return null;
  const a = maps.clusterGroup.get(fromCluster);
  const b = maps.clusterGroup.get(toCluster);
  if (a === undefined || b === undefined) return null;
  const same = fromCluster === toCluster;
  const groups = [a, b].sort().join("+");
  switch (groups) {
    case "knowledge+knowledge":
      return same ? "kk-same" : "kk-cross";
    case "knowledge+projects":
      return "kp";
    case "projects+projects":
      return same ? "pp-same" : "pp-cross";
    case "ai2030+knowledge":
      return "ka";
    case "ai2030+projects":
      return "pa";
    case "ai2030+ai2030":
      return "aa";
    default:
      return null;
  }
}

export function groupEdges(edges: MapEdgeDto[], maps: EdgeMaps): Map<EdgeClass, MapEdgeDto[]> {
  const out = new Map<EdgeClass, MapEdgeDto[]>();
  for (const e of edges) {
    const cls = edgeClass(e, maps);
    if (cls === null) continue;
    const list = out.get(cls);
    if (list) list.push(e);
    else out.set(cls, [e]);
  }
  return out;
}
