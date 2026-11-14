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
