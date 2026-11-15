import type {
  BoardDto as Board,
  BoardFrameDto as BoardFrame,
  BoardTileDto as BoardTile,
} from "@/contexts/bc_board/schemas";
import { frameAt } from "@/src/features/board/boardLayout";
import i18n, { currentLang, type Lang } from "@/src/i18n";

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

type BoardDeleteKey =
  | "boardDeleteMultiLine"
  | "boardDeleteEdgesLine"
  | "boardDeleteSelectionTitle"
  | "boardDeleteFrameWillRemove"
  | "boardDeleteTilesStayOutside"
  | "boardDeletePartOutside"
  | "boardDeletePartInFrame"
  | "boardDeleteTilesStaySummary"
  | "boardDeleteFrameTitle"
  | "boardDeleteTileLeaves"
  | "boardDeleteEdgesWithOne"
  | "boardDeleteTileTitle";

function boardT(key: BoardDeleteKey, lang: Lang, options?: Record<string, unknown>): string {
  return i18n.t(`planning:${key}`, { lng: lang, ...options });
}

export function deleteCopy(
  plan: DeletePlan,
  lang: Lang = currentLang()
): { title: string; lines: string[] } {
  if (plan.tiles.length + plan.frames.length > 1) {
    const lines = [
      boardT("boardDeleteMultiLine", lang, {
        tiles: plan.tiles.length,
        frames: plan.frames.length,
      }),
    ];
    if (plan.edgeIds.length > 0) {
      lines.push(boardT("boardDeleteEdgesLine", lang, { count: plan.edgeIds.length }));
    }
    return { title: boardT("boardDeleteSelectionTitle", lang), lines };
  }
  if (plan.frames.length === 1) {
    const frame = plan.frames[0];
    const lines = [boardT("boardDeleteFrameWillRemove", lang, { title: frame.title })];
    if (plan.landing.length > 0) {
      const outside = plan.landing.filter((item) => item.frame === null).length;
      const grouped = new Map<string, number>();
      for (const item of plan.landing) {
        if (item.frame) grouped.set(item.frame, (grouped.get(item.frame) ?? 0) + 1);
      }
      if (grouped.size === 0) {
        lines.push(boardT("boardDeleteTilesStayOutside", lang, { count: plan.landing.length }));
      } else {
        const parts = [];
        if (outside > 0) {
          parts.push(boardT("boardDeletePartOutside", lang, { count: outside }));
        }
        for (const [frameId, count] of grouped) {
          const title = plan.landing.find((item) => item.frame === frameId)?.frameTitle ?? frameId;
          parts.push(boardT("boardDeletePartInFrame", lang, { count, title }));
        }
        lines.push(
          boardT("boardDeleteTilesStaySummary", lang, {
            count: plan.landing.length,
            detail: parts.join(", "),
          })
        );
      }
    }
    return { title: boardT("boardDeleteFrameTitle", lang), lines };
  }
  const title = plan.tiles[0]?.title ?? "";
  const lines = [boardT("boardDeleteTileLeaves", lang, { title })];
  if (plan.edgeIds.length > 0) {
    lines.push(boardT("boardDeleteEdgesWithOne", lang, { count: plan.edgeIds.length }));
  }
  return { title: boardT("boardDeleteTileTitle", lang), lines };
}
