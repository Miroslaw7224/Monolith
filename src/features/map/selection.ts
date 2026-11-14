import type { MapEdgeDto, MapNodeDto } from "@/contexts/bc_map/schemas";

/** Zaznaczenie na globusie: całe skupisko albo pojedyncza notatka. */
export type MapSelection = { kind: "cluster" | "note"; id: string };

export type Neighbor = { id: string; label: string; weight: number };

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Sąsiedzi notatki po krawędziach `link` (pary nieskierowane): waga malejąco, potem etykieta, potem id. */
export function noteNeighbors(
  noteId: string,
  nodes: MapNodeDto[],
  edges: MapEdgeDto[]
): Neighbor[] {
  const labels = new Map(nodes.map((n) => [n.id, n.label]));
  const out: Neighbor[] = [];
  for (const e of edges) {
    if (e.type !== "link") continue;
    const other = e.from === noteId ? e.to : e.to === noteId ? e.from : null;
    const label = other === null ? undefined : labels.get(other);
    if (other === null || label === undefined) continue;
    out.push({ id: other, label, weight: e.weight });
  }
  return out.sort((a, b) => b.weight - a.weight || cmp(a.label, b.label) || cmp(a.id, b.id));
}

/** Górna granica podświetlanych łuków (wszystkie łuki i tak są rysowane przygaszone). */
export const MAX_NOTE_ARCS = 2000;

export type SelectionHighlight = {
  clusterId: string | null;
  noteId: string | null;
  /** Krawędzie notatkowe do narysowania (najpierw wewnętrzne, potem pozostałe; do `limit`). */
  edges: MapEdgeDto[];
  /** Notatki będące końcami rysowanych krawędzi (nie są przygaszane). */
  lit: Set<string>;
};

/** Które krawędzie notatkowe pokazać po zaznaczeniu skupiska lub notatki. */
export function selectionHighlight(
  selection: MapSelection | null,
  nodes: MapNodeDto[],
  edges: MapEdgeDto[],
  limit = MAX_NOTE_ARCS
): SelectionHighlight {
  const empty: SelectionHighlight = { clusterId: null, noteId: null, edges: [], lit: new Set() };
  if (selection === null) return empty;

  let clusterId: string | null;
  let noteId: string | null = null;
  let touches: (e: MapEdgeDto) => boolean;
  let strong: (e: MapEdgeDto) => boolean;
  if (selection.kind === "cluster") {
    clusterId = selection.id;
    const inCluster = new Set(nodes.filter((n) => n.cluster === clusterId).map((n) => n.id));
    touches = (e) =>
      inCluster.has(e.from) || (e.type === "link" ? inCluster.has(e.to) : e.to === clusterId);
    strong = (e) => e.type === "link" && inCluster.has(e.from) && inCluster.has(e.to);
  } else {
    noteId = selection.id;
    clusterId = nodes.find((n) => n.id === noteId)?.cluster ?? null;
    touches = (e) => e.from === noteId || (e.type === "link" && e.to === noteId);
    strong = () => true;
  }

  const picked = edges
    .filter(touches)
    .sort(
      (a, b) =>
        Number(strong(b)) - Number(strong(a)) ||
        cmp(a.from, b.from) ||
        cmp(a.to, b.to) ||
        cmp(a.type, b.type)
    )
    .slice(0, limit);
  const lit = new Set<string>();
  if (noteId !== null) lit.add(noteId);
  for (const e of picked) {
    lit.add(e.from);
    if (e.type === "link") lit.add(e.to);
  }
  return { clusterId, noteId, edges: picked, lit };
}
