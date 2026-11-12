"use client";

import Link from "next/link";
import { ThemeToggle } from "@/src/components/theme/ThemeToggle";
import Footer from "@/src/components/landing/Footer";
import { ArrowLeft } from "lucide-react";

export default function RegulaminPage() {
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
        <h1 className="text-3xl font-bold text-[var(--text)] mb-2">Regulamin</h1>
        <p className="text-sm text-[var(--text3)] mb-10">
          Monolith · Freelancer Edition · Ostatnia aktualizacja: luty 2025
        </p>

        <div className="prose prose-invert max-w-none space-y-8 text-[var(--footer-link)] text-sm leading-relaxed [&_strong]:text-[var(--text)] [&_a]:text-[var(--accent)] [&_a]:underline [&_a]:underline-offset-2">
          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">
              1. Postanowienia ogólne
            </h2>
            <p>
              Niniejszy regulamin określa zasady korzystania z usługi Monolith (Freelancer Edition)
              dostępnej w serwisie internetowym. Usługodawcą jest Mirosław Baczkowski. Kontakt:{" "}
              <a href="mailto:miro.job7224@gmail.com">miro.job7224@gmail.com</a>. Korzystanie z
              usługi oznacza akceptację regulaminu. Jeżeli nie akceptujesz któregoś z postanowień,
              nie korzystaj z usługi.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">2. Usługa i konto</h2>
            <p>
              Usługa umożliwia przechowywanie notatek, dokumentów i zadań oraz korzystanie z funkcji
              wspomaganych sztuczną inteligencją (np. chat po własnej bazie wiedzy). Dostęp do
              usługi wymaga rejestracji i utworzenia konta. Użytkownik zobowiązuje się podać
              prawdziwe dane oraz dbać o poufność hasła. Za działania pod swoim kontem odpowiada
              użytkownik.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">3. Zasady korzystania</h2>
            <p>
              Usługi należy używać zgodnie z prawem i niniejszym regulaminem. Zabronione jest m.in.:
              udostępnianie konta osobom trzecim w sposób sprzeczny z przeznaczeniem usługi,
              wprowadzanie treści nielegalnych lub naruszających prawa osób trzecich, próby
              obchodzenia zabezpieczeń lub nadmiernego obciążania infrastruktury. W przypadku
              naruszeń usługodawca może zawiesić lub usunąć konto.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">
              4. Treści użytkownika i własność
            </h2>
            <p>
              Użytkownik zachowuje prawa do treści, które dodaje do usługi. Udostępniając treści w
              aplikacji, użytkownik przyznaje usługodawcy licencję niezbędną do przechowywania,
              przetwarzania i wyświetlania tych treści w ramach świadczenia usługi (w tym
              wykorzystania przez funkcje AI). Serwis, jego interfejs, znaki towarowe i
              oprogramowanie pozostają własnością usługodawcy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">
              5. Odpowiedzialność i dostępność
            </h2>
            <p>
              Usługa jest świadczona „tak jak jest”. Usługodawca dokłada starań, aby serwis działał
              poprawnie, nie gwarantuje jednak nieprzerwanego działania ani braku błędów. W
              maksymalnym zakresie dozwolonym przez prawo usługodawca nie ponosi odpowiedzialności
              za utratę danych, przerwy w dostępie ani szkody wynikłe z korzystania lub niemożności
              korzystania z usługi. Odpowiedzialność ogranicza się do typowych, przewidywalnych
              szkód.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">
              6. Rezygnacja i rozwiązanie
            </h2>
            <p>
              Użytkownik może w dowolnym momencie zaprzestać korzystania z usługi i usunąć konto
              (jeśli aplikacja to umożliwia) lub skontaktować się z usługodawcą. Usługodawca może
              zawiesić lub zakończyć dostęp do konta w przypadku naruszenia regulaminu lub z ważnych
              przyczyn technicznych lub prawnych, z zachowaniem rozsądnego terminu uprzedzenia, o
              ile to możliwe.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">7. Zmiany regulaminu</h2>
            <p>
              Usługodawca może zmieniać regulamin. O istotnych zmianach użytkownicy zostaną
              poinformowani przez serwis lub e-mail. Dalsze korzystanie z usługi po wejściu w życie
              zmian oznacza akceptację zaktualizowanego regulaminu. W razie braku akceptacji należy
              zaprzestać korzystania z usługi.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">
              8. Postanowienia końcowe
            </h2>
            <p>
              Regulamin podlega prawu polskiemu. Spory rozstrzyga sąd właściwy dla siedziby
              usługodawcy. W sprawach danych osobowych stosuje się{" "}
              <Link href="/politika-prywatnosci">Politykę prywatności</Link>. Kontakt we wszystkich
              sprawach: <a href="mailto:miro.job7224@gmail.com">miro.job7224@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
