"use client";

import React, { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { applyStoredLanguage } from "./index";

/**
 * Renderuje `children` dopiero po zastosowaniu zapisanego języka, żeby użytkownik EN
 * nie widział mignięcia PL po F5 (HTML z serwera jest pusty; aplikacja jest klientowa).
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void applyStoredLanguage().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{ready ? children : null}</I18nextProvider>;
}
