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

/** „16 listopada” / „November 16”. */
export function formatDayMonth(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "long" }).format(date);
}

/** Skrót dnia tygodnia: „pon.” / „Mon”. */
export function formatWeekdayShort(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: "short" }).format(date);
}

/** Pełna nazwa dnia: „poniedziałek” / „Monday”. */
export function formatWeekdayLong(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: "long" }).format(date);
}

/** Nazwa miesiąca z wielką literą w PL: „Listopad” / „November”. */
export function formatMonthLong(date: Date, lang: Lang = currentLang()): string {
  const raw = new Intl.DateTimeFormat(LOCALE[lang], { month: "long" }).format(date);
  return lang === "pl" ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
}

/** Dopełniacz miesiąca w skróconym zakresie tygodnia („listopada” / „November”). */
export function formatMonthGenitive(date: Date, lang: Lang = currentLang()): string {
  const parts = new Intl.DateTimeFormat(LOCALE[lang], {
    month: "long",
    day: "numeric",
  }).formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return lang === "pl" ? month.toLowerCase() : month;
}

/** Godzina i minuty: „09:05” / „09:05 AM”. */
export function formatTime(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Godzina z sekundami: „09:05:30” / „09:05:30 AM”. */
export function formatTimeSeconds(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/** Data numeryczna: „15.11.2026” / „11/15/2026”. */
export function formatShortDate(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang]).format(date);
}

/** Pełna data z rokiem: „niedziela, 15 listopada 2026” / „Sunday, November 15, 2026”. */
export function formatFullDate(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Data i godzina krótko: „15.11.2026, 09:05” / „11/15/26, 9:05 AM”. */
export function formatShortDateTime(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: "short", timeStyle: "short" }).format(
    date
  );
}

/** Pełna data i godzina z sekundami (stan pliku Kodeksu). */
export function formatFullDateTime(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: "full", timeStyle: "medium" }).format(
    date
  );
}
