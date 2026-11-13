import type {
  BoardDto as Board,
  BoardFrameDto as BoardFrame,
  BoardTileDto as BoardTile,
} from "@/contexts/bc_board/schemas";
import { frameAt } from "@/src/features/board/boardLayout";

export interface DeletePlan {
  tiles: BoardTile[];
  frames: BoardFrame[];
  edgeIds: string[];
  landing: { tileId: string; frame: string | null; frameTitle: string | null }[];
}

export function deletePlan(ids: string[], board: Board): DeletePlan {
  const selected = new Set(ids);
  const tiles = board.tiles.filter((tile) => selected.has(tile.id));
  const frames = board.frames.filter((frame) => selected.has(frame.id));
  const tileIds = new Set(tiles.map((tile) => tile.id));
  const frameIds = new Set(frames.map((frame) => frame.id));
  const edgeIds = board.edges
    .filter((edge) => tileIds.has(edge.source) || tileIds.has(edge.target))
    .map((edge) => edge.id);
  const remaining = board.frames.filter((frame) => !frameIds.has(frame.id));
  const remainingById = new Map(remaining.map((frame) => [frame.id, frame.title]));
  const landing = board.tiles
    .filter((tile) => tile.frame && frameIds.has(tile.frame) && !tileIds.has(tile.id))
    .map((tile) => {
      const frame = frameAt(tile, remaining);
      return {
        tileId: tile.id,
        frame,
        frameTitle: frame ? (remainingById.get(frame) ?? null) : null,
      };
    });
  return { tiles, frames, edgeIds, landing };
}

export function applyDelete(board: Board, ids: string[]): Board {
  const plan = deletePlan(ids, board);
  const tileIds = new Set(plan.tiles.map((tile) => tile.id));
  const frameIds = new Set(plan.frames.map((frame) => frame.id));
  const edgeIds = new Set(plan.edgeIds);
  const landing = new Map(plan.landing.map((item) => [item.tileId, item.frame]));
  return {
    tiles: board.tiles
      .filter((tile) => !tileIds.has(tile.id))
      .map((tile) => (landing.has(tile.id) ? { ...tile, frame: landing.get(tile.id)! } : tile)),
    frames: board.frames.filter((frame) => !frameIds.has(frame.id)),
    edges: board.edges.filter((edge) => !edgeIds.has(edge.id)),
  };
}

export function deleteCopy(
  plan: DeletePlan,
  lang: "pl" | "en"
): { title: string; lines: string[] } {
  const pl = lang === "pl";
  if (plan.tiles.length + plan.frames.length > 1) {
    const lines = [
      pl
        ? `Kafelki: ${plan.tiles.length}, ramki: ${plan.frames.length}.`
        : `Tiles: ${plan.tiles.length}, frames: ${plan.frames.length}.`,
    ];
    if (plan.edgeIds.length > 0) {
      lines.push(
        pl
          ? `Razem z kafelkami znikną strzałki: ${plan.edgeIds.length}.`
          : `Arrows removed with the tiles: ${plan.edgeIds.length}.`
      );
    }
    return { title: pl ? "Usunąć zaznaczone?" : "Delete the selection?", lines };
  }
  if (plan.frames.length === 1) {
    const frame = plan.frames[0];
    const lines = [
      pl ? `Ramka „${frame.title}” zniknie.` : `Frame “${frame.title}” will be removed.`,
    ];
    if (plan.landing.length > 0) {
      const outside = plan.landing.filter((item) => item.frame === null).length;
      const grouped = new Map<string, number>();
      for (const item of plan.landing) {
        if (item.frame) grouped.set(item.frame, (grouped.get(item.frame) ?? 0) + 1);
      }
      if (grouped.size === 0) {
        lines.push(
          pl
            ? `Kafelki w ramce (${plan.landing.length}) zostaną na tablicy, poza ramkami.`
            : `Tiles in the frame (${plan.landing.length}) stay on the board, outside frames.`
        );
      } else {
        const parts = [];
        if (outside > 0) parts.push(pl ? `${outside} poza ramkami` : `${outside} outside frames`);
        for (const [frameId, count] of grouped) {
          const title = plan.landing.find((item) => item.frame === frameId)?.frameTitle ?? frameId;
          parts.push(pl ? `${count} w ramce „${title}”` : `${count} in frame “${title}”`);
        }
        lines.push(
          pl
            ? `Kafelki w ramce (${plan.landing.length}) zostaną na tablicy: ${parts.join(", ")}.`
            : `Tiles in the frame (${plan.landing.length}) stay on the board: ${parts.join(", ")}.`
        );
      }
    }
    return { title: pl ? "Usunąć ramkę?" : "Delete the frame?", lines };
  }
  const title = plan.tiles[0]?.title ?? "";
  const lines = [pl ? `„${title}” zniknie z tablicy.` : `“${title}” will leave the board.`];
  if (plan.edgeIds.length > 0) {
    lines.push(
      pl
        ? `Razem z nim znikną strzałki: ${plan.edgeIds.length}.`
        : `Arrows removed with it: ${plan.edgeIds.length}.`
    );
  }
  return { title: pl ? "Usunąć kafelek?" : "Delete the tile?", lines };
}
