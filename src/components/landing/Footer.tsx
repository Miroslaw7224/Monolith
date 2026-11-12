"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-12 sm:px-8 lg:px-12 xl:px-16">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
        <p className="text-sm text-[var(--text2)]">Monolith · Freelancer Edition</p>
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <Link href="/regulamin" className="text-[var(--footer-link)] hover:text-[var(--text)]">
            Regulamin
          </Link>
          <Link
            href="/politika-prywatnosci"
            className="text-[var(--footer-link)] hover:text-[var(--text)]"
          >
            Polityka prywatności
          </Link>
          <Link href="/cookies" className="text-[var(--footer-link)] hover:text-[var(--text)]">
            Cookies
          </Link>
          <Link
            href="mailto:miro.job7224@gmail.com"
            className="text-[var(--footer-link)] hover:text-[var(--text)]"
          >
            Kontakt
          </Link>
        </nav>
      </div>
    </footer>
  );
}
