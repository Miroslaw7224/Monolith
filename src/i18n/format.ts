import { currentLang, type Lang } from "./index";

const LOCALE: Record<Lang, string> = { pl: "pl-PL", en: "en-US" };

/** „poniedziałek, 16 listopada” / „Monday, November 16”. */
export function formatDate(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
