"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Plus,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { nanoid } from "nanoid";
import type { MindMap, MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { DEFAULT_COL_W, MAX_COL_W, MIN_COL_W } from "@/src/features/mind-maps/mindMapTypes";
import { exportHTML } from "@/src/features/mind-maps/mindMapExportHtml";
import {
  deleteNodeKeepChildren,
  findNode,
  insertNodeAbove,
  insertSiblingAfter,
  mapAllNodes,
  mapNode,
  moveNodeUnder,
  moveSibling,
  removeNode,
} from "@/src/lib/mindMapUtils";
import { findLabelMatches, revealMatches } from "@/src/features/mind-maps/mindMapNav";
import { useMindMapDocument } from "@/src/features/mind-maps/useMindMapDocument";
import { MindMapTree } from "@/src/features/mind-maps/MindMapTree";
import { clamp } from "@/src/features/mind-maps/mindMapClamp";
import { MindMapEditorToolbar, zoomAt } from "@/src/features/mind-maps/MindMapEditorToolbar";
import { useMindMapEditorShortcuts } from "@/src/features/mind-maps/mindMapEditorShortcuts";
import { MindMapNotesPanel } from "@/src/features/mind-maps/MindMapNotesPanel";
import { ExportSubtreeToMapModal } from "@/src/features/mind-maps/ExportSubtreeToMapModal";
import { MindMapDeleteModal } from "@/src/features/mind-maps/MindMapDeleteModal";
import { MindMapAIModal } from "@/src/features/mind-maps/MindMapAIModal";
import { MindMapAIImportTreeModal } from "@/src/features/mind-maps/MindMapAIImportTreeModal";
import type { translations } from "@/src/translations";

type AINodeResult = { label: string; description: string };
type T = (typeof translations)["en"];

export function MindMapEditor({
  apiFetch,
  map,
  onChanged,
  onRefreshList,
  t,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  map: MindMap;
  onChanged: (next: MindMap) => void;
  onRefreshList: () => Promise<void>;
  t: T;
}) {
  const doc = useMindMapDocument({ map, apiFetch, onChanged, onRefreshList });
  const {
    rootNode,
    colWidths,
    undo,
    redo,
    previewColWidth,
    commitColWidths,
    savePhase,
    lastSavedAt,
    canUndo,
    canRedo,
    retrySave,
  } = doc;

  const [selId, setSelId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [ctxId, setCtxId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const [deleteNodeId, setDeleteNodeId] = useState<string | null>(null);
  const [aiParentId, setAiParentId] = useState<string | null>(null);
  const [aiImportParentId, setAiImportParentId] = useState<string | null>(null);
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);
  const [exportToMapNodeId, setExportToMapNodeId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [matchCursor, setMatchCursor] = useState(0);
  const [view, setView] = useState({ scale: 1, x: 24, y: 24 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const resizingRef = useRef<null | { depth: number; startX: number; startW: number }>(null);

  const selectedNode = useMemo(() => (selId ? findNode(rootNode, selId) : null), [rootNode, selId]);
  const matches = useMemo(() => findLabelMatches(rootNode, query), [rootNode, query]);
  const activeMatchId = matches.length > 0 ? matches[matchCursor % matches.length] : null;
  const highlightedIds = useMemo(() => new Set(matches), [matches]);
  const displayRoot = useMemo(
    () => (query.trim() ? revealMatches(rootNode, highlightedIds) : rootNode),
    [highlightedIds, query, rootNode]
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    setSelId(null);
    setEditId(null);
    setCtxId(null);
    setDragId(null);
    setDropId(null);
    setDeleteNodeId(null);
    setAiParentId(null);
    setAiImportParentId(null);
    setIsAiImportOpen(false);
    setExportToMapNodeId(null);
    setQuery("");
    setMatchCursor(0);
    setView({ scale: 1, x: 24, y: 24 });
    // Important: only reset editor-local UI when switching to a different map.
    // Autosave updates `map.rootNode` / `map.colWidths` via `onChanged`, and resetting
    // local selection/edit state on every autosave makes the "preview" / UI disappear.
  }, [map.id]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useMindMapEditorShortcuts(undo, redo);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const factor = event.deltaY < 0 ? 1.1 : 0.9;
        setView((current) => zoomAt(current, factor, event.clientX, event.clientY, viewport));
        return;
      }
      setView((current) => ({
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!selId) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const el = viewport.querySelector(`[data-mindmap-node="${CSS.escape(selId)}"]`);
    if (!(el instanceof HTMLElement)) return;
    const frame = viewport.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const margin = 32;
    const outside =
      box.left < frame.left + margin ||
      box.right > frame.right - margin ||
      box.top < frame.top + margin ||
      box.bottom > frame.bottom - margin;
    if (!outside) return;
    const dx = frame.left + frame.width / 2 - (box.left + box.width / 2);
    const dy = frame.top + frame.height / 2 - (box.top + box.height / 2);
    setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  }, [selId, activeMatchId]);

  useEffect(() => {
    if (!query.trim() || !activeMatchId) return;
    setSelId(activeMatchId);
  }, [activeMatchId, query]);

  const getColW = useCallback(
    (depth: number) => {
      return colWidths[depth] ?? DEFAULT_COL_W;
    },
    [colWidths]
  );

  useEffect(() => {
    function onDocClick() {
      if (ctxId) setCtxId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [ctxId]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const r = resizingRef.current;
      if (!r) return;
      const dx = e.clientX - r.startX;
      const nextW = clamp(r.startW + dx, MIN_COL_W, MAX_COL_W);
      previewColWidth(r.depth, nextW);
    }
    function onUp() {
      if (!resizingRef.current) return;
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      commitColWidths();
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [previewColWidth, commitColWidths]);

  const startResize = useCallback(
    (e: React.MouseEvent, depth: number) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = { depth, startX: e.clientX, startW: getColW(depth) };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [getColW]
  );

  const resetWidths = useCallback(() => {
    doc.applyColWidths({});
  }, [doc]);

  const collapseAll = useCallback(() => {
    doc.updateTree(
      (root) =>
        mapAllNodes(root, (n) =>
          n.id === "root" ? n : { ...n, collapsed: n.children.length > 0 }
        ),
      { kind: "view" }
    );
  }, [doc]);

  const expandAll = useCallback(() => {
    doc.updateTree((root) => mapAllNodes(root, (n) => ({ ...n, collapsed: false })), {
      kind: "view",
    });
  }, [doc]);

  const toggleCollapsed = useCallback(
    (id: string) => {
      doc.updateTree((root) => mapNode(root, id, (n) => ({ ...n, collapsed: !n.collapsed })), {
        kind: "view",
      });
    },
    [doc]
  );

  const commitLabel = useCallback(
    (id: string, nextLabel: string) => {
      const trimmed = nextLabel.trim();
      setEditId(null);
      if (!trimmed) return;
      doc.updateTree(
        (root) => {
          const current = findNode(root, id);
          if (!current || current.label === trimmed) return root;
          return mapNode(root, id, (n) => ({ ...n, label: trimmed }));
        },
        { kind: "structure" }
      );
    },
    [doc]
  );

  const addChild = useCallback(
    (parentId: string) => {
      const nid = nanoid();
      doc.updateTree(
        (root) =>
          mapNode(root, parentId, (n) => ({
            ...n,
            collapsed: false,
            children: [
              ...n.children,
              {
                id: nid,
                label: t.mindMapsNewNode as string,
                note: "",
                collapsed: false,
                children: [],
              },
            ],
          })),
        { kind: "structure" }
      );
      setSelId(nid);
      setEditId(nid);
    },
    [doc, t]
  );

  const addSibling = useCallback(
    (siblingId: string) => {
      if (siblingId === "root") return;
      const nid = nanoid();
      doc.updateTree(
        (root) =>
          insertSiblingAfter(root, siblingId, {
            id: nid,
            label: t.mindMapsNewNode as string,
            note: "",
            collapsed: false,
            children: [],
          }),
        { kind: "structure" }
      );
      setSelId(nid);
      setEditId(nid);
    },
    [doc, t]
  );

  const reorderSibling = useCallback(
    (id: string, delta: -1 | 1) => {
      doc.updateTree((root) => moveSibling(root, id, delta), { kind: "structure" });
    },
    [doc]
  );

  const insertAbove = useCallback(
    (childId: string) => {
      const nid = nanoid();
      doc.updateTree(
        (root) =>
          insertNodeAbove(root, childId, {
            id: nid,
            label: t.mindMapsNewCategory as string,
            note: "",
            collapsed: false,
            children: [],
          }),
        { kind: "structure" }
      );
      setCtxId(null);
      setSelId(nid);
      setEditId(nid);
    },
    [doc, t]
  );

  const requestDelete = useCallback(
    (id: string) => {
      if (id === "root") return;
      setCtxId(null);
      setDeleteNodeId(id);
    },
    [setDeleteNodeId]
  );

  const confirmDelete = useCallback(
    (id: string, keepChildren: boolean) => {
      if (selId === id) setSelId(null);
      setDeleteNodeId(null);
      doc.updateTree(
        (root) => (keepChildren ? deleteNodeKeepChildren(root, id) : removeNode(root, id)),
        { kind: "structure" }
      );
    },
    [doc, selId]
  );

  const onDragStart = useCallback((id: string) => {
    if (id === "root") return;
    setDragId(id);
  }, []);

  const onDragOver = useCallback(
    (id: string) => {
      if (dragId && id !== dragId) setDropId(id);
    },
    [dragId]
  );

  const onDrop = useCallback(
    (targetId: string) => {
      if (dragId && targetId && dragId !== targetId) {
        doc.updateTree(
          (root) => {
            const next = moveNodeUnder(root, dragId, targetId);
            if (next === root) return root;
            return mapNode(next, targetId, (n) => ({ ...n, collapsed: false }));
          },
          { kind: "structure" }
        );
      }
      setDragId(null);
      setDropId(null);
    },
    [doc, dragId]
  );

  const onDragEnd = useCallback(() => {
    setDragId(null);
    setDropId(null);
  }, []);

  const openAI = useCallback((parentId: string) => {
    setCtxId(null);
    setAiParentId(parentId);
  }, []);

  const acceptAI = useCallback(
    (parentId: string, result: AINodeResult) => {
      const nid = nanoid();
      doc.updateTree(
        (root) =>
          mapNode(root, parentId, (n) => ({
            ...n,
            collapsed: false,
            children: [
              ...n.children,
              {
                id: nid,
                label: result.label,
                note: result.description,
                collapsed: false,
                children: [],
              },
            ],
          })),
        { kind: "structure" }
      );
      setAiParentId(null);
      setSelId(nid);
    },
    [doc]
  );

  const cloneWithNewNodeIds = useCallback((node: MindMapNode): MindMapNode => {
    return {
      ...node,
      id: nanoid(),
      children: node.children.map((c) => cloneWithNewNodeIds(c)),
    };
  }, []);

  const cloneExportSubtree = useCallback((): MindMapNode | null => {
    if (!exportToMapNodeId) return null;
    const sub = findNode(rootNode, exportToMapNodeId);
    return sub ? cloneWithNewNodeIds(sub) : null;
  }, [exportToMapNodeId, rootNode, cloneWithNewNodeIds]);

  const acceptAIImportTree = useCallback(
    (parentId: string, importedRoot: MindMapNode) => {
      // `/api/mind-maps/import` returns a "root" wrapper node with id="root".
      // We insert only its children under the selected parent.
      const importedChildren = importedRoot.children;
      const clonedChildren = importedChildren.map((c) => cloneWithNewNodeIds(c));
      if (clonedChildren.length === 0) return;

      doc.updateTree(
        (root) =>
          mapNode(root, parentId, (n) => ({
            ...n,
            collapsed: false,
            children: [...n.children, ...clonedChildren],
          })),
        { kind: "structure" }
      );

      setAiImportParentId(null);
      setIsAiImportOpen(false);
      setAiParentId(null);
      setCtxId(null);
      setDragId(null);
      setDropId(null);

      setSelId(clonedChildren[0].id);
      setEditId(clonedChildren[0].id);
    },
    [cloneWithNewNodeIds, doc]
  );

  const updateSelectedNote = useCallback(
    (html: string) => {
      if (!selId) return;
      const nodeId = selId;
      doc.updateTree(
        (root) => {
          const current = findNode(root, nodeId);
          if (!current || current.note === html) return root;
          return mapNode(root, nodeId, (n) => ({ ...n, note: html }));
        },
        { kind: "note", nodeId, at: Date.now() }
      );
    },
    [doc, selId]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-3">
        <div className="text-sm text-[var(--text3)] flex items-center gap-2 min-w-0">
          <span className="font-semibold text-[var(--accent)]">
            {t.mindMapsBreadcrumbApp as string}
          </span>
          <ChevronRight className="w-4 h-4" />
          <span>{t.mindMapsBreadcrumbMindMaps as string}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="font-semibold text-[var(--text)] truncate">{rootNode.label}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] text-sm font-semibold hover:bg-[var(--bg2)] inline-flex items-center gap-2"
          >
            <ChevronsDownUp className="w-4 h-4" />
            {t.mindMapsCollapseAll as string}
          </button>
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] text-sm font-semibold hover:bg-[var(--bg2)] inline-flex items-center gap-2"
          >
            <ChevronsUpDown className="w-4 h-4" />
            {t.mindMapsExpandAll as string}
          </button>
          <button
            type="button"
            onClick={() => exportHTML(map)}
            className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] text-sm font-semibold hover:bg-[var(--bg2)] inline-flex items-center gap-2"
            title={t.mindMapsExportHtmlTitle as string}
          >
            ↓ {t.mindMapsExportHtml as string}
          </button>
          <button
            type="button"
            onClick={resetWidths}
            className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] text-sm font-semibold hover:bg-[var(--bg2)] inline-flex items-center gap-2"
            title={t.mindMapsResetWidthsTitle as string}
          >
            <RotateCcw className="w-4 h-4" />
            {t.mindMapsReset as string}
          </button>
          <button
            type="button"
            onClick={() => addChild("root")}
            className="px-3 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-95 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.mindMapsNewNode as string}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <MindMapEditorToolbar
          t={t}
          query={query}
          setQuery={setQuery}
          matches={matches}
          matchCursor={matchCursor}
          setMatchCursor={setMatchCursor}
          canUndo={canUndo}
          canRedo={canRedo}
          undo={undo}
          redo={redo}
          view={view}
          setView={setView}
          viewportRef={viewportRef}
          contentRef={contentRef}
        />
        <div
          ref={viewportRef}
          className="flex-1 min-h-0 overflow-hidden relative cursor-grab"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const target = event.target;
            if (target instanceof HTMLElement && target.closest("[data-mindmap-node]")) return;
            const startX = event.clientX;
            const startY = event.clientY;
            const origin = viewRef.current;
            const onMove = (move: PointerEvent) => {
              setView({
                ...origin,
                x: origin.x + move.clientX - startX,
                y: origin.y + move.clientY - startY,
              });
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
        >
          <p className="absolute left-4 top-3 z-10 text-xs text-[var(--text3)] max-w-md pointer-events-none">
            {t.mindMapsDragReparentHint as string}
          </p>
          <div
            ref={contentRef}
            className="inline-flex min-w-max items-center"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              transformOrigin: "0 0",
            }}
          >
            <MindMapTree
              mode="edit"
              rootNode={displayRoot}
              getColW={getColW}
              startResize={startResize}
              t={t}
              selId={selId}
              editId={editId}
              ctxId={ctxId}
              dragId={dragId}
              dropId={dropId}
              highlightedIds={highlightedIds}
              activeMatchId={activeMatchId}
              onSelect={(id) => {
                setCtxId(null);
                setSelId(id);
              }}
              onToggleCollapsed={toggleCollapsed}
              onStartEdit={(id) => {
                setCtxId(null);
                setEditId(id || null);
              }}
              onCommitLabel={commitLabel}
              onToggleCtx={(id) => setCtxId((prev) => (prev === id ? null : id))}
              onAddChild={addChild}
              onAddSibling={addSibling}
              onReorderSibling={reorderSibling}
              onAddChildAIImport={(parentId) => {
                setAiImportParentId(parentId);
                setIsAiImportOpen(true);
                setCtxId(null);
              }}
              onInsertAbove={insertAbove}
              onRequestDelete={requestDelete}
              onOpenAI={openAI}
              onExportToOtherMap={(nodeId) => {
                setExportToMapNodeId(nodeId);
                setCtxId(null);
              }}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          </div>
        </div>

        <MindMapNotesPanel selectedNode={selectedNode} onContentChange={updateSelectedNote} t={t} />
      </div>

      <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--surface)] flex items-center gap-3 text-xs text-[var(--text3)]">
        <div className="inline-flex items-center gap-2">
          {savePhase === "saving" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <div
              className={[
                "w-2 h-2 rounded-full",
                savePhase === "error"
                  ? "bg-red-500"
                  : savePhase === "pending"
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              ].join(" ")}
            />
          )}
          <span className="font-semibold">
            {savePhase === "saving"
              ? (t.mindMapsSaving as string)
              : savePhase === "pending"
                ? (t.mindMapsUnsaved as string)
                : savePhase === "error"
                  ? (t.mindMapsSaveError as string)
                  : (t.mindMapsSaved as string)}
          </span>
          {savePhase === "error" ? (
            <button type="button" className="underline font-semibold" onClick={retrySave}>
              {t.mindMapsRetry as string}
            </button>
          ) : null}
          {lastSavedAt ? <span>· {new Date(lastSavedAt).toLocaleTimeString()}</span> : null}
        </div>
      </div>

      <MindMapDeleteModal
        open={Boolean(deleteNodeId)}
        node={deleteNodeId ? findNode(rootNode, deleteNodeId) : null}
        onClose={() => setDeleteNodeId(null)}
        onConfirm={(keep) => {
          if (!deleteNodeId) return;
          confirmDelete(deleteNodeId, keep);
        }}
        t={t}
      />

      <MindMapAIModal
        open={Boolean(aiParentId)}
        apiFetch={apiFetch}
        onClose={() => setAiParentId(null)}
        onAccept={(result) => {
          if (!aiParentId) return;
          acceptAI(aiParentId, result);
        }}
        t={t}
      />
      <MindMapAIImportTreeModal
        open={isAiImportOpen}
        apiFetch={apiFetch}
        parentId={aiImportParentId}
        onClose={() => {
          setIsAiImportOpen(false);
          setAiImportParentId(null);
        }}
        onInsert={(importedRoot) => {
          if (!aiImportParentId) return;
          acceptAIImportTree(aiImportParentId, importedRoot);
        }}
        t={t}
      />

      <ExportSubtreeToMapModal
        open={Boolean(exportToMapNodeId)}
        currentMapId={map.id}
        sourceNodeLabel={
          exportToMapNodeId ? (findNode(rootNode, exportToMapNodeId)?.label ?? "") : ""
        }
        cloneSubtree={cloneExportSubtree}
        apiFetch={apiFetch}
        onClose={() => setExportToMapNodeId(null)}
        onRefreshList={onRefreshList}
        t={t}
      />
    </div>
  );
}
