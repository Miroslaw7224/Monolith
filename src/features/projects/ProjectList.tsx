import React from "react";
import type { ProjectSummaryDto } from "@/contexts/bc_projects/schemas";

export function ProjectList(props: {
  projects: ProjectSummaryDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const { projects, selectedId, onSelect } = props;

  return (
    <ul className="prj-list">
      {projects.map((project) => {
        const classes = ["prj-item"];
        if (project.id === selectedId) classes.push("prj-item--sel");
        if (project.freshness === "stale") classes.push("prj-item--stale");
        if (project.status === "done") classes.push("prj-item--done");

        return (
          <li key={project.id}>
            <button
              type="button"
              className={classes.join(" ")}
              aria-current={project.id === selectedId ? "true" : undefined}
              onClick={() => onSelect(project.id)}
            >
              <div className="prj-item__top">
                <span className="prj-item__name">{project.name}</span>
                <div className="prj-item__badges">
                  <span className="prj-badge">{project.status}</span>
                  <span className="prj-badge">{project.priority}</span>
                </div>
              </div>
              <div className="prj-item__meta">
                {project.lastWorked ? <span>{project.lastWorked}</span> : null}
                {project.stateConfidence ? (
                  <span className="prj-item__conf">{project.stateConfidence}</span>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
