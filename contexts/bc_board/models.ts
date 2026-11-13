export interface BoardTile {
  id: string;
  title: string;
  note: string;
  x: number;
  y: number;
  w: number;
  h: number;
  frame: string | null;
}

export interface BoardFrame {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
}

export interface Board {
  tiles: BoardTile[];
  frames: BoardFrame[];
  edges: BoardEdge[];
}

/** Zawartość `Board/board.json` jeszcze niezwalidowana; waliduje ją `parseBoard` w `schemas`. */
export type StoredBoard = { tiles: unknown; frames: unknown; edges: unknown };
