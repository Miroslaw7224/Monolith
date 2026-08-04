"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Network,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  MoreHorizontal,
  GripVertical,
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
  leafCount,
  mapAllNodes,
  mapNode,
  moveNodeUnder,
  removeNode,
} from "@/src/lib/mindMapUtils";
import { NoteEditor } from "@/src/components/NoteEditor";
import { MindMapTree } from "@/src/features/mind-maps/MindMapTree";
import type { translations } from "@/src/translations";

type AINodeResult = { label: string; description: string };
type T = (typeof translations)["en"];

const ROW_H = 38;
const GAP_H = 8;
const CONN = 24;
const DEFAULT_NOTES_PANEL_H = 224; // tailwind h-56 (~14rem) -> 224px
const MIN_NOTES_PANEL_H = 120;
const MAX_NOTES_PANEL_H = 520;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function formatDateLike(d: unknown): string {
  try {
    if (!d) return "";
    const ms =
      typeof d === "string"
        ? Date.parse(d)
        : typeof d === "number"
          ? d
          : (d as { toMillis?: () => number } | undefined)?.toMillis?.();
    if (!ms) return "";
    return new Date(ms).toLocaleDateString();
  } catch {
    return "";
  }
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
            onChanged={setSelectedMap}
            onRefreshList={refreshList}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function MindMapList({
  apiFetch,
  maps,
  isLoading,
  isCreating,
  onCreate,
  onOpen,
  onCreatedNew,
  onRefreshList,
  t,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  maps: MindMap[];
  isLoading: boolean;
  isCreating: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onCreatedNew: (id: string) => void;
  onRefreshList: () => Promise<void>;
  t: T;
}) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  return (
    <div className="h-full overflow-auto p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={isCreating}
          className="group border-2 border-dashed border-[var(--border)] rounded-2xl p-5 text-left hover:bg-[var(--bg2)] transition-colors disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--bg3)] flex items-center justify-center">
              {isCreating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="font-bold">{t.mindMapsCreateCardTitle as string}</div>
              <div className="text-xs text-[var(--text3)]">
                {t.mindMapsCreateCardSubtitle as string}
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIsImportOpen(true)}
          className="group border-2 border-dashed border-[var(--border)] rounded-2xl p-5 text-left hover:bg-[var(--bg2)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--bg3)] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold">{t.mindMapsImportCardTitle as string}</div>
              <div className="text-xs text-[var(--text3)]">
                {t.mindMapsImportCardSubtitle as string}
              </div>
            </div>
          </div>
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--surface)]">
            <div className="animate-pulse h-4 bg-[var(--bg3)] rounded mb-2 w-2/3" />
            <div className="animate-pulse h-3 bg-[var(--bg3)] rounded w-1/2" />
          </div>
        ) : maps.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 border border-[var(--border)] rounded-2xl p-8 bg-[var(--surface)]">
            <div className="text-sm text-[var(--text3)] font-semibold">
              {t.mindMapsNoMaps as string}
            </div>
          </div>
        ) : (
          maps.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpen(m.id)}
              className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--surface)] hover:bg-[var(--bg2)] transition-colors text-left"
            >
              <div className="font-bold truncate">{m.title || "Bez tytułu"}</div>
              <div className="mt-1 text-xs text-[var(--text3)]">
                {formatDateLike(m.updatedAt) ? `Aktualizacja: ${formatDateLike(m.updatedAt)}` : "—"}
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-widest text-[var(--text3)] font-bold">
                {leafCount(m.rootNode)} liści
              </div>
            </button>
          ))
        )}
      </div>

      <MindMapImportModal
        open={isImportOpen}
        apiFetch={apiFetch}
        onClose={() => setIsImportOpen(false)}
        onCreatedNew={onCreatedNew}
        onRefreshList={onRefreshList}
        t={t}
      />
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
  const [rootNode, setRootNode] = useState<MindMapNode>(map.rootNode);
  const [colWidths, setColWidths] = useState<Record<number, number>>(map.colWidths ?? {});

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

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [notesPanelH, setNotesPanelH] = useState<number>(DEFAULT_NOTES_PANEL_H);
  const notesResizingRef = useRef<null | { startY: number; startH: number }>(null);

  const resizingRef = useRef<null | { depth: number; startX: number; startW: number }>(null);
  const saveTimerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  const selectedNode = useMemo(() => (selId ? findNode(rootNode, selId) : null), [rootNode, selId]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    setRootNode(map.rootNode);
    setColWidths(map.colWidths ?? {});
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
    // Important: only reset editor-local UI when switching to a different map.
    // Autosave updates `map.rootNode` / `map.colWidths` via `onChanged`, and resetting
    // local selection/edit state on every autosave makes the "preview" / UI disappear.
  }, [map.id]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

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

  const scheduleSave = useCallback(
    (nextRoot: MindMapNode, nextColWidths: Record<number, number>) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        setIsSaving(true);
        try {
          const res = await apiFetch(`/api/mind-maps/${map.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rootNode: nextRoot,
              colWidths: nextColWidths,
              title: nextRoot.label,
            }),
          });
          if (!res.ok) return;
          setLastSavedAt(Date.now());
          onChanged({
            ...map,
            rootNode: nextRoot,
            colWidths: nextColWidths,
            title: nextRoot.label,
          });
          await onRefreshList();
        } finally {
          if (!unmountedRef.current) setIsSaving(false);
        }
      }, 1500);
    },
    [apiFetch, map, onChanged, onRefreshList]
  );

  const applyTree = useCallback(
    (nextRoot: MindMapNode) => {
      setRootNode(nextRoot);
      scheduleSave(nextRoot, colWidths);
    },
    [colWidths, scheduleSave]
  );

  const applyColWidths = useCallback(
    (next: Record<number, number>) => {
      setColWidths(next);
      scheduleSave(rootNode, next);
    },
    [rootNode, scheduleSave]
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
      setColWidths((prev) => ({ ...prev, [r.depth]: nextW }));
    }
    function onUp() {
      if (!resizingRef.current) return;
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      applyColWidths({ ...colWidths });
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [applyColWidths, colWidths]);

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
    applyColWidths({});
  }, [applyColWidths]);

  const collapseAll = useCallback(() => {
    const next = mapAllNodes(rootNode, (n) =>
      n.id === "root" ? n : { ...n, collapsed: n.children.length > 0 }
    );
    applyTree(next);
  }, [applyTree, rootNode]);

  const expandAll = useCallback(() => {
    const next = mapAllNodes(rootNode, (n) => ({ ...n, collapsed: false }));
    applyTree(next);
  }, [applyTree, rootNode]);

  const toggleCollapsed = useCallback(
    (id: string) => {
      const next = mapNode(rootNode, id, (n) => ({ ...n, collapsed: !n.collapsed }));
      applyTree(next);
    },
    [applyTree, rootNode]
  );

  const commitLabel = useCallback(
    (id: string, nextLabel: string) => {
      const trimmed = nextLabel.trim();
      if (!trimmed) return;
      const next = mapNode(rootNode, id, (n) => ({ ...n, label: trimmed }));
      setEditId(null);
      applyTree(next);
    },
    [applyTree, rootNode]
  );

  const addChild = useCallback(
    (parentId: string) => {
      const nid = nanoid();
      const next = mapNode(rootNode, parentId, (n) => ({
        ...n,
        collapsed: false,
        children: [
          ...n.children,
          { id: nid, label: "Nowy węzeł", note: "", collapsed: false, children: [] },
        ],
      }));
      setSelId(nid);
      setEditId(nid);
      applyTree(next);
    },
    [applyTree, rootNode]
  );

  const insertAbove = useCallback(
    (childId: string) => {
      const nid = nanoid();
      const next = insertNodeAbove(rootNode, childId, {
        id: nid,
        label: "Nowa kategoria",
        note: "",
        collapsed: false,
        children: [],
      });
      setCtxId(null);
      setSelId(nid);
      setEditId(nid);
      applyTree(next);
    },
    [applyTree, rootNode]
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
      const next = keepChildren ? deleteNodeKeepChildren(rootNode, id) : removeNode(rootNode, id);
      if (selId === id) setSelId(null);
      setDeleteNodeId(null);
      applyTree(next);
    },
    [applyTree, rootNode, selId]
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
        const next = moveNodeUnder(rootNode, dragId, targetId);
        if (next !== rootNode) {
          const expanded = mapNode(next, targetId, (n) => ({ ...n, collapsed: false }));
          applyTree(expanded);
        }
      }
      setDragId(null);
      setDropId(null);
    },
    [applyTree, dragId, rootNode]
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
      const next = mapNode(rootNode, parentId, (n) => ({
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
      }));
      setAiParentId(null);
      setSelId(nid);
      applyTree(next);
    },
    [applyTree, rootNode]
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

      const next = mapNode(rootNode, parentId, (n) => ({
        ...n,
        collapsed: false,
        children: [...n.children, ...clonedChildren],
      }));

      setAiImportParentId(null);
      setIsAiImportOpen(false);
      setAiParentId(null);
      setCtxId(null);
      setDragId(null);
      setDropId(null);

      setSelId(clonedChildren[0].id);
      setEditId(clonedChildren[0].id);
      applyTree(next);
    },
    [
      applyTree,
      cloneWithNewNodeIds,
      rootNode,
      setAiImportParentId,
      setIsAiImportOpen,
      setAiParentId,
      setCtxId,
      setDragId,
      setDropId,
    ]
  );

  const updateSelectedNote = useCallback(
    (html: string) => {
      if (!selId) return;
      const next = mapNode(rootNode, selId, (n) => ({ ...n, note: html }));
      applyTree(next);
    },
    [applyTree, rootNode, selId]
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
        <div className="flex-1 overflow-auto p-6">
          <p className="text-xs text-[var(--text3)] mb-3 max-w-2xl">
            {t.mindMapsDragReparentHint as string}
          </p>
          <div className="inline-flex min-w-max items-center">
            <MindMapTree
              mode="edit"
              rootNode={rootNode}
              getColW={getColW}
              startResize={startResize}
              t={t}
              selId={selId}
              editId={editId}
              ctxId={ctxId}
              dragId={dragId}
              dropId={dropId}
              onSelect={(id) => {
                setCtxId(null);
                setSelId(id);
              }}
              onToggleCollapsed={toggleCollapsed}
              onStartEdit={(id) => {
                setCtxId(null);
                setEditId(id);
              }}
              onCommitLabel={commitLabel}
              onToggleCtx={(id) => setCtxId((prev) => (prev === id ? null : id))}
              onAddChild={addChild}
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
          className="border-t border-[var(--border)] bg-[var(--surface)] flex overflow-hidden relative"
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
          <div className="w-60 flex-shrink-0 border-r border-[var(--border)] p-4 min-h-0 overflow-y-auto overflow-x-hidden">
            {!selectedNode ? (
              <div className="h-full flex items-center justify-center text-sm text-[var(--text3)] font-semibold text-center">
                {t.mindMapsClickNodeHint as string}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text3)] font-bold">
                    {t.mindMapsSelectedNode as string}
                  </div>
                  <div className="font-bold truncate">{selectedNode.label}</div>
                  <div className="text-xs text-[var(--text3)]">
                    {(t.mindMapsItemsCount as string).replace(
                      "{n}",
                      String(selectedNode.children.length)
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addChild(selectedNode.id)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-semibold hover:bg-[var(--bg3)] inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t.mindMapsAddChild as string}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiImportParentId(selectedNode.id);
                    setIsAiImportOpen(true);
                    setCtxId(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-semibold hover:bg-[var(--bg3)] inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-sky-700" />
                  {t.mindMapsAIImportTreeAdd as string}
                </button>
                {selectedNode.id !== "root" && (
                  <button
                    type="button"
                    onClick={() => insertAbove(selectedNode.id)}
                    className="px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-semibold hover:bg-[var(--bg3)] inline-flex items-center gap-2"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    {t.mindMapsInsertAbove as string}
                  </button>
                )}
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
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
          <span className="font-semibold">
            {isSaving ? (t.mindMapsSaving as string) : (t.mindMapsSaved as string)}
          </span>
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

function ExportSubtreeToMapModal({
  open,
  currentMapId,
  sourceNodeLabel,
  cloneSubtree,
  apiFetch,
  onClose,
  onRefreshList,
  t,
}: {
  open: boolean;
  currentMapId: string;
  sourceNodeLabel: string;
  cloneSubtree: () => MindMapNode | null;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onRefreshList: () => Promise<void>;
  t: T;
}) {
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const targets = useMemo(() => maps.filter((m) => m.id !== currentMapId), [maps, currentMapId]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(false);
    setBusyTargetId(null);
    setListLoading(true);
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch("/api/mind-maps");
        if (!res.ok) {
          if (!cancelled) setError(t.mindMapsExportToOtherMapError as string);
          return;
        }
        const data = (await res.json()) as MindMap[];
        if (!cancelled) setMaps(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError(t.mindMapsExportToOtherMapError as string);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, apiFetch, t]);

  const subtitle = (t.mindMapsExportToOtherMapModalSubtitle as string).replace(
    "{label}",
    sourceNodeLabel || "—"
  );

  const runExport = useCallback(
    async (targetId: string) => {
      const cloned = cloneSubtree();
      if (!cloned) {
        setError(t.mindMapsExportToOtherMapError as string);
        return;
      }
      setBusyTargetId(targetId);
      setError(null);
      try {
        const getRes = await apiFetch(`/api/mind-maps/${targetId}`);
        if (!getRes.ok) {
          setError(t.mindMapsExportToOtherMapError as string);
          return;
        }
        const targetMap = (await getRes.json()) as MindMap;
        const merged = mapNode(targetMap.rootNode, "root", (n) => ({
          ...n,
          collapsed: false,
          children: [...n.children, cloned],
        }));
        const patchRes = await apiFetch(`/api/mind-maps/${targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rootNode: merged }),
        });
        if (!patchRes.ok) {
          setError(t.mindMapsExportToOtherMapError as string);
          return;
        }
        await onRefreshList();
        setSuccess(true);
      } catch {
        setError(t.mindMapsExportToOtherMapError as string);
      } finally {
        setBusyTargetId(null);
      }
    },
    [apiFetch, cloneSubtree, onRefreshList, t]
  );

  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => onClose(), 900);
    return () => window.clearTimeout(id);
  }, [success, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[115] bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 shadow-xl max-h-[min(520px,85vh)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-bold">{t.mindMapsExportToOtherMapModalTitle as string}</div>
        <div className="mt-2 text-sm text-[var(--text3)]">{subtitle}</div>

        <div className="mt-4 text-[10px] uppercase tracking-widest text-[var(--text3)] font-bold">
          {t.mindMapsExportToOtherMapPickMap as string}
        </div>

        {error ? (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-3">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
            {t.mindMapsExportToOtherMapSuccess as string}
          </div>
        ) : null}

        <div className="mt-3 flex-1 min-h-0 overflow-auto space-y-2 pr-1">
          {listLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--text3)]" />
            </div>
          ) : targets.length === 0 ? (
            <div className="text-sm text-[var(--text3)] py-4">
              {t.mindMapsExportToOtherMapNoTargets}
            </div>
          ) : (
            targets.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={Boolean(busyTargetId) || success}
                onClick={() => void runExport(m.id)}
                className="w-full px-3 py-3 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-left text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-60 inline-flex items-center justify-between gap-2"
              >
                <span className="truncate">{m.title || "—"}</span>
                {busyTargetId === m.id ? (
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busyTargetId)}
            className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)] disabled:opacity-60"
          >
            {t.mindMapsCancel as string}
          </button>
        </div>
      </div>
    </div>
  );
}

