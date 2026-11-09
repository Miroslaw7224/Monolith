"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { MindMap, MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { mapNode } from "@/src/lib/mindMapUtils";
import type { translations } from "@/src/translations";

type T = (typeof translations)["en"];

export function ExportSubtreeToMapModal({
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
