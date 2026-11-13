/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { MonolithLogo } from "@/src/components/brand/MonolithLogo";
import { motion } from "motion/react";

export interface AppSidebarTranslations {
  title: string;
  subtitle: string;
}

export interface AppSidebarProps {
  isSidebarOpen: boolean;
  lang: "en" | "pl";
  setLang: (lang: "en" | "pl") => void;
  t: AppSidebarTranslations;
  children: React.ReactNode;
}

export function AppSidebar({ isSidebarOpen, lang, setLang, t, children }: AppSidebarProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
      className="bg-[var(--bg2)] border-r border-[var(--border)] hidden md:flex flex-col overflow-hidden"
    >
      <div className="p-6 flex items-center gap-3 border-b border-[var(--border)]">
        <MonolithLogo size={52} className="shrink-0 -ml-1" />
        <div className="flex-1">
          <h1 className="font-bold text-lg tracking-tight text-[var(--text)]">{t.title}</h1>
          <p className="text-xs text-[var(--text2)] font-medium uppercase tracking-wider">
            {t.subtitle}
          </p>
        </div>
        <button
          onClick={() => setLang(lang === "en" ? "pl" : "en")}
          className="px-2 py-1 bg-[var(--toggle-bg)] rounded text-[10px] font-bold hover:bg-[var(--bg3)] transition-colors text-[var(--text2)]"
        >
          {lang === "en" ? "PL" : "EN"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">{children}</div>
    </motion.aside>
  );
}
