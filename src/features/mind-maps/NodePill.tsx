"use client";

import React, { useRef } from "react";
import {
  ArrowUp,
  ChevronRight,
  FolderInput,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { nodeBoxHeight } from "@/src/features/mind-maps/mindMapLayout";
import type { translations } from "@/src/translations";

export function NodePill({
  mode,
  node,
  isRoot,
  depth,
  t,
  getColW,
  startResize,
  selId,
  editId,
  ctxId,
  dragId,
  dropId,
  onSelect,
  onToggleCollapsed,
  onStartEdit,
  onCommitLabel,
  onToggleCtx,
  onAddChild,
  onAddChildAIImport,
  onInsertAbove,
  onRequestDelete,
  onOpenAI,
  onExportToOtherMap,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  highlightedIds,
  activeMatchId,
  branchColor: color,
}: {
  mode: "edit" | "readOnly";
  node: MindMapNode;
  isRoot: boolean;
  depth: number;
  t: (typeof translations)["en"];
  getColW: (depth: number) => number;
  startResize: (e: React.MouseEvent, depth: number) => void;
  selId: string | null;
  editId: string | null;
  ctxId: string | null;
  dragId: string | null;
  dropId: string | null;
  onSelect: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCommitLabel: (id: string, next: string) => void;
  onToggleCtx: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddChildAIImport: (parentId: string) => void;
  onInsertAbove: (childId: string) => void;
  onRequestDelete: (id: string) => void;
  onOpenAI: (parentId: string) => void;
  onExportToOtherMap: (nodeId: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (targetId: string) => void;
  onDragEnd: () => void;
  onAddSibling: (id: string) => void;
  onReorderSibling: (id: string, delta: -1 | 1) => void;
  highlightedIds: ReadonlySet<string>;
  activeMatchId: string | null;
  branchColor?: string;
}) {
  const hasKids = node.children.length > 0;
  const colW = getColW(depth);
  const boxH = nodeBoxHeight(node.label, colW);
  const editing = mode === "edit" && node.id === editId;
  const sel = mode === "edit" && node.id === selId;
  const isDrag = mode === "edit" && node.id === dragId;
  const isDrop = mode === "edit" && node.id === dropId;
  const isMatch = highlightedIds.has(node.id);
  const isActiveMatch = activeMatchId === node.id;
  const skipBlurCommit = useRef(false);

  return (
    <div
      title={mode === "edit" && !isRoot ? (t.mindMapsDragReparentHint as string) : undefined}
      draggable={mode === "edit" && !isRoot}
      onDragStart={(e) => {
        if (mode !== "edit") return;
        if (isRoot) {
          e.preventDefault();
          return;
        }
        onDragStart(node.id);
        e.dataTransfer.effectAllowed = "move";
        e.stopPropagation();
      }}
      onDragOver={(e) => {
        if (mode !== "edit") return;
        e.preventDefault();
        e.stopPropagation();
        onDragOver(node.id);
      }}
      onDrop={(e) => {
        if (mode !== "edit") return;
        e.preventDefault();
        e.stopPropagation();
        onDrop(node.id);
      }}
      onDragEnd={() => (mode === "edit" ? onDragEnd() : undefined)}
      onClick={(e) => {
        e.stopPropagation();
        if (mode === "edit") onSelect(node.id);
      }}
      role="treeitem"
      data-mindmap-node={node.id}
      tabIndex={mode === "edit" ? (sel ? 0 : -1) : undefined}
      aria-selected={mode === "edit" ? sel : undefined}
      aria-expanded={hasKids ? !node.collapsed : undefined}
      aria-level={depth + 1}
      style={{
        width: colW,
        minHeight: boxH,
        borderLeftWidth: color ? 3 : undefined,
        borderLeftColor: color,
      }}
      className={[
        "group relative flex items-center gap-2 px-2.5 rounded-xl border transition-colors select-none",
        "bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--bg2)]",
        sel ? "border-[var(--accent)] bg-[var(--bg2)]" : "",
        isDrop ? "border-emerald-400 bg-emerald-50" : "",
        isDrag ? "opacity-40" : "",
        isMatch ? "ring-2 ring-amber-300" : "",
        isActiveMatch ? "ring-2 ring-amber-500" : "",
      ].join(" ")}
    >
      {mode === "edit" && !isRoot ? (
        <div className="text-[var(--text3)] opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4" />
        </div>
      ) : null}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasKids) onToggleCollapsed(node.id);
        }}
        className={[
          "w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text2)]",
          hasKids ? "hover:bg-[var(--bg3)]" : "opacity-0 pointer-events-none",
        ].join(" ")}
        title={
          hasKids
            ? node.collapsed
              ? (t.mindMapsExpand as string)
              : (t.mindMapsCollapse as string)
            : ""
        }
      >
        <ChevronRight
          className={["w-4 h-4 transition-transform", node.collapsed ? "" : "rotate-90"].join(" ")}
        />
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            defaultValue={node.label}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                skipBlurCommit.current = true;
                onCommitLabel(node.id, (e.target as HTMLInputElement).value);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                skipBlurCommit.current = true;
                onStartEdit("");
              }
            }}
            onBlur={(e) => {
              if (skipBlurCommit.current) return;
              onCommitLabel(node.id, e.currentTarget.value);
            }}
            className="w-full h-8 px-2 rounded-lg border border-[var(--accent)] bg-[var(--surface)] text-sm text-[var(--text)] outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={(e) => {
              if (mode !== "edit") return;
              e.preventDefault();
              e.stopPropagation();
              onStartEdit(node.id);
            }}
            className={[
              "w-full text-left whitespace-normal break-words line-clamp-3 text-sm leading-[18px]",
              isRoot
                ? "font-bold text-[var(--accent)]"
                : hasKids
                  ? "font-semibold text-[var(--text)]"
                  : "text-[var(--text)]",
            ].join(" ")}
            title={node.label}
          >
            {node.label}
          </button>
        )}
      </div>

      {Boolean(node.note) && !editing ? (
        <div className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
      ) : null}

      {mode === "edit" && !editing ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleCtx(node.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onToggleCtx(node.id);
              }
            }}
            className="w-7 h-7 rounded-lg hover:bg-[var(--bg3)] text-[var(--text2)] inline-flex items-center justify-center"
            title={t.mindMapsMenu as string}
            aria-haspopup="menu"
            aria-expanded={ctxId === node.id}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {mode === "edit" && ctxId === node.id ? (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-56 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-lg p-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onToggleCtx(node.id);
            }
          }}
          role="menu"
          tabIndex={-1}
        >
          <button
            type="button"
            onClick={() => {
              onToggleCtx(node.id);
              onAddChild(node.id);
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-sm font-semibold hover:bg-[var(--bg2)] text-[var(--text)] inline-flex items-center gap-2"
            role="menuitem"
          >
            <Plus className="w-4 h-4 text-emerald-700" />
            {t.mindMapsAddChild as string}
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleCtx(node.id);
              onAddChildAIImport(node.id);
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-sm font-semibold hover:bg-[var(--bg2)] text-[var(--text)] inline-flex items-center gap-2"
            role="menuitem"
          >
            <Sparkles className="w-4 h-4 text-sky-700" />
            {t.mindMapsAIImportTreeAdd as string}
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleCtx(node.id);
              onOpenAI(node.id);
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-sm font-semibold hover:bg-[var(--bg2)] text-[var(--text)] inline-flex items-center gap-2"
            role="menuitem"
          >
            <Sparkles className="w-4 h-4 text-sky-700" />
            {(t.mindMapsAIAddTitle as string).replace(/^✦\s*/, "")}
          </button>

          <div className="my-1 h-px bg-[var(--border)]" />

          {!isRoot ? (
            <button
              type="button"
              onClick={() => {
                onToggleCtx(node.id);
                onInsertAbove(node.id);
              }}
              className="w-full px-3 py-2 rounded-xl text-left text-sm font-semibold hover:bg-[var(--bg2)] text-[var(--text)] inline-flex items-center gap-2"
              role="menuitem"
            >
              <ArrowUp className="w-4 h-4 text-[var(--text2)]" />
              {t.mindMapsInsertAbove as string}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onToggleCtx(node.id);
              onStartEdit(node.id);
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-sm font-semibold hover:bg-[var(--bg2)] text-[var(--text)] inline-flex items-center gap-2"
            role="menuitem"
          >
            <Pencil className="w-4 h-4 text-[var(--text2)]" />
            {t.mindMapsRename as string}
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleCtx(node.id);
              onExportToOtherMap(node.id);
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-sm font-semibold hover:bg-[var(--bg2)] text-[var(--text)] inline-flex items-center gap-2"
            role="menuitem"
          >
            <FolderInput className="w-4 h-4 text-[var(--text2)]" />
            {t.mindMapsExportToOtherMap as string}
          </button>

          {!isRoot ? <div className="my-1 h-px bg-[var(--border)]" /> : null}

          {!isRoot ? (
            <button
              type="button"
              onClick={() => {
                onToggleCtx(node.id);
                onRequestDelete(node.id);
              }}
              className="w-full px-3 py-2 rounded-xl text-left text-sm font-semibold hover:bg-red-50 text-red-700 inline-flex items-center gap-2"
              role="menuitem"
            >
              <X className="w-4 h-4" />
              {t.mindMapsDeleteNode as string}
            </button>
          ) : null}
        </div>
      ) : null}

      {mode === "edit" ? (
        <div
          onMouseDown={(e) => startResize(e, depth)}
          className="absolute right-0 top-0 h-full w-3 cursor-col-resize opacity-0 hover:opacity-100 transition-opacity"
          title={t.mindMapsResizeColTitle as string}
        >
          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded bg-[var(--border)]" />
        </div>
      ) : null}
    </div>
  );
}
