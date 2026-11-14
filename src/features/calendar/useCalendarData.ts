import { useEffect, useMemo, useState } from "react";
import {
  type CalendarEvent,
  type CalendarViewMode,
  addCalendarDays,
  addCalendarMonths,
  monthGrid,
  parseYmd,
  toYmd,
} from "./calendarUtils";

export function useCalendarData(
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>,
  refreshTrigger?: number
) {
  const [anchor, setAnchor] = useState(() => toYmd(new Date()));
  const [view, setView] = useState<CalendarViewMode>("week");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const anchorDate = parseYmd(anchor);
  const viewYear = anchorDate.getFullYear();
  const viewMonth = anchorDate.getMonth();
  const grid = useMemo(() => monthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  // Zakres siatki miesiąca (pon–nd) obejmuje też tydzień zakotwiczonego dnia.
  const startDate = grid.start;
  const endDate = grid.end;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/calendar/events?startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEvents(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, apiFetch, refreshTrigger]);

  /** Strzałki: w widoku miesiąca o miesiąc, w pozostałych o tydzień. */
  const shift = (direction: -1 | 1) =>
    setAnchor((a) =>
      view === "month" ? addCalendarMonths(a, direction) : addCalendarDays(a, 7 * direction)
    );

  return {
    anchor,
    setAnchor,
    view,
    setView,
    viewYear,
    viewMonth,
    grid,
    events,
    setEvents,
    loading,
    startDate,
    endDate,
    handlePrev: () => shift(-1),
    handleNext: () => shift(1),
    goToday: () => setAnchor(toYmd(new Date())),
  };
}
