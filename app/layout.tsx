import type { Metadata } from "next";
import "./globals.css";
import "@/src/features/cards/cards.css";
import { ThemeScript } from "@/src/components/theme/ThemeScript";
import { ThemeProvider } from "@/src/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "Monolith · Freelancer Edition",
  description:
    "Jedno miejsce na dokumenty i notatki. Chat z AI po swojej bazie wiedzy — odpowiedzi w sekundach, ze wskazaniem źródła. Dla freelancerów.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <meta
          key="coop"
          httpEquiv="Cross-Origin-Opener-Policy"
          content="same-origin-allow-popups"
        />
      </head>
      <body>
        <ThemeScript />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
