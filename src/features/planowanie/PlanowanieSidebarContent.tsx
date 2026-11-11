import React from "react";
import {
  Home,
  Calendar,
  Briefcase,
  ListTodo,
  Tag,
  FileText,
  Link,
  Network,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/src/lib/cn";

export type PlanningTab =
  | "tasks"
  | "notes"
  | "activity"
  | "calendar"
  | "tags"
  | "resources"
  | "mindmaps"
  | "board";

export interface PlanowanieSidebarContentProps {
  planningTab: PlanningTab;
  setPlanningTab: (tab: PlanningTab) => void;
  activeMode: "home" | "planowanie";
  onGoHome: () => void;
  onSelectTab: (tab: PlanningTab) => void;
  modePlanowanie: string;
  tabHome: string;
  tabCalendar: string;
  tabActivity: string;
  tabTasks: string;
  tabTags: string;
  tabNotes: string;
  tabResources: string;
  tabMindMaps: string;
  tabBoard: string;
}

export function PlanowanieSidebarContent({
  planningTab,
  activeMode,
  onGoHome,
  onSelectTab,
  modePlanowanie,
  tabHome,
  tabCalendar,
  tabActivity,
  tabTasks,
  tabTags,
  tabNotes,
  tabResources,
  tabMindMaps,
  tabBoard,
}: PlanowanieSidebarContentProps) {
  const tabClass = (active: boolean) =>
    cn(
      "w-full flex items-center gap-3 p-3 rounded-xl transition-all border text-left",
      active
        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
        : "bg-[var(--surface)] border-transparent hover:bg-[var(--bg2)] hover:border-[var(--bg3)]"
    );

  const isTabActive = (tab: PlanningTab) => activeMode === "planowanie" && planningTab === tab;

  return (
    <div>
      <h2 className="text-xs font-semibold text-[var(--text3)] uppercase tracking-widest mb-3 px-2">
        {modePlanowanie}
      </h2>
      <div className="space-y-1">
        <button type="button" onClick={onGoHome} className={tabClass(activeMode === "home")}>
          <Home className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{tabHome}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("tasks")}
          className={tabClass(isTabActive("tasks"))}
        >
          <ListTodo className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{tabTasks}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("notes")}
          className={tabClass(isTabActive("notes"))}
        >
          <FileText className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{tabNotes}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("activity")}
          className={tabClass(isTabActive("activity"))}
        >
          <Briefcase className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{tabActivity}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("calendar")}
          className={tabClass(isTabActive("calendar"))}
        >
          <Calendar className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{tabCalendar}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("tags")}
          className={tabClass(isTabActive("tags"))}
        >
          <Tag className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{tabTags}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("resources")}
          className={tabClass(isTabActive("resources"))}
        >
          <Link className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{tabResources}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("mindmaps")}
          className={tabClass(isTabActive("mindmaps"))}
        >
          <Network className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{tabMindMaps}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("board")}
          className={tabClass(isTabActive("board"))}
        >
          <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{tabBoard}</span>
        </button>
      </div>
    </div>
  );
}
