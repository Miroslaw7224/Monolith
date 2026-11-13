// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readBoardText } from "@/contexts/bc_projects/repositories/tasks-file";

const SAMPLE = `# Tasks — Demo
> [[demo/demo|Demo]] | [[demo/index|Info]]

## Blokery

_Brak aktywnych blokerów_

## Next

- [ ] **Pierwsze** zadanie z \`kodem\`
  - [ ] podpunkt A
  - notatka B
- [ ] Drugie [now::]
- [ ] Trzecie

Ręczna notatka pod listą.

## Backlog

- [x] Zrobione — 2026-05-19
- [ ] Powtórka
- [ ] Powtórka
`;

describe("tasks-file: readBoardText", () => {
  it("dzieli SAMPLE na kolumny, pomijając podpunkty i prozę", () => {
    expect(readBoardText(SAMPLE)).toEqual({
      blockers: [],
      now: [{ text: "Drugie", done: false }],
      next: [
        { text: "**Pierwsze** zadanie z `kodem`", done: false },
        { text: "Trzecie", done: false },
      ],
      icebox: [
        { text: "Zrobione", done: true, doneDate: "2026-05-19" },
        { text: "Powtórka", done: false },
        { text: "Powtórka", done: false },
      ],
    });
  });

  it("brak pliku daje cztery puste kolumny", () => {
    expect(readBoardText(null)).toEqual({ blockers: [], now: [], next: [], icebox: [] });
  });

  it("znacznik przy ukończonym jest ignorowany (kolumna next, data zdjęta)", () => {
    const board = readBoardText("## Next\n\n- [x] Gotowe [now::] — 2026-11-01\n");
    expect(board.next).toEqual([{ text: "Gotowe", done: true, doneDate: "2026-11-01" }]);
    expect(board.now).toEqual([]);
  });

  it("data przy nieukończonym zostaje w tekście", () => {
    expect(readBoardText("## Backlog\n\n- [ ] Coś — 2026-05-19\n").icebox).toEqual([
      { text: "Coś — 2026-05-19", done: false },
    ]);
  });

  it("gwiazdka i wcięte checkboxy nie są zadaniami tablicy", () => {
    expect(readBoardText("## Next\n\n* [ ] gwiazdka\n  - [ ] wcięte\n").next).toEqual([]);
  });

  it("[x] i [X] to ukończone", () => {
    expect(readBoardText("## Blokery\n\n- [x] A\n- [X] B\n").blockers).toEqual([
      { text: "A", done: true },
      { text: "B", done: true },
    ]);
  });

  it("sekcje spoza trzech znanych są ignorowane", () => {
    expect(readBoardText("## Notatki\n\n- [ ] x\n")).toEqual({
      blockers: [],
      now: [],
      next: [],
      icebox: [],
    });
  });
});
