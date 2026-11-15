"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useT } from "@/src/i18n/useT";
import { EMPTY_BOARD, type BoardDto as Board } from "@/contexts/bc_board/schemas";
import { updateTileText } from "@/src/features/board/boardActions";
import { BoardCanvas, type BoardCanvasLabels } from "@/src/features/board/BoardCanvas";
import { BoardList } from "@/src/features/board/BoardList";
import { TileDialog } from "@/src/features/board/TileDialog";
import "./board.css";

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
  labels,
  canvasLabels,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  labels: BoardTabLabels;
  canvasLabels: BoardCanvasLabels;
}) {
  const t = useT();
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
      <div className="plo" data-card="plotno">
        <div className="plo-state-wrap">
          {loadError ? (
            <>
              <p className="plo-state plo-state--error">{labels.loadFailed}</p>
              <button type="button" className="btn plo-btn" onClick={() => void load()}>
                {labels.retry}
              </button>
            </>
          ) : (
            <p className="plo-state">{t("planning:boardLoading")}</p>
          )}
        </div>
      </div>
    );
  }

  const tilesNoun = t("planning:boardCountTile", { count: board.tiles.length });
  const framesNoun = t("planning:boardCountFrame", { count: board.frames.length });
  const edgesNoun = t("planning:boardCountEdge", { count: board.edges.length });
  const subText = t("planning:boardStatsFormat", {
    tiles: board.tiles.length,
    tilesNoun,
    frames: board.frames.length,
    framesNoun,
    edges: board.edges.length,
    edgesNoun,
  });

  return (
    <div className="plo" data-card="plotno">
      <header className="view-head plo-head">
        <div>
          <p className="view-head__eyebrow plo-eyebrow">{t("planning:boardEyebrow")}</p>
          <h1 className="view-head__title plo-title">{t("planning:boardHeading")}</h1>
          <p className="view-head__sub plo-sub">{subText}</p>
        </div>
        <div className="view-head__actions plo-head__actions">
          <div className="tabs plo-tabs">
            <button
              type="button"
              className={`tabs__btn plo-tab-btn ${view === "canvas" ? "plo-tab-btn--active" : ""}`}
              aria-pressed={view === "canvas"}
              onClick={() => setView("canvas")}
            >
              {labels.canvas}
            </button>
            <button
              type="button"
              className={`tabs__btn plo-tab-btn ${view === "list" ? "plo-tab-btn--active" : ""}`}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              {labels.list}
            </button>
          </div>
        </div>
      </header>

      {saveError ? (
        <div className="plo-alert" role="alert">
          {labels.saveFailed}
        </div>
      ) : null}

      <div className="plo-main">
        {view === "canvas" ? (
          <BoardCanvas
            board={board}
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
      </div>

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
