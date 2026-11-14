import React from "react";
import type { ProjectStatusChangeDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";
import { isPaused, needsDecision } from "./projectTiles";

export function ProjectList(props: {
  projects: ProjectSummaryDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetStatus: (id: string, status: ProjectStatusChangeDto) => void;
}): React.JSX.Element {
  const { projects, selectedId, onSelect, onSetStatus } = props;

  return (
    <ul className="prj-list">
      {projects.map((project) => {
        const decide = needsDecision(project);
        const paused = isPaused(project);
        const classes = ["prj-item"];
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
                    {project.owner === "work" ? (
                      <span className="prj-badge prj-badge--firm">Firma</span>
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
                </span>
              </button>
              {decide ? (
                <div className="prj-item__alert">
                  <span>Brak zmian od ponad 14 dni. Podejmij decyzję.</span>
                  <button
                    type="button"
                    className="prj-btn prj-btn--sm"
                    aria-label={`Uśpij projekt ${project.name}`}
                    onClick={() => onSetStatus(project.id, "paused")}
                  >
                    Uśpij
                  </button>
                </div>
              ) : null}
              {paused ? (
                <div className="prj-item__sleep">
                  <span>Uśpiony: nie wymaga decyzji.</span>
                  <button
                    type="button"
                    className="prj-btn prj-btn--sm"
                    aria-label={`Wznów projekt ${project.name}`}
                    onClick={() => onSetStatus(project.id, "active")}
                  >
                    Wznów
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
