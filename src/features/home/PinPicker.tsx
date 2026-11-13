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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-label="Zmień aktywne tematy"
        className="bg-[var(--bg2)] rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <h3 className="text-base font-bold text-[var(--text)] mb-1">Zmień aktywne tematy</h3>
        <p className="text-xs text-[var(--text3)] mb-4">
          Wybrano {selected.length} z {MAX_PINNED}
        </p>
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {projects.map((p) => {
            const checked = selected.includes(p.id);
            const locked = !checked && selected.length >= MAX_PINNED;
            return (
              <li key={p.id}>
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggle(p.id)}
                  />
                  {p.name}
                </label>
              </li>
            );
          })}
        </ul>
        {error ? <p className="text-sm text-red-500 mt-3">{error}</p> : null}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[var(--text2)]"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-white"
          >
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
