import { useEffect, useState } from "react";
import { type CalendarEvent, getDaysInMonth } from "./calendarUtils";

export function useCalendarData(
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>,
  refreshTrigger?: number
) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const days = getDaysInMonth(viewYear, viewMonth);
  const startDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
  const endDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(days.length).padStart(2, "0")}`;

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

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return {
    viewYear,
    viewMonth,
    events,
    setEvents,
    loading,
    days,
    startDate,
    endDate,
    handlePrevMonth,
    handleNextMonth,
  };
}
