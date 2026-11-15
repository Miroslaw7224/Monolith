"use client";
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, Briefcase, Tag, Map, LayoutDashboard, Sparkles, GraduationCap } from "lucide-react";
import type { PlanningTab } from "@/src/features/planowanie/planningTab";
import { useT } from "@/src/i18n/useT";

type DrawerTab = "activity" | "tags" | "resources" | "skills" | "courses" | "mindmaps" | "board";

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: PlanningTab) => void;
  /** Ustawienia dawnego górnego paska; na telefonie nie ma palety Ctrl+K. */
  onToggleLang?: () => void;
  onToggleTheme?: () => void;
  onFeedback?: () => void;
}

export function MobileMoreDrawer({
  isOpen,
  onClose,
  onSelectTab,
  onToggleLang,
  onToggleTheme,
  onFeedback,
}: MobileMoreDrawerProps) {
  const t = useT();
  const settings = [
    { id: "lang", label: t("common:lang.nextCode"), run: onToggleLang },
    { id: "theme", label: t("common:theme"), run: onToggleTheme },
    { id: "feedback", label: t("common:feedback"), run: onFeedback },
  ].filter((s) => s.run);
  const items: Array<{ id: DrawerTab; icon: React.ReactNode }> = [
    { id: "activity", icon: <Briefcase className="w-5 h-5" /> },
    { id: "tags", icon: <Tag className="w-5 h-5" /> },
    { id: "resources", icon: <Link className="w-5 h-5" /> },
    { id: "skills", icon: <Sparkles className="w-5 h-5" /> },
    { id: "courses", icon: <GraduationCap className="w-5 h-5" /> },
    { id: "mindmaps", icon: <Map className="w-5 h-5" /> },
    { id: "board", icon: <LayoutDashboard className="w-5 h-5" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            data-testid="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg2)] border-t border-[var(--border)] rounded-t-2xl pb-8 md:hidden"
          >
            <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 space-y-1">
              {items.map((item) => {
                const label = t(`shell:drawer.${item.id}`);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-[var(--bg3)] text-[var(--text)] transition-colors"
                  >
                    {item.icon}
                    <span className="text-sm font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
            {settings.length > 0 && (
              <div className="px-4 pt-3 mt-3 border-t border-[var(--border)] flex gap-2">
                {settings.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={s.run}
                    className="flex-1 p-3 rounded-xl bg-[var(--bg3)] text-[var(--text)] text-sm font-semibold"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
