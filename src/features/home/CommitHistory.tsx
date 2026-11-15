import React, { useEffect, useState } from "react";
import type { CommitHistoryDto } from "@/contexts/bc_cockpit/schemas";
import { useT } from "@/src/i18n/useT";
import { formatDayMonth, formatWeekdayShort } from "@/src/i18n/format";
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
  const t = useT();
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
    <section className="kok-panel kok-history" aria-label={t("home:history.aria")}>
      <div className="kok-panel__head">
        <h3 className="kok-panel__title">
          <b>{t("home:history.titleCommits")}</b>
          {t("home:history.titleSuffix")}
        </h3>
        <div className="kok-panel__tools">
          <span className="kok-history__legend">
            <i className="kok-history__swatch" aria-hidden="true" />{" "}
            {t("home:history.legendCommits")}
          </span>
          <span className="kok-history__legend-pr kok-history__legend">
            <i className="kok-history__swatch kok-history__swatch--pr" aria-hidden="true" />
            {t("home:history.legendPr")}
          </span>
          <span className="kok-chip">
            {t("home:history.chip", {
              commits: commitsLabel(history.total),
              prs: history.totalPrs,
              days: history.days.length,
            })}
          </span>
        </div>
      </div>
      <div className="kok-history__bars">
        {history.days.map((d) => {
          const date = parseDay(d.date);
          const long = formatDayMonth(date);
          const split = d.projects.map((p) => `${p.name} ${p.count}`).join(", ");
          const commitsText =
            d.total === 0
              ? t("home:history.barEmpty", { date: long })
              : t("home:history.barDay", {
                  date: long,
                  commits: commitsLabel(d.total),
                  projects: split,
                });
          const name =
            d.prs > 0 ? `${commitsText}${t("home:history.barPr", { count: d.prs })}` : commitsText;
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
                {formatWeekdayShort(date)} {date.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
