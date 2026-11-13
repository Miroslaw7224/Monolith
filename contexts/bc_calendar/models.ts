/** Zdarzenie kalendarza zapisane w vaulcie (`Calendar/RRRR-MM.yaml`, klucz `events`). */
export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD (data lokalna użytkownika)
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: "work" | "meeting";
  /** Adres spotkania online (http/https); brak pola = brak linku. */
  link?: string;
  created_at?: string;
};

/** Wynik serwisu: zdarzenie zapisane albo `task_deadline` doklejony z zadań (nigdy nie zapisywany). */
export type CalendarEntry = Omit<CalendarEvent, "type"> & {
  type: "work" | "meeting" | "task_deadline";
};
