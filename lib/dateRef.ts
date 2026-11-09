export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday–Sunday (local), for "this week" in prompts */
export function weekRangeMonSun(now: Date): { start: string; end: string } {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = d.getDay(); // 0 Sun … 6 Sat
  const daysFromMonday = (dow + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysFromMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatYmd(monday), end: formatYmd(sunday) };
}
