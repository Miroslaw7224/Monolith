"use client";

import React, { useEffect, useState } from "react";
import type { NewProjectInputDto } from "@/contexts/bc_projects/schemas";
import type { CreateProject } from "./mutation";

const PRIORITIES: { value: NewProjectInputDto["priority"]; label: string }[] = [
  { value: "high", label: "Wysoki" },
  { value: "medium", label: "Średni" },
  { value: "low", label: "Niski" },
];

const TYPES: { value: "" | NonNullable<NewProjectInputDto["type"]>; label: string }[] = [
  { value: "", label: "Nie ustawiono" },
  { value: "wlasny", label: "Własny" },
  { value: "biblioteka", label: "Biblioteka" },
  { value: "etat", label: "Etat" },
];

/** Okno „Nowy projekt”: wpis w rejestrze NEXUS i szkielet plików w `Projects/<id>/`; kodu projektu nie dotyka. */
export function NewProjectDialog(props: {
  onCreate: CreateProject;
  onClose: () => void;
}): React.JSX.Element {
  const { onCreate, onClose } = props;
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<NewProjectInputDto["priority"]>("medium");
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("");
  const [localPath, setLocalPath] = useState("");
  const [github, setGithub] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = name.trim() !== "" && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const result = await onCreate({
      name,
      priority,
      localPath,
      ...(type !== "" ? { type } : {}),
      ...(github.trim() !== "" ? { github } : {}),
    });
    setSaving(false);
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <div
      className="prj-modal"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="prj-modal__panel prj-form"
        role="dialog"
        aria-modal="true"
        aria-label="Nowy projekt"
        onSubmit={submit}
      >
        <h2 className="prj-section-title prj-field--wide">Nowy projekt</h2>
        <label className="prj-field prj-field--wide">
          <span>Nazwa</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        </label>
        <label className="prj-field">
          <span>Priorytet</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as NewProjectInputDto["priority"])}
          >
            {PRIORITIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="prj-field">
          <span>Typ</span>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="prj-field prj-field--wide">
          <span>Ścieżka lokalna (opcjonalnie)</span>
          <input
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            placeholder="~/projects/nazwa"
            maxLength={300}
          />
        </label>
        <label className="prj-field prj-field--wide">
          <span>GitHub (opcjonalnie)</span>
          <input
            value={github}
            onChange={(e) => setGithub(e.target.value)}
            placeholder="https://github.com/…"
            maxLength={300}
          />
        </label>
        <p className="prj-modal__hint prj-field--wide">
          Dopisuje projekt do rejestru NEXUS i zakłada w vaulcie index.md, tasks.md i bugs.md. Kodu
          projektu nie zmienia.
        </p>
        {error ? (
          <p className="prj-alert prj-field--wide" role="alert">
            {error}
          </p>
        ) : null}
        <div className="prj-form__actions">
          <button type="submit" className="prj-btn prj-btn--primary" disabled={!canSubmit}>
            Utwórz projekt
          </button>
          <button type="button" className="prj-btn" onClick={onClose} disabled={saving}>
            Anuluj
          </button>
        </div>
      </form>
    </div>
  );
}
