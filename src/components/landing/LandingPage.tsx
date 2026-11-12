"use client";

import React from "react";
import Link from "next/link";
import Hero from "./Hero";
import HeroProblemRow from "./HeroProblemRow";
import BeforeAfterHowItWorksRow from "./BeforeAfterHowItWorksRow";
import Features from "./Features";
import ForWho from "./ForWho";
import Pricing from "./Pricing";
import CTA from "./CTA";
import FAQ from "./FAQ";
import Footer from "./Footer";
import { ThemeToggle } from "@/src/components/theme/ThemeToggle";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8 lg:px-12 xl:px-16">
          <span className="text-lg font-semibold text-[var(--text)]">Monolith</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/auth/login"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
            >
              Zaloguj się
            </Link>
          </div>
        </div>
      </header>
      <main>
        <Hero />
        <HeroProblemRow />
        <BeforeAfterHowItWorksRow />
        <Features />
        <ForWho />
        <Pricing />
        <CTA />
        <FAQ />
        <Footer />
      </main>
    </div>
  );
}
