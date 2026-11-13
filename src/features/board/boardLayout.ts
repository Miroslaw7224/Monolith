import type {
  BoardFrameDto as BoardFrame,
  BoardTileDto as BoardTile,
} from "@/contexts/bc_board/schemas";
import type { BoardBox } from "@/src/features/board/boardTypes";

export function frameAt(box: BoardBox, frames: BoardFrame[]): string | null {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const hit = [...frames]
    .reverse()
    .find(
      (frame) =>
        cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h
    );
  return hit ? hit.id : null;
}

export function boxChanged(before: BoardBox, after: BoardBox): boolean {
  return (["x", "y", "w", "h"] as const).some((key) => Math.abs(after[key] - before[key]) >= 0.5);
}

export function movedChildren(
  tiles: BoardTile[],
  frameId: string,
  dx: number,
  dy: number
): BoardTile[] {
  return tiles
    .filter((tile) => tile.frame === frameId)
    .map((tile) => ({ ...tile, x: tile.x + dx, y: tile.y + dy }));
}

export function withMembership(tiles: BoardTile[], frames: BoardFrame[]): BoardTile[] {
  return tiles.map((tile) => ({ ...tile, frame: frameAt(tile, frames) }));
}

export function centeredBox(center: { x: number; y: number }, w: number, h: number): BoardBox {
  return { x: center.x - w / 2, y: center.y - h / 2, w, h };
}
