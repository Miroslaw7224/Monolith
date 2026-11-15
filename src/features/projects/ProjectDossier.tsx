"use client";

import React, { useState } from "react";
import type { ProjectDetailDto, ProjectType } from "@/contexts/bc_projects/schemas";
import { projectKindLabel } from "@/src/i18n/projectKind";
import { useT } from "@/src/i18n/useT";
import type { ProjectActions } from "./mutation";
import { ProjectBugs } from "./ProjectBugs";
import { ProjectContextPack, type ContextPackModel } from "./ProjectContextPack";
import { ProjectDevlog } from "./ProjectDevlog";
import { ProjectLinks } from "./ProjectLinks";
import { ProjectSaveState } from "./ProjectSaveState";
import { isPaused } from "./projectTiles";
import { ProjectTasksBoard } from "./ProjectTasksBoard";

const TYPE_OPTIONS: { value: ProjectType }[] = [
  { value: "etat" },
  { value: "wlasny" },
  { value: "biblioteka" },
];

export function ProjectDossier(props: {
  project: ProjectDetailDto;
  actions: ProjectActions;
  pack: ContextPackModel;
}): React.JSX.Element {
  const { project, actions, pack } = props;
  const t = useT();
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const changeType = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeSaving(true);
    setTypeError(null);
    const result = await actions.setType(e.target.value as ProjectType);
    setTypeSaving(false);
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
    if (result.ok === false) setTypeError(result.error);
  };

  const paused = isPaused(project);
  const canToggleStatus = paused || project.status.toLowerCase() === "active";
  const toggleStatus = async () => {
    setStatusSaving(true);
    setTypeError(null);
    const result = await actions.setProjectStatus(project.id, paused ? "active" : "paused");
    setStatusSaving(false);
    if (result.ok === false) setTypeError(result.error);
  };

  const taskTotal = (["blockers", "now", "next", "icebox"] as const).reduce(
    (sum, column) => sum + project.board[column].length,
    0
  );

  const companyTitle =
    project.owner === "work"
      ? t("projects:dossier.companyProtectedTitle")
      : t("projects:dossier.companyLabelTitle");

  return (
    <section className="prj-main" aria-label={t("projects:dossier.aria", { name: project.name })}>
      <article
        className={`prj-card${project.kind ? ` prj-card--kind prj-card--kind-${project.kind}` : ""}`}
      >
        <div className="prj-card__head">
          <div>
            <h2 className="prj-card__title">{project.name}</h2>
            <p className="prj-card__type">
              {project.status} · {project.priority}
              {project.companyData ? (
                <span className="prj-card__owner" title={companyTitle}>
                  {t("projects:dossier.companyData")}
                </span>
              ) : null}
            </p>
          </div>
          {canToggleStatus ? (
            <button
              type="button"
              className="prj-btn"
              disabled={statusSaving}
              onClick={toggleStatus}
              title={paused ? t("projects:dossier.resumeTitle") : t("projects:dossier.pauseTitle")}
            >
              {paused ? t("projects:dossier.resumeBtn") : t("projects:dossier.pauseBtn")}
            </button>
          ) : null}
        </div>
        <ProjectLinks key={project.id} project={project} onSave={actions.setLinks} />
        <div className="prj-meta-row">
          <select
            className="prj-type-select"
            aria-label={t("projects:dossier.typeAria")}
            value={project.type ?? ""}
            disabled={typeSaving}
            onChange={changeType}
          >
            <option value="" disabled>
              {t("projects:common.notSet")}
            </option>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {projectKindLabel(option.value)}
              </option>
            ))}
          </select>
          {project.state?.milestone ? (
            <p className="prj-milestone">
              {t("projects:dossier.milestone", { text: project.state.milestone })}
              {project.state.milestoneDue
                ? t("projects:dossier.milestoneDue", { date: project.state.milestoneDue })
                : ""}
            </p>
          ) : null}
        </div>
        {typeError ? (
          <p className="prj-alert" role="alert">
            {typeError}
          </p>
        ) : null}
      </article>

      <ProjectSaveState
        key={project.id}
        project={project}
        onSave={actions.saveState}
        onReload={actions.reloadDetail}
      />

      <article className="prj-card">
        <div className="prj-card__head">
          <h3 className="prj-section-title">{t("projects:dossier.tasksTitle")}</h3>
          <span className="prj-chip">{t("projects:dossier.tasksCount", { count: taskTotal })}</span>
        </div>
        <ProjectTasksBoard
          key={project.id}
          board={project.board}
          onOp={actions.tasksOp}
          onArchive={actions.archiveDone}
          onReload={actions.reloadDetail}
        />
      </article>

      <ProjectBugs key={`${project.id}-bugs`} bugs={project.bugs} />

      <ProjectDevlog
        key={`${project.id}-devlog`}
        entries={project.devlog}
        onAdd={actions.addDevlogEntry}
      />

      <ProjectContextPack pack={pack} />
    </section>
  );
}
