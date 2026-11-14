"use client";

import React from "react";
import type { AgentDto } from "@/contexts/bc_map/schemas";

export function MapAgentsPanel(props: {
  available: boolean;
  agents: AgentDto[];
  loading: boolean;
  projectNames: Record<string, string>;
  onRefresh: () => void;
}) {
  return (
    <section className="map-panel" aria-labelledby="map-agents-title">
      <header className="map-panel__head">
        <h2 id="map-agents-title" className="map-panel__title">
          Agenci (Herdr)
        </h2>
        <button
          type="button"
          className="map-panel__btn"
          disabled={props.loading}
          onClick={props.onRefresh}
        >
          Odśwież stan
        </button>
      </header>
      {!props.available ? (
        <p className="map-panel__empty">Herdr niedostępny</p>
      ) : props.agents.length === 0 ? (
        <p className="map-panel__empty">Brak aktywnych agentów</p>
      ) : (
        <ul className="map-agents">
          {props.agents.map((a) => (
            <li key={a.address} className="map-agent-item">
              <div className="map-agent-top">
                <span className="map-agent-name">{a.label}</span>
                <span className="chip">{a.state}</span>
                {a.status ? <span className="chip chip--ok">{a.status}</span> : null}
              </div>
              {a.projectId ? (
                <div className="map-agent-meta">
                  <span>{props.projectNames[a.projectId] ?? a.projectId}</span>
                  {a.where ? <span className="mono muted">{a.where}</span> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
