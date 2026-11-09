"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUTOSAVE_DELAY_MS,
  initialAutosave,
  markDirty,
  settleSave,
  takeForSave,
  type SavePayload,
  type SavePhase,
} from "@/src/features/mind-maps/mindMapAutosave";
import {
  applyChange,
  createHistory,
  redo as redoHistory,
  undo as undoHistory,
  type MindMapHistory,
  type TreeChange,
} from "@/src/features/mind-maps/mindMapHistory";
import type { MindMap, MindMapNode } from "@/src/features/mind-maps/mindMapTypes";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

export function useMindMapDocument({
  map,
  apiFetch,
  onChanged,
  onRefreshList,
}: {
  map: MindMap;
  apiFetch: ApiFetch;
  onChanged: (next: MindMap) => void;
  onRefreshList: () => Promise<void>;
}) {
  const [history, setHistory] = useState<MindMapHistory>(() => createHistory(map.rootNode));
  const [colWidths, setColWidths] = useState<Record<number, number>>(map.colWidths ?? {});
  const [savePhase, setSavePhase] = useState<SavePhase>("clean");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const historyRef = useRef(history);
  const colRef = useRef(colWidths);
  const rootRef = useRef(history.present);
  const autoRef = useRef(initialAutosave());
  const mapRef = useRef(map);
  const mapIdRef = useRef(map.id);
  const mountedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const apiFetchRef = useRef(apiFetch);
  const onChangedRef = useRef(onChanged);
  const onRefreshRef = useRef(onRefreshList);
  const basesRef = useRef(new WeakMap<SavePayload, MindMap>());
  const beginFlushRef = useRef<(keepalive?: boolean) => void>(() => {});

  historyRef.current = history;
  colRef.current = colWidths;
  rootRef.current = history.present;
  mapRef.current = map;
  apiFetchRef.current = apiFetch;
  onChangedRef.current = onChanged;
  onRefreshRef.current = onRefreshList;

  const publish = useCallback((phase: SavePhase, savedAt: number | null) => {
    if (!mountedRef.current) return;
    setSavePhase(phase);
    setLastSavedAt(savedAt);
  }, []);

  const scheduleSoon = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => beginFlushRef.current(false), AUTOSAVE_DELAY_MS);
  }, []);

  const completeFlush = useCallback(
    async (payload: SavePayload, keepalive: boolean) => {
      let ok = false;
      try {
        const res = await apiFetchRef.current(`/api/mind-maps/${payload.mapId}`, {
          method: "PATCH",
          keepalive,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rootNode: payload.rootNode,
            colWidths: payload.colWidths,
            title: payload.title,
          }),
        });
        ok = res.ok;
      } catch {
        ok = false;
      }

      const base = basesRef.current.get(payload);
      const stillThisMap = payload.mapId === mapIdRef.current;
      if (!stillThisMap) {
        if (ok && base) {
          onChangedRef.current({
            ...base,
            rootNode: payload.rootNode,
            colWidths: payload.colWidths,
            title: payload.title,
          });
          void onRefreshRef.current();
        }
        return;
      }

      const next = settleSave(autoRef.current, payload, { ok, at: Date.now() });
      autoRef.current = next;
      publish(next.phase, next.lastSavedAt);
      if (!ok || !base) return;
      onChangedRef.current({
        ...base,
        rootNode: payload.rootNode,
        colWidths: payload.colWidths,
        title: payload.title,
      });
      void onRefreshRef.current();
      if (next.pending) scheduleSoon();
    },
    [publish, scheduleSoon]
  );

  const beginFlush = useCallback(
    (keepalive = false) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const taken = takeForSave(autoRef.current);
      autoRef.current = taken.state;
      if (mountedRef.current) setSavePhase(taken.state.phase);
      if (!taken.payload) return;
      void completeFlush(taken.payload, keepalive);
    },
    [completeFlush]
  );
  beginFlushRef.current = beginFlush;

  const queueSave = useCallback(
    (root: MindMapNode, cols: Record<number, number>) => {
      const payload: SavePayload = {
        mapId: mapIdRef.current,
        rootNode: root,
        colWidths: cols,
        title: root.label,
      };
      basesRef.current.set(payload, mapRef.current);
      autoRef.current = markDirty(autoRef.current, payload);
      if (mountedRef.current) setSavePhase(autoRef.current.phase);
      scheduleSoon();
    },
    [scheduleSoon]
  );

  const commit = useCallback(
    (next: MindMapNode, change: TreeChange | { kind: "view" }) => {
      if (change.kind === "view") {
        if (next === rootRef.current) return;
        const updated: MindMapHistory = {
          ...historyRef.current,
          present: next,
          noteCoalesce: null,
        };
        historyRef.current = updated;
        rootRef.current = next;
        setHistory(updated);
        queueSave(next, colRef.current);
        return;
      }
      const applied = applyChange(historyRef.current, next, change);
      if (applied === historyRef.current) return;
      historyRef.current = applied;
      rootRef.current = applied.present;
      setHistory(applied);
      queueSave(applied.present, colRef.current);
    },
    [queueSave]
  );

  const updateTree = useCallback(
    (recipe: (root: MindMapNode) => MindMapNode, change: TreeChange | { kind: "view" }) => {
      commit(recipe(rootRef.current), change);
    },
    [commit]
  );

  const undo = useCallback(() => {
    const applied = undoHistory(historyRef.current);
    if (applied === historyRef.current) return;
    historyRef.current = applied;
    rootRef.current = applied.present;
    setHistory(applied);
    queueSave(applied.present, colRef.current);
  }, [queueSave]);

  const redo = useCallback(() => {
    const applied = redoHistory(historyRef.current);
    if (applied === historyRef.current) return;
    historyRef.current = applied;
    rootRef.current = applied.present;
    setHistory(applied);
    queueSave(applied.present, colRef.current);
  }, [queueSave]);

  const applyColWidths = useCallback(
    (next: Record<number, number>) => {
      colRef.current = next;
      setColWidths(next);
      queueSave(rootRef.current, next);
    },
    [queueSave]
  );

  const previewColWidth = useCallback((depth: number, width: number) => {
    const next = { ...colRef.current, [depth]: width };
    colRef.current = next;
    setColWidths(next);
  }, []);

  const commitColWidths = useCallback(() => {
    queueSave(rootRef.current, colRef.current);
  }, [queueSave]);

  useEffect(() => {
    mountedRef.current = true;
    if (mapIdRef.current !== map.id) {
      const nextHistory = createHistory(map.rootNode);
      historyRef.current = nextHistory;
      rootRef.current = map.rootNode;
      colRef.current = map.colWidths ?? {};
      autoRef.current = initialAutosave();
      setHistory(nextHistory);
      setColWidths(colRef.current);
      setSavePhase("clean");
      setLastSavedAt(null);
    }
    mapIdRef.current = map.id;
    return () => {
      mountedRef.current = false;
      beginFlushRef.current(true);
    };
    // Same map id is an autosave echo. Resetting here would wipe the open editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!autoRef.current.pending) return;
      event.preventDefault();
      event.returnValue = "";
      beginFlushRef.current(true);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return {
    rootNode: history.present,
    colWidths,
    savePhase,
    lastSavedAt,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    updateTree,
    undo,
    redo,
    applyColWidths,
    previewColWidth,
    commitColWidths,
    retrySave: () => beginFlush(false),
  };
}
