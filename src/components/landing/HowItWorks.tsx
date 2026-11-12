"use client";

import { Upload, Cpu, MessageCircle, FileCheck } from "lucide-react";

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

export default function HowItWorks() {
  return (
    <section className="bg-white px-6 py-20 sm:px-8 lg:px-12 xl:px-16" id="jak-dziala">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-center text-3xl font-bold text-slate-900 sm:text-4xl">Jak to działa</h2>
        <p className="mt-4 text-center text-lg text-slate-600">Czym jest Monolith w 4 krokach</p>
        <ul className="mt-14 space-y-8">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <step.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-slate-600">{step.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-center text-slate-600 font-medium">
          Twoja wiedza. Twoje dane. Odpowiedzi w kilka sekund.
        </p>
      </div>
    </section>
  );
}
