"use client";

import React, { useState } from "react";
import type { DevlogEntryDto, DevlogInputDto } from "@/contexts/bc_projects/schemas";
import { useT } from "@/src/i18n/useT";
import type { MutationResult } from "./mutation";
import { devlogEntriesLabel } from "./projectsFormat";

export function ProjectDevlog(props: {
  entries: DevlogEntryDto[];
  onAdd: (input: DevlogInputDto) => Promise<MutationResult>;
}): React.JSX.Element {
  const { entries, onAdd } = props;
  const t = useT();
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
        <h3 className="prj-section-title">{t("projects:devlog.title")}</h3>
        <span className="prj-statebox__meta">{devlogEntriesLabel(entries.length)}</span>
      </div>
      {entries.length === 0 ? (
        <p className="prj-state">{t("projects:devlog.empty")}</p>
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
      <form
        className="prj-form prj-devlog-form"
        onSubmit={submit}
        aria-label={t("projects:devlog.formAria")}
      >
        <label className="prj-field prj-field--wide">
          <span>{t("projects:devlog.fieldTitle")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </label>
        <label className="prj-field prj-field--wide">
          <span>{t("projects:devlog.fieldWhy")}</span>
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
            {t("projects:devlog.add")}
          </button>
        </div>
      </form>
    </article>
  );
}
