"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { MindMapTree } from "@/src/features/mind-maps/MindMapTree";
import type { translations } from "@/src/translations";

type T = (typeof translations)["en"];

export function MindMapAIImportTreeModal({
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
