"use client";

import React, { useMemo, useState } from "react";
import "./projects.css";
import { ProjectContextPackButton } from "./ProjectContextPack";
import { ProjectDossier } from "./ProjectDossier";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectList } from "./ProjectList";
import { buildProjectTiles } from "./projectTiles";
import { useContextPack } from "./useContextPack";
import { useProjects } from "./useProjects";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

/** Polska odmiana: 1 projekt, 2–4 projekty, 0/5+ projektów. */
function projectsWord(n: number): string {
  if (n === 1) return "projekt";
  const lastTwo = n % 100;
  const last = n % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "projekty" : "projektów";
}

export function ProjectsView(props: {
  apiFetch: ApiFetch;
  initialProjectId?: string | null;
}): React.JSX.Element {
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
    setLinks,
    setProjectStatus,
    createProject,
    tasksOp,
    loadContextPack,
    reloadDetail,
  } = useProjects(props.apiFetch, props.initialProjectId ?? null);

  const [query, setQuery] = useState("");
  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === "" ? projects : projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);
  const pack = useContextPack(detail?.id ?? null, loadContextPack);
  const tiles = useMemo(
    () => buildProjectTiles(projects, detail, pack.state),
    [projects, detail, pack.state]
  );
  const [creating, setCreating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const changeStatus = async (id: string, next: "active" | "paused") => {
    setStatusError(null);
    const result = await setProjectStatus(id, next);
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
    if (result.ok === false) setStatusError(result.error);
  };

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
      <header className="prj-head">
        <div>
          <p className="prj-eyebrow">Alt+4 · Projekty</p>
          <h1 className="prj-heading">Teczka inżynierska projektów</h1>
          <p className="prj-sub">
            {projects.length} {projectsWord(projects.length)} w rejestrze
            {detail ? ` · wybrany: ${detail.name}` : ""}
          </p>
        </div>
        <div className="prj-head__actions">
          <button type="button" className="prj-btn" onClick={() => setCreating(true)}>
            + Nowy projekt
          </button>
          {detail ? <ProjectContextPackButton pack={pack} /> : null}
        </div>
      </header>

      <section className="prj-tiles" aria-label="Statystyki projektów">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className={["prj-tile", tile.accent ? "prj-tile--accent" : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="prj-tile__label">{tile.label}</span>
            <span className="prj-tile__value">{tile.value}</span>
            <span
              className={["prj-tile__meta", tile.tone ? `prj-tile__meta--${tile.tone}` : ""]
                .filter(Boolean)
                .join(" ")}
            >
              {tile.meta}
            </span>
          </div>
        ))}
      </section>

      <div className="prj-layout">
        <aside className="prj-registry" aria-label="Rejestr projektów">
          <div className="prj-registry__head">
            <h2 className="prj-registry__title">
              <b>Rejestr</b> · {projects.length} {projectsWord(projects.length)}
            </h2>
            <span className="prj-chip">NEXUS</span>
          </div>
          {statusError ? (
            <p className="prj-alert" role="alert">
              {statusError}
            </p>
          ) : null}
          {warnings.length > 0 ? (
            <div className="prj-warnings" role="status">
              {warnings.join(" · ")}
            </div>
          ) : null}
          {projects.length === 0 ? (
            <p className="prj-state">Brak projektów w rejestrze</p>
          ) : (
            <>
              <input
                className="prj-search"
                type="search"
                placeholder="Szukaj w rejestrze projektów…"
                aria-label="Filtruj projekty"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {visibleProjects.length === 0 ? (
                <p className="prj-state">Brak projektów pasujących do filtra</p>
              ) : (
                <ProjectList
                  projects={visibleProjects}
                  selectedId={selectedId}
                  onSelect={select}
                  onSetStatus={changeStatus}
                />
              )}
            </>
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
              pack={pack}
              actions={{
                saveState,
                addDevlogEntry,
                setType,
                setLinks,
                setProjectStatus,
                tasksOp,
                loadContextPack,
                reloadDetail,
              }}
            />
          ) : null}
        </div>
      </div>
      {creating ? (
        <NewProjectDialog onCreate={createProject} onClose={() => setCreating(false)} />
      ) : null}
    </div>
  );
}
