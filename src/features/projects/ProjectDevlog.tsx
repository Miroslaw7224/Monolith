"use client";

import React, { useState } from "react";
import type { DevlogEntryDto, DevlogInputDto } from "@/contexts/bc_projects/schemas";
import type { MutationResult } from "./mutation";

export function ProjectDevlog(props: {
  entries: DevlogEntryDto[];
  onAdd: (input: DevlogInputDto) => Promise<MutationResult>;
}): React.JSX.Element {
  const { entries, onAdd } = props;
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim() !== "" && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const result = await onAdd({ title, why });
    setSaving(false);
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setTitle("");
    setWhy("");
  };

  return (
    <article className="prj-card">
      <div className="prj-card__head">
        <h3 className="prj-section-title">Devlog · ostatnie decyzje</h3>
        <span className="prj-statebox__meta">
          {entries.length} {entries.length === 1 ? "wpis" : "wpisów"}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="prj-state">Brak wpisów</p>
      ) : (
        <ol className="prj-devlog">
          {entries.map((entry, index) => (
            <li key={`${index}-${entry.date ?? ""}-${entry.title}`} className="prj-devlog__item">
              <div className="prj-devlog__meta">
                <span className="prj-devlog__date">{entry.date ?? "—"}</span>
              </div>
              <h4 className="prj-devlog__title">{entry.title}</h4>
              {entry.why !== "" ? <p className="prj-devlog__why">{entry.why}</p> : null}
            </li>
          ))}
        </ol>
      )}
      <form className="prj-form prj-devlog-form" onSubmit={submit} aria-label="Nowy wpis w devlogu">
        <label className="prj-field prj-field--wide">
          <span>Tytuł</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </label>
        <label className="prj-field prj-field--wide">
          <span>Dlaczego</span>
          <textarea
            rows={3}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            maxLength={2000}
          />
        </label>
        {error ? (
          <p className="prj-alert" role="alert">
            {error}
          </p>
        ) : null}
        <div className="prj-form__actions">
          <button type="submit" className="prj-btn prj-btn--primary" disabled={!canSubmit}>
            Dodaj wpis
          </button>
        </div>
      </form>
    </article>
  );
}
