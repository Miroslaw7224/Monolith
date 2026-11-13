// src/features/home/HomeView.tsx
"use client";
import React, { useCallback, useEffect, useState } from "react";
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
  meetingsLabel,
  upcomingWindows,
  weekNumber,
  windowsLabel,
} from "./cockpitFormat";

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
      setCockpitError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadCockpit();
  }, [loadCockpit]);

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
            <p className="kok-eyebrow">Alt+1 · Kokpit</p>
            <h1 className="kok-title">{formatLongDate(now)}</h1>
            {meetings !== null ? (
              <p className="kok-sub">
                {[meetingsLabel(meetings), windowsLabel(deepWindows)].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="kok-head__right">
            <div className="kok-clock" aria-label="Aktualna godzina">
              {hhmm(now.getHours() * 60 + now.getMinutes())}
              <small>tydz. {weekNumber(now)}</small>
            </div>
            {cockpit ? (
              <button
                type="button"
                className="kok-btn kok-btn--primary"
                onClick={() => setCloseOpen(true)}
              >
                {cockpit.closing.today ? "Dzień zamknięty · zmień" : "Zamknij dzień"}
              </button>
            ) : null}
          </div>
        </header>

        {loading && cockpit === null ? (
          <p className="kok-state">…</p>
        ) : cockpitError !== null ? (
          <p className="kok-state kok-state--error">
            Nie udało się wczytać Kokpitu ({cockpitError})
          </p>
        ) : cockpit !== null ? (
          <CockpitSections
            data={cockpit}
            now={now}
            apiFetch={apiFetch}
            onChangeActive={() => setPickerOpen(true)}
            onOpenProject={(id) => onOpenProject?.(id)}
            onInboxChanged={() => void loadCockpit()}
            onQueueChanged={() => void loadCockpit()}
            onOpenTasks={() => onOpenTasks?.()}
            focusInbox={focusInbox}
            onInboxFocused={onInboxFocused}
          />
        ) : null}

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
            currentIds={cockpit?.topics.map((topic) => topic.id) ?? []}
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
