// Czyste funkcje formatowania czasu dla Kokpitu (bez zależności od React).

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

/** Etykieta zaczepu: „Zaczep z wczoraj” / „Zaczep sprzed 3 dni”; dla dziś i błędnej daty: „Zaczep”. */
export function anchorLabel(dateIso: string, today: Date): string {
  const rel = relativeDays(dateIso, today);
  if (rel === "wczoraj") return "Zaczep z wczoraj";
  const m = /^(\d+) dni temu$/.exec(rel ?? "");
  return m ? `Zaczep sprzed ${m[1]} dni` : "Zaczep";
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

/** „0 commitów” / „1 commit” / „2 commity” / „5 commitów”. */
export function commitsLabel(count: number): string {
  if (count === 1) return "1 commit";
  const last = count % 10;
  const lastTwo = count % 100;
  const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return `${count} ${few ? "commity" : "commitów"}`;
}

/** „jutro” albo „Środa, 18 listopada” (dzień spotkania względem `todayIso`). */
export function meetingDayLabel(dateIso: string, todayIso: string): string {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const days = Math.round((parse(dateIso).getTime() - parse(todayIso).getTime()) / 86_400_000);
  return days === 1 ? "jutro" : formatLongDate(parse(dateIso));
}

/** Meta kafla „Commity dziś”: „jeszcze bez commitów” / „1 projekt” / „2 projekty” / „5 projektów”. */
export function projectsLabel(count: number): string {
  if (count === 0) return "jeszcze bez commitów";
  if (count === 1) return "1 projekt";
  const last = count % 10;
  const lastTwo = count % 100;
  const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return `${count} ${few ? "projekty" : "projektów"}`;
}

/** „1 okno Deep Work” / „2 okna Deep Work” / „5 okien Deep Work”; 0 → pusty tekst. */
export function windowsLabel(count: number): string {
  if (count === 0) return "";
  if (count === 1) return "1 okno Deep Work";
  const last = count % 10;
  const lastTwo = count % 100;
  const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return `${count} ${few ? "okna" : "okien"} Deep Work`;
}

/** Propozycje okien, które jeszcze się nie skończyły (serwer liczył je w chwili wczytania Kokpitu). */
export function upcomingWindows<T extends { endMinutes: number }>(
  windows: T[],
  nowMinutes: number
): T[] {
  return windows.filter((w) => w.endMinutes > nowMinutes);
}
