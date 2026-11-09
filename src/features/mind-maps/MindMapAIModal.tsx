"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { translations } from "@/src/translations";

type AINodeResult = { label: string; description: string };
type T = (typeof translations)["en"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function MindMapAIModal({
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
