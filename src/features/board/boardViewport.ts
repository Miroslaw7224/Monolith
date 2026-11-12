export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

const KEY = "board-viewport";

export function readViewport(): BoardViewport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoardViewport;
    if (![parsed.x, parsed.y, parsed.zoom].every((value) => Number.isFinite(value))) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeViewport(viewport: BoardViewport): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(viewport));
  } catch {
    // zapis widoku jest dodatkiem; brak miejsca lub zablokowany localStorage nie może psuć tablicy
  }
}
