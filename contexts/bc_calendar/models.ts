/** Typ zapisanego wydarzenia; każda inna wartość w pliku lub w żądaniu jest czytana jako `work`. */
export type EventType = "work" | "meeting" | "visit";

export function normalizeEventType(value: unknown): EventType {
  return value === "meeting" || value === "visit" ? value : "work";
}

/** Zdarzenie kalendarza zapisane w vaulcie (`Calendar/RRRR-MM.yaml`, klucz `events`). */
export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD (data lokalna użytkownika)
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type: EventType;
  /** Adres spotkania online (http/https); brak pola = brak linku. */
  link?: string;
  /** Notatka przed spotkaniem (wiele linii; każda linia = punkt); brak pola = brak briefu. */
  brief?: string;
  created_at?: string;
};

/** Wynik serwisu: zdarzenie zapisane albo `task_deadline` doklejony z zadań (nigdy nie zapisywany). */
export type CalendarEntry = Omit<CalendarEvent, "type"> & {
  type: EventType | "task_deadline";
};
