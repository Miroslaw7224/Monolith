// src/features/home/InboxMoveForm.tsx
import React, { useEffect, useState } from "react";
import type { InboxItemDto, MoveInboxBody } from "@/contexts/bc_inbox/schemas";
import {
  defaultNoteTitle,
  defaultTarget,
  toMoveBody,
  type MoveColumn,
  type MoveTarget,
} from "./inboxMove";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;
type ProjectOption = {
  id: string;
  name: string;
  owner?: "personal" | "work";
  companyData?: boolean;
};

const TARGETS: { value: MoveTarget; label: string }[] = [
  { value: "project", label: "Zadanie w projekcie" },
  { value: "task", label: "Zadanie ogólne" },
  { value: "note", label: "Notatka" },
];

/** Formularz „Przenieś do…”: cel, projekt i kolumna, tytuł notatki i tekst (domyślnie treść wpisu). */
export function InboxMoveForm({
  item,
  apiFetch,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  item: InboxItemDto;
  apiFetch: ApiFetch;
  busy: boolean;
  error: string | null;
  onSubmit: (body: MoveInboxBody) => void;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = useState<MoveTarget>(defaultTarget(item.type));
  const [text, setText] = useState(item.text);
  const [title, setTitle] = useState(defaultNoteTitle(item.text));
  const [projectId, setProjectId] = useState("");
  const [column, setColumn] = useState<MoveColumn>("next");
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);

  useEffect(() => {
    apiFetch("/api/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { projects?: ProjectOption[] }) =>
        setProjects(Array.isArray(data.projects) ? data.projects : [])
      )
      .catch(() => setProjects([]));
  }, [apiFetch]);

  const noProjects = projects !== null && projects.length === 0;
  // bez projektów w rejestrze cel „projekt” jest zablokowany i zastępuje go zadanie ogólne (bez efektu: brak migotania)
  const target: MoveTarget = noProjects && chosen === "project" ? "task" : chosen;

  const selected = projects?.find((p) => p.id === projectId);
  const body = toMoveBody({ target, text, projectId, column, title });

  return (
    <div className="kok-move">
      {item.type === "bug" ? (
        <p role="note" className="kok-modal__sub">
          Bug: wpis w <code>bugs.md</code> dodaje agent (<code>/segreguj-inbox</code>). Tu powstanie
          tylko zwykłe zadanie.
        </p>
      ) : null}
      <fieldset className="kok-field">
        <legend>Cel</legend>
        {TARGETS.map((t) => (
          <label key={t.value}>
            <input
              type="radio"
              name="inbox-move-target"
              checked={target === t.value}
              disabled={t.value === "project" && noProjects}
              onChange={() => setChosen(t.value)}
            />{" "}
            {t.label}
          </label>
        ))}
      </fieldset>
      {target === "project" ? (
        <>
          <label className="kok-field">
            <span>Projekt</span>
            <select
              className="kok-input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">— wybierz projekt —</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {selected?.companyData ? (
            <span className="kok-badge kok-badge--warn">Dane z firmy</span>
          ) : null}
          <label className="kok-field">
            <span>Kolumna</span>
            <select
              className="kok-input"
              value={column}
              onChange={(e) => setColumn(e.target.value === "icebox" ? "icebox" : "next")}
            >
              <option value="next">Next</option>
              <option value="icebox">Backlog</option>
            </select>
          </label>
        </>
      ) : null}
      {target === "note" ? (
        <label className="kok-field">
          <span>Tytuł notatki</span>
          <input
            className="kok-input"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      ) : null}
      <label className="kok-field">
        <span>Tekst</span>
        <input
          className="kok-input"
          maxLength={target === "project" ? 300 : 500}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {error ? (
        <p className="kok-state kok-state--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="kok-modal__actions">
        <button type="button" className="kok-btn kok-btn--ghost" onClick={onCancel}>
          Anuluj
        </button>
        <button
          type="button"
          className="kok-btn kok-btn--primary"
          disabled={busy || body === null}
          onClick={() => body && onSubmit(body)}
        >
          Przenieś
        </button>
      </div>
    </div>
  );
}
