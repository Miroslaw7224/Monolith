"use client";

import { Loader2, Plus } from "lucide-react";
import type { MindMap } from "@/src/features/mind-maps/mindMapTypes";
import { leafCount } from "@/src/lib/mindMapUtils";
import type { translations } from "@/src/translations";

type T = (typeof translations)["en"];

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

export function MindMapList({
  maps,
  isLoading,
  isCreating,
  onCreate,
  onOpen,
  t,
}: {
  maps: MindMap[];
  isLoading: boolean;
  isCreating: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  t: T;
}) {
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
    </div>
  );
}
