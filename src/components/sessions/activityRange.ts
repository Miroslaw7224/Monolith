/** Minuty sesji w zakresie dni (lokalny kalendarz, bez przesunięcia UTC dla YYYY-MM-DD). */

const MS_PER_MIN = 60_000;
const MINS_PER_DAY = 24 * 60;

function parseLocalMidnight(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d).getTime();
}

function eventStartMs(ev: { date: string; start_minutes: number }): number {
  return parseLocalMidnight(ev.date) + ev.start_minutes * MS_PER_MIN;
}

function eventEndMs(ev: { date: string; start_minutes: number; duration_minutes: number }): number {
  return eventStartMs(ev) + ev.duration_minutes * MS_PER_MIN;
}

/** Minutes of the event that fall inside [rangeStart 00:00, rangeEnd+1day). */
export function eventMinutesInInclusiveRange(
  ev: { date: string; start_minutes: number; duration_minutes: number },
  rangeStart: string,
  rangeEnd: string
): number {
  if (ev.duration_minutes <= 0) return 0;
  const rs = parseLocalMidnight(rangeStart);
  const reEx = parseLocalMidnight(rangeEnd) + MINS_PER_DAY * MS_PER_MIN;
  if (Number.isNaN(rs) || Number.isNaN(reEx) || reEx <= rs) return 0;
  const evS = eventStartMs(ev);
  const evE = eventEndMs(ev);
  const overlapStart = Math.max(evS, rs);
  const overlapEnd = Math.min(evE, reEx);
  if (overlapStart >= overlapEnd) return 0;
  return Math.round((overlapEnd - overlapStart) / MS_PER_MIN);
}
