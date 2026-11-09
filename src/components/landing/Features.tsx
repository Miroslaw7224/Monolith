"use client";

import { Calendar, CheckSquare, FileText, Network } from "lucide-react";

export default function Features() {
  return (
    <section
      className="bg-[var(--bg)] px-6 pt-0 pb-24 sm:px-8 lg:px-12 xl:px-16 lg:pt-2 lg:pb-24"
      id="funkcje"
    >
      <div className="mx-auto max-w-7xl">
        <h2 className="text-center text-3xl font-bold text-[var(--text)] sm:text-4xl">
          Wszystko w Planowaniu
        </h2>
        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-[var(--accent)]">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text)]">Planowanie</h3>
            </div>
            <ul className="mt-6 space-y-3 text-[var(--text2)]">
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)]">•</span>
                Kalendarz, moja praca, zadania i tagi
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)]">•</span>
                Plan AI — pomoc w planowaniu dnia i tygodnia
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)]">•</span>
                Home z podsumowaniem dnia
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-[var(--accent)]">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text)]">Notatki i zasoby</h3>
            </div>
            <ul className="mt-6 space-y-3 text-[var(--text2)]">
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)]">•</span>
                <span className="inline-flex items-center gap-1">
                  <CheckSquare className="h-4 w-4" /> Notatki i dokumenty w jednym miejscu
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)]">•</span>
                Zasoby i linki z tagami
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)]">•</span>
                <span className="inline-flex items-center gap-1">
                  <Network className="h-4 w-4" /> Mapy myśli
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
