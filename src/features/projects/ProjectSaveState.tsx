"use client";

import React, { useState } from "react";
import type { ProjectDetailDto, StateInputDto } from "@/contexts/bc_projects/schemas";
import { useT } from "@/src/i18n/useT";
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
  const t = useT();
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
      setError({ message: t("projects:saveState.linksHttpOnly"), conflict: false });
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
        <h3 className="prj-section-title">{t("projects:saveState.title")}</h3>
        <form className="prj-form" onSubmit={submit} aria-label={t("projects:saveState.editAria")}>
          <label className="prj-field">
            <span>{t("projects:saveState.fieldBranch")}</span>
            <input value={draft.branch} onChange={field("branch")} maxLength={200} />
          </label>
          <label className="prj-field">
            <span>{t("projects:saveState.fieldEnv")}</span>
            <input value={draft.env} onChange={field("env")} maxLength={200} />
          </label>
          <label className="prj-field">
            <span>{t("projects:saveState.fieldBlocker")}</span>
            <input value={draft.blocker} onChange={field("blocker")} maxLength={500} />
          </label>
          <label className="prj-field">
            <span>{t("projects:saveState.fieldNextStep")}</span>
            <input value={draft.nextStep} onChange={field("nextStep")} maxLength={500} />
          </label>
          <label className="prj-field">
            <span>{t("projects:saveState.fieldMilestone")}</span>
            <input value={draft.milestone} onChange={field("milestone")} maxLength={200} />
          </label>
          <label className="prj-field">
            <span>{t("projects:saveState.fieldMilestoneDue")}</span>
            <input type="date" value={draft.milestoneDue} onChange={field("milestoneDue")} />
          </label>
          <label className="prj-field prj-field--wide">
            <span>{t("projects:saveState.linksMultiline")}</span>
            <textarea rows={3} value={draft.links} onChange={field("links")} />
          </label>
          {error ? (
            <p className="prj-alert" role="alert">
              {error.conflict ? t("projects:saveState.conflict") : error.message}
            </p>
          ) : null}
          <div className="prj-form__actions">
            <button type="submit" className="prj-btn prj-btn--primary" disabled={saving}>
              {t("projects:saveState.save")}
            </button>
            <button
              type="button"
              className="prj-btn"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              {t("projects:common.cancel")}
            </button>
            {error?.conflict ? (
              <button type="button" className="prj-btn" onClick={reload}>
                {t("projects:saveState.reload")}
              </button>
            ) : null}
          </div>
        </form>
      </article>
    );
  }

  if (state === null) {
    // Ta sama karta co przy istniejącym `state.md`; bez pliku pokazuje akapit „Gdzie skończyłem” z `index.md`.
    return (
      <article className="prj-card">
        <div className="prj-card__head">
          <h3 className="prj-section-title">{t("projects:saveState.title")}</h3>
          <span className="prj-statebox__meta">{t("projects:saveState.noFile")}</span>
        </div>
        <div className="prj-savestate">
          <StateBox label={t("projects:saveState.whereStopped")} wide>
            <p className="prj-where">{project.whereIStopped ?? t("projects:saveState.noEntry")}</p>
          </StateBox>
        </div>
        <div className="prj-form__actions">
          <button type="button" className="prj-btn" onClick={open}>
            {t("projects:saveState.create")}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="prj-card">
      <div className="prj-card__head">
        <h3 className="prj-section-title">{t("projects:saveState.title")}</h3>
        {state.updated ? (
          <span className="prj-statebox__meta">
            {t("projects:saveState.savedAt", { date: state.updated })}
          </span>
        ) : null}
      </div>
      <div className="prj-savestate">
        {project.whereIStopped ? (
          <StateBox label={t("projects:saveState.whereStopped")} wide>
            <p className="prj-where">{project.whereIStopped}</p>
          </StateBox>
        ) : null}
        <StateBox label={t("projects:saveState.readBranch")}>
          <p className="prj-statebox__val">{dash(state.branch)}</p>
        </StateBox>
        <StateBox label={t("projects:saveState.readEnv")}>
          <p className="prj-statebox__val">{dash(state.env)}</p>
        </StateBox>
        <StateBox label={t("projects:saveState.readBlocker")} wide>
          <p className="prj-statebox__val">{dash(state.blocker)}</p>
        </StateBox>
        <StateBox label={t("projects:saveState.readNextStep")} wide>
          <p className="prj-statebox__next">{dash(state.nextStep)}</p>
        </StateBox>
        <StateBox label={t("projects:saveState.readLinks")} wide>
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
          {t("projects:saveState.edit")}
        </button>
      </div>
    </article>
  );
}
