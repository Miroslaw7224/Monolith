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
    <div className="ars-add-forms">
      <div className="ars-panel">
        <button
          type="button"
          onClick={() => setFormExpanded((e) => !e)}
          className="ars-panel__header"
          aria-expanded={formExpanded}
        >
          <span className="ars-panel__title">{resourceDescriptionPlaceholder}</span>
          <ChevronDown className={`ars-chevron ${formExpanded ? "ars-chevron--open" : ""}`} />
        </button>
        {formExpanded && (
          <div className="ars-panel__body">
            <div className="ars-form-field">
              <input
                type="text"
                value={addDescription}
                onChange={(e) => {
                  setAddDescription(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, description: undefined }));
                }}
                placeholder={resourceDescriptionPlaceholder}
                className="input ars-input"
                aria-invalid={!!fieldErrors.description}
              />
              {fieldErrors.description && <p className="ars-error">{fieldErrors.description}</p>}
            </div>
            <div className="ars-form-field">
              <input
                type="url"
                value={addUrl}
                onChange={(e) => {
                  setAddUrl(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, url: undefined }));
                }}
                placeholder={resourceUrlPlaceholder}
                className="input ars-input"
                aria-invalid={!!fieldErrors.url}
              />
              {fieldErrors.url && <p className="ars-error">{fieldErrors.url}</p>}
            </div>
            <div className="ars-form-field">
              <input
                type="text"
                value={addTags}
                onChange={(e) => {
                  setAddTags(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, tags: undefined }));
                }}
                placeholder={resourceTagsPlaceholder}
                className="input ars-input"
              />
              {fieldErrors.tags && <p className="ars-error">{fieldErrors.tags}</p>}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={adding || !addDescription.trim() || !addUrl.trim()}
              className="btn btn--primary ars-btn--submit"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {addResourceLabel}
            </button>
          </div>
        )}
      </div>

      <div className="ars-panel">
        <button
          type="button"
          onClick={() => setBlockFormatExpanded((e) => !e)}
          className="ars-panel__header"
          aria-expanded={blockFormatExpanded}
        >
          <span className="ars-panel__title">{blockFormatLabel}</span>
          <ChevronDown
            className={`ars-chevron ${blockFormatExpanded ? "ars-chevron--open" : ""}`}
          />
        </button>
        {blockFormatExpanded && (
          <div className="ars-panel__body">
            <textarea
              value={blockFormatText}
              onChange={(e) => {
                setBlockFormatText(e.target.value);
                setBlockFormatError(null);
              }}
              placeholder={blockFormatPlaceholder}
              rows={4}
              className="input ars-input ars-textarea"
            />
            <p className="ars-hint">{blockFormatHint}</p>
            <button
              type="button"
              onClick={handleAddFromBlock}
              disabled={adding || !blockFormatText.trim()}
              className="btn ars-btn--block"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {addFromBlockLabel}
            </button>
            {blockFormatError && <p className="ars-error">{blockFormatError}</p>}
          </div>
        )}
      </div>

      {copyMessage && <p className="ars-success">{copyMessage}</p>}
    </div>
  );
}
