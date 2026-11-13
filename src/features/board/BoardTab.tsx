"use client";

import React, { useCallback, useEffect, useState } from "react";
import { EMPTY_BOARD, type BoardDto as Board } from "@/contexts/bc_board/schemas";
import { updateTileText } from "@/src/features/board/boardActions";
import { BoardCanvas, type BoardCanvasLabels } from "@/src/features/board/BoardCanvas";
import { BoardList } from "@/src/features/board/BoardList";
import { TileDialog } from "@/src/features/board/TileDialog";

export interface BoardTabLabels {
  canvas: string;
  list: string;
  saveFailed: string;
  loadFailed: string;
  retry: string;
  outside: string;
  tileTitle: string;
  tileNote: string;
  close: string;
}

export function BoardTab({
  apiFetch,
  lang,
  labels,
  canvasLabels,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "pl" | "en";
  labels: BoardTabLabels;
  canvasLabels: BoardCanvasLabels;
}) {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [view, setView] = useState<"canvas" | "list">("canvas");
  const [openTileId, setOpenTileId] = useState<string | null>(null);
  const [canvasDialog, setCanvasDialog] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    const response = await apiFetch("/api/board");
    if (!response.ok) {
      setLoaded(false);
      setLoadError(true);
      return;
    }
    setBoard((await response.json()) as Board);
    setLoaded(true);
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(next: Board) {
    setBoard(next);
    const response = await apiFetch("/api/board", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tiles: next.tiles, frames: next.frames, edges: next.edges }),
    });
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    setBoard((await response.json()) as Board);
    setSaveError(false);
  }

  const openTile = board.tiles.find((tile) => tile.id === openTileId) ?? null;

  if (loadError || !loaded) {
    return (
      <div className="p-4">
        {loadError ? <p className="text-sm text-[var(--text)]">{labels.loadFailed}</p> : null}
        {loadError ? (
          <button type="button" onClick={() => void load()}>
            {labels.retry}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-2 p-2">
        <button type="button" onClick={() => setView("canvas")}>
          {labels.canvas}
        </button>
        <button type="button" onClick={() => setView("list")}>
          {labels.list}
        </button>
      </div>
      {saveError ? <p className="px-2 text-sm text-[var(--text)]">{labels.saveFailed}</p> : null}
      {view === "canvas" ? (
        <BoardCanvas
          board={board}
          lang={lang}
          labels={canvasLabels}
          dialogOpen={Boolean(openTile) || canvasDialog}
          onChange={(next) => void persist(next)}
          onDialogOpenChange={setCanvasDialog}
          onTileAdded={setOpenTileId}
          onOpenTile={setOpenTileId}
        />
      ) : (
        <BoardList board={board} outsideLabel={labels.outside} onOpen={setOpenTileId} />
      )}
      {openTile ? (
        <TileDialog
          tile={openTile}
          titleLabel={labels.tileTitle}
          noteLabel={labels.tileNote}
          closeLabel={labels.close}
          onSave={(patch) => {
            const next = updateTileText(board, openTile.id, patch.title, patch.note);
            setOpenTileId(null);
            if (next) void persist(next);
          }}
        />
      ) : null}
    </div>
  );
}
