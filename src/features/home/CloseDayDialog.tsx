// src/features/home/CloseDayDialog.tsx
import React, { useEffect, useState } from "react";
import { useT } from "@/src/i18n/useT";

type ProjectOption = { id: string; name: string };

const MAX_TEXT = 300;

/** Rytuał zamknięcia dnia: jedno zdanie (+ opcjonalny temat) zapisywane do `Cockpit/closing.yaml`. */
export function CloseDayDialog({
  apiFetch,
  initialText,
  initialProjectId,
  commitsToday,
  onSaved,
  onCancel,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  initialText: string;
  initialProjectId: string | null;
  /** Do podglądu: tyle commitów dopisze się do wpisu; `null` = git niedostępny. */
  commitsToday: number | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [text, setText] = useState(initialText);
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { projects?: ProjectOption[] }) =>
        setProjects(Array.isArray(data.projects) ? data.projects : [])
      )
      .catch(() => setProjects([]));
  }, [apiFetch]);

  const trimmed = text.trim();

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/cockpit/closing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, projectId: projectId === "" ? null : projectId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("home:closeDay.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="kok-overlay">
      <div role="dialog" aria-label={t("home:closeDay.aria")} className="kok-modal">
        <div className="kok-modal__head">
          <h3 className="kok-modal__title">{t("home:closeDay.title")}</h3>
          <p className="kok-modal__sub">
            {t("home:closeDay.sub")}
            {commitsToday !== null ? t("home:closeDay.subCommits", { count: commitsToday }) : ""}
          </p>
        </div>
        <label className="kok-field">
          <span>{t("home:closeDay.prompt")}</span>
          <textarea
            className="kok-input"
            rows={3}
            maxLength={MAX_TEXT}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </label>
        <label className="kok-field">
          <span>{t("home:closeDay.topic")}</span>
          <select
            className="kok-input"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">{t("home:closeDay.noTopic")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="kok-state kok-state--error">{error}</p> : null}
        <div className="kok-modal__actions">
          <button type="button" onClick={onCancel} className="kok-btn kok-btn--ghost">
            {t("home:common.cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || trimmed === ""}
            className="kok-btn kok-btn--primary"
          >
            {t("home:common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
