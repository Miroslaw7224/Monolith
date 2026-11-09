"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Maximize2, Minimize2, Sparkles } from "lucide-react";
import type { MindMap, MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { MindMapTree } from "@/src/features/mind-maps/MindMapTree";
import type { translations } from "@/src/translations";

type T = (typeof translations)["en"];

export function MindMapImportModal({
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
