"use client";
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, Briefcase, Tag, Map, LayoutDashboard } from "lucide-react";
import type { PlanningTab } from "@/src/features/planowanie/planningTab";

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lang: "en" | "pl";
  onSelectTab: (tab: PlanningTab) => void;
}

export function MobileMoreDrawer({ isOpen, onClose, lang, onSelectTab }: MobileMoreDrawerProps) {
  const items: Array<{
    id: PlanningTab;
    icon: React.ReactNode;
    labelPl: string;
    labelEn: string;
  }> = [
    {
      id: "activity",
      icon: <Briefcase className="w-5 h-5" />,
      labelPl: "Moja praca",
      labelEn: "My Work",
    },
    {
      id: "tags",
      icon: <Tag className="w-5 h-5" />,
      labelPl: "Tagi",
      labelEn: "Tags",
    },
    {
      id: "resources",
      icon: <Link className="w-5 h-5" />,
      labelPl: "Zasoby",
      labelEn: "Resources",
    },
    {
      id: "mindmaps",
      icon: <Map className="w-5 h-5" />,
      labelPl: "Mapy myśli",
      labelEn: "Mind Maps",
    },
    {
      id: "board",
      icon: <LayoutDashboard className="w-5 h-5" />,
      labelPl: "Tablica",
      labelEn: "Board",
    },
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
                const label = lang === "pl" ? item.labelPl : item.labelEn;
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
