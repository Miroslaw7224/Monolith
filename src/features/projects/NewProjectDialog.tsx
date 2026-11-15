"use client";

import React, { useEffect, useState } from "react";
import type { NewProjectInputDto } from "@/contexts/bc_projects/schemas";
import { projectKindLabel } from "@/src/i18n/projectKind";
import { useT } from "@/src/i18n/useT";
import type { CreateProject } from "./mutation";

const PRIORITIES: {
  value: NewProjectInputDto["priority"];
  labelKey:
    | "projects:dialog.priorityHigh"
    | "projects:dialog.priorityMedium"
    | "projects:dialog.priorityLow";
}[] = [
  { value: "high", labelKey: "projects:dialog.priorityHigh" },
  { value: "medium", labelKey: "projects:dialog.priorityMedium" },
  { value: "low", labelKey: "projects:dialog.priorityLow" },
];

const TYPES: { value: "" | NonNullable<NewProjectInputDto["type"]> }[] = [
  { value: "" },
  { value: "wlasny" },
  { value: "biblioteka" },
  { value: "etat" },
];

/** Okno „Nowy projekt”: wpis w rejestrze NEXUS i szkielet plików w `Projects/<id>/`; kodu projektu nie dotyka. */
export function NewProjectDialog(props: {
  onCreate: CreateProject;
  onClose: () => void;
}): React.JSX.Element {
  const { onCreate, onClose } = props;
  const t = useT();
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

  const typeLabel = (value: (typeof TYPES)[number]["value"]) =>
    value === "" ? t("projects:common.notSet") : projectKindLabel(value);

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
        aria-label={t("projects:dialog.aria")}
        onSubmit={submit}
      >
        <h2 className="prj-section-title prj-field--wide">{t("projects:dialog.title")}</h2>
        <label className="prj-field prj-field--wide">
          <span>{t("projects:dialog.name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        </label>
        <label className="prj-field">
          <span>{t("projects:dialog.priority")}</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as NewProjectInputDto["priority"])}
          >
            {PRIORITIES.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="prj-field">
          <span>{t("projects:dialog.type")}</span>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {TYPES.map((o) => (
              <option key={o.value || "__empty"} value={o.value}>
                {typeLabel(o.value)}
              </option>
            ))}
          </select>
        </label>
        <label className="prj-field prj-field--wide">
          <span>{t("projects:dialog.localPath")}</span>
          <input
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            placeholder={t("projects:dialog.localPathPlaceholder")}
            maxLength={300}
          />
        </label>
        <label className="prj-field prj-field--wide">
          <span>{t("projects:dialog.github")}</span>
          <input
            value={github}
            onChange={(e) => setGithub(e.target.value)}
            placeholder="https://github.com/…"
            maxLength={300}
          />
        </label>
        <p className="prj-modal__hint prj-field--wide">{t("projects:dialog.hint")}</p>
        {error ? (
          <p className="prj-alert prj-field--wide" role="alert">
            {error}
          </p>
        ) : null}
        <div className="prj-form__actions">
          <button type="submit" className="prj-btn prj-btn--primary" disabled={!canSubmit}>
            {t("projects:dialog.create")}
          </button>
          <button type="button" className="prj-btn" onClick={onClose} disabled={saving}>
            {t("projects:common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
