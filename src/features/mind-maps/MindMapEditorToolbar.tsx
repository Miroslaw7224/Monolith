"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { Redo2, Search, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { clamp } from "@/src/features/mind-maps/mindMapClamp";
import { useT } from "@/src/i18n/useT";

type MindMapView = { scale: number; x: number; y: number };

export function zoomAt(
  current: { scale: number; x: number; y: number },
  factor: number,
  clientX: number,
  clientY: number,
  viewport: HTMLElement
) {
  const scale = clamp(current.scale * factor, 0.25, 2.5);
  const rect = viewport.getBoundingClientRect();
  const originX = clientX - rect.left;
  const originY = clientY - rect.top;
  const contentX = (originX - current.x) / current.scale;
  const contentY = (originY - current.y) / current.scale;
  return { scale, x: originX - contentX * scale, y: originY - contentY * scale };
}

export function MindMapEditorToolbar({
  query,
  setQuery,
  matches,
  matchCursor,
  setMatchCursor,
  canUndo,
  canRedo,
  undo,
  redo,
  view,
  setView,
  viewportRef,
  contentRef,
}: {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  matches: string[];
  matchCursor: number;
  setMatchCursor: Dispatch<SetStateAction<number>>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  view: MindMapView;
  setView: Dispatch<SetStateAction<MindMapView>>;
  viewportRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
}) {
  const t = useT();

  return (
    <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2 flex-wrap">
      <label className="relative flex-1 min-w-40 max-w-xs">
        <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setMatchCursor(0);
          }}
          placeholder={t("mindmaps:mindMapsSearchPlaceholder")}
          className="w-full h-9 pl-8 pr-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none"
        />
      </label>
      <span className="text-xs text-[var(--text3)] min-w-16">
        {query.trim()
          ? matches.length
            ? `${(matchCursor % matches.length) + 1}/${matches.length}`
            : t("mindmaps:mindMapsSearchNone")
          : ""}
      </span>
      <button
        type="button"
        className="h-9 px-2 rounded-lg border border-[var(--border)] text-sm"
        onClick={() =>
          setMatchCursor((cursor) => (matches.length ? cursor - 1 + matches.length : 0))
        }
        disabled={matches.length === 0}
      >
        ↑
      </button>
      <button
        type="button"
        className="h-9 px-2 rounded-lg border border-[var(--border)] text-sm"
        onClick={() => setMatchCursor((cursor) => (matches.length ? cursor + 1 : 0))}
        disabled={matches.length === 0}
      >
        ↓
      </button>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          title={t("mindmaps:mindMapsUndo")}
          disabled={!canUndo}
          onClick={undo}
          className="h-9 w-9 rounded-lg border border-[var(--border)] inline-flex items-center justify-center disabled:opacity-40"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          title={t("mindmaps:mindMapsRedo")}
          disabled={!canRedo}
          onClick={redo}
          className="h-9 w-9 rounded-lg border border-[var(--border)] inline-flex items-center justify-center disabled:opacity-40"
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          title={t("mindmaps:mindMapsZoomOut")}
          onClick={() => {
            const viewport = viewportRef.current;
            setView((current) =>
              viewport
                ? zoomAt(
                    current,
                    1 / 1.1,
                    viewport.getBoundingClientRect().left + viewport.clientWidth / 2,
                    viewport.getBoundingClientRect().top + viewport.clientHeight / 2,
                    viewport
                  )
                : { ...current, scale: clamp(current.scale / 1.1, 0.25, 2.5) }
            );
          }}
          className="h-9 w-9 rounded-lg border border-[var(--border)] inline-flex items-center justify-center"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs w-12 text-center text-[var(--text2)]">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          type="button"
          title={t("mindmaps:mindMapsZoomIn")}
          onClick={() => {
            const viewport = viewportRef.current;
            setView((current) =>
              viewport
                ? zoomAt(
                    current,
                    1.1,
                    viewport.getBoundingClientRect().left + viewport.clientWidth / 2,
                    viewport.getBoundingClientRect().top + viewport.clientHeight / 2,
                    viewport
                  )
                : { ...current, scale: clamp(current.scale * 1.1, 0.25, 2.5) }
            );
          }}
          className="h-9 w-9 rounded-lg border border-[var(--border)] inline-flex items-center justify-center"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          title={t("mindmaps:mindMapsFit")}
          onClick={() => {
            const viewport = viewportRef.current;
            const content = contentRef.current;
            if (!viewport || !content) return;
            const pad = 32;
            const scale = clamp(
              Math.min(
                (viewport.clientWidth - pad) / Math.max(content.offsetWidth, 1),
                (viewport.clientHeight - pad) / Math.max(content.offsetHeight, 1)
              ),
              0.25,
              2.5
            );
            setView({
              scale,
              x: (viewport.clientWidth - content.offsetWidth * scale) / 2,
              y: (viewport.clientHeight - content.offsetHeight * scale) / 2,
            });
          }}
          className="h-9 px-3 rounded-lg border border-[var(--border)] text-sm font-semibold"
        >
          {t("mindmaps:mindMapsFit")}
        </button>
      </div>
    </div>
  );
}
