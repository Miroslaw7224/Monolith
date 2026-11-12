import React from "react";
import type { ProjectDetailDto } from "@/contexts/bc_projects/schemas";

/** Linkujemy tylko http(s); inny protokół z rejestru (np. `javascript:`) wyświetlamy jako zwykły tekst. */
const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

export function ProjectDossier(props: { project: ProjectDetailDto }): React.JSX.Element {
  const { project } = props;
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
      </article>

      <article className="prj-card">
        <h3 className="prj-section-title">Gdzie skończyłem</h3>
        <p className="prj-where">{project.whereIStopped ?? "Brak wpisu"}</p>
      </article>

      <article className="prj-card">
        <h3 className="prj-section-title">Zadania</h3>
        <div className="prj-tasks">
          {project.tasks.map((section) => (
            <div key={section.heading} className="prj-task-section">
              <h4 className="prj-task-section__title">{section.heading}</h4>
              <ul className="prj-task-list">
                {section.items.map((item, index) => (
                  <li key={`${section.heading}-${index}`}>
                    <label className="prj-task-item">
                      <input type="checkbox" checked={item.done} disabled />
                      <span>{item.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
    </section>
  );
}