function MindMapDeleteModal({
  open,
  node,
  onClose,
  onConfirm,
  t,
}: {
  open: boolean;
  node: MindMapNode | null;
  onClose: () => void;
  onConfirm: (keepChildren: boolean) => void;
  t: T;
}) {
  if (!open) return null;
  const hasKids = (node?.children?.length ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-bold">{t.mindMapsDeleteModalTitle as string}</div>
        <div className="mt-1 text-sm text-[var(--text3)]">
          {hasKids
            ? (t.mindMapsDeleteModalHasChildren as string)
            : (t.mindMapsDeleteModalConfirm as string)}
        </div>

        <div className="mt-5 flex gap-2">
          {!hasKids ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)]"
              >
                {t.mindMapsCancel as string}
              </button>
              <button
                type="button"
                onClick={() => onConfirm(false)}
                className="flex-1 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold text-sm hover:bg-red-100"
              >
                {t.mindMapsDelete as string}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onConfirm(true)}
                className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)] text-left"
              >
                <div className="font-bold">{t.mindMapsDeleteOnlyThis as string}</div>
                <div className="text-xs text-[var(--text3)]">
                  {t.mindMapsDeleteOnlyThisHint as string}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onConfirm(false)}
                className="flex-1 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold text-sm hover:bg-red-100 text-left"
              >
                <div className="font-bold">{t.mindMapsDeleteBranch as string}</div>
                <div className="text-xs opacity-80">{t.mindMapsDeleteBranchHint as string}</div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MindMapAIModal({
  open,
  apiFetch,
  onClose,
  onAccept,
  t,
}: {
  open: boolean;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onAccept: (result: AINodeResult) => void;
  t: T;
}) {
  const [q, setQ] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AINodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setIsLoading(false);
      setResult(null);
      setError(null);
    }
  }, [open]);

  const doSearch = useCallback(async () => {
    if (!isNonEmptyString(q)) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch("/api/mind-maps/ai-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() }),
      });
      if (!res.ok) {
        setError("Nie udało się pobrać odpowiedzi AI.");
        return;
      }
      const data = (await res.json()) as AINodeResult;
      if (!isNonEmptyString(data?.label) || !isNonEmptyString(data?.description)) {
        setError("AI zwróciło niepoprawny format.");
        return;
      }
      setResult({ label: data.label, description: data.description });
    } catch {
      setError("Wystąpił błąd podczas wywołania AI.");
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-bold">{t.mindMapsAIAddTitle as string}</div>
        <div className="mt-1 text-sm text-[var(--text3)]">{t.mindMapsAIAddSubtitle as string}</div>

        <div className="mt-4 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void doSearch();
            }}
            placeholder={t.mindMapsAIQueryPlaceholder as string}
            className="flex-1 h-10 px-3 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-sm text-[var(--text)] outline-none focus:border-sky-400"
          />
          <button
            type="button"
            onClick={() => void doSearch()}
            disabled={isLoading || !q.trim()}
            className="px-4 h-10 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {t.mindMapsAISearch as string}
          </button>
        </div>

        {error ? (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-3">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-4">
            <div className="border border-[var(--border)] rounded-2xl bg-[var(--bg2)] p-4">
              <div className="font-bold">{result.label}</div>
              <div className="mt-1 text-sm text-[var(--text2)] leading-relaxed">
                {result.description}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onAccept(result)}
                className="flex-1 px-3 py-2 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-95"
              >
                {t.mindMapsAIAddConfirm as string}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)]"
              >
                {t.mindMapsCancel as string}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-xs text-[var(--text3)] text-center">
            {t.mindMapsAIEnterHint as string}
          </div>
        )}
      </div>
    </div>
  );
}

