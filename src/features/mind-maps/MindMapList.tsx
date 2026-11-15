"use client";

import React from "react";
import { Loader2, Plus } from "lucide-react";
import type { MindMap } from "@/src/features/mind-maps/mindMapTypes";
import { leafCount } from "@/src/lib/mindMapUtils";
import { formatShortDate } from "@/src/i18n/format";
import { useT } from "@/src/i18n/useT";

function parseUpdatedAtMs(d: unknown): number | null {
  try {
    if (!d) return null;
    const ms =
      typeof d === "string"
        ? Date.parse(d)
        : typeof d === "number"
          ? d
          : (d as { toMillis?: () => number } | undefined)?.toMillis?.();
    if (!ms) return null;
    return ms;
  } catch {
    return null;
  }
}

export function MindMapList({
  maps,
  isLoading,
  isCreating,
  onCreate,
  onOpen,
}: {
  maps: MindMap[];
  isLoading: boolean;
  isCreating: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const t = useT();

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
              <div className="font-bold">{t("mindmaps:mindMapsCreateCardTitle")}</div>
              <div className="text-xs text-[var(--text3)]">
                {t("mindmaps:mindMapsCreateCardSubtitle")}
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
              {t("mindmaps:mindMapsNoMaps")}
            </div>
          </div>
        ) : (
          maps.map((m) => {
            const updatedMs = parseUpdatedAtMs(m.updatedAt);
            const updatedLabel = updatedMs
              ? t("mindmaps:mindMapsListUpdatedAt", {
                  date: formatShortDate(new Date(updatedMs)),
                })
              : "—";
            const leaves = leafCount(m.rootNode);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpen(m.id)}
                className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--surface)] hover:bg-[var(--bg2)] transition-colors text-left"
              >
                <div className="font-bold truncate">
                  {m.title || t("mindmaps:mindMapsUntitled")}
                </div>
                <div className="mt-1 text-xs text-[var(--text3)]">{updatedLabel}</div>
                <div className="mt-3 text-[10px] uppercase tracking-widest text-[var(--text3)] font-bold">
                  {t("mindmaps:mindMapsLeafCount", { count: leaves })}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
