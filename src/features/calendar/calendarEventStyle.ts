import type { CalendarEvent } from "./calendarUtils";

/** Modyfikator klasy `.kal-ev--*` wg typu i tagów wydarzenia. */
export function eventModifier(ev: CalendarEvent): string {
  if (ev.type === "task_deadline") return "kal-ev--deadline";
  if (ev.tags?.some((tag) => tag.toLowerCase() === "etat")) return "kal-ev--etat";
  if (ev.type === "meeting") return "kal-ev--meeting";
  return "";
}

export function isEtat(ev: CalendarEvent): boolean {
  return ev.tags?.some((tag) => tag.toLowerCase() === "etat") ?? false;
}
