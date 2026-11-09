"use client";

import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import type { translations } from "@/src/translations";

type T = (typeof translations)["en"];

export function MindMapDeleteModal({
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
