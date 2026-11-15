// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { BugEntry, TasksBoard } from "@/contexts/bc_projects/models";
import {
  BUG_STALE_AFTER_DAYS,
  enrichBugs,
  findBugTask,
} from "@/contexts/bc_projects/services/bugs";

const TODAY = new Date(2026, 10, 12);

const board = (p: Partial<TasksBoard> = {}): TasksBoard => ({
  blockers: [],
  now: [],
  next: [],
  icebox: [],
  version: null,
  ...p,
});
const bug = (o: Partial<BugEntry> = {}): BugEntry => ({
  id: "GP-001",
  title: "t",
  section: "Aktywne",
  ...o,
});

describe("enrichBugs: wiek", () => {
  it("próg to 14 dni", () => {
    expect(BUG_STALE_AFTER_DAYS).toBe(14);
  });

  it("14 dni: wiek bez znaczka stary", () => {
    const [r] = enrichBugs([bug({ opened: "2026-10-29" })], board(), TODAY);
    expect(r.ageDays).toBe(14);
    expect(r.stale).toBeUndefined();
  });

  it("15 dni: stary", () => {
    const [r] = enrichBugs([bug({ opened: "2026-10-28" })], board(), TODAY);
    expect(r.ageDays).toBe(15);
    expect(r.stale).toBe(true);
  });

  it("brak Otwarto: bez wieku", () => {
    const [r] = enrichBugs([bug()], board(), TODAY);
    expect("ageDays" in r).toBe(false);
    expect("stale" in r).toBe(false);
  });

  it("zamknięty bug nie ma wieku", () => {
    const [r] = enrichBugs([bug({ section: "Zamknięte", opened: "2026-01-01" })], board(), TODAY);
    expect("ageDays" in r).toBe(false);
  });

  it("data z przyszłości daje 0 dni", () => {
    const [r] = enrichBugs([bug({ opened: "2026-11-20" })], board(), TODAY);
    expect(r.ageDays).toBe(0);
  });

  it("pusta lista zwraca ten sam obiekt, a wejście nie jest mutowane", () => {
    const empty: BugEntry[] = [];
    expect(enrichBugs(empty, board(), TODAY)).toBe(empty);
    const input = bug({ opened: "2026-10-01" });
    enrichBugs([input], board(), TODAY);
    expect(input).toEqual({ id: "GP-001", title: "t", section: "Aktywne", opened: "2026-10-01" });
  });
});

describe("findBugTask: powiązanie z zadaniem", () => {
  it("brak zadania", () => {
    expect(findBugTask("GP-001", board({ next: [{ text: "coś innego", done: false }] }))).toBe(
      undefined
    );
  });

  it("niezakończone zadanie z ID w treści", () => {
    const b = board({ next: [{ text: "**Porty** — echo (patrz GP-001)", done: false }] });
    expect(findBugTask("GP-001", b)).toEqual({ column: "next", done: false });
  });

  it("tylko zakończone zadanie", () => {
    const b = board({ now: [{ text: "GP-001 zrobione", done: true }] });
    expect(findBugTask("GP-001", b)).toEqual({ column: "now", done: true });
  });

  it("niezakończone wygrywa z zakończonym, także z dalszej kolumny", () => {
    const b = board({
      now: [{ text: "GP-001 zrobione", done: true }],
      icebox: [{ text: "GP-001 jeszcze", done: false }],
    });
    expect(findBugTask("GP-001", b)).toEqual({ column: "icebox", done: false });
  });

  it("ID musi być osobnym tokenem", () => {
    const b = board({
      next: [
        { text: "naprawa GP-0011", done: false },
        { text: "XGP-001", done: false },
        { text: "NX-GP-001", done: false },
      ],
    });
    expect(findBugTask("GP-001", b)).toBe(undefined);
    const ok = board({ next: [{ text: "(GP-001), potem reszta", done: false }] });
    expect(findBugTask("GP-001", ok)).toEqual({ column: "next", done: false });
  });

  it("enrichBugs dopisuje task także zamkniętemu bugowi", () => {
    const b = board({ now: [{ text: "GP-001", done: false }] });
    const [r] = enrichBugs([bug({ section: "Zamknięte" })], b, TODAY);
    expect(r.task).toEqual({ column: "now", done: false });
  });
});
