"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LANG, isLang, setLanguage, type Lang } from "./index";

export function useLang() {
  const { i18n } = useTranslation();
  const lang: Lang = isLang(i18n.language) ? i18n.language : DEFAULT_LANG;
  const setLang = useCallback((next: Lang) => {
    void setLanguage(next);
  }, []);
  const toggleLang = useCallback(() => {
    void setLanguage(lang === "pl" ? "en" : "pl");
  }, [lang]);
  return { lang, setLang, toggleLang };
}
