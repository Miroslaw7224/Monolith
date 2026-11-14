"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanningTab } from "@/src/features/planowanie/planningTab";
import { type AppMode, type CardId, cardForView, cardFromHash, getCard } from "./cards";

export interface CardNavigation {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  planningTab: PlanningTab;
  setPlanningTab: (tab: PlanningTab) => void;
  placeholder: CardId | null;
  projectsOpen: boolean;
  mapOpen: boolean;
  activeCard: CardId;
  selectCard: (id: CardId) => void;
}

export function useCardNavigation(): CardNavigation {
  const [appMode, setAppModeRaw] = useState<AppMode>("home");
  const [planningTab, setPlanningTabRaw] = useState<PlanningTab>("tasks");
  const [standalone, setStandalone] = useState<CardId | null>(null);

  const setAppMode = useCallback((mode: AppMode) => {
    setStandalone(null);
    setAppModeRaw(mode);
  }, []);

  const setPlanningTab = useCallback((tab: PlanningTab) => {
    setStandalone(null);
    setPlanningTabRaw(tab);
  }, []);

  const selectCard = useCallback((id: CardId) => {
    const { target } = getCard(id);
    if (target.kind === "placeholder" || target.kind === "projects" || target.kind === "map") {
      setStandalone(id);
      return;
    }
    setStandalone(null);
    if (target.kind === "home") {
      setAppModeRaw("home");
    } else {
      setAppModeRaw("planowanie");
      setPlanningTabRaw(target.tab);
    }
  }, []);

  const placeholder =
    standalone && getCard(standalone).target.kind === "placeholder" ? standalone : null;
  const projectsOpen = standalone === "projekty";
  const mapOpen = standalone === "mapa";
  const activeCard = standalone ?? cardForView(appMode, planningTab);

  // Hash czytamy tylko raz: w StrictMode efekty biegną dwa razy, a drugi odczyt
  // trafiłby już na hash nadpisany przez efekt poniżej.
  const hashApplied = useRef(false);
  useEffect(() => {
    if (hashApplied.current) return;
    hashApplied.current = true;
    const fromHash = cardFromHash(window.location.hash);
    if (fromHash) selectCard(fromHash);
  }, [selectCard]);

  useEffect(() => {
    const url = `${window.location.pathname}${window.location.search}#${activeCard}`;
    window.history.replaceState(window.history.state, "", url);
  }, [activeCard]);

  return {
    appMode,
    setAppMode,
    planningTab,
    setPlanningTab,
    placeholder,
    projectsOpen,
    mapOpen,
    activeCard,
    selectCard,
  };
}
