"use client";
import React from "react";
import { Home, CheckSquare, FileText, Calendar, MoreHorizontal } from "lucide-react";
import { cn } from "@/src/lib/cn";
import { useT } from "@/src/i18n/useT";
import type { PlanningTab } from "@/src/features/planowanie/planningTab";

type AppMode = "home" | "planowanie";

interface MobileNavProps {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  planningTab: PlanningTab;
  setPlanningTab: (tab: PlanningTab) => void;
  onMoreOpen: () => void;
}

type NavTabId = "home" | "tasks" | "notes" | "calendar" | "more";

interface NavTab {
  id: NavTabId;
  icon: React.ReactNode;
  action: () => void;
  active: boolean;
}

export function MobileNav({
  appMode,
  setAppMode,
  planningTab,
  setPlanningTab,
  onMoreOpen,
}: MobileNavProps) {
  const t = useT();
  const goToTab = (tab: PlanningTab) => {
    setPlanningTab(tab);
    setAppMode("planowanie");
  };

  const tabs: NavTab[] = [
    {
      id: "home",
      icon: <Home className="w-5 h-5" />,
      action: () => setAppMode("home"),
      active: appMode === "home",
    },
    {
      id: "tasks",
      icon: <CheckSquare className="w-5 h-5" />,
      action: () => goToTab("tasks"),
      active: appMode === "planowanie" && planningTab === "tasks",
    },
    {
      id: "notes",
      icon: <FileText className="w-5 h-5" />,
      action: () => goToTab("notes"),
      active: appMode === "planowanie" && planningTab === "notes",
    },
    {
      id: "calendar",
      icon: <Calendar className="w-5 h-5" />,
      action: () => goToTab("calendar"),
      active: appMode === "planowanie" && planningTab === "calendar",
    },
    {
      id: "more",
      icon: <MoreHorizontal className="w-5 h-5" />,
      action: onMoreOpen,
      active: false,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden bg-[var(--bg2)] border-t border-[var(--border)] h-16 safe-area-inset-bottom">
      {tabs.map((tab) => {
        const label = t(`shell:mobileNav.${tab.id}`);
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
