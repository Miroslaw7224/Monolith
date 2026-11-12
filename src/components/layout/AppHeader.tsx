/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ChevronRight, Search, History, MessageCircle, X } from "lucide-react";
import { cn } from "@/src/lib/cn";
import { ThemeToggle } from "@/src/components/theme/ThemeToggle";

export interface AppHeaderTranslations {
  brainActive: string;
  searchPlaceholder: string;
  feedback: string;
}

export interface AppHeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  t: AppHeaderTranslations;
}

export function AppHeader({ isSidebarOpen, setIsSidebarOpen, t }: AppHeaderProps) {
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  return (
    <>
      <header className="h-16 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-[var(--bg3)] rounded-lg transition-colors text-[var(--text)]"
          >
            <ChevronRight
              className={cn("w-5 h-5 transition-transform", isSidebarOpen && "rotate-180")}
            />
          </button>
          <div className="hidden md:flex items-center gap-2 ml-2">
            <div className="w-2 h-2 bg-[var(--green)] rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-[var(--text)]">{t.brainActive}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              className="pl-10 pr-4 py-2 bg-[var(--bg3)] border-none rounded-full text-sm w-64 text-[var(--text)] placeholder-[var(--text3)] focus:ring-2 focus:ring-[var(--accent)] transition-all"
            />
          </div>
          <ThemeToggle />
          <button
            onClick={() => setFeedbackOpen(true)}
            className="hidden md:flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg3)] rounded-full transition-colors text-[var(--text2)] hover:text-[var(--text)] text-sm font-medium"
            title={t.feedback}
          >
            <MessageCircle className="w-5 h-5" />
            <span>{t.feedback}</span>
          </button>
          <button className="p-2 hover:bg-[var(--bg3)] rounded-full transition-colors text-[var(--text2)]">
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      {feedbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setFeedbackOpen(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="font-semibold text-[var(--text)]">{t.feedback}</span>
              <button
                onClick={() => setFeedbackOpen(false)}
                className="p-2 hover:bg-[var(--bg3)] rounded-lg transition-colors text-[var(--text2)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                src="https://tally.so/embed/81dpVO"
                title="Feedback – Monolith BETA"
                className="w-full h-[70vh] min-h-[400px] border-0"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
