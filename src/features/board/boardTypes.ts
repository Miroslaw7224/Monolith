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

export const EMPTY_BOARD: Board = { tiles: [], frames: [], edges: [] };

export interface BoardBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
