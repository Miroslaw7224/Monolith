/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { translations } from "@/src/translations";
import { apiFetch } from "@/src/lib/apiFetch";
import PlanowanieView from "@/src/features/planowanie/PlanowanieView";
import HomeView from "@/src/features/home/HomeView";
import { MobileNav } from "@/src/components/layout/MobileNav";
import { MobileMoreDrawer } from "@/src/components/layout/MobileMoreDrawer";
import { useCardNavigation } from "@/src/features/cards/useCardNavigation";
import { useCardHotkeys } from "@/src/features/cards/useCardHotkeys";
import { CardRail } from "@/src/features/cards/CardRail";
import { CommandPalette } from "@/src/features/cards/CommandPalette";
import { CardPlaceholder } from "@/src/features/cards/CardPlaceholder";
import { buildCardCommands } from "@/src/features/cards/cards";
import { buildAppCommands } from "@/src/features/cards/appCommands";
import { FeedbackModal } from "@/src/components/layout/FeedbackModal";
import { useTheme } from "@/src/components/theme/ThemeProvider";
import { ProjectsView } from "@/src/features/projects/ProjectsView";

export default function App() {
  const [lang, setLang] = useState<"en" | "pl">("pl");
  const t = translations[lang];
  const {
    appMode,
    setAppMode,
    planningTab,
    setPlanningTab,
    placeholder,
    projectsOpen,
    activeCard,
    selectCard,
  } = useCardNavigation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const { toggleTheme } = useTheme();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const toggleLang = useCallback(() => setLang((l) => (l === "en" ? "pl" : "en")), []);
  const openFeedback = useCallback(() => setFeedbackOpen(true), []);
  const paletteCommands = useMemo(
    () => [
      ...buildCardCommands(selectCard),
      ...buildAppCommands({ lang, toggleLang, toggleTheme, openFeedback }),
    ],
    [selectCard, lang, toggleLang, toggleTheme, openFeedback]
  );
  useCardHotkeys({
    onSelectCard: selectCard,
    onOpenPalette: openPalette,
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
      {projectsOpen ? (
        <ProjectsView apiFetch={apiFetch} initialProjectId={projectToOpen} />
      ) : placeholder ? (
        <CardPlaceholder cardId={placeholder} />
      ) : appMode === "home" ? (
        <HomeView apiFetch={apiFetch} onOpenProject={openProject} />
      ) : (
        <PlanowanieView
          apiFetch={apiFetch}
          lang={lang}
          t={t}
          appMode={appMode}
          setAppMode={setAppMode}
          planningTab={planningTab}
          setPlanningTab={setPlanningTab}
        />
      )}
      <MobileNav
        appMode={appMode}
        setAppMode={setAppMode}
        planningTab={planningTab}
        setPlanningTab={setPlanningTab}
        lang={lang}
        onMoreOpen={() => setMoreDrawerOpen(true)}
      />
      <MobileMoreDrawer
        isOpen={moreDrawerOpen}
        onClose={() => setMoreDrawerOpen(false)}
        lang={lang}
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
      {feedbackOpen && <FeedbackModal title={t.feedback} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
