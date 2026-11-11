/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, type ComponentProps } from "react";
import dynamic from "next/dynamic";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/cn";
import {
  AppSidebar,
  type AppSidebarUser,
  type AppSidebarTranslations,
} from "@/src/components/layout/AppSidebar";
import { AppHeader } from "@/src/components/layout/AppHeader";
import { CalendarView } from "@/src/components/CalendarView";
import { TasksSection } from "@/src/components/TasksSection";
import { TagsSection, type UserTag } from "@/src/components/TagsSection";
import { ResourceSection } from "@/src/components/ResourceSection";
import {
  AgentPendingActions,
  type PendingAgentAction,
} from "@/src/components/AgentPendingActions";
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
>(
  () => import("@/src/components/ActivityLog").then((mod) => mod.ActivityLog),
  { loading: () => <div className="flex-1 min-h-[24rem]" /> }
);

function planAskResponseText(data: { text?: string; error?: unknown }): string {
  if (data.text) return data.text;
  const e = data.error;
  if (typeof e === "string") return e;
  if (
    e &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return (e as { message: string }).message;
  }
  return "";
}

export interface PlanowanieViewProps {
  user: AppSidebarUser | null;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: TranslationsEn;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  appMode: "home" | "planowanie";
  setAppMode: (mode: "home" | "planowanie") => void;
  planningTab: PlanningTab;
  setPlanningTab: (tab: PlanningTab) => void;
  onLogout: () => void;
  setLang: (lang: "en" | "pl") => void;
}

