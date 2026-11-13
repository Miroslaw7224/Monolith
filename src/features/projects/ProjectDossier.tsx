import React, { useState } from "react";
import type { ProjectDetailDto, ProjectType } from "@/contexts/bc_projects/schemas";
import { isHttpUrl } from "./isHttpUrl";
import type { ProjectActions } from "./mutation";
import { ProjectContextPack } from "./ProjectContextPack";
import { ProjectDevlog } from "./ProjectDevlog";
import { ProjectSaveState } from "./ProjectSaveState";
import { ProjectTasksBoard } from "./ProjectTasksBoard";

const TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: "etat", label: "Etat" },
  { value: "wlasny", label: "Własny" },
  { value: "biblioteka", label: "Biblioteka" },
];

export function ProjectDossier(props: {
  project: ProjectDetailDto;
  actions: ProjectActions;
}): React.JSX.Element {
  const { project, actions } = props;
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  const changeType = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeSaving(true);
    setTypeError(null);
    const result = await actions.setType(e.target.value as ProjectType);
    setTypeSaving(false);
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
    if (result.ok === false) setTypeError(result.error);
  };

  const activeBugs = project.bugs.filter((b) => b.section !== "Zamknięte");
  const closedBugs = project.bugs.filter((b) => b.section === "Zamknięte");

  return (
    <section className="prj-main" aria-label={`Teczka projektu ${project.name}`}>
      <article className="prj-card">
        <div className="prj-card__head">
          <div>
            <h2 className="prj-card__title">{project.name}</h2>
            <p className="prj-card__type">
              {project.status} · {project.priority}
            </p>
          </div>
          <ProjectContextPack key={project.id} onLoad={actions.loadContextPack} />
        </div>
        <div className="prj-links">
          {project.github ? (
            isHttpUrl(project.github) ? (
              <a href={project.github} target="_blank" rel="noreferrer" className="prj-link">
                github
              </a>
            ) : (
              <span className="prj-link">github: {project.github}</span>
            )
          ) : null}
          {project.deploy ? (
            isHttpUrl(project.deploy) ? (
              <a href={project.deploy} target="_blank" rel="noreferrer" className="prj-link">
                deploy
              </a>
            ) : (
              <span className="prj-link">deploy: {project.deploy}</span>
            )
          ) : null}
          <code className="prj-local-path">{project.localPath}</code>
        </div>
        <div className="prj-meta-row">
          <select
            className="prj-type-select"
            aria-label="Typ projektu"
            value={project.type ?? ""}
            disabled={typeSaving}
            onChange={changeType}
          >
            <option value="" disabled>
              Nie ustawiono
            </option>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {project.state?.milestone ? (
            <p className="prj-milestone">
              Kamień milowy: {project.state.milestone}
              {project.state.milestoneDue ? ` · do ${project.state.milestoneDue}` : ""}
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
        <h3 className="prj-section-title">Zadania</h3>
        <ProjectTasksBoard
          key={project.id}
          board={project.board}
          onOp={actions.tasksOp}
          onReload={actions.reloadDetail}
        />
      </article>

      <article className="prj-card">
        <h3 className="prj-section-title">Bugi</h3>
        {project.bugs.length === 0 ? (
          <p>Brak bugów</p>
        ) : (
          <>
            {activeBugs.length > 0 ? (
              <ul className="prj-bugs">
                {activeBugs.map((bug) => (
                  <li key={bug.id}>
                    <span className="prj-badge">{bug.id}</span>
                    <span>{bug.title}</span>
                    {bug.priority ? <span className="prj-badge">{bug.priority}</span> : null}
                    {bug.status ? <span className="prj-badge">{bug.status}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {closedBugs.length > 0 ? (
              <p className="prj-bugs-closed">Zamknięte: {closedBugs.length}</p>
            ) : null}
          </>
        )}
      </article>

      <ProjectDevlog
        key={`${project.id}-devlog`}
        entries={project.devlog}
        onAdd={actions.addDevlogEntry}
      />
    </section>
  );
}
