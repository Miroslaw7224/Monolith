import { useCallback, useEffect, useState } from "react";
import type { TaskStatus } from "./taskOrderUtils";
import {
  DEFAULT_LAYOUT,
  clampHeight,
  loadLayout,
  saveLayout,
  type BoardLayout,
} from "./taskBoardLayout";

/** Układ tablicy zapamiętany w localStorage; ładowany po montażu (bez rozjazdu hydracji). */
export function useBoardLayout() {
  const [layout, setLayout] = useState<BoardLayout>(DEFAULT_LAYOUT);

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  const update = useCallback((fn: (prev: BoardLayout) => BoardLayout) => {
    setLayout((prev) => {
      const next = fn(prev);
      saveLayout(next);
      return next;
    });
  }, []);

  const setCollapsed = useCallback(
    (status: TaskStatus, collapsed: boolean) =>
      update((prev) => ({ ...prev, collapsed: { ...prev.collapsed, [status]: collapsed } })),
    [update]
  );

  /** `null` przywraca automatyczną wysokość. */
  const setHeight = useCallback(
    (status: TaskStatus, px: number | null) =>
      update((prev) => {
        const heights = { ...prev.heights };
        if (px === null) delete heights[status];
        else heights[status] = clampHeight(px);
        return { ...prev, heights };
      }),
    [update]
  );

  return { layout, setCollapsed, setHeight };
}