export default function PlanowanieView({
  user,
  apiFetch,
  lang,
  t,
  isSidebarOpen,
  setIsSidebarOpen,
  appMode,
  setAppMode,
  planningTab,
  setPlanningTab,
  onLogout,
  setLang,
}: PlanowanieViewProps) {
  const [planAskInput, setPlanAskInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>(
    []
  );
  const [planAskLoading, setPlanAskLoading] = useState(false);
  const [planAskPendingMessage, setPlanAskPendingMessage] = useState<string | null>(null);
  const [planAskUnknownTags, setPlanAskUnknownTags] = useState<string[]>([]);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [agentPending, setAgentPending] = useState<PendingAgentAction[]>([]);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [userTags, setUserTags] = useState<UserTag[]>([]);
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null);
  const [sessionEndError, setSessionEndError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditMode, setNoteEditMode] = useState(false);

  const { notes, fetchNotes } = useNotesData(apiFetch);

  useEffect(() => {
    if (!user?.id) {
      setActiveSessionState(null);
      return;
    }
    const stored = getActiveSession(user.id);
    setActiveSessionState(stored);
  }, [user?.id]);

  useEffect(() => {
    if (user && planningTab === "notes") {
      void fetchNotes();
    }
  }, [user, planningTab, fetchNotes]);

  const handleStartSession = useCallback(
    (payload: { title: string; tags: string[]; color: string }) => {
      if (!user?.id) return;
      const session: ActiveSession = {
        title: payload.title,
        startedAt: new Date().toISOString(),
        tags: payload.tags,
        color: payload.color,
      };
      setActiveSessionState(session);
      setActiveSession(user.id, session);
    },
    [user?.id]
  );

  const handleEndSession = useCallback(async () => {
    if (!activeSession || !user?.id) return;
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
      clearActiveSession(user.id);
      setCalendarRefreshKey((k) => k + 1);
    } catch (err) {
      setSessionEndError(err instanceof Error ? err.message : "Failed to save");
    }
  }, [activeSession, user?.id, apiFetch]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/agent/status");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setAgentEnabled(Boolean(data.enabled));
      } catch {
        // agent stays disabled
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

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

  const applyAgentChanges = (changed: string[]) => {
    if (changed.includes("calendar")) setCalendarRefreshKey((k) => k + 1);
    if (changed.includes("tasks") || changed.includes("mindmaps")) {
      setDataRefreshKey((k) => k + 1);
    }
  };

  const handlePlanAsk = async () => {
    const message = planAskInput.trim();
    if (!message || planAskLoading) return;
    setPlanAskInput("");
    setMessages((prev) => [...prev, { role: "user" as const, content: message }].slice(-20));
    setPlanAskLoading(true);
    setPlanAskUnknownTags([]);
    setPlanAskPendingMessage(null);
    try {
      const res = await apiFetch(agentEnabled ? "/api/agent/chat" : "/api/plan/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          agentEnabled ? { message, lang, history: messages.slice(-12) } : { message, lang }
        ),
      });
      const data = await res.json();
      const text = planAskResponseText(data);
      setMessages((prev) =>
        [...prev, { role: "assistant" as const, content: text || "…" }].slice(-20)
      );
      if (Array.isArray(data.unknownTags) && data.unknownTags.length > 0) {
        setPlanAskUnknownTags(data.unknownTags);
        setPlanAskPendingMessage(message);
      }
      if (data.created) {
        setCalendarRefreshKey((k) => k + 1);
      }
      if (agentEnabled) {
        setAgentPending(Array.isArray(data.pending) ? data.pending : []);
        if (Array.isArray(data.changed)) applyAgentChanges(data.changed);
      }
    } catch {
      const errorMsg =
        lang === "pl" ? "Nie udało się przetworzyć zapytania." : "Failed to process request.";
      setMessages((prev) =>
        [...prev, { role: "assistant" as const, content: errorMsg }].slice(-20)
      );
    } finally {
      setPlanAskLoading(false);
    }
  };

  const handleAgentConfirm = async (action: PendingAgentAction) => {
    setPlanAskLoading(true);
    try {
      const res = await apiFetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: action.tool, args: action.args }),
      });
      const data = await res.json();
      const text = data.message ?? data.error ?? "…";
      setMessages((prev) => [...prev, { role: "assistant" as const, content: text }].slice(-20));
      setAgentPending((prev) => prev.filter((p) => p.id !== action.id));
      if (Array.isArray(data.changed)) applyAgentChanges(data.changed);
    } catch {
      const errorMsg =
        lang === "pl" ? "Nie udało się wykonać akcji." : "Failed to run the action.";
      setMessages((prev) => [...prev, { role: "assistant" as const, content: errorMsg }].slice(-20));
    } finally {
      setPlanAskLoading(false);
    }
  };

  const handleAgentCancel = (action: PendingAgentAction) => {
    setAgentPending((prev) => prev.filter((p) => p.id !== action.id));
    const text = lang === "pl" ? "Anulowano." : "Cancelled.";
    setMessages((prev) => [...prev, { role: "assistant" as const, content: text }].slice(-20));
  };

  const handlePlanAskAddTagAndRetry = async () => {
    if (!planAskPendingMessage || planAskLoading) return;
    setPlanAskLoading(true);
    try {
      for (const tag of planAskUnknownTags) {
        await apiFetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag, title: tag }),
        });
      }
      await fetchTags();
      const res = await apiFetch("/api/plan/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: planAskPendingMessage, lang }),
      });
      const data = await res.json();
      const text = planAskResponseText(data);
      setMessages((prev) =>
        [...prev, { role: "assistant" as const, content: text || "…" }].slice(-20)
      );
      setPlanAskPendingMessage(null);
      setPlanAskUnknownTags([]);
      if (data.created) {
        setCalendarRefreshKey((k) => k + 1);
      }
    } catch (err) {
      const errorMsg =
        lang === "pl" ? "Nie udało się dodać tagu lub wpisu." : "Failed to add tag or entry.";
      setMessages((prev) =>
        [...prev, { role: "assistant" as const, content: errorMsg }].slice(-20)
      );
    } finally {
      setPlanAskLoading(false);
    }
  };

  const sidebarT: AppSidebarTranslations = {
    title: t.title,
    subtitle: t.subtitle,
    logout: t.logout,
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
        user={user}
        onLogout={onLogout}
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
                key={`maps-${dataRefreshKey}`}
                apiFetch={apiFetch}
                title={(t.tabMindMaps as string) ?? "Mapy myśli"}
                t={t}
              />
            </div>
          ) : planningTab === "board" ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)] min-h-0">
              <BoardTab
                apiFetch={apiFetch}
                userId={user?.id ?? ""}
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
            <TasksSection key={`tasks-${dataRefreshKey}`} apiFetch={apiFetch} lang={lang} t={t} />
          )}
        </div>

        <div className="flex-shrink-0 p-4 bg-[var(--surface)] border-t border-[var(--border)]">
          <div className="max-w-2xl mx-auto">
            <div
              className="overflow-y-auto mb-2 space-y-2 px-2 py-1 rounded-lg bg-[var(--bg2)]"
              style={{ maxHeight: 240 }}
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-sm px-3 py-2 rounded-lg max-w-[85%]",
                    m.role === "user"
                      ? "ml-auto bg-[var(--accent)] text-white"
                      : "mr-auto bg-[var(--bg3)] text-[var(--text)]"
                  )}
                >
                  {m.content}
                </div>
              ))}
              {planAskLoading && (
                <div className="flex items-center gap-1 text-[var(--text3)] text-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  <span>…</span>
                </div>
              )}
            </div>
            <AgentPendingActions
              pending={agentPending}
              busy={planAskLoading}
              lang={lang}
              onConfirm={handleAgentConfirm}
              onCancel={handleAgentCancel}
            />
            {planAskUnknownTags.length > 0 && (
              <button
                type="button"
                onClick={handlePlanAskAddTagAndRetry}
                disabled={planAskLoading}
                className="mb-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:brightness-110 disabled:opacity-50"
              >
                {lang === "pl"
                  ? planAskUnknownTags.length === 1
                    ? `Dodaj tag "${planAskUnknownTags[0]}" i wpis`
                    : "Dodaj tagi i wpis"
                  : planAskUnknownTags.length === 1
                    ? `Add tag "${planAskUnknownTags[0]}" and entry`
                    : "Add tags and entry"}
              </button>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={planAskInput}
                onChange={(e) => setPlanAskInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePlanAsk()}
                placeholder={t.planAskPlaceholder}
                className="flex-1 px-4 py-2 bg-[var(--bg3)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                onClick={handlePlanAsk}
                disabled={!planAskInput.trim() || planAskLoading}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1",
                  planAskInput.trim() && !planAskLoading
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg3)] text-[var(--text3)]"
                )}
              >
                {planAskLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
