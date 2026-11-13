// Czyste funkcje formatowania czasu dla Kokpitu (bez zależności od React).

const pad = (n: number) => String(n).padStart(2, "0");

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

/** Ile minut do startu; ujemne, gdy już minął. */
export function minutesUntil(nowMinutes: number, startMinutes: number): number {
  return startMinutes - nowMinutes;
}

/** „dziś” / „wczoraj” / „N dni temu”; `null` dla braku lub błędnej daty. Przyszłość liczy się jak „dziś”. */
export function relativeDays(fromIso: string | null, today: Date): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromIso ?? "");
  if (!m) return null;
  const from = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.max(0, Math.round((now - from) / (24 * 3600 * 1000)));
  if (days === 0) return "dziś";
  if (days === 1) return "wczoraj";
  return `${days} dni temu`;
}

/** „Środa, 11 listopada”. */
export function formatLongDate(date: Date): string {
  const text = date.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** „brak spotkań dziś” / „1 spotkanie dziś” / „3 spotkania dziś” / „5 spotkań dziś”. */
export function meetingsLabel(count: number): string {
  if (count === 0) return "brak spotkań dziś";
  if (count === 1) return "1 spotkanie dziś";
  const last = count % 10;
  const lastTwo = count % 100;
  const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return `${count} ${few ? "spotkania" : "spotkań"} dziś`;
}

/** Zakres osi czasu w pełnych godzinach: minimum 08–18, rozszerzany o wydarzenia. */
export function timelineRange(events: { startMinutes: number; durationMinutes: number }[]): {
  from: number;
  to: number;
} {
  let from = 8;
  let to = 18;
  for (const e of events) {
    from = Math.min(from, Math.floor(e.startMinutes / 60));
    to = Math.max(to, Math.ceil((e.startMinutes + e.durationMinutes) / 60));
  }
  return { from, to: Math.min(to, 24) };
}
