export interface CalendarEvent {
  id: string;
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting" | "task_deadline";
  created_at?: string;
}

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
