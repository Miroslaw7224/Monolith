"use client";

import React from "react";
import "./projects.css";
import { ProjectDossier } from "./ProjectDossier";
import { ProjectList } from "./ProjectList";
import { useProjects } from "./useProjects";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

export function ProjectsView(props: { apiFetch: ApiFetch }): React.JSX.Element {
  const {
    status,
    error,
    projects,
    warnings,
    selectedId,
    select,
    detail,
    detailError,
    saveState,
    addDevlogEntry,
    setType,
    tasksOp,
    loadContextPack,
    reloadDetail,
  } = useProjects(props.apiFetch);

  if (status === "loading") {
    return (
      <div className="prj" data-card="projekty">
        <p className="prj-state">Ładowanie…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="prj" data-card="projekty">
        <p className="prj-state prj-state--error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="prj" data-card="projekty">
      <div className="prj-layout">
        <aside className="prj-registry" aria-label="Rejestr projektów">
          {warnings.length > 0 ? (
            <div className="prj-warnings" role="status">
              {warnings.join(" · ")}
            </div>
          ) : null}
          {projects.length === 0 ? (
            <p className="prj-state">Brak projektów w rejestrze</p>
          ) : (
            <ProjectList projects={projects} selectedId={selectedId} onSelect={select} />
          )}
        </aside>

        <div className="prj-dossier-slot">
          {selectedId && detail === null && detailError === null ? (
            <p className="prj-state">Ładowanie projektu…</p>
          ) : null}
          {detailError ? (
            <p className="prj-state prj-state--error" role="alert">
              {detailError}
            </p>
          ) : null}
          {detail ? (
            <ProjectDossier
              key={detail.id}
              project={detail}
              actions={{
                saveState,
                addDevlogEntry,
                setType,
                tasksOp,
                loadContextPack,
                reloadDetail,
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
