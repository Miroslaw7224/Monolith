// src/features/home/PinPicker.tsx
import React, { useEffect, useState } from "react";

const MAX_PINNED = 3;

type ProjectOption = { id: string; name: string };

export function PinPicker({
  apiFetch,
  currentIds,
  onSaved,
  onCancel,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  currentIds: string[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { projects?: ProjectOption[] }) =>
        setProjects(Array.isArray(data.projects) ? data.projects : [])
      )
      .catch(() => setError("Nie udało się wczytać listy projektów"));
  }, [apiFetch]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/cockpit/pinned", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
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
      <div role="dialog" aria-label="Zmień aktywne tematy" className="kok-modal">
        <div className="kok-modal__head">
          <h3 className="kok-modal__title">Zmień aktywne tematy</h3>
          <p className="kok-modal__sub">
            Wybrano {selected.length} z {MAX_PINNED}
          </p>
        </div>
        <ul className="kok-modal__list">
          {projects.map((p) => {
            const checked = selected.includes(p.id);
            const locked = !checked && selected.length >= MAX_PINNED;
            return (
              <li key={p.id}>
                <label className="kok-modal__item">
                  <input
                    type="checkbox"
                    className="kok-check"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggle(p.id)}
                  />
                  <span>{p.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {error ? <p className="kok-state kok-state--error">{error}</p> : null}
        <div className="kok-modal__actions">
          <button type="button" onClick={onCancel} className="kok-btn kok-btn--ghost">
            Anuluj
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="kok-btn kok-btn--primary"
          >
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
