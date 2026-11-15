import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

export type Lang = "pl" | "en";
export const DEFAULT_LANG: Lang = "pl";
export const LANG_KEY = "monolith.lang";

export function isLang(value: unknown): value is Lang {
  return value === "pl" || value === "en";
}

/** Zapisany wybór; nieznana wartość, brak `window` albo wyjątek odczytu → `pl`. */
export function readStoredLanguage(): Lang {
  try {
    const value = window.localStorage.getItem(LANG_KEY);
    return isLang(value) ? value : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function currentLang(): Lang {
  return isLang(i18n.language) ? i18n.language : DEFAULT_LANG;
}

/** Zmienia język, zapisuje wybór (błąd zapisu jest ignorowany) i ustawia `<html lang>`. */
export async function setLanguage(lang: Lang): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // preferencja nie jest krytyczna: język działa do końca sesji
  }
  document.documentElement.lang = lang;
}

/** Stosuje zapisany wybór bez ponownego zapisu (start aplikacji). */
export async function applyStoredLanguage(): Promise<void> {
  const lang = readStoredLanguage();
  await i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANG,
    fallbackLng: DEFAULT_LANG,
    defaultNS: "common",
    ns: ["common", "shell"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initAsync: false,
  });
}

export default i18n;
