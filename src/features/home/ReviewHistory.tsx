import React, { useEffect, useState } from "react";
import type { ReviewHistoryDto } from "@/contexts/bc_cockpit/schemas";
import { useT } from "@/src/i18n/useT";
import { formatDayMonth, formatWeekdayShort } from "@/src/i18n/format";

const DAYS = 7;

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;
type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; history: ReviewHistoryDto };

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Słupki własnych review z GitHuba dzień po dniu (ostatnie 7 dni): zatwierdzone i komentarze.
 * W odróżnieniu od `CommitHistory` błąd pobrania jest widoczny, żeby brak danych nie wyglądał jak zero review.
 */
export function ReviewHistory({ apiFetch, day }: { apiFetch: ApiFetch; day: string }) {
  const t = useT();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/cockpit/review-history?days=${DAYS}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ReviewHistoryDto) => {
        if (cancelled) return;
        if (data && data.available === true && Array.isArray(data.days)) {
          setState({ status: "ok", history: data });
        } else {
          setState({ status: "error" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch, day]);

  if (state.status === "loading") return null;

  const title = (
    <h3 className="kok-panel__title">
      <b>{t("home:reviewHistory.title")}</b>
      {t("home:reviewHistory.titleSuffix")}
    </h3>
  );

  if (state.status === "error") {
    return (
      <section className="kok-panel kok-history" aria-label={t("home:reviewHistory.aria")}>
        <div className="kok-panel__head">{title}</div>
        <p className="kok-empty-msg" role="status">
          {t("home:reviewHistory.error")}
        </p>
      </section>
    );
  }

  const { history } = state;
  const max = Math.max(1, ...history.days.flatMap((d) => [d.approved, d.comments]));

  return (
    <section className="kok-panel kok-history" aria-label={t("home:reviewHistory.aria")}>
      <div className="kok-panel__head">
        {title}
        <div className="kok-panel__tools">
          <span className="kok-history__legend">
            <i className="kok-history__swatch" aria-hidden="true" />{" "}
            {t("home:reviewHistory.legendApproved")}
          </span>
          <span className="kok-history__legend-pr kok-history__legend">
            <i className="kok-history__swatch kok-history__swatch--pr" aria-hidden="true" />
            {t("home:reviewHistory.legendComments")}
          </span>
          <span className="kok-chip">
            {t("home:reviewHistory.chip", {
              approved: history.approved,
              comments: history.comments,
              prs: history.prs,
              days: history.days.length,
            })}
          </span>
        </div>
      </div>
      <div className="kok-history__bars">
        {history.days.map((d) => {
          const date = parseDay(d.date);
          const long = formatDayMonth(date);
          const empty = d.approved === 0 && d.comments === 0;
          const name = empty
            ? t("home:reviewHistory.barEmpty", { date: long })
            : t("home:reviewHistory.barDay", {
                date: long,
                approved: d.approved,
                comments: d.comments,
              });
          return (
            <div key={d.date} className="kok-history__col">
              <span className="kok-history__value">
                <b className="kok-history__commit-value">{d.approved || ""}</b>
                {d.comments > 0 ? (
                  <b className="kok-history__pr-value">
                    {d.approved > 0 ? " · " : ""}
                    {d.comments}
                  </b>
                ) : null}
              </span>
              <div className="kok-history__pair">
                <div
                  role="img"
                  aria-label={name}
                  title={name}
                  className={`kok-history__bar${d.approved === 0 ? " is-empty" : ""}`}
                  style={{
                    height: `${d.approved === 0 ? 2 : Math.max(6, (d.approved / max) * 100)}%`,
                  }}
                />
                <div
                  aria-hidden="true"
                  className={`kok-history__bar kok-history__bar--pr${d.comments === 0 ? " is-empty" : ""}`}
                  style={{
                    height: `${d.comments === 0 ? 0 : Math.max(6, (d.comments / max) * 100)}%`,
                  }}
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
