import { TASK_STATUSES, type TaskStatus } from "./taskOrderUtils";

export const LAYOUT_KEY = "zad-board-layout-v1";
export const MIN_LIST_HEIGHT = 80;
export const MAX_LIST_HEIGHT = 1200;
export const COLLAPSED_TRACK = "3rem";

export type BoardMode = "normal" | "work";

export interface BoardLayout {
  /** Brak klucza = brak własnego ustawienia (decyduje domyślne dla trybu). */
  collapsed: Partial<Record<TaskStatus, boolean>>;
  /** Własna wysokość listy kart w px; brak klucza = automatyczna. */
  heights: Partial<Record<TaskStatus, number>>;
}

export const DEFAULT_LAYOUT: BoardLayout = { collapsed: {}, heights: {} };

export function clampHeight(px: number): number {
  return Math.min(MAX_LIST_HEIGHT, Math.max(MIN_LIST_HEIGHT, Math.round(px)));
}

const isStatus = (key: string): key is TaskStatus => (TASK_STATUSES as string[]).includes(key);

export function loadLayout(): BoardLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as {
      collapsed?: Record<string, unknown>;
      heights?: Record<string, unknown>;
    } | null;
    const collapsed: BoardLayout["collapsed"] = {};
    for (const [key, value] of Object.entries(parsed?.collapsed ?? {})) {
      if (isStatus(key) && typeof value === "boolean") collapsed[key] = value;
    }
    const heights: BoardLayout["heights"] = {};
    for (const [key, value] of Object.entries(parsed?.heights ?? {})) {
      if (isStatus(key) && typeof value === "number" && Number.isFinite(value)) {
        heights[key] = clampHeight(value);
      }
    }
    return { collapsed, heights };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: BoardLayout): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // zapamiętanie układu jest dodatkiem; zablokowany magazyn nie może psuć tablicy
  }
}

/** Stan zwinięcia każdej kolumny: własne ustawienie, a bez niego domyślne (tryb roboczy zwija Zrobione). */
export function effectiveCollapsed(
  layout: BoardLayout,
  mode: BoardMode
): Record<TaskStatus, boolean> {
  const result = {} as Record<TaskStatus, boolean>;
  for (const status of TASK_STATUSES) {
    result[status] = layout.collapsed[status] ?? (mode === "work" && status === "done");
  }
  return result;
}

/**
 * Szablon `grid-template-columns`. Tryb roboczy: stos 1 (todo, deferred) | stos 2 (in_progress,
 * to_review) | panel | done; kolumny w stosach zwijają się w pionie, więc nie zmieniają siatki.
 */
export function boardColumns(mode: BoardMode, collapsed: Record<TaskStatus, boolean>): string {
  const track = (status: TaskStatus) => (collapsed[status] ? COLLAPSED_TRACK : "1fr");
  if (mode === "work") return ["1fr", "1fr", "2fr", track("done")].join(" ");
  return TASK_STATUSES.map(track).join(" ");
}
