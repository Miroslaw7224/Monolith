export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

const KEY = "board-viewport";

export function readViewport(): BoardViewport | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BoardViewport;
    if (![parsed.x, parsed.y, parsed.zoom].every((value) => Number.isFinite(value))) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeViewport(viewport: BoardViewport): void {
  localStorage.setItem(KEY, JSON.stringify(viewport));
}
