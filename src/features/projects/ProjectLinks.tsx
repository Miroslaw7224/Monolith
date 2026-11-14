import React, { useState } from "react";
import type { ProjectDetailDto, ProjectLinksInputDto } from "@/contexts/bc_projects/schemas";
import { isHttpUrl } from "./isHttpUrl";
import type { MutationResult } from "./mutation";

const SLOTS = [
  { key: "github", label: "Repo", placeholder: "https://github.com/…" },
  { key: "deploy", label: "Dev", placeholder: "http://localhost:3000 albo adres wdrożenia" },
  { key: "docs", label: "Docs", placeholder: "link albo ścieżka, np. docs/specs/v2.md" },
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
      <form className="prj-links-form" onSubmit={save} aria-label="Edycja linków projektu">
        {SLOTS.map((slot) => (
          <label key={slot.key} className="prj-links-form__field">
            <span>{slot.label}</span>
            <input
              type="text"
              value={draft[slot.key]}
              placeholder={slot.placeholder}
              maxLength={300}
              onChange={(e) => setDraft((d) => ({ ...d, [slot.key]: e.target.value }))}
            />
          </label>
        ))}
        <div className="prj-links-form__actions">
          <button type="submit" className="prj-btn" disabled={saving}>
            {saving ? "Zapisuję…" : "Zapisz linki"}
          </button>
          <button
            type="button"
            className="prj-btn"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            Anuluj
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
        if (!value) {
          return (
            <button
              key={slot.key}
              type="button"
              className="prj-link prj-link--empty"
              onClick={startEdit}
              aria-label={`Dodaj link: ${slot.label}`}
            >
              + {slot.label}
            </button>
          );
        }
        const text = `${slot.label}: ${shortUrl(value)}`;
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
        Edytuj linki
      </button>
      <code className="prj-local-path">{project.localPath}</code>
    </div>
  );
}
