import React, { useState } from "react";
import { Plus, Loader2, ChevronDown } from "lucide-react";
import { CreateResourceBodySchema } from "@/contexts/bc_resources/schemas";

export interface ResourceAddFormProps {
  resourceDescriptionPlaceholder: string;
  resourceUrlPlaceholder: string;
  resourceTagsPlaceholder: string;
  addResourceLabel: string;
  blockFormatLabel: string;
  blockFormatPlaceholder: string;
  blockFormatHint: string;
  addFromBlockLabel: string;
  addDescription: string;
  setAddDescription: (v: string) => void;
  addUrl: string;
  setAddUrl: (v: string) => void;
  addTags: string;
  setAddTags: (v: string) => void;
  adding: boolean;
  formExpanded: boolean;
  setFormExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleAdd: () => Promise<void>;
  blockFormatText: string;
  setBlockFormatText: (v: string) => void;
  setBlockFormatError: (v: string | null) => void;
  blockFormatExpanded: boolean;
  setBlockFormatExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleAddFromBlock: () => Promise<void>;
  blockFormatError: string | null;
  copyMessage: string | null;
}

export function ResourceAddForm({
  resourceDescriptionPlaceholder,
  resourceUrlPlaceholder,
  resourceTagsPlaceholder,
  addResourceLabel,
  blockFormatLabel,
  blockFormatPlaceholder,
  blockFormatHint,
  addFromBlockLabel,
  addDescription,
  setAddDescription,
  addUrl,
  setAddUrl,
  addTags,
  setAddTags,
  adding,
  formExpanded,
  setFormExpanded,
  handleAdd,
  blockFormatText,
  setBlockFormatText,
  setBlockFormatError,
  blockFormatExpanded,
  setBlockFormatExpanded,
  handleAddFromBlock,
  blockFormatError,
  copyMessage,
}: ResourceAddFormProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    const tags = addTags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const result = CreateResourceBodySchema.safeParse({
      description: addDescription.trim(),
      url: addUrl.trim(),
      tags,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      const flat = result.error.flatten().fieldErrors;
      for (const [key, messages] of Object.entries(flat)) {
        if (messages && messages[0]) errors[key] = messages[0];
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    await handleAdd();
  };

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-0">
        <button
          type="button"
          onClick={() => setFormExpanded((e) => !e)}
          className="w-full flex items-center justify-between gap-2 py-2 text-left text-base font-semibold text-[var(--text)] hover:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
        >
          <span>{resourceDescriptionPlaceholder}</span>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 transition-transform ${formExpanded ? "rotate-180" : ""}`}
          />
        </button>
        {formExpanded && (
          <div className="space-y-3 pt-1">
            <div>
              <input
                type="text"
                value={addDescription}
                onChange={(e) => {
                  setAddDescription(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, description: undefined }));
                }}
                placeholder={resourceDescriptionPlaceholder}
                className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-base focus:ring-2 focus:ring-[var(--accent)]"
                aria-invalid={!!fieldErrors.description}
              />
              {fieldErrors.description && (
                <p className="text-sm text-red-600 mt-1">{fieldErrors.description}</p>
              )}
            </div>
            <div>
              <input
                type="url"
                value={addUrl}
                onChange={(e) => {
                  setAddUrl(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, url: undefined }));
                }}
                placeholder={resourceUrlPlaceholder}
                className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-base focus:ring-2 focus:ring-[var(--accent)]"
                aria-invalid={!!fieldErrors.url}
              />
              {fieldErrors.url && <p className="text-sm text-red-600 mt-1">{fieldErrors.url}</p>}
            </div>
            <div>
              <input
                type="text"
                value={addTags}
                onChange={(e) => {
                  setAddTags(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, tags: undefined }));
                }}
                placeholder={resourceTagsPlaceholder}
                className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-base focus:ring-2 focus:ring-[var(--accent)]"
              />
              {fieldErrors.tags && <p className="text-sm text-red-600 mt-1">{fieldErrors.tags}</p>}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={adding || !addDescription.trim() || !addUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {addResourceLabel}
            </button>
          </div>
        )}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
        <button
          type="button"
          onClick={() => setBlockFormatExpanded((e) => !e)}
          className="w-full flex items-center justify-between gap-2 py-2 text-left text-base font-semibold text-[var(--text)] hover:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
        >
          <span>{blockFormatLabel}</span>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 transition-transform ${blockFormatExpanded ? "rotate-180" : ""}`}
          />
        </button>
        {blockFormatExpanded && (
          <div className="pt-2 space-y-2">
            <textarea
              value={blockFormatText}
              onChange={(e) => {
                setBlockFormatText(e.target.value);
                setBlockFormatError(null);
              }}
              placeholder={blockFormatPlaceholder}
              rows={4}
              className="w-full px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-base focus:ring-2 focus:ring-[var(--accent)] resize-y font-mono text-sm"
            />
            <p className="text-xs text-[#6B7280]">{blockFormatHint}</p>
            <button
              type="button"
              onClick={handleAddFromBlock}
              disabled={adding || !blockFormatText.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--text2)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--text)] transition-all disabled:opacity-50 disabled:hover:bg-[var(--text2)]"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {addFromBlockLabel}
            </button>
            {blockFormatError && (
              <p className="text-sm text-red-600 font-medium">{blockFormatError}</p>
            )}
          </div>
        )}
      </div>

      {copyMessage && <p className="text-sm text-green-600 font-medium">{copyMessage}</p>}
    </div>
  );
}
