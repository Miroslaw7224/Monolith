// src/features/home/InboxMoveForm.tsx
import React, { useEffect, useState } from "react";
import type { InboxItemDto, MoveInboxBody } from "@/contexts/bc_inbox/schemas";
import { useT } from "@/src/i18n/useT";
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

const TARGETS: { value: MoveTarget; labelKey: `home:inbox.target${Capitalize<MoveTarget>}` }[] = [
  { value: "project", labelKey: "home:inbox.targetProject" },
  { value: "task", labelKey: "home:inbox.targetTask" },
  { value: "note", labelKey: "home:inbox.targetNote" },
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
  const t = useT();
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
          {t("home:inbox.bugNoteIntro")}
          <code>bugs.md</code>
          {t("home:inbox.bugNoteAgent")}
          <code>/segreguj-inbox</code>
          {t("home:inbox.bugNoteOutro")}
          <code>bugs.md</code>.
        </p>
      ) : null}
      <fieldset className="kok-field">
        <legend>{t("home:inbox.targetLegend")}</legend>
        {TARGETS.map((opt) => (
          <label key={opt.value}>
            <input
              type="radio"
              name="inbox-move-target"
              checked={target === opt.value}
              disabled={opt.value === "project" && noProjects}
              onChange={() => setChosen(opt.value)}
            />{" "}
            {t(opt.labelKey)}
          </label>
        ))}
      </fieldset>
      {target === "project" ? (
        <>
          <label className="kok-field">
            <span>{t("home:inbox.project")}</span>
            <select
              className="kok-input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">{t("home:inbox.chooseProject")}</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {selected?.companyData ? (
            <span className="kok-badge kok-badge--warn">{t("home:inbox.companyData")}</span>
          ) : null}
          <label className="kok-field">
            <span>{t("home:inbox.column")}</span>
            <select
              className="kok-input"
              value={column}
              onChange={(e) => setColumn(e.target.value === "icebox" ? "icebox" : "next")}
            >
              <option value="next">{t("home:inbox.columnNext")}</option>
              <option value="icebox">{t("home:inbox.columnIcebox")}</option>
            </select>
          </label>
        </>
      ) : null}
      {target === "note" ? (
        <label className="kok-field">
          <span>{t("home:inbox.noteTitle")}</span>
          <input
            className="kok-input"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      ) : null}
      <label className="kok-field">
        <span>{t("home:inbox.textLabel")}</span>
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
          {t("home:common.cancel")}
        </button>
        <button
          type="button"
          className="kok-btn kok-btn--primary"
          disabled={busy || body === null}
          onClick={() => body && onSubmit(body)}
        >
          {t("home:inbox.moveSubmit")}
        </button>
      </div>
    </div>
  );
}
