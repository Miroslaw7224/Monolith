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
import { registryProjectsLabel } from "./projectsFormat";
import { useT } from "@/src/i18n/useT";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

export function ProjectsView(props: {
  apiFetch: ApiFetch;
  initialProjectId?: string | null;
}): React.JSX.Element {
  const t = useT();
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
    archiveDone,
    loadContextPack,
    reloadDetail,
  } = useProjects(props.apiFetch, props.initialProjectId ?? null);

  const [query, setQuery] = useState("");
  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === "" ? projects : projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);
  const pack = useContextPack(detail?.id ?? null, loadContextPack, detail?.companyData);
  // Bez useMemo: buildProjectTiles woła i18n.t, a `t` z useT() odświeża render przy zmianie języka.
  const tiles = buildProjectTiles(projects, detail, pack.state);
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
        <p className="prj-state">{t("projects:view.loading")}</p>
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

  const registryCount = registryProjectsLabel(projects.length);

  return (
    <div className="prj" data-card="projekty">
      <header className="prj-head">
        <div>
          <p className="prj-eyebrow">{t("projects:view.eyebrow")}</p>
          <h1 className="prj-heading">{t("projects:view.heading")}</h1>
          <p className="prj-sub">
            {t("projects:view.subRegistry", { label: registryCount })}
            {detail ? t("projects:view.subSelected", { name: detail.name }) : ""}
          </p>
        </div>
        <div className="prj-head__actions">
          <button type="button" className="prj-btn" onClick={() => setCreating(true)}>
            {t("projects:view.newProject")}
          </button>
          {detail ? <ProjectContextPackButton pack={pack} /> : null}
        </div>
      </header>

      <section className="prj-tiles" aria-label={t("projects:view.tilesAria")}>
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
        <aside className="prj-registry" aria-label={t("projects:view.registryAria")}>
          <div className="prj-registry__head">
            <h2 className="prj-registry__title">
              <b>{t("projects:view.registryTitle")}</b> · {registryCount}
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
            <p className="prj-state">{t("projects:view.emptyRegistry")}</p>
          ) : (
            <>
              <input
                className="prj-search"
                type="search"
                placeholder={t("projects:view.searchPlaceholder")}
                aria-label={t("projects:view.searchAria")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {visibleProjects.length === 0 ? (
                <p className="prj-state">{t("projects:view.emptyFilter")}</p>
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
            <p className="prj-state">{t("projects:view.loadingProject")}</p>
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
                archiveDone,
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
