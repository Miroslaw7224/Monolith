"use client";

import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { useT } from "@/src/i18n/useT";

export function MindMapDeleteModal({
  open,
  node,
  onClose,
  onConfirm,
}: {
  open: boolean;
  node: MindMapNode | null;
  onClose: () => void;
  onConfirm: (keepChildren: boolean) => void;
}) {
  const t = useT();
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
        <div className="text-lg font-bold">{t("mindmaps:mindMapsDeleteModalTitle")}</div>
        <div className="mt-1 text-sm text-[var(--text3)]">
          {hasKids
            ? t("mindmaps:mindMapsDeleteModalHasChildren")
            : t("mindmaps:mindMapsDeleteModalConfirm")}
        </div>

        <div className="mt-5 flex gap-2">
          {!hasKids ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)]"
              >
                {t("mindmaps:mindMapsCancel")}
              </button>
              <button
                type="button"
                onClick={() => onConfirm(false)}
                className="flex-1 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold text-sm hover:bg-red-100"
              >
                {t("mindmaps:mindMapsDelete")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onConfirm(true)}
                className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--bg3)] text-left"
              >
                <div className="font-bold">{t("mindmaps:mindMapsDeleteOnlyThis")}</div>
                <div className="text-xs text-[var(--text3)]">
                  {t("mindmaps:mindMapsDeleteOnlyThisHint")}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onConfirm(false)}
                className="flex-1 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold text-sm hover:bg-red-100 text-left"
              >
                <div className="font-bold">{t("mindmaps:mindMapsDeleteBranch")}</div>
                <div className="text-xs opacity-80">{t("mindmaps:mindMapsDeleteBranchHint")}</div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
