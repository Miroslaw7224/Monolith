// src/features/home/HomeView.tsx
"use client";
import React, { useCallback, useEffect, useState } from "react";
import "./home.css";
import type { translations } from "@/src/translations";
import type { CockpitDto } from "@/contexts/bc_cockpit/schemas";
import { AppHeader } from "@/src/components/layout/AppHeader";
import type { PlanningTab } from "@/src/features/planowanie/planningTab";
import { CockpitSections } from "./CockpitSections";
import { PinPicker } from "./PinPicker";
import { StatusBar } from "./StatusBar";
import { formatLongDate, hhmm, meetingsLabel, weekNumber } from "./cockpitFormat";

type T = (typeof translations)["en"];

interface HomeViewProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: T;
  appMode: "home" | "planowanie";
  setAppMode: (mode: "home" | "planowanie") => void;
  planningTab: PlanningTab;
  setPlanningTab: (tab: PlanningTab) => void;
  setLang: (lang: "en" | "pl") => void;
  /** „Wejdź” na karcie tematu: otwiera kartę Projekty z wybranym projektem. */
  onOpenProject?: (id: string) => void;
}

export default function HomeView({
  apiFetch,
  lang,
  t,
  setAppMode,
  setPlanningTab,
  setLang,
  onOpenProject,
}: HomeViewProps) {
  const [cockpit, setCockpit] = useState<CockpitDto | null>(null);
  const [cockpitError, setCockpitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const goToTab = (tab: PlanningTab) => {
    setPlanningTab(tab);
    setAppMode("planowanie");
  };

  const meetings = cockpit?.events.filter((e) => e.type === "meeting").length ?? null;

  return (
    <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden pb-16 md:pb-0">
      <AppHeader
        lang={lang}
        setLang={setLang}
        t={{
          brainActive: t.brainActive,
          searchPlaceholder: t.searchPlaceholder,
          feedback: t.feedback,
        }}
      />
      <div className="kok flex-1 min-h-0 overflow-y-auto" data-card="kokpit">
        <header className="kok-head">
          <div>
            <p className="kok-eyebrow">Alt+1 · Kokpit</p>
            <h1 className="kok-title">{formatLongDate(now)}</h1>
            {meetings !== null ? <p className="kok-sub">{meetingsLabel(meetings)}</p> : null}
          </div>
          <div className="kok-clock" aria-label="Aktualna godzina">
            {hhmm(now.getHours() * 60 + now.getMinutes())}
            <small>tydz. {weekNumber(now)}</small>
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

        <div className="kok-quick-actions">
          <h3 className="kok-section-title">{t.homeQuickActions}</h3>
          <div className="kok-actions">
            {[
              { label: t.homeAddNote, action: () => goToTab("notes") },
              { label: t.homeAddTask, action: () => goToTab("tasks") },
              { label: t.tabMindMaps, action: () => goToTab("mindmaps") },
              { label: t.tabResources, action: () => goToTab("resources") },
            ].map(({ label, action }) => (
              <button key={label} onClick={action} className="kok-btn kok-btn--sm">
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <StatusBar
        projectId={cockpit?.topics[0]?.id ?? null}
        warningsCount={cockpit?.warnings.length ?? 0}
        now={now}
      />
    </main>
  );
}
