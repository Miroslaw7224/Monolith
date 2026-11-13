// src/features/home/CommitHistory.tsx
import React, { useEffect, useState } from "react";
import type { CommitHistoryDto } from "@/contexts/bc_cockpit/schemas";
import { commitsLabel } from "./cockpitFormat";

const DAYS = 7;

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Słupki commitów z gita dzień po dniu (ostatnie 7 dni). Bez dostępnych repo albo przy błędzie: nic. */
export function CommitHistory({
  apiFetch,
  day,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** Dzień danych Kokpitu: gdy się zmieni (północ), historia wczytuje się od nowa. */
  day: string;
}) {
  const [history, setHistory] = useState<CommitHistoryDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/cockpit/commits?days=${DAYS}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: CommitHistoryDto) => {
        if (!cancelled && data && Array.isArray(data.days)) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setHistory(null);
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch, day]);

  if (!history || !history.available || history.days.length === 0) return null;
  const max = Math.max(1, ...history.days.flatMap((d) => [d.total, d.prs]));

  return (
    <section className="kok-panel kok-history" aria-label="Historia commitów">
      <div className="kok-panel__head">
        <h3 className="kok-panel__title">
          <b>Commity</b> · ostatnie dni
        </h3>
        <div className="kok-panel__tools">
          <span className="kok-history__legend">
            <i className="kok-history__swatch" aria-hidden="true" /> commity
          </span>
          <span className="kok-history__legend-pr kok-history__legend">
            <i className="kok-history__swatch kok-history__swatch--pr" aria-hidden="true" />
            PR
          </span>
          <span className="kok-chip">
            {commitsLabel(history.total)} · {history.totalPrs} PR w {history.days.length} dni
          </span>
        </div>
      </div>
      <div className="kok-history__bars">
        {history.days.map((d) => {
          const date = parseDay(d.date);
          const long = date.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
          const split = d.projects.map((p) => `${p.name} ${p.count}`).join(", ");
          const commitsText =
            d.total === 0
              ? `${long}: brak commitów`
              : `${long}: ${commitsLabel(d.total)} (${split})`;
          const name = d.prs > 0 ? `${commitsText}, ${d.prs} PR` : commitsText;
          return (
            <div key={d.date} className="kok-history__col">
              <span className="kok-history__value">
                <b className="kok-history__commit-value">{d.total || ""}</b>
                {d.prs > 0 ? <b className="kok-history__pr-value"> · {d.prs}</b> : null}
              </span>
              <div className="kok-history__pair">
                <div
                  role="img"
                  aria-label={name}
                  title={name}
                  className={`kok-history__bar${d.total === 0 ? " is-empty" : ""}`}
                  style={{ height: `${d.total === 0 ? 2 : Math.max(6, (d.total / max) * 100)}%` }}
                />
                <div
                  aria-hidden="true"
                  className={`kok-history__bar kok-history__bar--pr${d.prs === 0 ? " is-empty" : ""}`}
                  style={{ height: `${d.prs === 0 ? 0 : Math.max(6, (d.prs / max) * 100)}%` }}
                />
              </div>
              <span className="kok-history__day">
                {date.toLocaleDateString("pl-PL", { weekday: "short" })} {date.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
