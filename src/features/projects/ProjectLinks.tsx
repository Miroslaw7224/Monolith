"use client";

import React, { useState } from "react";
import type { ProjectDetailDto, ProjectLinksInputDto } from "@/contexts/bc_projects/schemas";
import { useT } from "@/src/i18n/useT";
import { isHttpUrl } from "./isHttpUrl";
import type { MutationResult } from "./mutation";

const SLOTS = [
  {
    key: "github",
    labelKey: "projects:links.slotRepo",
    placeholderKey: "projects:links.githubPlaceholder",
  },
  {
    key: "deploy",
    labelKey: "projects:links.slotDev",
    placeholderKey: "projects:links.deployPlaceholder",
  },
  {
    key: "docs",
    labelKey: "projects:links.slotDocs",
    placeholderKey: "projects:links.docsPlaceholder",
  },
] as const;

type SlotKey = (typeof SLOTS)[number]["key"];

/** Adres bez protokołu, jak w makiecie (`github.com/user/repo`). */
function shortUrl(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Linki projektu: stałe miejsca Repo / Dev / Docs (rejestr NEXUS) i ścieżka lokalna. */
export function ProjectLinks(props: {
  project: ProjectDetailDto;
  onSave: (links: ProjectLinksInputDto) => Promise<MutationResult>;
}): React.JSX.Element {
  const { project, onSave } = props;
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<SlotKey, string>>({
    github: "",
    deploy: "",
    docs: "",
  });

  const startEdit = () => {
    setDraft({
      github: project.github ?? "",
      deploy: project.deploy ?? "",
      docs: project.docs ?? "",
    });
    setError(null);
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await onSave({
      github: draft.github.trim(),
      deploy: draft.deploy.trim(),
      docs: draft.docs.trim(),
    });
    setSaving(false);
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
    if (result.ok === false) setError(result.error);
    else setEditing(false);
  };

  if (editing) {
    return (
      <form className="prj-links-form" onSubmit={save} aria-label={t("projects:links.formAria")}>
        {SLOTS.map((slot) => (
          <label key={slot.key} className="prj-links-form__field">
            <span>{t(slot.labelKey)}</span>
            <input
              type="text"
              value={draft[slot.key]}
              placeholder={t(slot.placeholderKey)}
              maxLength={300}
              onChange={(e) => setDraft((d) => ({ ...d, [slot.key]: e.target.value }))}
            />
          </label>
        ))}
        <div className="prj-links-form__actions">
          <button type="submit" className="prj-btn" disabled={saving}>
            {saving ? t("projects:common.saving") : t("projects:links.save")}
          </button>
          <button
            type="button"
            className="prj-btn"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            {t("projects:common.cancel")}
          </button>
        </div>
        {error ? (
          <p className="prj-alert" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="prj-links">
      {SLOTS.map((slot) => {
        const value = project[slot.key];
        const label = t(slot.labelKey);
        if (!value) {
          return (
            <button
              key={slot.key}
              type="button"
              className="prj-link prj-link--empty"
              onClick={startEdit}
              aria-label={t("projects:links.add", { label })}
            >
              + {label}
            </button>
          );
        }
        const text = `${label}: ${shortUrl(value)}`;
        return isHttpUrl(value) ? (
          <a key={slot.key} href={value} target="_blank" rel="noreferrer" className="prj-link">
            {text}
          </a>
        ) : (
          <span key={slot.key} className="prj-link">
            {text}
          </span>
        );
      })}
      <button type="button" className="prj-link prj-link--edit" onClick={startEdit}>
        {t("projects:links.edit")}
      </button>
      <code className="prj-local-path">{project.localPath}</code>
    </div>
  );
}
