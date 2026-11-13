import type { BoardDto as Board } from "@/contexts/bc_board/schemas";
import type { BoardBox } from "@/src/features/board/boardTypes";
import { boxChanged, centeredBox, frameAt, withMembership } from "@/src/features/board/boardLayout";

export const NEW_TILE = { w: 240, h: 120 };
export const NEW_FRAME = { w: 520, h: 180 };

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function addTile(
  board: Board,
  center: { x: number; y: number },
  title: string
): { board: Board; tileId: string } {
  const id = newId("t");
  const box = centeredBox(center, NEW_TILE.w, NEW_TILE.h);
  const tile = {
    id,
    title,
    note: "",
    ...box,
    frame: frameAt(box, board.frames),
  };
  return { tileId: id, board: { ...board, tiles: [...board.tiles, tile] } };
}

export function addFrame(board: Board, center: { x: number; y: number }, title: string): Board {
  const id = newId("f");
  const box = centeredBox(center, NEW_FRAME.w, NEW_FRAME.h);
  const frames = [...board.frames, { id, title: title.trim(), ...box }];
  return { ...board, frames, tiles: withMembership(board.tiles, frames) };
}

export function placeTile(board: Board, id: string, box: BoardBox): Board | null {
  const tile = board.tiles.find((item) => item.id === id);
  if (!tile || !boxChanged(tile, box)) return null;
  const next = { ...tile, ...box, frame: frameAt({ ...tile, ...box }, board.frames) };
  return { ...board, tiles: board.tiles.map((item) => (item.id === id ? next : item)) };
}

export function placeFrame(board: Board, id: string, box: BoardBox): Board | null {
  const frame = board.frames.find((item) => item.id === id);
  if (!frame || !boxChanged(frame, box)) return null;
  const dx = box.x - frame.x;
  const dy = box.y - frame.y;
  const frames = board.frames.map((item) => (item.id === id ? { ...item, ...box } : item));
  const shifted = board.tiles.map((tile) =>
    tile.frame === id ? { ...tile, x: tile.x + dx, y: tile.y + dy } : tile
  );
  return { ...board, frames, tiles: withMembership(shifted, frames) };
}

export function connectTiles(board: Board, source: string, target: string): Board | null {
  if (source === target) return null;
  const ids = new Set(board.tiles.map((tile) => tile.id));
  if (!ids.has(source) || !ids.has(target)) return null;
  return { ...board, edges: [...board.edges, { id: newId("e"), source, target }] };
}

export function reconnectEdge(
  board: Board,
  id: string,
  source: string,
  target: string
): Board | null {
  if (source === target) return null;
  const ids = new Set(board.tiles.map((tile) => tile.id));
  if (!ids.has(source) || !ids.has(target)) return null;
  if (!board.edges.some((edge) => edge.id === id)) return null;
  return {
    ...board,
    edges: board.edges.map((edge) => (edge.id === id ? { ...edge, source, target } : edge)),
  };
}

export function removeEdge(board: Board, id: string): Board {
  return { ...board, edges: board.edges.filter((edge) => edge.id !== id) };
}

export function updateTileText(
  board: Board,
  id: string,
  title: string,
  note: string
): Board | null {
  if (!board.tiles.some((tile) => tile.id === id)) return null;
  return {
    ...board,
    tiles: board.tiles.map((tile) =>
      tile.id === id
        ? { ...tile, title: title.trim().slice(0, 200), note: note.slice(0, 10000) }
        : tile
    ),
  };
}

export function renameFrame(board: Board, id: string, title: string): Board | null {
  const trimmed = title.trim().slice(0, 200);
  if (!trimmed || !board.frames.some((frame) => frame.id === id)) return null;
  return {
    ...board,
    frames: board.frames.map((frame) => (frame.id === id ? { ...frame, title: trimmed } : frame)),
  };
}
