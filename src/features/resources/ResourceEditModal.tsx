import React, { useState } from "react";
import { X } from "lucide-react";
import { UpdateResourceBodySchema } from "@/contexts/bc_resources/schemas";

export interface ResourceEditModalProps {
  isOpen: boolean;
  titleLabel: string;
  resourceDescriptionPlaceholder: string;
  resourceUrlPlaceholder: string;
  resourceTagsPlaceholder: string;
  resourceFavoriteLabel: string;
  cancelLabel: string;
  saveLabel: string;
  editForm: {
    title: string;
    description: string;
    url: string;
    tags: string;
    isFavorite: boolean;
  };
  setEditForm: React.Dispatch<
    React.SetStateAction<{
      title: string;
      description: string;
      url: string;
      tags: string;
      isFavorite: boolean;
    }>
  >;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export function ResourceEditModal({
  isOpen,
  titleLabel,
  resourceDescriptionPlaceholder,
  resourceUrlPlaceholder,
  resourceTagsPlaceholder,
  resourceFavoriteLabel,
  cancelLabel,
  saveLabel,
  editForm,
  setEditForm,
  onClose,
  onSave,
}: ResourceEditModalProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    const tagsStr = editForm.tags.trim();
    const payload = {
      title: editForm.title.trim() || undefined,
      description: editForm.description.trim() || undefined,
      url: editForm.url.trim() || undefined,
      tags: tagsStr
        ? editForm.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      isFavorite: editForm.isFavorite,
    };
    const result = UpdateResourceBodySchema.safeParse(payload);
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
    await onSave();
  };

  if (!isOpen) return null;

  return (
    <div
      className="ars-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-resource-title"
    >
      <div
        className="ars-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="ars-modal__head">
          <h3 id="edit-resource-title" className="ars-modal__title">
            {titleLabel}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="btn btn--sm btn--icon btn--ghost"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="ars-modal__body">
          <div className="ars-field">
            <label htmlFor="edit-res-title" className="ars-label">
              Title
            </label>
            <input
              id="edit-res-title"
              type="text"
              value={editForm.title}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, title: e.target.value }));
                setFieldErrors((prev) => ({ ...prev, title: undefined }));
              }}
              className="input ars-input"
              placeholder={resourceDescriptionPlaceholder}
              aria-invalid={!!fieldErrors.title}
            />
            {fieldErrors.title && <p className="ars-error">{fieldErrors.title}</p>}
          </div>
          <div className="ars-field">
            <label htmlFor="edit-res-desc" className="ars-label">
              Description
            </label>
            <input
              id="edit-res-desc"
              type="text"
              value={editForm.description}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, description: e.target.value }));
                setFieldErrors((prev) => ({ ...prev, description: undefined }));
              }}
              className="input ars-input"
              placeholder={resourceDescriptionPlaceholder}
              aria-invalid={!!fieldErrors.description}
            />
            {fieldErrors.description && <p className="ars-error">{fieldErrors.description}</p>}
          </div>
          <div className="ars-field">
            <label htmlFor="edit-res-url" className="ars-label">
              URL
            </label>
            <input
              id="edit-res-url"
              type="url"
              value={editForm.url}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, url: e.target.value }));
                setFieldErrors((prev) => ({ ...prev, url: undefined }));
              }}
              className="input ars-input"
              placeholder={resourceUrlPlaceholder}
              aria-invalid={!!fieldErrors.url}
            />
            {fieldErrors.url && <p className="ars-error">{fieldErrors.url}</p>}
          </div>
          <div className="ars-field">
            <label htmlFor="edit-res-tags" className="ars-label">
              Tags
            </label>
            <input
              id="edit-res-tags"
              type="text"
              value={editForm.tags}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, tags: e.target.value }));
                setFieldErrors((prev) => ({ ...prev, tags: undefined }));
              }}
              className="input ars-input"
              placeholder={resourceTagsPlaceholder}
              aria-invalid={!!fieldErrors.tags}
            />
            {fieldErrors.tags && <p className="ars-error">{fieldErrors.tags}</p>}
          </div>
          <label className="ars-checkbox-label">
            <input
              type="checkbox"
              checked={editForm.isFavorite}
              onChange={(e) => setEditForm((f) => ({ ...f, isFavorite: e.target.checked }))}
              className="check ars-check"
            />
            <span>{resourceFavoriteLabel}</span>
          </label>
        </div>
        <div className="ars-modal__foot">
          <button type="button" onClick={onClose} className="btn btn--ghost">
            {cancelLabel}
          </button>
          <button type="button" onClick={handleSave} className="btn btn--primary">
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
