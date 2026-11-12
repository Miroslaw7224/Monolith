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
  proPlan: string;
  docsLimit: string;
}

export interface AppSidebarProps {
  isSidebarOpen: boolean;
  lang: "en" | "pl";
  setLang: (lang: "en" | "pl") => void;
  documentsCount: number;
  t: AppSidebarTranslations;
  children: React.ReactNode;
}

export function AppSidebar({
  isSidebarOpen,
  lang,
  setLang,
  documentsCount,
  t,
  children,
}: AppSidebarProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
      className="bg-[var(--bg2)] border-r border-[var(--border)] hidden md:flex flex-col overflow-hidden"
    >
      <div className="p-6 flex items-center gap-3 border-b border-[var(--border)]">
        <MonolithLogo size={40} className="shrink-0" />
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

      <div className="p-4 border-t border-[var(--border)] space-y-4">
        <div className="bg-[var(--bg3)] p-4 rounded-2xl">
          <p className="text-xs font-bold text-[var(--text2)] mb-1">{t.proPlan}</p>
          <p className="text-xs text-[var(--text2)] mb-3">{t.docsLimit}</p>
          <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[var(--accent)] h-full transition-all duration-500"
              style={{ width: `${(documentsCount / 50) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
