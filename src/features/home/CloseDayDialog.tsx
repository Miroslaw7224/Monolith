// src/features/home/CloseDayDialog.tsx
import React, { useEffect, useState } from "react";

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
      setError(err instanceof Error ? err.message : "Nie udało się zapisać");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="kok-overlay">
      <div role="dialog" aria-label="Zamknij dzień" className="kok-modal">
        <div className="kok-modal__head">
          <h3 className="kok-modal__title">Zamknij dzień</h3>
          <p className="kok-modal__sub">
            Jutro zobaczysz to zdanie na górze Kokpitu
            {commitsToday !== null ? ` · dziś ${commitsToday} commitów` : ""}
          </p>
        </div>
        <label className="kok-field">
          <span>Od czego zacząć jutro?</span>
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
          <span>Temat (opcjonalnie)</span>
          <select
            className="kok-input"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">— bez tematu —</option>
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
            Anuluj
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || trimmed === ""}
            className="kok-btn kok-btn--primary"
          >
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
