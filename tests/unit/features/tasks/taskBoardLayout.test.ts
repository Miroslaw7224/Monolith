import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLayout,
  saveLayout,
  clampHeight,
  effectiveCollapsed,
  boardColumns,
  LAYOUT_KEY,
  DEFAULT_LAYOUT,
} from "@/src/features/tasks/taskBoardLayout";

beforeEach(() => localStorage.clear());

describe("loadLayout", () => {
  it("brak wpisu i błędny JSON → domyślne", () => {
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
    localStorage.setItem(LAYOUT_KEY, "{nie json");
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });

  it("wysokość przycinana do 80–1200, nieznane statusy pominięte", () => {
    localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({
        collapsed: { done: true, nieznany: true },
        heights: { todo: 5, done: 5000, deferred: 300, xx: 400 },
      })
    );
    expect(loadLayout()).toEqual({
      collapsed: { done: true },
      heights: { todo: 80, done: 1200, deferred: 300 },
    });
  });

  it("wartości o złym typie są pomijane", () => {
    localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({ collapsed: { todo: "tak" }, heights: { todo: "wysoko", done: null } })
    );
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });

  it("zablokowany magazyn → domyślne", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});

describe("saveLayout", () => {
  it("round-trip", () => {
    saveLayout({ collapsed: { todo: true }, heights: { done: 400 } });
    expect(loadLayout()).toEqual({ collapsed: { todo: true }, heights: { done: 400 } });
  });

  it("zablokowany zapis nie rzuca", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    try {
      expect(() => saveLayout(DEFAULT_LAYOUT)).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe("clampHeight", () => {
  it("przycina i zaokrągla", () => {
    expect(clampHeight(5)).toBe(80);
    expect(clampHeight(5000)).toBe(1200);
    expect(clampHeight(300.6)).toBe(301);
  });
});

describe("effectiveCollapsed", () => {
  it("tryb roboczy: Zrobione domyślnie zwinięte, o ile brak własnego ustawienia", () => {
    expect(effectiveCollapsed(DEFAULT_LAYOUT, "work").done).toBe(true);
    expect(effectiveCollapsed(DEFAULT_LAYOUT, "normal").done).toBe(false);
    expect(effectiveCollapsed({ collapsed: { done: false }, heights: {} }, "work").done).toBe(
      false
    );
  });
});

describe("boardColumns", () => {
  const open = effectiveCollapsed({ collapsed: { done: false }, heights: {} }, "work");

  it("tryb normalny: pięć kolumn, zwinięta = 3rem (kolejność deferred, todo, in_progress, to_review, done)", () => {
    const all = effectiveCollapsed(DEFAULT_LAYOUT, "normal");
    expect(boardColumns("normal", all)).toBe("1fr 1fr 1fr 1fr 1fr");
    expect(boardColumns("normal", { ...all, todo: true, done: true })).toBe(
      "1fr 3rem 1fr 1fr 3rem"
    );
  });

  it("tryb roboczy: stos 1 | stos 2 | panel 2fr | done (zwinięcie kolumn w stosie nie zmienia siatki)", () => {
    expect(boardColumns("work", open)).toBe("1fr 1fr 2fr 1fr");
    expect(boardColumns("work", effectiveCollapsed(DEFAULT_LAYOUT, "work"))).toBe(
      "1fr 1fr 2fr 3rem"
    );
    expect(boardColumns("work", { ...open, todo: true, in_progress: true })).toBe(
      "1fr 1fr 2fr 1fr"
    );
  });
});
