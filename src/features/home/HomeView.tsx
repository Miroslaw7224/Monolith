// src/features/home/HomeView.tsx
"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import "./home.css";
import type { CockpitDto } from "@/contexts/bc_cockpit/schemas";
import { CloseDayDialog } from "./CloseDayDialog";
import { ClosingAnchor } from "./ClosingAnchor";
import { CockpitSections } from "./CockpitSections";
import { PinPicker } from "./PinPicker";
import { StatusBar } from "./StatusBar";
import {
  formatLongDate,
  hhmm,
  localDay,
  meetingsLabel,
  upcomingWindows,
  weekNumber,
  windowsLabel,
} from "./cockpitFormat";
import i18n from "@/src/i18n";
import { useT } from "@/src/i18n/useT";

interface HomeViewProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** „Wejdź” na karcie tematu: otwiera kartę Projekty z wybranym projektem. */
  onOpenProject?: (id: string) => void;
  /** „Otwórz w Zadaniach” z podglądu zadania ogólnego. */
  onOpenTasks?: () => void;
  /** Alt+I: ustaw fokus w polu szybkiego zapisu inboxu; `onInboxFocused` kasuje żądanie. */
  focusInbox?: boolean;
  onInboxFocused?: () => void;
}

export default function HomeView({
  apiFetch,
  onOpenProject,
  onOpenTasks,
  focusInbox,
  onInboxFocused,
}: HomeViewProps) {
  const t = useT();
  const [cockpit, setCockpit] = useState<CockpitDto | null>(null);
  const [cockpitError, setCockpitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const loadCockpit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/cockpit");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCockpit((await res.json()) as CockpitDto);
      setCockpitError(null);
    } catch (err) {
      setCockpitError(err instanceof Error ? err.message : i18n.t("home:view.genericError"));
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadCockpit();
  }, [loadCockpit]);

  // Przejście przez północ przy otwartej karcie: dane Kokpitu są z wczoraj, więc wczytujemy je od nowa.
  const today = localDay(now);
  const lastDay = useRef(today);
  useEffect(() => {
    if (lastDay.current === today) return;
    lastDay.current = today;
    void loadCockpit();
  }, [today, loadCockpit]);

  const meetings = cockpit?.events.filter((e) => e.type === "meeting").length ?? null;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const deepWindows = cockpit
    ? upcomingWindows(cockpit.windows, nowMinutes).filter((w) => w.energy === "deep").length
    : 0;

  return (
    <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden pb-16 md:pb-0">
      <div className="kok flex-1 min-h-0 overflow-y-auto" data-card="kokpit">
        {cockpit?.closing.anchor ? (
          <ClosingAnchor
            anchor={cockpit.closing.anchor}
            today={now}
            onOpenProject={(id) => onOpenProject?.(id)}
          />
        ) : null}
        <header className="kok-head">
          <div>
            <p className="kok-eyebrow">{t("home:view.eyebrow")}</p>
            <h1 className="kok-title">{formatLongDate(now)}</h1>
            {meetings !== null ? (
              <p className="kok-sub">
                {[meetingsLabel(meetings), windowsLabel(deepWindows)].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="kok-head__right">
            <div className="kok-clock" aria-label={t("home:view.clockAria")}>
              {hhmm(now.getHours() * 60 + now.getMinutes())}
              <small>{t("home:view.weekLabel", { week: weekNumber(now) })}</small>
            </div>
            {cockpit ? (
              <button
                type="button"
                className="kok-btn kok-btn--primary"
                onClick={() => setCloseOpen(true)}
              >
                {cockpit.closing.today ? t("home:view.dayClosedChange") : t("home:closeDay.title")}
              </button>
            ) : null}
          </div>
        </header>

        {cockpit?.weekFocus ? (
          <p className="kok-weekfocus">
            {t("home:weekReview.focusLine", { text: cockpit.weekFocus.text })}
          </p>
        ) : null}

        {loading && cockpit === null ? (
          <p className="kok-state">…</p>
        ) : cockpit === null ? (
          <p className="kok-state kok-state--error">
            {t("home:view.loadFailed", {
              error: cockpitError ?? t("home:view.noData"),
            })}
          </p>
        ) : (
          <>
            {cockpitError !== null ? (
              <p className="kok-state kok-state--error" role="alert">
                {t("home:view.refreshFailed", { error: cockpitError })}
              </p>
            ) : null}
            <CockpitSections
              data={cockpit}
              now={now}
              apiFetch={apiFetch}
              onChangeActive={() => setPickerOpen(true)}
              onOpenProject={(id) => onOpenProject?.(id)}
              onInboxChanged={() => void loadCockpit()}
              onQueueChanged={() => void loadCockpit()}
              onWeekFocusSaved={() => void loadCockpit()}
              onOpenTasks={() => onOpenTasks?.()}
              focusInbox={focusInbox}
              onInboxFocused={onInboxFocused}
            />
          </>
        )}

        {closeOpen && cockpit ? (
          <CloseDayDialog
            apiFetch={apiFetch}
            initialText={cockpit.closing.today?.text ?? ""}
            initialProjectId={cockpit.closing.today?.projectId ?? null}
            commitsToday={cockpit.git?.commitsToday ?? null}
            onCancel={() => setCloseOpen(false)}
            onSaved={() => {
              setCloseOpen(false);
              void loadCockpit();
            }}
          />
        ) : null}

        {pickerOpen && (
          <PinPicker
            apiFetch={apiFetch}
            currentIds={cockpit?.pinnedIds ?? []}
            onCancel={() => setPickerOpen(false)}
            onSaved={() => {
              setPickerOpen(false);
              void loadCockpit();
            }}
          />
        )}
      </div>
      <StatusBar
        projectId={cockpit?.topics[0]?.id ?? null}
        branch={cockpit?.git?.branch ?? null}
        warningsCount={cockpit?.warnings.length ?? 0}
        now={now}
      />
    </main>
  );
}
