export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

function key(userId: string): string {
  return `board-viewport:${userId}`;
}

export function readViewport(userId: string): BoardViewport | null {
  const raw = localStorage.getItem(key(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BoardViewport;
    if (![parsed.x, parsed.y, parsed.zoom].every((value) => Number.isFinite(value))) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeViewport(userId: string, viewport: BoardViewport): void {
  localStorage.setItem(key(userId), JSON.stringify(viewport));
}
