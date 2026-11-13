// src/features/home/CommitHistory.tsx
import React, { useEffect, useState } from "react";
import type { CommitHistoryDto } from "@/contexts/bc_cockpit/schemas";
import { commitsLabel } from "./cockpitFormat";

const DAYS = 14;

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Słupki commitów z gita dzień po dniu (ostatnie 14 dni). Bez dostępnych repo albo przy błędzie: nic. */
export function CommitHistory({
  apiFetch,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
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
  }, [apiFetch]);

  if (!history || !history.available || history.days.length === 0) return null;
  const max = Math.max(1, ...history.days.map((d) => d.total));

  return (
    <section className="kok-panel kok-history" aria-label="Historia commitów">
      <div className="kok-panel__head">
        <h3 className="kok-panel__title">
          <b>Commity</b> · ostatnie dni
        </h3>
        <span className="kok-chip">
          {commitsLabel(history.total)} w {history.days.length} dni
        </span>
      </div>
      <div className="kok-history__bars">
        {history.days.map((d) => {
          const date = parseDay(d.date);
          const long = date.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
          const split = d.projects.map((p) => `${p.name} ${p.count}`).join(", ");
          const name =
            d.total === 0
              ? `${long}: brak commitów`
              : `${long}: ${commitsLabel(d.total)} (${split})`;
          return (
            <div key={d.date} className="kok-history__col">
              <span className="kok-history__value">{d.total || ""}</span>
              <div
                role="img"
                aria-label={name}
                title={name}
                className={`kok-history__bar${d.total === 0 ? " is-empty" : ""}`}
                style={{ height: `${d.total === 0 ? 2 : Math.max(6, (d.total / max) * 100)}%` }}
              />
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