function MindMapAIImportTreeModal({
  open,
  apiFetch,
  parentId,
  onClose,
  onInsert,
  t,
}: {
  open: boolean;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  parentId: string | null;
  onClose: () => void;
  onInsert: (importedRoot: MindMapNode) => void;
  t: T;
}) {
  const templates = useMemo(
    () => [
      {
        key: "testy-per-modul",
        label: "Testy per moduł",
        structureText: [
          "- testy per moduł",
          "  - profiles",
          "    - unit: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/unit/profiles/ -v",
          "    - integration: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/integration/profiles/ -v",
          "    - e2e: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/e2e/profiles/ -v",
          "    - security: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/security/profiles/ -v",
          "  - storage (type-first + live storage)",
          "    - unit: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/unit/storage/ -v",
          "    - integration: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/integration/storage/ -v",
          "    - e2e: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/e2e/storage/ -v",
          "    - security: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/security/storage/ -v",
          "    - live MinIO/storage: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/storage/ -v (wymaga TEST_JWT_TOKEN)",
        ].join("\n"),
      },
      {
        key: "profiles",
        label: "profiles",
        structureText: [
          "- profiles",
          "  - unit: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/unit/profiles/ -v",
          "  - integration: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/integration/profiles/ -v",
          "  - e2e: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/e2e/profiles/ -v",
          "  - security: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/security/profiles/ -v",
        ].join("\n"),
      },
      {
        key: "storage",
        label: "storage (type-first + live storage)",
        structureText: [
          "- storage (type-first + live storage)",
          "  - unit: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/unit/storage/ -v",
          "  - integration: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/integration/storage/ -v",
          "  - e2e: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/e2e/storage/ -v",
          "  - security: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/security/storage/ -v",
          "  - live MinIO/storage: docker-compose -p career-guide-test -f compose.test.yml run --rm test-runner pytest tests/storage/ -v (wymaga TEST_JWT_TOKEN)",
        ].join("\n"),
      },
    ],
    []
  );

  const [templateKey, setTemplateKey] = useState<string>(templates[0]?.key ?? "testy-per-modul");
  const [text, setText] = useState<string>(templates[0]?.structureText ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootNode, setRootNode] = useState<MindMapNode | null>(null);

  useEffect(() => {
    if (!open) return;
    const defaultTemplate = templates[0];
    setTemplateKey(defaultTemplate?.key ?? "");
    setText(defaultTemplate?.structureText ?? "");
    setFile(null);
    setIsAnalyzing(false);
    setError(null);
    setRootNode(null);
  }, [open, templates]);

  useEffect(() => {
    if (!open) return;
    const nextTemplate = templates.find((x) => x.key === templateKey);
    if (nextTemplate) setText(nextTemplate.structureText);
  }, [templateKey, open, templates]);

  const doAnalyze = useCallback(async () => {
    if (!text.trim() && !file) return;
    setIsAnalyzing(true);
    setError(null);
    setRootNode(null);
    try {
      const fd = new FormData();
      fd.set("structureText", text.trim());
      if (file) fd.set("image", file);

      const res = await apiFetch("/api/mind-maps/import", { method: "POST", body: fd });
      if (!res.ok) {
        setError(t.mindMapsImportAnalyzeError as string);
        return;
      }
      const data = (await res.json()) as { rootNode?: MindMapNode };
      if (!data?.rootNode) {
        setError(t.mindMapsImportInvalidAIFormat as string);
        return;
      }
      setRootNode(data.rootNode);
    } catch {
      setError(t.mindMapsImportGenericError as string);
    } finally {
      setIsAnalyzing(false);
    }
  }, [apiFetch, file, t, text]);

  if (!open) return null;

  const canAnalyze = Boolean(text.trim() || file);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/30 flex items-center justify-center p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-280px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-bold">{t.mindMapsAIImportTreeModalTitle as string}</div>
        <div className="mt-1 text-sm text-[var(--text3)]">
          {parentId ? "Wybrano węzeł docelowy. Wstaw wynik do podmenu." : "Wybierz węzeł docelowy."}
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
          <div className="lg:col-span-1 flex flex-col gap-2 min-h-0">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text3)] font-bold">
              Szablony
            </div>

            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="h-10 px-3 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-sm text-[var(--text)] outline-none"
            >
              {templates.map((tpl) => (
                <option key={tpl.key} value={tpl.key}>
                  {tpl.label}
                </option>
              ))}
            </select>

            <div className="text-[10px] uppercase tracking-widest text-[var(--text3)] font-bold leading-none">
              Opcjonalnie obraz
            </div>
            <label className="w-full px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)] cursor-pointer text-center">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              Wybierz obraz
            </label>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.mindMapsImportTextareaPlaceholder as string}
              className="w-full flex-1 min-h-0 p-3 rounded-2xl bg-[var(--bg2)] border border-[var(--border)] text-sm text-[var(--text)] outline-none focus:border-sky-400 resize-none"
            />

            {error ? (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-3">
                {error}
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void doAnalyze()}
                disabled={isAnalyzing || !canAnalyze}
                className="flex-1 px-3 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {t.mindMapsImportAnalyze as string}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-3 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)]"
              >
                {t.mindMapsCancel as string}
              </button>
            </div>

            <div className="flex-1 min-h-0 border border-[var(--border)] rounded-2xl bg-[var(--bg2)] p-3 overflow-auto">
              {rootNode ? (
                <div className="inline-flex min-w-max items-center">
                  <MindMapTree mode="readOnly" rootNode={rootNode} allowCollapse t={t} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-[var(--text3)] font-semibold text-center">
                  {t.mindMapsImportPreviewHintImageOrText as string}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (!rootNode) return;
                onInsert(rootNode);
              }}
              disabled={!rootNode || !parentId}
              className="w-full px-3 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center justify-center"
            >
              {t.mindMapsAIImportTreeInsert as string}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MindMapImportModal({
  open,
  apiFetch,
  onClose,
  onCreatedNew,
  onRefreshList,
  t,
}: {
  open: boolean;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onCreatedNew: (id: string) => void;
  onRefreshList: () => Promise<void>;
  t: T;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootNode, setRootNode] = useState<MindMapNode | null>(null);
  const [isPreviewFullScreen, setIsPreviewFullScreen] = useState(false);

  const addImageParts = t.mindMapsImportAddImage.split(" ");
  const addImageTop = addImageParts[0] ?? t.mindMapsImportAddImage;
  const addImageBottom = addImageParts.slice(1).join(" ");

  const removeImageParts = t.mindMapsImportRemoveImage.split(" ");
  const removeImageTop = removeImageParts[0] ?? t.mindMapsImportRemoveImage;
  const removeImageBottom = removeImageParts.slice(1).join(" ");

  useEffect(() => {
    if (!open) {
      setText("");
      setFile(null);
      setIsAnalyzing(false);
      setIsSaving(false);
      setError(null);
      setRootNode(null);
      setIsPreviewFullScreen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !isPreviewFullScreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPreviewFullScreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isPreviewFullScreen]);

  const doAnalyze = useCallback(async () => {
    if (!text.trim() && !file) return;
    setIsAnalyzing(true);
    setError(null);
    setRootNode(null);
    try {
      const fd = new FormData();
      fd.set("structureText", text.trim());
      if (file) fd.set("image", file);

      const res = await apiFetch("/api/mind-maps/import", { method: "POST", body: fd });
      if (!res.ok) {
        setError(t.mindMapsImportAnalyzeError as string);
        return;
      }
      const data = (await res.json()) as { rootNode?: MindMapNode };
      if (!data?.rootNode) {
        setError(t.mindMapsImportInvalidAIFormat as string);
        return;
      }
      setRootNode(data.rootNode);
    } catch {
      setError(t.mindMapsImportGenericError as string);
    } finally {
      setIsAnalyzing(false);
    }
  }, [apiFetch, file, t, text]);

  const doSaveAsNew = useCallback(async () => {
    if (!rootNode) return;
    setIsSaving(true);
    setError(null);
    try {
      const createRes = await apiFetch("/api/mind-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: rootNode.label || "Importowana mapa" }),
      });
      if (!createRes.ok) {
        setError(t.mindMapsImportCreateMapError as string);
        return;
      }
      const created = (await createRes.json()) as MindMap;
      const saveRes = await apiFetch(`/api/mind-maps/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootNode, colWidths: {}, title: rootNode.label }),
      });
      if (!saveRes.ok) {
        setError(t.mindMapsImportSaveMapError as string);
        return;
      }
      await onRefreshList();
      onCreatedNew(created.id);
      onClose();
    } catch {
      setError(t.mindMapsImportSaveMapError as string);
    } finally {
      setIsSaving(false);
    }
  }, [apiFetch, onClose, onCreatedNew, onRefreshList, rootNode, t]);

  if (!open) return null;

  const canAnalyze = Boolean(text.trim() || file);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/30 flex items-center justify-center p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-540px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full">
          <div className="text-lg font-bold text-center">
            {t.mindMapsImportModalTitle as string}
          </div>
          <button
            type="button"
            onClick={() => setIsPreviewFullScreen(true)}
            disabled={!rootNode}
            className="absolute top-0 right-0 mt-1 px-2.5 py-1 rounded-lg bg-[var(--bg2)] border border-[var(--border)] text-[var(--text2)] text-[10px] font-semibold hover:bg-[var(--bg3)] disabled:opacity-60 inline-flex items-center gap-2 leading-none whitespace-nowrap"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            {t.mindMapsImportPreviewFullScreen as string}
          </button>
        </div>

        <div className="mt-1 text-sm text-[var(--text3)] text-center">
          {t.mindMapsImportModalSubtitle as string}
        </div>

        <div className="mt-4 flex-1 min-h-0 flex items-stretch gap-4">
          <div className="flex flex-col flex-1 min-w-0 min-h-0 gap-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.mindMapsImportTextareaPlaceholder as string}
              className="w-full flex-1 min-h-0 p-3 rounded-2xl bg-[var(--bg2)] border border-[var(--border)] text-sm text-[var(--text)] outline-none focus:border-sky-400 resize-none"
            />

            {error ? (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-3">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col flex-1 min-w-0 min-h-0 gap-3">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text3)] font-bold leading-none whitespace-nowrap">
              {t.mindMapsImportPreview as string}
            </div>

            <div className="flex-1 min-h-0 border border-[var(--border)] rounded-2xl bg-[var(--bg2)] p-3 overflow-auto">
              {rootNode ? (
                <div className="inline-flex min-w-max items-center">
                  <MindMapTree mode="readOnly" rootNode={rootNode} allowCollapse t={t} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-[var(--text3)] font-semibold text-center">
                  {t.mindMapsImportPreviewHintImageOrText as string}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3 w-full">
          {file ? (
            <button
              type="button"
              onClick={() => setFile(null)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)] inline-flex flex-col items-center justify-center leading-tight"
            >
              <span className="text-[12px] font-semibold">{removeImageTop}</span>
              <span className="text-[11px] font-semibold">{removeImageBottom}</span>
            </button>
          ) : (
            <label className="w-full px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)] cursor-pointer inline-flex flex-col items-center justify-center leading-tight">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-[12px] font-semibold">{addImageTop}</span>
              <span className="text-[11px] font-semibold">{addImageBottom}</span>
            </label>
          )}

          <button
            type="button"
            onClick={() => void doAnalyze()}
            disabled={isAnalyzing || !canAnalyze}
            className="w-full px-3 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center justify-center gap-2 leading-none"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {t.mindMapsImportAnalyze as string}
          </button>

          <button
            type="button"
            onClick={() => void doSaveAsNew()}
            disabled={!rootNode || isSaving}
            className="w-full px-3 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center justify-center"
          >
            <span className="flex flex-col items-center leading-tight">
              <span>Zapisz jako nową</span>
              <span>mapę</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full px-3 py-3 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)]"
          >
            {t.mindMapsCancel as string}
          </button>
        </div>
      </div>

      {isPreviewFullScreen ? (
        <div
          className="fixed inset-0 z-[130] bg-black/60 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setIsPreviewFullScreen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full h-full bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg2)]">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text3)] font-bold leading-none whitespace-nowrap">
                {t.mindMapsImportPreview as string}
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewFullScreen(false)}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg2)] border border-[var(--border)] text-[var(--text2)] text-[10px] font-semibold hover:bg-[var(--bg3)] inline-flex items-center gap-2 leading-none whitespace-nowrap"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                {t.mindMapsImportPreviewExitFullScreen as string}
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 bg-[var(--bg2)]">
              {rootNode ? (
                <div className="inline-flex min-w-max items-center">
                  <MindMapTree mode="readOnly" rootNode={rootNode} allowCollapse t={t} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-[var(--text3)] font-semibold text-center">
                  {t.mindMapsImportPreviewHintImageOrText as string}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
