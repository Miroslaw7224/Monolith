"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Network, Plus, Trash2 } from "lucide-react";
import type { MindMap } from "@/src/features/mind-maps/mindMapTypes";
import { MindMapEditor } from "@/src/features/mind-maps/MindMapEditor";
import { MindMapList } from "@/src/features/mind-maps/MindMapList";
import type { translations } from "@/src/translations";

type T = (typeof translations)["en"];

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
            maps={maps}
            isLoading={isLoadingList}
            onCreate={createMap}
            isCreating={isCreating}
            onOpen={(id) => setSelectedId(id)}
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
