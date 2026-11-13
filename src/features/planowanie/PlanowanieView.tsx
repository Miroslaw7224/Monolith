/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, type ComponentProps } from "react";
import dynamic from "next/dynamic";
import { AppSidebar, type AppSidebarTranslations } from "@/src/components/layout/AppSidebar";
import { AppHeader } from "@/src/components/layout/AppHeader";
import { CalendarView } from "@/src/components/CalendarView";
import { TasksSection } from "@/src/components/TasksSection";
import { TagsSection, type UserTag } from "@/src/features/tags/TagsSection";
import { ResourceSection } from "@/src/components/ResourceSection";
import { MindMapsTab } from "@/src/features/mind-maps/MindMapsTab";
import { BoardTab } from "@/src/features/board/BoardTab";
import { NotesPanel } from "@/src/features/notes/NotesPanel";
import { useNotesData, type Note } from "@/src/features/notes/useNotesData";
import { PlanowanieSidebarContent, type PlanningTab } from "./PlanowanieSidebarContent";
import {
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  type ActiveSession,
} from "@/src/lib/activeSession";
import type { translations } from "@/src/translations";

type TranslationsEn = (typeof translations)["en"];

const ActivityLog = dynamic<
  ComponentProps<typeof import("@/src/components/ActivityLog").ActivityLog>
>(() => import("@/src/components/ActivityLog").then((mod) => mod.ActivityLog), {
  loading: () => <div className="flex-1 min-h-[24rem]" />,
});

export interface PlanowanieViewProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: TranslationsEn;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  appMode: "home" | "planowanie";
  setAppMode: (mode: "home" | "planowanie") => void;
  planningTab: PlanningTab;
  setPlanningTab: (tab: PlanningTab) => void;
  setLang: (lang: "en" | "pl") => void;
}

