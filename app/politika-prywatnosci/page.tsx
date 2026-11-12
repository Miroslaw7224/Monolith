"use client";

import Link from "next/link";
import { ThemeToggle } from "@/src/components/theme/ThemeToggle";
import Footer from "@/src/components/landing/Footer";
import { ArrowLeft } from "lucide-react";

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8 lg:px-12 xl:px-16">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-[var(--footer-link)] hover:text-[var(--text)] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Strona główna
          </Link>
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
      <main className="mx-auto max-w-3xl px-6 py-12 sm:px-8 lg:px-12 flex-1">
        <h1 className="text-3xl font-bold text-[var(--text)] mb-2">Polityka prywatności</h1>
        <p className="text-sm text-[var(--text3)] mb-10">Ostatnia aktualizacja: luty 2025</p>

        <div className="prose prose-invert max-w-none space-y-8 text-[var(--footer-link)] text-sm leading-relaxed [&_strong]:text-[var(--text)] [&_a]:text-[var(--accent)] [&_a]:underline [&_a]:underline-offset-2">
          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">
              1. Administrator danych
            </h2>
            <p>
              Administratorem Twoich danych osobowych w ramach usługi Monolith (Freelancer Edition)
              jest Mirosław Baczkowski. Kontakt w sprawie danych osobowych:{" "}
              <a href="mailto:miro.job7224@gmail.com">miro.job7224@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">
              2. Jakie dane zbieramy
            </h2>
            <p>
              Zbieramy dane niezbędne do rejestracji i logowania (m.in. adres e-mail, imię lub nazwa
              wyświetlana), a także dane przekazywane przez Ciebie w treści notatek, dokumentów i
              zadań w aplikacji. Korzystamy z usługi uwierzytelniania (np. Firebase / Google), więc
              w zakresie logowania mogą mieć zastosowanie ich polityki prywatności.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">
              3. Cel i podstawa przetwarzania
            </h2>
            <p>
              Dane przetwarzamy w celu świadczenia usługi (w tym udostępnienia konta, przechowywania
              treści i funkcji AI), na podstawie umowy (art. 6 ust. 1 lit. b RODO) oraz w
              uzasadnionym interesie administratora (art. 6 ust. 1 lit. f RODO) w zakresie
              bezpieczeństwa, obsługi technicznej i dochodzenia ewentualnych roszczeń.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">
              4. Przechowywanie i bezpieczeństwo
            </h2>
            <p>
              Dane przechowujemy przez czas trwania konta oraz po jego usunięciu w zakresie
              wymaganym przepisami (np. rozliczenia, roszczenia). Stosujemy środki techniczne i
              organizacyjne mające na celu ograniczenie ryzyka nieuprawnionego dostępu, utraty lub
              zmiany danych.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">5. Twoje prawa</h2>
            <p>
              Przysługuje Ci prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia
              przetwarzania, przenoszenia danych oraz wniesienia skargi do organu nadzorczego
              (Prezes Urzędu Ochrony Danych Osobowych). Możesz też wycofać zgodę, jeśli była
              podstawą przetwarzania — bez wpływu na zgodność z prawem przetwarzania dokonanego
              przed jej wycofaniem.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">6. Zmiany polityki</h2>
            <p>
              Politykę prywatności możemy aktualizować. O istotnych zmianach poinformujemy na
              stronie lub e-mailem. Dalsze korzystanie z usługi po wejściu w życie zmian oznacza
              akceptację zaktualizowanej polityki.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
