import type { MapGraphDto } from "@/contexts/bc_map/schemas";

export type MapTile = { id: string; label: string; value: string; meta: string };

export function buildMapTiles(
  graph: MapGraphDto,
  agents: { available: boolean; count: number }
): MapTile[] {
  const n = graph.tiles.neurons;
  return [
    {
      id: "neurons",
      label: "Neurony NEXUS",
      value: String(n.total),
      meta: `${n.knowledge} Wiedza · ${n.ai2030} AI-2030 · ${n.projects} w projektach`,
    },
    {
      id: "deps",
      label: "Zależności",
      value: String(graph.tiles.dependencies),
      meta: "współdzielone komponenty i wiedza",
    },
    { id: "blockers", label: "Aktywne blokery", value: "—", meta: "wkrótce" },
    {
      id: "agents",
      label: "Agenci na żywo",
      value: agents.available ? String(agents.count) : "—",
      meta: agents.available ? "Herdr" : "Herdr niedostępny",
    },
  ];
}
