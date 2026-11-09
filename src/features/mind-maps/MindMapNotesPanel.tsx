"use client";

import { useEffect, useRef, useState } from "react";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { NoteEditor } from "@/src/components/NoteEditor";
import { clamp } from "@/src/features/mind-maps/mindMapClamp";
import type { translations } from "@/src/translations";

type T = (typeof translations)["en"];

const DEFAULT_NOTES_PANEL_H = 224; // tailwind h-56 (~14rem) -> 224px
const MIN_NOTES_PANEL_H = 120;
const MAX_NOTES_PANEL_H = 520;

export function MindMapNotesPanel({
  selectedNode,
  onContentChange,
  t,
}: {
  selectedNode: MindMapNode | null;
  onContentChange: (html: string) => void;
  t: T;
}) {
  const [notesPanelH, setNotesPanelH] = useState<number>(DEFAULT_NOTES_PANEL_H);
  const notesResizingRef = useRef<null | { startY: number; startH: number }>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const r = notesResizingRef.current;
      if (!r) return;
      // Dragging the handle upward decreases clientY => increases panel height.
      const dy = r.startY - e.clientY;
      const maxH = (() => {
        const viewportH = document.documentElement.clientHeight || 800;
        // Leave some space for header + map area; prevent over-expanding.
        return Math.max(MIN_NOTES_PANEL_H, Math.min(MAX_NOTES_PANEL_H, viewportH * 0.65));
      })();
      const nextH = clamp(r.startH + dy, MIN_NOTES_PANEL_H, maxH);
      setNotesPanelH(nextH);
    }

    function onUp() {
      if (!notesResizingRef.current) return;
      notesResizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div
      style={{ height: notesPanelH }}
      className="border-t border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row overflow-hidden relative"
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        tabIndex={0}
        className="absolute left-0 right-0 top-0 h-4 -translate-y-1 cursor-row-resize z-[20]"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          notesResizingRef.current = { startY: e.clientY, startH: notesPanelH };
          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
        }}
        onKeyDown={(e) => {
          // Small keyboard adjust for accessibility.
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const delta = e.key === "ArrowUp" ? 24 : -24;
          const viewportH = document.documentElement.clientHeight || 800;
          const maxH = Math.max(MIN_NOTES_PANEL_H, Math.min(MAX_NOTES_PANEL_H, viewportH * 0.65));
          const nextH = clamp(notesPanelH + delta, MIN_NOTES_PANEL_H, maxH);
          setNotesPanelH(nextH);
        }}
      />
      <div className="w-full sm:w-60 sm:flex-shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--border)] p-4 min-h-0 max-h-28 sm:max-h-none overflow-y-auto overflow-x-hidden">
        {!selectedNode ? (
          <div className="h-full flex items-center justify-center text-sm text-[var(--text3)] font-semibold text-center">
            {t.mindMapsClickNodeHint as string}
          </div>
        ) : (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text3)] font-bold">
              {t.mindMapsSelectedNode as string}
            </div>
            <div className="font-bold whitespace-normal break-words" title={selectedNode.label}>
              {selectedNode.label}
            </div>
            <div className="text-xs text-[var(--text3)]">
              {(t.mindMapsItemsCount as string).replace(
                "{n}",
                String(selectedNode.children.length)
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 p-4 overflow-hidden flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-widest text-[var(--text3)] font-bold">
          {t.mindMapsNotes as string}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {selectedNode ? (
            <NoteEditor
              content={selectedNode.note ?? ""}
              onContentChange={onContentChange}
              className="h-full min-h-0"
              variant="panel"
            />
          ) : (
            <div className="h-full border border-[var(--border)] rounded-xl bg-[var(--surface)] flex items-center justify-center text-sm text-[var(--text3)]">
              {t.mindMapsSelectNodeToEditNote as string}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
