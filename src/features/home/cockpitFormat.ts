// Czyste funkcje formatowania czasu dla Kokpitu (bez zależności od React).

import i18n from "@/src/i18n";
import { formatDate } from "@/src/i18n/format";

const pad = (n: number) => String(n).padStart(2, "0");

/** Dzień lokalny `RRRR-MM-DD`. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Minuty od północy → `HH:mm`. */
export function hhmm(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Numer tygodnia ISO 8601 (tydzień zaczyna się w poniedziałek; należy do roku swojego czwartku). */
export function weekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

/** Linie briefu jako punkty: bez pustych linii i bez wiodącego znacznika listy (`-`, `*`, `•`). */
export function briefLines(brief: string | null): string[] {
  return (brief ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s+/, "").trim())
    .filter((line) => line !== "");
}

/** Ile minut do startu; ujemne, gdy już minął. */
export function minutesUntil(nowMinutes: number, startMinutes: number): number {
  return startMinutes - nowMinutes;
}

/** Odliczanie czytelne dla człowieka: „42 min”, „1 h”, „8 h 35 min”; wartości ujemne dają „0 min”. */
export function minutesToHm(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Pełne dni od `fromIso` do dziś; `null` dla braku lub błędnej daty. Przyszłość liczy się jak 0. */
function daysAgo(fromIso: string | null, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromIso ?? "");
  if (!m) return null;
  const from = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((now - from) / (24 * 3600 * 1000)));
}

/** „dziś” / „wczoraj” / „N dni temu”; `null` dla braku lub błędnej daty. */
export function relativeDays(fromIso: string | null, today: Date): string | null {
  const days = daysAgo(fromIso, today);
  if (days === null) return null;
  if (days === 0) return i18n.t("home:format.today");
  if (days === 1) return i18n.t("home:format.yesterday");
  return i18n.t("home:format.daysAgo", { count: days });
}

/** „Zaczep z wczoraj” / „Zaczep sprzed 3 dni”; dla dziś i błędnej daty: „Zaczep”. */
export function anchorLabel(dateIso: string, today: Date): string {
  const days = daysAgo(dateIso, today);
  if (days === 1) return i18n.t("home:format.anchorYesterday");
  if (days !== null && days >= 2) return i18n.t("home:format.anchorDaysAgo", { count: days });
  return i18n.t("home:format.anchor");
}

/** „Środa, 11 listopada” / „Wednesday, November 11”. */
export function formatLongDate(date: Date): string {
  const text = formatDate(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function meetingsLabel(count: number): string {
  return count === 0
    ? i18n.t("home:format.meetingsNone")
    : i18n.t("home:format.meetings", { count });
}

export function commitsLabel(count: number): string {
  return i18n.t("home:format.commits", { count });
}

/** „jutro” albo pełna data spotkania względem `todayIso`. */
export function meetingDayLabel(dateIso: string, todayIso: string): string {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const days = Math.round((parse(dateIso).getTime() - parse(todayIso).getTime()) / 86_400_000);
  return days === 1 ? i18n.t("home:format.tomorrow") : formatLongDate(parse(dateIso));
}

/** Meta kafla „Commity dziś”. */
export function projectsLabel(count: number): string {
  return count === 0
    ? i18n.t("home:format.projectsNone")
    : i18n.t("home:format.projects", { count });
}

/** „N okien Deep Work”; 0 → pusty tekst. */
export function windowsLabel(count: number): string {
  return count === 0 ? "" : i18n.t("home:format.windows", { count });
}

/** Propozycje okien, które jeszcze się nie skończyły (serwer liczył je w chwili wczytania Kokpitu). */
export function upcomingWindows<T extends { endMinutes: number }>(
  windows: T[],
  nowMinutes: number
): T[] {
  return windows.filter((w) => w.endMinutes > nowMinutes);
}
