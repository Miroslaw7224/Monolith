/** Duration options in minutes (multiples of 15). */
export const DURATION_OPTIONS = Array.from({ length: 32 }, (_, i) => (i + 1) * 15); // 15 .. 480 (8h)

/** Fixed color palette for calendar events (max 12). */
export const CALENDAR_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316",
  "#6366F1",
  "#14B8A6",
  "#A855F7",
];

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export const EVENT_TYPE_DEFAULT_DURATION: Record<"work" | "meeting", number> = {
  work: 60,
  meeting: 30,
};
