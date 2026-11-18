import React, { useEffect, useState } from "react";
import type { OpenPrDto, OpenPrsDto } from "@/contexts/bc_cockpit/schemas";
import { useT } from "@/src/i18n/useT";
import { PrRow } from "./PrRow";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

/** Odstęp między odświeżeniami listy (tylko przy widocznej karcie przeglądarki). */
export const OPEN_PRS_REFRESH_MS = 5 * 60_000;

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; items: OpenPrDto[]; total: number };

/**
 * Własne, otwarte PR-y użytkownika (z GitHuba przez `gh`, tylko odczyt): draft na szaro, gotowy na zielono.
 * Błąd pobrania jest widoczny (jak w `ReviewRequests`): cichy brak listy ukryłby PR wymagający uwagi.
 */
export function OpenPrs({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    /** Numer ostatniego zapytania: starsza odpowiedź nie nadpisuje nowszej. */
    let latest = 0;
    const load = () => {
      const id = ++latest;
      apiFetch("/api/cockpit/open-prs")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data: OpenPrsDto) => {
          if (cancelled || id !== latest) return;
          if (data && data.available === true && Array.isArray(data.items)) {
            setState({
              status: "ok",
              items: data.items,
              total: Number.isFinite(data.total)
                ? Math.max(data.total, data.items.length)
                : data.items.length,
            });
          } else {
            setState({ status: "error" });
          }
        })
        .catch(() => {
          if (!cancelled && id === latest) setState({ status: "error" });
        });
    };
    const reloadIfVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    const timer = setInterval(reloadIfVisible, OPEN_PRS_REFRESH_MS);
    document.addEventListener("visibilitychange", reloadIfVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", reloadIfVisible);
    };
  }, [apiFetch]);

  if (state.status === "loading") return null;

  return (
    <section className="kok-panel kok-reviews" aria-label={t("home:openPrs.aria")}>
      <div className="kok-panel__head">
        <h3 className="kok-panel__title">
          <b>{t("home:openPrs.title")}</b>
        </h3>
        {state.status === "ok" ? <span className="kok-chip">{state.total}</span> : null}
      </div>
      {state.status === "error" ? (
        <p className="kok-empty-msg" role="status">
          {t("home:openPrs.error")}
        </p>
      ) : state.items.length === 0 ? (
        <p className="kok-empty-msg">{t("home:openPrs.empty")}</p>
      ) : (
        <ul className="kok-pr-table">
          {state.items.map((item) => {
            const kind = item.draft ? "draft" : "ready";
            return (
              <PrRow
                key={`${item.repo}#${item.number}`}
                repo={item.repo}
                number={item.number}
                title={item.title}
                url={item.url}
                updatedAt={item.updatedAt}
                refClassName={`kok-reviews__ref--${kind}`}
              >
                <span className={`kok-reviews__state kok-reviews__state--${kind}`}>
                  {t(item.draft ? "home:openPrs.draft" : "home:openPrs.ready")}
                </span>
              </PrRow>
            );
          })}
        </ul>
      )}
      {state.status === "ok" && state.total > state.items.length ? (
        <p className="kok-empty-msg">
          {t("home:openPrs.more", { n: state.total - state.items.length })}
        </p>
      ) : null}
    </section>
  );
}
