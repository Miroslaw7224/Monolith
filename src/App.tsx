/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useT } from "@/src/i18n/useT";
import { useLang } from "@/src/i18n/useLang";
import { apiFetch } from "@/src/lib/apiFetch";
import HomeView from "@/src/features/home/HomeView";
import { ShellStatusBar } from "@/src/features/home/ShellStatusBar";
import { MobileNav } from "@/src/components/layout/MobileNav";
import { MobileMoreDrawer } from "@/src/components/layout/MobileMoreDrawer";
import { useCardNavigation } from "@/src/features/cards/useCardNavigation";
import { useCardHotkeys } from "@/src/features/cards/useCardHotkeys";
import { CardRail } from "@/src/features/cards/CardRail";
import { CommandPalette } from "@/src/features/cards/CommandPalette";
import { buildCardCommands } from "@/src/features/cards/cards";
import { buildAppCommands } from "@/src/features/cards/appCommands";
import { FeedbackModal } from "@/src/components/layout/FeedbackModal";
import { useTheme } from "@/src/components/theme/ThemeProvider";

/** Widoki poza Kokpitem ładują się dopiero po wejściu w kartę (mniejszy pierwszy bundle). */
const ViewFallback = () => <div className="flex-1" aria-busy="true" />;
const ProjectsView = dynamic(
  () => import("@/src/features/projects/ProjectsView").then((m) => m.ProjectsView),
  { ssr: false, loading: ViewFallback }
);
const MapView = dynamic(() => import("@/src/features/map/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: ViewFallback,
});
const CodexView = dynamic(() => import("@/src/features/codex/CodexView").then((m) => m.CodexView), {
  ssr: false,
  loading: ViewFallback,
});
const PlanowanieView = dynamic(() => import("@/src/features/planowanie/PlanowanieView"), {
  ssr: false,
  loading: ViewFallback,
});

export default function App() {
  const { lang, toggleLang } = useLang();
  const tShell = useT();
  const {
    appMode,
    setAppMode,
    planningTab,
    setPlanningTab,
    codexOpen,
    projectsOpen,
    mapOpen,
    activeCard,
    selectCard,
  } = useCardNavigation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const { toggleTheme } = useTheme();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const openFeedback = useCallback(() => setFeedbackOpen(true), []);
  const paletteCommands = useMemo(
    () => [
      ...buildCardCommands(selectCard, tShell),
      ...buildAppCommands({ lang, toggleLang, toggleTheme, openFeedback, t: tShell }),
    ],
    [selectCard, tShell, lang, toggleLang, toggleTheme, openFeedback]
  );
  const [inboxFocus, setInboxFocus] = useState(false);
  const captureInbox = useCallback(() => {
    selectCard("kokpit");
    setInboxFocus(true);
  }, [selectCard]);
  const clearInboxFocus = useCallback(() => setInboxFocus(false), []);
  useCardHotkeys({
    onSelectCard: selectCard,
    onOpenPalette: openPalette,
    onCaptureInbox: captureInbox,
    disabled: paletteOpen,
  });
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [projectToOpen, setProjectToOpen] = useState<string | null>(null);
  const openProject = useCallback(
    (id: string) => {
      setProjectToOpen(id);
      selectCard("projekty");
    },
    [selectCard]
  );
  useEffect(() => {
    if (activeCard !== "projekty") setProjectToOpen(null);
  }, [activeCard]);

  return (
    <div
      className="flex h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden"
      data-card={activeCard}
    >
      <CardRail activeCard={activeCard} onSelect={selectCard} onOpenPalette={openPalette} />
      {!projectsOpen && !mapOpen && !codexOpen && appMode === "home" ? (
        <HomeView
          apiFetch={apiFetch}
          onOpenProject={openProject}
          onOpenTasks={() => selectCard("zadania")}
          focusInbox={inboxFocus}
          onInboxFocused={clearInboxFocus}
        />
      ) : (
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden pb-16 md:pb-0">
          {projectsOpen ? (
            <ProjectsView apiFetch={apiFetch} initialProjectId={projectToOpen} />
          ) : mapOpen ? (
            <MapView apiFetch={apiFetch} onOpenProject={openProject} />
          ) : codexOpen ? (
            <CodexView apiFetch={apiFetch} />
          ) : (
            <PlanowanieView
              apiFetch={apiFetch}
              appMode={appMode}
              setAppMode={setAppMode}
              planningTab={planningTab}
              setPlanningTab={setPlanningTab}
            />
          )}
          <ShellStatusBar apiFetch={apiFetch} refreshKey={activeCard} />
        </div>
      )}
      <MobileNav
        appMode={appMode}
        setAppMode={setAppMode}
        planningTab={planningTab}
        setPlanningTab={setPlanningTab}
        onMoreOpen={() => setMoreDrawerOpen(true)}
      />
      <MobileMoreDrawer
        isOpen={moreDrawerOpen}
        onClose={() => setMoreDrawerOpen(false)}
        onToggleLang={toggleLang}
        onToggleTheme={toggleTheme}
        onFeedback={() => {
          setMoreDrawerOpen(false);
          openFeedback();
        }}
        onSelectTab={(tab) => {
          setPlanningTab(tab);
          setAppMode("planowanie");
          setMoreDrawerOpen(false);
        }}
      />
      {paletteOpen && <CommandPalette commands={paletteCommands} onClose={closePalette} />}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
