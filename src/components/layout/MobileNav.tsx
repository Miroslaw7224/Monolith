"use client";
import React from "react";
import { Home, CheckSquare, FileText, Calendar, MoreHorizontal } from "lucide-react";
import { cn } from "@/src/lib/cn";
import type { PlanningTab } from "@/src/features/planowanie/planningTab";

type AppMode = "home" | "planowanie";

interface MobileNavProps {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  planningTab: PlanningTab;
  setPlanningTab: (tab: PlanningTab) => void;
  lang: "en" | "pl";
  onMoreOpen: () => void;
}

interface NavTab {
  id: string;
  icon: React.ReactNode;
  labelPl: string;
  labelEn: string;
  action: () => void;
  active: boolean;
}

export function MobileNav({
  appMode,
  setAppMode,
  planningTab,
  setPlanningTab,
  lang,
  onMoreOpen,
}: MobileNavProps) {
  const goToTab = (tab: PlanningTab) => {
    setPlanningTab(tab);
    setAppMode("planowanie");
  };

  const tabs: NavTab[] = [
    {
      id: "home",
      icon: <Home className="w-5 h-5" />,
      labelPl: "Home",
      labelEn: "Home",
      action: () => setAppMode("home"),
      active: appMode === "home",
    },
    {
      id: "tasks",
      icon: <CheckSquare className="w-5 h-5" />,
      labelPl: "Zadania",
      labelEn: "Tasks",
      action: () => goToTab("tasks"),
      active: appMode === "planowanie" && planningTab === "tasks",
    },
    {
      id: "notes",
      icon: <FileText className="w-5 h-5" />,
      labelPl: "Notatki",
      labelEn: "Notes",
      action: () => goToTab("notes"),
      active: appMode === "planowanie" && planningTab === "notes",
    },
    {
      id: "calendar",
      icon: <Calendar className="w-5 h-5" />,
      labelPl: "Kalendarz",
      labelEn: "Calendar",
      action: () => goToTab("calendar"),
      active: appMode === "planowanie" && planningTab === "calendar",
    },
    {
      id: "more",
      icon: <MoreHorizontal className="w-5 h-5" />,
      labelPl: "Więcej",
      labelEn: "More",
      action: onMoreOpen,
      active: false,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden bg-[var(--bg2)] border-t border-[var(--border)] h-16 safe-area-inset-bottom">
      {tabs.map((tab) => {
        const label = lang === "pl" ? tab.labelPl : tab.labelEn;
        return (
          <button
            key={tab.id}
            aria-label={label}
            onClick={tab.action}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 transition-colors",
              tab.active ? "text-[var(--accent)]" : "text-[var(--text3)] hover:text-[var(--text2)]"
            )}
          >
            {tab.icon}
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
