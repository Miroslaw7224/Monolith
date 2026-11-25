import { describe, expect, it } from "vitest";
import { eventModifier } from "@/src/features/calendar/calendarEventStyle";
import type { CalendarEvent } from "@/src/features/calendar/calendarUtils";

const ev = (over: Partial<CalendarEvent>): CalendarEvent =>
  ({
    id: "e",
    date: "2026-12-07",
    start_minutes: 450,
    duration_minutes: 60,
    title: "T",
    tags: [],
    color: "#3B82F6",
    type: "work",
    ...over,
  }) as CalendarEvent;

describe("eventModifier", () => {
  it("visit ma własną klasę, meeting i work jak dotąd", () => {
    expect(eventModifier(ev({ type: "visit" }))).toBe("kal-ev--visit");
    expect(eventModifier(ev({ type: "meeting" }))).toBe("kal-ev--meeting");
    expect(eventModifier(ev({ type: "work" }))).toBe("");
  });

  it("tag etat i termin zadania mają pierwszeństwo przed typem", () => {
    expect(eventModifier(ev({ type: "visit", tags: ["Etat"] }))).toBe("kal-ev--etat");
    expect(eventModifier(ev({ type: "task_deadline" }))).toBe("kal-ev--deadline");
  });
});
