"use client";

import React, { useState } from "react";
import type { ProjectDetailDto, StateInputDto } from "@/contexts/bc_projects/schemas";
import { isHttpUrl } from "./isHttpUrl";
import type { MutationResult } from "./mutation";

type Draft = {
  branch: string;
  env: string;
  blocker: string;
  nextStep: string;
  milestone: string;
  milestoneDue: string;
  links: string;
};

type FormError = { message: string; conflict: boolean };

const CONFLICT_MESSAGE =
  "state.md zmienił się poza aplikacją. Wczytaj aktualną wersję; niezapisane zmiany w formularzu zostaną utracone.";

function draftFrom(state: ProjectDetailDto["state"]): Draft {
  return {
    branch: state?.branch ?? "",
    env: state?.env ?? "",
    blocker: state?.blocker ?? "",
    nextStep: state?.nextStep ?? "",
    milestone: state?.milestone ?? "",
    milestoneDue: state?.milestoneDue ?? "",
    links: (state?.links ?? []).join("\n"),
  };
}

function StateBox(props: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={props.wide ? "prj-statebox prj-statebox--wide" : "prj-statebox"}>
      <span className="prj-statebox__lbl">{props.label}</span>
      {props.children}
    </div>
  );
}

const dash = (value: string) => (value === "" ? "—" : value);

export function ProjectSaveState(props: {
  project: ProjectDetailDto;
  onSave: (input: StateInputDto) => Promise<MutationResult>;
  onReload: () => void;
}): React.JSX.Element {
  const { project, onSave, onReload } = props;
  const state = project.state;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(state));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  const open = () => {
    setDraft(draftFrom(state));
    setError(null);
    setEditing(true);
  };

  const field =
    (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const links = draft.links
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    if (links.some((link) => !isHttpUrl(link))) {
      setError({ message: "Linki muszą zaczynać się od http:// lub https://", conflict: false });
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave({
      branch: draft.branch,
      env: draft.env,
      blocker: draft.blocker,
      nextStep: draft.nextStep,
      links,
      milestone: draft.milestone,
      milestoneDue: draft.milestoneDue,
      version: project.stateVersion,
    });
    setSaving(false);
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię (jak `parsed.success === false`).
    if (result.ok === false) {
      setError({ message: result.error, conflict: result.conflict });
      return;
    }
    setEditing(false);
  };

  const reload = () => {
    setEditing(false);
    setError(null);
    onReload();
  };

  if (editing) {
    return (
      <article className="prj-card">
        <h3 className="prj-section-title">Save State</h3>
        <form className="prj-form" onSubmit={submit} aria-label="Edycja Save State">
          <label className="prj-field">
            <span>Branch</span>
            <input value={draft.branch} onChange={field("branch")} maxLength={200} />
          </label>
          <label className="prj-field">
            <span>Środowisko</span>
            <input value={draft.env} onChange={field("env")} maxLength={200} />
          </label>
          <label className="prj-field">
            <span>Bloker</span>
            <input value={draft.blocker} onChange={field("blocker")} maxLength={500} />
          </label>
          <label className="prj-field">
            <span>Następny krok</span>
            <input value={draft.nextStep} onChange={field("nextStep")} maxLength={500} />
          </label>
          <label className="prj-field">
            <span>Kamień milowy</span>
            <input value={draft.milestone} onChange={field("milestone")} maxLength={200} />
          </label>
          <label className="prj-field">
            <span>Termin kamienia</span>
            <input type="date" value={draft.milestoneDue} onChange={field("milestoneDue")} />
          </label>
          <label className="prj-field prj-field--wide">
            <span>Linki (jeden na linię)</span>
            <textarea rows={3} value={draft.links} onChange={field("links")} />
          </label>
          {error ? (
            <p className="prj-alert" role="alert">
              {error.conflict ? CONFLICT_MESSAGE : error.message}
            </p>
          ) : null}
          <div className="prj-form__actions">
            <button type="submit" className="prj-btn prj-btn--primary" disabled={saving}>
              Zapisz
            </button>
            <button
              type="button"
              className="prj-btn"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Anuluj
            </button>
            {error?.conflict ? (
              <button type="button" className="prj-btn" onClick={reload}>
                Wczytaj aktualną wersję
              </button>
            ) : null}
          </div>
        </form>
      </article>
    );
  }

  if (state === null) {
    return (
      <article className="prj-card">
        <h3 className="prj-section-title">Gdzie skończyłem</h3>
        <p className="prj-where">{project.whereIStopped ?? "Brak wpisu"}</p>
        <div className="prj-form__actions">
          <button type="button" className="prj-btn" onClick={open}>
            Utwórz Save State
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="prj-card">
      <div className="prj-card__head">
        <h3 className="prj-section-title">Save State</h3>
        {state.updated ? (
          <span className="prj-statebox__meta">Zapisano: {state.updated}</span>
        ) : null}
      </div>
      <div className="prj-savestate">
        <StateBox label="Aktywny branch">
          <p className="prj-statebox__val">{dash(state.branch)}</p>
        </StateBox>
        <StateBox label="Środowisko">
          <p className="prj-statebox__val">{dash(state.env)}</p>
        </StateBox>
        <StateBox label="Bloker" wide>
          <p className="prj-statebox__val">{dash(state.blocker)}</p>
        </StateBox>
        <StateBox label="Następny krok" wide>
          <p className="prj-statebox__next">{dash(state.nextStep)}</p>
        </StateBox>
        <StateBox label="Linki" wide>
          {state.links.length === 0 ? (
            <p className="prj-statebox__val">—</p>
          ) : (
            <ul className="prj-statebox__links">
              {state.links.map((url, index) => (
                <li key={`${index}-${url}`}>
                  {isHttpUrl(url) ? (
                    <a href={url} target="_blank" rel="noreferrer" className="prj-link">
                      {url}
                    </a>
                  ) : (
                    <span>{url}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </StateBox>
      </div>
      <div className="prj-form__actions">
        <button type="button" className="prj-btn" onClick={open}>
          Edytuj
        </button>
      </div>
    </article>
  );
}
