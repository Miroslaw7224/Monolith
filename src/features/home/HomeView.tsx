// src/features/home/HomeView.tsx
"use client";
import React, { useCallback, useEffect, useState } from "react";
import type { translations } from "@/src/translations";
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

type T = (typeof translations)["en"];

interface HomeTask {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
}

interface HomeEvent {
  id: string;
  title: string;
  date: string;
}

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

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function in48hISO() {
  const d = new Date();
  d.setHours(d.getHours() + 48);
  return d.toISOString().split("T")[0];
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
  const [tasks, setTasks] = useState<HomeTask[]>([]);
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const [notesCount, setNotesCount] = useState(0);
  const [resourcesCount, setResourcesCount] = useState(0);
  const [mindMapsCount, setMindMapsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userTags, setUserTags] = useState<UserTag[]>([]);
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionEndError, setSessionEndError] = useState<string | null>(null);

  useEffect(() => {
    const today = todayISO();
    const limit48h = in48hISO();
    setLoading(true);
    Promise.all([
      apiFetch("/api/tasks")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      apiFetch(`/api/calendar/events?startDate=${today}&endDate=${limit48h}`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      apiFetch("/api/notes")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      apiFetch("/api/resources")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      apiFetch("/api/mind-maps")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([tasksData, eventsData, notesData, resourcesData, mindMapsData]) => {
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setEvents(Array.isArray(eventsData) ? eventsData : []);
        setNotesCount(Array.isArray(notesData) ? notesData.length : 0);
        setResourcesCount(Array.isArray(resourcesData) ? resourcesData.length : 0);
        setMindMapsCount(Array.isArray(mindMapsData) ? mindMapsData.length : 0);
      })
      .finally(() => setLoading(false));
  }, [apiFetch]);

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

  const today = todayISO();
  const limit48h = in48hISO();

  const todayTasks = tasks.filter(
    (n) => n.due_date && n.due_date.startsWith(today) && n.status !== "done"
  );
  const upcomingEvents = events.filter(
    (n) => n.date && n.date >= today && n.date <= limit48h && !n.id.startsWith("task:")
  );

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
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--bg)]">
          <div>
            <h2 className="text-xl font-bold text-[var(--text)]">{greeting} 👋</h2>
            <p className="text-sm text-[var(--text2)] mt-1">{dateStr}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: t.homeTodayTasks, value: todayTasks.length, color: "var(--accent)" },
              { label: t.homeUpcoming, value: upcomingEvents.length, color: "var(--green)" },
              {
                label: lang === "pl" ? "Notatki" : "Notes",
                value: notesCount,
                color: "var(--text2)",
              },
              {
                label: t.tabResources,
                value: resourcesCount,
                color: "var(--text2)",
              },
              {
                label: t.tabMindMaps,
                value: mindMapsCount,
                color: "var(--text2)",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4"
              >
                <p className="text-2xl font-bold" style={{ color }}>
                  {loading ? "—" : value}
                </p>
                <p className="text-xs text-[var(--text2)] mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text2)]">
                {t.homeTodayTasks}
              </h3>
              <button
                onClick={() => goToTab("tasks")}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {t.homeShowAll}
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-[var(--text3)]">…</p>
            ) : todayTasks.length === 0 ? (
              <p className="text-sm text-[var(--text3)]">{t.homeNoTasks}</p>
            ) : (
              <ul className="space-y-2">
                {todayTasks.slice(0, 5).map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl"
                  >
                    <div className="w-4 h-4 rounded border-2 border-[var(--accent)] flex-shrink-0" />
                    <span className="text-sm text-[var(--text)] flex-1">{task.title}</span>
                    <span className="text-xs text-[var(--accent)]">{task.due_date}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text2)] mb-3">
              {t.homeUpcoming}
            </h3>
            {loading ? (
              <p className="text-sm text-[var(--text3)]">…</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm text-[var(--text3)]">{t.homeNoEvents}</p>
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.slice(0, 3).map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl"
                  >
                    <div className="w-2 h-2 rounded-full bg-[var(--green)] flex-shrink-0" />
                    <span className="text-sm text-[var(--text)] flex-1">{ev.title}</span>
                    <span className="text-xs text-[var(--text2)]">{ev.date}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text2)] mb-3">
              {t.homeQuickActions}
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { label: t.homeAddNote, action: () => goToTab("notes") },
                { label: t.homeAddTask, action: () => goToTab("tasks") },
                { label: t.tabMindMaps, action: () => goToTab("mindmaps") },
                { label: t.tabResources, action: () => goToTab("resources") },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text2)] hover:bg-[var(--bg2)] transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
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

          {sessionEndError && <p className="text-sm text-red-500">{sessionEndError}</p>}

          {sessionModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-[var(--bg2)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-base font-bold text-[var(--text)] mb-4">
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