export default function PlanowanieView({
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
}: PlanowanieViewProps) {
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [userTags, setUserTags] = useState<UserTag[]>([]);
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null);
  const [sessionEndError, setSessionEndError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditMode, setNoteEditMode] = useState(false);

  const { notes, fetchNotes } = useNotesData(apiFetch);

  useEffect(() => {
    setActiveSessionState(getActiveSession());
  }, []);

  useEffect(() => {
    if (planningTab === "notes") {
      void fetchNotes();
    }
  }, [planningTab, fetchNotes]);

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
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
      setCalendarRefreshKey((k) => k + 1);
    } catch (err) {
      setSessionEndError(err instanceof Error ? err.message : "Failed to save");
    }
  }, [activeSession, apiFetch]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await apiFetch("/api/tags");
      const data = await res.json();
      setUserTags(Array.isArray(data) ? data : []);
    } catch {
      setUserTags([]);
    }
  }, [apiFetch]);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const handleSaveNote = async () => {
    if (!selectedNote) return;
    try {
      const method = selectedNote.id ? "PUT" : "POST";
      const url = selectedNote.id ? `/api/notes/${selectedNote.id}` : "/api/notes";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedNote),
      });
      if (res.ok) {
        await fetchNotes();
        if (method === "POST") {
          const data = await res.json();
          setSelectedNote({
            ...data,
            created_at: data.created_at ?? new Date().toISOString(),
          });
        }
        setNoteEditMode(false);
      }
    } catch (err) {
      console.error("Failed to save note", err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await apiFetch(`/api/notes/${id}`, { method: "DELETE" });
      await fetchNotes();
      if (selectedNote?.id === id) setSelectedNote(null);
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  const handleSelectTab = (tab: PlanningTab) => {
    setAppMode("planowanie");
    setPlanningTab(tab);
  };

  const sidebarT: AppSidebarTranslations = {
    title: t.title,
    subtitle: t.subtitle,
    proPlan: t.proPlan,
    docsLimit: t.docsLimit,
  };

  const sidebarContent = (
    <PlanowanieSidebarContent
      planningTab={planningTab}
      setPlanningTab={setPlanningTab}
      activeMode={appMode}
      onGoHome={() => setAppMode("home")}
      onSelectTab={handleSelectTab}
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
  );

  return (
    <>
      <AppSidebar
        isSidebarOpen={isSidebarOpen}
        lang={lang}
        setLang={setLang}
        documentsCount={0}
        t={sidebarT}
      >
        {sidebarContent}
      </AppSidebar>

      <main className="flex-1 min-w-0 flex flex-col relative pb-16 md:pb-0">
        <AppHeader
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          t={{
            brainActive: t.brainActive,
            searchPlaceholder: t.searchPlaceholder,
            feedback: t.feedback,
          }}
        />

        <div className="flex-1 min-w-0 overflow-hidden flex flex-col min-h-0">
          {activeSession && planningTab !== "calendar" && (
            <div className="flex-shrink-0 px-4 py-2 bg-[var(--accent-bg)] border-b border-[var(--accent)] flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--text)]">
                {(t.sessionInProgressSince as string)?.replace(
                  "{time}",
                  new Date(activeSession.startedAt).toLocaleTimeString(
                    lang === "pl" ? "pl-PL" : "en-US",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )
                ) ??
                  `Work in progress since ${new Date(activeSession.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
              </span>
              <button
                type="button"
                onClick={handleEndSession}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:brightness-110"
              >
                {t.sessionEndButton as string}
              </button>
            </div>
          )}
          {planningTab === "calendar" ? (
            <CalendarView
              apiFetch={apiFetch}
              lang={lang}
              t={t}
              userTags={userTags}
              refreshTrigger={calendarRefreshKey}
              activeSession={activeSession}
              onStartSession={handleStartSession}
              onEndSession={handleEndSession}
              sessionEndError={sessionEndError}
              clearSessionEndError={() => setSessionEndError(null)}
              onOpenTaskDeadline={() => setPlanningTab("tasks")}
            />
          ) : planningTab === "activity" ? (
            <ActivityLog apiFetch={apiFetch} lang={lang} t={t} userTags={userTags} />
          ) : planningTab === "tags" ? (
            <TagsSection
              apiFetch={apiFetch}
              lang={lang}
              t={t}
              userTags={userTags}
              onTagsChange={fetchTags}
            />
          ) : planningTab === "notes" ? (
            <NotesPanel
              notes={notes}
              selectedNote={selectedNote}
              setSelectedNote={setSelectedNote}
              noteEditMode={noteEditMode}
              setNoteEditMode={setNoteEditMode}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
              newNote={t.newNote}
              noteTitlePlaceholder={t.noteTitlePlaceholder}
              noteContentPlaceholder={t.noteContentPlaceholder}
              noteCancelEdit={t.noteCancelEdit}
              saveNote={t.saveNote}
              noteEdit={t.noteEdit}
              deleteNote={t.deleteNote}
            />
          ) : planningTab === "resources" ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
              <ResourceSection apiFetch={apiFetch} t={t as Record<string, string | string[]>} />
            </div>
          ) : planningTab === "mindmaps" ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
              <MindMapsTab
                apiFetch={apiFetch}
                title={(t.tabMindMaps as string) ?? "Mapy myśli"}
                t={t}
              />
            </div>
          ) : planningTab === "board" ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)] min-h-0">
              <BoardTab
                apiFetch={apiFetch}
                lang={lang}
                labels={{
                  canvas: t.boardCanvas as string,
                  list: t.boardList as string,
                  saveFailed: t.boardSaveFailed as string,
                  loadFailed: t.boardLoadFailed as string,
                  retry: t.boardRetry as string,
                  outside: t.boardOutside as string,
                  tileTitle: t.boardTileTitle as string,
                  tileNote: t.boardTileNote as string,
                  close: t.boardClose as string,
                }}
                canvasLabels={{
                  addTile: t.boardAddTile as string,
                  addFrame: t.boardAddFrame as string,
                  newTile: t.boardNewTile as string,
                  frameName: t.boardFrameName as string,
                  save: t.boardSave as string,
                  cancel: t.boardCancel as string,
                  delete: t.boardDelete as string,
                }}
              />
            </div>
          ) : (
            <TasksSection apiFetch={apiFetch} lang={lang} t={t} />
          )}
        </div>
      </main>
    </>
  );
}
