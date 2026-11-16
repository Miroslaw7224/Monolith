import React, { useEffect, useRef, useState } from "react";
import type { WeekFocusDto, WeekReviewDto } from "@/contexts/bc_cockpit/schemas";
import { useT } from "@/src/i18n/useT";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;
type CopyState = "idle" | "ok" | "error";

/** Zgodne z `MAX_FOCUS_TEXT` w services (UI nie importuje wartości z kontekstu poza schemas). */
const MAX_FOCUS = 300;

/**
 * Przegląd ostatnich 7 dni: zestawienie, przycisk kopiujący prompt dla agenta i focus tygodnia.
 * Zwinięty nie pobiera danych; aplikacja niczego nie wysyła do modelu.
 */
export function WeekReview({
  apiFetch,
  focus,
  onChangeActive,
  onFocusSaved,
}: {
  apiFetch: ApiFetch;
  focus: WeekFocusDto | null;
  onChangeActive: () => void;
  onFocusSaved: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<WeekReviewDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [copy, setCopy] = useState<CopyState>("idle");
  const [text, setText] = useState(focus?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    apiFetch("/api/cockpit/week-review")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: WeekReviewDto) => {
        if (data && Array.isArray(data.projects)) setReview(data);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [open, apiFetch]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copyPrompt = async () => {
    if (!review) return;
    try {
      await navigator.clipboard.writeText(review.prompt);
      setCopy("ok");
    } catch {
      setCopy("error");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopy("idle"), 2000);
  };

  const trimmed = text.trim();
  const saveFocus = async () => {
    setSaving(true);
    setSaveFailed(false);
    try {
      const res = await apiFetch("/api/cockpit/week-focus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onFocusSaved();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="kok-panel kok-week" aria-label={t("home:weekReview.aria")}>
      <div className="kok-panel__head">
        <h3 className="kok-panel__title">
          <b>{t("home:weekReview.title")}</b>
        </h3>
        <div className="kok-panel__tools">
          <button
            type="button"
            className="kok-btn kok-btn--sm"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t("home:weekReview.hide") : t("home:weekReview.show")}
          </button>
        </div>
      </div>

      {open ? (
        <div className="kok-week__body">
          {failed ? (
            <p className="kok-state kok-state--error">{t("home:weekReview.error")}</p>
          ) : review === null ? (
            <p className="kok-state">{t("home:weekReview.loading")}</p>
          ) : (
            <>
              {!review.git.available ? (
                <p className="kok-empty-msg">{t("home:weekReview.gitUnavailable")}</p>
              ) : review.projects.length === 0 ? (
                <p className="kok-empty-msg">{t("home:weekReview.noActivity")}</p>
              ) : (
                <ul className="kok-week__list">
                  {review.projects.map((p) => (
                    <li key={p.projectId} className="kok-week__row">
                      <span className="kok-week__name">{p.name}</span>
                      {p.work ? (
                        <span className="kok-chip">{t("home:weekReview.companyData")}</span>
                      ) : null}
                      <span className="kok-week__meta">
                        {t("home:weekReview.projectLine", { commits: p.commits, prs: p.prs })}
                      </span>
                      {p.doneTasks.length > 0 ? (
                        <span className="kok-week__meta">
                          {t("home:weekReview.doneTasks", { count: p.doneTasks.length })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {review.closings.length > 0 ? (
                <>
                  <h4 className="kok-week__sub">{t("home:weekReview.closingsTitle")}</h4>
                  <ul className="kok-week__list">
                    {review.closings.map((c) => (
                      <li key={c.date}>
                        {c.date}: {c.text ?? t("home:weekReview.closingHidden")}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {review.reviews.available ? (
                <p className="kok-week__line">
                  {t("home:weekReview.reviews", {
                    approved: review.reviews.approved,
                    comments: review.reviews.comments,
                    prs: review.reviews.prs,
                  })}
                </p>
              ) : null}
              {review.meetings.count > 0 ? (
                <p className="kok-week__line">
                  {t("home:weekReview.meetings", {
                    count: review.meetings.count,
                    minutes: review.meetings.minutes,
                  })}
                </p>
              ) : null}

              <div className="kok-week__actions">
                <button type="button" className="kok-btn kok-btn--sm" onClick={copyPrompt}>
                  {copy === "ok"
                    ? t("home:weekReview.copyOk")
                    : copy === "error"
                      ? t("home:weekReview.copyError")
                      : t("home:weekReview.copyPrompt")}
                </button>
              </div>
              {review.containsWork ? (
                <p className="kok-week__warn">{t("home:weekReview.workWarning")}</p>
              ) : null}
            </>
          )}

          <div className="kok-week__focus">
            <label htmlFor="kok-week-focus" className="kok-week__sub">
              {t("home:weekReview.focusLabel")}
            </label>
            <input
              id="kok-week-focus"
              type="text"
              className="kok-week__input"
              maxLength={MAX_FOCUS}
              placeholder={t("home:weekReview.focusPlaceholder")}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="kok-week__actions">
              <button
                type="button"
                className="kok-btn kok-btn--sm kok-btn--primary"
                disabled={trimmed === "" || saving}
                onClick={saveFocus}
              >
                {t("home:weekReview.focusSave")}
              </button>
              <button type="button" className="kok-btn kok-btn--sm" onClick={onChangeActive}>
                {t("home:weekReview.changeActive")}
              </button>
            </div>
            {saveFailed ? (
              <p className="kok-state kok-state--error" role="alert">
                {t("home:weekReview.saveFailed")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
