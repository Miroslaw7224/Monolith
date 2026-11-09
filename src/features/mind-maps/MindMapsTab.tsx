"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Network,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Loader2,
  ArrowLeft,
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
import { NoteEditor } from "@/src/components/NoteEditor";
import { MindMapTree } from "@/src/features/mind-maps/MindMapTree";
import { clamp } from "@/src/features/mind-maps/mindMapClamp";
import { MindMapList } from "@/src/features/mind-maps/MindMapList";
import { ExportSubtreeToMapModal } from "@/src/features/mind-maps/ExportSubtreeToMapModal";
import { MindMapDeleteModal } from "@/src/features/mind-maps/MindMapDeleteModal";
import { MindMapAIModal } from "@/src/features/mind-maps/MindMapAIModal";
import { MindMapAIImportTreeModal } from "@/src/features/mind-maps/MindMapAIImportTreeModal";
import type { translations } from "@/src/translations";

type AINodeResult = { label: string; description: string };
type T = (typeof translations)["en"];

const DEFAULT_NOTES_PANEL_H = 224; // tailwind h-56 (~14rem) -> 224px
const MIN_NOTES_PANEL_H = 120;
const MAX_NOTES_PANEL_H = 520;

function zoomAt(
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

export function MindMapsTab({
  apiFetch,
  title,
  t,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  title: string;
  t: T;
}) {
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<MindMap | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeletingMap, setIsDeletingMap] = useState(false);

  const refreshList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await apiFetch("/api/mind-maps");
      if (!res.ok) return;
      const data = (await res.json()) as MindMap[];
      setMaps(data);
    } finally {
      setIsLoadingList(false);
    }
  }, [apiFetch]);

  const loadMap = useCallback(
    async (id: string) => {
      setIsLoadingMap(true);
      try {
        const res = await apiFetch(`/api/mind-maps/${id}`);
        if (!res.ok) return;
        const data = (await res.json()) as MindMap;
        setSelectedMap(data);
      } finally {
        setIsLoadingMap(false);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedMap(null);
      return;
    }
    void loadMap(selectedId);
  }, [selectedId, loadMap]);

  const createMap = useCallback(async () => {
    setIsCreating(true);
    try {
      const res = await apiFetch("/api/mind-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nowa mapa" }),
      });
      if (!res.ok) return;
      const created = (await res.json()) as MindMap;
      await refreshList();
      setSelectedId(created.id);
    } finally {
      setIsCreating(false);
    }
  }, [apiFetch, refreshList]);

  const deleteMap = useCallback(async () => {
    if (!selectedId) return;
    setIsDeletingMap(true);
    try {
      const res = await apiFetch(`/api/mind-maps/${selectedId}`, { method: "DELETE" });
      if (!res.ok) return;
      setSelectedId(null);
      await refreshList();
    } finally {
      setIsDeletingMap(false);
    }
  }, [apiFetch, refreshList, selectedId]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
      <div className="p-6 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {selectedMap ? (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)] inline-flex items-center gap-2 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              {t.mindMapsList as string}
            </button>
          ) : null}
          <div className="w-10 h-10 bg-[var(--bg3)] rounded-2xl flex items-center justify-center flex-shrink-0">
            <Network className="w-5 h-5 text-[var(--text)]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{title}</h2>
            <p className="text-xs text-[var(--text3)]">
              {selectedMap
                ? (t.mindMapsHeaderSubtitleWithMap as string)
                : (t.mindMapsHeaderSubtitleNoMap as string)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!selectedMap ? (
            <button
              type="button"
              onClick={createMap}
              disabled={isCreating}
              className="px-3 py-2 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {t.mindMapsNewMap as string}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={deleteMap}
                disabled={isDeletingMap}
                className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold text-sm hover:bg-red-100 disabled:opacity-60 inline-flex items-center gap-2"
                title={t.mindMapsDeleteMapTitle as string}
              >
                {isDeletingMap ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {t.mindMapsDelete as string}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        {!selectedMap ? (
          <MindMapList
            apiFetch={apiFetch}
            maps={maps}
            isLoading={isLoadingList}
            onCreate={createMap}
            isCreating={isCreating}
            onOpen={(id) => setSelectedId(id)}
            onCreatedNew={(id) => setSelectedId(id)}
            onRefreshList={refreshList}
            t={t}
          />
        ) : isLoadingMap ? (
          <div className="h-full flex items-center justify-center text-[var(--text3)]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {t.mindMapsLoadingMap as string}
          </div>
        ) : (
          <MindMapEditor
            apiFetch={apiFetch}
            map={selectedMap}
            onChanged={(next) => {
              setSelectedMap((current) => (current?.id === next.id ? next : current));
            }}
            onRefreshList={refreshList}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function MindMapEditor({
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

  const [notesPanelH, setNotesPanelH] = useState<number>(DEFAULT_NOTES_PANEL_H);
  const notesResizingRef = useRef<null | { startY: number; startH: number }>(null);
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

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
        <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2 flex-wrap">
          <label className="relative flex-1 min-w-40 max-w-xs">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setMatchCursor(0);
              }}
              placeholder={t.mindMapsSearchPlaceholder as string}
              className="w-full h-9 pl-8 pr-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none"
            />
          </label>
          <span className="text-xs text-[var(--text3)] min-w-16">
            {query.trim()
              ? matches.length
                ? `${(matchCursor % matches.length) + 1}/${matches.length}`
                : (t.mindMapsSearchNone as string)
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
              title={t.mindMapsUndo as string}
              disabled={!canUndo}
              onClick={undo}
              className="h-9 w-9 rounded-lg border border-[var(--border)] inline-flex items-center justify-center disabled:opacity-40"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              title={t.mindMapsRedo as string}
              disabled={!canRedo}
              onClick={redo}
              className="h-9 w-9 rounded-lg border border-[var(--border)] inline-flex items-center justify-center disabled:opacity-40"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              title={t.mindMapsZoomOut as string}
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
              title={t.mindMapsZoomIn as string}
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
              title={t.mindMapsFit as string}
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
              {t.mindMapsFit as string}
            </button>
          </div>
        </div>
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
              const maxH = Math.max(
                MIN_NOTES_PANEL_H,
                Math.min(MAX_NOTES_PANEL_H, viewportH * 0.65)
              );
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
                  onContentChange={updateSelectedNote}
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
