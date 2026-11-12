"use client";

import React from "react";
import { X, Check, Upload, Cpu, MessageCircle, FileCheck } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Wrzucasz notatki i dokumenty",
    text: "Albo wklejasz fragmenty — w jednym miejscu.",
  },
  {
    icon: Cpu,
    title: "Monolith indeksuje i łączy z AI",
    text: "Twoja baza jest gotowa do pytań.",
  },
  {
    icon: MessageCircle,
    title: "Zadajesz pytania po polsku",
    text: "AI odpowiada tylko na podstawie Twoich danych.",
  },
  {
    icon: FileCheck,
    title: "Źródło przy każdej odpowiedzi",
    text: "Dokument lub notatka — zawsze wskazane.",
  },
];

export default function BeforeAfterHowItWorksRow() {
  return (
    <section
      className="px-6 pt-6 pb-24 sm:px-8 lg:px-12 xl:px-16 lg:pt-8 lg:pb-24 bg-[var(--bg)]"
      id="przed-po-jak-dziala"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-0 items-stretch lg:grid-cols-2">
          <div className="pt-0 pb-12 px-0 sm:px-0 lg:pb-16 lg:pr-6 lg:pl-0">
            <div className="max-w-none">
              <h2 className="text-center text-3xl font-bold text-[var(--text)] sm:text-4xl">
                Przed vs Po
              </h2>
              <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-red-200 bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
                  <div className="flex items-center gap-2 text-red-500 font-semibold">
                    <X className="h-5 w-5" />
                    Przed
                  </div>
                  <p className="mt-4 text-[var(--text2)]">
                    Przekopywanie maili i notatek przez 30 minut — żeby znaleźć jedną ustalenie.
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--green)]/30 bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
                  <div className="flex items-center gap-2 text-[var(--green)] font-semibold">
                    <Check className="h-5 w-5" />
                    Po
                  </div>
                  <p className="mt-4 text-[var(--text2)]">
                    Jedno pytanie w chacie → konkretna odpowiedź w 3 sekundy, z linkiem do źródła.
                  </p>
                </div>
              </div>
              <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-left">
                <p className="text-sm font-medium text-[var(--text2)]">Mini-scenariusz</p>
                <p className="mt-2 text-[var(--text)]">
                  <strong>Pytanie:</strong> Co ustaliliśmy z klientem X? →
                  <strong className="ml-1"> Odpowiedź:</strong> W marcu ustaliliście termin 15.04,
                  budżet 8000 zł. [Źródło: notatka z 12.03]
                </p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--bg)] pt-8 pb-12 px-0 sm:px-0 lg:pt-0 lg:pb-16 lg:pl-6 lg:pr-0 flex flex-col">
            <div className="max-w-none">
              <h2 className="text-center text-3xl font-bold text-[var(--text)] sm:text-4xl">
                Jak to działa
              </h2>
              <p className="mt-4 text-center text-lg text-[var(--text2)]">
                Czym jest Monolith w 4 krokach
              </p>
              <ul className="mt-14 space-y-8">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-6">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-[var(--accent)]">
                      <step.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--text)]">{step.title}</h3>
                      <p className="mt-1 text-[var(--text2)]">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-12 text-center text-[var(--text2)] font-medium">
                Twoja wiedza. Twoje dane. Odpowiedzi w kilka sekund.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
