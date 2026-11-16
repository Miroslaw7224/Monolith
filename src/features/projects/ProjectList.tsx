"use client";

import React from "react";
import type {
  CodeSyncDto,
  ProjectStatusChangeDto,
  ProjectSummaryDto,
} from "@/contexts/bc_projects/schemas";
import { projectKindLabel } from "@/src/i18n/projectKind";
import { useT } from "@/src/i18n/useT";
import { CodeSyncMarker } from "./ProjectCodeSync";
import { isPaused, needsDecision } from "./projectTiles";

export function ProjectList(props: {
  projects: ProjectSummaryDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetStatus: (id: string, status: ProjectStatusChangeDto) => void;
  /** Stany kart względem repo po `id`; brak wpisu = bez znacznika. */
  codeSync?: Record<string, CodeSyncDto>;
}): React.JSX.Element {
  const { projects, selectedId, onSelect, onSetStatus, codeSync } = props;
  const t = useT();

  return (
    <ul className="prj-list">
      {projects.map((project) => {
        const decide = needsDecision(project);
        const paused = isPaused(project);
        const classes = ["prj-item"];
        if (project.kind) classes.push(`prj-item--kind-${project.kind}`);
        if (project.id === selectedId) classes.push("prj-item--sel");
        if (decide) classes.push("prj-item--stale");
        if (paused) classes.push("prj-item--paused");
        if (project.status === "done") classes.push("prj-item--done");

        return (
          <li key={project.id}>
            {/* Karta to `div`, bo „Uśpij” i „Wznów” to osobne przyciski (przycisk w przycisku jest niepoprawny). */}
            <div className={classes.join(" ")}>
              <button
                type="button"
                className="prj-item__main"
                aria-current={project.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(project.id)}
              >
                <span className="prj-item__top">
                  <span className="prj-item__name">{project.name}</span>
                  <span className="prj-item__badges">
                    {project.kind ? (
                      <span className={`prj-badge prj-badge--kind-${project.kind}`}>
                        {projectKindLabel(project.kind)}
                      </span>
                    ) : null}
                    {project.owner === "work" ? (
                      <span className="prj-badge prj-badge--firm">
                        {t("projects:list.firmBadge")}
                      </span>
                    ) : null}
                    <span className="prj-badge">{project.status}</span>
                    <span className="prj-badge">{project.priority}</span>
                  </span>
                </span>
                <span className="prj-item__meta">
                  {project.lastWorked ? <span>{project.lastWorked}</span> : null}
                  {project.stateConfidence ? (
                    <span className="prj-item__conf">{project.stateConfidence}</span>
                  ) : null}
                  <CodeSyncMarker sync={codeSync?.[project.id]} />
                </span>
              </button>
              {decide ? (
                <div className="prj-item__alert">
                  <span>{t("projects:list.staleAlert")}</span>
                  <button
                    type="button"
                    className="prj-btn prj-btn--sm"
                    aria-label={t("projects:list.sleepAria", { name: project.name })}
                    onClick={() => onSetStatus(project.id, "paused")}
                  >
                    {t("projects:list.sleepBtn")}
                  </button>
                </div>
              ) : null}
              {paused ? (
                <div className="prj-item__sleep">
                  <span>{t("projects:list.sleep")}</span>
                  <button
                    type="button"
                    className="prj-btn prj-btn--sm"
                    aria-label={t("projects:list.wakeAria", { name: project.name })}
                    onClick={() => onSetStatus(project.id, "active")}
                  >
                    {t("projects:list.wakeBtn")}
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
