// src/features/home/HomeView.tsx
"use client";
import React, { useCallback, useEffect, useState } from "react";
import "./home.css";
import type { translations } from "@/src/translations";
import type { CockpitDto } from "@/contexts/bc_cockpit/schemas";
import { ActivityLog } from "@/src/components/sessions/ActivityLog";
import type { UserTag } from "@/src/features/tags/TagsSection";
import { StartSessionModal } from "@/src/components/sessions/StartSessionModal";
import {
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  type ActiveSession,
} from "@/src/components/sessions/activeSession";
import { AppSidebar, type AppSidebarTranslations } from "@/src/components/layout/AppSidebar";
import { AppHeader } from "@/src/components/layout/AppHeader";
import {
  PlanowanieSidebarContent,
  type PlanningTab,
} from "@/src/features/planowanie/PlanowanieSidebarContent";
import { CockpitSections } from "./CockpitSections";
import { PinPicker } from "./PinPicker";

type T = (typeof translations)["en"];

interface HomeViewProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: T;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  appMode: "home" | "planowanie";
  setAppMode: (mode: "home" | "planowanie") => void;
  planningTab: PlanningTab;
  setPlanningTab: (tab: PlanningTab) => void;
  setLang: (lang: "en" | "pl") => void;
}

export default function HomeView({
  apiFetch,
  lang,
  t,
  isSidebarOpen,
  setIsSidebarOpen,
  appMode,
  setAppMode,
  planningTab,
  setPlanningTab,
  setLang,
}: HomeViewProps) {
  const [cockpit, setCockpit] = useState<CockpitDto | null>(null);
  const [cockpitError, setCockpitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [userTags, setUserTags] = useState<UserTag[]>([]);
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionEndError, setSessionEndError] = useState<string | null>(null);

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

  useEffect(() => {
    apiFetch("/api/tags")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUserTags(Array.isArray(data) ? data : []))
      .catch(() => setUserTags([]));
  }, [apiFetch]);

  useEffect(() => {
    setActiveSessionState(getActiveSession());
  }, []);

  const handleStartSession = useCallback(
    (payload: { title: string; tags: string[]; color: string }) => {
      const session: ActiveSession = {
        title: payload.title,
        startedAt: new Date().toISOString(),
        tags: payload.tags,
        color: payload.color,
      };
      setActiveSessionState(session);
      setActiveSession(session);
    },
    []
  );

  const handleEndSession = useCallback(async () => {
    if (!activeSession) return;
    setSessionEndError(null);
    const started = new Date(activeSession.startedAt);
    const now = Date.now();
    const dateStr = `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, "0")}-${String(started.getDate()).padStart(2, "0")}`;
    const startMinutes = Math.floor((started.getHours() * 60 + started.getMinutes()) / 15) * 15;
    const durationMinutes = Math.ceil((now - started.getTime()) / (15 * 60 * 1000)) * 15;
    try {
      const res = await apiFetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          start_minutes: startMinutes,
          duration_minutes: Math.max(15, durationMinutes),
          title: activeSession.title,
          tags: activeSession.tags,
          color: activeSession.color,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setActiveSessionState(null);
      clearActiveSession();
    } catch (err) {
      setSessionEndError(err instanceof Error ? err.message : "Failed to save");
    }
  }, [activeSession, apiFetch]);

  const goToTab = (tab: PlanningTab) => {
    setPlanningTab(tab);
    setAppMode("planowanie");
  };

  const greeting = t.homeGreeting;
  const dateStr = new Date().toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const sidebarT: AppSidebarTranslations = {
    title: t.title,
    subtitle: t.subtitle,
  };

  return (
    <>
      <AppSidebar isSidebarOpen={isSidebarOpen} lang={lang} setLang={setLang} t={sidebarT}>
        <PlanowanieSidebarContent
          planningTab={planningTab}
          setPlanningTab={setPlanningTab}
          activeMode={appMode}
          onGoHome={() => setAppMode("home")}
          onSelectTab={goToTab}
          modePlanowanie={t.modePlanowanie}
          tabHome={t.tabHome}
          tabCalendar={t.tabCalendar}
          tabActivity={t.tabActivity}
          tabTasks={t.tabTasks}
          tabTags={t.tabTags}
          tabNotes={t.notesTab}
          tabResources={(t.tabResources as string) ?? "Zasoby"}
          tabMindMaps={(t.tabMindMaps as string) ?? "Mapy myśli"}
          tabBoard={(t.tabBoard as string) ?? "Tablica"}
        />
      </AppSidebar>

      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden pb-16 md:pb-0">
        <AppHeader
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          t={{
            brainActive: t.brainActive,
            searchPlaceholder: t.searchPlaceholder,
            feedback: t.feedback,
          }}
        />
        <div className="kok flex-1 overflow-y-auto" data-card="kokpit">
          <header className="kok-head">
            <div>
              <p className="kok-eyebrow">Alt+1 · Kokpit</p>
              <h1 className="kok-title">{greeting} 👋</h1>
              <p className="kok-sub">{dateStr}</p>
            </div>
          </header>

          {loading && cockpit === null ? (
            <p className="kok-state">…</p>
          ) : cockpitError !== null ? (
            <p className="kok-state kok-state--error">
              Nie udało się wczytać Kokpitu ({cockpitError})
            </p>
          ) : cockpit !== null ? (
            <CockpitSections data={cockpit} onChangeActive={() => setPickerOpen(true)} />
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

          <div className="kok-activity-slot">
            <ActivityLog
              apiFetch={apiFetch}
              lang={lang}
              t={t as Record<string, string | string[]>}
              userTags={userTags}
              activeSession={activeSession}
              onStartSession={() => setSessionModalOpen(true)}
              onEndSession={handleEndSession}
            />
          </div>

          {sessionEndError && <p className="kok-state kok-state--error">{sessionEndError}</p>}

          {sessionModalOpen && (
            <div className="kok-overlay">
              <div className="kok-modal">
                <h3 className="kok-modal__title">
                  {lang === "pl" ? "Rozpocznij sesję pracy" : "Start work session"}
                </h3>
                <StartSessionModal
                  existingTags={userTags.map((u) => u.tag)}
                  tagTitles={Object.fromEntries(userTags.map((u) => [u.tag, u.title ?? u.tag]))}
                  tagColors={Object.fromEntries(userTags.map((u) => [u.tag, u.color]))}
                  onSubmit={(payload) => {
                    handleStartSession(payload);
                    setSessionModalOpen(false);
                  }}
                  onCancel={() => setSessionModalOpen(false)}
                  submitLabel={lang === "pl" ? "Rozpocznij" : "Start"}
                  cancelLabel={lang === "pl" ? "Anuluj" : "Cancel"}
                  titleLabel={lang === "pl" ? "Tytuł" : "Title"}
                  tagsLabel={lang === "pl" ? "Tagi" : "Tags"}
                  tagPlaceholder={lang === "pl" ? "Dodaj tag..." : "Add tag..."}
                  suggestionsLabel={lang === "pl" ? "Ostatnie tagi" : "Recent tags"}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
