import type { MapGraphDto } from "@/contexts/bc_map/schemas";
import i18n, { currentLang, type Lang } from "@/src/i18n";

export type MapTile = { id: string; label: string; value: string; meta: string };

export function buildMapTiles(
  graph: MapGraphDto,
  agents: { available: boolean; count: number },
  lang: Lang = currentLang()
): MapTile[] {
  const lng = { lng: lang };
  const n = graph.tiles.neurons;
  return [
    {
      id: "neurons",
      label: i18n.t("map:mapTileNeurons", lng),
      value: String(n.total),
      meta: i18n.t("map:mapTileNeuronsMeta", {
        ...lng,
        knowledge: n.knowledge,
        ai2030: n.ai2030,
        projects: n.projects,
      }),
    },
    {
      id: "deps",
      label: i18n.t("map:mapTileDeps", lng),
      value: String(graph.tiles.dependencies),
      meta: i18n.t("map:mapTileDepsMeta", lng),
    },
    {
      id: "blockers",
      label: i18n.t("map:mapTileBlockers", lng),
      value: "—",
      meta: i18n.t("map:mapTileBlockersMeta", lng),
    },
    {
      id: "agents",
      label: i18n.t("map:mapTileAgents", lng),
      value: agents.available ? String(agents.count) : "—",
      meta: agents.available
        ? i18n.t("map:mapTileAgentsMetaHerdr", lng)
        : i18n.t("map:mapTileAgentsMetaUnavailable", lng),
    },
  ];
}
