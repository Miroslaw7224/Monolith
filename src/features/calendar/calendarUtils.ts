import type { CalendarEventDto } from "@/contexts/bc_calendar/schemas";

export type CalendarEvent = CalendarEventDto;

/** Row in the day grid (one event may produce several segments across midnights). */
export interface CalendarEventSegment {
  segmentKey: string;
  segmentDate: string;
  start_minutes: number;
  duration_minutes: number;
  source: CalendarEvent;
}

export interface IntervalForLanes {
  id: string;
  start_minutes: number;
  duration_minutes: number;
}

const MAX_STACK = 3;
const MINS_PER_DAY = 24 * 60;

export function addCalendarDays(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Splits one stored event into per-day intervals, each fitting in 0..1440 minutes. */
export function expandEventToSegments(ev: CalendarEvent): CalendarEventSegment[] {
  if (ev.duration_minutes <= 0) return [];
  let remaining = ev.duration_minutes;
  let currentDate = ev.date;
  let segmentStart = ev.start_minutes;
  while (segmentStart >= MINS_PER_DAY) {
    currentDate = addCalendarDays(currentDate, 1);
    segmentStart -= MINS_PER_DAY;
  }
  const segments: CalendarEventSegment[] = [];
  let idx = 0;
  while (remaining > 0) {
    const spaceInDay = MINS_PER_DAY - segmentStart;
    const segmentDuration = Math.min(remaining, spaceInDay);
    segments.push({
      segmentKey: `${ev.id}#${currentDate}#${idx}`,
      segmentDate: currentDate,
      start_minutes: segmentStart,
      duration_minutes: segmentDuration,
      source: ev,
    });
    remaining -= segmentDuration;
    idx++;
    if (remaining > 0) {
      currentDate = addCalendarDays(currentDate, 1);
      segmentStart = 0;
    }
  }
  return segments;
}

export function getDaysInMonth(
  year: number,
  month: number
): { date: string; dayOfWeek: number; day: number }[] {
  const last = new Date(year, month + 1, 0);
  const days: { date: string; dayOfWeek: number; day: number }[] = [];
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      dayOfWeek: date.getDay(),
      day: d,
    });
  }
  return days;
}

export function assignLanes(events: IntervalForLanes[]): Map<string, number> {
  const lanes = new Map<string, number>();
  const sorted = [...events].sort((a, b) => a.start_minutes - b.start_minutes);
  for (const ev of sorted) {
    const end = ev.start_minutes + ev.duration_minutes;
    const used = new Set<number>();
    for (const other of sorted) {
      if (other.id === ev.id) continue;
      const oEnd = other.start_minutes + other.duration_minutes;
      if (ev.start_minutes < oEnd && other.start_minutes < end) {
        const L = lanes.get(other.id);
        if (L != null) used.add(L);
      }
    }
    let lane = 0;
    while (used.has(lane) && lane < MAX_STACK) lane++;
    lanes.set(ev.id, Math.min(lane, MAX_STACK - 1));
  }
  return lanes;
}

/** For each interval, number of intervals that overlap with it (including itself). Used to scale bar height. */
export function getOverlapCounts(events: IntervalForLanes[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ev of events) {
    const end = ev.start_minutes + ev.duration_minutes;
    let n = 0;
    for (const other of events) {
      const oEnd = other.start_minutes + other.duration_minutes;
      if (ev.start_minutes < oEnd && other.start_minutes < end) n++;
    }
    counts.set(ev.id, n);
  }
  return counts;
}

export const MONTH_NAMES: Record<"pl" | "en", string[]> = {
  pl: [
    "Styczeń",
    "Luty",
    "Marzec",
    "Kwiecień",
    "Maj",
    "Czerwiec",
    "Lipiec",
    "Sierpień",
    "Wrzesień",
    "Październik",
    "Listopad",
    "Grudzień",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

export const DAY_NAMES: Record<"pl" | "en", string[]> = {
  pl: ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export const CALENDAR_MAX_STACK = MAX_STACK;

/* ---------- Tydzień od poniedziałku, siatka miesiąca (karta wg makiety 02) ---------- */

export type CalendarViewMode = "week" | "month" | "agenda";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Poniedziałek tygodnia, do którego należy dzień. */
export function startOfWeek(ymd: string): string {
  const d = parseYmd(ymd);
  return addCalendarDays(ymd, -((d.getDay() + 6) % 7));
}

/** Siedem dni tygodnia (pon–nd). */
export function weekDates(ymd: string): string[] {
  const start = startOfWeek(ymd);
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(start, i));
}

/** Ten sam dzień miesiąca przesunięty o `delta` miesięcy (przycięty do długości miesiąca). */
export function addCalendarMonths(ymd: string, delta: number): string {
  const d = parseYmd(ymd);
  const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return toYmd(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last)));
}

/** Tygodnie (pon–nd) pokrywające cały miesiąc; zakres wystarcza też dla widoku tygodnia. */
export function monthGrid(
  year: number,
  month: number
): { start: string; end: string; weeks: string[][] } {
  const first = toYmd(new Date(year, month, 1));
  const lastDay = toYmd(new Date(year, month + 1, 0));
  const weeks: string[][] = [];
  let cursor = startOfWeek(first);
  while (cursor <= lastDay) {
    weeks.push(weekDates(cursor));
    cursor = addCalendarDays(cursor, 7);
  }
  return { start: weeks[0][0], end: weeks[weeks.length - 1][6], weeks };
}

export const WEEKDAY_SHORT_PL = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];
export const WEEKDAY_MINI_PL = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];
export const WEEKDAY_LONG_PL = [
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
];
export const MONTH_GENITIVE_PL = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

/** Indeks 0 = poniedziałek. */
export function weekdayIndex(ymd: string): number {
  return (parseYmd(ymd).getDay() + 6) % 7;
}

/** `9–15 listopada` albo `30 listopada – 6 grudnia`. */
export function weekRangeLabel(dates: string[]): string {
  const a = parseYmd(dates[0]);
  const b = parseYmd(dates[dates.length - 1]);
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()}–${b.getDate()} ${MONTH_GENITIVE_PL[b.getMonth()]}`;
  }
  return `${a.getDate()} ${MONTH_GENITIVE_PL[a.getMonth()]} – ${b.getDate()} ${MONTH_GENITIVE_PL[b.getMonth()]}`;
}

/** `5 h 45`, `45 min`, `2 h`. */
export function formatHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

export function formatClock(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`;
}
