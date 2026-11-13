"use client";

import React from "react";
import { X } from "lucide-react";

export function FeedbackModal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="font-semibold text-[var(--text)]">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
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
  );
}
