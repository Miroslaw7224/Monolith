import { describe, expect, it } from "vitest";
import {
  alertItems,
  checklistProgress,
  countLevels,
  filterCodex,
  sectionLevelCounts,
  type RuleDto,
  type SectionDto,
} from "@/src/features/codex/codexFilters";

const rules: RuleDto[] = [
  { id: "TDD-1", level: "MUST", text: "Brak kodu bez czerwonego testu", line: 6 },
  { id: "TDD-2", level: "SHOULD", text: "Pętla Red-Green-Refactor", line: 7 },
  { id: "ASERCJE-1", level: "MUST", text: "Zakaz asercji pozornych", line: 10 },
];
const sections: SectionDto[] = [
  {
    id: "sec-tdd",
    title: "1. TDD",
    blocks: [
      { kind: "text", text: "Wstęp" },
      { kind: "rule", ruleId: "TDD-1" },
      { kind: "rule", ruleId: "TDD-2" },
    ],
  },
  { id: "sec-asercje", title: "2. Asercje", blocks: [{ kind: "rule", ruleId: "ASERCJE-1" }] },
];

const ids = (result: SectionDto[]) =>
  result.map((s) => [s.id, s.blocks.map((b) => (b.kind === "rule" ? b.ruleId : "tekst"))]);

describe("filterCodex", () => {
  it("bez filtra zwraca sekcje bez zmian, z blokami tekstowymi", () => {
    expect(filterCodex(sections, rules, "all", "")).toBe(sections);
  });

  it("poziom must zostawia tylko MUST i gubi bloki tekstowe", () => {
    expect(ids(filterCodex(sections, rules, "must", ""))).toEqual([
      ["sec-tdd", ["TDD-1"]],
      ["sec-asercje", ["ASERCJE-1"]],
    ]);
  });

  it("poziom should pomija sekcję bez pasujących reguł", () => {
    expect(ids(filterCodex(sections, rules, "should", ""))).toEqual([["sec-tdd", ["TDD-2"]]]);
  });

  it("zapytanie dopasowuje po ID bez względu na wielkość liter i spacje", () => {
    expect(ids(filterCodex(sections, rules, "all", "  tdd-1 "))).toEqual([["sec-tdd", ["TDD-1"]]]);
  });

  it("zapytanie dopasowuje po tekście reguły", () => {
    expect(ids(filterCodex(sections, rules, "all", "czerwon"))).toEqual([["sec-tdd", ["TDD-1"]]]);
  });

  it("poziom i zapytanie działają razem; brak dopasowań daje pustą listę", () => {
    expect(filterCodex(sections, rules, "should", "asercji")).toEqual([]);
  });
});

describe("countLevels i sectionLevelCounts", () => {
  it("zlicza wszystkie, MUST i SHOULD", () => {
    expect(countLevels(rules)).toEqual({ all: 3, must: 2, should: 1 });
  });

  it("zlicza poziomy w sekcji", () => {
    expect(sectionLevelCounts(sections[0], rules)).toEqual({ must: 1, should: 1 });
    expect(sectionLevelCounts(sections[1], rules)).toEqual({ must: 1, should: 0 });
  });
});

describe("checklistProgress", () => {
  const items = ["c-1", "c-2", "c-3", "c-4", "c-5", "c-6"].map((id) => ({ id }));
  const run = (checked: string[]) => ({
    run: "r1",
    owner: "personal" as const,
    checklist: "c",
    task: "",
    startedAt: "2026-11-14T10:00:00.000Z",
    ended: false,
    items: Object.fromEntries(checked.map((id) => [id, { checked: true, note: "" }])),
  });

  it("4 z 6 odhaczonych daje 67% (zaokrąglenie)", () => {
    expect(checklistProgress(items, run(["c-1", "c-2", "c-3", "c-4"]))).toEqual({
      done: 4,
      total: 6,
      pct: 67,
    });
  });

  it("bez uruchomienia nic nie jest odhaczone", () => {
    expect(checklistProgress(items, undefined)).toEqual({ done: 0, total: 6, pct: 0 });
  });

  it("puste items nie dzielą przez zero", () => {
    expect(checklistProgress([], undefined)).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it("odznaczony punkt (checked: false) nie liczy się", () => {
    const r = run(["c-1"]);
    r.items["c-2"] = { checked: false, note: "x" };
    expect(checklistProgress(items, r).done).toBe(1);
  });
});

describe("alertItems", () => {
  it("brak ostrzeżeń daje pustą listę", () => {
    expect(alertItems([], 0, false, "2026-11.jsonl")).toEqual([]);
  });

  it("ostrzeżenia parsera dostają tagi, uszkodzone linie jedną zbiorczą pozycję", () => {
    const items = alertItems(
      [
        { kind: "duplicate-id", message: "Reguła [TDD-1] powtórzona", line: 9 },
        { kind: "unknown-ref", message: "Brak [SEC-4]", line: 20 },
      ],
      2,
      false,
      "2026-11.jsonl"
    );
    expect(items.map((i) => i.tag)).toEqual([
      "Zduplikowany identyfikator",
      "Brakująca reguła",
      "Dziennik zdarzeń",
    ]);
    expect(items[2].text).toContain("2 uszkodzone linie");
    expect(items[2].text).toContain("2026-11.jsonl");
  });

  it("jedna uszkodzona linia w liczbie pojedynczej, niedokończony ogon to osobna pozycja", () => {
    const items = alertItems([], 1, true, null);
    expect(items).toHaveLength(2);
    expect(items[0].text).toContain("1 uszkodzoną linię");
    expect(items[1].text).toContain("nie jest dokończona");
  });

  it("liczba pojedyncza i mnoga uszkodzonych linii po polsku", () => {
    expect(alertItems([], 1, false, "2026-11.jsonl", "pl")[0].text).toContain("1 uszkodzoną linię");
    expect(alertItems([], 2, false, "2026-11.jsonl", "pl")[0].text).toContain("2 uszkodzone linie");
    expect(alertItems([], 5, false, "2026-11.jsonl", "pl")[0].text).toContain(
      "5 uszkodzonych linii"
    );
  });

  it("liczba pojedyncza i mnoga uszkodzonych linii po angielsku", () => {
    expect(alertItems([], 1, false, "2026-11.jsonl", "en")[0].text).toContain("1 corrupted line");
    expect(alertItems([], 2, false, "2026-11.jsonl", "en")[0].text).toContain("2 corrupted lines");
  });
});
